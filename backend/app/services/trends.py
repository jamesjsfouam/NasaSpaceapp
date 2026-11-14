"""Análisis de tendencias lineales sobre series mensuales.

Método (pensado para ser explicable a estudiantes):
1. Se descartan los años incompletos y se calcula el ciclo estacional (promedio de cada mes).
2. Se promedian los 12 meses de cada año: así desaparece la estación y queda una serie
   anual con un valor por año.
3. Sobre esa serie anual se estima la tasa de cambio con Theil–Sen (robusta a valores
   extremos) y con regresión lineal (OLS), ambas con intervalo de confianza del 95 %.
4. Se prueba si la tendencia es distinta de cero con Mann-Kendall (sin supuesto de
   normalidad; es la prueba principal) y con el t-test de la pendiente de OLS.

5. Se busca un posible salto brusco (prueba de Pettitt). Si un escalón explica los datos
   mejor que una recta, se avisa: suele indicar un cambio en las observaciones que alimentan
   el modelo, no un cambio gradual del clima.

Limitaciones: solo tendencias lineales; la autocorrelación entre años puede hacer que la
significancia parezca mayor de lo que es (se avisa si se detecta); y al probar muchas
variables a la vez algunas saldrán "significativas" por azar (se da el p ajustado de Bonferroni).
"""
from __future__ import annotations

import math
from collections import defaultdict

import numpy as np
from pydantic import BaseModel
from scipy import stats

from app.catalog import VARIABLE_BY_KEY, Variable

MIN_YEARS = 10
ALPHA = 0.05


class InsufficientData(ValueError):
    pass


class AnnualPoint(BaseModel):
    year: int
    mean: float


class MonthlyPoint(BaseModel):
    date: str  # YYYY-MM
    anomaly: float  # valor menos el promedio de ese mes en todo el periodo


class Series(BaseModel):
    annual: list[AnnualPoint]
    monthly: list[MonthlyPoint]
    trend_line: list[AnnualPoint]  # recta de Theil–Sen, extremos del periodo


class TrendResult(BaseModel):
    variable: str
    label: str
    unit: str
    first_year: int
    last_year: int
    n_years: int
    direction: str  # up | down | flat
    slope_per_decade: float
    ci_low_per_decade: float
    ci_high_per_decade: float
    total_change: float
    percent_change: float | None
    ols_slope_per_decade: float
    ols_ci_low_per_decade: float
    ols_ci_high_per_decade: float
    ols_p: float
    mk_tau: float
    mk_p: float
    p_adjusted: float | None = None  # Bonferroni, solo al escanear varias variables
    step_year: int | None = None  # año de un posible salto brusco, si lo hay
    significance: str  # very | yes | weak | no
    significant: bool
    methods_agree: bool
    warnings: list[str]
    interpretation: str
    series: Series | None = None


SIGNIFICANCE_LABEL = {
    "very": "muy significativa",
    "yes": "significativa",
    "weak": "indicio débil",
    "no": "no significativa",
}


def _level(p: float) -> str:
    return "very" if p < 0.01 else "yes" if p < ALPHA else "weak" if p < 0.10 else "no"


def _fmt(x: float) -> str:
    """Tres cifras significativas, sin notación científica para valores comunes."""
    if x == 0:
        return "0"
    digits = max(0, 2 - math.floor(math.log10(abs(x))))
    return f"{x:.{min(digits, 6)}f}".replace(".", ",")


def _signed(x: float) -> str:
    return ("+" if x > 0 else "") + _fmt(x)


def _p_text(p: float) -> str:
    return "p < 0,0001" if p < 1e-4 else f"p = {p:.4f}".replace(".", ",")


def _step_change(years: np.ndarray, y: np.ndarray, line_resid: np.ndarray) -> tuple[int, float] | None:
    """Posible salto brusco: Pettitt significativo y un escalón que ajusta mejor que la recta."""
    n = len(y)
    sign = np.sign(y[None, :] - y[:, None])  # sign[i, j] = signo(y_j - y_i)
    u = np.array([sign[: k + 1, k + 1 :].sum() for k in range(n - 1)])
    k_best = int(np.argmax(np.abs(u)))
    p = min(1.0, 2 * math.exp(-6 * float(np.abs(u[k_best])) ** 2 / (n**3 + n**2)))
    rss_step = float(
        np.sum((y[: k_best + 1] - y[: k_best + 1].mean()) ** 2)
        + np.sum((y[k_best + 1 :] - y[k_best + 1 :].mean()) ** 2)
    )
    rss_line = float(np.sum(line_resid**2))
    if p < ALPHA and rss_step < 0.7 * rss_line:
        return int(years[k_best + 1]), p
    return None


def _complete_years(monthly: dict[str, float], start: int, end: int) -> dict[int, dict[int, float]]:
    by_year: dict[int, dict[int, float]] = defaultdict(dict)
    for key, value in monthly.items():
        year, month = int(key[:4]), int(key[4:6])
        if start <= year <= end and 1 <= month <= 12:
            by_year[year][month] = value
    return {y: m for y, m in sorted(by_year.items()) if len(m) == 12}


def analyze(
    variable: Variable,
    monthly: dict[str, float],
    start: int,
    end: int,
    include_series: bool = True,
) -> TrendResult:
    years_data = _complete_years(monthly, start, end)
    if len(years_data) < MIN_YEARS:
        raise InsufficientData(
            f"Hacen falta al menos {MIN_YEARS} años completos y hay {len(years_data)} "
            f"para {variable.label.lower()} entre {start} y {end}."
        )
    years = np.array(list(years_data), dtype=float)
    annual = np.array([np.mean(list(m.values())) for m in years_data.values()])
    monthly_points = None
    if include_series:
        clim = {
            m: float(np.mean([months[m] for months in years_data.values()])) for m in range(1, 13)
        }
        monthly_points = [
            MonthlyPoint(date=f"{y}-{m:02d}", anomaly=float(v - clim[m]))
            for y, months in years_data.items()
            for m, v in sorted(months.items())
        ]
    return analyze_annual(variable, years, annual, include_series, monthly_points)


def annual_means(monthly: dict[str, float], start: int, end: int) -> dict[int, float]:
    """Media de cada año completo del periodo."""
    return {
        y: float(np.mean(list(m.values()))) for y, m in _complete_years(monthly, start, end).items()
    }


def analyze_annual(
    variable: Variable,
    years: np.ndarray,
    annual: np.ndarray,
    include_series: bool = True,
    monthly_points: list[MonthlyPoint] | None = None,
) -> TrendResult:
    """Tendencia sobre una serie anual (un valor por año). La usan también los indicadores
    socioeconómicos, que ya vienen como datos anuales."""
    if len(years) < MIN_YEARS:
        raise InsufficientData(
            f"Hacen falta al menos {MIN_YEARS} años con datos y hay {len(years)} "
            f"para {variable.label.lower()}."
        )
    years = np.asarray(years, dtype=float)
    annual = np.asarray(annual, dtype=float)

    # --- estadística sobre medias anuales ---
    ts_slope, ts_icpt, ts_lo, ts_hi = stats.theilslopes(annual, years, 0.95)
    ols = stats.linregress(years, annual)
    tcrit = stats.t.ppf(0.975, len(years) - 2)
    tau, mk_p = stats.kendalltau(years, annual)
    mk_p = float(mk_p)

    span = float(years[-1] - years[0])
    total = ts_slope * span
    percent = None
    if variable.ratio_scale:
        base = float(np.mean(annual[:5]))
        percent = float(total / abs(base) * 100) if abs(base) > 1e-9 else None

    level = _level(mk_p)
    significant = mk_p < ALPHA
    direction = "flat" if ts_slope == 0 else ("up" if ts_slope > 0 else "down")

    warnings = []
    resid = annual - (ts_icpt + ts_slope * years)
    if np.std(resid[:-1]) > 0 and np.std(resid[1:]) > 0:
        r1 = float(np.corrcoef(resid[:-1], resid[1:])[0, 1])
        if r1 > 0.3:
            warnings.append(
                f"Los años consecutivos se parecen entre sí (autocorrelación {_fmt(r1)}): "
                "la significancia puede estar sobreestimada."
            )
    step = _step_change(years, annual, annual - (ols.intercept + ols.slope * years))
    if step:
        warnings.append(
            f"Parece un salto brusco hacia {step[0]} (Pettitt, {_p_text(step[1])}) más que un "
            "cambio gradual: puede deberse a un cambio en cómo se miden o producen los datos. "
            "Contrasta con otra fuente antes de concluir."
        )
    if len(years) < 20:
        warnings.append("Serie corta: una tendencia que hoy no es significativa puede serlo con más años.")

    unit = variable.unit
    verb = "aumenta" if ts_slope > 0 else "disminuye"
    if significant:
        text = (
            f"{variable.label} {verb} {_fmt(abs(ts_slope * 10))} {unit} por década "
            f"(IC 95 %: {_fmt(ts_lo * 10)} a {_fmt(ts_hi * 10)}). Entre {int(years[0])} y "
            f"{int(years[-1])} el cambio total estimado es {_signed(total)} {unit}"
            + (f" ({_signed(percent)} %)" if percent is not None else "")
            + f". Tendencia {SIGNIFICANCE_LABEL[level]} (Mann-Kendall, {_p_text(mk_p)})."
        )
    else:
        text = (
            f"No se detecta una tendencia significativa en {variable.label.lower()}. La pendiente "
            f"estimada es {_fmt(ts_slope * 10)} {unit} por década (IC 95 %: {_fmt(ts_lo * 10)} a "
            f"{_fmt(ts_hi * 10)}), un cambio que con la variación natural de {int(years[0])} a "
            f"{int(years[-1])} no se distingue de cero (Mann-Kendall, {_p_text(mk_p)})."
        )

    result = TrendResult(
        variable=variable.key,
        label=variable.label,
        unit=unit,
        first_year=int(years[0]),
        last_year=int(years[-1]),
        n_years=len(years),
        direction=direction,
        slope_per_decade=float(ts_slope * 10),
        ci_low_per_decade=float(ts_lo * 10),
        ci_high_per_decade=float(ts_hi * 10),
        total_change=float(total),
        percent_change=percent,
        ols_slope_per_decade=float(ols.slope * 10),
        ols_ci_low_per_decade=float((ols.slope - tcrit * ols.stderr) * 10),
        ols_ci_high_per_decade=float((ols.slope + tcrit * ols.stderr) * 10),
        ols_p=float(ols.pvalue),
        mk_tau=float(tau),
        mk_p=mk_p,
        significance=level,
        significant=significant,
        methods_agree=(float(ols.pvalue) < ALPHA) == significant,
        warnings=warnings,
        step_year=step[0] if step else None,
        interpretation=text,
    )

    if include_series:
        result.series = Series(
            annual=[AnnualPoint(year=int(y), mean=float(a)) for y, a in zip(years, annual)],
            monthly=monthly_points or [],
            trend_line=[
                AnnualPoint(year=int(y), mean=float(ts_icpt + ts_slope * y))
                for y in (years[0], years[-1])
            ],
        )
    return result


def scan(all_monthly: dict[str, dict[str, float]], start: int, end: int) -> list[TrendResult]:
    """Analiza todas las variables disponibles y las ordena por evidencia (p de Mann-Kendall)."""
    results = []
    for key, monthly in all_monthly.items():
        variable = VARIABLE_BY_KEY.get(key)
        if variable is None:
            continue
        try:
            results.append(analyze(variable, monthly, start, end, include_series=False))
        except InsufficientData:
            continue
    for r in results:
        r.p_adjusted = min(1.0, r.mk_p * len(results))
    return sorted(results, key=lambda r: r.mk_p)

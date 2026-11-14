"""Motor de tendencias lineales con un veredicto honesto.

Método (ver docs/RETO.md, pensado para explicarse a estudiantes):

1. **Anomalías:** a cada mes se le resta la media de ese mes del calendario (quita la estación).
2. **Medias anuales** de las anomalías, exigiendo al menos 10 meses válidos por año. La prueba
   principal se hace sobre esta serie anual, que tiene mucha menos autocorrelación que la mensual.
3. **Magnitud:** pendiente de Theil–Sen (resiste valores extremos) con su IC del 95 %, y la de
   mínimos cuadrados.
4. **Significancia,** resistente a la autocorrelación (los datos ambientales "tienen memoria"):
   - Mann-Kendall con **preblanqueo** (se quita la autocorrelación de lag 1 antes de la prueba).
   - Regresión con **tamaño de muestra efectivo** n·(1−r)/(1+r) para el intervalo del 95 %.
   En los dos, r se corrige por el sesgo de muestra pequeña: con pocos años, la autocorrelación
   estimada sale demasiado baja. Validado por simulación: con 30 años y sin tendencia, los falsos
   positivos quedan en 3,6 % (φ = 0), 4,8 % (φ = 0,4) y 8,2 % (φ = 0,8), frente al 19 % y 49 %
   de la regresión corriente.
5. **Veredicto** (umbrales publicados en docs/RETO.md):
   - "significant": Mann-Kendall p < 0,05 **y** el IC del 95 % (n efectivo) no incluye el cero.
   - "not_yet": p entre 0,05 y 0,20, o las dos pruebas no coinciden.
   - "no_trend": p ≥ 0,20.
   - Datos insuficientes: menos de 15 años (se lanza InsufficientData).
6. **Años que faltan** (Weatherhead et al. 1998, adaptado a datos anuales):
   n* ≈ [3,3 · σ · √12 / |ω| · √((1+φ)/(1−φ))]^(2/3). Validado por simulación: a n* años se
   detecta la tendencia en ~90 % de los casos.
7. **Sensibilidad al periodo:** se repite el veredicto moviendo el año inicial y el final hasta
   3 años. Si cambia, se avisa.
8. **Salto brusco** (Pettitt): si un escalón explica los datos mejor que una recta, se avisa.

Al escanear muchas variables se da también el p ajustado de Bonferroni.
"""
from __future__ import annotations

import math
from collections import defaultdict

import numpy as np
from pydantic import BaseModel
from scipy import stats

from app.catalog import VARIABLE_BY_KEY, Variable

MIN_YEARS = 15
MIN_MONTHS_PER_YEAR = 10
ALPHA = 0.05
NOT_YET_P = 0.20
PERIOD_SHIFT = 3


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
    verdict: str  # significant | not_yet | no_trend
    significant: bool
    slope_per_decade: float  # Theil–Sen
    ci_low_per_decade: float
    ci_high_per_decade: float
    total_change: float
    percent_change: float | None
    ols_slope_per_decade: float
    ols_ci_low_per_decade: float  # con tamaño de muestra efectivo
    ols_ci_high_per_decade: float
    ols_p: float  # con tamaño de muestra efectivo
    n_effective: float
    autocorrelation: float  # lag 1 de los residuos, corregida por sesgo
    mk_tau: float
    mk_p: float  # Mann-Kendall con preblanqueo
    methods_agree: bool
    years_needed: int | None  # años totales para detectar este ritmo (~90 %), si no es significativa
    period_sensitive: bool
    p_adjusted: float | None = None  # Bonferroni, solo al escanear varias variables
    step_year: int | None = None  # año de un posible salto brusco, si lo hay
    warnings: list[str]
    interpretation: str
    series: Series | None = None


VERDICT_LABEL = {
    "significant": "tendencia significativa",
    "not_yet": "tendencia todavía no significativa",
    "no_trend": "sin tendencia clara",
}


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


# --- piezas estadísticas -------------------------------------------------------------------


def lag1(resid: np.ndarray) -> float:
    """Autocorrelación de lag 1 corregida por el sesgo de muestra pequeña, en [0, 0,95]."""
    n = len(resid)
    if n < 4 or np.std(resid[:-1]) == 0 or np.std(resid[1:]) == 0:
        return 0.0
    r = float(np.corrcoef(resid[:-1], resid[1:])[0, 1])
    return float(min(0.95, max(0.0, r + (1 + 4 * r) / n)))


def mk_prewhitened(years: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Mann-Kendall con preblanqueo: devuelve (τ de la serie original, p preblanqueado)."""
    tau, p_raw = stats.kendalltau(years, y)
    slope = stats.theilslopes(y, years)[0]
    r = lag1(y - slope * years)
    if r <= 0:
        return float(tau), float(p_raw)
    _, p = stats.kendalltau(years[1:], y[1:] - r * y[:-1])
    return float(tau), float(p)


def ols_effective(years: np.ndarray, y: np.ndarray) -> tuple[float, float, float, float, float, float]:
    """Regresión con tamaño de muestra efectivo: (pendiente, IC bajo, IC alto, p, n_ef, r)."""
    n = len(y)
    fit = stats.linregress(years, y)
    r = lag1(y - (fit.intercept + fit.slope * years))
    n_eff = max(3.0, n * (1 - r) / (1 + r))
    df = max(1.0, n_eff - 2)
    se = fit.stderr * math.sqrt((n - 2) / df)
    t = stats.t.ppf(0.975, df)
    p = float(2 * stats.t.sf(abs(fit.slope / se), df)) if se > 0 else 1.0
    return float(fit.slope), float(fit.slope - t * se), float(fit.slope + t * se), p, float(n_eff), r


def years_needed(sigma: float, slope_per_year: float, phi: float) -> int | None:
    """Años de datos anuales para detectar este ritmo con ~90 % de probabilidad (Weatherhead)."""
    if slope_per_year == 0 or sigma <= 0:
        return None
    phi = min(phi, 0.95)
    n = (3.3 * sigma * math.sqrt(12) / abs(slope_per_year) * math.sqrt((1 + phi) / (1 - phi))) ** (2 / 3)
    return math.ceil(n)


def _verdict(mk_p: float, ci_low: float, ci_high: float, p_eff: float) -> tuple[str, bool]:
    ci_excludes_zero = ci_low > 0 or ci_high < 0
    agree = (mk_p < ALPHA) == (p_eff < ALPHA)
    if mk_p < ALPHA and ci_excludes_zero:
        return "significant", agree
    if mk_p < NOT_YET_P or not agree:
        return "not_yet", agree
    return "no_trend", agree


def _quick_verdict(years: np.ndarray, y: np.ndarray) -> str:
    _, mk_p = mk_prewhitened(years, y)
    _, lo, hi, p_eff, _, _ = ols_effective(years, y)
    return _verdict(mk_p, lo, hi, p_eff)[0]


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


# --- de mensual a anual ----------------------------------------------------------------------


def _monthly_table(monthly: dict[str, float], start: int, end: int) -> dict[int, dict[int, float]]:
    by_year: dict[int, dict[int, float]] = defaultdict(dict)
    for key, value in monthly.items():
        year, month = int(key[:4]), int(key[4:6])
        if start <= year <= end and 1 <= month <= 12:
            by_year[year][month] = value
    return dict(sorted(by_year.items()))


def _annual_from_monthly(
    monthly: dict[str, float], start: int, end: int
) -> tuple[dict[int, float], list[MonthlyPoint]]:
    """Medias anuales (en unidades de la variable) a partir de anomalías mensuales.

    Un año cuenta si tiene al menos 10 meses válidos; como se promedian anomalías, que falte
    un mes de verano no sesga el promedio del año.
    """
    table = _monthly_table(monthly, start, end)
    clim = {}
    for m in range(1, 13):
        vals = [months[m] for months in table.values() if m in months]
        if vals:
            clim[m] = float(np.mean(vals))
    if not clim:
        return {}, []
    base = float(np.mean(list(clim.values())))
    annual, points = {}, []
    for y, months in table.items():
        anoms = {m: v - clim[m] for m, v in months.items() if m in clim}
        for m, a in sorted(anoms.items()):
            points.append(MonthlyPoint(date=f"{y}-{m:02d}", anomaly=float(a)))
        if len(anoms) >= MIN_MONTHS_PER_YEAR:
            annual[y] = base + float(np.mean(list(anoms.values())))
    return annual, points


def annual_means(monthly: dict[str, float], start: int, end: int) -> dict[int, float]:
    """Media de cada año con al menos 10 meses válidos."""
    return _annual_from_monthly(monthly, start, end)[0]


# --- análisis ---------------------------------------------------------------------------------


def analyze(
    variable: Variable,
    monthly: dict[str, float],
    start: int,
    end: int,
    include_series: bool = True,
) -> TrendResult:
    annual, points = _annual_from_monthly(monthly, start, end)
    if len(annual) < MIN_YEARS:
        raise InsufficientData(
            f"Datos insuficientes: hacen falta al menos {MIN_YEARS} años con datos y hay "
            f"{len(annual)} para {variable.label.lower()} entre {start} y {end}. "
            "Prueba un periodo más largo u otra variable."
        )
    return analyze_annual(
        variable, list(annual), list(annual.values()), include_series, points if include_series else None
    )


def analyze_annual(
    variable: Variable,
    years: list[int] | np.ndarray,
    annual: list[float] | np.ndarray,
    include_series: bool = True,
    monthly_points: list[MonthlyPoint] | None = None,
) -> TrendResult:
    """Tendencia sobre una serie anual (un valor por año). La usan también los indicadores
    socioeconómicos y demográficos, que ya vienen como datos anuales."""
    years = np.asarray(years, dtype=float)
    annual = np.asarray(annual, dtype=float)
    if len(years) < MIN_YEARS:
        raise InsufficientData(
            f"Datos insuficientes: hacen falta al menos {MIN_YEARS} años con datos y hay "
            f"{len(years)} para {variable.label.lower()}."
        )
    n = len(years)

    # magnitud
    ts_slope, ts_icpt, ts_lo, ts_hi = stats.theilslopes(annual, years, 0.95)
    # significancia resistente a la autocorrelación
    tau, mk_p = mk_prewhitened(years, annual)
    ols_slope, ols_lo, ols_hi, p_eff, n_eff, r = ols_effective(years, annual)
    verdict, agree = _verdict(mk_p, ols_lo, ols_hi, p_eff)
    significant = verdict == "significant"
    direction = "flat" if ts_slope == 0 else ("up" if ts_slope > 0 else "down")

    span = float(years[-1] - years[0])
    total = ts_slope * span
    percent = None
    if variable.ratio_scale:
        base = float(np.mean(annual[:5]))
        percent = float(total / abs(base) * 100) if abs(base) > 1e-9 else None

    resid = annual - (ts_icpt + ts_slope * years)
    sigma = float(np.std(resid, ddof=2)) if n > 2 else 0.0
    needed = None if significant else years_needed(sigma, float(ts_slope), r)

    # sensibilidad al periodo: mover inicio y fin hasta 3 años
    verdicts = set()
    for ds in range(PERIOD_SHIFT + 1):
        for de in range(PERIOD_SHIFT + 1):
            sub = slice(ds, n - de)
            if (n - de) - ds >= MIN_YEARS:
                verdicts.add(_quick_verdict(years[sub], annual[sub]))
    period_sensitive = len(verdicts) > 1

    warnings = []
    if r > 0.5:
        warnings.append(
            f"Autocorrelación alta entre años ({_fmt(r)}): incluso con la corrección, el riesgo de "
            "ver una tendencia que no existe es mayor de lo normal."
        )
    if not agree:
        warnings.append(
            "Las dos pruebas (Mann-Kendall y regresión) no coinciden: por eso el veredicto es prudente."
        )
    if period_sensitive:
        warnings.append(
            "El veredicto cambia si se mueve el año inicial o final hasta 3 años: depende del periodo elegido."
        )
    step = _step_change(years, annual, annual - (ts_icpt + ts_slope * years))
    if step:
        warnings.append(
            f"Parece un salto brusco hacia {step[0]} (Pettitt, {_p_text(step[1])}) más que un "
            "cambio gradual: puede deberse a un cambio en cómo se miden o producen los datos. "
            "Contrasta con otra fuente antes de concluir."
        )

    unit = variable.unit
    rate = f"{_signed(ts_slope * 10)} {unit} por década (IC 95 %: {_fmt(ts_lo * 10)} a {_fmt(ts_hi * 10)})"
    period = f"{int(years[0])}–{int(years[-1])}"
    if verdict == "significant":
        verb = "sube" if ts_slope > 0 else "baja"
        text = (
            f"{variable.label} {verb} {rate} en {period}. Cambio total estimado: {_signed(total)} {unit}"
            + (f" ({_signed(percent)} %)" if percent is not None else "")
            + f". Es muy improbable que sea azar (Mann-Kendall, {_p_text(mk_p)})."
        )
    elif verdict == "not_yet":
        text = (
            f"Tendencia todavía no significativa: {variable.label.lower()} "
            f"{'sube' if ts_slope > 0 else 'baja'} {rate} en {period}, pero con la variación "
            f"natural aún no se puede afirmar (Mann-Kendall, {_p_text(mk_p)})."
        )
        if needed:
            text += (
                f" Con este ritmo y este ruido harían falta unos {needed} años de datos"
                + (f" (hay {n})." if needed > n else f"; hay {n}, pero las pruebas no coinciden.")
            )
    else:
        text = (
            f"Sin tendencia clara: los datos de {period} son compatibles con que {variable.label.lower()} "
            f"no haya cambiado (pendiente {rate}; Mann-Kendall, {_p_text(mk_p)})."
        )
        if needed:
            text += f" Si existiera un cambio de ese tamaño, harían falta unos {needed} años para verlo."

    result = TrendResult(
        variable=variable.key,
        label=variable.label,
        unit=unit,
        first_year=int(years[0]),
        last_year=int(years[-1]),
        n_years=n,
        direction=direction,
        verdict=verdict,
        significant=significant,
        slope_per_decade=float(ts_slope * 10),
        ci_low_per_decade=float(ts_lo * 10),
        ci_high_per_decade=float(ts_hi * 10),
        total_change=float(total),
        percent_change=percent,
        ols_slope_per_decade=ols_slope * 10,
        ols_ci_low_per_decade=ols_lo * 10,
        ols_ci_high_per_decade=ols_hi * 10,
        ols_p=p_eff,
        n_effective=n_eff,
        autocorrelation=r,
        mk_tau=tau,
        mk_p=mk_p,
        methods_agree=agree,
        years_needed=needed,
        period_sensitive=period_sensitive,
        step_year=step[0] if step else None,
        warnings=warnings,
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

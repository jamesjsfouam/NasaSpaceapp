"""Previsión por extrapolación lineal con intervalo de predicción del 95 %.

Responde a "si el ritmo de cambio observado continuara, ¿qué valor tendríamos en el año X?".
No es un modelo del clima ni de la sociedad: supone que la tendencia lineal se mantiene. Por eso
se avisa cuando el horizonte es largo comparado con los años observados, y el intervalo crece
cuanto más lejos se mira.

Intervalo de predicción de OLS para un año futuro x0:
    ŷ ± t(0,975; n−2) · s · √(1 + 1/n + (x0 − x̄)² / Σ(x − x̄)²)
"""
from __future__ import annotations

import numpy as np
from pydantic import BaseModel
from scipy import stats

from app.services.trends import _fmt, _signed

MIN_POINTS = 5


class ForecastPoint(BaseModel):
    year: int
    value: float
    low: float
    high: float


class Forecast(BaseModel):
    method: str  # "lineal" | "onu"
    base_first_year: int
    base_last_year: int
    n_points: int
    to_year: int
    slope_per_year: float
    points: list[ForecastPoint]
    warnings: list[str]
    text: str


class ForecastError(ValueError):
    pass


def bounds_for(unit: str, ratio_scale: bool) -> tuple[float | None, float | None]:
    """Límites físicos de la variable, para que el intervalo no dé valores imposibles."""
    if unit.startswith("%"):
        return 0.0, 100.0
    if unit == "0–1":
        return 0.0, 1.0
    if ratio_scale:
        return 0.0, None
    return None, None


def _clip(x: float, lo: float | None, hi: float | None) -> float:
    if lo is not None:
        x = max(lo, x)
    if hi is not None:
        x = min(hi, x)
    return x


def linear_forecast(
    years: list[int] | np.ndarray,
    values: list[float] | np.ndarray,
    to_year: int,
    label: str,
    unit: str,
    bounds: tuple[float | None, float | None] = (None, None),
) -> Forecast:
    x = np.asarray(years, dtype=float)
    y = np.asarray(values, dtype=float)
    n = len(x)
    if n < MIN_POINTS:
        raise ForecastError(f"Hacen falta al menos {MIN_POINTS} años para una previsión y hay {n}.")
    last = int(x.max())
    if to_year <= last:
        raise ForecastError(f"El año de previsión debe ser posterior a {last}.")

    fit = stats.linregress(x, y)
    resid = y - (fit.intercept + fit.slope * x)
    s = float(np.sqrt(np.sum(resid**2) / (n - 2)))
    sxx = float(np.sum((x - x.mean()) ** 2))
    t = float(stats.t.ppf(0.975, n - 2))
    lo, hi = bounds

    points = []
    for year in range(last + 1, to_year + 1):
        pred = fit.intercept + fit.slope * year
        half = t * s * np.sqrt(1 + 1 / n + (year - x.mean()) ** 2 / sxx)
        points.append(ForecastPoint(
            year=year,
            value=_clip(float(pred), lo, hi),
            low=_clip(float(pred - half), lo, hi),
            high=_clip(float(pred + half), lo, hi),
        ))

    span = last - int(x.min()) + 1
    warnings = []
    horizon = to_year - last
    if horizon > span / 2:
        warnings.append(
            f"La previsión mira {horizon} años adelante con {span} años de datos: cuanto más lejos, "
            "menos fiable. Úsala como un escenario, no como una predicción."
        )
    if n >= 4 and np.std(resid[:-1]) > 0 and np.std(resid[1:]) > 0:
        r1 = float(np.corrcoef(resid[:-1], resid[1:])[0, 1])
        if r1 > 0.3:
            warnings.append(
                "Los años consecutivos se parecen entre sí: el intervalo real probablemente es más ancho."
            )
    if fit.pvalue >= 0.05:
        warnings.append(
            "La tendencia de base no es significativa: el valor central es poco más que el promedio "
            "actual y el intervalo es lo importante."
        )
    if any(p.value in (lo, hi) for p in points if lo is not None or hi is not None):
        warnings.append("La recta llega a un límite físico de la variable; en la realidad el cambio se frenaría antes.")

    end = points[-1]
    text = (
        f"Si el ritmo de {int(x.min())}–{last} continuara ({_signed(fit.slope * 10)} {unit} por década), "
        f"en {to_year} {label.lower()} rondaría {_fmt(end.value)} {unit} "
        f"(intervalo del 95 %: {_fmt(end.low)} a {_fmt(end.high)}). "
        "Es una extrapolación: supone que nada cambia en el ritmo actual."
    )
    return Forecast(
        method="lineal",
        base_first_year=int(x.min()),
        base_last_year=last,
        n_points=n,
        to_year=to_year,
        slope_per_year=float(fit.slope),
        points=points,
        warnings=warnings,
        text=text,
    )

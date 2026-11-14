"""Relación entre una variable de la Tierra y un indicador socioeconómico.

El error clásico: dos series que crecen con el tiempo (por ejemplo, la temperatura y el PIB)
salen muy correlacionadas aunque no tengan nada que ver. Por eso se calculan dos cosas:

1. Correlación "aparente": con los valores tal cual (incluye las tendencias).
2. Correlación "año a año": después de quitar la tendencia lineal de cada serie. Responde a
   la pregunta útil: ¿en los años en que la variable de la Tierra se sale de lo normal, el
   indicador también se sale? Esta es la que se usa para el veredicto.

Correlación no es causa, y se compara un punto del mapa con un país entero: se avisa siempre.
"""
from __future__ import annotations

import numpy as np
from pydantic import BaseModel
from scipy import stats

from app.services.trends import ALPHA, _fmt, _p_text

MIN_OVERLAP = 10


class RelationPoint(BaseModel):
    year: int
    earth: float
    indicator: float
    earth_detrended: float
    indicator_detrended: float


class Relation(BaseModel):
    n_years: int
    first_year: int
    last_year: int
    raw_r: float
    raw_p: float
    detrended_r: float
    detrended_p: float
    detrended_rho: float  # Spearman, más robusto a valores extremos
    detrended_rho_p: float
    strength: str  # débil | moderada | fuerte
    significant: bool
    trend_driven: bool  # la correlación aparente se debe sobre todo a las tendencias
    interpretation: str
    warnings: list[str]
    points: list[RelationPoint]


class InsufficientOverlap(ValueError):
    pass


def _detrend(x: np.ndarray, years: np.ndarray) -> np.ndarray:
    fit = stats.linregress(years, x)
    return x - (fit.intercept + fit.slope * years)


def _strength(r: float) -> str:
    a = abs(r)
    return "fuerte" if a >= 0.5 else "moderada" if a >= 0.3 else "débil"


def relate(
    earth_label: str,
    earth: dict[int, float],
    indicator_label: str,
    indicator: dict[int, float],
    place: str,
    country: str,
) -> Relation:
    common = sorted(set(earth) & set(indicator))
    if len(common) < MIN_OVERLAP:
        raise InsufficientOverlap(
            f"Solo hay {len(common)} años con datos de ambas series; se necesitan {MIN_OVERLAP}."
        )
    years = np.array(common, dtype=float)
    e = np.array([earth[y] for y in common])
    i = np.array([indicator[y] for y in common])
    if np.std(e) == 0 or np.std(i) == 0:
        raise InsufficientOverlap("Una de las series no varía; no se puede calcular la relación.")

    raw_r, raw_p = stats.pearsonr(e, i)
    ed, id_ = _detrend(e, years), _detrend(i, years)
    det_r, det_p = stats.pearsonr(ed, id_)
    rho, rho_p = stats.spearmanr(ed, id_)
    raw_r, raw_p, det_r, det_p = float(raw_r), float(raw_p), float(det_r), float(det_p)

    significant = det_p < ALPHA
    trend_driven = raw_p < ALPHA and (not significant or abs(raw_r) - abs(det_r) > 0.3)
    n = len(common)

    e_name, i_name = earth_label.lower(), indicator_label.lower()
    if significant:
        side = "por encima" if det_r > 0 else "por debajo"
        text = (
            f"Año a año, cuando {e_name} en {place} está por encima de su tendencia, "
            f"{i_name} en {country} tiende a estar {side} de la suya "
            f"(r = {_fmt(det_r)}, {_p_text(det_p)}, {n} años; relación {_strength(det_r)})."
        )
    else:
        text = (
            f"Año a año no se encuentra una relación clara entre {e_name} en {place} y "
            f"{i_name} en {country} (r = {_fmt(det_r)}, {_p_text(det_p)}, {n} años)."
        )
    if trend_driven:
        text += (
            f" Con los valores tal cual la correlación es r = {_fmt(raw_r)}, pero se debe sobre "
            "todo a que ambas series cambian con el tiempo, no a que una afecte a la otra."
        )
    text += " Una correlación muestra asociación; no demuestra que una cause la otra."

    warnings = [
        (
            f"Se compara un punto ({place}, celda de ~50 × 60 km) con un indicador de todo el país "
            f"({country}). Si la región no representa al país, la relación se diluye."
        )
    ]
    if n < 20:
        warnings.append("Pocos años en común: una relación real podría no alcanzar significancia.")
    if (rho_p < ALPHA) != significant:
        warnings.append(
            "Pearson y Spearman no coinciden: uno o dos años extremos pueden estar dominando el resultado."
        )

    return Relation(
        n_years=n,
        first_year=common[0],
        last_year=common[-1],
        raw_r=raw_r,
        raw_p=raw_p,
        detrended_r=det_r,
        detrended_p=det_p,
        detrended_rho=float(rho),
        detrended_rho_p=float(rho_p),
        strength=_strength(det_r),
        significant=significant,
        trend_driven=trend_driven,
        interpretation=text,
        warnings=warnings,
        points=[
            RelationPoint(
                year=y, earth=float(a), indicator=float(b),
                earth_detrended=float(c), indicator_detrended=float(d),
            )
            for y, a, b, c, d in zip(common, e, i, ed, id_)
        ],
    )

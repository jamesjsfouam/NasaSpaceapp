import numpy as np
import pytest

from app.catalog import VARIABLE_BY_KEY
from app.services import trends


def monthly_series(annual_slope: float, noise: float, years=range(1990, 2026), seed=0,
                   amplitude=5.0) -> dict[str, float]:
    """Serie mensual sintética: ciclo estacional + tendencia lineal conocida + ruido."""
    rng = np.random.default_rng(seed)
    out = {}
    for y in years:
        for m in range(1, 13):
            seasonal = amplitude * np.sin(2 * np.pi * (m - 1) / 12)
            out[f"{y}{m:02d}"] = 20 + seasonal + annual_slope * (y - 1990) + rng.normal(0, noise)
    return out


T2M = VARIABLE_BY_KEY["T2M"]


def test_recovers_known_trend_and_is_significant():
    r = trends.analyze(T2M, monthly_series(0.04, 0.5), 1990, 2025)
    assert r.direction == "up" and r.significant and r.significance == "very"
    assert r.slope_per_decade == pytest.approx(0.4, abs=0.08)
    assert r.ci_low_per_decade < 0.4 < r.ci_high_per_decade
    assert r.total_change == pytest.approx(0.04 * 35, abs=0.3)
    assert r.methods_agree


def test_decreasing_trend_direction():
    r = trends.analyze(T2M, monthly_series(-0.05, 0.4), 1990, 2025)
    assert r.direction == "down" and r.significant and r.slope_per_decade < 0


def test_pure_noise_is_not_significant_for_most_seeds():
    flags = [
        trends.analyze(T2M, monthly_series(0.0, 0.8, seed=s), 1990, 2025).significant
        for s in range(40)
    ]
    # con alfa = 0.05 se esperan ~2 falsos positivos de 40; 8 sería señal de un error
    assert sum(flags) <= 7


def test_seasonal_cycle_does_not_create_a_trend():
    # Muestra solo de enero a junio de un año y julio-dic de otros: los años incompletos se descartan
    series = monthly_series(0.0, 0.01, amplitude=15)
    for y in range(1990, 2000):
        del series[f"{y}12"]
    r = trends.analyze(T2M, series, 1990, 2025)
    assert r.n_years == 26 and abs(r.slope_per_decade) < 0.05


def test_incomplete_years_are_dropped_and_min_years_enforced():
    with pytest.raises(trends.InsufficientData):
        trends.analyze(T2M, monthly_series(0.05, 0.3), 1990, 1998)


def test_percent_change_only_for_ratio_scale_variables():
    precip = VARIABLE_BY_KEY["PRECTOTCORR"]
    assert trends.analyze(precip, monthly_series(0.02, 0.3), 1990, 2025).percent_change is not None
    assert trends.analyze(T2M, monthly_series(0.02, 0.3), 1990, 2025).percent_change is None


def test_series_for_charts_is_consistent():
    r = trends.analyze(T2M, monthly_series(0.03, 0.4), 1990, 2025)
    assert len(r.series.annual) == 36 and len(r.series.monthly) == 36 * 12
    assert len(r.series.trend_line) == 2
    assert abs(np.mean([p.anomaly for p in r.series.monthly])) < 1e-9


def test_scan_sorts_by_evidence_and_adjusts_p():
    data = {
        "T2M": monthly_series(0.05, 0.3),
        "WS2M": monthly_series(0.0, 0.8, seed=3),
        "PS": monthly_series(0.0, 0.8, seed=4),
    }
    results = trends.scan(data, 1990, 2025)
    assert results[0].variable == "T2M"
    assert [r.mk_p for r in results] == sorted(r.mk_p for r in results)
    assert all(r.p_adjusted == min(1.0, r.mk_p * 3) for r in results)


def test_autocorrelation_warning():
    rng = np.random.default_rng(1)
    level = np.cumsum(rng.normal(0, 0.5, 36))  # paseo aleatorio: años muy parecidos entre sí
    series = {f"{1990 + i}{m:02d}": float(level[i]) for i in range(36) for m in range(1, 13)}
    r = trends.analyze(T2M, series, 1990, 2025)
    assert any("autocorrelación" in w for w in r.warnings)


def test_interpretation_uses_spanish_number_format():
    r = trends.analyze(T2M, monthly_series(0.04, 0.5), 1990, 2025)
    assert "p < 0,0001" in r.interpretation or "p = 0," in r.interpretation
    assert "0." not in r.interpretation


def test_abrupt_step_is_flagged_but_gradual_trend_is_not():
    step = monthly_series(0.0, 0.3)
    for k in step:
        if int(k[:4]) >= 2005:
            step[k] += 2.5  # escalón de 2.5 unidades en 2005
    flagged = trends.analyze(T2M, step, 1990, 2025)
    assert flagged.step_year == 2005 and any("salto brusco" in w for w in flagged.warnings)
    gradual = trends.analyze(T2M, monthly_series(0.06, 0.3), 1990, 2025)
    assert gradual.step_year is None

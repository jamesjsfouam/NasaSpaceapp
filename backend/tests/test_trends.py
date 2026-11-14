import numpy as np
import pytest

from app.catalog import VARIABLE_BY_KEY
from app.services import trends

T2M = VARIABLE_BY_KEY["T2M"]


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


def ar1(n: int, phi: float, rng) -> np.ndarray:
    e = rng.normal(0, 1, n + 50)
    x = np.zeros(n + 50)
    for t in range(1, n + 50):
        x[t] = phi * x[t - 1] + e[t]
    return x[50:]


def test_recovers_known_trend_and_is_significant():
    r = trends.analyze(T2M, monthly_series(0.04, 0.5), 1990, 2025)
    assert r.direction == "up" and r.significant and r.verdict == "significant"
    assert r.slope_per_decade == pytest.approx(0.4, abs=0.08)
    assert r.ci_low_per_decade < 0.4 < r.ci_high_per_decade
    assert r.total_change == pytest.approx(0.04 * 35, abs=0.3)
    assert r.methods_agree and r.years_needed is None
    assert "muy improbable que sea azar" in r.interpretation


def test_decreasing_trend_direction():
    r = trends.analyze(T2M, monthly_series(-0.05, 0.4), 1990, 2025)
    assert r.direction == "down" and r.significant and r.slope_per_decade < 0


def test_false_positive_rate_stays_near_5_percent_with_autocorrelation():
    """Lo que pide el plan del PDF: series SIN tendencia con memoria (φ = 0,4)."""
    rng = np.random.default_rng(7)
    years = np.arange(1990, 2020)
    flags = [
        trends.analyze_annual(T2M, years, ar1(30, 0.4, rng), include_series=False).significant
        for _ in range(300)
    ]
    rate = sum(flags) / len(flags)
    assert rate <= 0.09  # la regresión corriente da ~19 % en este caso


def test_naive_regression_would_have_failed_the_same_check():
    """Control: confirma que el caso de arriba es exigente (la regresión ingenua falla)."""
    from scipy import stats
    rng = np.random.default_rng(7)
    years = np.arange(30)
    naive = sum(stats.linregress(years, ar1(30, 0.4, rng)).pvalue < 0.05 for _ in range(300)) / 300
    assert naive > 0.12


def test_still_detects_real_trends():
    rng = np.random.default_rng(11)
    years = np.arange(1990, 2030)
    hits = [
        trends.analyze_annual(T2M, years, ar1(40, 0.2, rng) + 0.08 * np.arange(40), False).significant
        for _ in range(200)
    ]
    assert sum(hits) / len(hits) > 0.85


def test_not_yet_verdict_gives_years_needed():
    rng = np.random.default_rng(5)
    years = np.arange(2005, 2025)
    y = 0.03 * np.arange(20) + rng.normal(0, 0.6, 20)
    r = trends.analyze_annual(T2M, years, y)
    assert r.verdict in ("not_yet", "no_trend") and not r.significant
    assert r.years_needed is not None and r.years_needed > 20
    assert f"{r.years_needed} años" in r.interpretation


def test_years_needed_formula():
    assert trends.years_needed(1.0, 0.1, 0.0) == 24  # validado por simulación: ~90 % de detección
    assert trends.years_needed(1.0, 0.1, 0.4) > 24  # la memoria exige más años
    assert trends.years_needed(1.0, 0.0, 0.0) is None


def test_seasonal_cycle_does_not_create_a_trend():
    series = monthly_series(0.0, 0.01, amplitude=15)
    r = trends.analyze(T2M, series, 1990, 2025)
    assert r.n_years == 36 and abs(r.slope_per_decade) < 0.05 and not r.significant


def test_years_with_at_least_10_months_count_and_missing_months_do_not_bias():
    series = monthly_series(0.0, 0.01, amplitude=15)
    for y in range(1990, 2000):  # faltan junio y julio (meses "calientes") en la primera década
        del series[f"{y}06"]
        del series[f"{y}07"]
    for y in range(2000, 2005):  # años con solo 9 meses: se descartan
        for m in ("01", "02", "03"):
            del series[f"{y}{m}"]
    r = trends.analyze(T2M, series, 1990, 2025)
    assert r.n_years == 31
    assert abs(r.slope_per_decade) < 0.05  # sin anomalías, faltar meses de verano crearía tendencia


def test_insufficient_data_below_15_years():
    with pytest.raises(trends.InsufficientData, match="Datos insuficientes"):
        trends.analyze(T2M, monthly_series(0.05, 0.3), 1990, 2003)


def test_percent_change_only_for_ratio_scale_variables():
    precip = VARIABLE_BY_KEY["PRECTOTCORR"]
    assert trends.analyze(precip, monthly_series(0.02, 0.3), 1990, 2025).percent_change is not None
    assert trends.analyze(T2M, monthly_series(0.02, 0.3), 1990, 2025).percent_change is None


def test_series_for_charts_is_consistent():
    r = trends.analyze(T2M, monthly_series(0.03, 0.4), 1990, 2025)
    assert len(r.series.annual) == 36 and len(r.series.monthly) == 36 * 12
    assert len(r.series.trend_line) == 2
    assert abs(np.mean([p.anomaly for p in r.series.monthly])) < 1e-9


def test_period_sensitivity_flag():
    years = np.arange(1990, 2026)
    stable = trends.analyze_annual(T2M, years, 0.1 * np.arange(36) + np.sin(np.arange(36)))
    assert not stable.period_sensitive
    rng = np.random.default_rng(4)
    flags = [
        trends.analyze_annual(T2M, years, 0.012 * np.arange(36) + rng.normal(0, 0.25, 36), False).period_sensitive
        for _ in range(40)
    ]
    assert any(flags)  # tendencias en el límite dependen del periodo elegido


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


def test_high_autocorrelation_warning():
    rng = np.random.default_rng(1)
    level = np.cumsum(rng.normal(0, 0.5, 36))  # paseo aleatorio: años muy parecidos entre sí
    series = {f"{1990 + i}{m:02d}": float(level[i]) for i in range(36) for m in range(1, 13)}
    r = trends.analyze(T2M, series, 1990, 2025)
    assert any("Autocorrelación alta" in w for w in r.warnings)


def test_abrupt_step_is_flagged_but_gradual_trend_is_not():
    step = monthly_series(0.0, 0.3)
    for k in step:
        if int(k[:4]) >= 2005:
            step[k] += 2.5  # escalón de 2,5 unidades en 2005
    flagged = trends.analyze(T2M, step, 1990, 2025)
    assert flagged.step_year == 2005 and any("salto brusco" in w for w in flagged.warnings)
    gradual = trends.analyze(T2M, monthly_series(0.06, 0.3), 1990, 2025)
    assert gradual.step_year is None


def test_interpretation_uses_spanish_number_format():
    r = trends.analyze(T2M, monthly_series(0.04, 0.5), 1990, 2025)
    assert "p < 0,0001" in r.interpretation or "p = 0," in r.interpretation
    assert "0." not in r.interpretation

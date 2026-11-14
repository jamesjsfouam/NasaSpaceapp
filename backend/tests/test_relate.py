import numpy as np
import pytest

from app.services import relate

YEARS = list(range(1990, 2024))


def series(values) -> dict[int, float]:
    return {y: float(v) for y, v in zip(YEARS, values)}


def test_shared_year_to_year_signal_is_detected():
    rng = np.random.default_rng(0)
    shock = rng.normal(0, 1, len(YEARS))  # p. ej. años secos y húmedos
    earth = series(0.02 * np.arange(len(YEARS)) + shock)
    crop = series(2000 + 30 * np.arange(len(YEARS)) + 150 * shock + rng.normal(0, 40, len(YEARS)))
    r = relate.relate("Humedad del suelo", earth, "Rendimiento", crop, "Somoto", "Nicaragua")
    assert r.significant and r.detrended_r > 0.8 and r.strength == "fuerte"
    assert "por encima" in r.interpretation and not r.trend_driven


def _unrelated_trends(seed: int):
    rng = np.random.default_rng(seed)
    t = np.arange(len(YEARS))
    temp = series(26 + 0.03 * t + rng.normal(0, 0.15, len(YEARS)))
    gdp = series(1500 + 40 * t + rng.normal(0, 30, len(YEARS)))
    return relate.relate("Temperatura", temp, "PIB por persona", gdp, "Managua", "Nicaragua")


def test_two_unrelated_trends_are_flagged_as_trend_driven():
    r = _unrelated_trends(seed=3)
    assert r.raw_p < 0.05 and r.raw_r > 0.7  # parece una relación fuerte...
    assert r.trend_driven and not r.significant  # ...pero no lo es año a año
    assert "cambian con el tiempo" in r.interpretation


def test_year_to_year_false_positive_rate_is_near_alpha():
    results = [_unrelated_trends(seed=s) for s in range(200)]
    false_positives = sum(r.significant for r in results)
    assert false_positives <= 20  # alfa = 5 % → se esperan ~10 de 200
    assert all(r.trend_driven for r in results)  # la correlación aparente siempre se explica


def test_negative_relation_wording():
    rng = np.random.default_rng(2)
    shock = rng.normal(0, 1, len(YEARS))
    r = relate.relate("Temperatura máxima", series(shock), "Producción", series(-shock + rng.normal(0, 0.2, len(YEARS))),
                      "Managua", "Nicaragua")
    assert r.detrended_r < -0.8 and "por debajo" in r.interpretation


def test_only_common_years_are_used_and_minimum_enforced():
    a = {y: float(y % 7) for y in range(1990, 2024)}
    b = {y: float(y % 5) for y in range(2015, 2024)}
    with pytest.raises(relate.InsufficientOverlap):
        relate.relate("A", a, "B", b, "X", "Y")
    b = {y: float((y * 3) % 11) for y in range(2005, 2030)}
    r = relate.relate("A", a, "B", b, "X", "Y")
    assert (r.first_year, r.last_year, r.n_years) == (2005, 2023, 19)
    assert any("Pocos años" in w for w in r.warnings)


def test_constant_series_is_rejected():
    with pytest.raises(relate.InsufficientOverlap):
        relate.relate("A", series(np.ones(len(YEARS))), "B", series(np.arange(len(YEARS))), "X", "Y")

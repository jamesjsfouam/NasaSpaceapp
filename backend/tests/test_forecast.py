import numpy as np
import pytest

from app.services import forecast

YEARS = np.arange(1990, 2026)


def test_extrapolates_a_clean_line():
    f = forecast.linear_forecast(YEARS, 10 + 0.5 * (YEARS - 1990), 2035, "Algo", "u")
    assert f.points[-1].year == 2035 and f.points[0].year == 2026
    assert f.points[-1].value == pytest.approx(10 + 0.5 * 45, abs=1e-6)
    assert f.slope_per_year == pytest.approx(0.5)


def test_prediction_interval_covers_about_95_percent():
    """Simula muchas series y mira si el valor real del año futuro cae dentro del intervalo."""
    rng = np.random.default_rng(0)
    hits = 0
    trials = 400
    for _ in range(trials):
        y = 5 + 0.1 * (YEARS - 1990) + rng.normal(0, 1, len(YEARS))
        f = forecast.linear_forecast(YEARS, y, 2030, "x", "u")
        truth = 5 + 0.1 * 40 + rng.normal(0, 1)
        hits += f.points[-1].low <= truth <= f.points[-1].high
    assert 0.91 <= hits / trials <= 0.99


def test_interval_widens_with_horizon():
    rng = np.random.default_rng(1)
    f = forecast.linear_forecast(YEARS, rng.normal(0, 1, len(YEARS)), 2060, "x", "u")
    widths = [p.high - p.low for p in f.points]
    assert widths == sorted(widths)
    assert any("escenario" in w for w in f.warnings)  # 35 años con 36 de datos
    assert any("no es significativa" in w for w in f.warnings)


def test_bounds_keep_values_physical():
    y = 0.9 + 0.02 * (YEARS - 1990)  # humedad del suelo que "superaría" 1
    f = forecast.linear_forecast(YEARS, np.minimum(y, 0.99), 2060, "Humedad", "0–1", (0.0, 1.0))
    assert all(0 <= p.low <= p.value <= p.high <= 1 for p in f.points)
    assert any("límite físico" in w for w in f.warnings)


def test_bounds_for_units():
    assert forecast.bounds_for("% de la población", True) == (0.0, 100.0)
    assert forecast.bounds_for("0–1", True) == (0.0, 1.0)
    assert forecast.bounds_for("mm/día", True) == (0.0, None)
    assert forecast.bounds_for("°C", False) == (None, None)


@pytest.mark.parametrize("years,to_year", [([2020, 2021, 2022], 2030), (list(range(2000, 2010)), 2005)])
def test_invalid_inputs(years, to_year):
    with pytest.raises(forecast.ForecastError):
        forecast.linear_forecast(years, list(range(len(years))), to_year, "x", "u")

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import power, worldbank

client = TestClient(app)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Las pruebas no deben depender de la red: fuerza el uso de las muestras locales."""

    async def boom(*_a, **_k):
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(power, "_fetch_live", boom)
    monkeypatch.setattr(worldbank, "_fetch_live", boom)
    power._cache.clear()
    worldbank._cache.clear()


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["integrations"]["nasa_power"] is True


def test_catalog_has_variables_regions_and_demos():
    c = client.get("/api/catalog").json()
    assert len(c["variables"]) >= 10 and len(c["regions"]) >= 5 and c["demos"]
    assert {v["theme"] for v in c["variables"]} <= set(c["themes"])
    region_ids = {r["id"] for r in c["regions"]}
    assert all(d["region"] in region_ids for d in c["demos"])


def test_trend_for_sample_region_uses_local_sample():
    r = client.get("/api/trend", params={"variable": "T2M", "lat": 12.13, "lon": -86.25})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "muestra-local"
    res = body["result"]
    assert res["n_years"] >= 30 and res["series"]["annual"] and res["interpretation"]


def test_trend_outside_samples_without_network_is_502():
    r = client.get("/api/trend", params={"variable": "T2M", "lat": 40.0, "lon": -3.0})
    assert r.status_code == 502


def test_scan_ranks_all_variables():
    r = client.get("/api/scan", params={"lat": 78.22, "lon": 15.65})
    results = r.json()["results"]
    assert len(results) >= 10
    assert [x["mk_p"] for x in results] == sorted(x["mk_p"] for x in results)
    assert all(x["series"] is None for x in results)


def test_compare_covers_every_region():
    r = client.get("/api/compare", params={"variable": "T2M"})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == len(client.get("/api/catalog").json()["regions"])
    assert all(row["result"] is not None for row in rows)


@pytest.mark.parametrize(
    "params",
    [
        {"variable": "NOPE", "lat": 12.13, "lon": -86.25},
        {"variable": "T2M", "lat": 120, "lon": -86.25},
        {"variable": "T2M", "lat": 12.13, "lon": -86.25, "start": 2020, "end": 2024},
        {"variable": "T2M", "lat": 12.13, "lon": -86.25, "start": 1900},
    ],
)
def test_invalid_requests_are_rejected(params):
    assert client.get("/api/trend", params=params).status_code in (404, 422)


def test_weather_without_credentials_returns_503(monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "meteomatics_username", "")
    r = client.get("/api/weather", params={"lat": 12.13, "lon": -86.25})
    assert r.status_code == 503


def test_catalog_lists_indicators_and_countries():
    c = client.get("/api/catalog").json()
    assert c["indicators"] and "NIC" in c["countries"]
    variable_keys = {v["key"] for v in c["variables"]}
    assert all(i["suggested_variable"] in variable_keys for i in c["indicators"])
    assert all(r["country"] in c["countries"] for r in c["regions"] if r["country"])


def test_relate_with_synthetic_indicator(monkeypatch):
    async def fake(country, indicator):
        return {y: 1000.0 + (y % 4) * 50 for y in range(1990, 2024)}, "banco-mundial"

    monkeypatch.setattr(worldbank, "get_indicator", fake)
    r = client.get("/api/relate", params={
        "variable": "PRECTOTCORR", "indicator": "AG.YLD.CREL.KG", "country": "NIC",
        "lat": 13.48, "lon": -86.58, "place": "Somoto",
    })
    assert r.status_code == 200
    body = r.json()
    rel = body["relation"]
    assert rel["n_years"] >= 30 and len(rel["points"]) == rel["n_years"]
    assert "Somoto" in rel["interpretation"] and "Nicaragua" in rel["interpretation"]
    assert body["indicator_trend"]["variable"] == "AG.YLD.CREL.KG"


@pytest.mark.skipif(
    not (power.SAMPLES_DIR / "worldbank_NIC.json").exists(),
    reason="falta la muestra del Banco Mundial (make samples)",
)
def test_relate_uses_world_bank_sample_offline():
    r = client.get("/api/relate", params={
        "variable": "GWETROOT", "indicator": "AG.YLD.CREL.KG", "country": "NIC",
        "lat": 13.48, "lon": -86.58,
    })
    assert r.status_code == 200 and r.json()["indicator_source"] == "muestra-local"


@pytest.mark.parametrize("params,code", [
    ({"variable": "T2M", "indicator": "NOPE", "country": "NIC"}, 404),
    ({"variable": "T2M", "indicator": "SP.POP.TOTL", "country": "XXX"}, 404),
])
def test_relate_rejects_unknown_inputs(params, code):
    params |= {"lat": 12.13, "lon": -86.25}
    assert client.get("/api/relate", params=params).status_code == code


# --- cualquier lugar, recomendador, previsiones, demografía y satélite (sin red) -------------

def test_locate_any_coordinate_offline():
    r = client.get("/api/places/locate", params={"lat": 48.85, "lon": 2.35}).json()
    assert r["iso3"] == "FRA" and r["country"]
    ocean = client.get("/api/places/locate", params={"lat": 0.0, "lon": -30.0}).json()
    assert ocean["iso3"] is None


def test_recommend_returns_at_most_three_known_variables():
    r = client.get("/api/recommend", params={"concern": "heat", "place_type": "city"}).json()
    assert 1 <= len(r["variables"]) <= 3 and r["variables"][0]["key"] == "T2M_MIN"
    assert all(v["reliability"] for v in r["variables"])
    assert client.get("/api/recommend", params={"concern": "nope"}).status_code == 404


def test_catalog_covers_every_country_and_recommender_options():
    c = client.get("/api/catalog").json()
    assert len(c["countries"]) > 200 and c["concerns"] and c["place_types"] and c["demography"]


def test_earth_forecast_from_sample():
    r = client.get("/api/forecast", params={"variable": "T2M", "lat": 78.22, "lon": 15.65, "to_year": 2040})
    assert r.status_code == 200
    fc = r.json()["forecast"]
    assert fc["points"][-1]["year"] == 2040 and fc["points"][-1]["low"] < fc["points"][-1]["high"]


def test_demography_any_country(monkeypatch):
    from app.services import demography

    async def fake(iso3, key):
        est = {y: 1e6 * (1 + 0.02 * (y - 1950)) for y in range(1950, 2024)}
        proj = {y: 1e6 * (1 + 0.015 * (y - 1950)) for y in range(2024, 2101)}
        return est, proj, "our-world-in-data"

    monkeypatch.setattr(demography, "get_series", fake)
    r = client.get("/api/demography", params={"country": "JPN", "indicator": "population", "to_year": 2050})
    assert r.status_code == 200
    body = r.json()
    assert body["country_label"] and body["trend"]["verdict"] == "significant"
    assert body["forecast"]["points"][-1]["year"] == 2050 and body["un_value_at_horizon"]
    assert client.get("/api/demography", params={"country": "XXX"}).status_code == 404


def test_satellite_endpoints_with_mocked_service(monkeypatch):
    from app.services import satellite

    async def fake_timeline(lat, lon, years, half_km):
        return [satellite.SatelliteImage(year=y, date=f"{y}-02-01", collection="sentinel-2-l2a",
                                         platform="Sentinel-2A", cloud_cover=1.0, url="https://x/y.png")
                for y in years]

    async def fake_lc(lat, lon, half_km):
        years = [satellite.LandCoverYear(year=y, shares={"Zona construida": 50 + (y - 2017)}, built_km2=1.0)
                 for y in range(2017, 2024)]
        return satellite.LandCover(area_km2=256, years=years, suggested_place_type="city")

    monkeypatch.setattr(satellite, "timeline", fake_timeline)
    monkeypatch.setattr(satellite, "land_cover", fake_lc)
    imgs = client.get("/api/satellite/timeline", params={"lat": 6.5, "lon": 3.4, "years": "2000,2020"}).json()
    assert [i["year"] for i in imgs] == [2000, 2020]
    assert client.get("/api/satellite/timeline", params={"lat": 6.5, "lon": 3.4, "years": "1950"}).status_code == 422
    lc = client.get("/api/satellite/landcover", params={"lat": 6.5, "lon": 3.4, "to_year": 2030}).json()
    assert lc["land_cover"]["suggested_place_type"] == "city"
    assert lc["built_forecast"]["points"][-1]["value"] == pytest.approx(63, abs=0.01)


def test_globe_endpoint_serves_grid_or_404(monkeypatch, tmp_path):
    from app import main

    monkeypatch.setattr(main, "GLOBE_FILE", tmp_path / "nope.json")
    assert client.get("/api/globe").status_code == 404
    f = tmp_path / "globe.json"
    f.write_text('{"cells": [], "variables": {}}')
    monkeypatch.setattr(main, "GLOBE_FILE", f)
    r = client.get("/api/globe")
    assert r.status_code == 200 and r.json()["cells"] == []

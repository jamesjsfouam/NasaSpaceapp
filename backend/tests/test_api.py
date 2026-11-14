import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import power

client = TestClient(app)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Las pruebas no deben depender de la red: fuerza el uso de las muestras locales."""

    async def boom(*_a, **_k):
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(power, "_fetch_live", boom)
    power._cache.clear()


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

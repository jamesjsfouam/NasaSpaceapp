"""Exporta una instantánea estática de la API para GitHub Pages.

Genera archivos JSON en `frontend/public/static-api/` usando únicamente datos
locales del repositorio (sin depender de red externa) para que el frontend de
DATEX funcione completo al desplegarse como sitio estático en GitHub Pages.

Uso:
    cd backend
    uv run python scripts/export_static_api.py
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Evitar esperas de red en sandbox durante la exportación offline.
async def _offline_guard(*args, **kwargs):  # type: ignore[no-untyped-def]
    raise httpx.ConnectError("Modo de exportación offline")


httpx.AsyncClient.get = _offline_guard  # type: ignore[method-assign]
httpx.AsyncClient.post = _offline_guard  # type: ignore[method-assign]

from app.catalog import INDICATORS, REGIONS, VARIABLES
from app.main import app
from app.services import demography, power

OUT_DIR = ROOT / "frontend" / "public" / "static-api"
GLOBE_SRC = BACKEND_DIR / "app" / "data" / "globe.json"

START_YEAR = 1990
FORECAST_YEARS = [2030, 2040, 2050, 2075, 2100]
DEMO_COUNTRIES = sorted({r.country for r in REGIONS if r.country})
# Variables priorizadas para precomputar tendencias y pronósticos detallados.
CORE_VARS = [
    "T2M",
    "T2M_MIN",
    "T2M_MAX",
    "PRECTOTCORR",
    "GWETROOT",
    "RH2M",
    "WS2M",
    "ALLSKY_SFC_SW_DWN",
]


def _coord_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2):.2f},{round(lon, 2):.2f}"


def _dump(path: Path, payload: object) -> int:
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Iniciando TestClient...", flush=True)
    client = TestClient(app)

    # 1. Catálogo completo
    print("1/6 Exportando catálogo y globo...", flush=True)
    cat_res = client.get("/api/catalog")
    cat_res.raise_for_status()
    catalog = cat_res.json()
    cat_bytes = _dump(OUT_DIR / "catalog.json", catalog)

    # 2. Malla global del planeta 3D
    if not GLOBE_SRC.exists():
        raise FileNotFoundError(f"No se encontró {GLOBE_SRC}")
    shutil.copy2(GLOBE_SRC, OUT_DIR / "globe.json")
    globe_bytes = (OUT_DIR / "globe.json").stat().st_size

    # 3. Paquete de respuestas precalculadas
    bundle: dict[str, object] = {
        "generated_start": START_YEAR,
        "recommend": {},
        "compare": {},
        "scan": {},
        "trend": {},
        "forecast": {},
        "locate": {},
        "demography": {},
        "relate": {},
    }

    # Recomendaciones (concern x place_type)
    rec_map: dict[str, object] = {}
    concerns = list(catalog["concerns"].keys())
    place_types = list(catalog["place_types"].keys())
    for c in concerns:
        r0 = client.get("/api/recommend", params={"concern": c})
        if r0.status_code == 200:
            rec_map[f"{c}|"] = r0.json()
        for pt in place_types:
            r1 = client.get("/api/recommend", params={"concern": c, "place_type": pt})
            if r1.status_code == 200:
                rec_map[f"{c}|{pt}"] = r1.json()
    bundle["recommend"] = rec_map

    # Compare: todas las variables del catálogo en start=1990
    print("2/6 Exportando compare...", flush=True)
    compare_map: dict[str, object] = {}
    for var in VARIABLES:
        res = client.get("/api/compare", params={"variable": var.key, "start": START_YEAR})
        if res.status_code == 200:
            compare_map[var.key] = res.json()
    bundle["compare"] = compare_map

    # Locate + Scan por cada región de muestra
    print("3/6 Exportando locate + scan...", flush=True)
    scan_map: dict[str, object] = {}
    locate_map: dict[str, object] = {}
    seen_coords: set[tuple[float, float]] = set()
    for r in REGIONS:
        coord = (r.lat, r.lon)
        if coord in seen_coords:
            continue
        seen_coords.add(coord)
        ck = _coord_key(r.lat, r.lon)

        loc_res = client.get("/api/places/locate", params={"lat": r.lat, "lon": r.lon})
        if loc_res.status_code == 200:
            locate_map[ck] = loc_res.json()

        scan_res = client.get("/api/scan", params={"lat": r.lat, "lon": r.lon, "start": START_YEAR})
        if scan_res.status_code == 200:
            scan_map[f"{ck}|{START_YEAR}"] = scan_res.json()

    bundle["locate"] = locate_map
    bundle["scan"] = scan_map

    # Trend para cada región de muestra x todas las variables del catálogo
    print("4/6 Exportando trend + forecast...", flush=True)
    trend_map: dict[str, object] = {}
    all_var_keys = [v.key for v in VARIABLES]
    for r in REGIONS:
        ck = _coord_key(r.lat, r.lon)
        for vkey in all_var_keys:
            res = client.get(
                "/api/trend",
                params={"variable": vkey, "lat": r.lat, "lon": r.lon, "start": START_YEAR},
            )
            if res.status_code == 200:
                trend_map[f"{vkey}|{ck}|{START_YEAR}"] = res.json()
    bundle["trend"] = trend_map

    # Forecast compacto (solo bloque `forecast`; `trend` ya está en trend_map)
    forecast_map: dict[str, object] = {}
    for r in REGIONS:
        ck = _coord_key(r.lat, r.lon)
        for vkey in CORE_VARS:
            for year in FORECAST_YEARS:
                res = client.get(
                    "/api/forecast",
                    params={
                        "variable": vkey,
                        "lat": r.lat,
                        "lon": r.lon,
                        "start": START_YEAR,
                        "to_year": year,
                    },
                )
                if res.status_code == 200:
                    forecast_map[f"{vkey}|{ck}|{START_YEAR}|{year}"] = res.json()["forecast"]
    bundle["forecast"] = forecast_map

    # Demografía ONU para los 4 países con muestra local
    print("5/6 Exportando demografía...", flush=True)
    demo_map: dict[str, object] = {}
    for iso3 in DEMO_COUNTRIES:
        sample_path = power.SAMPLES_DIR / f"demography_{iso3}.json"
        if not sample_path.exists():
            continue
        for ind in demography.DEMOGRAPHY:
            for year in (2030, 2050, 2100):
                res = client.get(
                    "/api/demography",
                    params={"country": iso3, "indicator": ind.key, "start": START_YEAR, "to_year": year},
                )
                if res.status_code == 200:
                    demo_map[f"{iso3}|{ind.key}|{START_YEAR}|{year}"] = res.json()
    bundle["demography"] = demo_map

    # Cruce clima + Banco Mundial únicamente para indicadores presentes en cada muestra
    print("6/6 Exportando relate...", flush=True)
    relate_map: dict[str, object] = {}
    for r in REGIONS:
        if not r.country:
            continue
        wb_path = power.SAMPLES_DIR / f"worldbank_{r.country}.json"
        if not wb_path.exists():
            continue
        wb_data = json.loads(wb_path.read_text(encoding="utf-8"))
        available_inds = set(wb_data.get("indicators", {}).keys())
        ck = _coord_key(r.lat, r.lon)
        for ind in INDICATORS:
            if ind.key not in available_inds:
                continue
            target_vars = sorted({ind.suggested_variable, "T2M", "PRECTOTCORR", "GWETROOT", "T2M_MAX"})
            for vkey in target_vars:
                res = client.get(
                    "/api/relate",
                    params={
                        "variable": vkey,
                        "indicator": ind.key,
                        "country": r.country,
                        "lat": r.lat,
                        "lon": r.lon,
                        "start": START_YEAR,
                        "place": r.label,
                    },
                )
                if res.status_code == 200:
                    relate_map[f"{vkey}|{ind.key}|{r.country}|{ck}|{START_YEAR}"] = res.json()
    bundle["relate"] = relate_map

    bundle_bytes = _dump(OUT_DIR / "bundle.json", bundle)
    print(
        f"Static API exportada en {OUT_DIR}:\n"
        f"  catalog.json: {cat_bytes // 1024} KB\n"
        f"  globe.json:   {globe_bytes // 1024} KB\n"
        f"  bundle.json:  {bundle_bytes // 1024} KB "
        f"(compare={len(compare_map)}, scan={len(scan_map)}, trend={len(trend_map)}, "
        f"forecast={len(forecast_map)}, demography={len(demo_map)}, relate={len(relate_map)})"
    )


if __name__ == "__main__":
    main()

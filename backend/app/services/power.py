"""Cliente de NASA POWER (datos mensuales por punto). No requiere clave.

Una sola consulta trae todas las variables del catálogo, así que "escanear" una región cuesta
lo mismo que analizar una variable. Si el servicio no responde, se usan las muestras
guardadas en app/data/samples (solo para las regiones de ejemplo).
"""
from __future__ import annotations

import json
import time
from datetime import date
from pathlib import Path

import httpx

from app.catalog import REGIONS, VARIABLES

POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
FIRST_YEAR = 1981
SAMPLES_DIR = Path(__file__).resolve().parents[1] / "data" / "samples"
CACHE_TTL_S = 6 * 3600
MISSING = -999.0

_cache: dict[tuple[float, float], tuple[float, dict]] = {}


def last_full_year() -> int:
    return date.today().year - 1


class PowerUnavailable(RuntimeError):
    pass


def _clean(parameter_block: dict[str, dict[str, float]]) -> dict[str, dict[str, float]]:
    """Descarta los valores faltantes (-999) y los promedios anuales (mes 13)."""
    return {
        name: {k: v for k, v in series.items() if v != MISSING and not k.endswith("13")}
        for name, series in parameter_block.items()
    }


async def _fetch_live(lat: float, lon: float) -> dict[str, dict[str, float]]:
    params = {
        "parameters": ",".join(v.key for v in VARIABLES),
        "community": "AG",
        "latitude": lat,
        "longitude": lon,
        "start": FIRST_YEAR,
        "end": last_full_year(),
        "format": "JSON",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0)) as client:
        r = await client.get(POWER_URL, params=params)
        r.raise_for_status()
        return _clean(r.json()["properties"]["parameter"])


def _sample_for(lat: float, lon: float) -> dict[str, dict[str, float]] | None:
    for region in REGIONS:
        if abs(region.lat - lat) < 0.01 and abs(region.lon - lon) < 0.01:
            path = SAMPLES_DIR / f"{region.id}.json"
            if path.exists():
                return _clean(json.loads(path.read_text())["parameters"])
    return None


async def get_monthly(lat: float, lon: float) -> tuple[dict[str, dict[str, float]], str]:
    """Devuelve ({variable: {"YYYYMM": valor}}, origen) con origen 'nasa-power' o 'muestra-local'."""
    key = (round(lat, 2), round(lon, 2))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1], "nasa-power"
    try:
        data = await _fetch_live(*key)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        sample = _sample_for(*key)
        if sample is not None:
            return sample, "muestra-local"
        raise PowerUnavailable(
            "NASA POWER no respondió y no hay muestra local para esta ubicación"
        ) from exc
    _cache[key] = (time.time(), data)
    return data, "nasa-power"

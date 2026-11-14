"""Descarga muestras para uso sin conexión en la demo.

- NASA POWER: todas las variables de cada región de ejemplo.
- Banco Mundial: todos los indicadores de cada país de las regiones de ejemplo.
- Demografía (ONU vía Our World in Data): todos los indicadores de esos países.

Uso: cd backend && PYTHONPATH=. uv run python -u scripts/fetch_samples.py [power|worldbank [ISO3 ...]|demography]
"""
import asyncio
import json
import sys
from datetime import date

import httpx

from app.catalog import INDICATORS, REGIONS
from app.services import demography, power, worldbank


async def fetch_power() -> None:
    for region in REGIONS:
        data = await power._fetch_live(region.lat, region.lon)
        payload = {
            "region": region.id,
            "lat": region.lat,
            "lon": region.lon,
            "fetched": date.today().isoformat(),
            "source": "NASA POWER monthly point (AG community)",
            "parameters": data,
        }
        path = power.SAMPLES_DIR / f"{region.id}.json"
        path.write_text(json.dumps(payload, separators=(",", ":")))
        print(f"{region.id}: {len(data)} variables -> {path.stat().st_size // 1024} KB")


async def fetch_worldbank(only: list[str] | None = None) -> None:
    countries = only or sorted({r.country for r in REGIONS if r.country})
    for country in countries:
        series = {}
        for ind in INDICATORS:
            for attempt in range(3):
                try:
                    data = await worldbank._fetch_live(country, ind.key)
                    series[ind.key] = {str(y): v for y, v in sorted(data.items())}
                    print(f"  {country} {ind.key}: {len(data)} años", flush=True)
                    break
                except httpx.HTTPError as exc:
                    print(f"  {country} {ind.key}: intento {attempt + 1} falló ({type(exc).__name__})",
                          flush=True)
        payload = {
            "country": country,
            "fetched": date.today().isoformat(),
            "source": "World Bank Open Data API v2",
            "indicators": series,
        }
        path = power.SAMPLES_DIR / f"worldbank_{country}.json"
        path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
        print(f"{country}: {len(series)}/{len(INDICATORS)} indicadores -> {path.name}", flush=True)


async def fetch_demography() -> None:
    countries = sorted({r.country for r in REGIONS if r.country})
    payload = {c: {"country": c, "fetched": date.today().isoformat(),
                   "source": "UN World Population Prospects via Our World in Data", "indicators": {}}
               for c in countries}
    for ind in demography.DEMOGRAPHY:
        table = await demography._fetch_live(ind)
        for c in countries:
            est, proj = table.get(c, ({}, {}))
            payload[c]["indicators"][ind.key] = {
                "estimates": {str(y): v for y, v in sorted(est.items())},
                "projection": {str(y): v for y, v in sorted(proj.items())},
            }
        print(f"  {ind.key}: {len(table)} países", flush=True)
    for c, data in payload.items():
        path = power.SAMPLES_DIR / f"demography_{c}.json"
        path.write_text(json.dumps(data, separators=(",", ":")))
        print(f"{c} -> {path.name} ({path.stat().st_size // 1024} KB)", flush=True)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "power"):
        asyncio.run(fetch_power())
    if which in ("all", "worldbank"):
        asyncio.run(fetch_worldbank([c.upper() for c in sys.argv[2:]] or None))
    if which in ("all", "demography"):
        asyncio.run(fetch_demography())

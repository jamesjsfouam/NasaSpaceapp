"""Descarga muestras de NASA POWER para las regiones de ejemplo (uso sin conexión en la demo).

Uso: cd backend && PYTHONPATH=. uv run python scripts/fetch_samples.py
"""
import asyncio
import json
from datetime import date

from app.catalog import REGIONS
from app.services import power


async def main() -> None:
    power.SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
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


asyncio.run(main())

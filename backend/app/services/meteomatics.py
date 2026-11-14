"""Cliente mínimo de la API REST de Meteomatics (oferta global de Space Apps).

Formato de URL: https://api.meteomatics.com/{fechas}/{parámetros}/{lat},{lon}/json
Parámetros útiles para salud: t_2m:C (temperatura), uv:idx (índice UV),
relative_humidity_2m:p, pm2p5:ugm3 y air_quality:idx (calidad del aire).
"""
from datetime import UTC, datetime

import httpx

from app.config import get_settings

BASE_URL = "https://api.meteomatics.com"


class MeteomaticsNotConfigured(RuntimeError):
    pass


async def query(lat: float, lon: float, parameters: list[str], when: str | None = None) -> dict:
    """Consulta uno o varios parámetros en un punto.

    `when` acepta un instante ISO o un rango `inicio--fin:PT1H`. Por defecto: ahora.
    """
    s = get_settings()
    if not (s.meteomatics_username and s.meteomatics_password):
        raise MeteomaticsNotConfigured(
            "Falta METEOMATICS_USERNAME / METEOMATICS_PASSWORD en el archivo .env"
        )
    when = when or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = f"{BASE_URL}/{when}/{','.join(parameters)}/{lat},{lon}/json"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, auth=(s.meteomatics_username, s.meteomatics_password))
        r.raise_for_status()
        return r.json()

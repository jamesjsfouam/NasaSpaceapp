"""Cualquier lugar del mundo: buscar por nombre y saber en qué país cae una coordenada.

- Búsqueda: API de geocodificación de Open-Meteo (abierta, sin clave).
- País de una coordenada: sin conexión, con reverse_geocoder (ciudades de GeoNames) y
  pycountry para el código ISO3 y el nombre en español. Si la ciudad más cercana está a más
  de MAX_COUNTRY_KM se considera mar abierto o zona remota y no se asigna país.
"""
from __future__ import annotations

import gettext
import math
from functools import lru_cache

import httpx
import pycountry
from pydantic import BaseModel

SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search"
MAX_COUNTRY_KM = 250


class Place(BaseModel):
    name: str
    admin1: str | None = None
    country: str | None = None
    iso3: str | None = None
    lat: float
    lon: float


class Location(BaseModel):
    lat: float
    lon: float
    iso3: str | None
    country: str | None
    nearest_place: str | None
    admin1: str | None
    distance_km: float | None


class PlacesUnavailable(RuntimeError):
    pass


@lru_cache
def _es():
    return gettext.translation("iso3166-1", pycountry.LOCALES_DIR, languages=["es"], fallback=True)


def country_name(iso3: str) -> str | None:
    c = pycountry.countries.get(alpha_3=iso3.upper())
    return _es().gettext(c.name) if c else None


def iso3_from_iso2(iso2: str | None) -> str | None:
    c = pycountry.countries.get(alpha_2=iso2.upper()) if iso2 else None
    return c.alpha_3 if c else None


@lru_cache
def all_countries() -> dict[str, str]:
    """{ISO3: nombre en español}, ordenado por nombre."""
    names = {c.alpha_3: _es().gettext(c.name) for c in pycountry.countries}
    return dict(sorted(names.items(), key=lambda kv: kv[1]))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


@lru_cache(maxsize=4096)
def locate(lat: float, lon: float) -> Location:
    import reverse_geocoder  # carga perezosa: lee su tabla de ciudades la primera vez

    hit = reverse_geocoder.search([(lat, lon)], mode=1, verbose=False)[0]
    dist = _haversine_km(lat, lon, float(hit["lat"]), float(hit["lon"]))
    iso3 = iso3_from_iso2(hit["cc"]) if dist <= MAX_COUNTRY_KM else None
    return Location(
        lat=lat,
        lon=lon,
        iso3=iso3,
        country=country_name(iso3) if iso3 else None,
        nearest_place=hit["name"] if dist <= MAX_COUNTRY_KM else None,
        admin1=hit["admin1"] or None if dist <= MAX_COUNTRY_KM else None,
        distance_km=round(dist, 1),
    )


async def search(name: str, count: int = 8) -> list[Place]:
    params = {"name": name, "count": count, "language": "es", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            r = await client.get(SEARCH_URL, params=params)
            r.raise_for_status()
            rows = r.json().get("results") or []
    except (httpx.HTTPError, ValueError) as exc:
        raise PlacesUnavailable("El buscador de lugares no respondió; elige el punto en el mapa.") from exc
    return [
        Place(
            name=row["name"],
            admin1=row.get("admin1"),
            country=row.get("country"),
            iso3=iso3_from_iso2(row.get("country_code")),
            lat=float(row["latitude"]),
            lon=float(row["longitude"]),
        )
        for row in rows
    ]

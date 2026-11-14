"""Satélite para cualquier punto del mundo, desde Microsoft Planetary Computer (sin clave).

- **Imágenes año a año:** Landsat (desde 1984; Landsat 5 hasta 2011 y 8/9 después) y
  Sentinel-2 (desde 2016, 10 m). Se elige la escena con menos nubes de cada año y se pide al
  servicio de datos un recorte en color natural del cuadro alrededor del punto. La web carga
  la imagen directamente desde esa URL.
- **Cobertura del suelo anual** (Impact Observatory / Esri, 10 m, 2017–2023): porcentaje del
  cuadro que es zona construida, cultivos, árboles, agua, etc., medido año a año.
"""
from __future__ import annotations

import asyncio
import itertools
import math
from urllib.parse import urlencode

import httpx
from pydantic import BaseModel

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item"
TIMEOUT = httpx.Timeout(60.0)
MAX_CLOUD = 20

LULC_COLLECTION = "io-lulc-annual-v02"
LULC_CLASSES = {
    1: "Agua",
    2: "Árboles",
    4: "Vegetación inundada",
    5: "Cultivos",
    7: "Zona construida",
    8: "Suelo desnudo",
    9: "Nieve y hielo",
    11: "Pastizal y matorral",
}
CLOUD_CLASS = 10


class SatelliteImage(BaseModel):
    year: int
    date: str
    collection: str
    platform: str
    cloud_cover: float
    url: str


class LandCoverYear(BaseModel):
    year: int
    shares: dict[str, float]  # % del área válida por clase
    built_km2: float


class LandCover(BaseModel):
    area_km2: float
    years: list[LandCoverYear]
    suggested_place_type: str | None
    warnings: list[str] = []


class SatelliteUnavailable(RuntimeError):
    pass


def bbox_around(lat: float, lon: float, half_km: float) -> list[float]:
    dlat = half_km / 111.0
    dlon = half_km / (111.0 * max(0.05, math.cos(math.radians(lat))))
    return [round(lon - dlon, 5), round(lat - dlat, 5), round(lon + dlon, 5), round(lat + dlat, 5)]


def area_km2(bbox: list[float]) -> float:
    w, s, e, n = bbox
    mid = math.radians((s + n) / 2)
    return abs(n - s) * 111.0 * abs(e - w) * 111.0 * math.cos(mid)


def _scene_query(year: int) -> tuple[str, dict]:
    """Colección y filtro por año. Landsat 7 tras 2003 tiene franjas sin datos: se evita."""
    if year >= 2016:
        return "sentinel-2-l2a", {"eo:cloud_cover": {"lt": MAX_CLOUD}}
    if year <= 2002:  # Landsat 7 sin franjas hasta mayo de 2003; ayuda donde falta Landsat 5
        return "landsat-c2-l2", {"eo:cloud_cover": {"lt": MAX_CLOUD}, "platform": {"in": ["landsat-5", "landsat-7"]}}
    if year <= 2011:
        return "landsat-c2-l2", {"eo:cloud_cover": {"lt": MAX_CLOUD}, "platform": {"in": ["landsat-5"]}}
    return "landsat-c2-l2", {"eo:cloud_cover": {"lt": MAX_CLOUD}, "platform": {"in": ["landsat-8", "landsat-9"]}}


def _render_url(collection: str, item: str, bbox: list[float], size: int) -> str:
    params: list[tuple[str, str]] = [("collection", collection), ("item", item)]
    if collection == "sentinel-2-l2a":
        params.append(("assets", "visual"))
    else:  # Landsat Colección 2 nivel 2: reflectancia escalada; este rango da color natural
        params += [("assets", "red"), ("assets", "green"), ("assets", "blue"), ("rescale", "7500,14000")]
    w, s, e, n = bbox
    # Tamaño cuadrado explícito: el cuadro es cuadrado en el terreno, y así la imagen no se
    # deforma lejos del ecuador (en grados, la longitud se ensancha con la latitud).
    return f"{DATA}/bbox/{w},{s},{e},{n}/{size}x{size}.png?{urlencode(params)}"


async def _best_scene(client: httpx.AsyncClient, year: int, lat: float, lon: float,
                      bbox: list[float], size: int) -> SatelliteImage | None:
    collection, query = _scene_query(year)
    body = {
        "collections": [collection],
        "intersects": {"type": "Point", "coordinates": [lon, lat]},
        "datetime": f"{year}-01-01/{year}-12-31",
        "query": query,
        "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}],
        "limit": 1,
    }
    r = await client.post(STAC, json=body)
    r.raise_for_status()
    features = r.json().get("features", [])
    if not features:
        return None
    f = features[0]
    props = f["properties"]
    return SatelliteImage(
        year=year,
        date=props.get("datetime", "")[:10],
        collection=collection,
        platform=props.get("platform", ""),
        cloud_cover=float(props.get("eo:cloud_cover", 0)),
        url=_render_url(collection, f["id"], bbox, size),
    )


async def timeline(lat: float, lon: float, years: list[int], half_km: float = 8.0,
                   size: int = 640) -> list[SatelliteImage]:
    bbox = bbox_around(lat, lon, half_km)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            found = await asyncio.gather(*[_best_scene(client, y, lat, lon, bbox, size) for y in years])
    except httpx.HTTPError as exc:
        raise SatelliteUnavailable("Planetary Computer no respondió") from exc
    return [img for img in found if img is not None]


def suggest_place_type(shares: dict[str, float], lat: float) -> str | None:
    """Tipo de lugar para el recomendador, a partir de la cobertura del suelo."""
    if not shares:
        return None
    if shares.get("Nieve y hielo", 0) > 20 or abs(lat) > 60:
        return "cold"
    if shares.get("Zona construida", 0) > 25:
        return "city"
    if shares.get("Agua", 0) > 20:
        return "coast"
    if shares.get("Suelo desnudo", 0) > 40:
        return "dry"
    if shares.get("Cultivos", 0) > 25:
        return "farmland"
    if shares.get("Árboles", 0) > 40:
        return "forest"
    if shares.get("Pastizal y matorral", 0) > 40:
        return "dry"
    return None


async def _lulc_year(client: httpx.AsyncClient, item: str, geometry: dict) -> dict[int, int]:
    params = [("collection", LULC_COLLECTION), ("item", item), ("assets", "data"), ("categorical", "true")]
    params += [("c", str(c)) for c in [*LULC_CLASSES, CLOUD_CLASS]]
    r = await client.post(f"{DATA}/statistics", params=params,
                          json={"type": "Feature", "properties": {}, "geometry": geometry})
    r.raise_for_status()
    hist = r.json()["properties"]["statistics"]["data_b1"]["histogram"]
    return {int(v): int(c) for c, v in zip(hist[0], hist[1])}


async def land_cover(lat: float, lon: float, half_km: float = 8.0) -> LandCover:
    bbox = bbox_around(lat, lon, half_km)
    w, s, e, n = bbox
    geometry = {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}
    total_km2 = area_km2(bbox)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(STAC, json={
                "collections": [LULC_COLLECTION],
                "intersects": {"type": "Point", "coordinates": [lon, lat]},
                "limit": 50,
            })
            r.raise_for_status()
            items = {}
            for f in r.json().get("features", []):
                items.setdefault(int(f["properties"]["start_datetime"][:4]), f["id"])
            years = sorted(items)
            counts = await asyncio.gather(*[_lulc_year(client, items[y], geometry) for y in years])
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise SatelliteUnavailable("No se pudo calcular la cobertura del suelo") from exc

    out = []
    for year, c in zip(years, counts):
        valid = sum(v for k, v in c.items() if k in LULC_CLASSES)
        if valid == 0:
            continue
        shares = {name: round(100 * c.get(k, 0) / valid, 2) for k, name in LULC_CLASSES.items()}
        out.append(LandCoverYear(year=year, shares=shares,
                                 built_km2=round(total_km2 * shares["Zona construida"] / 100, 3)))
    suggestion = suggest_place_type(out[-1].shares, lat) if out else None
    warnings = [
        (
            "La cobertura la clasifica un modelo automático (10 m). Un salto grande de un año a otro "
            "suele ser un cambio del clasificador, no del terreno."
        )
    ]
    built = [y.shares["Zona construida"] for y in out]
    if any(abs(b - a) > 5 for a, b in itertools.pairwise(built)):
        warnings.append("Aquí hay un salto de más de 5 puntos entre dos años seguidos: tómalo con cautela.")
    return LandCover(area_km2=round(total_km2, 2), years=out, suggested_place_type=suggestion,
                     warnings=warnings)

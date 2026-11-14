"""Búsqueda en Microsoft Planetary Computer (catálogo STAC). No requiere clave.

Necesita el extra `geo`: uv sync --extra geo
"""
STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"


def search(collection: str, bbox: list[float], datetime_range: str, limit: int = 10) -> list[dict]:
    """Devuelve escenas de una colección dentro de un bbox [oeste, sur, este, norte].

    Ejemplos de colección: sentinel-2-l2a, landsat-c2-l2, modis-11A1-061 (temperatura).
    `datetime_range` tiene la forma "2025-01-01/2025-01-31".
    """
    import planetary_computer
    import pystac_client

    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    results = catalog.search(
        collections=[collection], bbox=bbox, datetime=datetime_range, max_items=limit
    )
    return [
        {
            "id": item.id,
            "datetime": item.datetime.isoformat() if item.datetime else None,
            "assets": {name: asset.href for name, asset in item.assets.items()},
        }
        for item in results.items()
    ]

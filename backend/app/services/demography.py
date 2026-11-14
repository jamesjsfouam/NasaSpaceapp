"""Series demográficas por país desde Our World in Data (datos de la ONU, World Population
Prospects). Abierto, sin clave, para cualquier país.

Para población, crecimiento y fecundidad incluye la **proyección oficial de la ONU**
(variante media) hasta 2100: la app la muestra junto a nuestra extrapolación lineal, porque
una proyección demográfica real (que modela natalidad, mortalidad y migración por edades)
es mucho mejor que alargar una recta.
"""
from __future__ import annotations

import csv
import io
import json
import time

import httpx
from pydantic import BaseModel

from app.services.power import SAMPLES_DIR

OWID_URL = "https://ourworldindata.org/grapher/{slug}.csv"
CACHE_TTL_S = 24 * 3600


class DemographicIndicator(BaseModel):
    key: str
    slug: str  # gráfico de Our World in Data
    label: str
    unit: str
    definition: str
    ratio_scale: bool = True
    has_projection: bool = False


DEMOGRAPHY: list[DemographicIndicator] = [
    DemographicIndicator(key="population", slug="population-with-un-projections", label="Población",
                         unit="habitantes", has_projection=True,
                         definition="Número total de habitantes del país."),
    DemographicIndicator(key="growth", slug="population-growth-rates", label="Crecimiento de la población",
                         unit="% anual", ratio_scale=False, has_projection=True,
                         definition="Cuánto aumenta (o disminuye) la población cada año, en porcentaje. "
                                    "Suma nacimientos y llegadas, y resta muertes y salidas."),
    DemographicIndicator(key="fertility", slug="fertility-rate-with-projections", label="Fecundidad",
                         unit="hijos por mujer", has_projection=True,
                         definition="Número promedio de hijos que tendría una mujer a lo largo de su vida. "
                                    "Con unos 2,1 la población se mantiene estable a largo plazo."),
    DemographicIndicator(key="birth_rate", slug="crude-birth-rate", label="Natalidad",
                         unit="por 1000 habitantes",
                         definition="Nacimientos por cada 1000 habitantes en un año."),
    DemographicIndicator(key="death_rate", slug="crude-death-rate", label="Mortalidad",
                         unit="por 1000 habitantes",
                         definition="Muertes por cada 1000 habitantes en un año."),
    DemographicIndicator(key="urban", slug="share-of-population-urban", label="Población urbana",
                         unit="% de la población",
                         definition="Porcentaje de personas que viven en ciudades."),
    DemographicIndicator(key="life_expectancy", slug="life-expectancy", label="Esperanza de vida",
                         unit="años",
                         definition="Años que viviría en promedio un bebé nacido ese año si las condiciones no cambiaran."),
]
DEMOGRAPHY_BY_KEY = {d.key: d for d in DEMOGRAPHY}

Series = dict[int, float]

# Caché por gráfico: cada descarga trae todos los países, así que sirve para cualquiera.
_cache: dict[str, tuple[float, dict[str, tuple[Series, Series]]]] = {}


class DemographyUnavailable(RuntimeError):
    pass


def parse_owid_csv(text: str) -> dict[str, tuple[Series, Series]]:
    """{ISO3: (estimaciones, proyección ONU)}. La 4.ª columna son las estimaciones; si hay una
    5.ª con "projected" en el nombre, es la proyección. Se ignoran regiones sin código ISO3."""
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    proj_col = 4 if len(header) > 4 and "projected" in header[4] else None
    out: dict[str, tuple[Series, Series]] = {}
    for row in reader:
        if len(row) < 4 or len(row[1]) != 3:
            continue
        try:
            year = int(row[2])
        except ValueError:
            continue
        est, proj = out.setdefault(row[1], ({}, {}))
        if row[3]:
            est[year] = float(row[3])
        if proj_col is not None and len(row) > proj_col and row[proj_col]:
            proj[year] = float(row[proj_col])
    return out


async def _fetch_live(ind: DemographicIndicator) -> dict[str, tuple[Series, Series]]:
    params = {"v": "1", "csvType": "full", "useColumnShortNames": "true"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0), follow_redirects=True) as client:
        r = await client.get(OWID_URL.format(slug=ind.slug), params=params)
        r.raise_for_status()
        return parse_owid_csv(r.text)


def _sample(iso3: str, key: str) -> tuple[Series, Series] | None:
    path = SAMPLES_DIR / f"demography_{iso3}.json"
    if not path.exists():
        return None
    entry = json.loads(path.read_text())["indicators"].get(key)
    if not entry:
        return None
    conv = lambda d: {int(y): float(v) for y, v in d.items()}
    return conv(entry["estimates"]), conv(entry["projection"])


async def get_series(iso3: str, key: str) -> tuple[Series, Series, str]:
    """(estimaciones, proyección ONU, origen) con origen 'our-world-in-data' o 'muestra-local'."""
    ind = DEMOGRAPHY_BY_KEY[key]
    iso3 = iso3.upper()
    hit = _cache.get(ind.slug)
    source = "our-world-in-data"
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        table = hit[1]
    else:
        try:
            table = await _fetch_live(ind)
            _cache[ind.slug] = (time.time(), table)
        except (httpx.HTTPError, ValueError, StopIteration) as exc:
            sample = _sample(iso3, key)
            if sample is not None:
                return *sample, "muestra-local"
            raise DemographyUnavailable("Our World in Data no respondió y no hay muestra local") from exc
    est, proj = table.get(iso3, ({}, {}))
    if not est:
        raise DemographyUnavailable(f"No hay datos de {ind.label.lower()} para este país")
    return est, proj, source

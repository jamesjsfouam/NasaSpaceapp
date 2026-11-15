"""Escenario de crecimiento urbano por celdas de ~100 m (autómata celular con probabilidades aprendidas).

Pasos:
 1. Máscara de lo construido (clase 7) de la cobertura del suelo anual de 10 m (Impact Observatory/Esri,
    Planetary Computer), reproyectada a una malla lon/lat de ~100 m.
 2. Se aprende, con regresión logística, qué celdas libres se convierten en construidas (cercanía a lo
    construido, densidad vecina, pendiente del terreno) usando las transiciones 2017→2020 y 2020→2023.
 3. Validación: se ajusta con 2017→2020 y se comprueba si acierta DÓNDE crecieron las celdas en 2020→2023.
 4. Cantidad: los km² construidos futuros siguen la población urbana proyectada por la ONU elevada a un
    exponente beta ajustado a 2017–2023.
 5. Reparto año a año (2030…2050): se construyen las celdas libres con mayor probabilidad.

Es un ESCENARIO de tendencia, no una predicción: no conoce planes urbanísticos.

Uso: cd backend && PYTHONPATH=. uv run python -u scripts/build_city_growth.py [managua]
"""
from __future__ import annotations

import base64
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import from_bounds
from scipy import ndimage, optimize, stats

from app.services import power  # SAMPLES_DIR

OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "static-api" / "city"
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
LULC_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023]
BASE_YEAR = 2023
PROJECTION_YEARS = [2030, 2035, 2040, 2045, 2050]
CELL_M = 100.0
BUILT, WATER = 7, 1

CITIES = {
    "managua": dict(name="Managua, Nicaragua", lat=12.13, lon=-86.25, iso="NIC", half_km=12.0),
}


def grid_for(lat: float, lon: float, half_km: float):
    dlat = CELL_M / 111_320.0
    dlon = CELL_M / (111_320.0 * np.cos(np.radians(lat)))
    n = int(round(2 * half_km * 1000 / CELL_M))
    west = lon - dlon * n / 2
    north = lat + dlat * n / 2
    transform = from_origin(west, north, dlon, dlat)
    return n, transform, (west, north - dlat * n, west + dlon * n, north)


def read_lulc_year(cat, bbox, year: int, n: int, transform):
    """Devuelve (fracción construida, fracción de agua) por celda de 100 m, o None."""
    items = list(cat.search(collections=["io-lulc-annual-v02"], bbox=bbox,
                            datetime=f"{year}-01-01/{year}-12-31").items())
    items = [i for i in items if i.datetime and i.datetime.year == year] or items
    if not items:
        return None
    href = items[0].assets["data"].href
    with rasterio.open(href) as src:
        b = transform_bounds("EPSG:4326", src.crs, *bbox)
        win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        arr = src.read(1, window=win)
        src_tf = src.window_transform(win)
        crs = src.crs
    out = []
    for cls in (BUILT, WATER):
        layer = (arr == cls).astype("float32")
        dst = np.zeros((n, n), dtype="float32")
        reproject(layer, dst, src_transform=src_tf, src_crs=crs, dst_transform=transform,
                  dst_crs="EPSG:4326", resampling=Resampling.average)
        out.append(dst)
    return out[0], out[1]


def read_slope(cat, bbox, n: int, transform, lat: float):
    """Pendiente en grados a partir del MDE Copernicus de 30 m; ceros si no está disponible."""
    try:
        items = list(cat.search(collections=["cop-dem-glo-30"], bbox=bbox).items())
        dem = np.full((n, n), np.nan, dtype="float32")
        for it in items:
            tmp = np.full((n, n), -9999, dtype="float32")
            with rasterio.open(it.assets["data"].href) as src:
                reproject(rasterio.band(src, 1), tmp, dst_transform=transform, dst_crs="EPSG:4326",
                          resampling=Resampling.bilinear, dst_nodata=-9999)
            ok = tmp > -9000
            dem[ok] = tmp[ok]
        if np.isnan(dem).all():
            raise RuntimeError("sin MDE")
        dem = np.where(np.isnan(dem), np.nanmedian(dem), dem)
        gy, gx = np.gradient(ndimage.gaussian_filter(dem, 1.0), CELL_M)
        return np.degrees(np.arctan(np.hypot(gx, gy))).astype("float32")
    except Exception as exc:  # noqa: BLE001
        print(f"  (sin pendiente: {type(exc).__name__}: {exc})", flush=True)
        return np.zeros((n, n), dtype="float32")


def features(built: np.ndarray, water: np.ndarray, slope: np.ndarray) -> np.ndarray:
    """Matriz (n*n, k) de variables explicativas calculadas desde el estado actual."""
    b = built.astype("float32")
    dist = ndimage.distance_transform_edt(~built).astype("float32")  # en celdas
    dens3 = ndimage.uniform_filter(b, 3)
    dens7 = ndimage.uniform_filter(b, 7)
    dens15 = ndimage.uniform_filter(b, 15)
    dwater = ndimage.distance_transform_edt(water < 0.5).astype("float32")
    cols = [np.log1p(dist), dens3, dens7, dens15, slope / 10.0, np.log1p(dwater)]
    return np.stack([c.ravel() for c in cols], axis=1)


def fit_logistic(X: np.ndarray, y: np.ndarray, l2: float = 1e-3):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = np.hstack([(X - mu) / sd, np.ones((len(X), 1))])

    def loss(w):
        z = Z @ w
        p = 1 / (1 + np.exp(-z))
        eps = 1e-9
        ll = -(y * np.log(p + eps) + (1 - y) * np.log(1 - p + eps)).mean() + l2 * (w[:-1] ** 2).sum()
        g = Z.T @ (p - y) / len(y)
        g[:-1] += 2 * l2 * w[:-1]
        return ll, g

    res = optimize.minimize(loss, np.zeros(Z.shape[1]), jac=True, method="L-BFGS-B")
    return res.x, mu, sd


def score(w, mu, sd, X):
    Z = np.hstack([(X - mu) / sd, np.ones((len(X), 1))])
    return Z @ w


def transitions(b0, b1, w0, slope):
    """Muestras (X, y) de celdas libres en t0: y=1 si en t1 pasaron a construidas."""
    free = (~b0) & (w0 < 0.5)
    X = features(b0, w0, slope)
    y = (b1 & ~b0).ravel().astype("float32")
    idx = np.flatnonzero(free.ravel())
    return X[idx], y[idx], idx


def figure_of_merit(pred_idx: np.ndarray, true_idx: np.ndarray) -> float:
    pred, true = set(pred_idx.tolist()), set(true_idx.tolist())
    hits = len(pred & true)
    denom = len(true | pred)
    return hits / denom if denom else 0.0


def allocate(scores: np.ndarray, free_mask: np.ndarray, k: int) -> np.ndarray:
    idx = np.flatnonzero(free_mask.ravel())
    k = min(k, len(idx))
    top = np.argpartition(-scores[idx], k - 1)[:k]
    return idx[top]


def urban_population(iso3: str):
    """Población urbana = población (ONU, estimada y proyectada) × % urbano.
    El % urbano solo llega a 2025: se prolonga con la tendencia logística de 2000–2025."""
    est = json.loads((power.SAMPLES_DIR / f"demography_{iso3}.json").read_text())["indicators"]
    pop = {int(y): v for y, v in est["population"]["estimates"].items()}
    pop.update({int(y): v for y, v in est["population"]["projection"].items()})
    urb = {int(y): v for y, v in est["urban"]["estimates"].items()}
    last = max(urb)
    ys = np.array([y for y in urb if 2000 <= y <= last], dtype=float)
    logit = np.log(np.array([urb[int(y)] / 100 for y in ys]) / (1 - np.array([urb[int(y)] / 100 for y in ys])))
    slope, icpt = np.polyfit(ys, logit, 1)
    for y in range(last + 1, 2101):
        z = icpt + slope * y
        urb[y] = 100.0 / (1 + np.exp(-z))
    return {y: pop[y] * urb[y] / 100.0 for y in pop if y in urb}


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a.astype("uint8")).tobytes()).decode()


def build(city_id: str) -> None:
    c = CITIES[city_id]
    n, transform, (w, s, e, nn) = grid_for(c["lat"], c["lon"], c["half_km"])
    bbox = [w - 0.01, s - 0.01, e + 0.01, nn + 0.01]
    print(f"{city_id}: malla {n}x{n} de {CELL_M:.0f} m, bbox {bbox}", flush=True)
    cat = pystac_client.Client.open(STAC, modifier=pc.sign_inplace)

    built_f, water_f = {}, {}
    for yr in LULC_YEARS:
        r = read_lulc_year(cat, bbox, yr, n, transform)
        if r is None:
            print(f"  {yr}: sin datos", flush=True)
            continue
        built_f[yr], water_f[yr] = r
        print(f"  {yr}: construido {(built_f[yr] >= .5).mean() * 100:.1f} % de la malla", flush=True)
    years = sorted(built_f)
    slope = read_slope(cat, bbox, n, transform, c["lat"])

    B = {y: built_f[y] >= 0.5 for y in years}
    # el agua no cambia: se usa la mediana de los años
    W = np.median(np.stack([water_f[y] for y in years]), axis=0)
    # lo construido no "desaparece": se acumula (evita parpadeo de clasificación)
    for i in range(1, len(years)):
        B[years[i]] = B[years[i]] | B[years[i - 1]]

    # ---- validación: ajustar con 2017→2020, probar en 2020→2023
    y0, y1, y2 = 2017, 2020, 2023
    Xa, ya, _ = transitions(B[y0], B[y1], W, slope)
    wa, mua, sda = fit_logistic(Xa, ya)
    Xb, yb, idxb = transitions(B[y1], B[y2], W, slope)
    sb = score(wa, mua, sda, Xb)
    auc = float((stats.rankdata(sb)[yb == 1].sum() - yb.sum() * (yb.sum() + 1) / 2) / (yb.sum() * (1 - yb).sum()))
    n_new = int(yb.sum())
    true_idx = idxb[yb == 1]
    top = np.argpartition(-sb, n_new - 1)[:n_new]
    fom_model = figure_of_merit(idxb[top], true_idx)
    # referencia ingenua: construir lo más cercano a lo ya construido
    dist_col = Xb[:, 0]
    top0 = np.argpartition(dist_col, n_new - 1)[:n_new]
    fom_base = figure_of_merit(idxb[top0], true_idx)
    rnd = np.random.default_rng(1).choice(len(idxb), n_new, replace=False)
    fom_rand = figure_of_merit(idxb[rnd], true_idx)
    print(f"  validación 2020→2023: celdas nuevas {n_new}, AUC {auc:.3f}, FoM modelo {fom_model:.3f}, "
          f"cercanía {fom_base:.3f}, azar {fom_rand:.3f}", flush=True)

    # ---- modelo final con todas las transiciones
    Xs, ys = [], []
    for t0, t1 in zip(years[:-1], years[1:]):
        X, y, _ = transitions(B[t0], B[t1], W, slope)
        Xs.append(X)
        ys.append(y)
    wf, muf, sdf = fit_logistic(np.vstack(Xs), np.concatenate(ys))
    names = ["cercanía a lo construido", "densidad 300 m", "densidad 700 m", "densidad 1,5 km",
             "pendiente", "cercanía al agua"]
    coefs = {k: round(float(v), 3) for k, v in zip(names, wf[:-1])}
    print("  coeficientes:", coefs, flush=True)

    # ---- cantidad: población urbana ONU
    U = urban_population(c["iso"])
    area = {y: float(B[y].sum()) * (CELL_M / 1000) ** 2 for y in years}
    xs = np.log([U[y] for y in years])
    ys_ = np.log([area[y] for y in years])
    beta = float(np.polyfit(xs, ys_, 1)[0])
    beta_c = float(np.clip(beta, 0.5, 1.3))
    print(f"  área construida {area[years[0]]:.1f}→{area[years[-1]]:.1f} km²; beta ajustado {beta:.2f} (usado {beta_c:.2f})",
          flush=True)

    # ---- reparto año a año
    cur = B[BASE_YEAR].copy()
    free_water = W >= 0.5
    added = np.zeros((n, n), dtype="uint8")
    out_area = {BASE_YEAR: area[BASE_YEAR]}
    for k, yr in enumerate(PROJECTION_YEARS, start=1):
        target = area[BASE_YEAR] * (U[yr] / U[BASE_YEAR]) ** beta_c
        need = int(round((target - cur.sum() * (CELL_M / 1000) ** 2) / (CELL_M / 1000) ** 2))
        if need > 0:
            X = features(cur, W, slope)
            sc = score(wf, muf, sdf, X)
            free = (~cur) & (~free_water)
            pick = allocate(sc, free, need)
            flat = cur.ravel()
            flat[pick] = True
            cur = flat.reshape(n, n)
            ad = added.ravel()
            ad[pick] = k
            added = ad.reshape(n, n)
        out_area[yr] = float(cur.sum()) * (CELL_M / 1000) ** 2
        print(f"  {yr}: objetivo {target:.1f} km², construido {out_area[yr]:.1f} km² (+{need} celdas)", flush=True)

    dens = np.clip(np.round(built_f[BASE_YEAR] * 100), 0, 100)
    dens[~B[BASE_YEAR]] = 0
    conv = np.concatenate([(built_f[t1] * (B[t1] & ~B[t0])).ravel()[(B[t1] & ~B[t0]).ravel()]
                           for t0, t1 in zip(years[:-1], years[1:])])
    new_density = float(np.clip(conv.mean() if len(conv) else 0.7, 0.3, 1.0))

    payload = {
        "id": city_id, "name": c["name"], "lat": c["lat"], "lon": c["lon"],
        "generated": date.today().isoformat(),
        "grid": {"cols": n, "rows": n, "cell_m": CELL_M, "west": w, "south": s, "east": e, "north": nn},
        "base_year": BASE_YEAR, "years": [BASE_YEAR] + PROJECTION_YEARS,
        "density": b64(dens), "added": b64(added), "water": b64((W >= 0.5)),
        "new_cell_density": round(new_density, 2),
        "stats": {
            "built_km2": {str(k): round(v, 1) for k, v in {**{y: area[y] for y in years}, **out_area}.items()},
            "urban_population_million": {str(y): round(U[y] / 1e6, 3) for y in sorted(U) if y in set(years + PROJECTION_YEARS)},
            "beta": round(beta_c, 2), "beta_fitted": round(beta, 2),
        },
        "validation": {
            "fit": f"{y0}→{y1}", "test": f"{y1}→{y2}", "new_cells": n_new,
            "auc": round(auc, 3), "figure_of_merit": round(fom_model, 3),
            "baseline_proximity": round(fom_base, 3), "baseline_random": round(fom_rand, 3),
        },
        "coefficients": coefs,
        "sources": ["Impact Observatory / Esri 10 m Land Use/Land Cover (annual), Microsoft Planetary Computer",
                    "Copernicus DEM GLO-30 (slope)", "UN World Population Prospects via Our World in Data"],
        "method": "Cellular automaton with logistic transition probabilities; built area follows UN urban population^beta.",
        "caveats": ["Scenario, not a forecast: it extends the 2017–2023 trend and ignores urban planning.",
                    "10 m land cover resolves city blocks, not individual buildings; heights are schematic."],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{city_id}.json"
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False, default=float))
    print(f"-> {path} ({path.stat().st_size // 1024} KB)", flush=True)


if __name__ == "__main__":
    for cid in (sys.argv[1:] or list(CITIES)):
        build(cid)

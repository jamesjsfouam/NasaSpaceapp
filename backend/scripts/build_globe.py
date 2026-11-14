"""Malla global de tendencias para el globo 3D (se ejecuta una vez y se guarda).

Divide el mundo en celdas de 5° (36 × 72 = 2.592), pide a NASA POWER la serie mensual del
centro de cada celda y pasa cada variable por el mismo motor del veredicto (trends.py).
Después aplica el control de la tasa de falsos descubrimientos (Benjamini-Hochberg, q = 0,10)
a todas las celdas de cada variable: en un mapa con miles de pruebas, sin esta corrección
aparecerían cientos de celdas "significativas" por azar (hallazgo 4 del análisis del reto).

Es reanudable: guarda el avance en scripts/.globe_partial.json.

Uso: cd backend && PYTHONPATH=. uv run python -u scripts/build_globe.py [--workers 6]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import date
from pathlib import Path

import httpx
import numpy as np

from app.catalog import VARIABLE_BY_KEY
from app.services import power, trends

CELL = 5
START, END = 1990, power.last_full_year()
GLOBE_VARS = ["T2M", "PRECTOTCORR", "GWETROOT", "RH2M", "WS2M"]
FDR_Q = 0.10
OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "globe.json"
PARTIAL = Path(__file__).resolve().parent / ".globe_partial.json"
VERDICT_CODE = {"significant": 2, "not_yet": 1, "no_trend": 0}


def cell_centers() -> list[tuple[float, float]]:
    lats = np.arange(-90 + CELL / 2, 90, CELL)
    lons = np.arange(-180 + CELL / 2, 180, CELL)
    return [(float(la), float(lo)) for la in lats for lo in lons]


async def fetch_cell(client: httpx.AsyncClient, lat: float, lon: float) -> dict[str, dict[str, float]]:
    params = {"parameters": ",".join(GLOBE_VARS), "community": "AG", "latitude": lat,
              "longitude": lon, "start": START, "end": END, "format": "JSON"}
    for attempt in range(4):
        try:
            r = await client.get(power.POWER_URL, params=params)
            if r.status_code == 429 or r.status_code >= 500:
                raise httpx.HTTPStatusError("reintentar", request=r.request, response=r)
            r.raise_for_status()
            return power._clean(r.json()["properties"]["parameter"])
        except (httpx.HTTPError, KeyError, ValueError):
            if attempt == 3:
                raise
            await asyncio.sleep(2 ** attempt * 2)
    return {}


def analyze_cell(monthly: dict[str, dict[str, float]]) -> dict[str, list]:
    """{variable: [pendiente/década, p de Mann-Kendall, código de veredicto, media]}."""
    out = {}
    for key in GLOBE_VARS:
        annual = trends.annual_means(monthly.get(key, {}), START, END)
        if len(annual) < trends.MIN_YEARS:
            continue
        try:
            r = trends.analyze_annual(VARIABLE_BY_KEY[key], list(annual), list(annual.values()), False)
        except trends.InsufficientData:
            continue
        out[key] = [float(f"{r.slope_per_decade:.4g}"), round(r.mk_p, 5), VERDICT_CODE[r.verdict],
                    float(f"{np.mean(list(annual.values())):.4g}")]
    return out


def benjamini_hochberg(pvalues: list[float], q: float) -> float:
    """Umbral de p por debajo del cual se rechaza (0 si ninguno pasa)."""
    p = np.sort(np.asarray(pvalues))
    m = len(p)
    ok = p <= q * np.arange(1, m + 1) / m
    return float(p[np.nonzero(ok)[0].max()]) if ok.any() else 0.0


def finalize(cells: dict[str, dict]) -> dict:
    rows = [{"lat": float(k.split(",")[0]), "lon": float(k.split(",")[1]), **v} for k, v in cells.items()]
    variables = {}
    for key in GLOBE_VARS:
        ps = [row[key][1] for row in rows if key in row]
        thr = benjamini_hochberg(ps, FDR_Q) if ps else 0.0
        n_sig = 0
        for row in rows:
            if key in row:
                passes = row[key][1] <= thr and row[key][2] == 2
                row[key].append(1 if passes else 0)
                n_sig += passes
        slopes = [row[key][0] for row in rows if key in row]
        v = VARIABLE_BY_KEY[key]
        variables[key] = {"label": v.label, "unit": v.unit, "cells": len(ps), "fdr_threshold": thr,
                          "fdr_significant": n_sig,
                          "slope_p98": float(np.percentile(np.abs(slopes), 98)) if slopes else 0.0}
    return {
        "generated": date.today().isoformat(), "period": [START, END], "cell_deg": CELL,
        "source": "NASA POWER (MERRA-2/CERES), centro de cada celda", "fdr_q": FDR_Q,
        "fields": ["pendiente_por_decada", "p_mann_kendall", "veredicto(2/1/0)", "media", "pasa_fdr"],
        "variables": variables, "cells": rows,
    }


async def main(workers: int) -> None:
    done: dict[str, dict] = json.loads(PARTIAL.read_text()) if PARTIAL.exists() else {}
    todo = [c for c in cell_centers() if f"{c[0]},{c[1]}" not in done]
    print(f"{len(done)} celdas hechas, faltan {len(todo)}", flush=True)
    sem = asyncio.Semaphore(workers)
    t0, failed = time.time(), []

    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0)) as client:
        async def one(lat: float, lon: float) -> None:
            async with sem:
                try:
                    monthly = await fetch_cell(client, lat, lon)
                except (httpx.HTTPError, KeyError, ValueError):
                    failed.append((lat, lon))
                    return
            done[f"{lat},{lon}"] = await asyncio.to_thread(analyze_cell, monthly)

        for i in range(0, len(todo), 60):
            await asyncio.gather(*(one(la, lo) for la, lo in todo[i:i + 60]))
            PARTIAL.write_text(json.dumps(done))
            rate = (i + 60) / max(1, time.time() - t0)
            print(f"{len(done)}/{len(cell_centers())} celdas · {rate:.1f}/s · fallidas {len(failed)}", flush=True)

    if failed:
        print(f"Quedaron {len(failed)} celdas sin datos; vuelve a ejecutar para reintentarlas.", flush=True)
    result = finalize(done)
    OUT.write_text(json.dumps(result, separators=(",", ":")))
    print(f"Guardado {OUT} ({OUT.stat().st_size // 1024} KB)", flush=True)
    for k, v in result["variables"].items():
        print(f"  {k}: {v['fdr_significant']}/{v['cells']} celdas pasan FDR (umbral p {v['fdr_threshold']:.4g})", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    asyncio.run(main(ap.parse_args().workers))

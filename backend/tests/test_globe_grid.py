import importlib.util
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location("build_globe", Path(__file__).parents[1] / "scripts" / "build_globe.py")
build_globe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_globe)


def test_grid_has_2592_cell_centers():
    centers = build_globe.cell_centers()
    assert len(centers) == 2592 and centers[0] == (-87.5, -177.5) and centers[-1] == (87.5, 177.5)


def test_benjamini_hochberg_controls_false_discoveries():
    rng = np.random.default_rng(0)
    null = rng.uniform(0, 1, 2000)  # celdas sin tendencia
    real = rng.uniform(0, 1e-4, 200)  # celdas con tendencia fuerte
    thr = build_globe.benjamini_hochberg(list(null) + list(real), 0.10)
    false_hits = int(np.sum(null <= thr))
    assert np.all(real <= thr)
    assert false_hits / (false_hits + 200) <= 0.15  # q = 0,10, con margen por azar
    assert build_globe.benjamini_hochberg(list(rng.uniform(0.5, 1, 100)), 0.10) == 0.0

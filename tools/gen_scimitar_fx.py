"""Generate texture particle scimitar (slash, cucuk, spin), 64x64 per frame, strip vertikal.

Diambil dari tools/gen_sword_slash.py Project Luna (fbm noise), dikecilin ke 64px
dan alpha-nya dipixelin biar nyambung sama aura_slash.

  python3 tools/gen_scimitar_fx.py packs/RP/textures/particle/scimitar [preview.png]

Output: scimitar_slash.png, scimitar_slash_mirror.png (sabit, arah sapuannya kebalikan),
scimitar_thrust.png (tusukan), scimitar_spin.png (dua jejak pedang, diputer 180 derajat).
Semua frame di-flip atas-bawah di akhir: quad direction_y / emitter_transform_xz di game
nampilin texture kebalik dari gambarnya.
Grayscale + alpha, buat particles_add, warna dari tinting particle.
"""
import os
import sys
import numpy as np
from PIL import Image

SIZE = 64
SS = 4
N = SIZE * SS
LEVELS = 6

_rng = np.random.default_rng(178)
GRID = 64
_grids = [_rng.random((GRID, GRID)).astype(np.float32) for _ in range(6)]


def _value(u, v, g):
    u = np.mod(u, GRID); v = np.mod(v, GRID)
    i0 = np.floor(u).astype(np.int32); j0 = np.floor(v).astype(np.int32)
    fu = u - i0; fv = v - j0
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv)
    i1 = (i0 + 1) % GRID; j1 = (j0 + 1) % GRID
    a = g[i0, j0] * (1 - fu) + g[i1, j0] * fu
    b = g[i0, j1] * (1 - fu) + g[i1, j1] * fu
    return a * (1 - fv) + b * fv


def fbm(u, v, octaves=4, seed=0):
    out = np.zeros_like(u); amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += _value(u * 2 ** o + 13.1 * o, v * 2 ** o + 7.7 * o, _grids[(seed + o) % len(_grids)]) * amp
        tot += amp; amp *= 0.5
    return out / tot


def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ease_out(t):
    return 1 - (1 - t) ** 3


y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
yu = 1 - y


def to_img(v):
    v = np.clip(np.nan_to_num(v), 0, 1).reshape(SIZE, SS, SIZE, SS).mean(axis=(1, 3))
    v = np.round(v * LEVELS) / LEVELS
    a = (v * 255).astype(np.uint8)
    return Image.merge("LA", (Image.fromarray(a, "L"), Image.fromarray(a, "L")))


def slash(t, i):
    cx, cy = 0.56, 0.5
    dx, dy = x - cx, yu - cy
    r = np.sqrt(dx * dx + dy * dy)
    ang = np.mod(np.degrees(np.arctan2(dy, dx)), 360)
    start, span = 75.0, 210.0
    head = start + 45.0 + (span - 45.0) * ease_out(min(1.0, t * 2.0))
    tail = start + span * sm(0.35, 1.0, t)
    length = max(head - tail, 1.0)
    s = (ang - tail) / length
    sc = np.clip(s, 0, 1)
    ro = 0.43
    w = (0.09 + 0.10 * np.sin(np.pi * min(1.0, t * 1.6 + 0.15)) ** 0.7) * sc ** 0.5
    d = (ro - r) / np.maximum(w, 1e-4)
    n = fbm((head - ang) / 10.0, r * 30, 4, 1)
    inside = (s >= 0) & (s <= 1.0 + 0.04 * (n - 0.5)) & (d >= -0.05 + 0.1 * n) & (d <= 1.0)
    streak = fbm((head - ang) / 90.0 + i * 0.2, d * 6.0, 3, 4)
    v = (0.7 + 0.3 * sm(0.35, 0.7, streak)) * (1 - sm(0.35, 1.0, d) * 0.75) * (0.45 + 0.55 * sc) * 1.25
    v = v + np.exp(-((s - 0.95) ** 2) / 0.004) * (1 - sm(0.2, 0.8, d)) * 0.3
    if t > 0.5:
        thr = sm(0.5, 1.0, t) * 0.8
        v = v * sm(thr - 0.1, thr + 0.05, fbm((head - ang) / 20.0, r * 20, 3, 2) * 0.6 + sc * 0.4)
    inner = (s >= 0) & (s <= 0.85) & (np.abs(r - (ro - 0.12)) < 0.008)
    v = np.where(inside, v, 0.0) + np.where(inner, 0.35 * sc * (1 - t), 0.0)
    return v * (1 - 0.6 * sm(0.7, 1.0, t))


def thrust(t, i):
    head = 0.88 + 0.08 * ease_out(t)
    tail = 0.06 + 0.6 * sm(0.15, 1.0, t)
    s = (yu - tail) / max(head - tail, 1e-3)
    sc = np.clip(s, 0, 1)
    prof = np.where(sc < 0.75, (sc / 0.75) ** 0.7, ((1 - sc) / 0.25) ** 0.6)
    half = 0.11 * (1 - 0.45 * sm(0.2, 1.0, t)) * prof
    q = np.abs(x - 0.5) / np.maximum(half, 1e-4)
    n = fbm(yu * 40 + i, x * 30, 3, 3)
    inside = (s >= 0) & (s <= 1) & (q <= 0.9 + 0.25 * (n - 0.5))
    v = (1 - sm(0.4, 1.0, q) * 0.7) * (0.4 + 0.6 * sc)
    v = v + np.exp(-((s - 0.95) ** 2) / 0.003) * (1 - sm(0.3, 1.0, q)) * 0.5
    v = np.where(inside, v, 0.0)
    for side, off, ln in ((-1, 0.2, 0.45), (1, 0.24, 0.35)):
        lx = 0.5 + side * off
        top = 0.55 + 0.3 * ease_out(t)
        line = (np.abs(x - lx) < 0.012) & (yu < top) & (yu > top - ln * (1 - t))
        v = np.maximum(v, np.where(line, 0.5 * (1 - sm(0.4, 1.0, t)), 0.0))
    if t > 0.5:
        thr = sm(0.5, 1.0, t) * 0.7
        v = v * sm(thr - 0.1, thr + 0.05, fbm(yu * 12, x * 12, 3, 2) * 0.6 + sc * 0.4)
    return v * (1 - 0.6 * sm(0.7, 1.0, t))


def spin(t, i):
    dx, dy = x - 0.5, yu - 0.5
    r = np.sqrt(dx * dx + dy * dy)
    ang = np.mod(np.degrees(np.arctan2(dy, dx)), 360)
    v = np.zeros_like(r)
    for base in (0.0, 180.0):
        behind = np.mod(ang - base, 360)
        s = 1 - behind / 150.0
        sc = np.clip(s, 0, 1)
        r_in, r_out = 0.17, 0.47
        band = (r - r_in) / (r_out - r_in)
        n = fbm(behind / 12.0 + i * 0.7, r * 30, 4, 5)
        width = 0.35 + 0.65 * sc
        inside = (s > 0) & (band >= 1 - width + 0.1 * (n - 0.5)) & (band <= 1.0)
        streak = fbm(behind / 60.0 + i * 0.4, band * 8.0, 3, 1)
        val = (0.4 + 0.6 * sm(0.3, 0.7, streak)) * sc ** 1.3 * (0.6 + 0.4 * band)
        val = val + np.exp(-(behind - 6.0) ** 2 / 40.0) * sm(0.3, 0.8, band) * 0.35
        v = np.maximum(v, np.where(inside, val, 0.0))
    return v


def strip(fn, frames, mirror=False):
    out = Image.new("LA", (SIZE, SIZE * frames))
    for i in range(frames):
        img = to_img(fn(i / (frames - 1), i))
        if mirror:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
        out.paste(img, (0, i * SIZE))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    folder = args[0]
    os.makedirs(folder, exist_ok=True)
    sheets = {
        "scimitar_slash": strip(slash, 10),
        "scimitar_slash_mirror": strip(slash, 10, True),
        "scimitar_thrust": strip(thrust, 8),
        "scimitar_spin": strip(spin, 6),
    }
    for name, img in sheets.items():
        img.save(os.path.join(folder, name + ".png"), optimize=True)
    if len(args) > 1:
        cols = max(img.height // SIZE for img in sheets.values())
        prev = Image.new("RGBA", (SIZE * cols, SIZE * len(sheets)), (32, 34, 44, 255))
        for row, img in enumerate(sheets.values()):
            rgba = img.convert("RGBA")
            for k in range(img.height // SIZE):
                prev.alpha_composite(rgba.crop((0, k * SIZE, SIZE, (k + 1) * SIZE)), (k * SIZE, row * SIZE))
        prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST).save(args[1])


main()

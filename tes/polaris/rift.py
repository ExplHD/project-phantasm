"""Sky rift textures for The Punishment (stars) and The Phase Collapse (nebula).

Run: python3 tes/polaris/rift.py [--preview]
Reads tes/polaris/ref/rift_*.png, writes packs/RP/textures/particle/polaris/rift_*.png.
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "tes/polaris/ref"
OUT = ROOT / "packs/RP/textures/particle/polaris"
PREVIEW = ROOT / "tes/polaris/preview"

SIZE = 256
CELL = 4
LAYERS = [(8, 70), (20, 130), (30, 195), (40, 255)]
RIM_MIX = {70: 235, 130: 190, 195: 120}
RIM_ALPHA = {70: 90, 130: 160, 195: 225}


def stacked_mask(seed):
    rng = random.Random(seed)
    mask = Image.new("L", (SIZE, SIZE), 0)
    for inset, alpha in LAYERS:
        layer = Image.new("L", (SIZE, SIZE), 0)
        draw = ImageDraw.Draw(layer)
        draw.rectangle((inset, inset, SIZE - inset - 1, SIZE - inset - 1), fill=alpha)
        low, high = inset, SIZE - inset
        for _ in range(90):
            side = rng.choice((8, 12, 16, 20, 28))
            along = rng.randrange(low, high, CELL)
            edge = rng.choice((low, high))
            reach = rng.choice((-1, 0, 1)) * CELL
            cx, cy = (along, edge + reach) if rng.random() < 0.5 else (edge + reach, along)
            x0 = max(0, (cx - side // 2) // CELL * CELL)
            y0 = max(0, (cy - side // 2) // CELL * CELL)
            draw.rectangle((x0, y0, min(SIZE, x0 + side) - 1, min(SIZE, y0 + side) - 1), fill=alpha)
        mask = ImageChops.lighter(mask, layer)
    return mask


def square(image):
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))


def build(name, seed, star_boost, rim_color):
    source = square(Image.open(REF / f"{name}.png").convert("RGB"))
    if star_boost:
        source = source.filter(ImageFilter.MaxFilter(3))
    sky = source.resize((SIZE, SIZE), Image.LANCZOS)
    if star_boost:
        sky = ImageEnhance.Contrast(sky).enhance(1.1)
    mask = stacked_mask(seed)
    rim = Image.new("RGB", (SIZE, SIZE), rim_color)
    tint = mask.point(lambda alpha: RIM_MIX.get(alpha, 0))
    sky = Image.composite(rim, sky, tint).convert("RGBA")
    sky.putalpha(mask.point(lambda alpha: RIM_ALPHA.get(alpha, alpha)))
    OUT.mkdir(parents=True, exist_ok=True)
    sky.save(OUT / f"{name}.png")
    return sky


def main():
    stars = build("rift_stars", 11, True, (90, 242, 255))
    nebula = build("rift_nebula", 23, False, (184, 107, 255))
    if "--preview" not in sys.argv:
        return
    PREVIEW.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (SIZE * 4 + 24, SIZE * 2 + 16), (120, 170, 255, 255))
    sheet.alpha_composite(stars.resize((SIZE * 2, SIZE * 2), Image.NEAREST), (8, 8))
    sheet.alpha_composite(nebula.resize((SIZE * 2, SIZE * 2), Image.NEAREST), (SIZE * 2 + 16, 8))
    sheet.save(PREVIEW / "rift.png")


main()

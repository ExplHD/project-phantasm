#!/usr/bin/env python3
"""Builds the Polaris boss model and textures.

The body and sword are the Forge Trooper's (same cubes, same UVs, palette swapped).
The halo, wing blades, pauldrons, coat and mask are new cubes with box UVs packed
into the free right-hand side of the 128x128 sheet.

Run from the project root:
    python3 tes/polaris/build.py            # writes into packs/RP
    python3 tes/polaris/build.py --preview  # also renders tes/polaris/preview/*.png

Change PALETTES or the cube lists below and re-run. Needs Pillow (and numpy for --preview).
"""
import copy
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / "packs" / "RP"
TROOPER_GEO = RP / "models/entity/entities/forge_trooper.geo.json"
TROOPER_TEX = RP / "textures/entity/forge_trooper/gold.png"
BAG_TEX = RP / "textures/items/loot_treasure/punicea_crimson_eye_treasure_bag.png"

OUT_GEO = RP / "models/entity/entities/polaris.geo.json"
OUT_NODE_GEO = RP / "models/entity/entities/polaris_node.geo.json"
OUT_TEX_DIR = RP / "textures/entity/polaris"
OUT_PARTICLE_DIR = RP / "textures/particle/polaris"
OUT_BAG = RP / "textures/items/loot_treasure/polaris_edge_treasure_bag.png"

SHEET = 128

# Forge Trooper palette, darkest to lightest.
SRC_GRAY = [(47, 40, 41), (49, 41, 42), (60, 50, 50), (59, 57, 59), (67, 64, 67),
            (76, 65, 67), (77, 73, 77), (91, 80, 82), (90, 87, 90)]
SRC_GOLD = [(146, 99, 0), (177, 120, 0), (231, 176, 3), (244, 211, 6), (252, 218, 12), (255, 228, 62)]

PALETTES = {
    # Mask, legs, sword hilt, halo frame.
    "dark": [(10, 12, 24), (11, 13, 26), (16, 19, 36), (20, 24, 44), (27, 32, 56),
             (31, 37, 64), (36, 43, 72), (46, 54, 88), (52, 62, 98)],
    # Coat: torso, arms, pauldrons.
    "white": [(84, 98, 128), (88, 102, 132), (112, 128, 158), (138, 154, 182), (168, 182, 206),
              (184, 197, 218), (200, 212, 230), (224, 232, 244), (240, 245, 252)],
    # Glow, phase one.
    "cyan": [(18, 92, 122), (24, 134, 160), (52, 196, 214), (110, 236, 240), (150, 244, 246), (214, 255, 252)],
    # Glow, phase two.
    "violet": [(74, 28, 128), (112, 48, 176), (168, 92, 236), (206, 150, 255), (222, 180, 255), (246, 226, 255)],
}

# Trooper UV islands that take the coat palette. Everything else is "dark".
WHITE_REGIONS = [
    (41, 0, 61, 19),   # right arm
    (0, 21, 30, 40),   # body
    (21, 41, 41, 60),  # left arm
    (0, 69, 40, 89),   # head overlay lines, read as silver trim on the mask
]


def strip_comments(text):
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


def load_json(path):
    return json.loads(strip_comments(path.read_text()))


# --------------------------------------------------------------------------- geometry

def box_island(size):
    w, h, d = (int(v) for v in size)
    return 2 * (w + d), d + h


class Packer:
    """Shelf packer for the free strip of the sheet (x from 72 to 128)."""

    def __init__(self, x0=72, y0=0, x1=128, y1=128):
        self.x0, self.x1, self.y1 = x0, x1, y1
        self.x, self.y, self.row = x0, y0, 0
        self.islands = {}

    def place(self, key, size):
        if key in self.islands:
            return self.islands[key]
        w, h = box_island(size)
        if self.x + w > self.x1:
            self.x, self.y, self.row = self.x0, self.y + self.row + 1, 0
        if self.y + h > self.y1:
            raise SystemExit(f"texture sheet is full, cannot place {key}")
        uv = (self.x, self.y)
        self.x += w + 1
        self.row = max(self.row, h)
        self.islands[key] = uv
        return uv


# name -> (size, style). Cubes that share a name share one UV island.
PARTS = {
    "pauldron": ((6, 4, 7), "pauldron"),
    "coat_back": ((5, 10, 1), "coat"),
    "coat_side": ((1, 8, 4), "coat"),
    "beak": ((2, 2, 3), "beak"),
    "fin": ((1, 4, 5), "fin"),
    "halo_segment": ((8, 2, 1), "halo"),
    "halo_hub": ((4, 4, 1), "hub"),
    "blade_15": ((2, 15, 1), "blade"),
    "blade_12": ((2, 12, 1), "blade"),
    "blade_9": ((2, 9, 1), "blade"),
    "blade_tip": ((1, 3, 1), "tip"),
}

HALO = (0, 27, 7)
BLADES = [("1", 30, 15), ("2", 62, 12), ("3", 96, 9)]

RENAME = {"rightArm": "right_arm", "leftArm": "left_arm", "rightLeg": "right_leg", "leftLeg": "left_leg",
          "crucibleahhsword": "sword"}
LOCATOR_RENAME = {"sweep_blade_tip": "blade_tip", "parry_guard": "blade_mid"}


def cube(part, origin, packer, pivot=None, rotation=None, mirror=False):
    size, _ = PARTS[part]
    entry = {"origin": list(origin), "size": list(size)}
    if pivot is not None:
        entry["pivot"] = list(pivot)
    if rotation is not None:
        entry["rotation"] = list(rotation)
    entry["uv"] = list(packer.place(part, size))
    if mirror:
        entry["mirror"] = True
    return entry


def build_geometry(packer):
    source = load_json(TROOPER_GEO)["minecraft:geometry"][0]
    bones = []
    for bone in copy.deepcopy(source["bones"]):
        if bone["name"] == "shield":
            continue
        bone["name"] = RENAME.get(bone["name"], bone["name"])
        if "parent" in bone:
            bone["parent"] = RENAME.get(bone["parent"], bone["parent"])
        if "locators" in bone:
            bone["locators"] = {LOCATOR_RENAME.get(k, k): v for k, v in bone["locators"].items()}
        bones.append(bone)
    by_name = {bone["name"]: bone for bone in bones}

    by_name["right_arm"]["cubes"].append(cube("pauldron", (-11, 25, -3.5), packer, pivot=(-8, 27, 0), rotation=(0, 0, -10)))
    by_name["left_arm"]["cubes"].append(cube("pauldron", (5, 25, -3.5), packer, pivot=(8, 27, 0), rotation=(0, 0, 10), mirror=True))
    by_name["head"]["cubes"].append(cube("beak", (-1, 29.5, -8), packer, pivot=(0, 31, -5), rotation=(14, 0, 0)))
    by_name["head"]["cubes"].append(cube("fin", (-6.4, 33, -1), packer, pivot=(-6, 33, -1), rotation=(-12, 0, 0)))
    by_name["head"]["cubes"].append(cube("fin", (5.4, 33, -1), packer, pivot=(6, 33, -1), rotation=(-12, 0, 0), mirror=True))

    bones.append({
        "name": "coat_back", "parent": "waist", "pivot": [0, 14, 2.5],
        "cubes": [
            cube("coat_back", (-5, 4, 2.5), packer, pivot=(-2.5, 14, 2.5), rotation=(-6, 0, -3)),
            cube("coat_back", (0, 4, 2.5), packer, pivot=(2.5, 14, 2.5), rotation=(-6, 0, 3), mirror=True),
        ],
    })
    bones.append({
        "name": "coat_right", "parent": "waist", "pivot": [-5, 14, 0],
        "cubes": [cube("coat_side", (-6, 6, -2), packer, pivot=(-5, 14, 0), rotation=(0, 0, -5))],
    })
    bones.append({
        "name": "coat_left", "parent": "waist", "pivot": [5, 14, 0],
        "cubes": [cube("coat_side", (5, 6, -2), packer, pivot=(5, 14, 0), rotation=(0, 0, 5), mirror=True)],
    })

    hx, hy, hz = HALO
    bones.append({"name": "halo", "parent": "body", "pivot": [hx, hy, hz], "locators": {"halo_core": [hx, hy, hz]}})
    bones.append({
        "name": "halo_ring", "parent": "halo", "pivot": [hx, hy, hz],
        "cubes": [cube("halo_segment", (-4, hy + 13, hz - 0.5), packer, pivot=HALO, rotation=(0, 0, 45 * k)) for k in range(8)],
    })
    bones.append({
        "name": "halo_hub", "parent": "halo", "pivot": [hx, hy, hz],
        "cubes": [cube("halo_hub", (-2, hy - 2, hz - 0.5), packer, pivot=HALO, rotation=(0, 0, 45))],
    })
    for side, sign in (("r", -1), ("l", 1)):
        for index, angle, length in BLADES:
            bones.append({
                "name": f"blade_{side}{index}", "parent": "halo", "pivot": [hx, hy, hz],
                "rotation": [0, 0, sign * angle],
                "cubes": [
                    cube(f"blade_{length}", (-1, hy + 17, hz - 0.5), packer, mirror=sign > 0),
                    cube("blade_tip", (-0.5, hy + 17 + length, hz - 0.5), packer),
                ],
                "locators": {f"blade_{side}{index}_tip": [0, hy + 20 + length, hz]},
            })

    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.polaris",
                "texture_width": SHEET,
                "texture_height": SHEET,
                "visible_bounds_width": 6,
                "visible_bounds_height": 5.5,
                "visible_bounds_offset": [0, 2.25, 0],
            },
            "bones": bones,
        }],
    }


def build_node_geometry():
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.polaris_node",
                "texture_width": 32,
                "texture_height": 32,
                "visible_bounds_width": 2,
                "visible_bounds_height": 2.5,
                "visible_bounds_offset": [0, 0.75, 0],
            },
            "bones": [
                {"name": "root", "pivot": [0, 0, 0], "locators": {"node_core": [0, 9, 0]}},
                {"name": "base", "parent": "root", "pivot": [0, 0, 0],
                 "cubes": [{"origin": [-3, 0, -3], "size": [6, 1, 6], "uv": [0, 0]}]},
                {"name": "crystal", "parent": "root", "pivot": [0, 9, 0],
                 "cubes": [{"origin": [-2, 5, -2], "size": [4, 8, 4], "uv": [0, 8]}]},
                {"name": "orbit", "parent": "root", "pivot": [0, 9, 0],
                 "cubes": [
                     {"origin": [-6, 8, -0.5], "size": [1, 2, 1], "uv": [0, 21]},
                     {"origin": [5, 8, -0.5], "size": [1, 2, 1], "uv": [0, 21]},
                     {"origin": [-0.5, 8, -6], "size": [1, 2, 1], "uv": [0, 21]},
                     {"origin": [-0.5, 8, 5], "size": [1, 2, 1], "uv": [0, 21]},
                 ]},
            ],
        }],
    }


def dump_geometry(geo):
    """Tabs, one cube per line, same shape as the hand-kept geo files."""
    text = json.dumps(geo, indent="\t")

    def collapse(match):
        inner = json.loads(match.group(0))
        return json.dumps(inner, separators=(", ", ": "))

    text = re.sub(r"\{\s*\"origin\"[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}", collapse, text)
    text = re.sub(r"\[\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]", r"[\1, \2, \3]", text)
    return text + "\n"


# --------------------------------------------------------------------------- textures

def face_rects(uv, size):
    """Box-UV face rectangles (x, y, w, h) in sheet pixels."""
    u, v = uv
    w, h, d = (int(s) for s in size)
    return {
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
    }


FACE_TONE = {"up": 7, "north": 6, "south": 5, "east": 4, "west": 4, "down": 2}


def fill(img, rect, color):
    x, y, w, h = rect
    for py in range(y, y + h):
        for px in range(x, x + w):
            img.putpixel((px, py), color + (255,))


def paint_part(img, uv, size, style, glow):
    dark, white = PALETTES["dark"], PALETTES["white"]
    rects = face_rects(uv, size)
    for face, rect in rects.items():
        x, y, w, h = rect
        tone = FACE_TONE[face]
        side = face in ("north", "south", "east", "west")

        if style in ("pauldron", "beak"):
            fill(img, rect, white[tone])
            if side:
                fill(img, (x, y + h - 1, w, 1), white[max(tone - 3, 0)])
            if style == "pauldron" and side and h >= 3:
                fill(img, (x, y + h - 2, w, 1), glow[3])
            if style == "pauldron" and face == "up":
                fill(img, (x + w // 2 - 1, y, 2, h), white[4])
            if style == "beak" and face == "north":
                fill(img, (x, y, w, h), white[3])

        elif style == "coat":
            fill(img, rect, white[tone])
            if side:
                fill(img, (x, y + h - 3, w, 3), dark[tone])
                fill(img, (x, y + h - 4, w, 1), white[max(tone - 3, 0)])
                for px in range(x, x + w):
                    if (px - x) % 2 == 0:
                        img.putpixel((px, y + h - 2), glow[3] + (255,))
                    else:
                        img.putpixel((px, y + h - 1), glow[2] + (255,))
                if w >= 4:
                    fill(img, (x + w - 1, y, 1, h - 4), white[max(tone - 2, 0)])

        elif style == "fin":
            fill(img, rect, dark[tone])
            if face in ("east", "west"):
                fill(img, (x + 1, y + 1, w - 2, 1), glow[3])
                fill(img, (x + 2, y + 2, max(w - 4, 1), 1), glow[1])

        elif style == "halo":
            fill(img, rect, dark[tone])
            if side:
                fill(img, (x, y + h - 1, w, 1), glow[4])
            if face == "down":
                fill(img, rect, glow[5])
            if face in ("north", "south") and w >= 4:
                img.putpixel((x, y), dark[1] + (255,))
                img.putpixel((x + w - 1, y), dark[1] + (255,))

        elif style == "hub":
            fill(img, rect, glow[3])
            if face in ("north", "south"):
                fill(img, (x + 1, y + 1, w - 2, h - 2), glow[5])
                fill(img, (x, y, 1, 1), glow[1])
                fill(img, (x + w - 1, y + h - 1, 1, 1), glow[1])

        elif style == "blade":
            if side:
                for row in range(h):
                    t = row / max(h - 1, 1)
                    color = glow[5] if t < 0.2 else glow[4] if t < 0.4 else glow[2] if t < 0.62 else dark[7] if t < 0.8 else dark[4]
                    fill(img, (x, y + row, w, 1), color)
                if w >= 2:
                    fill(img, (x, y + int(h * 0.4), 1, h - int(h * 0.4)), dark[2])
            else:
                fill(img, rect, glow[5] if face == "up" else dark[3])

        elif style == "tip":
            fill(img, rect, glow[5] if face != "down" else glow[3])


def recolor_trooper(source, glow):
    out = Image.new("RGBA", (SHEET, SHEET), (0, 0, 0, 0))
    gray_index = {color: i for i, color in enumerate(SRC_GRAY)}
    gold_index = {color: i for i, color in enumerate(SRC_GOLD)}
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = source.getpixel((x, y))
            if a == 0:
                continue
            rgb = (r, g, b)
            if rgb in gold_index:
                out.putpixel((x, y), glow[gold_index[rgb]] + (255,))
                continue
            if rgb not in gray_index:
                raise SystemExit(f"unexpected trooper colour {rgb} at {x},{y}")
            ramp = "white" if any(x0 <= x < x1 and y0 <= y < y1 for x0, y0, x1, y1 in WHITE_REGIONS) else "dark"
            out.putpixel((x, y), PALETTES[ramp][gray_index[rgb]] + (255,))
    return out


def build_color(glow_name, packer):
    glow = PALETTES[glow_name]
    img = recolor_trooper(Image.open(TROOPER_TEX).convert("RGBA"), glow)
    for part, (size, style) in PARTS.items():
        paint_part(img, packer.islands[part], size, style, glow)
    return img


def build_mer(color_p1):
    """R metalness, G emissive, B roughness."""
    glow = set(PALETTES["cyan"])
    white = set(PALETTES["white"])
    out = Image.new("RGBA", color_p1.size, (0, 0, 0, 255))
    for y in range(color_p1.height):
        for x in range(color_p1.width):
            r, g, b, a = color_p1.getpixel((x, y))
            if a == 0:
                continue
            rgb = (r, g, b)
            if rgb in glow:
                lum = (r + g + b) / 765
                out.putpixel((x, y), (40, int(110 + 145 * lum), 60, 255))
            elif rgb in white:
                out.putpixel((x, y), (90, 0, 150, 255))
            else:
                out.putpixel((x, y), (160, 0, 105, 255))
    return out


def build_hologram(color_p1):
    out = Image.new("RGBA", color_p1.size, (0, 0, 0, 0))
    for y in range(color_p1.height):
        for x in range(color_p1.width):
            r, g, b, a = color_p1.getpixel((x, y))
            if a == 0:
                continue
            lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
            alpha = 170 if y % 3 else 95
            out.putpixel((x, y), (int(40 + 120 * lum), int(150 + 105 * lum), 255, alpha))
    return out


def build_node_texture():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    dark, glow = PALETTES["dark"], PALETTES["violet"]
    for face, rect in face_rects((0, 0), (6, 1, 6)).items():
        fill(img, rect, dark[FACE_TONE[face]])
        if face == "up":
            x, y, w, h = rect
            fill(img, (x + 2, y + 2, 2, 2), glow[3])
    for face, rect in face_rects((0, 8), (4, 8, 4)).items():
        x, y, w, h = rect
        if face in ("up", "down"):
            fill(img, rect, glow[5])
            continue
        for row in range(h):
            fill(img, (x, y + row, w, 1), glow[min(5, 1 + (h - row) // 2)])
        fill(img, (x, y, 1, h), glow[2])
        fill(img, (x + w - 1, y, 1, h), glow[1])
    for face, rect in face_rects((0, 21), (1, 2, 1)).items():
        fill(img, rect, glow[4])
    return img


def build_particle_textures():
    OUT_PARTICLE_DIR.mkdir(parents=True, exist_ok=True)

    lane = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
    for step, alpha in enumerate([40, 120, 220, 255, 255, 220, 120, 40]):
        for along in range(8):
            lane.putpixel((step, along), (255, 255, 255, alpha))
            lane.putpixel((8 + along, step), (255, 255, 255, alpha))
    lane.save(OUT_PARTICLE_DIR / "lane.png")

    tile = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            if edge == 0:
                alpha = 255
            elif edge == 1:
                alpha = 150
            else:
                alpha = 70 if (x + y) % 4 == 0 else 38
            tile.putpixel((x, y), (255, 255, 255, alpha))
    tile.save(OUT_PARTICLE_DIR / "tile.png")

    size = 64
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    centre = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dist = ((x - centre) ** 2 + (y - centre) ** 2) ** 0.5 / centre
            if dist > 1:
                continue
            if dist > 0.93:
                alpha = 255
            elif dist > 0.86:
                alpha = 150
            elif dist > 0.7:
                alpha = int(70 * (dist - 0.7) / 0.16)
            else:
                alpha = 0
            if alpha:
                ring.putpixel((x, y), (255, 255, 255, alpha))
    ring.save(OUT_PARTICLE_DIR / "ring.png")

    glow = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            dist = ((x - 15.5) ** 2 + (y - 15.5) ** 2) ** 0.5 / 15.5
            if dist > 1:
                continue
            steps = [(0.22, 255), (0.4, 190), (0.58, 120), (0.78, 64), (1.0, 26)]
            alpha = next(a for limit, a in steps if dist <= limit)
            glow.putpixel((x, y), (255, 255, 255, alpha))
    glow.save(OUT_PARTICLE_DIR / "glow.png")

    spark = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    for i in range(1, 7):
        alpha = 255 if 2 <= i <= 5 else 130
        spark.putpixel((i, 3), (255, 255, 255, alpha))
        spark.putpixel((i, 4), (255, 255, 255, alpha))
        spark.putpixel((3, i), (255, 255, 255, alpha))
        spark.putpixel((4, i), (255, 255, 255, alpha))
    spark.save(OUT_PARTICLE_DIR / "spark.png")


def build_bag_icon():
    source = Image.open(BAG_TEX).convert("RGBA")
    out = Image.new("RGBA", source.size, (0, 0, 0, 0))
    white, glow, dark = PALETTES["white"], PALETTES["cyan"], PALETTES["dark"]
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = source.getpixel((x, y))
            if a == 0:
                continue
            lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
            if g > 150 and r > 180:
                color = glow[min(5, 2 + int(lum * 4))]
            elif r > 1.6 * max(g, b, 1):
                color = white[min(8, int(lum * 2.4 * 8))]
            else:
                color = dark[min(8, int(lum * 8))]
            out.putpixel((x, y), color + (a,))
    out.save(OUT_BAG)


def texture_set(color, mer):
    return json.dumps({
        "format_version": "1.16.100",
        "minecraft:texture_set": {"color": color, "metalness_emissive_roughness": mer},
    }, indent="\t") + "\n"


def main():
    packer = Packer()
    geo = build_geometry(packer)

    OUT_GEO.write_text(dump_geometry(geo))
    OUT_NODE_GEO.write_text(dump_geometry(build_node_geometry()))

    OUT_TEX_DIR.mkdir(parents=True, exist_ok=True)
    phase_one = build_color("cyan", packer)
    phase_one.save(OUT_TEX_DIR / "polaris.png")
    build_color("violet", packer).save(OUT_TEX_DIR / "polaris_phase_two.png")
    build_mer(phase_one).save(OUT_TEX_DIR / "polaris_mer.png")
    build_hologram(phase_one).save(OUT_TEX_DIR / "polaris_hologram.png")
    build_node_texture().save(OUT_TEX_DIR / "polaris_node.png")
    (OUT_TEX_DIR / "polaris.texture_set.json").write_text(texture_set("polaris", "polaris_mer"))
    (OUT_TEX_DIR / "polaris_phase_two.texture_set.json").write_text(texture_set("polaris_phase_two", "polaris_mer"))

    build_particle_textures()
    build_bag_icon()

    print(f"geometry: {OUT_GEO.relative_to(ROOT)} ({len(geo['minecraft:geometry'][0]['bones'])} bones)")
    print(f"textures: {OUT_TEX_DIR.relative_to(ROOT)}")
    for part, uv in packer.islands.items():
        print(f"  {part:14s} uv {uv} island {box_island(PARTS[part][0])}")

    if "--preview" in sys.argv:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import render
        render.render_previews(ROOT)


if __name__ == "__main__":
    main()

import json
import math
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
TEX = 128

G = (-6.0, 13.0)

GOLD_DEEP = (146, 99, 0)
GOLD_DARK = (190, 132, 8)
GOLD_MID = (236, 180, 22)
GOLD = (252, 214, 48)
GOLD_LIGHT = (255, 240, 142)
BLUE_DEEP = (18, 92, 122)
BLUE_DARK = (24, 134, 160)
BLUE_MID = (52, 196, 214)
BLUE = (110, 236, 240)
BLUE_LIGHT = (214, 255, 252)
NAVY_DARK = (16, 19, 36)
NAVY = (27, 32, 56)
NAVY_LIGHT = (46, 54, 88)

MER_GOLD = (150, 24, 96)
MER_GOLD_BRIGHT = (150, 70, 80)
MER_BLUE = (0, 215, 70)
MER_BLUE_CORE = (0, 255, 50)
MER_NAVY = (70, 0, 150)


class Packer:
    def __init__(self, size):
        self.size = size
        self.x = 0
        self.y = 0
        self.row = 0

    def place(self, w, h):
        if self.x + w > self.size:
            self.x = 0
            self.y += self.row
            self.row = 0
        if self.y + h > self.size:
            raise SystemExit("texture atlas full")
        pos = (self.x, self.y)
        self.x += w
        self.row = max(self.row, h)
        return pos


packer = Packer(TEX)
image = Image.new("RGBA", (TEX, TEX), (0, 0, 0, 0))
mer = Image.new("RGB", (TEX, TEX), (0, 0, 0))


def texel(v):
    return max(1, math.ceil(v - 1e-6))


def pick(material, face, i, j, w, h):
    last_i = i == w - 1 and w > 2
    last_j = j == h - 1 and h > 2
    if material == "blade":
        if face in ("east", "west"):
            if h >= 3 and (j == 0 or j == h - 1):
                return GOLD_LIGHT, MER_GOLD_BRIGHT
            mid = abs((j + 0.5) - h / 2) < 0.75
            if mid and h >= 3:
                return (BLUE_LIGHT if i % 4 == 1 else BLUE), MER_BLUE_CORE
            if h >= 4 and abs((j + 0.5) - h / 2) < 1.6:
                return GOLD_DARK, MER_GOLD
            return GOLD_MID, MER_GOLD
        if face in ("up", "down"):
            return GOLD_LIGHT, MER_GOLD_BRIGHT
        return GOLD, MER_GOLD_BRIGHT
    if material == "energy":
        mid = abs((j + 0.5) / h - 0.5) < 0.3
        return (BLUE_LIGHT if mid else BLUE_MID), MER_BLUE_CORE
    if material == "gold":
        if j == 0:
            return GOLD_LIGHT, MER_GOLD_BRIGHT
        if last_j or last_i:
            return GOLD_DARK, MER_GOLD
        return GOLD_MID, MER_GOLD
    if material == "star":
        cx, cy = (w - 1) / 2, (h - 1) / 2
        d = max(abs(i - cx), abs(j - cy))
        if d < 0.6:
            return BLUE_LIGHT, MER_BLUE_CORE
        if d < 1.6:
            return BLUE, MER_BLUE
        return GOLD, MER_GOLD_BRIGHT
    if material == "shard":
        if j == 0 or i == 0:
            return BLUE_LIGHT, MER_BLUE_CORE
        if last_j or last_i:
            return BLUE_DARK, MER_BLUE
        return BLUE_MID, MER_BLUE
    if material == "grip":
        if face in ("up", "down", "east", "west") and (i % 3 == 1 if face in ("up", "down") else i % 3 == 1):
            return GOLD_DARK, MER_GOLD
        if j == 0:
            return NAVY_LIGHT, MER_NAVY
        return (NAVY_DARK if last_j else NAVY), MER_NAVY
    return GOLD_DEEP, MER_GOLD


def paint(material, face, x0, y0, w, h):
    for j in range(h):
        for i in range(w):
            color, m = pick(material, face, i, j, w, h)
            image.putpixel((x0 + i, y0 + j), color + (255,))
            mer.putpixel((x0 + i, y0 + j), m)


def face_sizes(size):
    sx, sy, sz = size
    return {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy), "up": (sx, sz), "down": (sx, sz)}


uv_cache = {}


def make_uv(material, size, key):
    if key in uv_cache:
        return uv_cache[key]
    uv = {}
    for face, (fw, fh) in face_sizes(size).items():
        w, h = texel(fw), texel(fh)
        x, y = packer.place(w, h)
        paint(material, face, x, y, w, h)
        uv[face] = {"uv": [x, y], "uv_size": [w, h]}
        if face in ("up", "down"):
            uv[face] = {"uv": [x + w, y + h], "uv_size": [-w, -h]}
    uv_cache[key] = uv
    return uv


def cube(y, z, size, material, key, rotation=None, dx=0.0):
    center = (G[0] + dx, G[1] + y, z)
    c = {"origin": [round(center[i] - size[i] / 2, 4) for i in range(3)], "size": list(size), "uv": make_uv(material, size, key)}
    if rotation:
        c["pivot"] = [round(v, 4) for v in center]
        c["rotation"] = rotation
    return c


hilt = [
    cube(0, 3.75, (1.4, 1.4, 6.5), "grip", "grip"),
    cube(0, 7.6, (2.0, 2.0, 1.2), "gold", "pommel"),
    cube(0, 8.9, (1.2, 1.2, 1.4), "shard", "pommel_gem", [0, 0, 45]),
    cube(0, 0.1, (1.8, 2.4, 1.0), "gold", "collar"),
    cube(0, -1.4, (1.6, 13.0, 1.6), "gold", "guard"),
    cube(5.2, -2.6, (1.2, 3.0, 2.0), "gold", "guard_horn"),
    cube(-5.2, -2.6, (1.2, 3.0, 2.0), "gold", "guard_horn"),
    cube(7.4, -1.4, (1.0, 1.8, 1.0), "shard", "guard_tip"),
    cube(-7.4, -1.4, (1.0, 1.8, 1.0), "shard", "guard_tip"),
]

STAR_Z = -1.4
star = [
    cube(0, STAR_Z, (2.4, 3.4, 3.4), "star", "star"),
    cube(0, STAR_Z, (2.2, 3.4, 3.4), "star", "star_b", [45, 0, 0]),
]

BLADE_BASE = -4.6
BLADE_SEGMENTS = [(-5.0, -9.0, 3.0), (-9.0, -20.0, 4.4), (-20.0, -32.0, 3.6), (-32.0, -40.0, 2.8), (-40.0, -44.0, 1.8)]
TIP_SEGMENTS = [(-45.6, -49.0, 1.8), (-49.0, -52.0, 0.9)]
BLADE_TIP = -52.0

blade = []
for n, (a, b, h) in enumerate(BLADE_SEGMENTS):
    blade.append(cube(0, (a + b) / 2, (1.0, h, a - b), "blade", f"seg{n}"))
blade.append(cube(0, -24.0, (1.3, 0.8, 34.0), "energy", "fuller"))
blade.append(cube(2.5, -9.6, (1.2, 0.8, 2.4), "gold", "fin"))
blade.append(cube(-2.5, -9.6, (1.2, 0.8, 2.4), "gold", "fin"))

tip = [cube(0, (a + b) / 2, (1.0, h, a - b), "blade", f"tip{n}") for n, (a, b, h) in enumerate(TIP_SEGMENTS)]

shard_a = [
    cube(4.6, -12.0, (0.8, 1.6, 7.0), "shard", "shard_long", [-8, 0, 0]),
    cube(3.9, -19.0, (0.8, 1.0, 4.0), "shard", "shard_short", [-5, 0, 0]),
]
shard_b = [
    cube(-4.6, -12.0, (0.8, 1.6, 7.0), "shard", "shard_long", [8, 0, 0]),
    cube(-3.9, -19.0, (0.8, 1.0, 4.0), "shard", "shard_short", [5, 0, 0]),
]

P = [G[0], G[1], 0]


def at(y, z):
    return [G[0], G[1] + y, z]


weapon_bones = [
    {"name": "weapon_root", "parent": "rightArm", "pivot": P},
    {"name": "inter_hilt", "parent": "weapon_root", "pivot": P, "cubes": hilt},
    {"name": "inter_star", "parent": "weapon_root", "pivot": at(0, STAR_Z), "cubes": star},
    {"name": "inter_blade", "parent": "weapon_root", "pivot": at(0, BLADE_BASE), "cubes": blade,
     "locators": {"interstellaris_mid": at(0, -26.0), "interstellaris_tip": at(0, BLADE_TIP)}},
    {"name": "inter_tip", "parent": "inter_blade", "pivot": at(0, -45.6), "cubes": tip},
    {"name": "inter_shard_a", "parent": "inter_blade", "pivot": at(4.6, -12.0), "cubes": shard_a},
    {"name": "inter_shard_b", "parent": "inter_blade", "pivot": at(-4.6, -12.0), "cubes": shard_b},
]

skeleton = [
    {"name": "root", "pivot": [0, 0, 0]},
    {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
    {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
    {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0]},
    *weapon_bones,
    {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0]},
    {"name": "head", "parent": "body", "pivot": [0, 24, 0]},
    {"name": "cape", "parent": "body", "pivot": [0, 24, 2]},
    {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0]},
    {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0]},
    {"name": "particle", "parent": "root", "pivot": [0, 0, 0], "locators": {
        "interstellaris_1": {"offset": [0, 14, 0], "rotation": [180, 0, -70]},
        "interstellaris_2": {"offset": [0, 19, 0], "rotation": [180, 0, 77.5]},
        "interstellaris_3": [0, 14, 0],
        "interstellaris_sweep": [0, 15, 0],
        "interstellaris_ground": [0, 1, 0],
    }},
]

item_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.interstellaris", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 14, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.25, 0]},
        "bones": skeleton,
    }],
}

SCALE = 0.36
MID_Z = (BLADE_TIP + 9.6) / 2
BLOCK_CENTER = (0.0, 8.0, 0.0)


def block_cube(c):
    size = [round(s * SCALE, 4) for s in c["size"]]
    center = [c["origin"][i] + c["size"][i] / 2 for i in range(3)]
    src = (G[0], G[1], MID_Z)
    local = [(center[i] - src[i]) * SCALE + BLOCK_CENTER[i] for i in range(3)]
    out = {"origin": [round(local[i] - size[i] / 2, 4) for i in range(3)], "size": size, "uv": c["uv"]}
    if "rotation" in c:
        out["pivot"] = [round(v, 4) for v in local]
        out["rotation"] = c["rotation"]
    return out


block_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.ph.interstellaris_block", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": [
            {"name": "icon_tilt", "pivot": [0, 8, 0], "rotation": [0, 0, 45]},
            {"name": "icon_turn", "parent": "icon_tilt", "pivot": [0, 8, 0], "rotation": [0, 90, 0]},
            {"name": "weapon_root", "parent": "icon_turn", "pivot": list(BLOCK_CENTER),
             "cubes": [block_cube(c) for c in hilt + star + blade + tip + shard_a + shard_b]},
        ],
    }],
}


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


write_json(os.path.join(RP, "models", "entity", "items", "interstellaris.geo.json"), item_geo)
write_json(os.path.join(RP, "models", "blocks", "interstellaris.geo.json"), block_geo)
image.save(os.path.join(RP, "textures", "3ds", "interstellaris.png"))
mer.save(os.path.join(RP, "textures", "3ds", "interstellaris_mer.png"))
print("atlas used up to row", packer.y + packer.row)

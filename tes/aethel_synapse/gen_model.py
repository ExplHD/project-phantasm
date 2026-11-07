import json
import math
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
TEX = 64
PX = 1

C = (-6.0, 12.0, 0.0)

COPPER_DARK = (139, 74, 52)
COPPER_DEEP = (177, 96, 71)
COPPER_MID = (214, 123, 91)
COPPER_LIGHT = (227, 130, 108)
GOLD_DARK = (205, 146, 5)
GOLD_MID = (237, 182, 9)
GOLD = (252, 215, 32)
GOLD_LIGHT = (254, 243, 100)

MER_COPPER = (61, 0, 123)
MER_COPPER_DARK = (46, 0, 92)
MER_GOLD = (80, 84, 184)
MER_GOLD_BRIGHT = (90, 84, 203)


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
image = Image.new("RGBA", (TEX * PX, TEX * PX), (0, 0, 0, 0))
mer = Image.new("RGB", (TEX * PX, TEX * PX), (0, 0, 0))


def texel(v):
    return max(1, math.ceil(v - 1e-6))


def pick(material, face, i, j, w, h):
    edge_r = i == w - 1 and w > 2
    edge_b = j == h - 1 and h > 2
    if material == "copper":
        if j == 0 and h > 2:
            return COPPER_LIGHT, MER_COPPER
        if edge_b or edge_r:
            return COPPER_DEEP, MER_COPPER_DARK
        if w >= 4 and h >= 4 and (i == 1 or j == 1) and i < w - 1 and j < h - 1:
            return COPPER_MID, MER_COPPER
        return COPPER_LIGHT, MER_COPPER
    if material == "blade":
        if face in ("east", "west") and h >= 2:
            if j == 0 or j == h - 1:
                return (GOLD_LIGHT if h >= 4 else GOLD), MER_GOLD_BRIGHT
            if j == 1 or j == h - 2:
                return COPPER_LIGHT, MER_COPPER
            return COPPER_MID, MER_COPPER
        if face in ("up", "down"):
            return GOLD, MER_GOLD_BRIGHT
        return COPPER_DEEP, MER_COPPER_DARK
    if material == "energy":
        mid = abs((j + 0.5) / h - 0.5) < 0.3 or abs((i + 0.5) / w - 0.5) < 0.3
        return (GOLD_LIGHT if mid else GOLD), MER_GOLD_BRIGHT
    if material == "gold":
        if j == 0:
            return GOLD_LIGHT, MER_GOLD_BRIGHT
        if edge_b or edge_r:
            return GOLD_DARK, MER_GOLD
        return GOLD_MID, MER_GOLD
    if material == "core":
        cx, cy = (w - 1) / 2, (h - 1) / 2
        d = max(abs(i - cx), abs(j - cy))
        if d < 0.6:
            return GOLD_LIGHT, MER_GOLD_BRIGHT
        if i == 0 or j == 0 or i == w - 1 or j == h - 1:
            return COPPER_DEEP, MER_COPPER_DARK
        if d >= max(cx, cy) - 1.01:
            return GOLD, MER_GOLD_BRIGHT
        return COPPER_DARK, MER_COPPER_DARK
    return COPPER_LIGHT, MER_COPPER


def paint(material, face, x0, y0, w, h):
    for j in range(h):
        for i in range(w):
            color, m = pick(material, face, i, j, w, h)
            image.putpixel((x0 + i, y0 + j), color + (255,))
            mer.putpixel((x0 + i, y0 + j), m)


def face_sizes(size):
    sx, sy, sz = size
    return {
        "north": (sx, sy),
        "south": (sx, sy),
        "east": (sz, sy),
        "west": (sz, sy),
        "up": (sx, sz),
        "down": (sx, sz),
    }


uv_cache = {}


def make_uv(material, size, key=None):
    if key and key in uv_cache:
        return uv_cache[key]
    uv = {}
    for face, (fw, fh) in face_sizes(size).items():
        w, h = texel(fw), texel(fh)
        x, y = packer.place(w, h)
        paint(material, face, x * PX, y * PX, w * PX, h * PX)
        uv[face] = {"uv": [x, y], "uv_size": [w, h]}
        if face in ("up", "down"):
            uv[face] = {"uv": [x + w, y + h], "uv_size": [-w, -h]}
    if key:
        uv_cache[key] = uv
    return uv


def cube(center, size, material, key=None, rotation=None):
    origin = [round(center[i] - size[i] / 2, 4) for i in range(3)]
    c = {"origin": origin, "size": [round(s, 4) for s in size], "uv": make_uv(material, size, key)}
    if rotation:
        c["pivot"] = [round(v, 4) for v in center]
        c["rotation"] = rotation
    return c


BLADE_SEGMENTS = [(4.0, 6.0, 4.6), (6.0, 8.5, 6.0), (8.5, 11.0, 6.4), (11.0, 13.5, 5.6), (13.5, 16.0, 4.4), (16.0, 18.0, 3.0), (18.0, 19.6, 1.8), (19.6, 20.8, 0.8)]
BLADE_BASE = 3.4
BLADE_TIP = 20.8


def blade_cubes(sign):
    cx, cy, _ = C
    out = []
    out.append(cube((cx, cy, sign * 3.7), (2.2, 5.0, 0.6), "gold", "collar"))
    for n, (a, b, h) in enumerate(BLADE_SEGMENTS):
        mid = sign * (a + b) / 2
        out.append(cube((cx, cy, mid), (1.2, h, b - a), "blade", f"seg{n}"))
    out.append(cube((cx, cy, sign * 10.0), (1.4, 0.8, 10.0), "energy", "fuller"))
    out.append(cube((cx, cy + 3.3, sign * 6.0), (1.4, 0.6, 1.6), "gold", "fin"))
    out.append(cube((cx, cy - 3.3, sign * 6.0), (1.4, 0.6, 1.6), "gold", "fin"))
    return out


def core_cubes(center):
    cx, cy, cz = center
    out = [cube(center, (3.6, 3.6, 3.6), "core", "core")]
    for dx in (-1, 1):
        for dy in (-1, 1):
            for dz in (-1, 1):
                out.append(cube((cx + dx * 2.0, cy + dy * 2.0, cz + dz * 2.0), (1.2, 1.2, 1.2), "gold", "bracket"))
    return out


def skeleton_bones(binding):
    root = {"name": "root", "pivot": [0, 0, 0]}
    if binding:
        root["binding"] = "q.item_slot_to_bone_name(c.item_slot)"
    return [
        root,
        {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
        {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
        {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0]},
        {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0]},
    ]


core = core_cubes(C)
front = blade_cubes(-1)
back = blade_cubes(1)

orb_center = (11.5, 21.0, 1.0)
orb = core_cubes(orb_center)

TIP_FRONT = [C[0], C[1], -BLADE_TIP]
TIP_BACK = [C[0], C[1], BLADE_TIP]

right_bones = [
    {"name": "weapon_root", "parent": "rightArm", "pivot": list(C)},
    {"name": "aethel_spin", "parent": "weapon_root", "pivot": list(C),
     "locators": {"aethel_synapse_tip_front": TIP_FRONT, "aethel_synapse_tip_back": TIP_BACK, "aethel_synapse_core": list(C)}},
    {"name": "aethel_core", "parent": "aethel_spin", "pivot": list(C)},
    {"name": "aethel_blade_front", "parent": "aethel_spin", "pivot": [C[0], C[1], -BLADE_BASE]},
    {"name": "aethel_blade_back", "parent": "aethel_spin", "pivot": [C[0], C[1], BLADE_BASE]},
]


def with_cubes(bones, cubes_by_bone):
    out = []
    for b in bones:
        nb = dict(b)
        if b["name"] in cubes_by_bone:
            nb["cubes"] = cubes_by_bone[b["name"]]
        out.append(nb)
    return out


attachable_bones = skeleton_bones(True) + with_cubes(right_bones, {
    "aethel_core": core,
    "aethel_blade_front": front,
    "aethel_blade_back": back,
}) + [
    {"name": "left_aethel_orb", "parent": "body", "pivot": list(orb_center), "cubes": orb},
]

rig_bones = skeleton_bones(False) + right_bones

bounds = {"visible_bounds_width": 6, "visible_bounds_height": 4, "visible_bounds_offset": [0, 0.75, 0]}

item_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [
        {
            "description": {"identifier": "geometry.aethel_synapse", "texture_width": TEX, "texture_height": TEX, **bounds},
            "bones": attachable_bones,
        },
        {
            "description": {"identifier": "geometry.aethel_synapse_rig", "texture_width": TEX, "texture_height": TEX, **bounds},
            "bones": rig_bones,
        },
    ],
}

SCALE = 0.5
BLOCK_CENTER = (0.0, 8.0, 0.0)


def block_cube(c):
    size = [round(s * SCALE, 4) for s in c["size"]]
    center = [c["origin"][i] + c["size"][i] / 2 for i in range(3)]
    local = [(center[i] - C[i]) * SCALE + BLOCK_CENTER[i] for i in range(3)]
    out = {"origin": [round(local[i] - size[i] / 2, 4) for i in range(3)], "size": size, "uv": c["uv"]}
    if "rotation" in c:
        out["pivot"] = [round(v, 4) for v in local]
        out["rotation"] = c["rotation"]
    return out


block_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [
        {
            "description": {
                "identifier": "geometry.ph.aethel_synapse_block",
                "texture_width": TEX,
                "texture_height": TEX,
                "visible_bounds_width": 3,
                "visible_bounds_height": 3,
                "visible_bounds_offset": [0, 0.5, 0],
            },
            "bones": [
                {"name": "icon_tilt", "pivot": [0, 8, 0], "rotation": [0, 0, 45]},
                {"name": "icon_turn", "parent": "icon_tilt", "pivot": [0, 8, 0], "rotation": [0, 90, 0]},
                {"name": "weapon_root", "parent": "icon_turn", "pivot": list(BLOCK_CENTER),
                 "cubes": [block_cube(c) for c in core + front + back]},
            ],
        }
    ],
}


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


write_json(os.path.join(RP, "models", "entity", "items", "aethel_synapse.geo.json"), item_geo)
write_json(os.path.join(RP, "models", "blocks", "aethel_synapse.geo.json"), block_geo)
image.save(os.path.join(RP, "textures", "3ds", "aethel_synapse.png"))
mer.save(os.path.join(RP, "textures", "3ds", "aethel_synapse_mer.png"))
print("atlas used up to row", packer.y + packer.row)

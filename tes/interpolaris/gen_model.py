import json
import math
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
TEX = 64

FP_CENTER = (-6.0, 12.0, -8.0)
TP_CENTER = (13.0, 18.0, 0.0)
TP_PIVOT = (0.0, 18.0, 0.0)

VOID = (10, 6, 20)
VOID_LIGHT = (28, 14, 52)
PURPLE_DEEP = (58, 22, 112)
PURPLE_DARK = (92, 40, 166)
PURPLE = (150, 76, 238)
PURPLE_LIGHT = (208, 164, 255)
PURPLE_WHITE = (242, 228, 255)
BLUE_DARK = (22, 84, 168)
BLUE = (58, 168, 250)
BLUE_LIGHT = (164, 228, 255)
NAVY_DARK = (12, 15, 32)
NAVY = (20, 26, 52)

MER_VOID = (0, 0, 230)
MER_PURPLE = (0, 215, 70)
MER_PURPLE_CORE = (0, 255, 50)
MER_BLUE = (0, 235, 60)
MER_NAVY = (90, 0, 120)


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
    edge = i == 0 or j == 0 or i == w - 1 or j == h - 1
    cx, cy = (w - 1) / 2, (h - 1) / 2
    d = max(abs(i - cx), abs(j - cy))
    if material == "void":
        if d < 0.6:
            return PURPLE_WHITE, MER_PURPLE_CORE
        if d < 1.6:
            return PURPLE, MER_PURPLE
        if edge:
            return VOID, MER_VOID
        return VOID_LIGHT, MER_VOID
    if material == "eye":
        return (PURPLE_WHITE if d < 0.6 else PURPLE_LIGHT), MER_PURPLE_CORE
    if material == "ring":
        long = max(w, h)
        along = i if w >= h else j
        if long >= 3 and (along == 0 or along == long - 1):
            return BLUE_LIGHT, MER_BLUE
        if face in ("up", "down"):
            across = j if w >= h else i
            return (PURPLE_LIGHT if across == 0 else PURPLE), MER_PURPLE
        return PURPLE_DARK, MER_PURPLE
    if material == "frame":
        if face in ("up", "down"):
            return (BLUE_LIGHT if edge and w > 1 else BLUE), MER_BLUE
        if w > 1 and (i == 0 or i == w - 1):
            return (BLUE_LIGHT if j == 0 else BLUE), MER_BLUE
        if j == h - 1 and h > 1:
            return NAVY_DARK, MER_NAVY
        return (PURPLE_DEEP if d < 0.6 else NAVY), MER_NAVY
    if material == "shard":
        if i == 0 or j == 0:
            return PURPLE_LIGHT, MER_PURPLE_CORE
        return (PURPLE_DARK if edge else PURPLE), MER_PURPLE
    return BLUE_DARK, MER_BLUE


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


def cube(center, offset, size, material, key, rotation=None, pivot=None):
    mid = [center[i] + offset[i] for i in range(3)]
    c = {"origin": [round(mid[i] - size[i] / 2, 4) for i in range(3)], "size": list(size), "uv": make_uv(material, size, key)}
    if rotation:
        c["pivot"] = [round(v, 4) for v in (pivot or mid)]
        c["rotation"] = rotation
    return c


def catalyst(center, prefix, parent):
    c = list(center)
    core = [
        cube(center, (0, 0, 0), (3, 3, 3), "void", "core"),
        cube(center, (0, 0, 0), (2.6, 2.6, 2.6), "void", "core_b", [45, 0, 45]),
        cube(center, (0, 0, 0), (1.4, 3.6, 1.4), "eye", "eye", [0, 45, 0]),
    ]
    ring = []
    for turn in (0, 45):
        rot = [0, turn, 0] if turn else None
        ring.append(cube(center, (0, 0, 3.4), (7.6, 0.6, 0.8), "ring", "ring_x", rot, c))
        ring.append(cube(center, (0, 0, -3.4), (7.6, 0.6, 0.8), "ring", "ring_x", rot, c))
        ring.append(cube(center, (3.4, 0, 0), (0.8, 0.6, 6.0), "ring", "ring_z", rot, c))
        ring.append(cube(center, (-3.4, 0, 0), (0.8, 0.6, 6.0), "ring", "ring_z", rot, c))
    frame = []
    for s in (1, -1):
        frame.append(cube(center, (0, s * 3.7, 0), (2.4, 1.4, 2.4), "frame", "frame_a"))
        frame.append(cube(center, (0, s * 5.1, 0), (1.6, 1.4, 1.6), "frame", "frame_b"))
        frame.append(cube(center, (0, s * 6.5, 0), (0.8, 1.4, 0.8), "frame", "frame_c"))
    shards = []
    for n, height in enumerate((1.6, -1.2, 0.4)):
        a = math.radians(n * 120 + 20)
        shards.append(cube(center, (math.cos(a) * 5.4, height, math.sin(a) * 5.4), (0.9, 0.9, 0.9), "shard", "shard", [45, 0, 45]))
    return [
        {"name": f"{prefix}interp", "parent": parent, "pivot": c},
        {"name": f"{prefix}interp_core", "parent": f"{prefix}interp", "pivot": c, "cubes": core,
         "locators": {f"interp_{prefix[:2]}": c}},
        {"name": f"{prefix}interp_ring", "parent": f"{prefix}interp", "pivot": c, "cubes": ring},
        {"name": f"{prefix}interp_frame", "parent": f"{prefix}interp", "pivot": c, "cubes": frame},
        {"name": f"{prefix}interp_shards", "parent": f"{prefix}interp", "pivot": c, "cubes": shards},
    ]


fp = catalyst(FP_CENTER, "fp_", "weapon_root")
tp = catalyst(TP_CENTER, "tp_", "tp_interp_orbit")

skeleton = [
    {"name": "root", "pivot": [0, 0, 0]},
    {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
    {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
    {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0]},
    {"name": "weapon_root", "parent": "rightArm", "pivot": [-6, 12, 0]},
    *fp,
    {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0]},
    {"name": "tp_interp_orbit", "parent": "root", "pivot": list(TP_PIVOT)},
    *tp,
]

def strip(bones):
    return [{k: v for k, v in b.items() if k != "cubes"} for b in bones]


item_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.interpolaris", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 6, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.25, 0]},
        "bones": skeleton,
    }, {
        "description": {"identifier": "geometry.interpolaris_rig", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 6, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.25, 0]},
        "bones": strip(skeleton),
    }],
}

SCALE = 0.95
BLOCK_CENTER = (0.0, 8.0, 0.0)


def block_cube(c):
    size = [round(s * SCALE, 4) for s in c["size"]]
    center = [c["origin"][i] + c["size"][i] / 2 for i in range(3)]
    local = [(center[i] - FP_CENTER[i]) * SCALE + BLOCK_CENTER[i] for i in range(3)]
    out = {"origin": [round(local[i] - size[i] / 2, 4) for i in range(3)], "size": size, "uv": c["uv"]}
    if "rotation" in c:
        pivot = [(c["pivot"][i] - FP_CENTER[i]) * SCALE + BLOCK_CENTER[i] for i in range(3)]
        out["pivot"] = [round(v, 4) for v in pivot]
        out["rotation"] = c["rotation"]
    return out


block_cubes = [block_cube(c) for bone in fp for c in bone.get("cubes", [])]
block_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.ph.interpolaris_block", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": [
            {"name": "icon_tilt", "pivot": [0, 8, 0], "rotation": [18, 0, 22]},
            {"name": "weapon_root", "parent": "icon_tilt", "pivot": list(BLOCK_CENTER), "cubes": block_cubes},
        ],
    }],
}

source = json.load(open(os.path.join(RP, "models", "entity", "items", "rupture_blade.geo.json")))["minecraft:geometry"][0]
blade_bone = next(b for b in source["bones"] if b["name"] == "weapon_root")
TIP = blade_bone["locators"]["rupture_blade_tip"]


def sword_cube(c):
    out = dict(c)
    out["origin"] = [round(c["origin"][i] - TIP[i], 4) for i in range(3)]
    if "pivot" in c:
        out["pivot"] = [round(c["pivot"][i] - TIP[i], 4) for i in range(3)]
    return out


sword_geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.interpolaris_sword", "texture_width": source["description"]["texture_width"],
                        "texture_height": source["description"]["texture_height"],
                        "visible_bounds_width": 12, "visible_bounds_height": 40, "visible_bounds_offset": [0, 12, 0]},
        "bones": [
            {"name": "sword_fall", "pivot": [0, 0, 0]},
            {"name": "sword", "parent": "sword_fall", "pivot": [0, 0, 0], "rotation": [90, 0, 0],
             "cubes": [sword_cube(c) for c in blade_bone["cubes"]]},
        ],
    }],
}

RAMP = [VOID_LIGHT, PURPLE_DEEP, PURPLE_DARK, PURPLE, PURPLE_LIGHT, PURPLE_WHITE]


def purple(pixel):
    r, g, b, a = pixel
    if a == 0:
        return pixel
    t = (0.299 * r + 0.587 * g + 0.114 * b) / 255 * (len(RAMP) - 1)
    lo = min(int(t), len(RAMP) - 2)
    f = t - lo
    return tuple(round(RAMP[lo][i] + (RAMP[lo + 1][i] - RAMP[lo][i]) * f) for i in range(3)) + (a,)


blade_tex = Image.open(os.path.join(RP, "textures", "3ds", "rupture_blade.png")).convert("RGBA")
blade_tex.putdata([purple(p) for p in blade_tex.getdata()])


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


write_json(os.path.join(RP, "models", "entity", "items", "interpolaris.geo.json"), item_geo)
write_json(os.path.join(RP, "models", "blocks", "interpolaris.geo.json"), block_geo)
write_json(os.path.join(RP, "models", "entity", "entities", "interpolaris_sword.geo.json"), sword_geo)
write_json(os.path.join(RP, "textures", "3ds", "interpolaris.texture_set.json"), {
    "format_version": "1.16.100",
    "minecraft:texture_set": {"color": "interpolaris", "metalness_emissive_roughness": "interpolaris_mer"},
})
image.save(os.path.join(RP, "textures", "3ds", "interpolaris.png"))
mer.save(os.path.join(RP, "textures", "3ds", "interpolaris_mer.png"))
os.makedirs(os.path.join(RP, "textures", "entity", "interpolaris"), exist_ok=True)
blade_tex.save(os.path.join(RP, "textures", "entity", "interpolaris", "interpolaris_sword.png"))
print("atlas used up to row", packer.y + packer.row)

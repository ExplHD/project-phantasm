#!/usr/bin/env python3
"""Tiny software renderer for Bedrock geometry, used to eyeball the Polaris model and poses.

It follows Blockbench's reading of a Bedrock geo file (X flipped, X/Y rotations negated,
ZYX euler order, box UV and per-face UV), so a pose that looks right here should look
the same in Blockbench. It is a preview only: no Molang, no scale keyframes, no blending.

    python3 tes/polaris/render.py                      # rest pose sheet
    python3 tes/polaris/render.py animation.polaris.spin 0.5
"""
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FACE_SHADE = {"up": 1.0, "north": 0.86, "south": 0.74, "east": 0.66, "west": 0.66, "down": 0.5}


def load_json(path):
    return json.loads(re.sub(r"^\s*//.*$", "", Path(path).read_text(), flags=re.M))


def rot_matrix(rx, ry, rz):
    """three.js Euler order ZYX: R = Rz * Ry * Rx, degrees in."""
    x, y, z = (math.radians(a) for a in (rx, ry, rz))
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def affine(rotation=None, translation=(0, 0, 0)):
    m = np.eye(4)
    if rotation is not None:
        m[:3, :3] = rotation
    m[:3, 3] = translation
    return m


def pivot_transform(pivot, rotation, offset=(0, 0, 0)):
    px, py, pz = pivot
    move = (px + offset[0], py + offset[1], pz + offset[2])
    return affine(translation=move) @ affine(rot_matrix(*rotation)) @ affine(translation=(-px, -py, -pz))


def to_bb_point(p):
    return (-p[0], p[1], p[2])


def to_bb_rot(r):
    return (-r[0], -r[1], r[2])


def box_uv_faces(uv, size, mirror):
    u, v = uv
    w, h, d = (math.floor(s) for s in size)
    faces = {
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
        "up": (u + d + w, v + d, -w, -d),
        "down": (u + d + 2 * w, v, -w, d),
    }
    if mirror:
        east, west = faces["east"], faces["west"]
        faces["east"] = (west[0] + west[2], west[1], -west[2], west[3])
        faces["west"] = (east[0] + east[2], east[1], -east[2], east[3])
        for name in ("north", "south", "up", "down"):
            x, y, fw, fh = faces[name]
            faces[name] = (x + fw, y, -fw, fh)
    return faces


def cube_faces(cube):
    uv = cube.get("uv")
    if isinstance(uv, dict):
        return {name: (f["uv"][0], f["uv"][1], f["uv_size"][0], f["uv_size"][1]) for name, f in uv.items()}
    return box_uv_faces(uv, cube["size"], cube.get("mirror", False))


def face_corners(lo, hi):
    """Corner order: top-left, top-right, bottom-right, bottom-left as seen from outside."""
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    return {
        "north": [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        "south": [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        "east": [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
        "west": [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
        "up": [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
        "down": [(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)],
    }


def collect_quads(geo, pose=None):
    """Returns [(corners_world(4x3), (u, v, w, h), face_name)]. pose: {bone: {"rotation": [..], "position": [..]}}"""
    pose = pose or {}
    bones = geo["bones"]
    by_name = {b["name"]: b for b in bones}
    cache = {}

    def world(name):
        if name in cache:
            return cache[name]
        bone = by_name[name]
        rest = to_bb_rot(bone.get("rotation", (0, 0, 0)))
        anim = pose.get(name, {})
        arot = to_bb_rot(anim.get("rotation", (0, 0, 0)))
        apos = to_bb_point(anim.get("position", (0, 0, 0)))
        local = pivot_transform(to_bb_point(bone.get("pivot", (0, 0, 0))),
                                tuple(a + b for a, b in zip(rest, arot)), apos)
        parent = bone.get("parent")
        cache[name] = (world(parent) @ local) if parent else local
        return cache[name]

    quads = []
    for bone in bones:
        m_bone = world(bone["name"])
        for cube in bone.get("cubes", []):
            ox, oy, oz = cube["origin"]
            sx, sy, sz = cube["size"]
            inflate = cube.get("inflate", 0)
            lo = (-(ox + sx) - inflate, oy - inflate, oz - inflate)
            hi = (-ox + inflate, oy + sy + inflate, oz + sz + inflate)
            m = m_bone
            if "rotation" in cube:
                m = m @ pivot_transform(to_bb_point(cube.get("pivot", (0, 0, 0))), to_bb_rot(cube["rotation"]))
            faces = cube_faces(cube)
            for name, corners in face_corners(lo, hi).items():
                if name not in faces:
                    continue
                pts = np.array([m @ np.array([*c, 1.0]) for c in corners])[:, :3]
                quads.append((pts, faces[name], name))
    return quads


def render(geo, texture, pose=None, yaw=0.0, pitch=0.0, scale=12, size=(720, 780), centre=(0, 26, 0), background=(34, 36, 44, 255)):
    tex = np.asarray(texture.convert("RGBA"), dtype=np.float32)
    th, tw = tex.shape[:2]
    width, height = size
    color = np.zeros((height, width, 4), dtype=np.float32)
    color[:] = background
    depth = np.full((height, width), np.inf, dtype=np.float32)
    view = rot_matrix(pitch, 0, 0) @ rot_matrix(0, yaw, 0)
    centre = np.array(centre, dtype=np.float64)

    for pts, (u, v, fw, fh), name in collect_quads(geo, pose):
        cam = (pts - centre) @ view.T
        sx = width / 2 - cam[:, 0] * scale
        sy = height / 2 - cam[:, 1] * scale
        sz = cam[:, 2]
        normal = np.cross(cam[1] - cam[0], cam[3] - cam[0])
        length = np.linalg.norm(normal)
        shade = FACE_SHADE[name]
        if length > 1e-9:
            n = normal / length
            shade = 0.55 + 0.45 * abs(n[2]) * 0.6 + 0.18 * max(0.0, n[1])
        uvs = [(u, v), (u + fw, v), (u + fw, v + fh), (u, v + fh)]
        for tri in ((0, 1, 2), (0, 2, 3)):
            ax, ay, bx, by, cx, cy = sx[tri[0]], sy[tri[0]], sx[tri[1]], sy[tri[1]], sx[tri[2]], sy[tri[2]]
            det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(det) < 1e-9:
                continue
            x0, x1 = max(int(math.floor(min(ax, bx, cx))), 0), min(int(math.ceil(max(ax, bx, cx))), width - 1)
            y0, y1 = max(int(math.floor(min(ay, by, cy))), 0), min(int(math.ceil(max(ay, by, cy))), height - 1)
            if x0 > x1 or y0 > y1:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / det
            w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / det
            w2 = 1 - w0 - w1
            inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
            if not inside.any():
                continue
            z = w0 * sz[tri[0]] + w1 * sz[tri[1]] + w2 * sz[tri[2]]
            tu = w0 * uvs[tri[0]][0] + w1 * uvs[tri[1]][0] + w2 * uvs[tri[2]][0]
            tv = w0 * uvs[tri[0]][1] + w1 * uvs[tri[1]][1] + w2 * uvs[tri[2]][1]
            lo_u, hi_u = min(u, u + fw), max(u, u + fw)
            lo_v, hi_v = min(v, v + fh), max(v, v + fh)
            ix = np.clip(np.floor(np.clip(tu, lo_u, hi_u - 1e-4)).astype(int), 0, tw - 1)
            iy = np.clip(np.floor(np.clip(tv, lo_v, hi_v - 1e-4)).astype(int), 0, th - 1)
            texel = tex[iy, ix]
            region_depth = depth[y0:y1 + 1, x0:x1 + 1]
            visible = inside & (texel[..., 3] > 20) & (z < region_depth)
            if not visible.any():
                continue
            region = color[y0:y1 + 1, x0:x1 + 1]
            alpha = (texel[..., 3:4] / 255.0)
            shaded = np.concatenate([texel[..., :3] * shade, np.full_like(alpha, 255.0)], axis=-1)
            blended = shaded * alpha + region * (1 - alpha)
            blended[..., 3] = 255
            region[visible] = blended[visible]
            opaque = visible & (texel[..., 3] > 200)
            region_depth[opaque] = z[opaque]
    return Image.fromarray(np.clip(color, 0, 255).astype(np.uint8), "RGBA")


def sample_channel(channel, time):
    """Numeric keyframes only; linear between keys. Molang strings count as 0."""
    def vec(value):
        if isinstance(value, dict):
            value = value.get("post", value.get("pre", [0, 0, 0]))
        if isinstance(value, (int, float)):
            return [float(value)] * 3
        return [float(c) if isinstance(c, (int, float)) else 0.0 for c in value]

    if isinstance(channel, (list, int, float)):
        return vec(channel)
    keys = sorted((float(k), vec(v)) for k, v in channel.items())
    if time <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= time <= t1:
            f = (time - t0) / (t1 - t0) if t1 > t0 else 0
            return [a + (b - a) * f for a, b in zip(v0, v1)]
    return keys[-1][1]


def pose_at(animation, time):
    pose = {}
    for bone, channels in animation.get("bones", {}).items():
        entry = {}
        for key in ("rotation", "position"):
            if key in channels:
                entry[key] = sample_channel(channels[key], time)
        pose[bone] = entry
    return pose


def sheet(images, columns):
    w, h = images[0].size
    rows = (len(images) + columns - 1) // columns
    out = Image.new("RGBA", (w * columns, h * rows), (34, 36, 44, 255))
    for i, image in enumerate(images):
        out.paste(image, ((i % columns) * w, (i // columns) * h))
    return out


def render_previews(root):
    root = Path(root)
    rp = root / "packs/RP"
    geo = load_json(rp / "models/entity/entities/polaris.geo.json")["minecraft:geometry"][0]
    out_dir = root / "tes/polaris/preview"
    out_dir.mkdir(parents=True, exist_ok=True)
    views = [(0, 0), (35, -12), (180, 0), (90, 0)]
    for name in ("polaris", "polaris_phase_two", "polaris_hologram"):
        texture = Image.open(rp / f"textures/entity/polaris/{name}.png")
        frames = [render(geo, texture, yaw=yaw, pitch=pitch) for yaw, pitch in views]
        sheet(frames, 4).save(out_dir / f"{name}.png")
    print(f"previews: {out_dir.relative_to(root)}")


def main():
    root = Path(__file__).resolve().parents[2]
    if len(sys.argv) < 2:
        render_previews(root)
        return
    rp = root / "packs/RP"
    geo = load_json(rp / "models/entity/entities/polaris.geo.json")["minecraft:geometry"][0]
    texture = Image.open(rp / "textures/entity/polaris/polaris.png")
    animations = load_json(rp / "animations/entities/polaris.animation.json")["animations"]
    name = sys.argv[1]
    times = [float(t) for t in sys.argv[2:]] or [0.0]
    frames = [render(geo, texture, pose=pose_at(animations[name], t), yaw=30, pitch=-10, scale=9, size=(520, 620)) for t in times]
    out = root / "tes/polaris/preview" / f"{name.split('.')[-1]}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(frames, min(len(frames), 5)).save(out)
    print(out.relative_to(root))


if __name__ == "__main__":
    main()

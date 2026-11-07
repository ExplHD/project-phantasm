import json
import math
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image

geo_path, geo_id, tex_path, out_path = sys.argv[1:5]
skip = set(sys.argv[5].split(",")) if len(sys.argv) > 5 and sys.argv[5] else set()
anim = json.loads(sys.argv[6]) if len(sys.argv) > 6 else {}

geo = next(g for g in json.load(open(geo_path))["minecraft:geometry"] if g["description"]["identifier"] == geo_id)
tex = Image.open(tex_path).convert("RGBA")
tw = geo["description"]["texture_width"]
k = tex.size[0] / tw


def rot_matrix(r):
    x, y, z = [math.radians(v) for v in r]
    rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return rz @ ry @ rx


def bedrock_rot(r):
    return rot_matrix([-r[0], -r[1], r[2]])


bones = {b["name"]: b for b in geo["bones"]}


def chain(name):
    out = []
    while name:
        out.append(bones[name])
        name = bones[name].get("parent")
    return out


def transform(p, bone_name):
    for b in chain(bone_name):
        piv = np.array(b.get("pivot", [0, 0, 0]), dtype=float)
        rot = list(b.get("rotation", [0, 0, 0]))
        extra = anim.get(b["name"], {})
        if "rotation" in extra:
            rot = [rot[i] + extra["rotation"][i] for i in range(3)]
        scale = extra.get("scale", 1)
        p = (bedrock_rot(rot) @ ((p - piv) * scale)) + piv
        if "position" in extra:
            pos = extra["position"]
            p = p + np.array([pos[0], pos[1], pos[2]])
    return p


def face_color(uv):
    (u, v), (w, h) = uv["uv"], uv["uv_size"]
    x0, x1 = sorted([u * k, (u + w) * k])
    y0, y1 = sorted([v * k, (v + h) * k])
    region = np.array(tex.crop((int(x0), int(y0), max(int(x1), int(x0) + 1), max(int(y1), int(y0) + 1))))
    return region[..., :3].reshape(-1, 3).mean(axis=0) / 255


polys, colors = [], []
for b in geo["bones"]:
    if b["name"] in skip:
        continue
    for c in b.get("cubes", []):
        o = np.array(c["origin"], dtype=float)
        s = np.array(c["size"], dtype=float)
        corners = lambda dx, dy, dz: o + s * np.array([dx, dy, dz])
        faces = {
            "north": [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)],
            "south": [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
            "west": [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)],
            "east": [(1, 0, 0), (1, 0, 1), (1, 1, 1), (1, 1, 0)],
            "down": [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
            "up": [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)],
        }
        crot = c.get("rotation")
        for face, idx in faces.items():
            pts = []
            for d in idx:
                p = corners(*d)
                if crot:
                    piv = np.array(c["pivot"], dtype=float)
                    p = bedrock_rot(crot) @ (p - piv) + piv
                pts.append(transform(p, b["name"]))
            polys.append([(p[0], -p[2], p[1]) for p in pts])
            colors.append(face_color(c["uv"][face]))

views = [(20, -60), (0, 0)]
fig = plt.figure(figsize=(14, 6), facecolor="#202028")
allp = np.array([p for poly in polys for p in poly])
mid = (allp.max(0) + allp.min(0)) / 2
r = (allp.max(0) - allp.min(0)).max() / 2
for i, (el, az) in enumerate(views):
    ax = fig.add_subplot(1, len(views), i + 1, projection="3d")
    ax.set_facecolor("#202028")
    ax.add_collection3d(Poly3DCollection(polys, facecolors=colors, edgecolors=(0, 0, 0, 0.25), linewidths=0.3))
    ax.set_xlim(mid[0] - r, mid[0] + r)
    ax.set_ylim(mid[1] - r, mid[1] + r)
    ax.set_zlim(mid[2] - r, mid[2] + r)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(el, az)
    ax.set_axis_off()
plt.tight_layout()
plt.savefig(out_path, dpi=90, facecolor=fig.get_facecolor())

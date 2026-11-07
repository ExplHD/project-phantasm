import numpy as np
from PIL import Image
import os
W = H = 128
img = np.zeros((H, W, 4), np.float32)

def put(x0, y0, rgba):
    h, w = rgba.shape[:2]
    img[y0:y0 + h, x0:x0 + w] = rgba

def grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return (x + .5 - w / 2) / (w / 2), (y + .5 - h / 2) / (h / 2)

def colorize(a, core_w=.55):
    white = np.array([1, 1, 1]); gold = np.array([1, .78, .28])
    t = np.clip((a - core_w) / (1 - core_w), 0, 1)[..., None]
    rgb = gold * (1 - t) + white * t
    return np.concatenate([rgb, np.clip(a, 0, 1)[..., None]], -1)

x, y = grid(64, 64)
r = np.hypot(x, y)
glow = np.exp(-(r / .22) ** 2) * 1.0 + np.exp(-(r / .5) ** 2) * .35
vspike = np.exp(-(x / .035) ** 2) * np.clip(1 - np.abs(y), 0, 1) ** 1.6
hspike = np.exp(-(y / .03) ** 2) * np.clip(1 - np.abs(x) / .75, 0, 1) ** 2 * .85
d1 = (x + y) / np.sqrt(2); d2 = (x - y) / np.sqrt(2)
diag = (np.exp(-(d1 / .025) ** 2) * np.clip(1 - np.abs(d2) / .35, 0, 1) ** 2 + np.exp(-(d2 / .025) ** 2) * np.clip(1 - np.abs(d1) / .35, 0, 1) ** 2) * .35
a = np.clip(glow + vspike + hspike + diag, 0, 1.0)
a *= np.clip((1 - r) * 4, 0, 1) * 0 + np.clip((1.0 - np.maximum(np.abs(x), np.abs(y))) * 8, 0, 1)
put(0, 0, colorize(a))

ring = np.exp(-((r - .78) / .06) ** 2) + np.exp(-((r - .78) / .2) ** 2) * .25
ring *= np.clip((1 - r) * 10, 0, 1)
put(64, 0, np.concatenate([np.ones((64, 64, 3)), np.clip(ring, 0, 1)[..., None]], -1))

x, y = grid(16, 64)
ends = np.ones_like(y)
core = (np.exp(-(x / .16) ** 2) + np.exp(-(x / .45) ** 2) * .35) * ends
put(0, 64, np.concatenate([np.ones((64, 16, 3)), np.clip(core, 0, 1)[..., None]], -1))

x, y = grid(32, 64)
rng = np.random.default_rng(7)
yy = np.linspace(0, 1, 64)
wob = sum(rng.uniform(.025, .06) * np.sin(2 * np.pi * (k * yy + rng.uniform())) for k in (2, 3, 5, 7))
width = .42 + wob
gl = np.exp(-(x / width[:, None]) ** 2) * ends[:, :1] if False else np.exp(-(x / width[:, None]) ** 2)
gl *= np.clip((1 - np.abs(x)) * 6, 0, 1)
put(16, 64, np.concatenate([np.ones((64, 32, 3)), np.clip(gl, 0, 1)[..., None]], -1))

x, y = grid(16, 16)
r = np.hypot(x, y)
dot = np.exp(-(r / .35) ** 2) * np.clip((1 - r) * 4, 0, 1)
put(48, 64, np.concatenate([np.ones((16, 16, 3)), np.clip(dot, 0, 1)[..., None]], -1))

out = os.path.join(os.path.dirname(__file__), '../../packs/RP/textures/particle/auric_apex.png')
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA').save(out)
prev = Image.new('RGBA', (W, H), (20, 20, 28, 255))
prev.alpha_composite(Image.open(out))
prev.resize((512, 512), Image.NEAREST).save(os.path.join(os.path.dirname(__file__), 'atlas_preview.png'))

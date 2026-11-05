"""Rebuild the aura slash example from the pixelfx effect.

    python3 tes/build.py [path-to-pixelfx-checkout]

Renders the core and aura layers of melee/aura-slash with pixelfx, packs each into a vertical
64 x (64 * frames) flipbook strip in tes/textures, and writes tinted previews to tes/preview.
The effect source is copied to tes/source so it can be re-added to a pixelfx checkout.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PIXELFX = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / "pixelfx").resolve()
EFFECT = "melee/aura-slash"
SIZE = 64

# preview tints: (label, core rgb, aura rgb), same multiply the particle tinting does in game
TINTS = [
    ("white core, cyan aura", (1, 1, 1), (0.35, 0.85, 1)),
    ("red core, crimson aura", (1, 0.25, 0.2), (1, 0.2, 0.25)),
    ("gold core, amber aura", (1, 0.85, 0.35), (1, 0.6, 0.15)),
    ("violet core, white aura", (0.75, 0.4, 1), (0.9, 0.9, 1)),
]
BG = np.array([0.10, 0.10, 0.13])


def render_layer(layer: str, flip: bool, out: Path) -> list[Image.Image]:
    subprocess.run(
        ["node", "tools/render.mjs", EFFECT, "--sheet", "--opts", json.dumps({"layer": layer, "flip": flip}), "--out", str(out)],
        cwd=PIXELFX, check=True, stdout=subprocess.DEVNULL,
    )
    base = out / EFFECT
    meta = json.loads((base / "aura-slash.json").read_text())
    sheet = Image.open(base / "aura-slash.png").convert("RGBA")
    frames = meta["frames"] if isinstance(meta["frames"], list) else list(meta["frames"].values())
    crops = []
    for f in frames:
        r = f["frame"]
        crop = sheet.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
        assert crop.size == (SIZE, SIZE), crop.size
        crops.append(crop)
    return crops


def main() -> None:
    if not (PIXELFX / "tools/render.mjs").exists():
        sys.exit(f"no pixelfx checkout at {PIXELFX}")
    target = PIXELFX / "src/fx" / f"{EFFECT}.js"
    source = HERE / "source/aura-slash.js"
    if not target.exists():
        shutil.copy(source, target)

    # default strips bulge to the left and sweep top -> left -> bottom, like slash_effect_white_2;
    # the _mirror strips are the other hand, like slash_effect_white
    with tempfile.TemporaryDirectory() as tmp:
        core = render_layer("core", True, Path(tmp) / "core")
        aura = render_layer("aura", True, Path(tmp) / "aura")
        core_m = render_layer("core", False, Path(tmp) / "core_m")
        aura_m = render_layer("aura", False, Path(tmp) / "aura_m")

    used = [i for i in range(len(core)) if core[i].getbbox() or aura[i].getbbox()]
    last = min(used[-1] + 1, len(core) - 1)  # one empty frame at the end so it finishes on nothing
    keep = list(range(used[0], last + 1))

    (HERE / "textures").mkdir(exist_ok=True)
    for name, frames in (("aura_slash_core", core), ("aura_slash_aura", aura),
                         ("aura_slash_core_mirror", core_m), ("aura_slash_aura_mirror", aura_m)):
        strip = Image.new("RGBA", (SIZE, SIZE * len(keep)))
        for j, i in enumerate(keep):
            strip.paste(frames[i], (0, SIZE * j))
        strip.save(HERE / "textures" / f"{name}.png")

    core_px = np.asarray(Image.open(HERE / "textures/aura_slash_core.png")).astype(float) / 255
    aura_px = np.asarray(Image.open(HERE / "textures/aura_slash_aura.png")).astype(float) / 255
    n = len(keep)

    def frame(i, ct, at):
        c = core_px[i * SIZE:(i + 1) * SIZE]
        a = aura_px[i * SIZE:(i + 1) * SIZE]
        out = np.ones((SIZE, SIZE, 3)) * BG
        out += a[..., :3] * np.array(at) * a[..., 3:4]  # particles_add
        cut = (c[..., 3:4] > 0.5).astype(float)  # particles_alpha cutout
        return np.clip(out * (1 - cut) + c[..., :3] * np.array(ct) * cut, 0, 1)

    (HERE / "preview").mkdir(exist_ok=True)
    grid = np.concatenate([np.concatenate([frame(i, ct, at) for i in range(n)], axis=1) for _, ct, at in TINTS], axis=0)
    img = Image.fromarray((grid * 255).astype(np.uint8))
    img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(HERE / "preview/contact_tints.png")

    gif = []
    for i in list(range(n)) + [n - 1] * 6:
        row = np.concatenate([frame(i, ct, at) for _, ct, at in TINTS], axis=1)
        im = Image.fromarray((row * 255).astype(np.uint8))
        gif.append(im.resize((im.width * 6, im.height * 6), Image.NEAREST))
    gif[0].save(HERE / "preview/aura_slash.gif", save_all=True, append_images=gif[1:], duration=33, loop=0)

    print(f"{n} frames, strips {SIZE}x{SIZE * n}, lifetime {n / 30:.3f}s at 30 fps")


if __name__ == "__main__":
    main()

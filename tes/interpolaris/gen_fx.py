import json
import math
import os
import random
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
OUT = os.path.join(RP, "particles", "interpolaris")
TEX_DIR = os.path.join(RP, "textures", "particle", "interpolaris")
TEX = "textures/particle/interpolaris/"
AGE = "(v.particle_age/v.particle_lifetime)"

PURPLE = "964CEE"
PURPLE_LIGHT = "D0A4FF"
BLUE = "3AA8FA"
WHITE = "F2E4FF"


def write(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{name}.particle.json"), "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


def save(name, img):
    os.makedirs(TEX_DIR, exist_ok=True)
    img.save(os.path.join(TEX_DIR, f"{name}.png"))


def steps(a, levels=5):
    return round(max(0.0, min(1.0, a)) * levels) / levels


def textures():
    glow = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    void = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            d = math.hypot(x - 15.5, y - 15.5) / 15.5
            a = steps(max(0.0, 1 - d) ** 1.6, 6)
            if a > 0:
                glow.putpixel((x, y), (255, 255, 255, int(a * 255)))
            v = steps((1 - d) * 4, 4) if d < 1 else 0
            if v > 0:
                void.putpixel((x, y), (6, 2, 14, int(v * 255)))
    save("glow", glow)
    save("void", void)

    ring = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    for y in range(64):
        for x in range(64):
            d = math.hypot(x - 31.5, y - 31.5)
            a = steps(1 - abs(d - 27) / 3.5, 4)
            if a > 0:
                ring.putpixel((x, y), (255, 255, 255, int(a * 255)))
    save("ring", ring)

    spark = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    for y in range(8):
        for x in range(8):
            a = steps(1 - math.hypot(x - 3.5, y - 3.5) / 3.6, 3)
            if a > 0:
                spark.putpixel((x, y), (255, 255, 255, int(a * 255)))
    save("spark", spark)

    rng = random.Random(1140)
    noise = Image.new("RGBA", (16, 64), (0, 0, 0, 0))
    for frame in range(4):
        for y in range(16):
            for x in range(16):
                diamond = abs(x - 7.5) + abs(y - 7.5)
                if diamond > 7.6:
                    continue
                rim = diamond > 5.6
                if rim or rng.random() < 0.42:
                    a = 255 if rim else rng.choice((120, 190, 255))
                    noise.putpixel((x, frame * 16 + y), (255, 255, 255, a))
        shift = rng.randrange(3, 13)
        for x in range(16):
            noise.putpixel((x, frame * 16 + shift), noise.getpixel(((x + 3) % 16, frame * 16 + shift)))
    save("polar_noise", noise)


def effect(identifier, texture, components, material="particles_add"):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": identifier, "basic_render_parameters": {"material": material, "texture": TEX + texture}},
        "components": components}}


def square(expr):
    return [expr, expr]


def uv(w, h):
    return {"texture_width": w, "texture_height": h, "uv": [0, 0], "uv_size": [w, h]}


def once(count=1):
    return {
        "minecraft:emitter_rate_instant": {"num_particles": count},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    }


def still():
    return {"minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {}}


def init(*lines):
    return {"minecraft:emitter_initialization": {"creation_expression": "".join(lines)}}


def build():
    textures()

    write("interpolaris_glow", effect("ph:interpolaris_glow", "glow", {
        **init("v.size = v.size ?? 0.4;", "v.life = v.life ?? 0.25;"),
        **once(), "minecraft:emitter_shape_point": {}, **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_appearance_billboard": {"size": square(f"v.size*(0.7+0.3*math.sin({AGE}*180))"), "facing_camera_mode": "lookat_xyz", "uv": uv(32, 32)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": f"#00{WHITE}", "0.2": f"#FF{PURPLE_LIGHT}", "0.7": f"#C0{PURPLE}", "1.0": f"#00{BLUE}"}}},
    }))

    write("interpolaris_void", effect("ph:interpolaris_void", "void", {
        **init("v.size = v.size ?? 2;"),
        **once(), "minecraft:emitter_shape_point": {}, **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.42},
        "minecraft:particle_appearance_billboard": {"size": square(f"v.size*0.42*math.sin(math.sqrt({AGE})*180)"), "facing_camera_mode": "lookat_xyz", "uv": uv(32, 32)},
        "minecraft:particle_appearance_tinting": {"color": [1, 1, 1, 0.92]},
    }, material="particles_blend"))

    write("interpolaris_rim", effect("ph:interpolaris_rim", "ring", {
        **init("v.size = v.size ?? 2;"),
        **once(), "minecraft:emitter_shape_point": {}, **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.36},
        "minecraft:particle_appearance_billboard": {"size": square(f"v.size*(1.15-0.85*{AGE})"), "facing_camera_mode": "lookat_xyz", "uv": uv(64, 64)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": f"#00{BLUE}", "0.25": f"#FF{BLUE}", "0.75": f"#FF{PURPLE_LIGHT}", "1.0": f"#00{WHITE}"}}},
    }))

    write("interpolaris_shock", effect("ph:interpolaris_shock", "ring", {
        **init("v.size = v.size ?? 4;"),
        **once(), "minecraft:emitter_shape_point": {}, **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.4},
        "minecraft:particle_appearance_billboard": {"size": square(f"v.size*(0.15+0.85*math.sqrt({AGE}))"), "facing_camera_mode": "emitter_transform_xz", "uv": uv(64, 64)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": f"#FF{WHITE}", "0.3": f"#FF{PURPLE}", "1.0": f"#00{BLUE}"}}},
    }))

    mote_tint = {"color": {"interpolant": "v.particle_random_1", "gradient": {"0.0": f"#FF{WHITE}", "0.35": f"#FF{PURPLE_LIGHT}", "0.7": f"#FF{PURPLE}", "1.0": f"#FF{BLUE}"}}}
    streak = {"facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}, "uv": uv(8, 8)}

    write("interpolaris_implode", effect("ph:interpolaris_implode", "spark", {
        **init("v.size = v.size ?? 2;"),
        "minecraft:emitter_rate_instant": {"num_particles": "math.min(40, 10 + v.size * 5)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": "v.size", "surface_only": True, "direction": "inwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.22,0.32)"},
        "minecraft:particle_initial_speed": "v.size * 3.2",
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [f"0.05*(1-0.5*{AGE})", f"0.26*(1-0.5*{AGE})"], **streak},
        "minecraft:particle_appearance_tinting": mote_tint,
    }))

    write("interpolaris_burst", effect("ph:interpolaris_burst", "spark", {
        **init("v.size = v.size ?? 2;"),
        "minecraft:emitter_rate_instant": {"num_particles": "math.min(48, 10 + v.size * 7)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.3,0.55)"},
        "minecraft:particle_initial_speed": "v.size * math.random(2.4,4.2)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.4},
        "minecraft:particle_appearance_billboard": {"size": [f"0.06*(1-{AGE})", f"0.32*(1-{AGE})"], **streak},
        "minecraft:particle_appearance_tinting": mote_tint,
    }))

    write("interpolaris_shroud", effect("ph:interpolaris_shroud", "spark", {
        "minecraft:emitter_rate_instant": {"num_particles": 26},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"radius": 0.65, "plane_normal": [0, 1, 0], "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.28,0.5)"},
        "minecraft:particle_initial_speed": "math.random(3,7)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.2},
        "minecraft:particle_appearance_billboard": {"size": [f"0.05*(1-{AGE})", f"0.42*(1-{AGE})"], **streak},
        "minecraft:particle_appearance_tinting": mote_tint,
    }))

    write("interpolaris_mark", effect("ph:interpolaris_mark", "polar_noise", {
        **once(), "minecraft:emitter_shape_point": {}, **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.55},
        "minecraft:particle_appearance_billboard": {
            "size": square(f"0.26*math.min(1,{AGE}*8)*math.min(1,(1-{AGE})*8)"), "facing_camera_mode": "lookat_xyz",
            "uv": {"texture_width": 16, "texture_height": 64, "flipbook": {"base_UV": [0, 0], "size_UV": [16, 16], "step_UV": [0, 16], "frames_per_second": 14, "max_frame": 4, "loop": True}}},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": f"#FF{PURPLE_LIGHT}", "0.3": f"#FF{BLUE}", "0.6": f"#FF{PURPLE}", "1.0": f"#FF{BLUE}"}}},
    }))


def extra_textures():
    sigil = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    c = 31.5

    def dot(x, y, a=255):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < 64 and 0 <= y < 64 and sigil.getpixel((x, y))[3] < a:
            sigil.putpixel((x, y), (255, 255, 255, a))

    for step in range(720):
        t = math.radians(step / 2)
        dot(c + math.cos(t) * 30, c + math.sin(t) * 30)
        dot(c + math.cos(t) * 24.5, c + math.sin(t) * 24.5, 190)
    for k in range(24):
        t = math.radians(k * 15)
        for r in (26, 27.5):
            dot(c + math.cos(t) * r, c + math.sin(t) * r, 220 if k % 2 else 255)
    points = [(c + math.cos(math.radians(90 + k * 60)) * 21, c + math.sin(math.radians(90 + k * 60)) * 21) for k in range(6)]
    for start in (0, 1):
        tri = points[start::2]
        for a, b in zip(tri, tri[1:] + tri[:1]):
            for i in range(60):
                f = i / 59
                dot(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 200)
    for x, y in points:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                dot(x + dx, y + dy)
    save("sigil", sigil)

    flare = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            dx, dy = abs(x - 15.5), abs(y - 15.5)
            ray = max(0.0, 1 - min(dx, dy) / 1.2) * max(0.0, 1 - max(dx, dy) / 15.5)
            diag = max(0.0, 1 - abs(dx - dy) / 1.1) * max(0.0, 1 - math.hypot(dx, dy) / 9)
            core = max(0.0, 1 - math.hypot(dx, dy) / 5) ** 1.5
            a = steps(max(ray, diag * 0.6, core), 5)
            if a > 0:
                flare.putpixel((x, y), (255, 255, 255, int(a * 255)))
    save("flare", flare)

    rng = random.Random(9137)
    glitch = Image.new("RGBA", (32, 64), (0, 0, 0, 0))
    for frame in range(4):
        y0 = frame * 16
        for _ in range(7):
            h = rng.choice((1, 1, 2, 2, 3))
            y = rng.randrange(0, 16 - h + 1)
            x = rng.randrange(0, 20)
            w = rng.randrange(6, 32 - x + 1)
            a = rng.choice((150, 210, 255))
            for yy in range(y, y + h):
                for xx in range(x, x + w):
                    glitch.putpixel((xx, y0 + yy), (255, 255, 255, a))
        for _ in range(10):
            x, y = rng.randrange(0, 31), rng.randrange(0, 15)
            for yy in (y, y + 1):
                for xx in (x, x + 1):
                    glitch.putpixel((xx, y0 + yy), (255, 255, 255, 255))
    save("glitch", glitch)


def hashed(seed, freq=22):
    return f"math.abs(math.sin(math.floor(v.particle_age*{freq})*78.233+{seed}*437.1))"


def build_extra():
    extra_textures()
    age = "(v.particle_age/v.particle_lifetime)"
    band = "v.particle_random_2"

    write("interpolaris_laser", effect("ph:interpolaris_laser", "glow", {
        **init("v.length = v.length ?? 4;", "v.width = v.width ?? 1;", "v.life = v.life ?? 0.25;"),
        "minecraft:emitter_rate_instant": {"num_particles": "math.min(600, 12 + v.length * 24)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life"},
        "minecraft:particle_initialization": {"per_update_expression": "".join([
            "v.d = v.particle_random_1 * v.length;",
            f"v.ang = v.d * 280 + v.particle_age * 900 + ({band} > 0.81 ? 180 : 0);",
            f"v.rad = {band} > 0.62 ? 0.3 * v.width * (1 - 0.5 * {age}) : 0;",
            "v.show = v.particle_age >= v.particle_random_1 * 0.07 ? 1 : 0;",
        ])},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"v.dir.{a} * v.d + v.u.{a} * math.cos(v.ang) * v.rad + v.w.{a} * math.sin(v.ang) * v.rad" for a in "xyz"]},
        "minecraft:particle_appearance_billboard": {
            "size": square(f"v.show * ({band} < 0.4 ? 0.17 : ({band} < 0.62 ? 0.46 : 0.11)) * v.width * (1 - {age} * {age})"),
            "facing_camera_mode": "lookat_xyz", "uv": uv(32, 32)},
        "minecraft:particle_appearance_tinting": {"color": [
            f"{band} < 0.4 ? 0.95 : ({band} < 0.62 ? 0.23 : 0.69)",
            f"{band} < 0.4 ? 0.89 : ({band} < 0.62 ? 0.66 : 0.49)",
            f"{band} < 0.4 ? 1.0 : ({band} < 0.62 ? 0.98 : 1.0)",
            f"{band} < 0.4 ? 1.0 : ({band} < 0.62 ? 0.4 : 0.95)",
        ]},
    }))

    write("interpolaris_flare", effect("ph:interpolaris_flare", "flare", {
        **init("v.size = v.size ?? 1;"),
        **once(), "minecraft:emitter_shape_point": {}, **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.24},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0,45)", "rotation_rate": 220},
        "minecraft:particle_appearance_billboard": {"size": square(f"v.size*(0.4+0.6*math.sin(math.min(1,{age}*2.2)*90))*(1-{age}*{age})"), "facing_camera_mode": "lookat_xyz", "uv": uv(32, 32)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": age, "gradient": {"0.0": f"#FF{WHITE}", "0.4": f"#FF{PURPLE_LIGHT}", "1.0": f"#00{BLUE}"}}},
    }))

    write("interpolaris_sigil", effect("ph:interpolaris_sigil", "sigil", {
        **init("v.size = v.size ?? 0.7;"),
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_instant": {"num_particles": 2},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        **still(),
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.36},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0,60)", "rotation_rate": "v.particle_random_1 > 0.5 ? 260 : -380"},
        "minecraft:particle_appearance_billboard": {
            "size": square(f"v.size*(v.particle_random_1 > 0.5 ? 1 : 0.68)*(1.25-0.45*{age})*math.min(1,{age}*7)"),
            "facing_camera_mode": "lookat_xyz", "uv": uv(64, 64)},
        "minecraft:particle_appearance_tinting": {"color": [
            "v.particle_random_1 > 0.5 ? 0.23 : 0.82", "v.particle_random_1 > 0.5 ? 0.66 : 0.64", "1.0", f"(1-{age})*(1-{age})"]},
    }))

    write("interpolaris_cast_motes", effect("ph:interpolaris_cast_motes", "spark", {
        **init("v.size = v.size ?? 0.7;"),
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": "v.size", "surface_only": True, "direction": "inwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.16,0.24)"},
        "minecraft:particle_initial_speed": "v.size * 4.2",
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [f"0.035*(1+v.size)", f"0.18*v.size*(1-0.6*{age})"], "facing_camera_mode": "lookat_direction",
                                                    "direction": {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}, "uv": uv(8, 8)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": "v.particle_random_3", "gradient": {"0.0": f"#FF{WHITE}", "0.5": f"#FF{PURPLE_LIGHT}", "1.0": f"#FF{BLUE}"}}},
    }))

    seed_a = "(v.particle_random_1*13.1+v.particle_random_3*7.7)"
    seed_b = "(v.particle_random_2*11.3+v.particle_random_4*5.9)"
    seed_c = "(v.particle_random_3*9.7+v.particle_random_4*3.1)"
    pick = "v.particle_random_4"
    glitch_color = [
        f"{pick} < 0.33 ? 1.0 : ({pick} < 0.66 ? 0.31 : ({pick} < 0.85 ? 0.59 : 0.95))",
        f"{pick} < 0.33 ? 0.31 : ({pick} < 0.66 ? 0.91 : ({pick} < 0.85 ? 0.3 : 0.9))",
        f"{pick} < 0.33 ? 0.85 : ({pick} < 0.66 ? 1.0 : ({pick} < 0.85 ? 0.93 : 1.0))",
        f"{hashed(seed_c, 30)} > 0.28 ? 1 : 0",
    ]
    glitch_uv = {"texture_width": 32, "texture_height": 64, "flipbook": {"base_UV": [0, 0], "size_UV": [32, 16], "step_UV": [0, 16], "frames_per_second": 18, "max_frame": 4, "loop": True}}

    write("interpolaris_glitch", effect("ph:interpolaris_glitch", "glitch", {
        **init("v.size = v.size ?? 0.5;", "v.height = v.height ?? 1.8;", "v.life = v.life ?? 0.25;"),
        "minecraft:emitter_rate_steady": {"spawn_rate": 48, "max_particles": 24},
        "minecraft:emitter_lifetime_once": {"active_time": "v.life"},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.1,0.22)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"(v.particle_random_1-0.5)*2.4*v.size + ({hashed(seed_a)}-0.5)*0.7",
            f"v.particle_random_2*v.height + ({hashed(seed_b)}-0.5)*0.18",
            f"(v.particle_random_3-0.5)*2.4*v.size",
        ]},
        "minecraft:particle_appearance_billboard": {
            "size": [f"(0.18+math.abs(math.sin({seed_b}*91.3))*0.55)*(0.6+0.8*{hashed(seed_a)})", f"0.05+math.mod({pick}*7.3,1)*0.12"],
            "facing_camera_mode": "lookat_xyz", "uv": glitch_uv},
        "minecraft:particle_appearance_tinting": {"color": glitch_color},
    }))

    write("interpolaris_glitch_tear", effect("ph:interpolaris_glitch_tear", "glitch", {
        **init("v.size = v.size ?? 1;", "v.height = v.height ?? 1.8;"),
        "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.18,0.32)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"({hashed(seed_a, 16)}-0.5)*1.6*v.size",
            f"v.particle_random_2*v.height",
            f"(v.particle_random_3-0.5)*0.8*v.size",
        ]},
        "minecraft:particle_appearance_billboard": {
            "size": [f"v.size*(0.8+0.9*{hashed(seed_b, 16)})", f"0.04+math.mod({pick}*5.1,1)*0.16"],
            "facing_camera_mode": "lookat_xyz", "uv": glitch_uv},
        "minecraft:particle_appearance_tinting": {"color": glitch_color},
    }))


build()
build_extra()
for stale in ("interpolaris_beam.particle.json",):
    if os.path.exists(os.path.join(OUT, stale)):
        os.remove(os.path.join(OUT, stale))
if os.path.exists(os.path.join(TEX_DIR, "beam.png")):
    os.remove(os.path.join(TEX_DIR, "beam.png"))
print(sorted(os.listdir(OUT)), sorted(os.listdir(TEX_DIR)))

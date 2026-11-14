import json
import math
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
OUT = os.path.join(RP, "particles", "interstellaris")
TEX_DIR = os.path.join(RP, "textures", "particle", "interstellaris")
SRC = os.path.join(RP, "particles", "auric_photonizer")

AURA = [0.3, 0.86, 1.0, 1]
CORE = [1.0, 0.93, 0.62, 1]
MOTE = "textures/particle/aura_slash/aura_mote"
STAR = "textures/particle/interstellaris/stellaris_core"
CIRCLE = "textures/particle/circle_fade"
AGE = "v.particle_age/v.particle_lifetime"


def write(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{name}.particle.json"), "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


def star_texture():
    size = 32
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx, dy = abs(x - c), abs(y - c)
            d = math.hypot(dx, dy)
            ray = max(0.0, 1 - (dx * dy) / 3.2) * max(0.0, 1 - d / 15.5)
            diag = max(0.0, 1 - abs(dx - dy) / 1.6) * max(0.0, 1 - d / 8.5) * 0.7
            glow = max(0.0, 1 - d / 6.5) ** 2
            a = min(1.0, max(ray, diag) ** 1.4 + glow)
            a = round(a * 4) / 4
            if a > 0:
                img.putpixel((x, y), (255, 255, 255, int(a * 255)))
    os.makedirs(TEX_DIR, exist_ok=True)
    img.save(os.path.join(TEX_DIR, "stellaris_core.png"))


def slash(n):
    for suffix, tint in (("", AURA), ("_core", CORE)):
        data = json.load(open(os.path.join(SRC, f"auric_photonizer_attack_{n}{suffix}.particle.json")))
        text = json.dumps(data).replace("auric_photonizer", "interstellaris")
        data = json.loads(text)
        comps = data["particle_effect"]["components"]
        comps["minecraft:particle_appearance_tinting"] = {"color": tint}
        comps["minecraft:particle_appearance_billboard"]["size"] = [4.6, 4.6]
        write(f"interstellaris_attack_{n}{suffix}", data)


def effect(identifier, texture, components, material="particles_add", events=None):
    data = {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": identifier, "basic_render_parameters": {"material": material, "texture": texture}},
        "components": components}}
    if events:
        data["particle_effect"]["events"] = events
    return data


def mote_uv(glow=True):
    return {"texture_width": 16, "texture_height": 8, "uv": [0 if glow else 8, 0], "uv_size": [8, 8]}


def build():
    star_texture()
    for n in (1, 2, 3):
        slash(n)

    write("interstellaris_trail", effect("ph:interstellaris_trail", MOTE, {
        "minecraft:emitter_rate_steady": {"spawn_rate": 40, "max_particles": 20},
        "minecraft:emitter_lifetime_once": {"active_time": 0.25},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.16,0.26)"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": {"size": [f"0.15*(1-{AGE}*0.85)", f"0.15*(1-{AGE}*0.85)"], "facing_camera_mode": "lookat_xyz", "uv": mote_uv()},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": "#FFF6FFFF", "0.5": "#E06EECF0", "1.0": "#00186E9A"}}},
    }))

    write("interstellaris_sparks", effect("ph:interstellaris_sparks", MOTE, {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.1, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.2,0.4)"},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0,360)"},
        "minecraft:particle_initial_speed": "math.random(4,8)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -4, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_appearance_billboard": {"size": [f"0.05*(1-{AGE})", f"0.22*(1-{AGE})"], "facing_camera_mode": "lookat_direction",
                                                    "direction": {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}, "uv": mote_uv(False)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": "v.particle_random_1", "gradient": {"0.0": "#FFFFFFFF", "0.5": "#FF6EECF0", "1.0": "#FFFFD630"}}},
    }))

    write("interstellaris_sweep", effect("ph:interstellaris_sweep", "textures/particle/scimitar/scimitar_spin", {
        "minecraft:emitter_local_space": {"position": True, "rotation": True, "velocity": True},
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.45},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [f"6+4*math.min(1,{AGE}*3)", f"6+4*math.min(1,{AGE}*3)"], "facing_camera_mode": "emitter_transform_xz",
                                                    "uv": {"texture_width": 64, "texture_height": 384, "flipbook": {"base_UV": [64, 0], "size_UV": [-64, 64], "step_UV": [0, 64], "frames_per_second": 18, "max_frame": 6, "loop": True}}},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": "#00F6FFFF", "0.1": "#FFF6FFFF", "0.55": "#FF6EECF0", "1.0": "#00FFD630"}}},
    }))

    pulse = "(0.85+0.15*math.sin(v.particle_age*720))"
    write("interstellaris_core", effect("ph:interstellaris_core", STAR, {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.62},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [pulse, pulse], "facing_camera_mode": "lookat_xyz",
                                                    "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]}},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": "#006EECF0", "0.16": "#FFD6FFFC", "0.84": "#FFD6FFFC", "1.0": "#006EECF0"}}},
        "minecraft:emitter_lifetime_events": {"creation_event": "halo"},
    }, events={"halo": {"particle_effect": {"effect": "ph:interstellaris_core_halo", "type": "emitter"}}}))

    write("interstellaris_core_halo", effect("ph:interstellaris_core_halo", MOTE, {
        "minecraft:emitter_rate_instant": {"num_particles": 5},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.8, "surface_only": True, "direction": "inwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_initial_speed": 1.2,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [f"0.12*(1-{AGE})", f"0.12*(1-{AGE})"], "facing_camera_mode": "lookat_xyz", "uv": mote_uv()},
        "minecraft:particle_appearance_tinting": {"color": [1, 0.84, 0.19, 1]},
    }))

    write("interstellaris_nova", effect("ph:interstellaris_nova", MOTE, {
        "minecraft:emitter_initialization": {"creation_expression": "v.size = v.size ?? 3;"},
        "minecraft:emitter_rate_instant": {"num_particles": "math.min(60, 10 + v.size * 6)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.3,0.55)"},
        "minecraft:particle_initial_speed": "v.size * math.random(2.2,3.6)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.2},
        "minecraft:particle_appearance_billboard": {"size": [f"0.06*(1-{AGE})", f"0.3*(1-{AGE})"], "facing_camera_mode": "lookat_direction",
                                                    "direction": {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}, "uv": mote_uv(False)},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": "v.particle_random_1", "gradient": {"0.0": "#FFFFFFFF", "0.45": "#FF6EECF0", "1.0": "#FFFFD630"}}},
    }))

    write("interstellaris_forcefield", effect("ph:interstellaris_forcefield", MOTE, {
        "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"offset": [0, 1, 0], "radius": 1.35, "surface_only": True, "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.62},
        "minecraft:particle_initial_speed": 0.35,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [f"0.09*math.sin({AGE}*180)", f"0.09*math.sin({AGE}*180)"], "facing_camera_mode": "lookat_xyz", "uv": mote_uv()},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": "v.particle_random_1", "gradient": {"0.0": "#FFD6FFFC", "0.7": "#FF6EECF0", "1.0": "#FFFFD630"}}},
        "minecraft:emitter_lifetime_events": {"creation_event": "shell"},
    }, events={"shell": {"particle_effect": {"effect": "ph:interstellaris_forcefield_shell", "type": "emitter"}}}))

    write("interstellaris_forcefield_shell", effect("ph:interstellaris_forcefield_shell", CIRCLE, {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.62},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [1.5, 1.5], "facing_camera_mode": "lookat_xyz",
                                                    "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]}},
        "minecraft:particle_appearance_tinting": {"color": [0.3, 0.86, 1.0, f"0.22*math.sin({AGE}*180)"]},
    }))

    write("interstellaris_missile", effect("ph:interstellaris_missile", STAR, {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.14},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0,90)"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {"size": [0.42, 0.42], "facing_camera_mode": "lookat_xyz",
                                                    "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]}},
        "minecraft:particle_appearance_tinting": {"color": [1, 0.95, 0.7, f"1-{AGE}"]},
        "minecraft:emitter_lifetime_events": {"creation_event": "trail"},
    }, events={"trail": {"particle_effect": {"effect": "ph:interstellaris_missile_trail", "type": "emitter"}}}))

    write("interstellaris_missile_trail", effect("ph:interstellaris_missile_trail", MOTE, {
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.12, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25,0.45)"},
        "minecraft:particle_initial_speed": 0.3,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1},
        "minecraft:particle_appearance_billboard": {"size": [f"0.12*(1-{AGE})", f"0.12*(1-{AGE})"], "facing_camera_mode": "lookat_xyz", "uv": mote_uv()},
        "minecraft:particle_appearance_tinting": {"color": {"interpolant": AGE, "gradient": {"0.0": "#FFF6FFFF", "0.4": "#FF6EECF0", "1.0": "#00186E9A"}}},
    }))


build()
print(sorted(os.listdir(OUT)))

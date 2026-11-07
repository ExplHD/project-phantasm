import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
SRC = os.path.join(RP, "particles", "rupture_blade")
OUT = os.path.join(RP, "particles", "aethel_synapse")

SPARK_GRADIENT = {"0.0": "#FFFFFBC8", "0.5": "#FFFEE164", "1.0": "#FFEDB609"}
TRAIL_GRADIENT = {"0.0": "#FFFFF6B4", "0.4": "#E6FCD720", "1.0": "#00CD9205"}


def load(path):
    with open(path) as f:
        return json.load(f)


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


def particle(identifier, texture, components, material="particles_add", events=None):
    effect = {
        "description": {
            "identifier": identifier,
            "basic_render_parameters": {"material": material, "texture": texture},
        },
        "components": components,
    }
    if events:
        effect["events"] = events
    return {"format_version": "1.10.0", "particle_effect": effect}


def copy_fx():
    for name, gradient in (("sparks", SPARK_GRADIENT), ("trail", TRAIL_GRADIENT)):
        data = load(os.path.join(SRC, f"rupture_blade_{name}.particle.json"))
        data["particle_effect"]["description"]["identifier"] = f"ph:aethel_synapse_{name}"
        data["particle_effect"]["components"]["minecraft:particle_appearance_tinting"]["color"]["gradient"] = gradient
        write(os.path.join(OUT, f"aethel_synapse_{name}.particle.json"), data)


ATLAS = "textures/particle/auric_apex"


def atlas_uv(u, v, w, h):
    return {"texture_width": 128, "texture_height": 128, "uv": [u, v], "uv_size": [w, h]}


def custom_particles():
    write(os.path.join(OUT, "aethel_synapse_guard.particle.json"), particle("ph:aethel_synapse_guard", ATLAS, {
        "minecraft:emitter_local_space": {"position": True, "rotation": True},
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {
            "size": [
                "0.95 + 0.15 * (v.particle_age / v.particle_lifetime)",
                "0.95 + 0.15 * (v.particle_age / v.particle_lifetime)",
            ],
            "facing_camera_mode": "emitter_transform_xz",
            "uv": atlas_uv(64, 0, 64, 64),
        },
        "minecraft:particle_appearance_tinting": {
            "color": {
                "interpolant": "v.particle_age / v.particle_lifetime",
                "gradient": {"0.0": "#00FEF364", "0.3": "#B4FCD720", "1.0": "#00EDB609"},
            }
        },
    }))

    for name, size, life, gradient in (
        ("laser", 0.14, 0.35, {"0.0": "#FFFFFFFF", "0.4": "#FFFEF364", "1.0": "#00EDB609"}),
        ("laser_glow", 0.34, 0.45, {"0.0": "#B4FCD720", "0.5": "#78EDB609", "1.0": "#00CD9205"}),
    ):
        write(os.path.join(OUT, f"aethel_synapse_{name}.particle.json"), particle(f"ph:aethel_synapse_{name}", "textures/particle/circle_fade", {
            "minecraft:emitter_rate_instant": {"num_particles": 1},
            "minecraft:emitter_lifetime_once": {"active_time": 0.05},
            "minecraft:emitter_shape_point": {},
            "minecraft:particle_lifetime_expression": {"max_lifetime": life},
            "minecraft:particle_initial_speed": 0,
            "minecraft:particle_motion_dynamic": {},
            "minecraft:particle_appearance_billboard": {
                "size": [
                    f"{size} * (1 - v.particle_age / v.particle_lifetime)",
                    f"{size} * (1 - v.particle_age / v.particle_lifetime)",
                ],
                "facing_camera_mode": "rotate_xyz",
                "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]},
            },
            "minecraft:particle_appearance_tinting": {
                "color": {"interpolant": "v.particle_age / v.particle_lifetime", "gradient": gradient}
            },
        }))

    write(os.path.join(OUT, "aethel_synapse_charge.particle.json"), particle("ph:aethel_synapse_charge", ATLAS, {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.8)"},
        "minecraft:particle_initial_speed": "math.random(0.8, 1.6)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": [
                "0.09 * (1 - v.particle_age / v.particle_lifetime)",
                "0.09 * (1 - v.particle_age / v.particle_lifetime)",
            ],
            "facing_camera_mode": "rotate_xyz",
            "uv": atlas_uv(48, 64, 16, 16),
        },
        "minecraft:particle_appearance_tinting": {
            "color": {
                "interpolant": "v.particle_random_1",
                "gradient": {"0.0": "#FFFEF364", "1.0": "#FFEDB609"},
            }
        },
    }))


ANIM_OUT = os.path.join(RP, "animations", "weapons", "aethel_synapse.animation.json")


def build_animations():
    out = {}
    out["animation.aethel_synapse.idle"] = {
        "loop": True,
        "bones": {
            "aethel_core": {"scale": "1 + math.sin(q.life_time * 240) * 0.08"},
            "aethel_blade_front": {
                "position": [0, "math.sin(q.life_time * 150) * 0.35", "-0.3 - math.sin(q.life_time * 110) * 0.4"],
                "rotation": [0, 0, "math.sin(q.life_time * 90) * 4"],
            },
            "aethel_blade_back": {
                "position": [0, "math.sin(q.life_time * 150 + 120) * 0.35", "0.3 + math.sin(q.life_time * 110 + 120) * 0.4"],
                "rotation": [0, 0, "math.sin(q.life_time * 90 + 120) * 4"],
            },
        },
    }

    out["animation.aethel_synapse.guard"] = {
        "loop": True,
        "animation_length": 0.5,
        "bones": {
            "rightArm": {"rotation": ["-82 * (1 - v.is_first_person)", "-12 * (1 - v.is_first_person)", "8 * (1 - v.is_first_person)"]},
            "leftArm": {"rotation": ["-35 * (1 - v.is_first_person)", "20 * (1 - v.is_first_person)", 0]},
            "aethel_spin": {"rotation": [0, "q.anim_time * 1440", 0]},
            "aethel_core": {"scale": "1.18 + math.sin(q.life_time * 720) * 0.06"},
        },
        "particle_effects": {
            "0.0": [
                {"effect": "aethel_synapse_guard", "locator": "aethel_synapse_core"},
                {"effect": "aethel_synapse_trail", "locator": "aethel_synapse_tip_front"},
                {"effect": "aethel_synapse_trail", "locator": "aethel_synapse_tip_back"},
            ],
            "0.25": [
                {"effect": "aethel_synapse_trail", "locator": "aethel_synapse_tip_front"},
                {"effect": "aethel_synapse_trail", "locator": "aethel_synapse_tip_back"},
            ],
        },
    }
    write(ANIM_OUT, {"format_version": "1.8.0", "animations": out})


ATTACHABLE_ANIM_OUT = os.path.join(RP, "animations", "weapons", "aethel_synapse_item.animation.json")


def build_item_animations():
    write(ATTACHABLE_ANIM_OUT, {
        "format_version": "1.8.0",
        "animations": {
            "animation.aethel_synapse.orb": {
                "loop": True,
                "bones": {
                    "left_aethel_orb": {
                        "rotation": ["q.life_time * 40", "q.life_time * 90", 0],
                        "position": [0, "math.sin(q.life_time * 180) * 0.5", 0],
                        "scale": "1.1 + math.sin(q.life_time * 240) * 0.1",
                    },
                },
            }
        },
    })


copy_fx()
custom_particles()
build_animations()
build_item_animations()
print("ok")

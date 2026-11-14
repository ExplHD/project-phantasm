import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ANIM = os.path.join(ROOT, "packs", "RP", "animations", "weapons")
TP = "(1-v.is_first_person)"

source = json.load(open(os.path.join(ANIM, "auric_photonizer.animation.json")))["animations"]


def borrowed(n):
    text = json.dumps(source[f"animation.auric_photonizer.attack_{n}"])
    text = text.replace('"auricph5"', '"interstellaris_tip"').replace("auric_photonizer", "interstellaris")
    return json.loads(text)


def cat(keys):
    return {t: {"post": v, "lerp_mode": "catmullrom"} for t, v in keys.items()}


def uniform(keys):
    return {t: [v, v, v] for t, v in keys.items()}


def tp(v):
    return [f"{x}*{TP}" if x else 0 for x in v]


def fx(effect, locator=None):
    out = {"effect": effect}
    if locator:
        out["locator"] = locator
    return out


TRAIL = fx("interstellaris_trail", "interstellaris_tip")
SPARKS = fx("interstellaris_sparks", "interstellaris_tip")
Z = [0, 0, 0]
ONE = [1, 1, 1]

attack_4 = {
    "animation_length": 1.25,
    "override_previous_animation": True,
    "bones": {
        "root": {
            "rotation": {
                "0.0": Z,
                "0.2083": tp([0, 30, 0]),
                "0.2917": tp([0, 10, 0]),
                "0.375": tp([0, -110, 0]),
                "0.4583": tp([0, -230, 0]),
                "0.5417": tp([0, -325, 0]),
                "0.625": tp([0, -368, 0]),
                "0.75": tp([0, -360, 0]),
                "1.25": tp([0, -360, 0]),
            },
            "scale": {
                "0.0": ONE,
                "0.125": [f"1+0.035*{TP}", f"1-0.04*{TP}", f"1+0.035*{TP}"],
                "0.2917": [f"1-0.015*{TP}", f"1+0.03*{TP}", f"1-0.015*{TP}"],
                "0.625": [f"1+0.02*{TP}", f"1-0.025*{TP}", f"1+0.02*{TP}"],
                "0.75": ONE,
                "1.25": ONE,
            },
        },
        "waist": {"rotation": cat({"0.0": Z, "0.2083": [6, 22, 0], "0.375": [4, -14, 3], "0.625": [8, -20, 4], "0.75": [6, -9, 2], "1.0": [3, -4, 1], "1.25": Z})},
        "body": {"rotation": {"0.0": Z, "0.25": tp([0, 8, 0]), "0.4167": tp([0, -9, 0]), "0.6667": tp([0, -11, 0]), "0.7917": tp([0, -5, 0]), "1.25": Z}},
        "head": {"rotation": cat({"0.0": Z, "0.2083": [0, -18, 0], "0.4167": [2, 12, 0], "0.6667": [4, 20, 0], "0.8333": [2, 8, 0], "1.25": Z})},
        "rightArm": {
            "rotation": cat({"0.0": Z, "0.125": [-50, 35, 62], "0.2083": [-58, 48, 74], "0.2917": [-30, 10, 84], "0.375": [-12, -8, 88], "0.625": [-8, -26, 86], "0.75": [-14, -20, 72], "1.0": [-10, -8, 30], "1.25": Z}),
            "position": cat({"0.0": Z, "0.2083": [0.6, 0.4, 0], "0.375": [-0.9, 0.2, 0], "0.625": [-0.7, 0, 0], "0.75": [-0.3, 0, 0], "1.25": Z}),
        },
        "leftArm": {"rotation": cat({"0.0": Z, "0.2083": [-30, 20, -24], "0.375": [18, 0, -58], "0.625": [26, 0, -64], "0.7917": [14, 0, -34], "1.0": [5, 0, -10], "1.25": Z})},
        "rightLeg": {"rotation": cat({"0.0": Z, "0.2083": [10, 0, 4], "0.375": [-14, 0, 6], "0.625": [-18, 0, 8], "0.75": [-10, 0, 4], "1.25": Z})},
        "leftLeg": {"rotation": cat({"0.0": Z, "0.2083": [-8, 0, -3], "0.375": [12, 0, -5], "0.625": [16, 0, -7], "0.75": [9, 0, -3], "1.25": Z})},
        "weapon_root": {"rotation": cat({"0.0": Z, "0.2083": [18, -20, 0], "0.375": [6, 0, 0], "0.625": [4, 14, 0], "0.75": [8, 10, 0], "1.25": Z})},
        "inter_blade": {"position": {"0.0": Z, "0.0833": Z, "0.2083": [0, 0, -86], "0.2917": [0, 0, -106], "0.375": [0, 0, -100], "0.6667": [0, 0, -100], "0.7917": [0, 0, 3], "0.875": Z, "1.25": Z}},
    },
    "particle_effects": {
        "0.0833": [fx("interstellaris_sparks", "interstellaris_mid")],
        "0.25": [TRAIL],
        "0.3333": [fx("interstellaris_sweep", "interstellaris_sweep"), SPARKS],
        "0.4583": [TRAIL],
        "0.625": [SPARKS],
    },
}

skill_1 = {
    "animation_length": 1.0,
    "override_previous_animation": True,
    "bones": {
        "root": {"scale": {"0.0": ONE, "0.125": [f"1+0.03*{TP}", f"1-0.035*{TP}", f"1+0.03*{TP}"], "0.25": [f"1-0.015*{TP}", f"1+0.03*{TP}", f"1-0.015*{TP}"], "0.4167": ONE, "1.0": ONE}},
        "waist": {"rotation": cat({"0.0": Z, "0.125": [6, 0, 0], "0.25": [-5, 0, 0], "0.6667": [-3, 0, 0], "1.0": Z})},
        "head": {"rotation": cat({"0.0": Z, "0.1667": [6, 0, 0], "0.2917": [-14, 0, 0], "0.6667": [-10, 0, 0], "1.0": Z})},
        "rightArm": {"rotation": cat({"0.0": Z, "0.125": [-40, -10, 6], "0.25": [-96, -22, 0], "0.3333": [-90, -20, 0], "0.6667": [-88, -19, 0], "1.0": Z}),
                     "position": cat({"0.0": Z, "0.25": [1.2, 0.6, 0], "0.6667": [1.1, 0.4, 0], "1.0": Z})},
        "leftArm": {"rotation": cat({"0.0": Z, "0.1667": [-30, 14, -8], "0.2917": [-84, 30, 0], "0.6667": [-80, 28, 0], "1.0": Z}),
                    "position": cat({"0.0": Z, "0.2917": [-1.2, -0.6, 0], "0.6667": [-1.1, -0.5, 0], "1.0": Z})},
        "inter_star": {"scale": uniform({"0.0": 1, "0.25": 1.6, "0.375": 1.25, "0.6667": 1.25, "1.0": 1})},
    },
    "particle_effects": {"0.25": [fx("interstellaris_sparks", "interstellaris_mid"), TRAIL]},
}

skill_2 = {
    "animation_length": 1.0,
    "override_previous_animation": True,
    "bones": {
        "waist": {"rotation": cat({"0.0": Z, "0.125": [-4, 24, 0], "0.25": [8, -16, 0], "0.3333": [9, -18, 0], "0.7083": [6, -12, 0], "1.0": Z})},
        "body": {"rotation": {"0.0": Z, "0.1667": tp([0, 6, 0]), "0.2917": tp([0, -8, 0]), "0.75": tp([0, -5, 0]), "1.0": Z}},
        "head": {"rotation": cat({"0.0": Z, "0.125": [0, -20, 0], "0.2917": [-4, 16, 0], "0.7083": [-3, 11, 0], "1.0": Z})},
        "rightArm": {"rotation": cat({"0.0": Z, "0.125": [-30, 30, 40], "0.25": [-80, -16, 4], "0.3333": [-76, -14, 4], "0.7083": [-72, -12, 4], "1.0": Z}),
                     "position": cat({"0.0": Z, "0.125": [0, 0, 1.2], "0.25": [0, 0, -1.4], "0.3333": [0, 0, -1.0], "0.7083": [0, 0, -0.6], "1.0": Z})},
        "leftArm": {"rotation": cat({"0.0": Z, "0.125": [-20, 0, -20], "0.25": [30, 0, -34], "0.7083": [22, 0, -24], "1.0": Z})},
        "rightLeg": {"rotation": cat({"0.0": Z, "0.25": [-16, 0, 0], "0.7083": [-12, 0, 0], "1.0": Z})},
        "leftLeg": {"rotation": cat({"0.0": Z, "0.25": [14, 0, 0], "0.7083": [10, 0, 0], "1.0": Z})},
        "weapon_root": {"rotation": cat({"0.0": Z, "0.125": [20, 0, 0], "0.25": [74, 0, 0], "0.7083": [70, 0, 0], "1.0": Z})},
    },
    "particle_effects": {"0.125": [TRAIL], "0.25": [SPARKS]},
}


def dash_slash(particle, locator, mirror):
    s = -1 if mirror else 1
    return {
        "animation_length": 0.25,
        "override_previous_animation": True,
        "bones": {
            "waist": {"rotation": cat({"0.0": [0, -26 * s, 0], "0.0833": [8, 30 * s, 3 * s], "0.25": [6, 22 * s, 2 * s]})},
            "rightArm": {"rotation": cat({"0.0": [-100, -24 * s, 50], "0.0833": [-28, -17, 70], "0.25": [-24, -15, 64]})},
            "leftArm": {"rotation": cat({"0.0": [-20, 0, -30], "0.0833": [24, 0, -46], "0.25": [18, 0, -36]})},
            "rightLeg": {"rotation": cat({"0.0": [18, 0, 0], "0.25": [20, 0, 0]})},
            "leftLeg": {"rotation": cat({"0.0": [-16, 0, 0], "0.25": [-17, 0, 0]})},
        },
        "particle_effects": {"0.0": [TRAIL], "0.0417": [fx(particle, locator), SPARKS]},
    }


skill_3_plant = {
    "animation_length": 1.25,
    "override_previous_animation": True,
    "bones": {
        "root": {
            "position": {"0.0": Z, "0.1667": tp([0, 5, 0]), "0.25": tp([0, 5.5, 0]), "0.375": Z, "1.25": Z},
            "scale": {"0.0": ONE, "0.25": [f"1-0.02*{TP}", f"1+0.04*{TP}", f"1-0.02*{TP}"], "0.375": [f"1+0.06*{TP}", f"1-0.08*{TP}", f"1+0.06*{TP}"], "0.5": [f"1-0.01*{TP}", f"1+0.015*{TP}", f"1-0.01*{TP}"], "0.625": ONE, "1.25": ONE},
        },
        "waist": {"rotation": cat({"0.0": Z, "0.1667": [-12, 0, 0], "0.25": [-14, 0, 0], "0.375": [26, 0, 0], "0.5": [22, 0, 0], "0.9167": [20, 0, 0], "1.25": Z})},
        "head": {"rotation": cat({"0.0": Z, "0.2083": [-16, 0, 0], "0.4167": [10, 0, 0], "0.5417": [-8, 0, 0], "0.9167": [-10, 0, 0], "1.25": Z})},
        "rightArm": {"rotation": cat({"0.0": Z, "0.1667": [-150, -30, 0], "0.25": [-158, -32, 0], "0.375": [-52, -24, 0], "0.5": [-48, -22, 0], "0.9167": [-46, -21, 0], "1.25": Z}),
                     "position": cat({"0.0": Z, "0.1667": [0.6, 1.5, 0], "0.375": [1.2, 0, 0], "0.9167": [1.1, 0, 0], "1.25": Z})},
        "leftArm": {"rotation": cat({"0.0": Z, "0.1667": [-146, 30, 0], "0.25": [-154, 32, 0], "0.375": [-48, 30, 0], "0.5": [-44, 28, 0], "0.9167": [-42, 27, 0], "1.25": Z}),
                    "position": cat({"0.0": Z, "0.1667": [-0.6, 1.5, 0], "0.375": [-1.2, -0.6, 0], "0.9167": [-1.1, -0.5, 0], "1.25": Z})},
        "rightLeg": {"rotation": cat({"0.0": Z, "0.25": [14, 0, 0], "0.375": [-24, 0, 0], "0.9167": [-20, 0, 0], "1.25": Z})},
        "leftLeg": {"rotation": cat({"0.0": Z, "0.25": [8, 0, 0], "0.375": [22, 0, 0], "0.9167": [18, 0, 0], "1.25": Z})},
        "weapon_root": {"rotation": cat({"0.0": Z, "0.1667": [-30, 0, 0], "0.25": [-34, 0, 0], "0.375": [142, 0, 0], "0.5": [138, 0, 0], "0.9167": [138, 0, 0], "1.25": Z})},
        "inter_blade": {"scale": {"0.0": ONE, "0.3333": ONE, "0.4167": [1.2, 1.2, 1.15], "0.5417": ONE, "1.25": ONE}},
        "inter_star": {"scale": uniform({"0.0": 1, "0.375": 1.8, "0.5417": 1.2, "0.9167": 1.2, "1.25": 1})},
    },
    "particle_effects": {"0.2083": [TRAIL], "0.375": [fx("weapon_slam_dust"), SPARKS, fx("interstellaris_sparks", "interstellaris_mid")]},
}

idle = {
    "loop": True,
    "bones": {
        "inter_star": {"rotation": ["q.life_time * 60", 0, 0], "scale": "1 + math.sin(q.life_time * 200) * 0.06"},
        "inter_shard_a": {"position": [0, "math.sin(q.life_time * 140) * 0.35", "math.sin(q.life_time * 95) * 0.4"], "rotation": ["math.sin(q.life_time * 110) * 3", 0, 0]},
        "inter_shard_b": {"position": [0, "math.sin(q.life_time * 140 + 150) * 0.35", "math.sin(q.life_time * 95 + 150) * 0.4"], "rotation": ["math.sin(q.life_time * 110 + 150) * 3", 0, 0]},
        "inter_tip": {"position": [0, 0, "-0.25 - math.sin(q.life_time * 120) * 0.35"]},
    },
}

animations = {
    "animation.interstellaris.attack_1": borrowed(1),
    "animation.interstellaris.attack_2": borrowed(2),
    "animation.interstellaris.attack_3": borrowed(3),
    "animation.interstellaris.attack_4": attack_4,
    "animation.interstellaris.skill_1": skill_1,
    "animation.interstellaris.skill_2": skill_2,
    "animation.interstellaris.skill_3_slash_a": dash_slash("interstellaris_attack_2", "interstellaris_2", False),
    "animation.interstellaris.skill_3_slash_b": dash_slash("interstellaris_attack_1", "interstellaris_1", True),
    "animation.interstellaris.skill_3_plant": skill_3_plant,
    "animation.interstellaris.idle": idle,
}

with open(os.path.join(ANIM, "interstellaris.animation.json"), "w") as f:
    json.dump({"format_version": "1.8.0", "animations": animations}, f, indent="\t")
    f.write("\n")

for name, anim in animations.items():
    used = set()
    for entries in anim.get("particle_effects", {}).values():
        for e in entries if isinstance(entries, list) else [entries]:
            used.add((e["effect"], e.get("locator")))
    print(name, anim.get("animation_length"), sorted(used, key=str))

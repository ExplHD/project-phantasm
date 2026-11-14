import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
ANIM = os.path.join(RP, "animations")
TP = "(1-v.is_first_person)"
FP = "v.is_first_person"
Z = [0, 0, 0]
ONE = [1, 1, 1]


def num(x):
    return round(x, 3)


def mix(tp_vec, fp_vec=None):
    out = []
    for i, a in enumerate(tp_vec):
        b = fp_vec[i] if fp_vec else 0
        a, b = num(a), num(b)
        parts = []
        if a:
            parts.append(f"{num(a)}*{TP}")
        if b:
            parts.append(f"{num(b)}*{FP}")
        out.append("+".join(parts) if parts else 0)
    return out


STEP = 1 / 24


def catmull(keys, t):
    times = sorted(keys, key=float)
    ts = [float(x) for x in times]
    vals = [keys[x] for x in times]
    if t <= ts[0]:
        return list(vals[0])
    if t >= ts[-1]:
        return list(vals[-1])
    i = max(j for j in range(len(ts)) if ts[j] <= t)
    p0, p1, p2 = vals[max(i - 1, 0)], vals[i], vals[i + 1]
    p3 = vals[min(i + 2, len(vals) - 1)]
    u = (t - ts[i]) / (ts[i + 1] - ts[i])
    return [0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u ** 3)
            for a, b, c, d in zip(p0, p1, p2, p3)]


def samples(*key_sets):
    marks = {float(t) for keys in key_sets for t in keys}
    end = max(marks)
    n = int(round(end / STEP))
    marks |= {round(k * STEP, 4) for k in range(n + 1)}
    return sorted(m for m in marks if m <= end + 1e-6)


def stamp(t):
    return f"{t:.4f}".rstrip("0").rstrip(".") if t else "0.0"


def curve(keys, fp=None):
    fp = fp or {}
    out = {}
    for t in samples(keys, fp):
        tp_v = catmull(keys, t) if keys else Z
        fp_v = catmull(fp, t) if fp else None
        out[stamp(t)] = mix(tp_v, fp_v)
    return out


def scale(keys):
    out = {}
    for t in samples(keys):
        v = catmull(keys, t)
        out[stamp(t)] = [f"1+{num(x - 1)}*{TP}" if abs(x - 1) > 0.0005 else 1 for x in v]
    return out


def clip(length, bones, timeline=None):
    data = {"animation_length": length, "override_previous_animation": True, "bones": bones}
    if timeline:
        data["timeline"] = timeline
    return data


def cast_mark(big=False):
    return {"0.0": "v.interpolaris_cast_big = q.life_time;" if big else "v.interpolaris_cast = q.life_time;"}


attack_1 = clip(0.5833, {
    "root": {"scale": scale({"0.0": ONE, "0.0833": [1.03, 0.965, 1.03], "0.2083": [0.985, 1.03, 0.985], "0.3333": ONE, "0.5833": ONE})},
    "waist": {"rotation": curve({"0.0": Z, "0.0833": [-4, 14, 0], "0.1667": [2, -4, 0], "0.2292": [5, -13, 1.5], "0.3333": [4, -10, 1], "0.5833": Z})},
    "body": {"rotation": curve({"0.0": Z, "0.125": [0, 5, 0], "0.25": [0, -6, 0], "0.4167": [0, -3, 0], "0.5833": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.0833": [3, -10, 0], "0.2292": [-4, 10, 0], "0.375": [-2, 7, 0], "0.5833": Z})},
    "rightArm": {
        "rotation": curve({"0.0": Z, "0.0833": [22, 18, 24], "0.1667": [-62, -6, 10], "0.2292": [-104, -22, -4], "0.3125": [-92, -17, -2], "0.4167": [-60, -10, 2], "0.5833": Z},
                          {"0.0": Z, "0.0833": [8, 0, 0], "0.2292": [-12, 0, -4], "0.375": [-5, 0, -2], "0.5833": Z}),
        "position": curve({"0.0": Z, "0.0833": [0.3, 0, 0.8], "0.2292": [-0.2, 0.3, -1.4], "0.3333": [0, 0.1, -0.8], "0.5833": Z}),
    },
    "leftArm": {"rotation": curve({"0.0": Z, "0.0833": [-22, -8, -10], "0.2083": [18, 4, -20], "0.3333": [12, 2, -14], "0.5833": Z})},
    "rightLeg": {"rotation": curve({"0.0": Z, "0.1667": [-8, 0, 2], "0.2917": [-12, 0, 3], "0.5833": Z})},
    "leftLeg": {"rotation": curve({"0.0": Z, "0.1667": [6, 0, -2], "0.2917": [9, 0, -3], "0.5833": Z})},
}, cast_mark())

attack_2 = clip(0.5833, {
    "root": {"scale": scale({"0.0": ONE, "0.1": [1.03, 0.965, 1.03], "0.2292": [0.985, 1.03, 0.985], "0.3542": ONE, "0.5833": ONE})},
    "waist": {"rotation": curve({"0.0": Z, "0.1": [-3, 15, -1], "0.1875": [2, 2, 0], "0.25": [5, -16, -1.5], "0.3542": [4, -12, -1], "0.5833": Z})},
    "body": {"rotation": curve({"0.0": Z, "0.125": [0, 4, 0], "0.2708": [0, -7, 0], "0.4167": [0, -4, 0], "0.5833": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.1": [2, -8, 0], "0.25": [-4, 9, 0], "0.375": [-2, 6, 0], "0.5833": Z})},
    "leftArm": {
        "rotation": curve({"0.0": Z, "0.1": [-58, 46, 8], "0.1875": [-86, 12, -4], "0.25": [-92, -30, -12], "0.3333": [-80, -34, -14], "0.4583": [-48, -18, -8], "0.5833": Z}),
        "position": curve({"0.0": Z, "0.1": [0.6, 0.2, 0.4], "0.25": [0.2, 0.3, -1.2], "0.3333": [0, 0.1, -0.8], "0.5833": Z}),
    },
    "rightArm": {"rotation": curve({"0.0": Z, "0.1": [-14, -6, 8], "0.25": [16, 0, 18], "0.375": [10, 0, 12], "0.5833": Z},
                                   {"0.0": Z, "0.1": [6, 0, 6], "0.25": [-9, 0, -6], "0.375": [-3, 0, -2], "0.5833": Z})},
    "leftLeg": {"rotation": curve({"0.0": Z, "0.1875": [-6, 0, -2], "0.3125": [-10, 0, -2], "0.5833": Z})},
    "rightLeg": {"rotation": curve({"0.0": Z, "0.1875": [5, 0, 2], "0.3125": [8, 0, 2], "0.5833": Z})},
}, cast_mark())

attack_3 = clip(0.625, {
    "root": {"scale": scale({"0.0": ONE, "0.1": [1.035, 0.96, 1.035], "0.25": [0.98, 1.035, 0.98], "0.375": ONE, "0.625": ONE})},
    "waist": {"rotation": curve({"0.0": Z, "0.1": [-8, 0, 0], "0.1875": [2, 0, 0], "0.25": [10, 0, 0], "0.375": [7, 0, 0], "0.625": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.1": [7, 0, 0], "0.25": [-9, 0, 0], "0.4167": [-5, 0, 0], "0.625": Z})},
    "rightArm": {
        "rotation": curve({"0.0": Z, "0.1": [-38, 26, -6], "0.1875": [-80, 6, 4], "0.25": [-96, -16, 4], "0.3333": [-90, -13, 2], "0.4583": [-56, -6, 0], "0.625": Z},
                          {"0.0": Z, "0.1": [6, 0, 0], "0.25": [-14, 0, 0], "0.4167": [-6, 0, 0], "0.625": Z}),
        "position": curve({"0.0": Z, "0.1": [0.4, 0, 1.2], "0.25": [0.6, 0.2, -1.6], "0.3333": [0.5, 0.1, -1.0], "0.625": Z}),
    },
    "leftArm": {
        "rotation": curve({"0.0": Z, "0.1": [-38, -26, 6], "0.1875": [-80, -6, -4], "0.25": [-96, 16, -4], "0.3333": [-90, 13, -2], "0.4583": [-56, 6, 0], "0.625": Z}),
        "position": curve({"0.0": Z, "0.1": [-0.4, 0, 1.2], "0.25": [-0.6, 0.2, -1.6], "0.3333": [-0.5, 0.1, -1.0], "0.625": Z}),
    },
    "rightLeg": {"rotation": curve({"0.0": Z, "0.25": [-13, 0, 0], "0.4167": [-9, 0, 0], "0.625": Z})},
    "leftLeg": {"rotation": curve({"0.0": Z, "0.25": [10, 0, 0], "0.4167": [7, 0, 0], "0.625": Z})},
}, cast_mark())

attack_4 = clip(0.9583, {
    "root": {"scale": scale({"0.0": ONE, "0.1667": [0.98, 1.04, 0.98], "0.3125": [1.05, 0.94, 1.05], "0.4167": [0.99, 1.01, 0.99], "0.5": ONE, "0.9583": ONE})},
    "waist": {"rotation": curve({"0.0": Z, "0.0833": [4, 0, 0], "0.1875": [-12, 0, 0], "0.25": [-13, 0, 0], "0.3125": [18, 0, 0], "0.4167": [13, 0, 0], "0.625": [9, 0, 0], "0.9583": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.1875": [-20, 0, 0], "0.3125": [12, 0, 0], "0.4583": [4, 0, 0], "0.9583": Z})},
    "rightArm": {
        "rotation": curve({"0.0": Z, "0.0833": [-30, 10, 10], "0.1875": [-168, 12, 8], "0.25": [-174, 10, 6], "0.3125": [-62, -14, 0], "0.375": [-50, -11, 0], "0.625": [-44, -9, 0], "0.9583": Z},
                          {"0.0": Z, "0.1875": [-20, 0, 0], "0.3125": [14, 0, 0], "0.5": Z, "0.9583": Z}),
        "position": curve({"0.0": Z, "0.1875": [-0.4, 1.4, 0], "0.3125": [0, 0, -1.2], "0.625": [0, 0, -0.6], "0.9583": Z}),
    },
    "leftArm": {
        "rotation": curve({"0.0": Z, "0.0833": [-30, -10, -10], "0.1875": [-164, -12, -8], "0.25": [-170, -10, -6], "0.3125": [-58, 14, 0], "0.375": [-46, 11, 0], "0.625": [-40, 9, 0], "0.9583": Z}),
        "position": curve({"0.0": Z, "0.1875": [0.4, 1.4, 0], "0.3125": [0, 0, -1.2], "0.625": [0, 0, -0.6], "0.9583": Z}),
    },
    "rightLeg": {"rotation": curve({"0.0": Z, "0.3125": [-15, 0, 4], "0.625": [-12, 0, 3], "0.9583": Z})},
    "leftLeg": {"rotation": curve({"0.0": Z, "0.3125": [12, 0, -4], "0.625": [9, 0, -3], "0.9583": Z})},
}, cast_mark(True))

skill_1 = clip(0.8333, {
    "root": {"scale": scale({"0.0": ONE, "0.125": [1.03, 0.965, 1.03], "0.2917": [0.985, 1.03, 0.985], "0.4167": ONE, "0.8333": ONE})},
    "waist": {"rotation": curve({"0.0": Z, "0.125": [7, 0, 0], "0.2917": [-8, 0, 0], "0.5833": [-5, 0, 0], "0.8333": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.1667": [8, 0, 0], "0.3333": [-16, 0, 0], "0.5833": [-11, 0, 0], "0.8333": Z})},
    "rightArm": {"rotation": curve({"0.0": Z, "0.125": [-30, 20, 0], "0.2917": [-12, 0, 104], "0.375": [-10, 0, 98], "0.5833": [-10, 0, 94], "0.8333": Z},
                                   {"0.0": Z, "0.125": [8, 0, 0], "0.2917": [-14, 0, 0], "0.5833": [-8, 0, 0], "0.8333": Z})},
    "leftArm": {"rotation": curve({"0.0": Z, "0.1667": [-26, -18, 0], "0.3333": [-10, 0, -100], "0.4167": [-8, 0, -94], "0.5833": [-8, 0, -90], "0.8333": Z})},
}, cast_mark(True))

skill_2 = clip(1.0, {
    "waist": {"rotation": curve({"0.0": [0, 14, 0], "0.125": [3, -10, 0], "0.4583": [4, -12, 0], "0.5417": [-5, -6, 0], "0.7083": [-2, -4, 0], "1.0": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.125": [-2, 8, 0], "0.4583": [-2, 9, 0], "0.5417": [-8, 5, 0], "1.0": Z})},
    "rightArm": {
        "rotation": curve({"0.0": [10, 10, 14], "0.125": [-92, -12, 0], "0.4583": [-90, -11, 0], "0.5417": [-106, -11, 0], "0.7083": [-96, -10, 0], "1.0": Z},
                          {"0.0": Z, "0.125": [-6, 0, 0], "0.4583": [-8, 0, 0], "0.5417": [8, 0, 0], "0.75": Z, "1.0": Z}),
        "position": curve({"0.0": Z, "0.125": [0, 0, -1.2], "0.4583": [0, 0, -1.4], "0.5417": [0, 0, 0.6], "0.7083": [0, 0, -0.4], "1.0": Z}),
    },
    "leftArm": {"rotation": curve({"0.0": Z, "0.125": [-64, 34, 0], "0.4583": [-62, 33, 0], "0.5417": [-30, 14, -10], "1.0": Z})},
    "rightLeg": {"rotation": curve({"0.0": Z, "0.125": [-12, 0, 0], "0.7083": [-9, 0, 0], "1.0": Z})},
    "leftLeg": {"rotation": curve({"0.0": Z, "0.125": [11, 0, 0], "0.7083": [8, 0, 0], "1.0": Z})},
})

HOLD = "5.5"
skill_3 = clip(6.0, {
    "waist": {"rotation": curve({"0.0": Z, "0.2083": [8, 0, 0], "0.5": [-9, 0, 0], HOLD: [-7, 0, 0], "6.0": Z})},
    "head": {"rotation": curve({"0.0": Z, "0.25": [10, 0, 0], "0.5417": [-6, 0, 0], HOLD: [-5, 0, 0], "6.0": Z})},
    "rightArm": {"rotation": curve({"0.0": Z, "0.2083": [20, 0, 10], "0.5": [-24, 0, 66], "0.625": [-20, 0, 60], HOLD: [-20, 0, 58], "6.0": Z})},
    "leftArm": {"rotation": curve({"0.0": Z, "0.25": [18, 0, -8], "0.5417": [-20, 0, -62], "0.6667": [-17, 0, -56], HOLD: [-17, 0, -54], "6.0": Z})},
    "rightLeg": {"rotation": curve({"0.0": Z, "0.2083": [-14, 0, 0], "0.5": [10, 0, 5], HOLD: [8, 0, 4], "6.0": Z})},
    "leftLeg": {"rotation": curve({"0.0": Z, "0.25": [-8, 0, 0], "0.5833": [22, 0, -4], HOLD: [18, 0, -3], "6.0": Z})},
})


def fx(effect, locator, size):
    return {"effect": effect, "locator": locator, "pre_effect_script": f"v.size = {size};"}


def cast_fx(view, big):
    locator = f"interp_{view}"
    k = 0.6 if view == "fp" else 1.0
    if big:
        effects = {
            "0.0": [fx("interpolaris_cast_motes", locator, num(1.0 * k)), fx("interpolaris_sigil", locator, num(1.2 * k))],
            "0.1667": [fx("interpolaris_sigil", locator, num(0.8 * k))],
            "0.2917": [fx("interpolaris_flare", locator, num(1.5 * k))],
        }
        length = 0.4
    else:
        effects = {
            "0.0": [fx("interpolaris_cast_motes", locator, num(0.7 * k)), fx("interpolaris_sigil", locator, num(0.75 * k))],
            "0.2083": [fx("interpolaris_flare", locator, num(0.95 * k))],
        }
        length = 0.3
    return {"animation_length": length, "particle_effects": effects}


player = {
    "animation.interpolaris.attack_1": attack_1,
    "animation.interpolaris.attack_2": attack_2,
    "animation.interpolaris.attack_3": attack_3,
    "animation.interpolaris.attack_4": attack_4,
    "animation.interpolaris.skill_1": skill_1,
    "animation.interpolaris.skill_2": skill_2,
    "animation.interpolaris.skill_3": skill_3,
    "animation.interpolaris.cast_fp": cast_fx("fp", False),
    "animation.interpolaris.cast_tp": cast_fx("tp", False),
    "animation.interpolaris.cast_big_fp": cast_fx("fp", True),
    "animation.interpolaris.cast_big_tp": cast_fx("tp", True),
}

T = "(v.interp_time ?? q.life_time)"
CAST = "(v.interp_cast ?? 0)"


def floating(prefix, bob):
    return {
        f"{prefix}interp": {"position": [0, f"math.sin({T}*150)*{bob}", 0], "scale": f"1+0.22*math.sin({CAST}*180)"},
        f"{prefix}interp_core": {"rotation": [f"{T}*40", f"{T}*90", 0], "scale": f"1+math.sin({T}*240)*0.07"},
        f"{prefix}interp_ring": {"rotation": [22, f"{T}*-170", f"12+math.sin({T}*60)*10"]},
        f"{prefix}interp_frame": {"rotation": [0, f"{T}*30", 0], "position": [0, f"math.sin({T}*150+90)*0.2", 0]},
        f"{prefix}interp_shards": {"rotation": [f"math.sin({T}*45)*14", f"{T}*230", 0]},
    }


item = {
    "animation.interpolaris.float": {
        "loop": True,
        "bones": {
            **floating("fp_", 0.45),
            **floating("tp_", 1.4),
            "tp_interp_orbit": {"rotation": [0, f"{T}*100", 0]},
        },
    },
}

sword = {
    "animation.interpolaris_sword.fall": {
        "loop": "hold_on_last_frame",
        "animation_length": 1.0,
        "bones": {
            "sword_fall": {
                "position": {"0.0": [0, 96, 0], "0.125": [0, 76, 0], "0.2083": [0, 46, 0], "0.3": [0, -3, 0], "0.3667": [0, -1, 0], "1.0": [0, -1, 0]},
                "rotation": {"0.0": [0, 0, 0], "0.3": [0, 90, 0], "1.0": [0, 90, 0]},
                "scale": {"0.0": [1, 1, 1], "0.7": [1, 1, 1], "1.0": [0, 0, 0]},
            },
        },
    },
}


def recent(var):
    return f"q.life_time - (v.{var} ?? -10) < 0.1"


controller = {
    "format_version": "1.10.0",
    "animation_controllers": {
        "controller.animation.interpolaris.cast": {
            "initial_state": "default",
            "states": {
                "default": {"transitions": [
                    {"cast_big_fp": f"v.is_first_person && {recent('interpolaris_cast_big')}"},
                    {"cast_big_tp": f"!v.is_first_person && {recent('interpolaris_cast_big')}"},
                    {"cast_fp": f"v.is_first_person && {recent('interpolaris_cast')}"},
                    {"cast_tp": f"!v.is_first_person && {recent('interpolaris_cast')}"},
                ]},
                **{state: {"animations": [f"interpolaris_{state}"], "transitions": [{"default": "q.all_animations_finished"}]}
                   for state in ("cast_fp", "cast_tp", "cast_big_fp", "cast_big_tp")},
            },
        },
    },
}


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")


dump(os.path.join(ANIM, "weapons", "interpolaris.animation.json"), {"format_version": "1.8.0", "animations": player})
dump(os.path.join(ANIM, "weapons", "interpolaris_item.animation.json"), {"format_version": "1.8.0", "animations": item})
dump(os.path.join(ANIM, "entities", "interpolaris_sword.animation.json"), {"format_version": "1.8.0", "animations": sword})
dump(os.path.join(RP, "animation_controllers", "interpolaris.json"), controller)
for name, anim in {**player, **item, **sword}.items():
    print(name, anim.get("animation_length"), sorted(anim.get("bones", {})), sorted(anim.get("particle_effects", {})))

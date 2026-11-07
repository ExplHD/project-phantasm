import type { AutoGun } from "./autoGun";
import type { ChargeBeamGun } from "./chargeBeamGun";
import type { Shooter } from "./shooters";

export const AUTO_GUNS: readonly AutoGun[] = [
	{
		"id": "ph:xeonnite_blaster_mk3",
		"shotCategory": "ph:xeonnite_shot",
		"raiseTicks": 3,
		"interval": 2,
		"wear": 1,
		"muzzle": {
			"forward": 1.1,
			"side": 0.04,
			"up": -0.18
		},
		"muzzleParticle": "ph:xeonnite_blaster_muzzle",
		"sound": {
			"id": "weapon_slash.ump_shot",
			"pitch": 1.7,
			"pitchJitter": 0.2
		},
		"projectile": {
			"core": "ph:xeonnite_plasmoid",
			"trail": "ph:xeonnite_plasmoid_trail",
			"impact": [
				"ph:xeonnite_plasmoid_impact"
			],
			"impactSound": "random.fizz",
			"impactPitch": 1.6,
			"damage": 16,
			"speed": 2.4,
			"range": 40,
			"lockCone": 4,
			"knockback": 0.1,
			"origin": {
				"forward": 1.1,
				"side": 0.04,
				"up": -0.18
			}
		},
		"heat": {
			"objective": "xeonnite_heat",
			"overheatObjective": "xeonnite_overheat",
			"max": 100,
			"perShot": 3,
			"coolDelay": 10,
			"coolRate": 1.5,
			"overheatCoolRate": 1,
			"steamInterval": 5
		},
		"altFire": {
			"projectile": {
				"core": "ph:xeonnite_missile",
				"trail": "ph:xeonnite_missile_trail",
				"impact": [
					"ph:xeonnite_missile_blast",
					"ph:xeonnite_missile_sparks",
					"ph:xeonnite_missile_smoke"
				],
				"impactSound": "random.explode",
				"impactPitch": 0.9,
				"damage": 45,
				"speed": 1.1,
				"range": 48,
				"homing": 5,
				"lockCone": 18,
				"knockback": 0.6,
				"blast": {
					"radius": 3.5,
					"damage": 25,
					"knockback": 1.2
				},
				"origin": {
					"forward": 1.1,
					"side": 0.04,
					"up": -0.18
				}
			},
			"chargeTicks": 16,
			"chargeFxInterval": 4,
			"chargeParticle": "ph:xeonnite_missile",
			"interval": 50,
			"wear": 5,
			"sound": {
				"id": "firework.launch",
				"pitch": 0.8
			},
			"recoilAnimation": "animation.xeonnite_blaster_mk3.missile_recoil",
			"shake": "0.2 0.15"
		}
	}
];

export const CHARGE_BEAM_GUNS: readonly ChargeBeamGun[] = [
	{
		"id": "ph:auric_apex",
		"shotCategory": "ph:auric_apex_shot",
		"chargeTicks": 40,
		"minChargeTicks": 10,
		"refireTicks": 20,
		"recoilTicks": 6,
		"chargeFxInterval": 2,
		"chargeSoundTicks": 43,
		"damage": 80,
		"minPower": 0.3,
		"range": 96,
		"maxTargets": 10,
		"pierceFalloff": 0.8,
		"pierceFloor": 0.4,
		"knockback": 0.8,
		"wear": 3,
		"auricCost": 10,
		"muzzle": {
			"forward": 1.9,
			"side": 0.04,
			"up": -0.2
		},
		"sounds": {
			"charge": "weapon_slash.auric_apex_charge",
			"ready": "weapon_slash.auric_apex_ready",
			"fire": "weapon_slash.auric_apex_fire"
		}
	}
];

export const SINGLE_GUNS: Readonly<Record<string, Shooter>> = {
	"ph:peacemaker_oath": {
		"projectile": {
			"trail": "ph:peacemaker_oath_flash",
			"impact": [
				"ph:peacemaker_oath_hit_effect"
			],
			"damage": 28,
			"speed": 2,
			"range": 80,
			"lockCone": 0,
			"knockback": 0,
			"blast": {
				"radius": 2,
				"damage": 28,
				"knockback": 0
			},
			"origin": {
				"forward": 0.6,
				"side": 0,
				"up": 0
			}
		},
		"sound": "weapon_slash.glock_shot",
		"chargeCost": 1,
		"animation": "animation.peacemaker_oath.fire"
	}
};

export const GUN_SCOPES: ReadonlyMap<string, number> = new Map<string, number>([["ph:auric_apex",30]]);

export const GUN_OBJECTIVES: readonly string[] = ["xeonnite_heat","xeonnite_overheat"];

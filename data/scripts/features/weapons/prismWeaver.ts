import type { ProjectileConfig } from "./projectile";

// ======================================== Prism Weaver projectiles ========================================
// Shared by the basic combo (weapons.ts) and Bubble Barrage (weaponSkills.ts).

const BOLT_FX = {
	core: "ph:prism_bolt",
	trail: "ph:prism_bolt_trail",
	impact: ["ph:prism_bolt_impact", "ph:prism_weaver_flash"],
	impactSound: "random.glass"
};

/** Combo hits 1 and 2: a single fast bolt from the staff side. */
export function prismBolt(side: number): ProjectileConfig {
	return { ...BOLT_FX, damage: 17, speed: 1.8, range: 28, homing: 6, lockCone: 10, origin: { side } };
}

/** Combo finisher: a three-bolt fan that converges on the locked target and pierces once. */
export const PRISM_FAN: ProjectileConfig = {
	...BOLT_FX,
	damage: 12,
	speed: 1.6,
	range: 24,
	homing: 9,
	lockCone: 14,
	pierce: 1,
	spread: [-9, 0, 9]
};

/** Bubble Barrage: slow, strongly homing bubbles, four per volley from around the player. Pierces every entity until a wall or max range. */
export function prismBubble(side: number, up: number): ProjectileConfig {
	return {
		core: "ph:prism_bubble",
		impact: ["ph:prism_bubble_pop"],
		impactSound: "random.pop",
		damage: 22,
		speed: 0.9,
		range: 20,
		homing: 14,
		lockCone: 25,
		knockback: 0.15,
		pierce: Infinity,
		origin: { forward: 0.2, side, up }
	};
}

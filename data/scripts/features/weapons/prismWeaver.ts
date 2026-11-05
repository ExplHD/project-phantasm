import type { ProjectileConfig } from "./projectile";

const BOLT_FX = {
	core: "ph:prism_bolt",
	trail: "ph:prism_bolt_trail",
	impact: ["ph:prism_bolt_impact", "ph:prism_weaver_flash"],
	impactSound: "random.glass"
};

export function prismBolt(side: number): ProjectileConfig {
	return { ...BOLT_FX, damage: 17, speed: 1.8, range: 28, homing: 6, lockCone: 10, origin: { side } };
}

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

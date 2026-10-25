import { Player, Entity, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { getOwnerId } from "../../core/summons";

// ======================================== Weapon damage ========================================
// Shared by melee sweeps (applyCustomDamage) and projectiles, so both scale the same way
// with Strength, Weakness and the held item's enchantments.

/** Everything a hit needs, read from the attacker once at swing/fire time. */
export interface StrikeStats {
	damage: number;
	fireAspect: number;
	knockback: number;
}

export function strikeStats(source: Player, baseDamage: number): StrikeStats {
	const strengthLevel = (source.getEffect("strength")?.amplifier ?? -1) + 1;
	const strengthFormula = 1 + strengthLevel * 0.45;
	const weaknessLevel = (source.getEffect("weakness")?.amplifier ?? -1) + 1;
	const weaknessFormula = Math.max(0, 1 - weaknessLevel * 0.24);
	const enchantable = source.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.getComponent("enchantable");
	const sharpnessDamage = (enchantable?.getEnchantment("sharpness")?.level ?? 0) * 1.25;
	return {
		damage: (baseDamage + sharpnessDamage) * strengthFormula * weaknessFormula,
		fireAspect: enchantable?.getEnchantment("fire_aspect")?.level ?? 0,
		knockback: enchantable?.getEnchantment("knockback")?.level ?? 0
	};
}

export const EXCLUDED_TYPES = ["minecraft:item", "minecraft:lightning_bolt", "minecraft:xp_orb"];
export const EXCLUDED_FAMILIES = ["inanimate", "invulnerable"];

/** Weapons never hit their wielder, the wielder's own summons or the wielder's tamed pets. */
export function canWeaponHit(source: Player, entity: Entity): boolean {
	if (!entity.isValid || entity.id === source.id) return false;
	if (getOwnerId(entity) === source.id) return false;
	try {
		if (entity.getComponent("tameable")?.tamedToPlayerId === source.id) return false;
	} catch {
		// Not tameable.
	}
	return true;
}

/**
 * Damages `entity` as `source` and knocks it along `push` (horizontal, normalised).
 * `knockbackScale` tones the push down for weapons that shouldn't shove much, like bolts.
 */
export function strikeEntity(source: Player, entity: Entity, stats: StrikeStats, push: { x: number; z: number }, knockbackScale: number = 1): void {
	entity.applyDamage(stats.damage, {
		cause: EntityDamageCause.entityAttack,
		damagingEntity: source
	});

	const kbStrength = (1 + stats.knockback) * knockbackScale;
	try {
		entity.applyKnockback({ x: push.x * kbStrength, z: push.z * kbStrength }, 0.4 * Math.min(1, knockbackScale + 0.25));
	} catch {
		// Knockback is unsupported for some entities (frozen in place / hovering /
		// physics-free like the Titan Core); damage still applies.
	}
	if (stats.fireAspect > 0) {
		try {
			entity.setOnFire(stats.fireAspect * 4 - 1);
		} catch { }
	}
}

export function applyCustomDamage(source: Player, damage: number, radius: number): void {
	const stats = strikeStats(source, damage);
	const entities = source.dimension.getEntities({
		location: source.location,
		minDistance: 0.1,
		maxDistance: radius,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	});

	for (const entity of entities) {
		if (!canWeaponHit(source, entity)) continue;
		let dx = entity.location.x - source.location.x;
		let dz = entity.location.z - source.location.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist > 0) {
			dx /= dist;
			dz /= dist;
		} else {
			dx = 0;
			dz = 1;
		}
		strikeEntity(source, entity, stats, { x: dx, z: dz });
	}
}

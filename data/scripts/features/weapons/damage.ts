import { Player, Entity, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { getOwnerId } from "../../core/summons";

export interface StrikeStats {
	readonly damage: number;
	readonly fireAspect: number;
	readonly knockback: number;
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

export function canWeaponHit(source: Player, entity: Entity): boolean {
	if (!entity.isValid || entity.id === source.id) return false;
	if (getOwnerId(entity) === source.id) return false;
	return entity.getComponent("tameable")?.tamedToPlayerId !== source.id;
}

export function strikeEntity(source: Player, entity: Entity, stats: StrikeStats, push: { x: number; z: number }, knockbackScale: number = 1): void {
	if (!entity.isValid) return;
	entity.applyDamage(stats.damage, {
		cause: EntityDamageCause.entityAttack,
		damagingEntity: source
	});

	const kbStrength = (1 + stats.knockback) * knockbackScale;
	if (!entity.isValid || !entity.getComponent("minecraft:movement")) return;
	entity.applyKnockback({ x: push.x * kbStrength, z: push.z * kbStrength }, 0.4 * Math.min(1, knockbackScale + 0.25));
	if (stats.fireAspect > 0) entity.setOnFire(stats.fireAspect * 4 - 1);
}

export function applyCustomDamage(source: Player, damage: number, radius: number, multiplier: number = 1, onStrike?: (target: Entity) => void): number {
	const base = strikeStats(source, damage);
	const stats: StrikeStats = { ...base, damage: base.damage * multiplier };
	const entities = source.dimension.getEntities({
		location: source.location,
		minDistance: 0.1,
		maxDistance: radius,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	});

	let hits = 0;
	for (const entity of entities) {
		if (!canWeaponHit(source, entity)) continue;
		const dx = entity.location.x - source.location.x;
		const dz = entity.location.z - source.location.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		const push = dist > 0 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 1 };
		strikeEntity(source, entity, stats, push);
		onStrike?.(entity);
		hits++;
	}
	return hits;
}

import { world, Player, GameMode, EntityComponentTypes, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { inTitanRidge } from "../../systems/xeonniteBlessing";

const CORE_ID = "ph:titan_core";
const SET_TAG = "ph:xeon_plasm_tier";
const CORE_RADIUS = 32;
const CORE_DAMAGE = 16;
const BIOME_DAMAGE = 4;

const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

export function hasXeonPlasmSet(player: Player): boolean {
	const equippable = player.getComponent(EntityComponentTypes.Equippable);
	if (!equippable) return false;
	return ARMOR_SLOTS.every(slot => equippable.getEquipment(slot)?.hasTag(SET_TAG) === true);
}

function nearLivingCore(player: Player): boolean {
	const cores = player.dimension.getEntities({ type: CORE_ID, location: player.location, maxDistance: CORE_RADIUS });
	return cores.some(core => core.isValid && (core.getComponent(EntityComponentTypes.Health)?.currentValue ?? 0) > 0);
}

export function tickTitanRadiation(): void {
	for (const player of world.getPlayers({ excludeGameModes: [GameMode.Creative, GameMode.Spectator] })) {
		if (!player.isValid || (player.getComponent(EntityComponentTypes.Health)?.currentValue ?? 0) <= 0) continue;
		if (hasXeonPlasmSet(player)) continue;

		if (nearLivingCore(player)) {
			player.applyDamage(CORE_DAMAGE, { cause: EntityDamageCause.magic });
		} else if (inTitanRidge(player)) {
			player.applyDamage(BIOME_DAMAGE, { cause: EntityDamageCause.magic });
		}
	}
}

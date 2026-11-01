import { world, Player, GameMode, EntityComponentTypes, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { inTitanRidge } from "../../systems/xeonniteBlessing";

// ======================================== Titan Radiation ========================================
// Titan Ridge burns anyone without a full Xeon Plasm set, and a living Titan Core
// burns harder. Damage only, no other effects. Three pieces or fewer give no protection.

const CORE_ID = "ph:titan_core";
const SET_TAG = "ph:xeon_plasm_tier";
const CORE_RADIUS = 32;
const CORE_DAMAGE = 16;  // per pulse within CORE_RADIUS of a living core
const BIOME_DAMAGE = 4; // per pulse anywhere else in Titan Ridge

const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

export function hasXeonPlasmSet(player: Player): boolean {
	const equippable = player.getComponent(EntityComponentTypes.Equippable);
	if (!equippable) return false;
	return ARMOR_SLOTS.every(slot => equippable.getEquipment(slot)?.hasTag(SET_TAG) === true);
}

function nearLivingCore(player: Player): boolean {
	const cores = player.dimension.getEntities({ type: CORE_ID, location: player.location, maxDistance: CORE_RADIUS });
	return cores.some(core => (core.getComponent(EntityComponentTypes.Health)?.currentValue ?? 0) > 0);
}

// Run every 40 ticks from events/index.ts, so the damage values above are per 2 seconds.
export function tickTitanRadiation(): void {
	for (const player of world.getPlayers({ excludeGameModes: [GameMode.Creative, GameMode.Spectator] })) {
		try {
			if (!player.isValid || (player.getComponent(EntityComponentTypes.Health)?.currentValue ?? 0) <= 0) continue;
			if (hasXeonPlasmSet(player)) continue;

			// Magic ignores armor and skips the toughness handler in events/index.ts.
			if (nearLivingCore(player)) {
				player.applyDamage(CORE_DAMAGE, { cause: EntityDamageCause.magic });
			} else if (inTitanRidge(player)) {
				player.applyDamage(BIOME_DAMAGE, { cause: EntityDamageCause.magic });
			}
		} catch {
			// The player can leave or change dimension mid-pass; they get checked again next pulse.
		}
	}
}

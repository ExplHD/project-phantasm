import { world, system, Player, EntityComponentTypes, EntityHurtBeforeEvent } from "@minecraft/server";

// ======================================== Xeonnite Blessing ========================================
// Earned once, kept forever: the player must have held a Xeonnite Cube at some point AND
// set foot in Titan Ridge at some point, in either order. Both milestones are sticky
// dynamic properties, so dropping the cube or leaving the biome afterwards changes nothing.
// Without it, players cannot damage anything in the titan_ridge family (drones, Titan
// Core, Forge Troopers): melee, projectiles and script damage that names the player.

export const BLESSING_PROPERTY = "ph:xeonnite_blessing";
const CUBE_PROPERTY = "ph:ever_obtained_xeonnite_cube";
const RIDGE_PROPERTY = "ph:ever_visited_titan_ridge";

const XEONNITE_CUBE = "ph:xeonnite_cube";
const TITAN_RIDGE_TAG = "ph:titan_ridge";
const TITAN_RIDGE_FAMILY = "titan_ridge";

export function isBlessed(player: Player): boolean {
	try {
		return player.getDynamicProperty(BLESSING_PROPERTY) === true;
	} catch {
		return false;
	}
}

function holdsCube(player: Player): boolean {
	const inventory = player.getComponent(EntityComponentTypes.Inventory)?.container;
	if (!inventory) return false;
	for (let slot = 0; slot < inventory.size; slot++) {
		if (inventory.getItem(slot)?.typeId === XEONNITE_CUBE) return true;
	}
	return false;
}

function inTitanRidge(player: Player): boolean {
	return player.dimension.getBiome(player.location).hasTags([TITAN_RIDGE_TAG]);
}

// 1s cadence: both milestones are one-time checks, nothing here needs tick precision.
system.runInterval(() => {
	for (const player of world.getAllPlayers()) {
		if (isBlessed(player)) continue;
		try {
			if (player.getDynamicProperty(CUBE_PROPERTY) !== true && holdsCube(player)) {
				player.setDynamicProperty(CUBE_PROPERTY, true);
			}
			if (player.getDynamicProperty(RIDGE_PROPERTY) !== true && inTitanRidge(player)) {
				player.setDynamicProperty(RIDGE_PROPERTY, true);
			}
			if (player.getDynamicProperty(CUBE_PROPERTY) !== true || player.getDynamicProperty(RIDGE_PROPERTY) !== true) continue;

			player.setDynamicProperty(BLESSING_PROPERTY, true);
			player.onScreenDisplay.setTitle("§b§lXeonnite Blessing", {
				subtitle: "§7The Forge Troopers can now be wounded",
				fadeInDuration: 10,
				stayDuration: 60,
				fadeOutDuration: 20
			});
			player.playSound("random.levelup");
		} catch {
			// Players mid-respawn or mid-dimension-change have no readable biome or inventory.
		}
	}
}, 20);

world.beforeEvents.entityHurt.subscribe((acc: EntityHurtBeforeEvent) => {
	const attacker = acc.damageSource.damagingEntity;
	if (attacker?.typeId !== "minecraft:player") return;

	const hurtEntity = acc.hurtEntity;
	try {
		if (!hurtEntity.getComponent("minecraft:type_family")?.hasTypeFamily(TITAN_RIDGE_FAMILY)) return;
	} catch {
		return;
	}
	const player = attacker as Player;
	if (isBlessed(player)) return;

	acc.cancel = true;
	system.run(() => {
		try {
			const { x, y, z } = hurtEntity.location;
			hurtEntity.dimension.spawnParticle("ph:auric_light_flash", { x, y: y + 1.6, z });
			player.onScreenDisplay.setActionBar("§7Requires the §bXeonnite Blessing");
		} catch {
			// Either side can despawn between the cancel and this run.
		}
	});
});

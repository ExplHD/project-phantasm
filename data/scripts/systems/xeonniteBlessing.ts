import {
	world,
	system,
	Entity,
	Player,
	type Vector3,
	EasingType,
	EntityComponentTypes,
	EntityDamageCause,
	EntityHurtBeforeEvent,
	InputPermissionCategory,
	MolangVariableMap
} from "@minecraft/server";
import { getOwnerId } from "../core/summons";
import { isLoadedLocation } from "../core/location";
import { type CameraBasis, clearShotLocation, playerCameraBasis, shotLocation } from "../core/camera";

export const BLESSING_PROPERTY = "ph:xeonnite_blessing";
const CUBE_PROPERTY = "ph:ever_obtained_xeonnite_cube";
const RIDGE_PROPERTY = "ph:ever_visited_titan_ridge";
const CUTSCENE_PROPERTY = "ph:xeonnite_cutscene_active";

const XEONNITE_CUBE = "ph:xeonnite_cube";
const TITAN_RIDGE_TAG = "ph:titan_ridge";
const TITAN_RIDGE_FAMILY = "titan_ridge";

export function isBlessed(player: Player): boolean {
	if (!player.isValid) return false;
	return player.getDynamicProperty(BLESSING_PROPERTY) === true;
}

function holdsCube(player: Player): boolean {
	const inventory = player.getComponent(EntityComponentTypes.Inventory)?.container;
	if (!inventory) return false;
	for (let slot = 0; slot < inventory.size; slot++) {
		if (inventory.getItem(slot)?.typeId === XEONNITE_CUBE) return true;
	}
	return false;
}

export function inTitanRidge(player: Player): boolean {
	if (!isLoadedLocation(player.dimension, player.location)) return false;
	return player.dimension.getBiome(player.location).hasTags([TITAN_RIDGE_TAG]);
}

export function checkBlessingMilestones(): void {
	for (const player of world.getAllPlayers()) {
		if (!player.isValid) continue;
		if (isBlessed(player)) continue;
		if (player.getDynamicProperty(CUBE_PROPERTY) !== true && holdsCube(player)) {
			player.setDynamicProperty(CUBE_PROPERTY, true);
		}
		if (player.getDynamicProperty(RIDGE_PROPERTY) !== true && inTitanRidge(player)) {
			player.setDynamicProperty(RIDGE_PROPERTY, true);
		}
		if (player.getDynamicProperty(CUBE_PROPERTY) !== true || player.getDynamicProperty(RIDGE_PROPERTY) !== true) continue;

		player.setDynamicProperty(BLESSING_PROPERTY, true);
		playBlessingCutscene(player);
	}
}

const BURST_TICK = 48;
const FADE_OUT_TICK = 84;
const RELEASE_TICK = 90;

interface Shot {
	readonly tick: number;
	readonly ease: number;
	readonly easeType: EasingType;
	readonly distance: number;
	readonly side: number;
	readonly height: number;
}

const SHOTS: Shot[] = [
	{ tick: 1, ease: 1.15, easeType: EasingType.InOutSine, distance: 0.6, side: 2.6, height: 0.1 },
	{ tick: 24, ease: 1.0, easeType: EasingType.InOutSine, distance: -1.3, side: 2.1, height: 0.5 },
	{ tick: BURST_TICK, ease: 0.55, easeType: EasingType.OutCubic, distance: 1.8, side: 4.8, height: 2.0 },
	{ tick: 59, ease: 1.25, easeType: EasingType.InOutSine, distance: 3.6, side: 3.6, height: 2.6 }
];
const OPENING_SHOT = { distance: 2.4, side: 1.0, height: -0.4 };

function cameraTo(player: Player, basis: CameraBasis, shot: { distance: number; side: number; height: number }, ease?: { time: number; type: EasingType }): void {
	const location = clearShotLocation(player.dimension, basis.anchor, shotLocation(basis, shot.distance, shot.side, shot.height));
	player.camera.setCamera("minecraft:free", {
		location,
		facingLocation: basis.anchor,
		easeOptions: ease ? { easeTime: ease.time, easeType: ease.type } : undefined
	});
}

function setLocked(player: Player, locked: boolean): void {
	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !locked);
	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, !locked);
}

const cutsceneRuns = new Map<string, number[]>();

export function releaseBlessingCutscene(player: Player): void {
	for (const run of cutsceneRuns.get(player.id) ?? []) system.clearRun(run);
	cutsceneRuns.delete(player.id);
	if (!player.isValid) return;
	setLocked(player, false);
	player.camera.clear();
	player.setDynamicProperty(CUTSCENE_PROPERTY, undefined);
}

function playBlessingCutscene(player: Player): void {
	const basis = playerCameraBasis(player);
	const dimension = player.dimension;
	const feet = { ...player.location };
	const chest = { x: feet.x, y: feet.y + 1.1, z: feet.z };

	player.setDynamicProperty(CUTSCENE_PROPERTY, true);
	setLocked(player, true);

	player.addEffect("resistance", RELEASE_TICK + 10, { amplifier: 4, showParticles: false });
	player.addEffect("slow_falling", RELEASE_TICK + 10, { showParticles: false });

	player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0, holdTime: 0.1, fadeOutTime: 0.6 } });
	cameraTo(player, basis, OPENING_SHOT);
	player.playAnimation("animation.player_extend.xeonnite_blessing", { blendOutTime: 0.25 });
	player.playSound("beacon.activate", { pitch: 0.8 });

	dimension.spawnParticle("ph:xeonnite_bless_rune", feet);
	dimension.spawnParticle("ph:xeonnite_bless_gather", chest);
	dimension.spawnParticle("ph:xeonnite_bless_motes", feet);

	const runs: number[] = [];
	cutsceneRuns.set(player.id, runs);
	const at = (tick: number, action: () => void): void => {
		runs.push(system.runTimeout(() => {
			if (!player.isValid) return;
			if (!dimension.isChunkLoaded(feet)) return;
			action();
		}, tick));
	};

	for (const shot of SHOTS) {
		at(shot.tick, () => cameraTo(player, basis, shot, { time: shot.ease, type: shot.easeType }));
	}

	at(24, () => player.playSound("beacon.ambient", { pitch: 1.4 }));

	at(BURST_TICK, () => {
		player.camera.fade({ fadeColor: { red: 1, green: 0.75, blue: 0.45 }, fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: 0.55 } });
		player.runCommand("camerashake add @s 0.35 0.7 positional");
		dimension.spawnParticle("ph:xeonnite_bless_flash", chest);
		dimension.spawnParticle("ph:xeonnite_bless_shards", chest);
		dimension.spawnParticle("ph:xeonnite_bless_shockwave", feet);
		dimension.spawnParticle("ph:xeonnite_bless_pillar", feet);
		dimension.spawnParticle("ph:xeonnite_bless_dust", feet);
		dimension.playSound("random.totem", feet, { volume: 0.9 });
		dimension.playSound("random.explode", feet, { volume: 0.5, pitch: 1.3 });
	});

	at(BURST_TICK + 2, () => dimension.spawnParticle("ph:xeonnite_bless_motes", feet));
	at(60, () => player.playSound("random.levelup", { pitch: 0.9 }));

	at(FADE_OUT_TICK, () =>
		player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.25, holdTime: 0.2, fadeOutTime: 0.5 } })
	);

	runs.push(system.runTimeout(() => {
		if (!player.isValid) return;
		releaseBlessingCutscene(player);
		player.onScreenDisplay.setActionBar("§6Xeonnite Blessing §7awakened: Titan Ridge foes can now be wounded");
	}, RELEASE_TICK));
}

export function onBlessingSpawn(player: Player, initialSpawn: boolean): void {
	if (!initialSpawn) return;
	if (player.getDynamicProperty(CUTSCENE_PROPERTY) === true) releaseBlessingCutscene(player);
}

function damageDealer(acc: EntityHurtBeforeEvent): Entity | undefined {
	const { damagingEntity, damagingProjectile, cause } = acc.damageSource;
	if (damagingEntity ?? damagingProjectile) return damagingEntity ?? damagingProjectile;
	if (cause !== EntityDamageCause.lightning) return undefined;
	const { location, dimension } = acc.hurtEntity;
	return dimension.getEntities({ type: "minecraft:lightning_bolt", location, maxDistance: 6, closest: 1 })[0];
}

const WARD_COOLDOWN_TICKS = 3;
const lastWard = new Map<string, number>();

function showWard(hurtEntity: Entity, from: Vector3, player: Player | undefined): void {
	const now = system.currentTick;
	if ((lastWard.get(hurtEntity.id) ?? -WARD_COOLDOWN_TICKS) + WARD_COOLDOWN_TICKS > now) return;
	lastWard.set(hurtEntity.id, now);

	const base = hurtEntity.location;
	const head = hurtEntity.getHeadLocation();
	const center = { x: base.x, y: base.y + (head.y - base.y) * 0.65, z: base.z };
	const dx = from.x - center.x;
	const dy = from.y - center.y;
	const dz = from.z - center.z;
	const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
	const dir = { x: dx / length, y: dy / length, z: dz / length };
	const contact = { x: center.x + dir.x * 0.75, y: center.y + dir.y * 0.75, z: center.z + dir.z * 0.75 };

	const vars = new MolangVariableMap();
	vars.setVector3("variable.dir", dir);
	const dimension = hurtEntity.dimension;
	dimension.spawnParticle("ph:xeonnite_ward_ring", contact, vars);
	dimension.spawnParticle("ph:xeonnite_ward_cross", contact, vars);
	dimension.spawnParticle("ph:xeonnite_ward_sparks", contact, vars);

	if (player) {
		player.playSound("random.anvil_land", { volume: 0.35, pitch: 1.8 });
		player.onScreenDisplay.setActionBar("§7Requires the §6Xeonnite Blessing");
	}
}

export function onBlessingHurt(acc: EntityHurtBeforeEvent): void {
	const dealer = damageDealer(acc);
	if (!dealer) return;

	const ownerId = getOwnerId(dealer);
	if (!ownerId) return;

	const hurtEntity = acc.hurtEntity;
	if (!hurtEntity.isValid) return;
	if (!hurtEntity.getComponent("minecraft:type_family")?.hasTypeFamily(TITAN_RIDGE_FAMILY)) return;

	const owner = world.getEntity(ownerId);
	const player = owner instanceof Player ? owner : undefined;
	if (player && isBlessed(player)) return;

	acc.cancel = true;

	if (!dealer.isValid) return;
	const from = dealer.getHeadLocation();
	system.run(() => {
		if (!hurtEntity.isValid) return;
		if (!hurtEntity.dimension.isChunkLoaded(hurtEntity.location)) return;
		showWard(hurtEntity, from, player?.isValid ? player : undefined);
	});
}

export function forgetWard(removedEntityId: string): void {
	lastWard.delete(removedEntityId);
}

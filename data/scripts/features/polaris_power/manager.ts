import {
	system,
	Dimension,
	Entity,
	EntityDamageCause,
	GameMode,
	InputPermissionCategory,
	ItemUseBeforeEvent,
	Player,
	StartupEvent,
	type Vector3
} from "@minecraft/server";
import { isLoadedLocation } from "../../core/location";

const ITEM_ID = "ph:a_part_of_polaris_power";
const COOLDOWN_CATEGORY = "polaris_power";
const COOLDOWN_TICKS = 200;
const STRIKE_TAG = "ph:polaris_strike";

const CHARGING_PROPERTY = "ph:polaris_charging";

const CHARGE_TICKS = 30;
const CHARGE_FX_INTERVAL = 5;

const LOCK_MAX_TICKS = CHARGE_TICKS + 20;

const BEAM_RANGE = 32;
const BEAM_DAMAGE = 100;
const BEAM_HIT_RADIUS = 1.2;
const CORE_STEP = 0.25;
const SPIRAL_STEP = 0.25;
const SPIRAL_RADIUS = 0.55;
const SPIRAL_TURN_LENGTH = 1.6;
const SKIP_FAMILIES = ["inanimate"];
const SKIP_TYPES = ["minecraft:item", "minecraft:xp_orb", "minecraft:player"];

interface ChargeLock {
	readonly anchor: Vector3;
	readonly interval: number;
}

const locks = new Map<string, ChargeLock>();

const readyAt = new Map<string, number>();

function add(a: Vector3, b: Vector3, scale = 1): Vector3 {
	return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

function cross(a: Vector3, b: Vector3): Vector3 {
	return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(v: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function distanceToSegment(point: Vector3, start: Vector3, dir: Vector3, length: number): number {
	const rel = { x: point.x - start.x, y: point.y - start.y, z: point.z - start.z };
	const along = Math.max(0, Math.min(length, rel.x * dir.x + rel.y * dir.y + rel.z * dir.z));
	const closest = add(start, dir, along);
	return Math.hypot(point.x - closest.x, point.y - closest.y, point.z - closest.z);
}

function spawn(dimension: Dimension, id: string, location: Vector3): void {
	if (!isLoadedLocation(dimension, location)) return;
	dimension.spawnParticle(id, location);
}

function lock(player: Player): void {
	release(player);

	if (!player.isValid) return;
	const anchor = { ...player.location };
	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
	player.setDynamicProperty(CHARGING_PROPERTY, true);

	let ticks = 0;
	const interval = system.runInterval(() => {
		if (!player.isValid || ++ticks > LOCK_MAX_TICKS) {
			release(player);
			return;
		}

		const loc = player.location;
		if (Math.abs(loc.x - anchor.x) + Math.abs(loc.y - anchor.y) + Math.abs(loc.z - anchor.z) > 0.01) {
			player.teleport(anchor);
		}

		if (ticks % CHARGE_FX_INTERVAL === 0) {
			spawn(player.dimension, "ph:polaris_charge", add(loc, { x: 0, y: 1, z: 0 }));
			player.dimension.playSound("beacon.ambient", loc, { pitch: 1 + ticks / CHARGE_TICKS, volume: 0.8 });
		}
	}, 1);

	locks.set(player.id, { anchor, interval });
}

function release(player: Player): void {
	const current = locks.get(player.id);
	if (current) {
		system.clearRun(current.interval);
		locks.delete(player.id);
	}
	if (!player.isValid) return;

	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
	player.setDynamicProperty(CHARGING_PROPERTY, undefined);
}

function beamLength(dimension: Dimension, start: Vector3, dir: Vector3): number {
	if (!isLoadedLocation(dimension, start)) return BEAM_RANGE;
	const blockHit = dimension.getBlockFromRay(start, dir, { maxDistance: BEAM_RANGE, includeLiquidBlocks: false, includePassableBlocks: false });
	if (!blockHit) return BEAM_RANGE;
	const face = add(blockHit.block.location, blockHit.faceLocation);
	return Math.hypot(face.x - start.x, face.y - start.y, face.z - start.z);
}

function fireBeam(player: Player): void {
	if (!player.isValid) return;
	const dimension = player.dimension;
	const start = player.getHeadLocation();
	const dir = normalize(player.getViewDirection());

	const length = beamLength(dimension, start, dir);
	const end = add(start, dir, length);

	const up = Math.abs(dir.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
	const u = normalize(cross(dir, up));
	const v = cross(dir, u);

	for (let d = 0; d <= length; d += CORE_STEP) spawn(dimension, "ph:polaris_beam_core", add(start, dir, d));

	for (let d = 0.6; d <= length; d += SPIRAL_STEP) {
		const angle = (d / SPIRAL_TURN_LENGTH) * Math.PI * 2;
		const center = add(start, dir, d);
		for (const offset of [0, Math.PI]) {
			const cos = Math.cos(angle + offset) * SPIRAL_RADIUS;
			const sin = Math.sin(angle + offset) * SPIRAL_RADIUS;
			spawn(dimension, "ph:polaris_beam_spiral", add(add(center, u, cos), v, sin));
		}
	}
	spawn(dimension, "ph:polaris_impact", end);

	dimension.playSound("mob.warden.sonic_boom", start, { pitch: 1.5, volume: 1 });
	dimension.playSound("beacon.power.select", start, { pitch: 1.8, volume: 1 });
	player.runCommand("camerashake add @s 0.4 0.2 positional");

	const midpoint = add(start, dir, length / 2);
	const targets = dimension.getEntities({
		location: midpoint,
		maxDistance: length / 2 + 3,
		excludeFamilies: SKIP_FAMILIES,
		excludeTypes: SKIP_TYPES
	});

	player.addTag(STRIKE_TAG);
	for (const target of targets) {
		if (!isInBeam(target, start, dir, length)) continue;
		if (!player.isValid) break;
		target.applyDamage(BEAM_DAMAGE, { cause: EntityDamageCause.magic, damagingEntity: player });
	}
	if (player.isValid) player.removeTag(STRIKE_TAG);
}

function isInBeam(target: Entity, start: Vector3, dir: Vector3, length: number): boolean {
	if (!target.isValid) return false;
	const feet = target.location;
	const head = target.getHeadLocation();
	const middle = { x: (feet.x + head.x) / 2, y: (feet.y + head.y) / 2, z: (feet.z + head.z) / 2 };
	return [feet, middle, head].some((point) => distanceToSegment(point, start, dir, length) <= BEAM_HIT_RADIUS);
}

function consumeOne(player: Player): void {
	if (player.getGameMode() === GameMode.Creative) return;

	const container = player.getComponent("minecraft:inventory")?.container;
	if (!container) return;

	const slot = player.selectedSlotIndex;
	const item = container.getItem(slot);
	if (item?.typeId !== ITEM_ID) return;

	if (item.amount <= 1) {
		container.setItem(slot, undefined);
	} else {
		item.amount--;
		container.setItem(slot, item);
	}
}

export function onPolarisItemUse(event: ItemUseBeforeEvent): void {
	if (event.itemStack.typeId !== ITEM_ID) return;
	if (system.currentTick < (readyAt.get(event.source.id) ?? 0)) event.cancel = true;
}

export function cancelPolarisCharge(itemStack: { typeId: string } | undefined, source: Player): void {
	if (itemStack?.typeId !== ITEM_ID) return;
	if (!locks.has(source.id)) return;
	release(source);
	if (!source.isValid) return;
	source.startItemCooldown(COOLDOWN_CATEGORY, 0);
}

export function registerPolarisComponent({ itemComponentRegistry }: StartupEvent): void {
	itemComponentRegistry.registerCustomComponent("ph:polaris_power", {
		onUse({ source }): void {
			lock(source);
		},
		onCompleteUse({ source }): void {
			release(source);
			readyAt.set(source.id, system.currentTick + COOLDOWN_TICKS);
			source.startItemCooldown(COOLDOWN_CATEGORY, COOLDOWN_TICKS);
			consumeOne(source);
			fireBeam(source);
		}
	});
}

export function onPolarisSpawn(player: Player, initialSpawn: boolean): void {
	if (!initialSpawn) return;
	if (player.getDynamicProperty(CHARGING_PROPERTY) === true) release(player);
}

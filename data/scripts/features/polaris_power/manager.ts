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

// ======================================== A Part of Polaris Power ========================================
// One-use beam item (stacks to 16, dropped by Gold Forge Troopers). Holding use charges
// it for 1.5s (use_modifiers in the item file); the player is pinned in place, even
// mid-air, until the charge ends. A finished charge fires one beam (a single 100-damage
// hit, not a sustained laser) wrapped in a gold double spiral, eats one item and starts
// the 10s cooldown.
//
// It is also the only damage the Titan Core accepts: its BP damage_sensor lets a hit
// through only while the attacker carries STRIKE_TAG, which fireBeam() sets for the
// duration of its applyDamage calls.

const ITEM_ID = "ph:a_part_of_polaris_power";
const COOLDOWN_CATEGORY = "polaris_power";
const COOLDOWN_TICKS = 200; // matches the item's cooldown duration (10s)
const STRIKE_TAG = "ph:polaris_strike";
// Set while movement is locked, so a player who quits mid-charge gets it back on rejoin.
const CHARGING_PROPERTY = "ph:polaris_charging";

const CHARGE_TICKS = 30; // must match use_modifiers.use_duration (1.5s)
const CHARGE_FX_INTERVAL = 5;
// Safety net if no stop/complete event arrives (unload, dimension swap).
const LOCK_MAX_TICKS = CHARGE_TICKS + 20;

const BEAM_RANGE = 32;
const BEAM_DAMAGE = 100;
const BEAM_HIT_RADIUS = 1.2;
const CORE_STEP = 0.25;
const SPIRAL_STEP = 0.25;
const SPIRAL_RADIUS = 0.55;
const SPIRAL_TURN_LENGTH = 1.6; // blocks of beam per full turn of each strand
const SKIP_FAMILIES = ["inanimate"];
const SKIP_TYPES = ["minecraft:item", "minecraft:xp_orb", "minecraft:player"];

interface ChargeLock {
	anchor: Vector3;
	interval: number;
}

const locks = new Map<string, ChargeLock>();
// Tick each player may charge again.
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
	try {
		dimension.spawnParticle(id, location);
	} catch {
		// Unloaded chunk along the beam; the rest still draws.
	}
}

// ======================================== Movement lock ========================================

function lock(player: Player): void {
	release(player);

	const anchor = { ...player.location };
	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
	player.setDynamicProperty(CHARGING_PROPERTY, true);

	let ticks = 0;
	const interval = system.runInterval(() => {
		if (!player.isValid || ++ticks > LOCK_MAX_TICKS) {
			release(player);
			return;
		}

		// Movement input is already off; this only cancels gravity and leftover momentum,
		// so a grounded player is never teleported.
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

	try {
		player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
		player.setDynamicProperty(CHARGING_PROPERTY, undefined);
	} catch {
		// Player left this tick; the rejoin handler restores movement.
	}
}

// ======================================== Beam ========================================

function fireBeam(player: Player): void {
	const dimension = player.dimension;
	const start = player.getHeadLocation();
	const dir = normalize(player.getViewDirection());

	// Solid blocks stop the beam.
	let length = BEAM_RANGE;
	const blockHit = dimension.getBlockFromRay(start, dir, { maxDistance: BEAM_RANGE, includeLiquidBlocks: false, includePassableBlocks: false });
	if (blockHit) {
		const face = add(blockHit.block.location, blockHit.faceLocation);
		length = Math.hypot(face.x - start.x, face.y - start.y, face.z - start.z);
	}
	const end = add(start, dir, length);

	// Two perpendicular axes around the beam for the spiral.
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
	try {
		for (const target of targets) {
			if (!isInBeam(target, start, dir, length)) continue;
			try {
				target.applyDamage(BEAM_DAMAGE, { cause: EntityDamageCause.magic, damagingEntity: player });
			} catch {
				// Target died or unloaded from an earlier hit in this loop.
			}
		}
	} finally {
		player.removeTag(STRIKE_TAG);
	}
}

// Checks the feet and the head so tall mobs (Titan Core is 2.4 high) are hit anywhere along their body.
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

// ======================================== Event handlers ========================================
// Subscribed in events/index.ts (world events) and events/loader.ts (startup).

// The cooldown component only draws the overlay: it starts on every use and never blocks
// a new charge, so the real 10s gate is this per-player tick stamp.
export function onPolarisItemUse(event: ItemUseBeforeEvent): void {
	if (event.itemStack.typeId !== ITEM_ID) return;
	if (system.currentTick < (readyAt.get(event.source.id) ?? 0)) event.cancel = true;
}

// Letting go before the charge finishes clears the overlay the engine started on use.
export function cancelPolarisCharge(itemStack: { typeId: string } | undefined, source: Player): void {
	if (itemStack?.typeId !== ITEM_ID) return;
	if (!locks.has(source.id)) return;
	release(source);
	try {
		source.startItemCooldown(COOLDOWN_CATEGORY, 0);
	} catch {
		// Player left this tick.
	}
}

// The item JSON binds this component. It owns charge start and the shot; the world event
// handlers above cover what item components have no hook for (cancelling a use, letting go early).
export function registerPolarisComponent({ itemComponentRegistry }: StartupEvent): void {
	itemComponentRegistry.registerCustomComponent("ph:polaris_power", {
		onUse({ source }) {
			lock(source);
		},
		onCompleteUse({ source }) {
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

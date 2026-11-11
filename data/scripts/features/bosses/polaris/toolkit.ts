import {
	world,
	Dimension,
	Entity,
	EntityDamageCause,
	GameMode,
	InputPermissionCategory,
	MolangVariableMap,
	Player,
	type RGBA,
	type Vector3,
	type VectorXZ
} from "@minecraft/server";
import { isLoadedLocation } from "~/core/location";

export const POLARIS_ID = "ph:polaris";
export const CLONE_ID = "ph:polaris_clone";
export const NODE_ID = "ph:polaris_node";
export const JUMP_LOCK_PROPERTY = "ph:polaris_jump_lock";

export const ARENA_HALF = 32;
export const FATAL_DAMAGE = 2147483647;
export const CORRUPTION_CAUSE = EntityDamageCause.thorns;

export const CYAN: RGBA = { red: 0.35, green: 0.95, blue: 1, alpha: 1 };
export const WHITE: RGBA = { red: 1, green: 1, blue: 1, alpha: 1 };
export const VIOLET: RGBA = { red: 0.72, green: 0.42, blue: 1, alpha: 1 };
export const GOLD: RGBA = { red: 1, green: 0.86, blue: 0.4, alpha: 1 };

const ARENA_SCAN = ARENA_HALF * Math.SQRT2 + 2;
const ARENA_HEIGHT = 12;
const FRIENDLY_FAMILIES = ["titan_ridge", "inanimate"];
const NON_TARGET_TYPES = ["minecraft:item", "minecraft:xp_orb"];
const BEAM_MAX_SIZE = 1.5;
const BEAM_OVERLAP = 1.4;
const BEAM_CORE_SCALE = 0.55;
const BEAM_HALO_ALPHA = 0.55;
const BEAM_MAX_PARTICLES = 500;
export const SKY_RIFT_INTERVAL = 20;
const SKY_RIFT_SIZE = 64;
const SKY_RIFT_HEIGHT = 36;
const SKY_RIFT_FLOOR = 0.06;
const SKY_RIFT_CLOSE_LIFE = 36;
const SKY_RIFT_MODES: Record<SkyRiftMode, number> = { hold: 0, open: 1, close: 2 };
const BASE_DAMAGE: Record<Phase, number> = { 1: 20, 2: 15 };
const ATTACK_REST: Record<Phase, number> = { 1: 80, 2: 40 };
const DOWN: Vector3 = { x: 0, y: -1, z: 0 };
const BODY_HEIGHT = 4;

export type Phase = 1 | 2;
export type Pose = "none" | "guard" | "channel" | "charge" | "stagger";
export type FightMode = "idle" | "attack" | "transition";
export type SkyRiftMode = "hold" | "open" | "close";
export type Hazard = (age: number) => boolean;
export type Attack = (fight: PolarisFight) => void;

interface Task {
	readonly at: number;
	readonly run: () => void;
}

interface HazardEntry {
	readonly start: number;
	readonly run: Hazard;
	busy: boolean;
}

export interface PolarisFight {
	readonly boss: Entity;
	readonly dimension: Dimension;
	readonly arena: Vector3;
	readonly tasks: Task[];
	readonly hazards: HazardEntry[];
	readonly helpers: Set<string>;
	readonly jumpLocked: Set<string>;
	phase: Phase;
	mode: FightMode;
	tick: number;
	attackIndex: number;
	attackStart: number;
	nextAttackAt: number;
	nextBoostAt: number;
	lastWardAt: number;
	invulnerable: boolean;
	target: Player | undefined;
}

export function baseDamage(fight: PolarisFight): number {
	return BASE_DAMAGE[fight.phase];
}

export function after(fight: PolarisFight, delay: number, run: () => void): void {
	if (delay <= 0) {
		run();
		return;
	}
	fight.tasks.push({ at: fight.tick + delay, run });
}

export function addHazard(fight: PolarisFight, run: Hazard): void {
	fight.hazards.push({ start: fight.tick, run, busy: false });
}

export function runSchedule(fight: PolarisFight): void {
	const tasks = fight.tasks;
	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i];
		if (task.at > fight.tick) continue;
		tasks.splice(i, 1);
		i--;
		task.run();
	}

	const hazards = fight.hazards;
	for (let i = 0; i < hazards.length; i++) {
		const hazard = hazards[i];
		if (!hazard.busy) {
			hazard.busy = true;
			const keep = hazard.run(fight.tick - hazard.start);
			hazard.busy = false;
			if (keep) continue;
		}
		const index = hazards.indexOf(hazard);
		if (index < 0) continue;
		hazards.splice(index, 1);
		i = index - 1;
	}
}

export function endAttack(fight: PolarisFight, rest: number = ATTACK_REST[fight.phase]): void {
	if (fight.mode !== "attack") return;
	fight.mode = "idle";
	fight.nextAttackAt = fight.tick + rest;
	if (!fight.boss.isValid) return;
	setPose(fight.boss, "none");
	fight.boss.triggerEvent("ph:state_chase");
}

export function wipe(fight: PolarisFight): void {
	fight.tasks.length = 0;
	fight.hazards.length = 0;
	fight.invulnerable = false;

	for (const id of fight.helpers) {
		const helper = world.getEntity(id);
		if (helper?.isValid) helper.remove();
	}
	fight.helpers.clear();

	for (const id of [...fight.jumpLocked]) unlockJump(fight, id);
	setPose(fight.boss, "none");
}

export function setPose(entity: Entity, pose: Pose): void {
	if (!entity.isValid) return;
	entity.setProperty("ph:pose", pose);
}

export function flatDistance(a: Vector3, b: Vector3): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

export function flatDirection(from: Vector3, to: Vector3): VectorXZ {
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	const length = Math.hypot(dx, dz);
	if (length < 0.001) return { x: 0, z: 1 };
	return { x: dx / length, z: dz / length };
}

export function offset(origin: Vector3, x: number, y: number, z: number): Vector3 {
	return { x: origin.x + x, y: origin.y + y, z: origin.z + z };
}

export function lerp(a: Vector3, b: Vector3, t: number): Vector3 {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function flatDistanceToSegment(point: Vector3, start: Vector3, end: Vector3): number {
	const dx = end.x - start.x;
	const dz = end.z - start.z;
	const lengthSquared = dx * dx + dz * dz;
	const t = lengthSquared > 0
		? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
		: 0;
	return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz));
}

export function distanceToSegment(point: Vector3, start: Vector3, end: Vector3): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const dz = end.z - start.z;
	const lengthSquared = dx * dx + dy * dy + dz * dz;
	const t = lengthSquared > 0
		? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared))
		: 0;
	return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy), point.z - (start.z + t * dz));
}

export function inArena(fight: PolarisFight, location: Vector3): boolean {
	const { arena } = fight;
	return Math.abs(location.x - arena.x) <= ARENA_HALF
		&& Math.abs(location.z - arena.z) <= ARENA_HALF
		&& Math.abs(location.y - arena.y) <= ARENA_HEIGHT;
}

function isTargetable(entity: Entity): boolean {
	if (!entity.isValid) return false;
	if (!(entity instanceof Player)) return true;
	const mode = entity.getGameMode();
	return mode !== GameMode.Creative && mode !== GameMode.Spectator;
}

function isAlive(entity: Entity): boolean {
	return (entity.getComponent("minecraft:health")?.currentValue ?? 0) > 0;
}

export function victimsNear(fight: PolarisFight, center: Vector3, radius: number): Entity[] {
	if (!isLoadedLocation(fight.dimension, center)) return [];
	return fight.dimension.getEntities({
		location: center,
		maxDistance: radius,
		excludeFamilies: FRIENDLY_FAMILIES,
		excludeTypes: NON_TARGET_TYPES
	}).filter(isTargetable);
}

export function arenaVictims(fight: PolarisFight): Entity[] {
	return victimsNear(fight, fight.arena, ARENA_SCAN).filter((entity): boolean => inArena(fight, entity.location));
}

export function arenaPlayers(fight: PolarisFight): Player[] {
	if (!isLoadedLocation(fight.dimension, fight.arena)) return [];
	return fight.dimension.getPlayers({
		location: fight.arena,
		maxDistance: ARENA_SCAN,
		excludeGameModes: [GameMode.Creative, GameMode.Spectator]
	}).filter((player): boolean => player.isValid && inArena(fight, player.location) && isAlive(player));
}

export function hit(fight: PolarisFight, target: Entity, damage: number, cause: EntityDamageCause): void {
	if (!fight.boss.isValid || !target.isValid) return;
	target.applyDamage(damage, { cause, damagingEntity: fight.boss });
}

export function fatal(target: Entity): void {
	if (!target.isValid) return;
	if (target.hasTag("parried")) target.removeTag("parried");
	target.applyDamage(FATAL_DAMAGE, { cause: EntityDamageCause.void });
}

export function announce(fight: PolarisFight, message: string): void {
	for (const player of arenaPlayers(fight)) player.onScreenDisplay.setActionBar(message);
}

export function showTitle(fight: PolarisFight, title: string, subtitle: string): void {
	if (!fight.boss.isValid) return;
	fight.boss.runCommand(`title @a[r=64] title ${title}`);
	fight.boss.runCommand(`title @a[r=64] subtitle ${subtitle}`);
}

export function lockJump(fight: PolarisFight, player: Player): void {
	if (fight.jumpLocked.has(player.id) || !player.isValid) return;
	fight.jumpLocked.add(player.id);
	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, false);
	player.setDynamicProperty(JUMP_LOCK_PROPERTY, true);
}

export function releaseJump(player: Player): void {
	if (!player.isValid) return;
	player.inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, true);
	player.setDynamicProperty(JUMP_LOCK_PROPERTY, undefined);
}

export function unlockJump(fight: PolarisFight, playerId: string): void {
	if (!fight.jumpLocked.delete(playerId)) return;
	const player = world.getEntity(playerId);
	if (player instanceof Player) releaseJump(player);
}

export function spawnHelper(fight: PolarisFight, typeId: string, location: Vector3): Entity | undefined {
	if (!isLoadedLocation(fight.dimension, location)) return undefined;
	const helper = fight.dimension.spawnEntity(typeId, location);
	fight.helpers.add(helper.id);
	return helper;
}

export function removeHelper(fight: PolarisFight, helper: Entity): void {
	fight.helpers.delete(helper.id);
	if (helper.isValid) helper.remove();
}

export function standPoint(fight: PolarisFight, x: number, z: number, nearY: number): Vector3 | undefined {
	const dimension = fight.dimension;
	const top = { x, y: nearY + 3, z };
	if (!isLoadedLocation(dimension, top)) return undefined;

	const floor = dimension.getBlockFromRay(top, DOWN, {
		maxDistance: 12,
		includeLiquidBlocks: false,
		includePassableBlocks: false
	});
	if (!floor) return undefined;

	const y = floor.block.y + 1;
	for (let rise = 0; rise < BODY_HEIGHT; rise++) {
		const space = { x, y: y + rise, z };
		if (!isLoadedLocation(dimension, space)) return undefined;
		const block = dimension.getBlock(space);
		if (block && !block.isAir && !block.isLiquid) return undefined;
	}
	return { x, y, z };
}

export function pointAround(fight: PolarisFight, center: Vector3, minRadius: number, maxRadius: number): Vector3 | undefined {
	for (let attempt = 0; attempt < 8; attempt++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = minRadius + Math.random() * (maxRadius - minRadius);
		const x = center.x + Math.cos(angle) * radius;
		const z = center.z + Math.sin(angle) * radius;
		if (Math.abs(x - fight.arena.x) > ARENA_HALF || Math.abs(z - fight.arena.z) > ARENA_HALF) continue;
		const point = standPoint(fight, x, z, center.y);
		if (point) return point;
	}
	return undefined;
}

export function arenaStand(fight: PolarisFight): Vector3 {
	return standPoint(fight, fight.arena.x, fight.arena.z, fight.arena.y) ?? fight.arena;
}

export function clearRun(fight: PolarisFight, start: Vector3, direction: VectorXZ, length: number): number {
	const eye = offset(start, 0, 1.5, 0);
	if (!isLoadedLocation(fight.dimension, eye)) return 0;
	const wall = fight.dimension.getBlockFromRay(eye, { x: direction.x, y: 0, z: direction.z }, {
		maxDistance: length,
		includeLiquidBlocks: false,
		includePassableBlocks: false
	});
	if (!wall) return length;
	const face = offset(wall.block.location, wall.faceLocation.x, wall.faceLocation.y, wall.faceLocation.z);
	return Math.max(0, flatDistance(eye, face) - 1.2);
}

export function blinkTo(fight: PolarisFight, entity: Entity, point: Vector3, facing?: Vector3): void {
	if (!entity.isValid) return;
	const color = fight.phase === 2 ? VIOLET : CYAN;
	drawBurst(fight, offset(entity.location, 0, 1.8, 0), 2.4, color);
	entity.teleport(point, facing ? { facingLocation: facing } : undefined);
	drawBurst(fight, offset(point, 0, 1.8, 0), 2.4, color);
	playSound(fight, "mob.endermen.portal", point, 1.4, 0.8);
	entity.playAnimation("animation.polaris.blink");
}

function tinted(color: RGBA): MolangVariableMap {
	const vars = new MolangVariableMap();
	vars.setColorRGBA("variable.color", color);
	return vars;
}

export function faded(color: RGBA, alpha: number): RGBA {
	return { red: color.red, green: color.green, blue: color.blue, alpha };
}

function spawnBeam(fight: PolarisFight, center: Vector3, half: Vector3, count: number, size: number, lifeTicks: number, color: RGBA): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	const vars = tinted(color);
	vars.setFloat("variable.half_x", half.x);
	vars.setFloat("variable.half_y", half.y);
	vars.setFloat("variable.half_z", half.z);
	vars.setFloat("variable.count", count);
	vars.setFloat("variable.size", size);
	vars.setFloat("variable.life", lifeTicks / 20);
	fight.dimension.spawnParticle("ph:polaris_beam", center, vars);
}

function drawBeamLayer(fight: PolarisFight, from: Vector3, to: Vector3, width: number, size: number, lifeTicks: number, color: RGBA): void {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dz = to.z - from.z;
	const length = Math.hypot(dx, dy, dz);
	const side = Math.max(0, width / 2 - BEAM_MAX_SIZE);
	const perBlock = Math.max(1.5, Math.min(8, BEAM_OVERLAP / size)) * (1 + side);
	const aligned = [dx, dy, dz].filter((part): boolean => Math.abs(part) > 0.01).length === 1;

	if (aligned) {
		const half = {
			x: Math.abs(dx) > 0.01 ? length / 2 : side,
			y: Math.abs(dy) > 0.01 ? length / 2 : 0,
			z: Math.abs(dz) > 0.01 ? length / 2 : side
		};
		const count = Math.max(4, Math.min(BEAM_MAX_PARTICLES, Math.ceil(length * perBlock)));
		spawnBeam(fight, lerp(from, to, 0.5), half, count, size, lifeTicks, color);
		return;
	}

	const pieces = Math.ceil(length / Math.max(0.3, Math.min(2, size * 0.7)));
	const half = { x: side, y: 0, z: side };
	for (let piece = 0; piece < pieces; piece++) {
		spawnBeam(fight, lerp(from, to, (piece + 0.5) / pieces), half, 1 + Math.round(side), size, lifeTicks, color);
	}
}

export function drawLine(fight: PolarisFight, from: Vector3, to: Vector3, width: number, lifeTicks: number, color: RGBA): void {
	if (Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) < 0.01) return;
	const size = Math.max(0.12, Math.min(BEAM_MAX_SIZE, width / 2));
	if (color.alpha < 0.9) {
		drawBeamLayer(fight, from, to, width, size, lifeTicks, color);
		return;
	}
	drawBeamLayer(fight, from, to, width, size, lifeTicks, faded(fight.phase === 2 ? VIOLET : CYAN, BEAM_HALO_ALPHA));
	drawBeamLayer(fight, from, to, width, size * BEAM_CORE_SCALE, lifeTicks, color);
}

export function drawLane(fight: PolarisFight, from: Vector3, to: Vector3, width: number, lifeTicks: number, color: RGBA): void {
	const middle = lerp(from, to, 0.5);
	if (!isLoadedLocation(fight.dimension, middle)) return;
	const alongX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
	const halfLength = (alongX ? Math.abs(to.x - from.x) : Math.abs(to.z - from.z)) / 2;

	const vars = tinted(color);
	vars.setFloat("variable.half_x", alongX ? halfLength : width / 2);
	vars.setFloat("variable.half_z", alongX ? width / 2 : halfLength);
	vars.setFloat("variable.across_z", alongX ? 1 : 0);
	vars.setFloat("variable.life", lifeTicks / 20);
	fight.dimension.spawnParticle("ph:polaris_lane", middle, vars);
}

export function drawSkyRift(fight: PolarisFight, mode: SkyRiftMode): void {
	const center = offset(fight.arena, 0, fight.phase === 2 ? SKY_RIFT_FLOOR : SKY_RIFT_HEIGHT, 0);
	if (!isLoadedLocation(fight.dimension, center)) return;
	const vars = new MolangVariableMap();
	vars.setFloat("variable.half", SKY_RIFT_SIZE / 2);
	vars.setFloat("variable.mode", SKY_RIFT_MODES[mode]);
	vars.setFloat("variable.life", (mode === "close" ? SKY_RIFT_CLOSE_LIFE : SKY_RIFT_INTERVAL + 2) / 20);
	fight.dimension.spawnParticle(fight.phase === 2 ? "ph:polaris_rift_nebula" : "ph:polaris_rift_stars", center, vars);
}

export function drawTile(fight: PolarisFight, center: Vector3, halfSize: number, lifeTicks: number, color: RGBA): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	const vars = tinted(color);
	vars.setFloat("variable.size", halfSize);
	vars.setFloat("variable.life", lifeTicks / 20);
	fight.dimension.spawnParticle("ph:polaris_tile", center, vars);
}

export function drawRing(fight: PolarisFight, center: Vector3, fromRadius: number, toRadius: number, lifeTicks: number, color: RGBA): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	const vars = tinted(color);
	vars.setFloat("variable.r0", fromRadius);
	vars.setFloat("variable.r1", toRadius);
	vars.setFloat("variable.life", lifeTicks / 20);
	fight.dimension.spawnParticle("ph:polaris_ring", center, vars);
}

export function drawPortal(fight: PolarisFight, center: Vector3, facing: Vector3, radius: number, lifeTicks: number, color: RGBA): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	const dx = facing.x - center.x;
	const dy = facing.y - center.y;
	const dz = facing.z - center.z;
	const length = Math.hypot(dx, dy, dz);
	if (length < 0.01) return;
	const vars = tinted(color);
	vars.setVector3("variable.dir", { x: dx / length, y: dy / length, z: dz / length });
	vars.setFloat("variable.size", radius);
	vars.setFloat("variable.life", lifeTicks / 20);
	fight.dimension.spawnParticle("ph:polaris_portal", center, vars);
}

export function drawBurst(fight: PolarisFight, center: Vector3, size: number, color: RGBA): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	const vars = tinted(color);
	vars.setFloat("variable.size", size);
	fight.dimension.spawnParticle("ph:polaris_burst", center, vars);
	fight.dimension.spawnParticle("ph:polaris_sparks", center, vars);
}

export function orbVars(size: number, lifeTicks: number, color: RGBA): MolangVariableMap {
	const vars = tinted(color);
	vars.setFloat("variable.size", size);
	vars.setFloat("variable.life", lifeTicks / 20);
	return vars;
}

export function drawOrb(fight: PolarisFight, center: Vector3, vars: MolangVariableMap): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	fight.dimension.spawnParticle("ph:polaris_orb", center, vars);
}

export function drawMotes(fight: PolarisFight, center: Vector3, halfSize: number, count: number, color: RGBA): void {
	if (!isLoadedLocation(fight.dimension, center)) return;
	const vars = tinted(color);
	vars.setFloat("variable.size", halfSize);
	vars.setFloat("variable.count", count);
	fight.dimension.spawnParticle("ph:polaris_motes", center, vars);
}

export function playSound(fight: PolarisFight, id: string, location: Vector3, pitch: number = 1, volume: number = 1): void {
	if (!isLoadedLocation(fight.dimension, location)) return;
	fight.dimension.playSound(id, location, { pitch, volume });
}

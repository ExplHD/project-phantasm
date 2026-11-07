import { system, Player, Entity, Dimension, type Vector3 } from "@minecraft/server";
import { type StrikeStats, strikeStats, strikeEntity, canWeaponHit, EXCLUDED_TYPES, EXCLUDED_FAMILIES } from "./damage";
import { isLoadedLocation } from "../../core/location";

export interface ProjectileBlast {
	readonly radius: number;
	readonly damage: number;
	readonly knockback?: number;
}

export interface MuzzleOffset {
	readonly forward?: number;
	readonly side?: number;
	readonly up?: number;
}

export interface ProjectileConfig {
	readonly damage: number;
	readonly speed: number;
	readonly range: number;
	readonly pierce?: number;
	readonly homing?: number;
	readonly lockCone?: number;
	readonly spread?: number[];
	readonly origin?: MuzzleOffset;
	readonly core?: string;
	readonly trail?: string;
	readonly impact?: string[];
	readonly impactSound?: string;
	readonly impactPitch?: number;
	readonly knockback?: number;
	readonly blast?: ProjectileBlast;
}

interface Bolt {
	readonly owner: Player;
	readonly dimension: Dimension;
	pos: Vector3;
	dir: Vector3;
	readonly config: ProjectileConfig;
	readonly stats: StrikeStats;
	target: Entity | undefined;
	travelled: number;
	pierceLeft: number;
	readonly hit: Set<string>;
}

const STEP = 0.45;

const bolts: Bolt[] = [];
let runner: number | undefined;

export function normalize(v: Vector3): Vector3 {
	const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
	return length > 0 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 };
}

function dot(a: Vector3, b: Vector3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

function rotateYaw(v: Vector3, degrees: number): Vector3 {
	const r = (degrees * Math.PI) / 180;
	const cos = Math.cos(r);
	const sin = Math.sin(r);
	return { x: v.x * cos - v.z * sin, y: v.y, z: v.x * sin + v.z * cos };
}

function steer(from: Vector3, to: Vector3, maxDegrees: number): Vector3 {
	const angle = Math.acos(Math.min(1, Math.max(-1, dot(from, to))));
	const max = (maxDegrees * Math.PI) / 180;
	if (angle <= max || angle < 1e-4) return to;
	const t = max / angle;
	return normalize({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
}

function bodyCenter(entity: Entity): Vector3 {
	const base = entity.location;
	const head = entity.getHeadLocation();
	return { x: base.x, y: base.y + (head.y - base.y) * 0.6, z: base.z };
}

function lockTarget(owner: Player, eye: Vector3, view: Vector3, range: number, coneDegrees: number): Entity | undefined {
	if (coneDegrees <= 0 || !isLoadedLocation(owner.dimension, eye)) return undefined;
	const minDot = Math.cos((coneDegrees * Math.PI) / 180);
	let best: Entity | undefined;
	let bestDot = minDot;
	for (const entity of owner.dimension.getEntities({ location: eye, maxDistance: range, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES })) {
		if (!canWeaponHit(owner, entity)) continue;
		const center = bodyCenter(entity);
		const offset = { x: center.x - eye.x, y: center.y - eye.y, z: center.z - eye.z };
		const distance = Math.sqrt(dot(offset, offset));
		if (distance < 0.5) continue;
		const facing = dot(view, offset) / distance;
		if (facing <= bestDot) continue;
		const wall = owner.dimension.getBlockFromRay(eye, normalize(offset), { maxDistance: distance, includePassableBlocks: false, includeLiquidBlocks: false });
		if (wall) continue;
		best = entity;
		bestDot = facing;
	}
	return best;
}

export function muzzlePoint(player: Player, origin: MuzzleOffset | undefined): Vector3 {
	const view = normalize(player.getViewDirection());
	const eye = player.getHeadLocation();
	const right = normalize({ x: -view.z, y: 0, z: view.x });
	const forward = origin?.forward ?? 0.6;
	const side = origin?.side ?? 0;
	const up = origin?.up ?? -0.15;
	return {
		x: eye.x + view.x * forward + right.x * side,
		y: eye.y + view.y * forward + up,
		z: eye.z + view.z * forward + right.z * side
	};
}

export function fireProjectile(owner: Player, config: ProjectileConfig): void {
	if (!owner.isValid) return;
	const view = normalize(owner.getViewDirection());
	const eye = owner.getHeadLocation();
	const start = muzzlePoint(owner, config.origin);

	const target = lockTarget(owner, eye, view, config.range, config.lockCone ?? 12);
	const stats = strikeStats(owner, config.damage);

	for (const yaw of config.spread ?? [0]) {
		const aim = target ? bodyCenter(target) : { x: eye.x + view.x * 16, y: eye.y + view.y * 16, z: eye.z + view.z * 16 };
		const dir = yaw === 0 ? normalize({ x: aim.x - start.x, y: aim.y - start.y, z: aim.z - start.z }) : rotateYaw(view, yaw);
		bolts.push({
			owner,
			dimension: owner.dimension,
			pos: { ...start },
			dir,
			config,
			stats,
			target,
			travelled: 0,
			pierceLeft: config.pierce ?? 0,
			hit: new Set()
		});
	}

	runner ??= system.runInterval(tickBolts, 1);
}

function tickBolts(): void {
	for (let i = bolts.length - 1; i >= 0; i--) {
		if (!advance(bolts[i])) bolts.splice(i, 1);
	}
	if (bolts.length === 0 && runner !== undefined) {
		system.clearRun(runner);
		runner = undefined;
	}
}

function advance(bolt: Bolt): boolean {
	const { config, dimension } = bolt;
	if (!bolt.owner.isValid) return false;

	const steps = Math.max(1, Math.ceil(config.speed / STEP));
	const stepLength = config.speed / steps;
	const homing = (config.homing ?? 0) / steps;

	for (let s = 0; s < steps; s++) {
		if (!isLoadedLocation(dimension, bolt.pos)) return false;
		if (bolt.target && homing > 0) {
			if (bolt.target.isValid) {
				const center = bodyCenter(bolt.target);
				bolt.dir = steer(bolt.dir, normalize({ x: center.x - bolt.pos.x, y: center.y - bolt.pos.y, z: center.z - bolt.pos.z }), homing);
			} else {
				bolt.target = undefined;
			}
		}

		const wall = dimension.getBlockFromRay(bolt.pos, bolt.dir, { maxDistance: stepLength, includePassableBlocks: false, includeLiquidBlocks: false });
		const wallDistance = wall
			? Math.sqrt(
				(wall.block.location.x + wall.faceLocation.x - bolt.pos.x) ** 2 +
				(wall.block.location.y + wall.faceLocation.y - bolt.pos.y) ** 2 +
				(wall.block.location.z + wall.faceLocation.z - bolt.pos.z) ** 2
			)
			: Infinity;

		const hits = dimension.getEntitiesFromRay(bolt.pos, bolt.dir, {
			maxDistance: Math.min(stepLength, wallDistance),
			ignoreBlockCollision: true,
			excludeTypes: EXCLUDED_TYPES,
			excludeFamilies: EXCLUDED_FAMILIES
		});
		for (const { entity, distance } of hits.sort((a, b) => a.distance - b.distance)) {
			if (!bolt.owner.isValid) return false;
			if (bolt.hit.has(entity.id) || !canWeaponHit(bolt.owner, entity)) continue;
			bolt.hit.add(entity.id);
			strikeEntity(bolt.owner, entity, bolt.stats, normalize({ x: bolt.dir.x, y: 0, z: bolt.dir.z }), config.knockback ?? 0.35);
			if (bolt.pierceLeft-- <= 0) {
				impact(bolt, along(bolt, distance));
				return false;
			}
		}

		if (bolt.target?.isValid && !bolt.hit.has(bolt.target.id)) {
			const center = bodyCenter(bolt.target);
			const dx = center.x - bolt.pos.x, dy = center.y - bolt.pos.y, dz = center.z - bolt.pos.z;
			if (dx * dx + dy * dy + dz * dz < 0.7 * 0.7) {
				bolt.hit.add(bolt.target.id);
				strikeEntity(bolt.owner, bolt.target, bolt.stats, normalize({ x: bolt.dir.x, y: 0, z: bolt.dir.z }), config.knockback ?? 0.35);
				if (bolt.pierceLeft-- <= 0) {
					impact(bolt, bolt.pos);
					return false;
				}
				bolt.target = undefined;
			}
		}

		if (wall) {
			impact(bolt, along(bolt, wallDistance));
			return false;
		}

		bolt.pos = along(bolt, stepLength);
		bolt.travelled += stepLength;
		if (!isLoadedLocation(dimension, bolt.pos)) return false;
		if (config.core) dimension.spawnParticle(config.core, bolt.pos);
		if (bolt.travelled >= config.range) {
			impact(bolt, bolt.pos);
			return false;
		}
	}

	if (config.trail) dimension.spawnParticle(config.trail, bolt.pos);
	return true;
}

function along(bolt: Bolt, distance: number): Vector3 {
	return { x: bolt.pos.x + bolt.dir.x * distance, y: bolt.pos.y + bolt.dir.y * distance, z: bolt.pos.z + bolt.dir.z * distance };
}

function impact(bolt: Bolt, at: Vector3): void {
	if (!isLoadedLocation(bolt.dimension, at)) return;
	for (const particle of bolt.config.impact ?? []) bolt.dimension.spawnParticle(particle, at);
	if (bolt.config.impactSound) bolt.dimension.playSound(bolt.config.impactSound, at, { volume: 0.6, pitch: (bolt.config.impactPitch ?? 1.2) + Math.random() * 0.4 });
	if (bolt.config.blast) detonate(bolt, at, bolt.config.blast);
}

function detonate(bolt: Bolt, at: Vector3, blast: ProjectileBlast): void {
	const stats = { ...bolt.stats, damage: bolt.stats.damage * (blast.damage / bolt.config.damage) };
	const targets = bolt.dimension.getEntities({ location: at, maxDistance: blast.radius, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES });
	for (const entity of targets) {
		if (!bolt.owner.isValid) return;
		if (bolt.hit.has(entity.id) || !canWeaponHit(bolt.owner, entity)) continue;
		const push = normalize({ x: entity.location.x - at.x, y: 0, z: entity.location.z - at.z });
		strikeEntity(bolt.owner, entity, stats, push, blast.knockback ?? 1);
	}
}

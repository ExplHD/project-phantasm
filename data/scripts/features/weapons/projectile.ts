import { system, Player, Entity, Dimension, type Vector3 } from "@minecraft/server";
import { type StrikeStats, strikeStats, strikeEntity, canWeaponHit, EXCLUDED_TYPES, EXCLUDED_FAMILIES } from "./damage";

// ======================================== Weapon projectiles ========================================
// Script-driven bolts for ranged weapons. Nothing is summoned: each bolt is a point moved
// a few sub-steps per tick, raycast against blocks and entity hitboxes along the way, and
// drawn with particles. Damage names the player directly, so the Xeonnite Blessing,
// damage indicators and kill credit all see the wielder as the attacker.

export interface ProjectileConfig {
	/** Base damage per hit, scaled by Strength/Weakness/Sharpness like melee. */
	damage: number;
	/** Blocks per tick. */
	speed: number;
	/** Blocks before the bolt fizzles out. */
	range: number;
	/** Extra entities the bolt passes through before stopping. Default 0. */
	pierce?: number;
	/** Max steering towards the locked target, in degrees per tick. 0 flies straight. */
	homing?: number;
	/** Half-angle (degrees) around the crosshair in which a target gets locked. Default 12. */
	lockCone?: number;
	/** Yaw offsets in degrees, one bolt each. Default [0]. */
	spread?: number[];
	/** Launch point relative to the eyes: along the view, to the right, and up. */
	origin?: { forward?: number; side?: number; up?: number };
	/** Particle drawn along the path every sub-step. */
	core: string;
	/** Particle left behind once per tick. */
	trail?: string;
	/** Particles played where the bolt stops. */
	impact?: string[];
	impactSound?: string;
	/** Knockback multiplier relative to a melee hit. Default 0.35. */
	knockback?: number;
}

interface Bolt {
	owner: Player;
	dimension: Dimension;
	pos: Vector3;
	dir: Vector3;
	config: ProjectileConfig;
	stats: StrikeStats;
	target: Entity | undefined;
	travelled: number;
	pierceLeft: number;
	hit: Set<string>;
}

// Sub-step length: short enough that the core particles read as one continuous streak.
const STEP = 0.45;

const bolts: Bolt[] = [];
let runner: number | undefined;

// -------- Vector helpers ----------

function normalize(v: Vector3): Vector3 {
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

/** Turns `from` towards `to` by at most `maxDegrees`. */
function steer(from: Vector3, to: Vector3, maxDegrees: number): Vector3 {
	const angle = Math.acos(Math.min(1, Math.max(-1, dot(from, to))));
	const max = (maxDegrees * Math.PI) / 180;
	if (angle <= max || angle < 1e-4) return to;
	const t = max / angle;
	return normalize({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
}

/** Roughly the middle of an entity's body, where a bolt should aim. */
function bodyCenter(entity: Entity): Vector3 {
	const base = entity.location;
	try {
		const head = entity.getHeadLocation();
		return { x: base.x, y: base.y + (head.y - base.y) * 0.6, z: base.z };
	} catch {
		return { x: base.x, y: base.y + 0.5, z: base.z };
	}
}

// -------- Targeting ----------

/** The visible target closest to the crosshair, if one sits inside the lock cone. */
function lockTarget(owner: Player, eye: Vector3, view: Vector3, range: number, coneDegrees: number): Entity | undefined {
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

// -------- Firing ----------

/**
 * Fires one bolt per `spread` entry from `owner`'s eyes towards the crosshair. All bolts of
 * a volley share the same locked target, so a fan converges on whatever the player aimed at.
 */
export function fireProjectile(owner: Player, config: ProjectileConfig): void {
	if (!owner.isValid) return;
	const view = normalize(owner.getViewDirection());
	const eye = owner.getHeadLocation();
	const right = normalize({ x: -view.z, y: 0, z: view.x });
	const forward = config.origin?.forward ?? 0.6;
	const side = config.origin?.side ?? 0;
	const up = config.origin?.up ?? -0.15;
	const start = {
		x: eye.x + view.x * forward + right.x * side,
		y: eye.y + view.y * forward + up,
		z: eye.z + view.z * forward + right.z * side
	};

	let target: Entity | undefined;
	try {
		target = lockTarget(owner, eye, view, config.range, config.lockCone ?? 12);
	} catch {
		target = undefined;
	}
	const stats = strikeStats(owner, config.damage);

	for (const yaw of config.spread ?? [0]) {
		let dir = rotateYaw(view, yaw);
		// Bolts launched off-centre aim at the crosshair point (or the target), not parallel to it.
		const aim = target ? bodyCenter(target) : { x: eye.x + view.x * 16, y: eye.y + view.y * 16, z: eye.z + view.z * 16 };
		if (yaw === 0) dir = normalize({ x: aim.x - start.x, y: aim.y - start.y, z: aim.z - start.z });
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

// -------- Flight ----------

function tickBolts(): void {
	for (let i = bolts.length - 1; i >= 0; i--) {
		let alive = false;
		try {
			alive = advance(bolts[i]);
		} catch {
			// Unloaded chunk or a dimension change under the bolt: drop it.
		}
		if (!alive) bolts.splice(i, 1);
	}
	if (bolts.length === 0 && runner !== undefined) {
		system.clearRun(runner);
		runner = undefined;
	}
}

/** Moves a bolt one tick. Returns false once it has stopped. */
function advance(bolt: Bolt): boolean {
	const { config, dimension } = bolt;
	if (!bolt.owner.isValid) return false;

	const steps = Math.max(1, Math.ceil(config.speed / STEP));
	const stepLength = config.speed / steps;
	const homing = (config.homing ?? 0) / steps;

	for (let s = 0; s < steps; s++) {
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
			if (bolt.hit.has(entity.id) || !canWeaponHit(bolt.owner, entity)) continue;
			bolt.hit.add(entity.id);
			strikeEntity(bolt.owner, entity, bolt.stats, normalize({ x: bolt.dir.x, y: 0, z: bolt.dir.z }), config.knockback ?? 0.35);
			if (bolt.pierceLeft-- <= 0) {
				impact(bolt, along(bolt, distance));
				return false;
			}
		}

		// A locked target close enough counts as hit even if the thin ray grazed past it.
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
		dimension.spawnParticle(config.core, bolt.pos);
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
	for (const particle of bolt.config.impact ?? []) bolt.dimension.spawnParticle(particle, at);
	if (bolt.config.impactSound) bolt.dimension.playSound(bolt.config.impactSound, at, { volume: 0.6, pitch: 1.2 + Math.random() * 0.4 });
}

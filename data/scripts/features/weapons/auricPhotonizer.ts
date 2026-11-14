import { Player, type Dimension, type Entity, type Vector3 } from "@minecraft/server";
import { isLoadedLocation } from "../../core/location";
import { canWeaponHit, strikeEntity, strikeStats, EXCLUDED_TYPES, EXCLUDED_FAMILIES } from "./damage";

const SCRIPTED_EVENT = "ph:scripted";
const BLADE_TYPE = "ph:copper_mech_double_blade";
const SWORD_TYPE = "ph:copper_mech_sword";
const CHEST_HEIGHT = 1;

const BARRAGE_LAUNCH_TICK = 5;
const BARRAGE_OUT_TICKS = 12;
const BARRAGE_RETURN_TICKS = 10;
const BARRAGE_RANGE = 12;
const BARRAGE_FAN_DEGREES = [-18, 0, 18];
const BARRAGE_DAMAGE = 40;
const BARRAGE_HIT_RADIUS = 2.2;
const BARRAGE_OUT_KNOCKBACK = 0.3;
const BARRAGE_RETURN_KNOCKBACK = 1;

const ETHEREAL_WAVE_TICKS = [8, 28, 48];
const ETHEREAL_STAB_DELAY = 20;
const ETHEREAL_SWORD_LINGER = 8;
const ETHEREAL_SWORDS_PER_WAVE = 8;
const ETHEREAL_RING_RADIUS = 6;
const ETHEREAL_HIT_RADIUS = 6.5;
const ETHEREAL_WAVE_DAMAGE = 35;
const ETHEREAL_FINALE_DAMAGE = 70;
const ETHEREAL_LOCK_RANGE = 20;
const ETHEREAL_NEAR_RANGE = 12;
const ETHEREAL_FALLBACK_DISTANCE = 6;
const ETHEREAL_SWORD_IMPULSE = 8;
const ETHEREAL_PIN_TICKS = 30;
const ETHEREAL_PIN_AMPLIFIER = 3;

interface ThrownBlade {
	readonly entity: Entity;
	readonly dir: Vector3;
	pos: Vector3;
}

interface Barrage {
	readonly player: Player;
	readonly dimension: Dimension;
	readonly facing: Vector3;
	origin: Vector3;
	readonly blades: ThrownBlade[];
	age: number;
	readonly struckOut: Set<string>;
	readonly struckBack: Set<string>;
}

interface EtherealWave {
	readonly swords: Entity[];
	readonly center: Vector3;
	readonly stabTick: number;
	readonly finale: boolean;
	stabbed: boolean;
}

interface EtherealCast {
	readonly player: Player;
	readonly dimension: Dimension;
	readonly target: Entity | undefined;
	center: Vector3;
	age: number;
	readonly waves: EtherealWave[];
}

const barrages = new Map<string, Barrage>();
const etherealCasts = new Map<string, EtherealCast>();

function horizontal(v: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.z);
	return length > 0 ? { x: v.x / length, y: 0, z: v.z / length } : { x: 0, y: 0, z: 1 };
}

function rotateY(v: Vector3, degrees: number): Vector3 {
	const radians = degrees * Math.PI / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return { x: v.x * cos - v.z * sin, y: 0, z: v.x * sin + v.z * cos };
}

function chest(entity: Entity): Vector3 {
	return { x: entity.location.x, y: entity.location.y + CHEST_HEIGHT, z: entity.location.z };
}

function distanceToSegment(point: Vector3, start: Vector3, end: Vector3): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const dz = end.z - start.z;
	const lengthSquared = dx * dx + dy * dy + dz * dz;
	const t = lengthSquared > 0
		? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared))
		: 0;
	return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy), point.z - (start.z + t * dz));
}

function removeAll(entities: readonly Entity[]): void {
	for (const entity of entities) {
		if (entity.isValid) entity.remove();
	}
}

export function castBladeBarrage(player: Player): void {
	const running = barrages.get(player.id);
	if (running) removeAll(running.blades.map(blade => blade.entity));
	barrages.set(player.id, {
		player,
		dimension: player.dimension,
		facing: horizontal(player.getViewDirection()),
		origin: chest(player),
		blades: [],
		age: 0,
		struckOut: new Set<string>(),
		struckBack: new Set<string>()
	});
}

function launchBlades(barrage: Barrage): void {
	barrage.origin = chest(barrage.player);
	if (!isLoadedLocation(barrage.dimension, barrage.origin)) return;
	for (const degrees of BARRAGE_FAN_DEGREES) {
		const entity = barrage.dimension.spawnEntity(BLADE_TYPE, barrage.origin, { spawnEvent: SCRIPTED_EVENT });
		barrage.blades.push({ entity, dir: rotateY(barrage.facing, degrees), pos: barrage.origin });
	}
	barrage.dimension.playSound("weapon_slash.slash_heavy", barrage.origin);
}

function bladePosition(barrage: Barrage, blade: ThrownBlade): Vector3 {
	const flight = barrage.age - BARRAGE_LAUNCH_TICK;
	const apex = {
		x: barrage.origin.x + blade.dir.x * BARRAGE_RANGE,
		y: barrage.origin.y,
		z: barrage.origin.z + blade.dir.z * BARRAGE_RANGE
	};
	if (flight <= BARRAGE_OUT_TICKS) {
		const t = flight / BARRAGE_OUT_TICKS;
		const eased = 1 - (1 - t) * (1 - t);
		return {
			x: barrage.origin.x + (apex.x - barrage.origin.x) * eased,
			y: barrage.origin.y,
			z: barrage.origin.z + (apex.z - barrage.origin.z) * eased
		};
	}
	const t = Math.min(1, (flight - BARRAGE_OUT_TICKS) / BARRAGE_RETURN_TICKS);
	const eased = t * t;
	const home = chest(barrage.player);
	return {
		x: apex.x + (home.x - apex.x) * eased,
		y: apex.y + (home.y - apex.y) * eased,
		z: apex.z + (home.z - apex.z) * eased
	};
}

function sweepBlade(barrage: Barrage, from: Vector3, to: Vector3, returning: boolean): void {
	const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 };
	if (!isLoadedLocation(barrage.dimension, middle)) return;
	const travel = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
	const struck = returning ? barrage.struckBack : barrage.struckOut;
	const stats = strikeStats(barrage.player, BARRAGE_DAMAGE);
	const push = horizontal({ x: to.x - from.x, y: 0, z: to.z - from.z });
	const entities = barrage.dimension.getEntities({
		location: middle,
		maxDistance: travel / 2 + BARRAGE_HIT_RADIUS + 1,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	});
	for (const entity of entities) {
		if (struck.has(entity.id) || !canWeaponHit(barrage.player, entity)) continue;
		if (distanceToSegment(chest(entity), from, to) > BARRAGE_HIT_RADIUS) continue;
		struck.add(entity.id);
		strikeEntity(barrage.player, entity, stats, { x: push.x, z: push.z }, returning ? BARRAGE_RETURN_KNOCKBACK : BARRAGE_OUT_KNOCKBACK);
	}
}

function tickBarrage(barrage: Barrage): boolean {
	if (!barrage.player.isValid || barrage.player.dimension.id !== barrage.dimension.id) return false;
	barrage.age++;
	if (barrage.age < BARRAGE_LAUNCH_TICK) return true;
	if (barrage.age === BARRAGE_LAUNCH_TICK) {
		launchBlades(barrage);
		return barrage.blades.length > 0;
	}

	const returning = barrage.age - BARRAGE_LAUNCH_TICK > BARRAGE_OUT_TICKS;
	for (const blade of barrage.blades) {
		if (!blade.entity.isValid) continue;
		const next = bladePosition(barrage, blade);
		sweepBlade(barrage, blade.pos, next, returning);
		blade.pos = next;
		if (blade.entity.isValid) blade.entity.teleport(next);
	}

	if (barrage.age < BARRAGE_LAUNCH_TICK + BARRAGE_OUT_TICKS + BARRAGE_RETURN_TICKS) return true;
	barrage.player.playSound("random.orb");
	return false;
}

function findEtherealTarget(player: Player): Entity | undefined {
	const aimed = player.getEntitiesFromViewDirection({
		maxDistance: ETHEREAL_LOCK_RANGE,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	});
	for (const hit of aimed) {
		if (canWeaponHit(player, hit.entity)) return hit.entity;
	}
	const nearby = player.dimension.getEntities({
		location: player.location,
		maxDistance: ETHEREAL_NEAR_RANGE,
		closest: 4,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	});
	return nearby.find(entity => canWeaponHit(player, entity));
}

export function castEtherealBlade(player: Player): void {
	const running = etherealCasts.get(player.id);
	if (running) removeAll(running.waves.flatMap(wave => wave.swords));
	const target = findEtherealTarget(player);
	const facing = horizontal(player.getViewDirection());
	const fallback = {
		x: player.location.x + facing.x * ETHEREAL_FALLBACK_DISTANCE,
		y: player.location.y,
		z: player.location.z + facing.z * ETHEREAL_FALLBACK_DISTANCE
	};
	etherealCasts.set(player.id, {
		player,
		dimension: player.dimension,
		target,
		center: target ? { ...target.location } : fallback,
		age: 0,
		waves: []
	});
}

function hittableAround(cast: EtherealCast, center: Vector3, radius: number): Entity[] {
	if (!isLoadedLocation(cast.dimension, center)) return [];
	return cast.dimension.getEntities({
		location: center,
		maxDistance: radius,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	}).filter(entity => canWeaponHit(cast.player, entity));
}

function spawnWave(cast: EtherealCast, index: number): void {
	if (cast.target?.isValid) cast.center = { ...cast.target.location };
	const center = cast.center;
	const finale = index === ETHEREAL_WAVE_TICKS.length - 1;
	const wave: EtherealWave = { swords: [], center, stabTick: cast.age + ETHEREAL_STAB_DELAY, finale, stabbed: false };
	cast.waves.push(wave);
	if (!isLoadedLocation(cast.dimension, center)) return;

	const offset = index * Math.PI / ETHEREAL_SWORDS_PER_WAVE;
	for (let i = 0; i < ETHEREAL_SWORDS_PER_WAVE; i++) {
		const angle = offset + i * 2 * Math.PI / ETHEREAL_SWORDS_PER_WAVE;
		const at = {
			x: center.x + Math.cos(angle) * ETHEREAL_RING_RADIUS,
			y: center.y + CHEST_HEIGHT,
			z: center.z + Math.sin(angle) * ETHEREAL_RING_RADIUS
		};
		if (!isLoadedLocation(cast.dimension, at)) continue;
		const yaw = Math.atan2(-(center.x - at.x), center.z - at.z) * 180 / Math.PI;
		const sword = cast.dimension.spawnEntity(SWORD_TYPE, at, { initialRotation: yaw, spawnEvent: SCRIPTED_EVENT });
		sword.setRotation({ x: 0, y: yaw });
		wave.swords.push(sword);
	}

	for (const entity of hittableAround(cast, center, ETHEREAL_HIT_RADIUS)) {
		entity.addEffect("slowness", ETHEREAL_PIN_TICKS, { amplifier: ETHEREAL_PIN_AMPLIFIER, showParticles: false });
	}
	cast.dimension.playSound("weapon_slash.slash_clash", center);
}

function stabWave(cast: EtherealCast, wave: EtherealWave): void {
	wave.stabbed = true;
	const center = wave.center;
	for (const sword of wave.swords) {
		if (!sword.isValid) continue;
		const dir = horizontal({ x: center.x - sword.location.x, y: 0, z: center.z - sword.location.z });
		sword.applyImpulse({ x: dir.x * ETHEREAL_SWORD_IMPULSE, y: 0, z: dir.z * ETHEREAL_SWORD_IMPULSE });
	}

	const stats = strikeStats(cast.player, wave.finale ? ETHEREAL_FINALE_DAMAGE : ETHEREAL_WAVE_DAMAGE);
	for (const entity of hittableAround(cast, center, ETHEREAL_HIT_RADIUS)) {
		const push = horizontal({ x: entity.location.x - center.x, y: 0, z: entity.location.z - center.z });
		strikeEntity(cast.player, entity, stats, { x: push.x, z: push.z }, wave.finale ? 1 : 0.2);
	}

	if (!isLoadedLocation(cast.dimension, center)) return;
	cast.dimension.playSound("custom_sfx.judgement_cut", center);
	if (!wave.finale) return;
	const burst = { x: center.x, y: center.y + 0.5, z: center.z };
	cast.dimension.spawnParticle("ph:auric_photonizer_explode", burst);
	cast.dimension.spawnParticle("ph:copper_mech_explosion", burst);
	cast.dimension.playSound("random.explode", center);
}

function tickEthereal(cast: EtherealCast): boolean {
	if (!cast.player.isValid || cast.player.dimension.id !== cast.dimension.id) return false;
	cast.age++;

	const waveIndex = ETHEREAL_WAVE_TICKS.indexOf(cast.age);
	if (waveIndex >= 0) spawnWave(cast, waveIndex);

	let pending = cast.waves.length < ETHEREAL_WAVE_TICKS.length;
	for (const wave of cast.waves) {
		if (!wave.stabbed && cast.age >= wave.stabTick) stabWave(cast, wave);
		if (cast.age < wave.stabTick + ETHEREAL_SWORD_LINGER) {
			pending = true;
			continue;
		}
		removeAll(wave.swords);
		wave.swords.length = 0;
	}
	return pending;
}

export function tickAuricPhotonizer(): void {
	for (const [id, barrage] of barrages) {
		if (tickBarrage(barrage)) continue;
		removeAll(barrage.blades.map(blade => blade.entity));
		barrages.delete(id);
	}
	for (const [id, cast] of etherealCasts) {
		if (tickEthereal(cast)) continue;
		removeAll(cast.waves.flatMap(wave => wave.swords));
		etherealCasts.delete(id);
	}
}

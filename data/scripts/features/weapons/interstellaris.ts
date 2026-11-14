import { system, MolangVariableMap, Player, type Dimension, type Entity, type EntityHurtBeforeEvent, type Vector3 } from "@minecraft/server";
import { setScore } from "../../core/scoreboard";
import { isLoadedLocation, isOpenLocation } from "../../core/location";
import { applyCustomDamage, canWeaponHit, strikeEntity, strikeStats, EXCLUDED_TYPES, EXCLUDED_FAMILIES } from "./damage";

const CORE_OBJECTIVE = "interstellaris_core";
const SHIELD_OBJECTIVE = "interstellaris_shield";
const FORCEFIELD_COOLDOWN_OBJECTIVE = "interstellaris_s1";

const CORE_MAX = 7;
const CORE_LIFETIME_TICKS = 140;
const CORE_PULSE_TICKS = 10;
const CORE_DAMAGE = 7;
const CORE_RADIUS = 3;
const CORE_HEIGHT = 1;
const CORE_SPAWN_MIN = 3;
const CORE_SPAWN_MAX = 10;
const CORE_SPAWN_TRIES = 8;

const FORCEFIELD_MAX_CORES = 4;
const FORCEFIELD_PER_CORE = 15;
const FORCEFIELD_TICKS = 300;

const MISSILE_DAMAGE = 32;
const MISSILE_RADIUS = 5;
const MISSILE_SPEED = 1.1;
const MISSILE_LIFETIME_TICKS = 70;
const MISSILE_STAGGER_TICKS = 2;
const MISSILE_LOCK_RANGE = 32;
const MISSILE_FALLBACK_RANGE = 12;

const VOYAGER_MIN_CORES = 5;
const VOYAGER_STEP_TICKS = 4;
const VOYAGER_SLASH_DAMAGE = 20;
const VOYAGER_SLASH_RADIUS = 4;
const VOYAGER_PLANT_TICKS = 7;
const VOYAGER_BLAST_DAMAGE = 17;
const VOYAGER_BLAST_RADIUS = 7;

const BLUE = { red: 0.43, green: 0.93, blue: 0.94, alpha: 1 };
const GOLD = { red: 1, green: 0.84, blue: 0.19, alpha: 1 };

interface StellarisCore {
	readonly dimension: Dimension;
	readonly base: Vector3;
	readonly bornTick: number;
}

interface CoreHolder {
	readonly player: Player;
	readonly cores: StellarisCore[];
}

interface Forcefield {
	readonly player: Player;
	hp: number;
	readonly until: number;
}

interface Missile {
	readonly owner: Player;
	readonly dimension: Dimension;
	pos: Vector3;
	dir: Vector3;
	readonly target: Entity | undefined;
	readonly fallback: Vector3;
	age: number;
	readonly struck: Set<string>;
}

interface Voyage {
	readonly player: Player;
	readonly stops: StellarisCore[];
	step: number;
	nextTick: number;
}

const holders = new Map<string, CoreHolder>();
const forcefields = new Map<string, Forcefield>();
const voyages = new Map<string, Voyage>();
const missiles: Missile[] = [];

function coreCenter(core: StellarisCore): Vector3 {
	return { x: core.base.x, y: core.base.y + CORE_HEIGHT, z: core.base.z };
}

function normalize(v: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.y, v.z);
	return length > 0 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 1, z: 0 };
}

function burst(dimension: Dimension, at: Vector3, size: number, color: typeof BLUE): void {
	if (!isLoadedLocation(dimension, at)) return;
	const vars = new MolangVariableMap();
	vars.setFloat("variable.size", size);
	vars.setColorRGBA("variable.color", color);
	dimension.spawnParticle("ph:polaris_burst", at, vars);
	dimension.spawnParticle("ph:interstellaris_nova", at, vars);
}

function strikeArea(player: Player, dimension: Dimension, center: Vector3, radius: number, damage: number, struck?: Set<string>): void {
	if (!player.isValid || !isLoadedLocation(dimension, center)) return;
	const stats = strikeStats(player, damage);
	const entities = dimension.getEntities({ location: center, maxDistance: radius, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES });
	for (const entity of entities) {
		if (!canWeaponHit(player, entity) || struck?.has(entity.id)) continue;
		struck?.add(entity.id);
		const push = normalize({ x: entity.location.x - center.x, y: 0, z: entity.location.z - center.z });
		strikeEntity(player, entity, stats, { x: push.x, z: push.z }, 0.5);
	}
}

function detonateCores(player: Player, popped: StellarisCore[]): void {
	if (popped.length === 0 || !player.isValid) return;
	const stacks = new Map<string, { readonly entity: Entity; count: number; readonly from: Vector3 }>();
	for (const core of popped) {
		const center = coreCenter(core);
		if (!isLoadedLocation(core.dimension, center)) continue;
		burst(core.dimension, center, CORE_RADIUS, BLUE);
		core.dimension.playSound("firework.blast", center);
		const entities = core.dimension.getEntities({ location: center, maxDistance: CORE_RADIUS, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES });
		for (const entity of entities) {
			if (!canWeaponHit(player, entity)) continue;
			const stack = stacks.get(entity.id);
			if (stack) stack.count++;
			else stacks.set(entity.id, { entity, count: 1, from: center });
		}
	}
	const base = strikeStats(player, CORE_DAMAGE);
	for (const { entity, count, from } of stacks.values()) {
		if (!entity.isValid) continue;
		const push = normalize({ x: entity.location.x - from.x, y: 0, z: entity.location.z - from.z });
		strikeEntity(player, entity, { ...base, damage: base.damage * count }, { x: push.x, z: push.z }, 0.3);
	}
}

function syncCoreCount(player: Player): void {
	setScore(player, CORE_OBJECTIVE, holders.get(player.id)?.cores.length ?? 0);
}

function takeCores(player: Player, amount: number): StellarisCore[] {
	const holder = holders.get(player.id);
	if (!holder) return [];
	const taken = holder.cores.splice(0, amount);
	if (holder.cores.length === 0) holders.delete(player.id);
	syncCoreCount(player);
	return taken;
}

function deny(player: Player, reason: string): boolean {
	player.playSound("note.bass");
	player.sendMessage(`§c${reason}`);
	return false;
}

function coreSpawnPoint(player: Player): Vector3 {
	const { x, y, z } = player.location;
	for (let i = 0; i < CORE_SPAWN_TRIES; i++) {
		const angle = Math.random() * Math.PI * 2;
		const distance = CORE_SPAWN_MIN + Math.random() * (CORE_SPAWN_MAX - CORE_SPAWN_MIN);
		const base = { x: x + Math.cos(angle) * distance, y, z: z + Math.sin(angle) * distance };
		if (isOpenLocation(player.dimension, base) && isOpenLocation(player.dimension, { x: base.x, y: y + 1, z: base.z })) return base;
	}
	return { x, y, z };
}

export function stellarisCoreCount(player: Player): number {
	return holders.get(player.id)?.cores.length ?? 0;
}

export function addStellarisCore(player: Player, target: Entity): void {
	if (!player.isValid || !target.isValid) return;
	const holder = holders.get(player.id) ?? { player, cores: [] };
	holders.set(player.id, holder);
	const core: StellarisCore = { dimension: player.dimension, base: coreSpawnPoint(player), bornTick: system.currentTick };
	holder.cores.push(core);
	const center = coreCenter(core);
	if (isLoadedLocation(core.dimension, center)) core.dimension.spawnParticle("ph:interstellaris_core", center);
	const overflow = holder.cores.length > CORE_MAX ? holder.cores.splice(0, holder.cores.length - CORE_MAX) : [];
	syncCoreCount(player);
	detonateCores(player, overflow);
}

export function canCastForcefield(player: Player): boolean {
	if (forcefields.has(player.id)) return deny(player, "Stellaris Forcefield is still active.");
	if (stellarisCoreCount(player) < 1) return deny(player, "Stellaris Forcefield needs at least 1 Stellaris Core.");
	return true;
}

export function castForcefield(player: Player): void {
	const spent = takeCores(player, FORCEFIELD_MAX_CORES);
	if (spent.length === 0) return;
	const hp = spent.length * FORCEFIELD_PER_CORE;
	forcefields.set(player.id, { player, hp, until: system.currentTick + FORCEFIELD_TICKS });
	setScore(player, SHIELD_OBJECTIVE, hp);
	player.playAnimation("animation.interstellaris.skill_1");
	for (const core of spent) burst(core.dimension, coreCenter(core), 1, GOLD);
	if (!isLoadedLocation(player.dimension, player.location)) return;
	player.dimension.spawnParticle("ph:interstellaris_forcefield", player.location);
	player.dimension.playSound("beacon.activate", player.location);
}

function dropForcefield(field: Forcefield, broken: boolean): void {
	const { player } = field;
	forcefields.delete(player.id);
	if (!player.isValid) return;
	setScore(player, SHIELD_OBJECTIVE, 0);
	setScore(player, FORCEFIELD_COOLDOWN_OBJECTIVE, 0);
	if (!isLoadedLocation(player.dimension, player.location)) return;
	const center = { x: player.location.x, y: player.location.y + 1, z: player.location.z };
	if (broken) burst(player.dimension, center, 2, BLUE);
	player.dimension.playSound(broken ? "random.glass" : "beacon.deactivate", center);
}

export function onInterstellarisHurt(event: EntityHurtBeforeEvent): void {
	const player = event.hurtEntity;
	if (!(player instanceof Player)) return;
	const field = forcefields.get(player.id);
	if (!field || event.damage <= 0) return;
	const cause = event.damageSource.cause;
	if (cause === "void" || cause === "selfDestruct") return;

	const absorbed = Math.min(field.hp, event.damage);
	field.hp -= absorbed;
	if (absorbed >= event.damage) event.cancel = true;
	else event.damage -= absorbed;

	system.run(() => {
		if (!player.isValid) return;
		if (field.hp <= 0) {
			if (forcefields.get(player.id) === field) dropForcefield(field, true);
			return;
		}
		setScore(player, SHIELD_OBJECTIVE, Math.ceil(field.hp));
		if (!isLoadedLocation(player.dimension, player.location)) return;
		player.dimension.spawnParticle("ph:interstellaris_forcefield", player.location);
		player.dimension.playSound("weapon_slash.slash_clash", player.location);
	});
}

export function canCastVow(player: Player): boolean {
	if (stellarisCoreCount(player) < 1) return deny(player, "Interstellar Vow needs at least 1 Stellaris Core.");
	return true;
}

export function castVow(player: Player): void {
	const spent = takeCores(player, CORE_MAX);
	if (spent.length === 0) return;
	const targets = player.dimension
		.getEntities({ location: player.location, maxDistance: MISSILE_LOCK_RANGE, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES })
		.filter(entity => canWeaponHit(player, entity));
	const head = player.getHeadLocation();
	const view = player.getViewDirection();
	const fallback = { x: head.x + view.x * MISSILE_FALLBACK_RANGE, y: head.y + view.y * MISSILE_FALLBACK_RANGE, z: head.z + view.z * MISSILE_FALLBACK_RANGE };
	const struck = new Set<string>();

	player.playAnimation("animation.interstellaris.skill_2");
	player.dimension.playSound("custom_sfx.prism_fire", player.location);
	spent.forEach((core, index) => {
		const pos = coreCenter(core);
		burst(core.dimension, pos, 1, GOLD);
		missiles.push({
			owner: player,
			dimension: core.dimension,
			pos,
			dir: { x: 0, y: 1, z: 0 },
			target: targets.length > 0 ? targets[index % targets.length] : undefined,
			fallback,
			age: -index * MISSILE_STAGGER_TICKS,
			struck
		});
	});
}

function missileAim(missile: Missile): Vector3 {
	const target = missile.target;
	if (!target?.isValid || target.dimension.id !== missile.dimension.id) return missile.fallback;
	const head = target.getHeadLocation();
	return { x: target.location.x, y: (target.location.y + head.y) / 2, z: target.location.z };
}

function explodeMissile(missile: Missile): void {
	burst(missile.dimension, missile.pos, MISSILE_RADIUS, BLUE);
	if (isLoadedLocation(missile.dimension, missile.pos)) missile.dimension.playSound("random.explode", missile.pos);
	strikeArea(missile.owner, missile.dimension, missile.pos, MISSILE_RADIUS, MISSILE_DAMAGE, missile.struck);
}

function stepMissile(missile: Missile): boolean {
	if (!missile.owner.isValid || !isLoadedLocation(missile.dimension, missile.pos)) return false;
	missile.age++;
	if (missile.age <= 0) {
		missile.dimension.spawnParticle("ph:interstellaris_core", missile.pos);
		return true;
	}

	const aim = missileAim(missile);
	const delta = { x: aim.x - missile.pos.x, y: aim.y - missile.pos.y, z: aim.z - missile.pos.z };
	const distance = Math.hypot(delta.x, delta.y, delta.z);
	if (distance <= MISSILE_SPEED || missile.age > MISSILE_LIFETIME_TICKS) {
		if (distance <= MISSILE_SPEED) missile.pos = aim;
		explodeMissile(missile);
		return false;
	}

	const turn = Math.min(1, 0.25 + missile.age * 0.08);
	const wanted = normalize(delta);
	missile.dir = normalize({
		x: missile.dir.x + (wanted.x - missile.dir.x) * turn,
		y: missile.dir.y + (wanted.y - missile.dir.y) * turn,
		z: missile.dir.z + (wanted.z - missile.dir.z) * turn
	});
	missile.pos = { x: missile.pos.x + missile.dir.x * MISSILE_SPEED, y: missile.pos.y + missile.dir.y * MISSILE_SPEED, z: missile.pos.z + missile.dir.z * MISSILE_SPEED };
	if (isLoadedLocation(missile.dimension, missile.pos)) missile.dimension.spawnParticle("ph:interstellaris_missile", missile.pos);
	return true;
}

export function canCastVoyager(player: Player): boolean {
	if (voyages.has(player.id)) return false;
	if (stellarisCoreCount(player) < VOYAGER_MIN_CORES) return deny(player, `Stellar Voyager needs at least ${VOYAGER_MIN_CORES} Stellaris Cores.`);
	return true;
}

export function castVoyager(player: Player): void {
	const stops = takeCores(player, CORE_MAX);
	if (stops.length === 0) return;
	voyages.set(player.id, { player, stops, step: 0, nextTick: system.currentTick + 2 });
	player.addEffect("resistance", stops.length * VOYAGER_STEP_TICKS + 30, { amplifier: 4, showParticles: false });
}

function stepVoyage(voyage: Voyage, now: number): boolean {
	const { player, stops } = voyage;
	if (!player.isValid) return false;
	if (now < voyage.nextTick) return true;

	if (voyage.step < stops.length) {
		const stop = stops[voyage.step];
		voyage.step++;
		voyage.nextTick = now + VOYAGER_STEP_TICKS;
		if (!stop || !isLoadedLocation(stop.dimension, stop.base)) return true;
		const from = { x: player.location.x, y: player.location.y + 1, z: player.location.z };
		if (isLoadedLocation(player.dimension, from)) player.dimension.spawnParticle("ph:interstellaris_sparks", from);
		player.teleport(stop.base, { dimension: stop.dimension, keepVelocity: false });
		player.playAnimation(voyage.step % 2 === 1 ? "animation.interstellaris.skill_3_slash_a" : "animation.interstellaris.skill_3_slash_b");
		burst(stop.dimension, coreCenter(stop), 1.5, GOLD);
		stop.dimension.playSound("weapon_slash.slash_medium", stop.base);
		applyCustomDamage(player, VOYAGER_SLASH_DAMAGE, VOYAGER_SLASH_RADIUS);
		return true;
	}

	if (voyage.step === stops.length) {
		voyage.step++;
		voyage.nextTick = now + VOYAGER_PLANT_TICKS;
		player.playAnimation("animation.interstellaris.skill_3_plant");
		player.runCommand("inputpermission set @s movement disabled");
		return true;
	}

	const center = { x: player.location.x, y: player.location.y + 0.5, z: player.location.z };
	burst(player.dimension, center, VOYAGER_BLAST_RADIUS, BLUE);
	burst(player.dimension, center, VOYAGER_BLAST_RADIUS * 0.6, GOLD);
	if (isLoadedLocation(player.dimension, center)) {
		player.dimension.playSound("random.explode", center);
		player.dimension.playSound("custom_sfx.judgement_cut", center);
	}
	player.runCommand("camerashake add @a[r=12] 0.6 0.3 positional");
	player.runCommand("inputpermission set @s movement enabled");
	strikeArea(player, player.dimension, center, VOYAGER_BLAST_RADIUS, VOYAGER_BLAST_DAMAGE * stops.length);
	return false;
}

function tickCores(holder: CoreHolder, now: number): void {
	const { player, cores } = holder;
	if (!player.isValid) {
		holders.delete(holder.player.id);
		return;
	}
	const expired: StellarisCore[] = [];
	for (let i = cores.length - 1; i >= 0; i--) {
		const core = cores[i];
		if (!core) continue;
		const age = now - core.bornTick;
		if (age >= CORE_LIFETIME_TICKS) {
			expired.unshift(core);
			cores.splice(i, 1);
			continue;
		}
		if (age === 0 || age % CORE_PULSE_TICKS !== 0) continue;
		const center = coreCenter(core);
		if (isLoadedLocation(core.dimension, center)) core.dimension.spawnParticle("ph:interstellaris_core", center);
	}
	if (expired.length === 0) return;
	if (cores.length === 0) holders.delete(player.id);
	syncCoreCount(player);
	detonateCores(player, expired);
}

function tickForcefield(field: Forcefield, now: number): void {
	const { player } = field;
	if (!player.isValid) {
		forcefields.delete(field.player.id);
		return;
	}
	if (now >= field.until) {
		dropForcefield(field, false);
		return;
	}
	if ((field.until - now) % CORE_PULSE_TICKS !== 0) return;
	if (isLoadedLocation(player.dimension, player.location)) player.dimension.spawnParticle("ph:interstellaris_forcefield", player.location);
}

export function tickInterstellaris(): void {
	if (holders.size === 0 && forcefields.size === 0 && voyages.size === 0 && missiles.length === 0) return;
	const now = system.currentTick;
	for (const holder of [...holders.values()]) tickCores(holder, now);
	for (const field of [...forcefields.values()]) tickForcefield(field, now);
	for (const [id, voyage] of [...voyages]) {
		if (!stepVoyage(voyage, now)) voyages.delete(id);
	}
	for (let i = missiles.length - 1; i >= 0; i--) {
		const missile = missiles[i];
		if (!missile || !stepMissile(missile)) missiles.splice(i, 1);
	}
}

export function clearInterstellarisState(playerId: string): void {
	holders.delete(playerId);
	forcefields.delete(playerId);
	voyages.delete(playerId);
}

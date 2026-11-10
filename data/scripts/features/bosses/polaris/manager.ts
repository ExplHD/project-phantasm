import { world, system, Entity, EntityDamageCause, EntityHurtBeforeEvent, Player, type Vector3 } from "@minecraft/server";
import { isLoadedLocation } from "~/core/location";
import { PHASE_ONE_ATTACKS } from "./phaseOne";
import { PHASE_TWO_ATTACKS } from "./phaseTwo";
import {
	after,
	announce,
	arenaPlayers,
	blinkTo,
	CYAN,
	drawBurst,
	drawRing,
	flatDirection,
	flatDistance,
	JUMP_LOCK_PROPERTY,
	offset,
	playSound,
	pointAround,
	POLARIS_ID,
	releaseJump,
	runSchedule,
	setPose,
	standPoint,
	VIOLET,
	WHITE,
	wipe,
	type PolarisFight
} from "./toolkit";

const ARENA_PROPERTY = "ph:polaris_arena";
const DIMENSION_IDS = ["overworld", "nether", "the_end"];

const FIRST_ATTACK_DELAY = 60;
const ATTACK_TIMEOUT = 700;
const TARGET_INTERVAL = 10;
const WARD_INTERVAL = 6;

const BOOST_RANGE = 12;
const BOOST_RISE = 3;
const BOOST_COOLDOWN = 100;
const BLINK_COOLDOWN = 50;

const TRANSITION_RISE = 40;
const TRANSITION_REFILL = 60;
const TRANSITION_END = 80;

const IMMUNE_CAUSES: ReadonlySet<EntityDamageCause> = new Set([
	EntityDamageCause.maceSmash,
	EntityDamageCause.fire,
	EntityDamageCause.fireTick,
	EntityDamageCause.lava,
	EntityDamageCause.magma,
	EntityDamageCause.campfire,
	EntityDamageCause.soulCampfire
]);

const fights = new Map<string, PolarisFight>();

function isVector(value: unknown): value is Vector3 {
	return typeof value === "object" && value !== null && "x" in value && "y" in value && "z" in value;
}

function createFight(boss: Entity): PolarisFight {
	const stored = boss.getDynamicProperty(ARENA_PROPERTY);
	const { x, y, z } = boss.location;
	const arena = isVector(stored) ? stored : { x: Math.floor(x), y, z: Math.floor(z) };

	const fight: PolarisFight = {
		boss,
		dimension: boss.dimension,
		arena,
		tasks: [],
		hazards: [],
		helpers: new Set(),
		jumpLocked: new Set(),
		phase: boss.getProperty("ph:phase") === 2 ? 2 : 1,
		mode: "idle",
		tick: 0,
		attackIndex: 0,
		attackStart: 0,
		nextAttackAt: FIRST_ATTACK_DELAY,
		nextBoostAt: FIRST_ATTACK_DELAY,
		lastWardAt: 0,
		invulnerable: false,
		target: undefined
	};

	if (!isVector(stored)) {
		const floor = standPoint(fight, arena.x, arena.z, y);
		if (floor) arena.y = floor.y;
		boss.setDynamicProperty(ARENA_PROPERTY, arena);
	}
	return fight;
}

export function trackPolaris(entity: Entity): void {
	if (entity.typeId !== POLARIS_ID || !entity.isValid) return;
	if (fights.has(entity.id)) return;
	fights.set(entity.id, createFight(entity));
	setPose(entity, "none");
	entity.triggerEvent("ph:state_chase");
}

export function scanPolaris(): void {
	for (const id of DIMENSION_IDS) {
		for (const entity of world.getDimension(id).getEntities({ type: POLARIS_ID })) trackPolaris(entity);
	}
}

function dropFight(fight: PolarisFight, id: string): void {
	wipe(fight);
	fights.delete(id);
}

function nearestPlayer(fight: PolarisFight): Player | undefined {
	const origin = fight.boss.location;
	let nearest: Player | undefined;
	let best = Infinity;
	for (const player of arenaPlayers(fight)) {
		const distance = flatDistance(origin, player.location);
		if (distance >= best) continue;
		best = distance;
		nearest = player;
	}
	return nearest;
}

function startAttack(fight: PolarisFight): void {
	const attacks = fight.phase === 1 ? PHASE_ONE_ATTACKS : PHASE_TWO_ATTACKS;
	const attack = attacks[fight.attackIndex % attacks.length];
	fight.attackIndex = (fight.attackIndex + 1) % attacks.length;
	fight.mode = "attack";
	fight.attackStart = fight.tick;
	fight.boss.triggerEvent("ph:state_cast");
	attack(fight);
}

function boost(fight: PolarisFight, target: Player): void {
	if (fight.tick < fight.nextBoostAt) return;
	const boss = fight.boss;
	const distance = flatDistance(boss.location, target.location);
	const rise = target.location.y - boss.location.y;
	if (distance < BOOST_RANGE && rise < BOOST_RISE) return;

	if (fight.phase === 2) {
		fight.nextBoostAt = fight.tick + BLINK_COOLDOWN;
		const point = pointAround(fight, target.location, 3, 5);
		if (point) blinkTo(fight, boss, point, target.location);
		return;
	}

	fight.nextBoostAt = fight.tick + BOOST_COOLDOWN;
	const direction = flatDirection(boss.location, target.location);
	const push = Math.min(1.6, 0.6 + distance * 0.05);
	boss.applyImpulse({ x: direction.x * push, y: 0.7 + Math.max(0, Math.min(0.6, rise * 0.08)), z: direction.z * push });
	drawRing(fight, offset(boss.location, 0, 0.15, 0), 0.5, 3, 8, CYAN);
	drawBurst(fight, offset(boss.location, 0, 0.3, 0), 2.5, CYAN);
	playSound(fight, "mob.enderdragon.flap", boss.location, 0.7);
}

function think(fight: PolarisFight): void {
	if (fight.tick % TARGET_INTERVAL === 0) fight.target = nearestPlayer(fight);

	if (fight.mode === "attack") {
		if (fight.tick - fight.attackStart <= ATTACK_TIMEOUT) return;
		wipe(fight);
		fight.mode = "idle";
		fight.nextAttackAt = fight.tick + FIRST_ATTACK_DELAY;
		fight.boss.triggerEvent("ph:state_chase");
		return;
	}
	if (fight.mode !== "idle") return;

	const target = fight.target;
	if (!target?.isValid) return;
	if (fight.tick >= fight.nextAttackAt) {
		startAttack(fight);
		return;
	}
	if (fight.tick % TARGET_INTERVAL === 0) boost(fight, target);
}

export function tickPolaris(): void {
	if (fights.size === 0) return;
	for (const [id, fight] of fights) {
		if (!fight.boss.isValid) {
			dropFight(fight, id);
			continue;
		}
		fight.tick++;
		runSchedule(fight);
		think(fight);
	}
}

function beginPhaseTwo(fight: PolarisFight): void {
	const boss = fight.boss;
	if (fight.phase === 2 || fight.mode === "transition" || !boss.isValid) return;

	wipe(fight);
	fight.mode = "transition";
	fight.invulnerable = true;

	boss.getComponent("minecraft:health")?.setCurrentValue(1);
	boss.triggerEvent("ph:state_cast");
	setPose(boss, "stagger");
	boss.runCommand("music stop 2");
	drawBurst(fight, offset(boss.location, 0, 2, 0), 5, WHITE);
	playSound(fight, "random.glass", boss.location, 0.5, 2);
	announce(fight, "§dThe phase gate cracks. Polaris is not done");

	after(fight, TRANSITION_RISE, (): void => {
		setPose(boss, "none");
		boss.playAnimation("animation.polaris.transition");
		drawRing(fight, offset(boss.location, 0, 0.2, 0), 12, 1, 18, VIOLET);
		playSound(fight, "beacon.activate", boss.location, 0.6, 2);
	});

	after(fight, TRANSITION_REFILL, (): void => {
		fight.phase = 2;
		boss.setProperty("ph:phase", 2);
		boss.triggerEvent("ph:enter_phase_two");
		boss.getComponent("minecraft:health")?.resetToMaxValue();

		const center = boss.location;
		drawRing(fight, offset(center, 0, 0.2, 0), 1, 16, 12, VIOLET);
		drawBurst(fight, offset(center, 0, 2.5, 0), 9, VIOLET);
		playSound(fight, "mob.warden.sonic_boom", center, 0.8, 3);

		for (const player of arenaPlayers(fight)) {
			if (flatDistance(player.location, center) > 10) continue;
			const away = flatDirection(center, player.location);
			player.applyKnockback({ x: away.x * 2.2, z: away.z * 2.2 }, 0.5);
		}
	});

	after(fight, TRANSITION_END, (): void => {
		fight.invulnerable = false;
		fight.mode = "idle";
		fight.attackIndex = 0;
		fight.nextAttackAt = fight.tick + 30;
		boss.triggerEvent("ph:state_chase");
	});
}

function showGuard(fight: PolarisFight, attacker: Entity | undefined): void {
	if (fight.tick - fight.lastWardAt < WARD_INTERVAL) return;
	fight.lastWardAt = fight.tick;
	const boss = fight.boss;
	system.run((): void => {
		if (!boss.isValid || !isLoadedLocation(boss.dimension, boss.location)) return;
		drawBurst(fight, offset(boss.location, 0, 2.2, 0), 2, fight.phase === 2 ? VIOLET : CYAN);
		playSound(fight, "random.anvil_land", boss.location, 1.8, 0.35);
		if (attacker instanceof Player && attacker.isValid) attacker.onScreenDisplay.setActionBar("§7Polaris is guarding");
	});
}

export function onPolarisHurt(event: EntityHurtBeforeEvent): void {
	const boss = event.hurtEntity;
	if (boss.typeId !== POLARIS_ID || event.cancel) return;

	if (IMMUNE_CAUSES.has(event.damageSource.cause)) {
		event.cancel = true;
		return;
	}

	const fight = fights.get(boss.id);
	if (!fight) {
		system.run((): void => trackPolaris(boss));
		return;
	}

	if (fight.invulnerable) {
		event.cancel = true;
		showGuard(fight, event.damageSource.damagingEntity);
		return;
	}

	if (fight.phase !== 1) return;
	const health = boss.getComponent("minecraft:health");
	if (!health || event.damage < health.currentValue - 1) return;

	event.cancel = true;
	system.run((): void => beginPhaseTwo(fight));
}

export function onPolarisDie(entity: Entity): void {
	if (entity.typeId !== POLARIS_ID) return;
	const fight = fights.get(entity.id);
	if (!fight) return;

	if (entity.isValid && isLoadedLocation(entity.dimension, entity.location)) {
		const center = offset(entity.location, 0, 2, 0);
		drawBurst(fight, center, 12, WHITE);
		drawRing(fight, offset(entity.location, 0, 0.2, 0), 1, 20, 16, VIOLET);
		playSound(fight, "beacon.deactivate", entity.location, 0.5, 3);
	}
	dropFight(fight, entity.id);
}

export function onPolarisRemove(removedEntityId: string, typeId: string): void {
	if (typeId !== POLARIS_ID) return;
	const fight = fights.get(removedEntityId);
	if (fight) dropFight(fight, removedEntityId);
}

export function onPolarisPlayerSpawn(player: Player): void {
	if (player.getDynamicProperty(JUMP_LOCK_PROPERTY) !== true) return;
	for (const fight of fights.values()) fight.jumpLocked.delete(player.id);
	releaseJump(player);
}

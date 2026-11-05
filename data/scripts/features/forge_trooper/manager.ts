import {
	world,
	system,
	Entity,
	EntityHurtBeforeEvent,
	EntityDamageCause,
	type EntityDamageSource,
	Player
} from "@minecraft/server";
import { isBlessed } from "../../systems/xeonniteBlessing";

const TROOPER_ID = "ph:forge_trooper";
const NERF_PROPERTY = "ph:forge_parry_nerf_until";
const FRIENDLY_FAMILIES = ["titan_ridge", "inanimate"];
const TARGET_RANGE = 24;

const VARIANT_GOLD = 0;
const VARIANT_PLASMA = 1;
const VARIANT_AMBER = 2;

const SWEEP_RADIUS = 3.2;
const SWEEP_DAMAGE = 30;
const SWEEP_HIT_TICK = 11;
const SWEEP_ANIM_MS = 1250;
const ATTACK_REACH = SWEEP_RADIUS + 0.8;

const FLEE_MS = 3000;

const DASH_RANGE_MIN = 10;
const DASH_COOLDOWN_MS = 12000;
const DASH_AIR_TICKS = 8;
const DASH_PUSHES_PER_BLOCK = 0.5;
const DASH_IMPULSE = 0.35;
const DASH_SWEEP_REACH = SWEEP_RADIUS + 1.5;

const DASH_MAX_MS = (DASH_AIR_TICKS + 2 * Math.ceil(TARGET_RANGE * DASH_PUSHES_PER_BLOCK)) * 50 + 500;

type Phase = "chase" | "attack" | "flee" | "dash";

interface TrooperState {
	phase: Phase;
	phaseUntil: number;
	dashCd: number;
}

const states = new Map<string, TrooperState>();

function getState(trooper: Entity): TrooperState {
	const existing = states.get(trooper.id);
	if (existing) return existing;
	const st: TrooperState = { phase: "chase", phaseUntil: 0, dashCd: 0 };
	states.set(trooper.id, st);
	setPhase(trooper, st, "chase", 0);
	return st;
}

function setPhase(trooper: Entity, st: TrooperState, phase: Phase, durationMs: number): void {
	st.phase = phase;
	st.phaseUntil = Date.now() + durationMs;
	if (!trooper.isValid) return;
	trooper.triggerEvent(`ph:state_${phase}`);
}

function forgetState(key: string): void {
	states.delete(key);
}

function variantOf(trooper: Entity): number {
	return trooper.getComponent("minecraft:variant")?.value ?? 0;
}

const VARIANT_FX = ["gold", "plasma", "amber"];

function playMove(trooper: Entity, move: string): void {
	trooper.playAnimation(`animation.forge_trooper.${move}`);
	const variant = VARIANT_FX[variantOf(trooper)] ?? VARIANT_FX[VARIANT_GOLD];
	trooper.playAnimation(`animation.forge_trooper.${move}_fx_${variant}`, { controller: "ph:forge_trooper_fx" });
}

function isNerfed(player: Player): boolean {
	if (!player.isValid) return false;
	const until = player.getDynamicProperty(NERF_PROPERTY);
	return typeof until === "number" && Date.now() < until;
}

function isValidTarget(target: Entity): boolean {
	if (!target.isValid || target.typeId === TROOPER_ID) return false;
	if (target.typeId === "minecraft:player") {
		const mode = (target as Player).getGameMode();
		return mode !== "Creative" && mode !== "Spectator";
	}
	if (!target.getComponent("minecraft:health")) return false;
	const family = target.getComponent("minecraft:type_family");
	return !FRIENDLY_FAMILIES.some((f) => family?.hasTypeFamily(f));
}

function distanceBetween(a: Entity, b: Entity): number {
	const dx = a.location.x - b.location.x;
	const dy = a.location.y - b.location.y;
	const dz = a.location.z - b.location.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function nearestTarget(trooper: Entity): Entity | undefined {
	if (!trooper.isValid) return undefined;
	return trooper.dimension
		.getEntities({ location: trooper.location, maxDistance: TARGET_RANGE, excludeFamilies: FRIENDLY_FAMILIES })
		.find(isValidTarget);
}

export function onTrooperHurt(acc: EntityHurtBeforeEvent): void {
	const hurtEntity = acc.hurtEntity;
	const attacker = acc.damageSource.damagingEntity;

	if (attacker?.typeId === "minecraft:player" && isNerfed(attacker as Player)) {
		acc.cancel = true;
		return;
	}

	if (hurtEntity?.typeId !== TROOPER_ID) return;
	if (attacker?.typeId !== "minecraft:player") return;
	const player = attacker as Player;

	if (!isBlessed(player)) return;

	if (Math.random() < 0.2) {
		acc.cancel = true;
		const trooper = hurtEntity;
		system.run(() => {
			if (!trooper.isValid || !player.isValid) return;
			playMove(trooper, "parry");
			const dim = trooper.dimension;
			dim.spawnParticle("ph:parry_prepare", {
				x: trooper.location.x,
				y: trooper.location.y + 1.2,
				z: trooper.location.z
			});
			dim.playSound("weapon_slash.slash_clash", trooper.location);
			player.addEffect("weakness", 40, {
				amplifier: 255,
				showParticles: true
			});
			player.setDynamicProperty(NERF_PROPERTY, Date.now() + 2000);
			player.onScreenDisplay.setActionBar("§c§lPARRIED! §7Damage output nullified");
		});
		return;
	}
}

function startSweep(trooper: Entity, st: TrooperState): void {
	setPhase(trooper, st, "attack", SWEEP_ANIM_MS);
	if (!trooper.isValid) return;

	trooper.clearVelocity();
	trooper.addEffect("slowness", Math.ceil(SWEEP_ANIM_MS / 50), { amplifier: 10, showParticles: false });
	playMove(trooper, "sweep");

	const variant = variantOf(trooper);
	const radius = variant === VARIANT_PLASMA ? SWEEP_RADIUS + 1 : SWEEP_RADIUS;
	const damage = variant === VARIANT_AMBER ? SWEEP_DAMAGE + 3 : SWEEP_DAMAGE;

	system.runTimeout(() => {
		if (!trooper.isValid) return;
		const location = trooper.location;
		const targets = trooper.dimension.getEntities({
			location,
			maxDistance: radius,
			excludeFamilies: FRIENDLY_FAMILIES
		});

		for (const target of targets) {
			if (target.id === trooper.id || !isValidTarget(target)) continue;
			if (!trooper.isValid) return;

			target.applyDamage(damage, {
				cause: EntityDamageCause.entityAttack,
				damagingEntity: trooper
			});
		}

		if (!trooper.isValid) return;
		trooper.dimension.playSound("weapon_slash.slash_heavy", location);
	}, SWEEP_HIT_TICK);
}

function startDash(trooper: Entity, st: TrooperState, dist: number): void {
	setPhase(trooper, st, "dash", DASH_MAX_MS);
	st.dashCd = Date.now() + DASH_COOLDOWN_MS;

	if (!trooper.isValid) {
		setPhase(trooper, st, "chase", 0);
		return;
	}
	playMove(trooper, "dash");
	trooper.applyImpulse({ x: 0, y: 0.9, z: 0 });

	system.runTimeout(() => {
		if (!trooper.isValid || st.phase !== "dash") return;

		let pushes = Math.ceil(dist * DASH_PUSHES_PER_BLOCK);
		const push = system.runInterval(() => {
			if (!trooper.isValid || st.phase !== "dash") {
				system.clearRun(push);
				return;
			}

			const target = nearestTarget(trooper);
			if (target === undefined || pushes <= 0) {
				system.clearRun(push);
				setPhase(trooper, st, "chase", 0);
				return;
			}

			if (distanceBetween(trooper, target) <= DASH_SWEEP_REACH) {
				system.clearRun(push);
				startSweep(trooper, st);
				return;
			}

			const dx = target.location.x - trooper.location.x;
			const dz = target.location.z - trooper.location.z;
			const flat = Math.sqrt(dx * dx + dz * dz) || 1;
			trooper.applyImpulse({ x: (dx / flat) * DASH_IMPULSE, y: 0, z: (dz / flat) * DASH_IMPULSE });

			pushes--;
		}, 2);
	}, DASH_AIR_TICKS);
}

export function tickTroopers(): void {
	const now = Date.now();
	const troopers = new Map<string, Entity>();

	for (const player of world.getAllPlayers()) {
		if (!player.isValid) continue;
		for (const trooper of player.dimension.getEntities({
			type: TROOPER_ID,
			location: player.location,
			maxDistance: 48
		})) {
			troopers.set(trooper.id, trooper);
		}
	}

	for (const trooper of troopers.values()) {
		if (!trooper.isValid) continue;
		const st = getState(trooper);

		switch (st.phase) {
			case "chase": {
				const target = nearestTarget(trooper);
				if (target === undefined) break;
				const dist = distanceBetween(trooper, target);
				if (dist <= ATTACK_REACH) {
					startSweep(trooper, st);
				} else if (variantOf(trooper) === VARIANT_GOLD && dist >= DASH_RANGE_MIN && now >= st.dashCd) {
					startDash(trooper, st, dist);
				}
				break;
			}
			case "dash":
				if (now >= st.phaseUntil) setPhase(trooper, st, "chase", 0);
				break;
			case "attack":
				if (now >= st.phaseUntil) setPhase(trooper, st, "flee", FLEE_MS);
				break;
			case "flee":
				if (now >= st.phaseUntil) setPhase(trooper, st, "chase", 0);
				break;
		}
	}
}

export function onTrooperDie(deadEntity: Entity, damageSource: EntityDamageSource): void {
	if (deadEntity?.typeId !== TROOPER_ID) return;
	forgetState(deadEntity.id);

	const killer = damageSource?.damagingEntity;
	if (!killer || killer.typeId !== "minecraft:player") return;
	const player = killer as Player;

	if (Math.random() >= 0.3) return;
	if (!deadEntity.isValid || !player.isValid) return;

	switch (variantOf(deadEntity)) {
		case VARIANT_GOLD:
			player.addEffect("speed", 400, { amplifier: 0 });
			break;
		case VARIANT_PLASMA:
			player.addEffect("instant_health", 1, { amplifier: 0 });
			break;
		case VARIANT_AMBER:
			player.addEffect("resistance", 400, { amplifier: 0 });
			break;
	}
}

export function onTrooperRemove(removedEntityId: string, typeId: string): void {
	if (typeId === TROOPER_ID) forgetState(removedEntityId);
}

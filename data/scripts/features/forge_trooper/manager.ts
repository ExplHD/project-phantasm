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

// ======================================== Forge Trooper ========================================
// Close-range mob with a codex: every blessed player hit risks a parry (unblessed
// players cannot damage it at all, see systems/xeonniteBlessing.ts), and it fights
// with a grounded 360-degree sweep.
// Loop: chase the target -> sweep once in reach -> flee for 3s -> chase again.
// Gold variants leap-dash at targets 10+ blocks away while chasing; reaching sweep
// range mid-dash goes straight into the sweep.
// The script owns the phase; the BP component groups (ph:chase / ph:attack / ph:flee)
// own the movement, so the two never fight over where the mob walks.
// It hunts players and every other mob, but never its own Titan Ridge faction.

const TROOPER_ID = "ph:forge_trooper";
const NERF_PROPERTY = "ph:forge_parry_nerf_until";
const FRIENDLY_FAMILIES = ["titan_ridge", "inanimate"];
const TARGET_RANGE = 24; // matches the BP follow_range / nearest_attackable_target radius

const VARIANT_GOLD = 0;
const VARIANT_PLASMA = 1;
const VARIANT_AMBER = 2;

// Base stats. Plasma sweeps a block wider, Amber hits 3 damage harder.
const SWEEP_RADIUS = 3.2;
const SWEEP_DAMAGE = 30;
const SWEEP_HIT_TICK = 11; // the blade crosses the front of the spin at ~0.55s into the 1.25s animation
const SWEEP_ANIM_MS = 1250;
const ATTACK_REACH = SWEEP_RADIUS + 0.8; // start swinging slightly before the target is inside the blade

const FLEE_MS = 3000;

const DASH_RANGE_MIN = 10;
const DASH_COOLDOWN_MS = 12000;
const DASH_AIR_TICKS = 8; // rise time after the jump impulse before pushing forward
const DASH_PUSHES_PER_BLOCK = 0.5; // forward re-impulses, one every 2 ticks; 6 at 12 blocks
const DASH_IMPULSE = 0.35;
const DASH_SWEEP_REACH = SWEEP_RADIUS + 1.5; // momentum carries it the rest of the way into the blade
// Safety net if the push loop dies with the trooper (unload, dimension swap).
const DASH_MAX_MS = (DASH_AIR_TICKS + 2 * Math.ceil(TARGET_RANGE * DASH_PUSHES_PER_BLOCK)) * 50 + 500;

type Phase = "chase" | "attack" | "flee" | "dash";

interface TrooperState {
	phase: Phase;
	/** When the current attack or flee phase ends, compared against Date.now(). */
	phaseUntil: number;
	/** Gold dash cooldown, compared against Date.now(). */
	dashCd: number;
}

const states = new Map<string, TrooperState>();

function getState(trooper: Entity): TrooperState {
	let st = states.get(trooper.id);
	if (!st) {
		st = { phase: "chase", phaseUntil: 0, dashCd: 0 };
		states.set(trooper.id, st);
		// Fresh state after a reload or for a trooper spawned before the loop existed:
		// force the BP groups to match instead of trusting whatever was saved.
		setPhase(trooper, st, "chase", 0);
	}
	return st;
}

function setPhase(trooper: Entity, st: TrooperState, phase: Phase, durationMs: number): void {
	st.phase = phase;
	st.phaseUntil = Date.now() + durationMs;
	try {
		trooper.triggerEvent(`ph:state_${phase}`);
	} catch {
		// The trooper can unload between the decision and the event.
	}
}

function forgetState(key: string): void {
	states.delete(key);
}

function variantOf(trooper: Entity): number {
	return trooper.getComponent("minecraft:variant")?.value ?? 0;
}

const VARIANT_FX = ["gold", "plasma", "amber"];

// Plays a move with its variant-coloured particles. The particles live in a separate
// *_fx_<variant> animation on its own controller so both run side by side; particles
// can't read q.variant themselves, so the script picks the coloured set.
function playMove(trooper: Entity, move: string): void {
	trooper.playAnimation(`animation.forge_trooper.${move}`);
	const variant = VARIANT_FX[variantOf(trooper)] ?? VARIANT_FX[VARIANT_GOLD];
	trooper.playAnimation(`animation.forge_trooper.${move}_fx_${variant}`, { controller: "ph:forge_trooper_fx" });
}

// The parry debuff: while active, everything the player touches takes zero damage.
// Vanilla melee is already zeroed by the Weakness 255 effect; this check covers
// script-driven damage (weapon skills, ph damage paths), which ignores potions.
function isNerfed(player: Player): boolean {
	try {
		const until = player.getDynamicProperty(NERF_PROPERTY);
		return typeof until === "number" && Date.now() < until;
	} catch {
		return false;
	}
}

// Players outside Creative/Spectator, plus any living mob outside the Titan Ridge faction.
function isValidTarget(target: Entity): boolean {
	try {
		if (!target.isValid || target.typeId === TROOPER_ID) return false;
		if (target.typeId === "minecraft:player") {
			const mode = (target as Player).getGameMode();
			return mode !== "Creative" && mode !== "Spectator";
		}
		if (!target.getComponent("minecraft:health")) return false;
		const family = target.getComponent("minecraft:type_family");
		return !FRIENDLY_FAMILIES.some((f) => family?.hasTypeFamily(f));
	} catch {
		return false;
	}
}

function distanceBetween(a: Entity, b: Entity): number {
	const dx = a.location.x - b.location.x;
	const dy = a.location.y - b.location.y;
	const dz = a.location.z - b.location.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// getEntities sorts by distance when a location is given, so the first valid hit is the nearest.
function nearestTarget(trooper: Entity): Entity | undefined {
	try {
		return trooper.dimension
			.getEntities({ location: trooper.location, maxDistance: TARGET_RANGE, excludeFamilies: FRIENDLY_FAMILIES })
			.find(isValidTarget);
	} catch {
		return undefined;
	}
}

export function onTrooperHurt(acc: EntityHurtBeforeEvent): void {
	const hurtEntity = acc.hurtEntity;
	const attacker = acc.damageSource.damagingEntity;

	// Parried players deal nothing while the debuff window is open (any target).
	if (attacker?.typeId === "minecraft:player" && isNerfed(attacker as Player)) {
		acc.cancel = true;
		return;
	}

	if (hurtEntity?.typeId !== TROOPER_ID) return;
	if (attacker?.typeId !== "minecraft:player") return;
	const player = attacker as Player;

	// Unblessed hits are already cancelled by the Xeonnite Blessing system; no parry for those.
	if (!isBlessed(player)) return;

	// Parry: 20% of every blessed player hit. Cancels the incoming damage,
	// plays the parry pose, and slaps the Full Damage Nerf on the attacker.
	if (Math.random() < 0.2) {
		acc.cancel = true;
		const trooper = hurtEntity;
		system.run(() => {
			try {
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
			} catch {
				// Either party despawning mid-parry is fine.
			}
		});
		return;
	}
	// The 20% damage reduction lives in the BP damage_sensor (damage_multiplier 0.8).
	// Scaling acc.damage here as well would stack it to 36%.
}

// The sweep: plant the feet, play the spin, then pulse the AoE at the hit frame.
function startSweep(trooper: Entity, st: TrooperState): void {
	setPhase(trooper, st, "attack", SWEEP_ANIM_MS);

	try {
		trooper.clearVelocity();
		// Planted feet for the whole swing; walking through the spin reads as a turntable.
		trooper.addEffect("slowness", Math.ceil(SWEEP_ANIM_MS / 50), { amplifier: 10, showParticles: false });
	} catch {
		// clearVelocity can throw right before dimension swaps.
	}
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

			target.applyDamage(damage, {
				cause: EntityDamageCause.entityAttack,
				damagingEntity: trooper
			});
		}

		trooper.dimension.playSound("weapon_slash.slash_heavy", location);
	}, SWEEP_HIT_TICK);
}

// Gold-only approach: leap toward the target, then a short ground-parallel dash,
// then the sweep. Horizontal impulses stay small and frequent so the arc reads as
// a jump instead of launching the trooper like a missile. The BP side sits in the
// planted ph:attack group meanwhile, so pathing doesn't fight the impulses.
function startDash(trooper: Entity, st: TrooperState, dist: number): void {
	setPhase(trooper, st, "dash", DASH_MAX_MS);
	st.dashCd = Date.now() + DASH_COOLDOWN_MS;

	try {
		playMove(trooper, "dash");
		trooper.applyImpulse({ x: 0, y: 0.9, z: 0 });
	} catch {
		setPhase(trooper, st, "chase", 0);
		return;
	}

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
			try {
				trooper.applyImpulse({ x: (dx / flat) * DASH_IMPULSE, y: 0, z: (dz / flat) * DASH_IMPULSE });
			} catch {
				system.clearRun(push);
				setPhase(trooper, st, "chase", 0);
				return;
			}

			pushes--;
		}, 2);
	}, DASH_AIR_TICKS);
}

// Driver tick, run every 4 ticks from events/index.ts so the sweep starts as soon as the target is in reach.
// Troopers are gathered around players so only loaded, relevant ones run.
export function tickTroopers(): void {
	const now = Date.now();
	const troopers = new Map<string, Entity>();

	for (const player of world.getAllPlayers()) {
		try {
			for (const trooper of player.dimension.getEntities({
				type: TROOPER_ID,
				location: player.location,
				maxDistance: 48
			})) {
				troopers.set(trooper.id, trooper);
			}
		} catch {
			continue;
		}
	}

	for (const trooper of troopers.values()) {
		if (!trooper.isValid) continue;
		const st = getState(trooper);

		switch (st.phase) {
			case "chase": {
				// BP melee_box_attack does the pathing; the script only decides when to swing.
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
				// The push loop hands off to sweep or chase itself; this only catches a dead loop.
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

	// Death gift of each variant (loot covers the items; these are the buffs).
	if (Math.random() >= 0.3) return;

	try {
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
	} catch {
		// The killer can log out on the same tick.
	}
}

// Despawned or unloaded troopers never fire entityDie; drop their state here instead.
export function onTrooperRemove(removedEntityId: string, typeId: string): void {
	if (typeId === TROOPER_ID) forgetState(removedEntityId);
}

import {
	world,
	system,
	Entity,
	EntityHurtBeforeEvent,
	EntityDamageCause,
	Player
} from "@minecraft/server";
import { isBlessed } from "../../systems/xeonniteBlessing";

// ======================================== Forge Trooper ========================================
// Close-range mob with a codex: every blessed player hit risks a parry (unblessed
// players cannot damage it at all, see systems/xeonniteBlessing.ts), and it fights
// with a grounded 360-degree sweep. Gold variants additionally leap-dash toward far
// targets and re-sweep on landing.
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
const SWEEP_COOLDOWN_MS = 6000;

const DASH_RANGE_MIN = 10;
const DASH_RANGE_MAX = 14;
const DASH_COOLDOWN_MS = 12000;

const SWEEP_ANIM_MS = 1250;
const DASH_AIR_TICKS = 8; // rise time after the jump impulse before pushing forward
const DASH_PUSHES = 6; // forward re-impulses, one every 2 ticks
const DASH_IMPULSE = 0.35;

interface TrooperState {
	/** Armed cooldowns, compared against Date.now(). */
	sweepCd: number;
	dashCd: number;
	/** Active sweep animation window; no new decisions while it plays. */
	sweepingUntil: number;
	/** Dash phase: 0 idle, 1 rising, 2 pushing forward. */
	dashPhase: number;
}

const states = new Map<string, TrooperState>();

function getState(trooper: Entity): TrooperState {
	let st = states.get(trooper.id);
	if (!st) {
		st = { sweepCd: 0, dashCd: 0, sweepingUntil: 0, dashPhase: 0 };
		states.set(trooper.id, st);
		return st;
	}
	return st;
}

function forgetState(key: string): void {
	states.delete(key);
}

function variantOf(trooper: Entity): number {
	return trooper.getComponent("minecraft:variant")?.value ?? 0;
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

world.beforeEvents.entityHurt.subscribe((acc: EntityHurtBeforeEvent) => {
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
				trooper.playAnimation("animation.forge_trooper.parry");
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
});

// The sweep: stop motion, play the spin, then pulse the AoE at the hit frame.
function startSweep(trooper: Entity, st: TrooperState): void {
	st.sweepingUntil = Date.now() + SWEEP_ANIM_MS;
	st.sweepCd = Date.now() + SWEEP_COOLDOWN_MS;

	try {
		trooper.clearVelocity();
		// Planted feet for the whole swing; walking through the spin reads as a turntable.
		trooper.addEffect("slowness", Math.ceil(SWEEP_ANIM_MS / 50), { amplifier: 10, showParticles: false });
	} catch {
		// clearVelocity can throw right before dimension swaps.
	}
	trooper.playAnimation("animation.forge_trooper.sweep");

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
// then the sweep. The dash keeps horizontal impulses small and frequent so the
// arc stays readable instead of launching the trooper like a missile.
function startDash(trooper: Entity, st: TrooperState): void {
	st.dashCd = Date.now() + DASH_COOLDOWN_MS;
	st.dashPhase = 1;

	try {
		trooper.playAnimation("animation.forge_trooper.dash");
		trooper.applyImpulse({ x: 0, y: 0.9, z: 0 });
	} catch {
		st.dashPhase = 0;
		return;
	}

	system.runTimeout(() => {
		if (!trooper.isValid) return;
		st.dashPhase = 2;

		let pushes = DASH_PUSHES;
		const push = system.runInterval(() => {
			if (!trooper.isValid || pushes <= 0) {
				system.clearRun(push);
				if (trooper.isValid) st.dashPhase = 0;
				return;
			}

			const target = nearestTarget(trooper);
			if (target === undefined) {
				system.clearRun(push);
				st.dashPhase = 0;
				return;
			}

			// A player inside sweep reach from the dash: finish the combo now.
			if (distanceBetween(trooper, target) <= SWEEP_RADIUS + 1.5) {
				system.clearRun(push);
				st.dashPhase = 0;
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
				st.dashPhase = 0;
				return;
			}

			pushes--;
		}, 2);
	}, DASH_AIR_TICKS);
}

// Driver tick: 0.5s cadence is enough for approach decisions and cooldowns.
// Troopers are gathered around players so only loaded, relevant ones run.
system.runInterval(() => {
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
		if (now < st.sweepingUntil) continue;

		const target = nearestTarget(trooper);
		if (target === undefined) continue;
		const dist = distanceBetween(trooper, target);

		// Backing off while the sweep is on cooldown keeps the mob out of
		// shove range without a stop-and-stare cooldown stand.
		if (now < st.sweepCd && dist < 2.2 && dist > 0.01) {
			const away = 0.08 / dist;
			try {
				trooper.applyImpulse({
					x: (trooper.location.x - target.location.x) * away,
					y: 0,
					z: (trooper.location.z - target.location.z) * away
				});
			} catch {
				// Pushing is best effort.
			}
		}

		// Gold variant leap-dash at 10-14 blocks; ends in a sweep.
		if (
			variantOf(trooper) === VARIANT_GOLD &&
			st.dashPhase === 0 &&
			now >= st.dashCd &&
			dist >= DASH_RANGE_MIN &&
			dist <= DASH_RANGE_MAX
		) {
			startDash(trooper, st);
			continue;
		}

		// Close enough: sweep (never mid-dash; the dash triggers its own).
		if (st.dashPhase === 0 && dist <= SWEEP_RADIUS + 0.8 && now >= st.sweepCd) {
			startSweep(trooper, st);
		}
	}
}, 10);

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
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
});

// Despawned or unloaded troopers never fire entityDie; drop their state here instead.
world.afterEvents.entityRemove.subscribe(({ removedEntityId, typeId }) => {
	if (typeId === TROOPER_ID) forgetState(removedEntityId);
});

import { system, EquipmentSlot, GameMode, type ItemStack, type Player, type Vector3 } from "@minecraft/server";
import { type ProjectileConfig, fireProjectile } from "./projectile";
import { applyDurabilityDamage } from "../../core/items";
import { setScore } from "../../core/scoreboard";
import { isLoadedLocation } from "../../core/location";

const ITEM_ID = "ph:xeonnite_blaster_mk3";

const RAISE_TICKS = 3;
const PLASMOID_INTERVAL = 2;
const SHOT_CATEGORY = "ph:xeonnite_shot";
const MISSILE_INTERVAL = 50;
const MISSILE_CHARGE_TICKS = 16;
const CHARGE_FX_INTERVAL = 4;
const PLASMOID_WEAR = 1;
const MISSILE_WEAR = 5;
const HEAT_OBJECTIVE = "xeonnite_heat";
const OVERHEAT_OBJECTIVE = "xeonnite_overheat";
const HEAT_MAX = 100;
const HEAT_PER_SHOT = 3;
const COOL_DELAY = 10;
const COOL_RATE = 1.5;
const OVERHEAT_COOL_RATE = 1;
const STEAM_INTERVAL = 5;

const MUZZLE = { forward: 1.1, side: 0.04, up: -0.18 };

const PLASMOID: ProjectileConfig = {
	core: "ph:xeonnite_plasmoid",
	trail: "ph:xeonnite_plasmoid_trail",
	impact: ["ph:xeonnite_plasmoid_impact"],
	impactSound: "random.fizz",
	impactPitch: 1.6,
	damage: 16,
	speed: 2.4,
	range: 40,
	lockCone: 4,
	knockback: 0.1,
	origin: MUZZLE
};

const MISSILE: ProjectileConfig = {
	core: "ph:xeonnite_missile",
	trail: "ph:xeonnite_missile_trail",
	impact: ["ph:xeonnite_missile_blast", "ph:xeonnite_missile_sparks", "ph:xeonnite_missile_smoke"],
	impactSound: "random.explode",
	impactPitch: 0.9,
	damage: 45,
	speed: 1.1,
	range: 48,
	homing: 5,
	lockCone: 18,
	knockback: 0.6,
	blast: { radius: 3.5, damage: 25, knockback: 1.2 },
	origin: MUZZLE
};

interface Aim {
	readonly player: Player;
	readonly slot: number;
	readonly durabilityLeft: number;
	readonly missile: boolean;
	readonly startedAt: number;
	nextShotAt: number;
	wear: number;
}

interface Heat {
	readonly player: Player;
	value: number;
	overheated: boolean;
	lastShotAt: number;
	shown: number;
}

const aiming = new Map<string, Aim>();
const heats = new Map<string, Heat>();
const missileReadyAt = new Map<string, number>();

function isHoldingBlaster(player: Player): boolean {
	return player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === ITEM_ID;
}

function canWear(aim: Aim, amount: number): boolean {
	if (aim.wear + amount > aim.durabilityLeft) return false;
	aim.wear += amount;
	return true;
}

function settleWear(aim: Aim): void {
	const { player, slot, wear } = aim;
	if (wear <= 0 || !player.isValid) return;
	if (player.getComponent("inventory")?.container?.getItem(slot)?.typeId !== ITEM_ID) return;
	applyDurabilityDamage(player, { damage: wear, slot });
}

function muzzleLocation(player: Player): Vector3 {
	const eye = player.getHeadLocation();
	const view = player.getViewDirection();
	const flat = Math.hypot(view.x, view.z) || 1;
	const right = { x: -view.z / flat, z: view.x / flat };
	return {
		x: eye.x + view.x * MUZZLE.forward + right.x * MUZZLE.side,
		y: eye.y + view.y * MUZZLE.forward + MUZZLE.up,
		z: eye.z + view.z * MUZZLE.forward + right.z * MUZZLE.side
	};
}

function muzzleFlash(player: Player, sound: string, pitch: number): void {
	const at = muzzleLocation(player);
	if (!isLoadedLocation(player.dimension, at)) return;
	player.dimension.spawnParticle("ph:xeonnite_blaster_muzzle", at);
	player.dimension.playSound(sound, at, { volume: 0.7, pitch });
}

function showHeat(heat: Heat): void {
	const shown = Math.ceil(heat.value);
	if (shown === heat.shown) return;
	heat.shown = shown;
	setScore(heat.player, HEAT_OBJECTIVE, shown);
}

function setOverheated(heat: Heat, overheated: boolean): void {
	heat.overheated = overheated;
	setScore(heat.player, OVERHEAT_OBJECTIVE, overheated ? 1 : 0);
}

function heatOf(player: Player): Heat {
	const existing = heats.get(player.id);
	if (existing) return existing;
	const heat: Heat = { player, value: 0, overheated: false, lastShotAt: 0, shown: 0 };
	heats.set(player.id, heat);
	setScore(player, OVERHEAT_OBJECTIVE, 0);
	return heat;
}

function overheat(player: Player, heat: Heat): void {
	setOverheated(heat, true);
	const at = muzzleLocation(player);
	if (!isLoadedLocation(player.dimension, at)) return;
	player.dimension.playSound("random.fizz", at, { volume: 1, pitch: 0.5 });
	player.dimension.playSound("random.anvil_land", at, { volume: 0.4, pitch: 2 });
	player.dimension.spawnParticle("minecraft:basic_smoke_particle", at);
}

function venting(heat: Heat, tick: number): void {
	const { player } = heat;
	if (tick % STEAM_INTERVAL !== 0 || !isHoldingBlaster(player)) return;
	const at = muzzleLocation(player);
	if (!isLoadedLocation(player.dimension, at)) return;
	player.dimension.spawnParticle("minecraft:basic_smoke_particle", at);
}

function coolHeats(tick: number): void {
	for (const [id, heat] of heats) {
		if (!heat.player.isValid) {
			heats.delete(id);
			continue;
		}
		if (heat.overheated) {
			venting(heat, tick);
			heat.value = Math.max(0, heat.value - OVERHEAT_COOL_RATE);
			if (heat.value === 0) {
				setOverheated(heat, false);
				heat.player.playSound("random.orb", { volume: 0.5, pitch: 0.8 });
			}
		} else if (tick - heat.lastShotAt >= COOL_DELAY) {
			heat.value = Math.max(0, heat.value - COOL_RATE);
		}
		showHeat(heat);
		if (heat.value === 0 && !heat.overheated) heats.delete(id);
	}
}

function firePlasmoid(player: Player, aim: Aim, tick: number): void {
	const heat = heatOf(player);
	if (heat.overheated) return;
	if (!canWear(aim, PLASMOID_WEAR)) return;
	heat.value = Math.min(HEAT_MAX, heat.value + HEAT_PER_SHOT);
	heat.lastShotAt = tick;
	player.startItemCooldown(SHOT_CATEGORY, PLASMOID_INTERVAL);
	showHeat(heat);
	if (heat.value >= HEAT_MAX) overheat(player, heat);
	muzzleFlash(player, "weapon_slash.ump_shot", 1.7 + Math.random() * 0.2);
	fireProjectile(player, PLASMOID);
}

function chargeMissile(player: Player, aim: Aim, tick: number): void {
	const held = tick - aim.startedAt;
	if (held > MISSILE_CHARGE_TICKS || held % CHARGE_FX_INTERVAL !== 0) return;
	const at = muzzleLocation(player);
	if (!isLoadedLocation(player.dimension, at)) return;
	if (held === MISSILE_CHARGE_TICKS) {
		player.dimension.playSound("random.orb", at, { volume: 0.8, pitch: 1.6 });
		return;
	}
	player.dimension.spawnParticle("ph:xeonnite_missile", at);
	player.dimension.playSound("beacon.ambient", at, { volume: 0.6, pitch: 1 + held / MISSILE_CHARGE_TICKS });
}

function releaseMissile(aim: Aim): void {
	const { player } = aim;
	const tick = system.currentTick;
	if (!player.isValid || !isHoldingBlaster(player)) return;
	if (tick - aim.startedAt < MISSILE_CHARGE_TICKS) return;
	if (tick < (missileReadyAt.get(player.id) ?? 0) || aim.wear + MISSILE_WEAR > aim.durabilityLeft) {
		player.playSound("random.click", { pitch: 0.6 });
		return;
	}

	aim.wear += MISSILE_WEAR;
	missileReadyAt.set(player.id, tick + MISSILE_INTERVAL);
	muzzleFlash(player, "firework.launch", 0.8);
	player.playAnimation("animation.xeonnite_blaster_mk3.missile_recoil", { blendOutTime: 0.1 });
	player.runCommand("camerashake add @s 0.2 0.15 positional");
	fireProjectile(player, MISSILE);
}

function remainingDurability(player: Player, itemStack: ItemStack): number {
	if (player.getGameMode() === GameMode.Creative) return Infinity;
	const durability = itemStack.getComponent("durability");
	return durability ? durability.maxDurability - durability.damage : Infinity;
}

function stopAiming(id: string, release: boolean = false): void {
	const aim = aiming.get(id);
	if (!aim) return;
	aiming.delete(id);
	if (release && aim.missile) releaseMissile(aim);
	settleWear(aim);
}

export function onBlasterStartUse(itemStack: ItemStack | undefined, player: Player): void {
	if (itemStack?.typeId !== ITEM_ID || !player.isValid) return;
	stopAiming(player.id);
	const tick = system.currentTick;
	if (!player.isSneaking && heats.get(player.id)?.overheated) player.playSound("random.click", { pitch: 0.6 });
	aiming.set(player.id, {
		player,
		slot: player.selectedSlotIndex,
		durabilityLeft: remainingDurability(player, itemStack),
		missile: player.isSneaking,
		startedAt: tick,
		nextShotAt: tick + RAISE_TICKS,
		wear: 0
	});
}

export function onBlasterStopUse(player: Player): void {
	stopAiming(player.id, true);
}

export function clearBlasterState(playerId: string): void {
	aiming.delete(playerId);
	missileReadyAt.delete(playerId);
	heats.delete(playerId);
}

export function resetBlasterHeat(player: Player): void {
	setScore(player, HEAT_OBJECTIVE, 0);
	setScore(player, OVERHEAT_OBJECTIVE, 0);
}

export function tickBlasters(): void {
	const tick = system.currentTick;
	if (heats.size > 0) coolHeats(tick);
	if (aiming.size === 0) return;
	for (const [id, aim] of aiming) {
		const { player } = aim;
		if (!player.isValid || !isHoldingBlaster(player)) {
			stopAiming(id);
			continue;
		}
		if (aim.missile) {
			chargeMissile(player, aim, tick);
			continue;
		}
		if (tick < aim.nextShotAt) continue;

		aim.nextShotAt = tick + PLASMOID_INTERVAL;
		firePlasmoid(player, aim, tick);
	}
}

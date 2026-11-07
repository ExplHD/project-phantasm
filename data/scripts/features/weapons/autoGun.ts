import { system, EquipmentSlot, GameMode, type ItemStack, type Player, type Vector3 } from "@minecraft/server";
import { type ProjectileConfig, type MuzzleOffset, fireProjectile, muzzlePoint } from "./projectile";
import { applyDurabilityDamage } from "../../core/items";
import { setScore } from "../../core/scoreboard";
import { isLoadedLocation } from "../../core/location";
import { AUTO_GUNS } from "./gunSpecs";

export interface GunSound {
	readonly id: string;
	readonly pitch: number;
	readonly pitchJitter?: number;
}

export interface GunHeat {
	readonly objective: string;
	readonly overheatObjective: string;
	readonly max: number;
	readonly perShot: number;
	readonly coolDelay: number;
	readonly coolRate: number;
	readonly overheatCoolRate: number;
	readonly steamInterval: number;
}

export interface AutoGunAltFire {
	readonly projectile: ProjectileConfig;
	readonly chargeTicks: number;
	readonly chargeFxInterval: number;
	readonly chargeParticle: string;
	readonly interval: number;
	readonly wear: number;
	readonly sound: GunSound;
	readonly recoilAnimation?: string;
	readonly shake?: string;
}

export interface AutoGun {
	readonly id: string;
	readonly shotCategory: string;
	readonly raiseTicks: number;
	readonly interval: number;
	readonly wear: number;
	readonly muzzle: MuzzleOffset;
	readonly muzzleParticle?: string;
	readonly sound: GunSound;
	readonly projectile: ProjectileConfig;
	readonly heat?: GunHeat;
	readonly altFire?: AutoGunAltFire;
}

interface Aim {
	readonly player: Player;
	readonly gun: AutoGun;
	readonly slot: number;
	readonly durabilityLeft: number;
	readonly alt: boolean;
	readonly startedAt: number;
	nextShotAt: number;
	wear: number;
}

interface Heat {
	readonly player: Player;
	readonly gun: AutoGun;
	readonly config: GunHeat;
	value: number;
	overheated: boolean;
	lastShotAt: number;
	shown: number;
}

const GUNS = new Map<string, AutoGun>(AUTO_GUNS.map(gun => [gun.id, gun]));

const aiming = new Map<string, Aim>();
const heats = new Map<string, Heat>();
const altReadyAt = new Map<string, number>();

function gunKey(player: Player, gun: AutoGun): string {
	return `${player.id}|${gun.id}`;
}

function isHolding(player: Player, gun: AutoGun): boolean {
	return player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === gun.id;
}

function canWear(aim: Aim, amount: number): boolean {
	if (aim.wear + amount > aim.durabilityLeft) return false;
	aim.wear += amount;
	return true;
}

function settleWear(aim: Aim): void {
	const { player, slot, wear, gun } = aim;
	if (wear <= 0 || !player.isValid) return;
	if (player.getComponent("inventory")?.container?.getItem(slot)?.typeId !== gun.id) return;
	applyDurabilityDamage(player, { damage: wear, slot });
}

function muzzleFlash(player: Player, gun: AutoGun, sound: GunSound): void {
	const at: Vector3 = muzzlePoint(player, gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	if (gun.muzzleParticle) player.dimension.spawnParticle(gun.muzzleParticle, at);
	player.dimension.playSound(sound.id, at, { volume: 0.7, pitch: sound.pitch + Math.random() * (sound.pitchJitter ?? 0) });
}

function showHeat(heat: Heat): void {
	const shown = Math.ceil(heat.value);
	if (shown === heat.shown) return;
	heat.shown = shown;
	setScore(heat.player, heat.config.objective, shown);
}

function setOverheated(heat: Heat, overheated: boolean): void {
	heat.overheated = overheated;
	setScore(heat.player, heat.config.overheatObjective, overheated ? 1 : 0);
}

function heatOf(player: Player, gun: AutoGun, config: GunHeat): Heat {
	const key = gunKey(player, gun);
	const existing = heats.get(key);
	if (existing) return existing;
	const heat: Heat = { player, gun, config, value: 0, overheated: false, lastShotAt: 0, shown: 0 };
	heats.set(key, heat);
	setScore(player, config.overheatObjective, 0);
	return heat;
}

function overheat(heat: Heat): void {
	const { player, gun } = heat;
	setOverheated(heat, true);
	const at = muzzlePoint(player, gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	player.dimension.playSound("random.fizz", at, { volume: 1, pitch: 0.5 });
	player.dimension.playSound("random.anvil_land", at, { volume: 0.4, pitch: 2 });
	player.dimension.spawnParticle("minecraft:basic_smoke_particle", at);
}

function venting(heat: Heat, tick: number): void {
	const { player, gun, config } = heat;
	if (tick % config.steamInterval !== 0 || !isHolding(player, gun)) return;
	const at = muzzlePoint(player, gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	player.dimension.spawnParticle("minecraft:basic_smoke_particle", at);
}

function coolHeats(tick: number): void {
	for (const [key, heat] of heats) {
		if (!heat.player.isValid) {
			heats.delete(key);
			continue;
		}
		const { config } = heat;
		if (heat.overheated) {
			venting(heat, tick);
			heat.value = Math.max(0, heat.value - config.overheatCoolRate);
			if (heat.value === 0) {
				setOverheated(heat, false);
				heat.player.playSound("random.orb", { volume: 0.5, pitch: 0.8 });
			}
		} else if (tick - heat.lastShotAt >= config.coolDelay) {
			heat.value = Math.max(0, heat.value - config.coolRate);
		}
		showHeat(heat);
		if (heat.value === 0 && !heat.overheated) heats.delete(key);
	}
}

function fireMain(player: Player, aim: Aim, tick: number): void {
	const { gun } = aim;
	const heat = gun.heat ? heatOf(player, gun, gun.heat) : undefined;
	if (heat?.overheated) return;
	if (!canWear(aim, gun.wear)) return;
	player.startItemCooldown(gun.shotCategory, gun.interval);
	if (heat) {
		heat.value = Math.min(heat.config.max, heat.value + heat.config.perShot);
		heat.lastShotAt = tick;
		showHeat(heat);
		if (heat.value >= heat.config.max) overheat(heat);
	}
	muzzleFlash(player, gun, gun.sound);
	fireProjectile(player, gun.projectile);
}

function chargeAlt(player: Player, aim: Aim, alt: AutoGunAltFire, tick: number): void {
	const held = tick - aim.startedAt;
	if (held > alt.chargeTicks || held % alt.chargeFxInterval !== 0) return;
	const at = muzzlePoint(player, aim.gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	if (held === alt.chargeTicks) {
		player.dimension.playSound("random.orb", at, { volume: 0.8, pitch: 1.6 });
		return;
	}
	player.dimension.spawnParticle(alt.chargeParticle, at);
	player.dimension.playSound("beacon.ambient", at, { volume: 0.6, pitch: 1 + held / alt.chargeTicks });
}

function releaseAlt(aim: Aim, alt: AutoGunAltFire): void {
	const { player, gun } = aim;
	const tick = system.currentTick;
	if (!player.isValid || !isHolding(player, gun)) return;
	if (tick - aim.startedAt < alt.chargeTicks) return;
	const key = gunKey(player, gun);
	if (tick < (altReadyAt.get(key) ?? 0) || aim.wear + alt.wear > aim.durabilityLeft) {
		player.playSound("random.click", { pitch: 0.6 });
		return;
	}

	aim.wear += alt.wear;
	altReadyAt.set(key, tick + alt.interval);
	muzzleFlash(player, gun, alt.sound);
	if (alt.recoilAnimation) player.playAnimation(alt.recoilAnimation, { blendOutTime: 0.1 });
	if (alt.shake) player.runCommand(`camerashake add @s ${alt.shake} positional`);
	fireProjectile(player, alt.projectile);
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
	if (release && aim.alt && aim.gun.altFire) releaseAlt(aim, aim.gun.altFire);
	settleWear(aim);
}

export function onAutoGunStartUse(itemStack: ItemStack | undefined, player: Player): void {
	const gun = itemStack ? GUNS.get(itemStack.typeId) : undefined;
	if (!gun || !itemStack || !player.isValid) return;
	stopAiming(player.id);
	const tick = system.currentTick;
	const alt = player.isSneaking && gun.altFire !== undefined;
	if (!alt && heats.get(gunKey(player, gun))?.overheated) player.playSound("random.click", { pitch: 0.6 });
	aiming.set(player.id, {
		player,
		gun,
		slot: player.selectedSlotIndex,
		durabilityLeft: remainingDurability(player, itemStack),
		alt,
		startedAt: tick,
		nextShotAt: tick + gun.raiseTicks,
		wear: 0
	});
}

export function onAutoGunStopUse(player: Player): void {
	stopAiming(player.id, true);
}

export function clearAutoGunState(playerId: string): void {
	aiming.delete(playerId);
	const prefix = `${playerId}|`;
	for (const key of altReadyAt.keys()) if (key.startsWith(prefix)) altReadyAt.delete(key);
	for (const key of heats.keys()) if (key.startsWith(prefix)) heats.delete(key);
}

export function resetAutoGunHeat(player: Player): void {
	for (const gun of AUTO_GUNS) {
		if (!gun.heat) continue;
		setScore(player, gun.heat.objective, 0);
		setScore(player, gun.heat.overheatObjective, 0);
	}
}

export function tickAutoGuns(): void {
	const tick = system.currentTick;
	if (heats.size > 0) coolHeats(tick);
	if (aiming.size === 0) return;
	for (const [id, aim] of aiming) {
		const { player, gun } = aim;
		if (!player.isValid || !isHolding(player, gun)) {
			stopAiming(id);
			continue;
		}
		if (aim.alt && gun.altFire) {
			chargeAlt(player, aim, gun.altFire, tick);
			continue;
		}
		if (tick < aim.nextShotAt) continue;

		aim.nextShotAt = tick + gun.interval;
		fireMain(player, aim, tick);
	}
}

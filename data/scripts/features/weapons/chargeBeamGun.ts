import { system, EquipmentSlot, MolangVariableMap, type Dimension, type ItemStack, type Player, type Vector3 } from "@minecraft/server";
import { applyDurabilityDamage } from "../../core/items";
import { isLoadedLocation } from "../../core/location";
import { getScore, removeScore } from "../../core/scoreboard";
import { spawnPolarisBeam } from "../../core/beam";
import { strikeStats, strikeEntity, canWeaponHit, EXCLUDED_TYPES, EXCLUDED_FAMILIES } from "./damage";
import { type MuzzleOffset, muzzlePoint, normalize } from "./projectile";
import { CHARGE_BEAM_GUNS } from "./gunSpecs";

export interface ChargeBeamSounds {
	readonly charge: string;
	readonly ready: string;
	readonly fire: string;
}

export interface ChargeBeamGun {
	readonly id: string;
	readonly shotCategory: string;
	readonly chargeTicks: number;
	readonly minChargeTicks: number;
	readonly refireTicks: number;
	readonly recoilTicks: number;
	readonly chargeFxInterval: number;
	readonly chargeSoundTicks: number;
	readonly damage: number;
	readonly minPower: number;
	readonly range: number;
	readonly maxTargets: number;
	readonly pierceFalloff: number;
	readonly pierceFloor: number;
	readonly knockback: number;
	readonly wear: number;
	readonly auricCost: number;
	readonly muzzle: MuzzleOffset;
	readonly sounds: ChargeBeamSounds;
}

interface Charge {
	readonly player: Player;
	readonly gun: ChargeBeamGun;
	readonly slot: number;
	readonly startedAt: number;
	started: boolean;
	shownBar: number;
}

const AURIC_OBJECTIVE = "auric_charge";
const AURIC_MAX = 700;
const BAR_SEGMENTS = 20;

const GUNS = new Map<string, ChargeBeamGun>(CHARGE_BEAM_GUNS.map(gun => [gun.id, gun]));

const charging = new Map<string, Charge>();
const readyAt = new Map<string, number>();

function isHolding(player: Player, gun: ChargeBeamGun): boolean {
	return player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === gun.id;
}

function along(from: Vector3, dir: Vector3, distance: number): Vector3 {
	return { x: from.x + dir.x * distance, y: from.y + dir.y * distance, z: from.z + dir.z * distance };
}

function distanceBetween(a: Vector3, b: Vector3): number {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function powerOf(gun: ChargeBeamGun, held: number): number {
	const progress = Math.min(1, (held - gun.minChargeTicks) / (gun.chargeTicks - gun.minChargeTicks));
	return gun.minPower + (1 - gun.minPower) * progress;
}

function hasAuricCharge(player: Player, gun: ChargeBeamGun): boolean {
	return gun.auricCost <= 0 || getScore(player, AURIC_OBJECTIVE) >= gun.auricCost;
}

function denyShot(player: Player): void {
	player.sendMessage("Insufficient Charges");
	player.playSound("random.click", { pitch: 0.6 });
}

function showBar(charge: Charge, held: number): void {
	const { gun, player } = charge;
	const filled = Math.max(0, Math.min(BAR_SEGMENTS, Math.floor((held / gun.chargeTicks) * BAR_SEGMENTS)));
	if (filled === charge.shownBar) return;
	charge.shownBar = filled;
	const color = held < gun.minChargeTicks ? "§7" : "§6";
	const label = filled === BAR_SEGMENTS ? "§e§lREADY" : `${color}${Math.round((filled / BAR_SEGMENTS) * 100)}%`;
	const auric = gun.auricCost > 0 ? `§r, §gAuric Charge : ${getScore(player, AURIC_OBJECTIVE)}/${AURIC_MAX}` : "";
	player.onScreenDisplay.setActionBar(`§6Charge ${color}${"|".repeat(filled)}§8${"|".repeat(BAR_SEGMENTS - filled)} ${label}${auric}`);
}

function chargeFx(player: Player, gun: ChargeBeamGun, progress: number): void {
	const at = muzzlePoint(player, gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	const vars = new MolangVariableMap();
	vars.setFloat("variable.charge", progress);
	player.dimension.spawnParticle("ph:auric_apex_charge", at, vars);
	player.dimension.spawnParticle("ph:auric_apex_charge_glow", at, vars);
}

function chargeStarted(player: Player, gun: ChargeBeamGun): void {
	const at = muzzlePoint(player, gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	player.dimension.playSound(gun.sounds.charge, at);
}

function chargeReady(player: Player, gun: ChargeBeamGun): void {
	const at = muzzlePoint(player, gun.muzzle);
	if (!isLoadedLocation(player.dimension, at)) return;
	const vars = new MolangVariableMap();
	vars.setFloat("variable.scale", 0.35);
	player.dimension.spawnParticle("ph:auric_apex_flash", at, vars);
	player.dimension.playSound(gun.sounds.ready, at);
}

function stopChargeSound(charge: Charge): void {
	const held = system.currentTick - charge.startedAt;
	if (!charge.started || held >= charge.gun.chargeSoundTicks) return;
	charge.player.runCommand(`stopsound @a[r=24] ${charge.gun.sounds.charge}`);
}

function burst(dimension: Dimension, at: Vector3, vars: MolangVariableMap): void {
	if (!isLoadedLocation(dimension, at)) return;
	dimension.spawnParticle("ph:auric_apex_flash", at, vars);
	dimension.spawnParticle("ph:auric_apex_ring", at, vars);
	dimension.spawnParticle("ph:auric_apex_sparks", at, vars);
}

function drawBeam(player: Player, gun: ChargeBeamGun, end: Vector3, power: number): void {
	const { dimension } = player;
	const start = muzzlePoint(player, gun.muzzle);
	const length = distanceBetween(start, end);
	if (length < 0.1 || !isLoadedLocation(dimension, start)) return;
	const dir = normalize({ x: end.x - start.x, y: end.y - start.y, z: end.z - start.z });

	const vars = new MolangVariableMap();
	vars.setVector3("variable.dir", dir);
	vars.setFloat("variable.scale", 0.6 + 0.4 * power);
	burst(dimension, start, vars);
	spawnPolarisBeam(dimension, start, dir, length);
}

function fire(charge: Charge, held: number): void {
	const { player, gun } = charge;
	const { dimension } = player;
	const eye = player.getHeadLocation();
	if (!isLoadedLocation(dimension, eye)) return;

	if (gun.auricCost > 0) removeScore(player, AURIC_OBJECTIVE, gun.auricCost);
	const power = powerOf(gun, held);
	readyAt.set(player.id, system.currentTick + gun.refireTicks);
	player.startItemCooldown(gun.shotCategory, gun.recoilTicks);

	const dir = normalize(player.getViewDirection());
	const wall = dimension.getBlockFromRay(eye, dir, { maxDistance: gun.range, includePassableBlocks: false, includeLiquidBlocks: false });
	const reach = wall
		? distanceBetween(eye, {
			x: wall.block.location.x + wall.faceLocation.x,
			y: wall.block.location.y + wall.faceLocation.y,
			z: wall.block.location.z + wall.faceLocation.z
		})
		: gun.range;

	const hits = dimension.getEntitiesFromRay(eye, dir, {
		maxDistance: reach,
		ignoreBlockCollision: true,
		excludeTypes: EXCLUDED_TYPES,
		excludeFamilies: EXCLUDED_FAMILIES
	}).sort((a, b) => a.distance - b.distance);

	const stats = strikeStats(player, gun.damage * power);
	const push = normalize({ x: dir.x, y: 0, z: dir.z });
	let falloff = 1;
	let struck = 0;
	for (const { entity } of hits) {
		if (struck >= gun.maxTargets || !player.isValid) break;
		if (!canWeaponHit(player, entity)) continue;
		strikeEntity(player, entity, { ...stats, damage: stats.damage * falloff }, push, gun.knockback * power);
		falloff = Math.max(gun.pierceFloor, falloff * gun.pierceFalloff);
		struck++;
	}
	if (!player.isValid) return;

	dimension.playSound(gun.sounds.fire, muzzlePoint(player, gun.muzzle), { pitch: 1.15 - 0.15 * power });
	drawBeam(player, gun, along(eye, dir, reach), power);
	player.runCommand(`camerashake add @s ${(0.15 + 0.25 * power).toFixed(2)} 0.2 positional`);
	if (player.getComponent("inventory")?.container?.getItem(charge.slot)?.typeId === gun.id) {
		applyDurabilityDamage(player, { damage: gun.wear, slot: charge.slot });
	}
}

function release(charge: Charge): void {
	const { player, gun } = charge;
	const held = system.currentTick - charge.startedAt;
	stopChargeSound(charge);
	player.onScreenDisplay.setActionBar("");
	if (!isHolding(player, gun)) return;
	if (held < gun.minChargeTicks) {
		player.playSound("random.click", { pitch: 0.6 });
		return;
	}
	if (!hasAuricCharge(player, gun)) {
		denyShot(player);
		return;
	}
	fire(charge, held);
}

function stopCharging(id: string, fireShot: boolean): void {
	const charge = charging.get(id);
	if (!charge) return;
	charging.delete(id);
	if (!charge.player.isValid) return;
	if (fireShot) {
		release(charge);
		return;
	}
	stopChargeSound(charge);
	charge.player.onScreenDisplay.setActionBar("");
}

export function onChargeBeamStartUse(itemStack: ItemStack | undefined, player: Player): void {
	const gun = itemStack ? GUNS.get(itemStack.typeId) : undefined;
	if (!gun || !player.isValid) return;
	stopCharging(player.id, false);
	if (!hasAuricCharge(player, gun)) {
		denyShot(player);
		return;
	}
	charging.set(player.id, {
		player,
		gun,
		slot: player.selectedSlotIndex,
		startedAt: Math.max(system.currentTick, readyAt.get(player.id) ?? 0),
		started: false,
		shownBar: -1
	});
}

export function onChargeBeamStopUse(player: Player): void {
	stopCharging(player.id, true);
}

export function clearChargeBeamState(playerId: string): void {
	charging.delete(playerId);
	readyAt.delete(playerId);
}

export function tickChargeBeamGuns(): void {
	if (charging.size === 0) return;
	const tick = system.currentTick;
	for (const [id, charge] of charging) {
		const { player, gun } = charge;
		if (!player.isValid || !isHolding(player, gun)) {
			stopCharging(id, false);
			continue;
		}
		const held = tick - charge.startedAt;
		if (held < 0) continue;
		if (!charge.started) {
			charge.started = true;
			chargeStarted(player, gun);
		}
		if (held === gun.chargeTicks) chargeReady(player, gun);
		if (held <= gun.chargeTicks && held % gun.chargeFxInterval === 0) chargeFx(player, gun, held / gun.chargeTicks);
		showBar(charge, held);
	}
}

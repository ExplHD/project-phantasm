import { system, EntityDamageCause, EquipmentSlot, MolangVariableMap, Player, type Entity, type EntityHurtAfterEvent, type EntityHurtBeforeEvent, type ItemStack, type ItemUseBeforeEvent, type Vector3 } from "@minecraft/server";
import { addScore, getScore, removeScore } from "../../core/scoreboard";
import { isLoadedLocation } from "../../core/location";
import { spawnBeamLine } from "../../core/beam";
import { canWeaponHit } from "./damage";

const ITEM_ID = "ph:aethel_synapse";
const AURIC_OBJECTIVE = "auric_charge";
const AURIC_MAX = 700;
const GUARD_DAMAGE_PER_CHARGE = 2;
const LASER_COOLDOWN_TICKS = 60;
const LASER_DELAY_TICKS = 10;
const LASER_DAMAGE = 8;
const LASER_CHARGE = 5;
const LASER_CORE_STEP = 0.1;
const LASER_GLOW_STEP = 0.25;

const guarding = new Set<string>();
const laserReadyAt = new Map<string, number>();

function heldId(player: Player, slot: EquipmentSlot): string | undefined {
	return player.getComponent("equippable")?.getEquipment(slot)?.typeId;
}

function sub(a: Vector3, b: Vector3): Vector3 {
	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function normalize(v: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function burst(entity: Entity, at: Vector3, dir: Vector3, scale: number): void {
	const { dimension } = entity;
	if (!isLoadedLocation(dimension, at)) return;
	const vars = new MolangVariableMap();
	vars.setVector3("variable.dir", dir);
	vars.setFloat("variable.scale", scale);
	dimension.spawnParticle("ph:auric_apex_flash", at, vars);
	dimension.spawnParticle("ph:auric_apex_ring", at, vars);
	dimension.spawnParticle("ph:aethel_synapse_sparks", at, vars);
}

export function onAethelItemUse(event: ItemUseBeforeEvent): void {
	if (event.itemStack.typeId !== ITEM_ID) return;
	const player = event.source;
	if (getScore(player, AURIC_OBJECTIVE) > 0) return;
	event.cancel = true;
	system.run(() => {
		if (!player.isValid) return;
		player.playSound("note.bass");
	});
}

export function onAethelStartUse(itemStack: ItemStack | undefined, player: Player): void {
	if (itemStack?.typeId !== ITEM_ID) return;
	guarding.add(player.id);
	if (!isLoadedLocation(player.dimension, player.location)) return;
	player.dimension.playSound("weapon_slash.slash_light", player.location);
}

export function onAethelStopUse(player: Player): void {
	guarding.delete(player.id);
}

export function onAethelHurt(data: EntityHurtBeforeEvent): void {
	const player = data.hurtEntity;
	if (!(player instanceof Player) || !guarding.has(player.id)) return;
	if (heldId(player, EquipmentSlot.Mainhand) !== ITEM_ID) return;

	const source = data.damageSource;
	const from = source.damagingEntity?.location ?? source.damagingProjectile?.location;
	if (!from) return;

	const view = player.getViewDirection();
	const toDamage = sub(from, player.location);
	if (toDamage.x * view.x + toDamage.z * view.z < 0) return;

	const cost = Math.max(1, Math.ceil(data.damage / GUARD_DAMAGE_PER_CHARGE));
	const charge = getScore(player, AURIC_OBJECTIVE);
	if (charge < cost) {
		system.run(() => {
			if (!player.isValid) return;
			player.dimension.playSound("random.break", player.location);
		});
		return;
	}

	data.cancel = true;
	const attacker = source.damagingProjectile ? undefined : source.damagingEntity;
	system.run(() => {
		if (!player.isValid) return;
		removeScore(player, AURIC_OBJECTIVE, cost);
		const head = player.getHeadLocation();
		const at = { x: head.x + view.x * 1.1, y: head.y - 0.3 + view.y * 1.1, z: head.z + view.z * 1.1 };
		burst(player, at, view, 0.6);
		player.dimension.playSound("weapon_slash.slash_clash", player.location);
		if (!attacker?.isValid) return;
		const push = normalize({ x: toDamage.x, y: 0, z: toDamage.z });
		attacker.applyKnockback({ x: push.x * 0.6, z: push.z * 0.6 }, 0.15);
	});
}

function orbPoint(player: Player): Vector3 {
	const yaw = (player.getRotation().y * Math.PI) / 180;
	const left = { x: Math.cos(yaw), z: Math.sin(yaw) };
	const { x, y, z } = player.location;
	return { x: x + left.x * 0.72, y: y + 1.25, z: z + left.z * 0.72 };
}

function fireLaser(player: Player, target: Entity): void {
	if (!player.isValid || !target.isValid) return;
	if (heldId(player, EquipmentSlot.Offhand) !== ITEM_ID) return;
	const { dimension } = player;
	const start = orbPoint(player);
	const head = target.getHeadLocation();
	const end = { x: head.x, y: (head.y + target.location.y) / 2 + 0.2, z: head.z };
	if (!isLoadedLocation(dimension, start) || !isLoadedLocation(dimension, end)) return;

	const delta = sub(end, start);
	const length = Math.hypot(delta.x, delta.y, delta.z);
	const dir = normalize(delta);
	spawnBeamLine(dimension, "ph:aethel_synapse_laser", start, dir, length, LASER_CORE_STEP);
	spawnBeamLine(dimension, "ph:aethel_synapse_laser_glow", start, dir, length, LASER_GLOW_STEP);
	burst(target, end, dir, 0.45);
	dimension.playSound("custom_sfx.laser_shot", start);

	target.applyDamage(LASER_DAMAGE, { cause: EntityDamageCause.magic, damagingEntity: player });

	const gained = Math.min(LASER_CHARGE, AURIC_MAX - getScore(player, AURIC_OBJECTIVE));
	if (gained > 0) addScore(player, AURIC_OBJECTIVE, gained);
	if (!isLoadedLocation(dimension, player.location)) return;
	dimension.spawnParticle("ph:aethel_synapse_charge", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
}

export function onAethelStrike(event: EntityHurtAfterEvent): void {
	const player = event.damageSource.damagingEntity;
	if (!(player instanceof Player)) return;
	if (event.damageSource.cause !== EntityDamageCause.entityAttack) return;
	const target = event.hurtEntity;
	if (!canWeaponHit(player, target)) return;
	if (heldId(player, EquipmentSlot.Offhand) !== ITEM_ID) return;

	const now = system.currentTick;
	if (now < (laserReadyAt.get(player.id) ?? 0)) return;
	laserReadyAt.set(player.id, now + LASER_COOLDOWN_TICKS);

	const start = orbPoint(player);
	if (isLoadedLocation(player.dimension, start)) {
		const vars = new MolangVariableMap();
		vars.setFloat("variable.charge", 1);
		player.dimension.spawnParticle("ph:auric_apex_charge", start, vars);
		player.dimension.playSound("weapon_slash.auric_apex_ready", start);
	}
	system.runTimeout(() => fireLaser(player, target), LASER_DELAY_TICKS);
}

export function clearAethelState(playerId: string): void {
	guarding.delete(playerId);
	laserReadyAt.delete(playerId);
}

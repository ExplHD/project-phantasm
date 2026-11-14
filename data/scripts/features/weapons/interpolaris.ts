import { system, EntityDamageCause, InputPermissionCategory, MolangVariableMap, Player, type Dimension, type Entity, type Vector3 } from "@minecraft/server";
import { setScore } from "../../core/scoreboard";
import { isLoadedLocation, isOpenLocation } from "../../core/location";
import { canWeaponHit, strikeEntity, strikeStats, EXCLUDED_TYPES, EXCLUDED_FAMILIES } from "./damage";

const MARK_OBJECTIVE = "interpolaris_mark";
const MARK_TICKS = 200;
const MARK_PULSE_TICKS = 10;
const AIM_CONE = 0.5;

const SPLASH_RADIUS = 2;
const SWORD_RADIUS = 4;
const SWORD_SOUND_TICKS = 2;
const SWORD_FALL_TICKS = 6;

const INFLUENCE_TICKS = 60;
const INFLUENCE_PULSE_TICKS = 15;
const INFLUENCE_PULSE_DAMAGE = 5;
const INFLUENCE_FLASH_TICKS = 10;
const INFLUENCE_SLOWNESS = 1;
const INFLUENCE_GLITCH_TICKS = 4;

const SHROUD_RANGE = 48;
const SHROUD_TICKS = 20;
const SHROUD_CHARGE_TICKS = 10;
const SHROUD_DAMAGE = 50;
const SHROUD_BEHIND = [4.5, 3.5, 2.5, 1.2];
const SHROUD_BEAM_RANGE = 16;

const ULT_HEIGHT = 5;
const ULT_RISE_TICKS = 10;
const ULT_SHOT_TICKS = 4;
const ULT_SHOTS = 25;
const ULT_DAMAGE = 35;
const ULT_RANGE = 48;
const ULT_BLAST_RADIUS = 4;
const ULT_HEX_RADIUS = 2.2;
const ULT_ASSIST_COS = Math.cos((15 * Math.PI) / 180);
const ULT_LANDING_TICKS = 80;

const FLASH_COLORS = [{ red: 0.59, green: 0.3, blue: 0.93 }, { red: 0.9, green: 0.95, blue: 1 }];

interface Mark {
	readonly entity: Entity;
	until: number;
}

interface MarkHolder {
	readonly player: Player;
	readonly marks: Map<string, Mark>;
}

interface FallingSword {
	readonly owner: Player;
	readonly dimension: Dimension;
	readonly at: Vector3;
	readonly damage: number;
	readonly spawnTick: number;
}

interface Influence {
	readonly owner: Player;
	readonly target: Entity;
	readonly startTick: number;
}

interface ShroudStep {
	readonly player: Player;
	readonly target: Entity;
	readonly startTick: number;
	fired: boolean;
}

interface Interpolarity {
	readonly player: Player;
	readonly dimension: Dimension;
	readonly base: Vector3;
	readonly rise: number;
	readonly startTick: number;
	shots: number;
	seat: Entity | undefined;
}

const holders = new Map<string, MarkHolder>();
const swords: FallingSword[] = [];
const influences: Influence[] = [];
const steps = new Map<string, ShroudStep>();
const ults = new Map<string, Interpolarity>();

function sub(a: Vector3, b: Vector3): Vector3 {
	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function along(origin: Vector3, dir: Vector3, distance: number): Vector3 {
	return { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance, z: origin.z + dir.z * distance };
}

function cross(a: Vector3, b: Vector3): Vector3 {
	return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function unit(v: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function flat(v: Vector3, fallback: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.z);
	if (length > 0.01) return { x: v.x / length, y: 0, z: v.z / length };
	const other = Math.hypot(fallback.x, fallback.z);
	return other > 0.01 ? { x: fallback.x / other, y: 0, z: fallback.z / other } : { x: 0, y: 0, z: 1 };
}

function center(entity: Entity): Vector3 {
	const head = entity.getHeadLocation();
	return { x: entity.location.x, y: (entity.location.y + head.y) / 2, z: entity.location.z };
}

function castPoint(player: Player): Vector3 {
	const head = player.getHeadLocation();
	const view = player.getViewDirection();
	return { x: head.x + view.x * 0.8, y: head.y - 0.3 + view.y * 0.8, z: head.z + view.z * 0.8 };
}

function isAlive(entity: Entity): boolean {
	if (!entity.isValid) return false;
	const health = entity.getComponent("health");
	return !health || health.currentValue > 0;
}

function spawnFx(dimension: Dimension, id: string, at: Vector3, size: number): void {
	if (!isLoadedLocation(dimension, at)) return;
	const vars = new MolangVariableMap();
	vars.setFloat("variable.size", size);
	dimension.spawnParticle(id, at, vars);
}

function playAt(dimension: Dimension, id: string, at: Vector3, volume: number = 1): void {
	if (!isLoadedLocation(dimension, at)) return;
	dimension.playSound(id, at, { volume });
}

function implosion(dimension: Dimension, at: Vector3, radius: number): void {
	spawnFx(dimension, "ph:interpolaris_void", at, radius);
	spawnFx(dimension, "ph:interpolaris_rim", at, radius);
	spawnFx(dimension, "ph:interpolaris_implode", at, radius);
}

function blast(dimension: Dimension, at: Vector3, radius: number): void {
	implosion(dimension, at, radius * 0.6);
	spawnFx(dimension, "ph:interpolaris_shock", at, radius * 1.2);
	spawnFx(dimension, "ph:interpolaris_burst", at, radius * 0.7);
}

function drawLaser(dimension: Dimension, from: Vector3, to: Vector3, width: number): void {
	const delta = sub(to, from);
	const length = Math.hypot(delta.x, delta.y, delta.z);
	if (length < 0.05 || !isLoadedLocation(dimension, from)) return;
	const dir = unit(delta);
	const up = Math.abs(dir.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
	const u = unit(cross(dir, up));
	const vars = new MolangVariableMap();
	vars.setVector3("variable.dir", dir);
	vars.setVector3("variable.u", u);
	vars.setVector3("variable.w", cross(dir, u));
	vars.setFloat("variable.length", length);
	vars.setFloat("variable.width", width);
	vars.setFloat("variable.life", 0.26);
	dimension.spawnParticle("ph:interpolaris_laser", from, vars);
	spawnFx(dimension, "ph:interpolaris_flare", from, 0.6 * width);
	spawnFx(dimension, "ph:interpolaris_flare", to, 1.1 * width);
}

function rayReach(dimension: Dimension, from: Vector3, dir: Vector3, range: number): number {
	if (!isLoadedLocation(dimension, from)) return range;
	const hit = dimension.getBlockFromRay(from, dir, { maxDistance: range, includePassableBlocks: false, includeLiquidBlocks: false });
	if (!hit) return range;
	const face = sub({
		x: hit.block.location.x + hit.faceLocation.x,
		y: hit.block.location.y + hit.faceLocation.y,
		z: hit.block.location.z + hit.faceLocation.z
	}, from);
	return Math.hypot(face.x, face.y, face.z);
}

function glitch(entity: Entity, id: string, size: number, life: number): void {
	const { dimension, location } = entity;
	if (!isLoadedLocation(dimension, location)) return;
	const vars = new MolangVariableMap();
	vars.setFloat("variable.size", size);
	vars.setFloat("variable.height", Math.max(0.6, entity.getHeadLocation().y - location.y + 0.4));
	vars.setFloat("variable.life", life);
	dimension.spawnParticle(id, location, vars);
}

function deny(player: Player, reason: string): boolean {
	player.playSound("note.bass");
	player.sendMessage(`§c${reason}`);
	return false;
}

function freeze(player: Player, frozen: boolean): void {
	if (!player.isValid) return;
	const { inputPermissions } = player;
	inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !frozen);
	inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, !frozen);
	inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, !frozen);
}

function syncMarks(player: Player): void {
	if (!player.isValid) return;
	setScore(player, MARK_OBJECTIVE, holders.get(player.id)?.marks.size ?? 0);
}

function markPoint(entity: Entity): Vector3 {
	const head = entity.getHeadLocation();
	return { x: head.x, y: head.y + 0.7, z: head.z };
}

function addMark(player: Player, entity: Entity): void {
	if (!player.isValid || !isAlive(entity)) return;
	const holder = holders.get(player.id) ?? { player, marks: new Map<string, Mark>() };
	holders.set(player.id, holder);
	const until = system.currentTick + MARK_TICKS;
	const mark = holder.marks.get(entity.id);
	if (mark) mark.until = until;
	else holder.marks.set(entity.id, { entity, until });
	spawnFx(entity.dimension, "ph:interpolaris_mark", markPoint(entity), 1);
	syncMarks(player);
}

function removeMark(player: Player, entityId: string): void {
	const holder = holders.get(player.id);
	if (!holder?.marks.delete(entityId)) return;
	if (holder.marks.size === 0) holders.delete(player.id);
	syncMarks(player);
}

function markedEntities(player: Player): Entity[] {
	const holder = holders.get(player.id);
	if (!holder) return [];
	const found: Entity[] = [];
	for (const mark of holder.marks.values()) {
		if (isAlive(mark.entity)) found.push(mark.entity);
	}
	return found;
}

function nearby(player: Player, range: number): Entity[] {
	if (!isLoadedLocation(player.dimension, player.location)) return [];
	return player.dimension.getEntities({ location: player.location, maxDistance: range + 1, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES });
}

function pickTarget(player: Player, candidates: Entity[], range: number): Entity | undefined {
	const head = player.getHeadLocation();
	const view = player.getViewDirection();
	let best: Entity | undefined;
	let bestScore = Infinity;
	for (const entity of candidates) {
		if (!canWeaponHit(player, entity) || !isAlive(entity) || entity.dimension.id !== player.dimension.id) continue;
		const to = sub(center(entity), head);
		const distance = Math.hypot(to.x, to.y, to.z);
		if (distance > range) continue;
		const facing = distance > 0 ? (to.x * view.x + to.y * view.y + to.z * view.z) / distance : 1;
		const score = facing >= AIM_CONE ? distance - range : distance;
		if (score >= bestScore) continue;
		best = entity;
		bestScore = score;
	}
	return best;
}

function strikeArea(player: Player, dimension: Dimension, at: Vector3, radius: number, damage: number, marks: boolean): void {
	if (!player.isValid || !isLoadedLocation(dimension, at)) return;
	const stats = strikeStats(player, damage);
	const entities = dimension.getEntities({ location: at, maxDistance: radius, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES });
	for (const entity of entities) {
		if (!canWeaponHit(player, entity)) continue;
		const push = flat(sub(entity.location, at), player.getViewDirection());
		strikeEntity(player, entity, stats, { x: push.x, z: push.z }, 0.3);
		if (marks) addMark(player, entity);
	}
}

export function castPolarSplash(player: Player, damage: number, range: number): void {
	const target = pickTarget(player, nearby(player, range), range);
	if (!target) return;
	const at = center(target);
	implosion(target.dimension, at, SPLASH_RADIUS);
	spawnFx(target.dimension, "ph:interpolaris_burst", at, 1);
	strikeArea(player, target.dimension, at, SPLASH_RADIUS, damage, true);
}

export function castPolarSword(player: Player, damage: number, range: number): void {
	const target = pickTarget(player, nearby(player, range), range);
	if (!target) return;
	const { dimension } = target;
	const at = { x: target.location.x, y: target.location.y, z: target.location.z };
	if (!isLoadedLocation(dimension, at)) return;
	dimension.spawnEntity("ph:interpolaris_sword", at);
	spawnFx(dimension, "ph:interpolaris_rim", { x: at.x, y: at.y + 0.2, z: at.z }, SWORD_RADIUS);
	swords.push({ owner: player, dimension, at, damage, spawnTick: system.currentTick });
}

function stepSword(sword: FallingSword, now: number): boolean {
	const age = now - sword.spawnTick;
	if (age === SWORD_SOUND_TICKS) playAt(sword.dimension, "custom_sfx.interpolaris_sword", sword.at);
	if (age < SWORD_FALL_TICKS) return true;
	const at = { x: sword.at.x, y: sword.at.y + 0.3, z: sword.at.z };
	blast(sword.dimension, at, SWORD_RADIUS);
	strikeArea(sword.owner, sword.dimension, at, SWORD_RADIUS, sword.damage, true);
	if (isLoadedLocation(sword.dimension, at)) {
		sword.dimension.runCommand(`camerashake add @a[x=${at.x.toFixed(2)},y=${at.y.toFixed(2)},z=${at.z.toFixed(2)},r=10] 0.5 0.25 positional`);
	}
	return false;
}

export function canCastInfluence(player: Player): boolean {
	if (markedEntities(player).length === 0) return deny(player, "Polaris Influence needs an enemy marked with Polar Noise.");
	return true;
}

export function castInfluence(player: Player): void {
	const targets = markedEntities(player);
	if (targets.length === 0) return;
	const now = system.currentTick;
	player.playAnimation("animation.interpolaris.skill_1");
	playAt(player.dimension, "custom_sfx.interpolaris_noise", player.location);
	glitch(player, "ph:interpolaris_glitch_tear", 1.6, 0);
	for (const target of targets) {
		influences.push({ owner: player, target, startTick: now });
		target.addEffect("slowness", INFLUENCE_TICKS, { amplifier: INFLUENCE_SLOWNESS });
		glitch(target, "ph:interpolaris_glitch_tear", 1.2, 0);
		if (target instanceof Player) target.playSound("custom_sfx.interpolaris_noise");
	}
}

function stepInfluence(influence: Influence, now: number): boolean {
	const { owner, target } = influence;
	if (!owner.isValid || !isAlive(target)) return false;
	const age = now - influence.startTick;
	if (target instanceof Player && age < INFLUENCE_TICKS && age % INFLUENCE_FLASH_TICKS === 0) {
		const fadeColor = FLASH_COLORS[(age / INFLUENCE_FLASH_TICKS) % FLASH_COLORS.length];
		target.camera.fade({ fadeColor, fadeTime: { fadeInTime: 0.05, holdTime: 0.1, fadeOutTime: 0.3 } });
	}
	if (age < INFLUENCE_TICKS && age % INFLUENCE_GLITCH_TICKS === 0) glitch(target, "ph:interpolaris_glitch", 0.5, 0.25);
	if (age > 0 && age % INFLUENCE_PULSE_TICKS === 0) {
		spawnFx(target.dimension, "ph:interpolaris_mark", markPoint(target), 1);
		glitch(target, "ph:interpolaris_glitch_tear", 1, 0);
		target.applyDamage(INFLUENCE_PULSE_DAMAGE, { cause: EntityDamageCause.magic, damagingEntity: owner });
	}
	return age < INFLUENCE_TICKS;
}

function shroudTarget(player: Player): Entity | undefined {
	return pickTarget(player, markedEntities(player), SHROUD_RANGE);
}

function behindPoint(player: Player, target: Entity): Vector3 {
	const facing = flat(target.getViewDirection(), sub(target.location, player.location));
	for (const distance of SHROUD_BEHIND) {
		const point = along(target.location, facing, -distance);
		if (isOpenLocation(target.dimension, point) && isOpenLocation(target.dimension, { x: point.x, y: point.y + 1, z: point.z })) return point;
	}
	return { x: target.location.x, y: target.location.y, z: target.location.z };
}

export function canCastShroud(player: Player): boolean {
	if (steps.has(player.id) || ults.has(player.id)) return false;
	if (!shroudTarget(player)) return deny(player, `Shroud Step needs an enemy marked with Polar Noise within ${SHROUD_RANGE} blocks.`);
	return true;
}

export function castShroud(player: Player): void {
	const target = shroudTarget(player);
	if (!target) return;
	removeMark(player, target.id);
	const { dimension } = target;
	const destination = behindPoint(player, target);

	spawnFx(player.dimension, "ph:interpolaris_shroud", player.location, 1);
	playAt(player.dimension, "custom_sfx.interpolaris_shroud", player.location);
	player.teleport(destination, { dimension, facingLocation: center(target), keepVelocity: false });
	spawnFx(dimension, "ph:interpolaris_shroud", destination, 1);
	player.playAnimation("animation.interpolaris.skill_2");

	freeze(player, true);
	if (target instanceof Player) freeze(target, true);
	else target.addEffect("slowness", SHROUD_TICKS, { amplifier: 255, showParticles: false });
	steps.set(player.id, { player, target, startTick: system.currentTick, fired: false });
}

function endShroud(step: ShroudStep): void {
	steps.delete(step.player.id);
	freeze(step.player, false);
	if (step.target.isValid && step.target instanceof Player) freeze(step.target, false);
}

function fireShroud(step: ShroudStep): void {
	const { player, target } = step;
	step.fired = true;
	const view = player.getViewDirection();
	const right = unit(cross(view, { x: 0, y: 1, z: 0 }));
	const base = castPoint(player);
	const from = { x: base.x + right.x * 0.45, y: base.y - 0.1, z: base.z + right.z * 0.45 };
	const to = center(target);
	const dir = unit(sub(to, from));
	drawLaser(player.dimension, from, along(from, dir, rayReach(player.dimension, from, dir, SHROUD_BEAM_RANGE)), 1.4);
	blast(target.dimension, to, 1.6);
	playAt(player.dimension, "custom_sfx.interpolaris_laser", from);
	player.runCommand("camerashake add @s 0.35 0.2 positional");
	const push = flat(sub(target.location, player.location), player.getViewDirection());
	strikeEntity(player, target, strikeStats(player, SHROUD_DAMAGE), { x: push.x, z: push.z }, 0.2);
}

function stepShroud(step: ShroudStep, now: number): void {
	const { player, target } = step;
	const age = now - step.startTick;
	if (!player.isValid || age >= SHROUD_TICKS || (!step.fired && !isAlive(target))) {
		endShroud(step);
		return;
	}
	if (step.fired) return;
	if (age < SHROUD_CHARGE_TICKS) {
		if (age % 2 !== 0) return;
		const at = castPoint(player);
		spawnFx(player.dimension, "ph:interpolaris_glow", at, 0.3 + age * 0.06);
		spawnFx(player.dimension, "ph:interpolaris_implode", at, 0.9);
		return;
	}
	fireShroud(step);
}

export function canCastInterpolarity(player: Player): boolean {
	return !ults.has(player.id) && !steps.has(player.id);
}

function clearRise(dimension: Dimension, base: Vector3): number {
	for (let height = 1; height <= ULT_HEIGHT; height++) {
		if (!isOpenLocation(dimension, { x: base.x, y: base.y + height + 1, z: base.z })) return height - 1;
	}
	return ULT_HEIGHT;
}

export function castInterpolarity(player: Player): void {
	const { dimension } = player;
	const base = { x: player.location.x, y: player.location.y, z: player.location.z };
	ults.set(player.id, { player, dimension, base, rise: clearRise(dimension, base), startTick: system.currentTick, shots: 0, seat: undefined });
	setHover(player, true);
	player.playAnimation("animation.interpolaris.skill_3");
	spawnFx(dimension, "ph:interpolaris_shroud", base, 1);
	spawnFx(dimension, "ph:interpolaris_shock", { x: base.x, y: base.y + 0.2, z: base.z }, 4);
	playAt(dimension, "custom_sfx.interpolaris_shroud", base);
}

function setHover(player: Player, hovering: boolean): void {
	if (!player.isValid) return;
	const { inputPermissions } = player;
	inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !hovering);
	inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, !hovering);
	inputPermissions.setPermissionCategory(InputPermissionCategory.Dismount, !hovering);
}

function dropSeat(seat: Entity | undefined): void {
	if (!seat?.isValid) return;
	seat.getComponent("rideable")?.ejectRiders();
	seat.remove();
}

function endInterpolarity(ult: Interpolarity): void {
	const { player } = ult;
	ults.delete(player.id);
	dropSeat(ult.seat);
	if (!player.isValid) return;
	setHover(player, false);
	player.addEffect("slow_falling", ULT_LANDING_TICKS, { showParticles: false });
}

function mountSeat(ult: Interpolarity): void {
	const { player, dimension, base } = ult;
	const at = { x: base.x, y: base.y + ult.rise, z: base.z };
	if (!isLoadedLocation(dimension, at)) return;
	if (!ult.seat?.isValid) {
		player.teleport(at, { dimension, keepVelocity: false });
		ult.seat = dimension.spawnEntity("ph:interpolaris_seat", at);
	}
	if (player.getComponent("riding")?.entityRidingOn?.id === ult.seat.id) return;
	ult.seat.getComponent("rideable")?.addRider(player);
}

function hexPoint(player: Player, index: number): Vector3 {
	const yaw = (player.getRotation().y * Math.PI) / 180;
	const angle = (index * Math.PI) / 3;
	const side = Math.cos(angle) * ULT_HEX_RADIUS;
	return {
		x: player.location.x + Math.cos(yaw) * side,
		y: player.location.y + 1 + Math.sin(angle) * ULT_HEX_RADIUS,
		z: player.location.z + Math.sin(yaw) * side
	};
}

function assistedAim(player: Player, head: Vector3, look: Vector3): Vector3 {
	let best = look;
	let bestFacing = ULT_ASSIST_COS;
	for (const entity of nearby(player, ULT_RANGE)) {
		if (!canWeaponHit(player, entity) || !isAlive(entity)) continue;
		const to = sub(center(entity), head);
		const distance = Math.hypot(to.x, to.y, to.z);
		if (distance < 0.5 || distance > ULT_RANGE) continue;
		const dir = { x: to.x / distance, y: to.y / distance, z: to.z / distance };
		const facing = dir.x * look.x + dir.y * look.y + dir.z * look.z;
		if (facing <= bestFacing || rayReach(player.dimension, head, dir, distance) < distance - 0.5) continue;
		best = dir;
		bestFacing = facing;
	}
	return best;
}

function fireInterpolarity(ult: Interpolarity): void {
	const { player, dimension } = ult;
	const head = player.getHeadLocation();
	if (!isLoadedLocation(dimension, head)) return;
	const view = assistedAim(player, head, player.getViewDirection());

	const reach = rayReach(dimension, head, view, ULT_RANGE);
	const wall = reach < ULT_RANGE;
	const struck = dimension
		.getEntitiesFromRay(head, view, { maxDistance: reach, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES })
		.find(hit => canWeaponHit(player, hit.entity));

	const from = hexPoint(player, ult.shots % 6);
	const end = along(head, view, struck ? struck.distance : reach);
	drawLaser(dimension, from, end, 1);
	playAt(dimension, "custom_sfx.interpolaris_laser", player.location, 0.7);

	if (!struck && !wall) return;
	const at = struck ? center(struck.entity) : along(head, view, Math.max(0, reach - 0.3));
	blast(dimension, at, ULT_BLAST_RADIUS);
	playAt(dimension, "random.explode", at, 0.6);
	strikeArea(player, dimension, at, ULT_BLAST_RADIUS, ULT_DAMAGE, false);
	player.runCommand("camerashake add @s 0.2 0.15 positional");
}

function stepInterpolarity(ult: Interpolarity, now: number): void {
	const { player, dimension, base } = ult;
	if (!player.isValid || !isAlive(player) || player.dimension.id !== dimension.id) {
		endInterpolarity(ult);
		return;
	}
	const age = now - ult.startTick;
	if (age < ULT_RISE_TICKS) {
		const lift = age / ULT_RISE_TICKS;
		player.teleport({ x: base.x, y: base.y + ult.rise * lift * (2 - lift), z: base.z }, { dimension, keepVelocity: false });
		return;
	}
	mountSeat(ult);

	const firing = age - ULT_RISE_TICKS;
	if (firing % ULT_SHOT_TICKS !== 0) return;
	if (ult.shots >= ULT_SHOTS) {
		endInterpolarity(ult);
		return;
	}
	for (let i = 0; i < 6; i++) spawnFx(dimension, "ph:interpolaris_glow", hexPoint(player, i), 0.35);
	fireInterpolarity(ult);
	ult.shots++;
}

function tickMarks(holder: MarkHolder, now: number): void {
	const { player, marks } = holder;
	if (!player.isValid) {
		holders.delete(holder.player.id);
		return;
	}
	let changed = false;
	for (const [id, mark] of marks) {
		if (!isAlive(mark.entity) || now >= mark.until) {
			marks.delete(id);
			changed = true;
			continue;
		}
		if ((mark.until - now) % MARK_PULSE_TICKS !== 0) continue;
		spawnFx(mark.entity.dimension, "ph:interpolaris_mark", markPoint(mark.entity), 1);
	}
	if (!changed) return;
	if (marks.size === 0) holders.delete(player.id);
	syncMarks(player);
}

export function tickInterpolaris(): void {
	if (holders.size === 0 && swords.length === 0 && influences.length === 0 && steps.size === 0 && ults.size === 0) return;
	const now = system.currentTick;
	for (const holder of [...holders.values()]) tickMarks(holder, now);
	for (let i = swords.length - 1; i >= 0; i--) {
		const sword = swords[i];
		if (!sword || !stepSword(sword, now)) swords.splice(i, 1);
	}
	for (let i = influences.length - 1; i >= 0; i--) {
		const influence = influences[i];
		if (!influence || !stepInfluence(influence, now)) influences.splice(i, 1);
	}
	for (const step of [...steps.values()]) stepShroud(step, now);
	for (const ult of [...ults.values()]) stepInterpolarity(ult, now);
}

export function clearInterpolarisState(playerId: string): void {
	holders.delete(playerId);
	const seat = ults.get(playerId)?.seat;
	ults.delete(playerId);
	if (seat) system.run(() => dropSeat(seat));
	const step = steps.get(playerId);
	if (!step) return;
	steps.delete(playerId);
	const { target } = step;
	if (!(target instanceof Player)) return;
	system.run(() => freeze(target, false));
}

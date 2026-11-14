import { Entity, EntityDamageCause, Player, type Vector3 } from "@minecraft/server";
import {
	addHazard,
	after,
	announce,
	arenaPlayers,
	arenaStand,
	arenaVictims,
	ARENA_HALF,
	baseDamage,
	blinkTo,
	CLONE_ID,
	CORRUPTION_CAUSE,
	CYAN,
	drawBurst,
	drawLane,
	drawLine,
	drawSkyRift,
	drawMotes,
	drawOrb,
	drawRing,
	drawTile,
	endAttack,
	faded,
	fatal,
	flatDirection,
	flatDistance,
	GOLD,
	hit,
	lockJump,
	offset,
	orbVars,
	playSound,
	pointAround,
	removeHelper,
	setPose,
	showTitle,
	SKY_RIFT_INTERVAL,
	spawnHelper,
	standPoint,
	unlockJump,
	victimsNear,
	VIOLET,
	WHITE,
	type Attack,
	type PolarisFight
} from "./toolkit";

const RIFT_CELLS = 5;
const RIFT_CELL_SIZE = 12;
const RIFT_CORRUPTED = 12;
const RIFT_WARN = 30;
const RIFT_DURATION = 240;
const RIFT_DAMAGE = 30;
const RIFT_DAMAGE_INTERVAL = 20;

const CLONE_LIFETIME = 300;
const CLONE_HEAL = 150;
const CLONE_DASH_SPEED = 0.85;
const CLONE_DASH_MAX = 30;
const CLONE_REACH = 3.5;
const CLONE_CHARGE = 20;
const CLONE_RECOVER = 15;
const CLONE_SWEEP_RADIUS = 5;

const GRID_PERIOD = 4;
const GRID_WAVES = 5;
const GRID_WINDUP = 50;
const GRID_GAP = 10;
const GRID_DAMAGE = 50;

const PUNISH_SPLIT = 20;
const PUNISH_CHARGE = 200;
const GIFTS_NEEDED = 3;
const GIFT_REACH = 1.8;

type CloneState = "dash" | "charge" | "recover";

function pickCorruptedCells(): boolean[] {
	const order = Array.from({ length: RIFT_CELLS * RIFT_CELLS }, (_, index): number => index);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const swap = order[i];
		order[i] = order[j];
		order[j] = swap;
	}
	const cells = new Array<boolean>(order.length).fill(false);
	for (const index of order.slice(0, RIFT_CORRUPTED)) cells[index] = true;
	return cells;
}

function riftCellAt(fight: PolarisFight, location: Vector3): number {
	const half = (RIFT_CELLS * RIFT_CELL_SIZE) / 2;
	const column = Math.floor((location.x - fight.arena.x + half) / RIFT_CELL_SIZE);
	const row = Math.floor((location.z - fight.arena.z + half) / RIFT_CELL_SIZE);
	if (column < 0 || column >= RIFT_CELLS || row < 0 || row >= RIFT_CELLS) return -1;
	if (location.y < fight.arena.y - 1.5 || location.y > fight.arena.y + 3) return -1;
	return row * RIFT_CELLS + column;
}

function drawRift(fight: PolarisFight, cells: boolean[], lifeTicks: number, alpha: number, motes: boolean): void {
	const half = (RIFT_CELLS * RIFT_CELL_SIZE) / 2;
	for (let index = 0; index < cells.length; index++) {
		if (!cells[index]) continue;
		const center = {
			x: fight.arena.x - half + ((index % RIFT_CELLS) + 0.5) * RIFT_CELL_SIZE,
			y: fight.arena.y + 0.08,
			z: fight.arena.z - half + (Math.floor(index / RIFT_CELLS) + 0.5) * RIFT_CELL_SIZE
		};
		drawTile(fight, center, RIFT_CELL_SIZE / 2, lifeTicks, faded(VIOLET, alpha));
		if (motes) drawMotes(fight, center, RIFT_CELL_SIZE / 2, 40, VIOLET);
	}
}

function quarksRift(fight: PolarisFight): void {
	const boss = fight.boss;
	const cells = pickCorruptedCells();

	boss.playAnimation("animation.polaris.cast");
	playSound(fight, "beacon.activate", boss.location, 0.7);
	drawRift(fight, cells, RIFT_WARN, 0.45, false);
	announce(fight, "§5The Quark's Rift §7Corrupted tiles lock jump and sprint");

	after(fight, RIFT_WARN, (): void => {
		const lastHit = new Map<string, number>();
		playSound(fight, "respawn_anchor.set_spawn", fight.arena, 0.6);

		addHazard(fight, (age): boolean => {
			if (age >= RIFT_DURATION) {
				for (const id of [...fight.jumpLocked]) unlockJump(fight, id);
				return false;
			}
			if (age % 20 === 0) drawRift(fight, cells, 22, 0.9, true);
			if (age % 5 !== 0) return true;

			const standing = new Set<string>();
			for (const victim of arenaVictims(fight)) {
				const cell = riftCellAt(fight, victim.location);
				if (cell < 0 || !cells[cell]) continue;
				standing.add(victim.id);

				if (victim instanceof Player) {
					lockJump(fight, victim);
					if (victim.isSprinting) victim.addEffect("slowness", 12, { amplifier: 2, showParticles: false });
					victim.onScreenDisplay.setActionBar("§5Corrupted §7Step off the tile");
				}

				if (fight.tick - (lastHit.get(victim.id) ?? -RIFT_DAMAGE_INTERVAL) < RIFT_DAMAGE_INTERVAL) continue;
				lastHit.set(victim.id, fight.tick);
				hit(fight, victim, RIFT_DAMAGE, CORRUPTION_CAUSE);
			}

			for (const id of [...fight.jumpLocked]) {
				if (!standing.has(id)) unlockJump(fight, id);
			}
			return true;
		});
	});

	after(fight, RIFT_WARN + 10, (): void => endAttack(fight));
}

function steerClone(clone: Entity, prey: Player): void {
	const direction = flatDirection(clone.location, prey.location);
	const velocity = clone.getVelocity();
	clone.applyImpulse({
		x: direction.x * CLONE_DASH_SPEED - velocity.x,
		y: 0,
		z: direction.z * CLONE_DASH_SPEED - velocity.z
	});
	clone.setRotation({ x: 0, y: Math.atan2(-direction.x, direction.z) * (180 / Math.PI) });
}

function haltClone(clone: Entity): void {
	const velocity = clone.getVelocity();
	clone.applyImpulse({ x: -velocity.x, y: 0, z: -velocity.z });
}

function cloneSweep(fight: PolarisFight, clone: Entity): void {
	const center = clone.location;
	drawRing(fight, offset(center, 0, 0.15, 0), 1, CLONE_SWEEP_RADIUS, 6, WHITE);
	drawBurst(fight, offset(center, 0, 1.5, 0), 3, CYAN);
	playSound(fight, "weapon_slash.slash_heavy", center);
	clone.playAnimation("animation.polaris.strike");

	for (const victim of victimsNear(fight, center, CLONE_SWEEP_RADIUS)) {
		if (Math.abs(victim.location.y - center.y) > 3) continue;
		hit(fight, victim, baseDamage(fight), EntityDamageCause.entityAttack);
	}
}

function falseClone(fight: PolarisFight): void {
	const boss = fight.boss;
	const prey = fight.target;
	const front = prey?.isValid ? flatDirection(boss.location, prey.location) : { x: 0, z: 1 };
	const spot = standPoint(fight, boss.location.x + front.x * 3, boss.location.z + front.z * 3, boss.location.y) ?? boss.location;
	const clone = spawnHelper(fight, CLONE_ID, spot);
	if (!clone) {
		endAttack(fight);
		return;
	}

	fight.invulnerable = true;
	setPose(boss, "guard");
	drawBurst(fight, offset(spot, 0, 1.8, 0), 3, CYAN);
	playSound(fight, "mob.evocation_illager.prepare_summon", boss.location, 1.2);
	announce(fight, "§bThe False Clone §7Destroy it in 15s or Polaris heals 150 HP");

	const release = (message: string): void => {
		fight.invulnerable = false;
		announce(fight, message);
		endAttack(fight);
	};

	let state: CloneState = "dash";
	let stateStart = 0;

	addHazard(fight, (age): boolean => {
		if (!clone.isValid) {
			fight.helpers.delete(clone.id);
			playSound(fight, "random.glass", boss.location, 0.8);
			release("§aFalse Clone destroyed");
			return false;
		}

		if (age >= CLONE_LIFETIME) {
			const health = boss.getComponent("minecraft:health");
			if (health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + CLONE_HEAL));
			drawLine(fight, offset(clone.location, 0, 2, 0), offset(boss.location, 0, 2, 0), 0.8, 10, CYAN);
			drawBurst(fight, offset(boss.location, 0, 2, 0), 4, CYAN);
			playSound(fight, "beacon.power.select", boss.location, 1.2);
			removeHelper(fight, clone);
			release("§cPolaris recovered 150 HP");
			return false;
		}

		const target = fight.target;
		const elapsed = age - stateStart;

		if (state === "dash") {
			if (!target?.isValid) return true;
			steerClone(clone, target);
			if (flatDistance(clone.location, target.location) > CLONE_REACH && elapsed < CLONE_DASH_MAX) return true;

			state = "charge";
			stateStart = age;
			haltClone(clone);
			setPose(clone, "charge");
			drawRing(fight, offset(clone.location, 0, 0.15, 0), CLONE_SWEEP_RADIUS, CLONE_SWEEP_RADIUS, CLONE_CHARGE, faded(CYAN, 0.7));
			playSound(fight, "beacon.power.select", clone.location, 1.8, 0.8);
			return true;
		}

		if (state === "charge") {
			if (elapsed < CLONE_CHARGE) return true;
			state = "recover";
			stateStart = age;
			setPose(clone, "none");
			cloneSweep(fight, clone);
			return true;
		}

		if (elapsed >= CLONE_RECOVER) {
			state = "dash";
			stateStart = age;
		}
		return true;
	});
}

function wrap(value: number, period: number): number {
	return ((value % period) + period) % period;
}

function inGridBeam(fight: PolarisFight, location: Vector3, shiftX: number, shiftZ: number): boolean {
	const column = Math.floor(location.x - fight.arena.x + ARENA_HALF);
	const row = Math.floor(location.z - fight.arena.z + ARENA_HALF);
	return wrap(column - shiftX, GRID_PERIOD) !== 0 || wrap(row - shiftZ, GRID_PERIOD) !== 0;
}

function drawGrid(fight: PolarisFight, shiftX: number, shiftZ: number, lifeTicks: number, alpha: number): void {
	const { arena } = fight;
	const size = ARENA_HALF * 2;
	const y = arena.y + 0.12;
	const beamY = arena.y + 1.2;
	const color = faded(alpha >= 1 ? WHITE : CYAN, alpha);

	for (let lane = -1; lane * GRID_PERIOD < size; lane++) {
		const lowX = Math.max(0, lane * GRID_PERIOD + shiftX + 1);
		const highX = Math.min(size, lane * GRID_PERIOD + shiftX + GRID_PERIOD);
		if (highX > lowX) {
			const x = arena.x - ARENA_HALF + (lowX + highX) / 2;
			if (alpha < 1) drawLane(fight, { x, y, z: arena.z - ARENA_HALF }, { x, y, z: arena.z + ARENA_HALF }, highX - lowX, lifeTicks, color);
			drawLine(fight, { x, y: beamY, z: arena.z - ARENA_HALF }, { x, y: beamY, z: arena.z + ARENA_HALF }, highX - lowX, lifeTicks, color);
		}

		const lowZ = Math.max(0, lane * GRID_PERIOD + shiftZ + 1);
		const highZ = Math.min(size, lane * GRID_PERIOD + shiftZ + GRID_PERIOD);
		if (highZ > lowZ) {
			const z = arena.z - ARENA_HALF + (lowZ + highZ) / 2;
			if (alpha < 1) drawLane(fight, { x: arena.x - ARENA_HALF, y, z }, { x: arena.x + ARENA_HALF, y, z }, highZ - lowZ, lifeTicks, color);
			drawLine(fight, { x: arena.x - ARENA_HALF, y: beamY, z }, { x: arena.x + ARENA_HALF, y: beamY, z }, highZ - lowZ, lifeTicks, color);
		}
	}
}

function polarNodeAnnihilation(fight: PolarisFight): void {
	const boss = fight.boss;
	setPose(boss, "channel");
	playSound(fight, "beacon.activate", boss.location, 1.4);
	announce(fight, "§bThe Polar Node Annihilation §7Stand where two dark lanes cross");

	for (let wave = 0; wave < GRID_WAVES; wave++) {
		after(fight, wave * (GRID_WINDUP + GRID_GAP), (): void => {
			const shiftX = Math.floor(Math.random() * GRID_PERIOD);
			const shiftZ = Math.floor(Math.random() * GRID_PERIOD);
			drawGrid(fight, shiftX, shiftZ, GRID_WINDUP, 0.22);
			playSound(fight, "note.pling", fight.arena, 0.6, 0.7);

			after(fight, GRID_WINDUP, (): void => {
				drawGrid(fight, shiftX, shiftZ, 7, 1);
				playSound(fight, "custom_sfx.laser_shot", fight.arena);
				for (const victim of arenaVictims(fight)) {
					if (!inGridBeam(fight, victim.location, shiftX, shiftZ)) continue;
					hit(fight, victim, GRID_DAMAGE, EntityDamageCause.magic);
				}
			});
		});
	}

	after(fight, GRID_WAVES * (GRID_WINDUP + GRID_GAP) + 10, (): void => endAttack(fight));
}

function scatterGifts(fight: PolarisFight, count: number): Vector3[] {
	const gifts: Vector3[] = [];
	for (let i = 0; i < count; i++) {
		const point = pointAround(fight, fight.arena, 7, 24);
		if (point) gifts.push(offset(point, 0, 1.2, 0));
	}
	return gifts;
}

function orbitalStrike(fight: PolarisFight, held: Map<string, number>): void {
	const boss = fight.boss;
	const { arena } = fight;
	setPose(boss, "none");
	boss.playAnimation("animation.polaris.strike");

	drawLine(fight, arena, offset(arena, 0, 64, 0), 24, 14, WHITE);
	drawRing(fight, offset(arena, 0, 0.2, 0), 2, ARENA_HALF * Math.SQRT2, 14, WHITE);
	drawRing(fight, offset(arena, 0, 0.3, 0), 1, ARENA_HALF, 20, CYAN);
	drawBurst(fight, offset(arena, 0, 3, 0), 14, WHITE);
	playSound(fight, "random.explode", arena, 0.5, 4);
	playSound(fight, "mob.warden.sonic_boom", arena, 0.6, 4);

	for (const player of arenaPlayers(fight)) {
		player.camera.fade({ fadeColor: { red: 1, green: 1, blue: 1 }, fadeTime: { fadeInTime: 0.05, holdTime: 0.15, fadeOutTime: 0.7 } });
	}

	for (const victim of arenaVictims(fight)) {
		if (victim instanceof Player && (held.get(victim.id) ?? 0) >= GIFTS_NEEDED) {
			drawRing(fight, offset(victim.location, 0, 0.2, 0), 1.5, 4, 10, GOLD);
			drawBurst(fight, offset(victim.location, 0, 1, 0), 3, GOLD);
			victim.playSound("random.glass", { pitch: 1.4 });
			victim.onScreenDisplay.setActionBar("§6The Polaris Gift took the strike for you");
			continue;
		}
		fatal(victim);
	}
}

function thePunishment(fight: PolarisFight): void {
	const boss = fight.boss;
	const held = new Map<string, number>();
	const gifts: Vector3[] = [];
	const giftOrb = orbVars(0.9, 12, GOLD);

	blinkTo(fight, boss, arenaStand(fight));
	setPose(boss, "charge");
	showTitle(fight, "§cThe Punishment", `§7Collect ${GIFTS_NEEDED} Polaris Gifts`);
	playSound(fight, "mob.wither.spawn", boss.location, 0.7, 2);

	after(fight, PUNISH_SPLIT, (): void => {
		const top = offset(boss.location, 0, 4, 0);
		drawLine(fight, top, offset(top, 0, 60, 0), 3, 24, WHITE);
		drawBurst(fight, top, 6, WHITE);
		playSound(fight, "ambient.weather.thunder", boss.location, 0.8, 4);
		gifts.push(...scatterGifts(fight, arenaPlayers(fight).length * GIFTS_NEEDED + 2));
	});

	addHazard(fight, (age): boolean => {
		if (age < PUNISH_SPLIT) return true;
		if (age >= PUNISH_CHARGE) {
			drawSkyRift(fight, "close");
			orbitalStrike(fight, held);
			after(fight, 40, (): void => endAttack(fight));
			return false;
		}

		if ((age - PUNISH_SPLIT) % SKY_RIFT_INTERVAL === 0) drawSkyRift(fight, age === PUNISH_SPLIT ? "open" : "hold");
		if (age % 10 === 0) {
			for (const gift of gifts) drawOrb(fight, gift, giftOrb);
			drawLine(fight, offset(boss.location, 0, 6, 0), offset(boss.location, 0, 64, 0), 1.2, 12, faded(WHITE, 0.6));
		}
		if (age % 2 !== 0) return true;

		const seconds = Math.ceil((PUNISH_CHARGE - age) / 20);
		for (const player of arenaPlayers(fight)) {
			const count = held.get(player.id) ?? 0;

			for (let i = gifts.length - 1; i >= 0 && (held.get(player.id) ?? 0) < GIFTS_NEEDED; i--) {
				if (Math.hypot(gifts[i].x - player.location.x, gifts[i].y - 1.2 - player.location.y, gifts[i].z - player.location.z) > GIFT_REACH) continue;
				drawBurst(fight, gifts[i], 2, GOLD);
				gifts.splice(i, 1);
				held.set(player.id, (held.get(player.id) ?? 0) + 1);
				player.playSound("random.orb", { pitch: 0.8 + (held.get(player.id) ?? 0) * 0.2 });
			}

			const now = held.get(player.id) ?? 0;
			if (now >= GIFTS_NEEDED && count < GIFTS_NEEDED) player.playSound("beacon.power.select", { pitch: 1.6 });
			if (now >= GIFTS_NEEDED && age % 10 === 0) drawRing(fight, offset(player.location, 0, 0.2, 0), 1.4, 1.4, 12, GOLD);
			if (age % 20 !== 0) continue;
			player.onScreenDisplay.setActionBar(now >= GIFTS_NEEDED
				? `§cThe Punishment §f${seconds}s §6Shield ready`
				: `§cThe Punishment §f${seconds}s §7Polaris Gift §f${now}/${GIFTS_NEEDED}`);
		}
		return true;
	});
}

export const PHASE_ONE_ATTACKS: Attack[] = [quarksRift, falseClone, polarNodeAnnihilation, thePunishment];

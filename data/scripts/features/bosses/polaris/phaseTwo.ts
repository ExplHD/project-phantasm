import { Entity, EntityDamageCause, Player, type Vector3 } from "@minecraft/server";
import { isLoadedLocation } from "~/core/location";
import {
	addHazard,
	after,
	announce,
	arenaPlayers,
	arenaStand,
	arenaVictims,
	baseDamage,
	blinkTo,
	clearRun,
	CLONE_ID,
	distanceToSegment,
	drawBurst,
	drawLane,
	drawLine,
	drawSkyRift,
	drawOrb,
	drawPortal,
	drawRing,
	endAttack,
	faded,
	fatal,
	flatDirection,
	flatDistance,
	flatDistanceToSegment,
	hit,
	lerp,
	NODE_ID,
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
	victimsNear,
	VIOLET,
	WHITE,
	type Attack,
	type PolarisFight
} from "./toolkit";

const BLINK_COUNT = 3;
const BLINK_GAP = 6;
const DASH_LOCK = 20;
const DASH_WARN = 8;
const DASH_TICKS = 5;
const DASH_EXTRA = 8;
const DASH_MAX = 24;
const DASH_WIDTH = 2.2;
const TRAIL_FUSE = 12;
const TRAIL_WIDTH = 2.5;

const RING_COUNT = 3;
const RING_GAP = 12;
const RING_WINDUP = 10;
const RING_SPEED = 1.2;
const RING_REACH = 30;
const RING_BAND = 0.9;

const SHARD_COUNT = 12;
const SHARD_SPEED = 1.1;
const SHARD_TURN = 0.06;
const SHARD_LIFE = 70;
const SHARD_DAMAGE = 8;
const SHARD_HIT = 1;
const PORTAL_RADIUS = 22;
const PORTAL_SIZE = 1.5;
const PORTAL_LINGER = 14;
const BARRAGE_START = 30;
const BARRAGE_GAP = 6;

const RUSH_FROM = 64;
const RUSH_TO = 16;
const RUSH_STEP = 4;
const RUSH_DELAY = 4;
const RUSH_WINDUP = 30;

const SPIN_COUNT = 2;
const SPIN_RADIUS = 8;
const SPIN_WINDUP = 10;
const SPIN_GAP = 14;

const MIRROR_VOLLEYS = 3;
const MIRROR_PERIOD = 50;
const MIRROR_WARN = 20;
const MIRROR_RADIUS = 10;
const MIRROR_RANGE = 26;
const MIRROR_WIDTH = 1.2;

const COLLAPSE_CHARGE = 400;
const COLLAPSE_NODES = 4;
const COLLAPSE_NODE_RADIUS = 14;
const STASIS_SLOWNESS = 2;

interface Beam {
	readonly from: Vector3;
	readonly to: Vector3;
}

function dimensionalBlinkSlash(fight: PolarisFight): void {
	const boss = fight.boss;

	for (let i = 0; i < BLINK_COUNT; i++) {
		after(fight, i * BLINK_GAP, (): void => {
			const prey = fight.target;
			if (!prey?.isValid) return;
			const point = pointAround(fight, prey.location, 5, 8);
			if (point) blinkTo(fight, boss, point, prey.location);
		});
	}

	after(fight, DASH_LOCK, (): void => {
		const prey = fight.target;
		if (!prey?.isValid) {
			endAttack(fight, 20);
			return;
		}

		const start = boss.location;
		const direction = flatDirection(start, prey.location);
		const wanted = Math.min(flatDistance(start, prey.location) + DASH_EXTRA, DASH_MAX);
		const reach = clearRun(fight, start, direction, wanted);
		const end = offset(start, direction.x * reach, 0, direction.z * reach);
		const lineFrom = offset(start, 0, 1.2, 0);
		const lineTo = offset(end, 0, 1.2, 0);

		boss.teleport(start, { facingLocation: end });
		drawLine(fight, lineFrom, lineTo, DASH_WIDTH, DASH_WARN + 2, faded(VIOLET, 0.35));
		playSound(fight, "beacon.power.select", start, 1.9, 0.8);

		after(fight, DASH_WARN, (): void => {
			const struck = new Set<string>();
			boss.playAnimation("animation.polaris.dash");
			playSound(fight, "weapon_slash.slash_heavy", start, 1.2);

			addHazard(fight, (age): boolean => {
				const from = lerp(start, end, age / DASH_TICKS);
				const to = lerp(start, end, (age + 1) / DASH_TICKS);
				boss.teleport(to, { facingLocation: offset(end, direction.x, 0, direction.z) });

				for (const victim of victimsNear(fight, to, DASH_WIDTH + reach / DASH_TICKS + 1)) {
					if (struck.has(victim.id)) continue;
					if (Math.abs(victim.location.y - to.y) > 3) continue;
					if (flatDistanceToSegment(victim.location, from, to) > DASH_WIDTH) continue;
					struck.add(victim.id);
					hit(fight, victim, baseDamage(fight), EntityDamageCause.entityAttack);
				}
				return age + 1 < DASH_TICKS;
			});

			after(fight, DASH_TICKS, (): void => {
				drawLine(fight, lineFrom, lineTo, 0.7, TRAIL_FUSE + 2, VIOLET);
			});

			after(fight, DASH_TICKS + TRAIL_FUSE, (): void => {
				drawLine(fight, lineFrom, lineTo, TRAIL_WIDTH * 2, 7, WHITE);
				for (let step = 0; step <= reach; step += 4) {
					drawBurst(fight, lerp(lineFrom, lineTo, reach > 0 ? step / reach : 0), 3, VIOLET);
				}
				playSound(fight, "random.explode", lerp(start, end, 0.5), 1.4);

				for (const victim of victimsNear(fight, lerp(start, end, 0.5), reach / 2 + TRAIL_WIDTH + 1)) {
					if (Math.abs(victim.location.y - start.y) > 3) continue;
					if (flatDistanceToSegment(victim.location, start, end) > TRAIL_WIDTH) continue;
					hit(fight, victim, baseDamage(fight), EntityDamageCause.magic);
				}
				after(fight, 10, (): void => endAttack(fight));
			});
		});
	});
}

function eventHorizonRing(fight: PolarisFight): void {
	const boss = fight.boss;
	const origin = { ...boss.location };
	const ground = offset(origin, 0, 0.15, 0);

	boss.playAnimation("animation.polaris.cast");
	drawRing(fight, ground, 2, 2, RING_WINDUP, faded(VIOLET, 0.7));
	playSound(fight, "beacon.power.select", origin, 0.7);
	announce(fight, "§dEvent Horizon Ring §7Jump, parry or dash through");

	for (let wave = 0; wave < RING_COUNT; wave++) {
		after(fight, RING_WINDUP + wave * RING_GAP, (): void => {
			const struck = new Set<string>();
			drawRing(fight, ground, 1, RING_REACH + 1, RING_REACH / RING_SPEED, VIOLET);
			playSound(fight, "mob.warden.sonic_boom", origin, 1.5, 1.5);

			addHazard(fight, (age): boolean => {
				const outer = 1 + (age + 1) * RING_SPEED;
				const inner = outer - RING_SPEED - RING_BAND;

				for (const victim of victimsNear(fight, origin, outer + RING_BAND)) {
					if (struck.has(victim.id)) continue;
					const distance = flatDistance(victim.location, origin);
					if (distance < inner || distance > outer + RING_BAND) continue;
					struck.add(victim.id);
					if (Math.abs(victim.location.y - origin.y) > 2.5) continue;
					if (victim instanceof Player && !victim.isOnGround) {
						victim.onScreenDisplay.setActionBar("§aYou cleared the ring");
						continue;
					}
					hit(fight, victim, baseDamage(fight), EntityDamageCause.magic);
				}
				return outer < RING_REACH;
			});
		});
	}

	after(fight, RING_WINDUP + (RING_COUNT - 1) * RING_GAP + RING_REACH / RING_SPEED + 10, (): void => endAttack(fight));
}

function fireShard(fight: PolarisFight, from: Vector3, prey: Player): void {
	if (!prey.isValid) return;
	const trail = orbVars(0.55, 8, VIOLET);
	const aim = offset(prey.location, 0, 0.9, 0);
	const length = Math.hypot(aim.x - from.x, aim.y - from.y, aim.z - from.z) || 1;
	let position = from;
	let heading = { x: (aim.x - from.x) / length, y: (aim.y - from.y) / length, z: (aim.z - from.z) / length };

	playSound(fight, "mob.shulker.shoot", from, 1.5);
	drawBurst(fight, from, 1.4, WHITE);

	addHazard(fight, (age): boolean => {
		const chest = prey.isValid ? offset(prey.location, 0, 0.9, 0) : undefined;
		if (chest) {
			const gap = Math.hypot(chest.x - position.x, chest.y - position.y, chest.z - position.z) || 1;
			const steerX = heading.x + ((chest.x - position.x) / gap) * SHARD_TURN;
			const steerY = heading.y + ((chest.y - position.y) / gap) * SHARD_TURN;
			const steerZ = heading.z + ((chest.z - position.z) / gap) * SHARD_TURN;
			const steerLength = Math.hypot(steerX, steerY, steerZ) || 1;
			heading = { x: steerX / steerLength, y: steerY / steerLength, z: steerZ / steerLength };
		}

		const next = offset(position, heading.x * SHARD_SPEED, heading.y * SHARD_SPEED, heading.z * SHARD_SPEED);
		drawOrb(fight, next, trail);

		if (chest && distanceToSegment(chest, position, next) <= SHARD_HIT) {
			hit(fight, prey, SHARD_DAMAGE, EntityDamageCause.magic);
			drawBurst(fight, next, 1.6, VIOLET);
			return false;
		}

		position = next;
		if (age % 2 === 0) {
			if (!isLoadedLocation(fight.dimension, position)) return false;
			const block = fight.dimension.getBlock(position);
			if (block && !block.isAir && !block.isLiquid) {
				drawBurst(fight, position, 1.6, VIOLET);
				return false;
			}
		}
		return age < SHARD_LIFE;
	});
}

function interdimensionalBarrage(fight: PolarisFight): void {
	const boss = fight.boss;
	const { arena } = fight;
	const players = arenaPlayers(fight);
	if (players.length === 0) {
		endAttack(fight, 20);
		return;
	}

	const turn = Math.random() * Math.PI * 2;
	setPose(boss, "channel");
	playSound(fight, "block.end_portal.spawn", boss.location, 1.6, 0.6);
	announce(fight, "§dInterdimensional Barrage §7Keep circling, the shards turn slowly");

	for (let i = 0; i < SHARD_COUNT; i++) {
		const angle = turn + (i / SHARD_COUNT) * Math.PI * 2;
		const portal = {
			x: arena.x + Math.cos(angle) * PORTAL_RADIUS,
			y: arena.y + 5 + (i % 3) * 1.5,
			z: arena.z + Math.sin(angle) * PORTAL_RADIUS
		};
		const fireAt = BARRAGE_START + i * BARRAGE_GAP;

		after(fight, i * 3, (): void => {
			const prey = players[i % players.length];
			const lead = fireAt - i * 3;
			drawPortal(fight, portal, prey.isValid ? offset(prey.location, 0, 0.9, 0) : arena, PORTAL_SIZE, lead + PORTAL_LINGER, VIOLET);
			drawOrb(fight, portal, orbVars(0.7, lead + 6, VIOLET));
			playSound(fight, "mob.endermen.portal", portal, 1.8, 0.5);
		});
		after(fight, fireAt, (): void => fireShard(fight, portal, players[i % players.length]));
	}

	after(fight, BARRAGE_START + SHARD_COUNT * BARRAGE_GAP + 30, (): void => endAttack(fight));
}

function drawSquare(fight: PolarisFight, half: number, width: number, lifeTicks: number, alpha: number): void {
	const { arena } = fight;
	const color = faded(alpha >= 1 ? WHITE : VIOLET, alpha);
	const reach = half + width / 2;
	const sides: [number, number, number, number][] = [
		[-reach, -half, reach, -half],
		[-reach, half, reach, half],
		[-half, -reach, -half, reach],
		[half, -reach, half, reach]
	];
	for (const [fromX, fromZ, toX, toZ] of sides) {
		const from = { x: arena.x + fromX, y: arena.y + 0.12, z: arena.z + fromZ };
		const to = { x: arena.x + toX, y: arena.y + 0.12, z: arena.z + toZ };
		if (alpha < 1) drawLane(fight, from, to, width, lifeTicks, color);
		drawLine(fight, offset(from, 0, 0.9, 0), offset(to, 0, 0.9, 0), width, lifeTicks, color);
	}
}

function intergalacticalLaserRush(fight: PolarisFight): void {
	const boss = fight.boss;
	const { arena } = fight;
	const band = RUSH_STEP / 2;

	blinkTo(fight, boss, arenaStand(fight));
	setPose(boss, "channel");
	announce(fight, "§dIntergalactical Laser Rush §7Dash to the centre");

	let index = 0;
	for (let side = RUSH_FROM; side >= RUSH_TO; side -= RUSH_STEP) {
		const outer = side / 2;
		const inner = outer - band;
		const warnAt = index * RUSH_DELAY;
		index++;

		after(fight, warnAt, (): void => {
			drawSquare(fight, outer - band / 2, band, RUSH_WINDUP, 0.25);
			playSound(fight, "note.pling", arena, 0.5 + (RUSH_FROM - side) * 0.02, 0.5);
		});

		after(fight, warnAt + RUSH_WINDUP, (): void => {
			drawSquare(fight, outer - band / 2, band, 7, 1);
			playSound(fight, "custom_sfx.laser_shot", arena, 1.2, 0.6);
			for (const victim of arenaVictims(fight)) {
				const distance = Math.max(Math.abs(victim.location.x - arena.x), Math.abs(victim.location.z - arena.z));
				if (distance <= inner || distance > outer) continue;
				hit(fight, victim, baseDamage(fight), EntityDamageCause.magic);
			}
		});
	}

	after(fight, (index - 1) * RUSH_DELAY + RUSH_WINDUP + 20, (): void => endAttack(fight));
}

function photonOverdrive(fight: PolarisFight): void {
	const boss = fight.boss;
	const prey = fight.target;
	if (prey?.isValid) {
		const point = pointAround(fight, prey.location, 2.5, 4);
		if (point) blinkTo(fight, boss, point, prey.location);
	}

	for (let swing = 0; swing < SPIN_COUNT; swing++) {
		after(fight, 4 + swing * SPIN_GAP, (): void => {
			const feet = offset(boss.location, 0, 0.15, 0);
			boss.playAnimation("animation.polaris.spin");
			drawRing(fight, feet, SPIN_RADIUS, SPIN_RADIUS, SPIN_WINDUP + 2, faded(VIOLET, 0.6));
			playSound(fight, "beacon.power.select", feet, 2, 0.8);

			after(fight, SPIN_WINDUP, (): void => {
				const center = boss.location;
				drawRing(fight, offset(center, 0, 1.2, 0), 1, SPIN_RADIUS, 6, WHITE);
				drawBurst(fight, offset(center, 0, 1.5, 0), 5, WHITE);
				playSound(fight, "weapon_slash.slash_heavy", center, 1.3);

				for (const victim of victimsNear(fight, center, SPIN_RADIUS)) {
					if (Math.abs(victim.location.y - center.y) > 3) continue;
					hit(fight, victim, baseDamage(fight), EntityDamageCause.entityAttack);
				}
			});
		});
	}

	after(fight, 4 + (SPIN_COUNT - 1) * SPIN_GAP + SPIN_WINDUP + 16, (): void => endAttack(fight));
}

function voidMirrorClones(fight: PolarisFight): void {
	const boss = fight.boss;
	const clones: Entity[] = [];
	for (let i = 0; i < 2; i++) {
		const clone = spawnHelper(fight, CLONE_ID, boss.location);
		if (!clone) continue;
		clone.setProperty("ph:phase", 2);
		clones.push(clone);
	}

	playSound(fight, "mob.evocation_illager.prepare_summon", boss.location, 1.5);
	announce(fight, "§dVoid Mirror Clones §7Two of the three are holograms");

	for (let volley = 0; volley < MIRROR_VOLLEYS; volley++) {
		after(fight, volley * MIRROR_PERIOD, (): void => {
			const prey = fight.target;
			if (!prey?.isValid) return;

			const center = { ...prey.location };
			const turn = Math.random() * Math.PI * 2;
			const casters = [boss, ...clones.filter((clone): boolean => clone.isValid)];
			const first = Math.floor(Math.random() * casters.length);
			const beams: Beam[] = [];

			casters.forEach((caster, index): void => {
				const angle = turn + (((index + first) % casters.length) / 3) * Math.PI * 2;
				const x = center.x + Math.cos(angle) * MIRROR_RADIUS;
				const z = center.z + Math.sin(angle) * MIRROR_RADIUS;
				const spot = standPoint(fight, x, z, center.y) ?? { x, y: center.y, z };
				blinkTo(fight, caster, spot, center);
				caster.playAnimation("animation.polaris.cast");

				const direction = flatDirection(spot, center);
				const from = { x: spot.x, y: center.y + 1, z: spot.z };
				const to = offset(from, direction.x * MIRROR_RANGE, 0, direction.z * MIRROR_RANGE);
				beams.push({ from, to });
				drawLine(fight, from, to, 0.5, MIRROR_WARN + 2, faded(VIOLET, 0.6));
			});

			after(fight, MIRROR_WARN, (): void => {
				for (const beam of beams) drawLine(fight, beam.from, beam.to, MIRROR_WIDTH * 2, 7, WHITE);
				playSound(fight, "custom_sfx.laser_shot", center, 0.9);

				for (const victim of victimsNear(fight, center, MIRROR_RADIUS + MIRROR_RANGE)) {
					if (Math.abs(victim.location.y - center.y) > 3) continue;
					if (!beams.some((beam): boolean => flatDistanceToSegment(victim.location, beam.from, beam.to) <= MIRROR_WIDTH)) continue;
					hit(fight, victim, baseDamage(fight), EntityDamageCause.magic);
				}
			});
		});
	}

	after(fight, MIRROR_VOLLEYS * MIRROR_PERIOD + 10, (): void => {
		for (const clone of clones) {
			if (clone.isValid) drawBurst(fight, offset(clone.location, 0, 1.8, 0), 3, VIOLET);
			removeHelper(fight, clone);
		}
		endAttack(fight);
	});
}

function collapseWipe(fight: PolarisFight, nodes: Entity[]): void {
	const boss = fight.boss;
	const { arena } = fight;
	setPose(boss, "none");
	boss.playAnimation("animation.polaris.strike");

	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI;
		const reach = 46;
		drawLine(
			fight,
			{ x: arena.x - Math.cos(angle) * reach, y: arena.y + 1, z: arena.z - Math.sin(angle) * reach },
			{ x: arena.x + Math.cos(angle) * reach, y: arena.y + 1, z: arena.z + Math.sin(angle) * reach },
			6,
			10,
			WHITE
		);
	}
	drawRing(fight, offset(arena, 0, 0.2, 0), 2, 46, 12, VIOLET);
	drawBurst(fight, offset(arena, 0, 2, 0), 16, WHITE);
	playSound(fight, "custom_sfx.judgement_cut", arena, 1, 4);
	playSound(fight, "random.explode", arena, 0.5, 4);

	for (const player of arenaPlayers(fight)) {
		player.camera.fade({ fadeColor: { red: 0.9, green: 0.8, blue: 1 }, fadeTime: { fadeInTime: 0.05, holdTime: 0.15, fadeOutTime: 0.7 } });
	}
	for (const victim of arenaVictims(fight)) fatal(victim);
	for (const node of nodes) removeHelper(fight, node);
}

function thePhaseCollapse(fight: PolarisFight): void {
	const boss = fight.boss;
	const { arena } = fight;
	const core = offset(arena, 0, 2.5, 0);
	const turn = Math.random() * Math.PI * 2;
	const nodes: Entity[] = [];

	blinkTo(fight, boss, arenaStand(fight));

	for (let i = 0; i < COLLAPSE_NODES; i++) {
		const angle = turn + (i / COLLAPSE_NODES) * Math.PI * 2;
		const x = arena.x + Math.cos(angle) * COLLAPSE_NODE_RADIUS;
		const z = arena.z + Math.sin(angle) * COLLAPSE_NODE_RADIUS;
		const node = spawnHelper(fight, NODE_ID, standPoint(fight, x, z, arena.y) ?? { x, y: arena.y, z });
		if (node) nodes.push(node);
	}
	if (nodes.length === 0) {
		endAttack(fight);
		return;
	}

	setPose(boss, "charge");
	showTitle(fight, "§5The Phase Collapse", "§7Break the charger nodes");
	playSound(fight, "mob.wither.spawn", arena, 0.5, 2);
	drawSkyRift(fight, "open");

	addHazard(fight, (age): boolean => {
		if (age >= COLLAPSE_CHARGE) {
			drawSkyRift(fight, "close");
			collapseWipe(fight, nodes);
			after(fight, 40, (): void => endAttack(fight));
			return false;
		}
		if (age % 5 !== 0) return true;

		let left = 0;
		for (const node of nodes) {
			if (!node.isValid) continue;
			left++;
			if (age % 10 === 0) drawLine(fight, offset(node.location, 0, 0.6, 0), core, 0.35, 12, faded(VIOLET, 0.8));
		}

		if (left === 0) {
			for (const node of nodes) fight.helpers.delete(node.id);
			drawSkyRift(fight, "close");
			drawBurst(fight, core, 8, WHITE);
			playSound(fight, "random.glass", arena, 0.6, 2);
			announce(fight, "§aThe Phase Collapse was cancelled");
			setPose(boss, "stagger");
			after(fight, 200, (): void => endAttack(fight));
			return false;
		}
		if (age % SKY_RIFT_INTERVAL !== 0) return true;

		drawSkyRift(fight, "hold");
		const growth = age / COLLAPSE_CHARGE;
		const seconds = Math.ceil((COLLAPSE_CHARGE - age) / 20);
		drawOrb(fight, core, orbVars(2 + growth * 4, 24, VIOLET));
		drawRing(fight, offset(arena, 0, 0.2, 0), 30, 2, 20, faded(VIOLET, 0.5));

		for (const player of arenaPlayers(fight)) {
			player.addEffect("slowness", 30, { amplifier: STASIS_SLOWNESS, showParticles: false });
			player.onScreenDisplay.setActionBar(`§5The Phase Collapse §f${seconds}s §7Nodes left §f${left}`);
		}
		return true;
	});
}

export const PHASE_TWO_ATTACKS: Attack[] = [
	dimensionalBlinkSlash,
	eventHorizonRing,
	interdimensionalBarrage,
	intergalacticalLaserRush,
	photonOverdrive,
	voidMirrorClones,
	thePhaseCollapse
];

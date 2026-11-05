import {
    world,
    system,
    Dimension,
    Entity,
    EntityDamageCause,
    GameMode,
    MolangVariableMap,
    Player,
    type Vector3
} from "@minecraft/server";
import { isLoadedLocation } from "../../core/location";

const SENTINEL_ID = "ph:ancient_sentinel";
const STATE_PROP = "ph:sentinel_state";
const ROLL_YAW_PROP = "ph:roll_yaw";
const TAG_RAGED = "ph:sentinel_enraged";
const TAG_KNOCKED = "parried";

const WAKE_SCAN_RANGE = 14;
const COMBAT_RANGE = 30;
const BALL_TRIGGER_MIN = 4;
const BALL_TRIGGER_MAX = 26;
const ROLL_TRIGGER_MIN = 3;

const LAUNCH_VELOCITY = 1.2;
const RELAUNCH_VELOCITY = 0.9;
const ROLL_SPEED = 0.48;
const ROLL_MAX_TICKS = 110;
const ROLL_MAX_BOUNCES = 8;
const ROLL_CONTACT_RANGE = 2.3;
const CONTACT_REHIT_MS = 600;

const BALL_CD_NORMAL = 8000;
const BALL_CD_ENRAGED = 5000;
const ROLL_CD_NORMAL = 9500;
const ROLL_CD_ENRAGED = 6500;
const SPECIAL_GAP_MS = 5000;

const SLAM_BIG_RADIUS = 6;
const SLAM_BIG_DAMAGE = 16;
const SLAM_BIG_DAMAGE_ENRAGED = 22;
const SLAM_SMALL_RADIUS = 4;
const SLAM_SMALL_DAMAGE = 8;
const SLAM_SMALL_DAMAGE_ENRAGED = 12;
const ROLL_DAMAGE = 9;
const ROLL_DAMAGE_ENRAGED = 13;

const TELEGRAPH_INTERVAL = 8;
const CHARGE_TELEGRAPH_MARKS = 8;
const CHARGE_TELEGRAPH_SPACING = 1.5;

type FightState = "dormant" | "awakening" | "active" | "ball" | "roll" | "unrolling";

interface SentinelFight {
    state: FightState;
    thinkId?: number;
    lastSpecial: "ball" | "roll" | "";
    ballCd: number;
    rollCd: number;
    specialGapUntil: number;
    enraged: boolean;
    ballLoopId?: number;
    flightTicks?: number;
    hopsLeft?: number;

    groundY?: number;

    rollLoopId?: number;
    rollDir?: { readonly x: number; readonly z: number };
    rollTicks?: number;
    rollBounces?: number;
    ticksSinceBounce?: number;
    hitLocks?: Map<string, number>;
}

const fights = new Map<string, SentinelFight>();

function makeFight(): SentinelFight {
    return { state: "dormant", lastSpecial: "", ballCd: 0, rollCd: 0, specialGapUntil: 0, enraged: false };
}

function getFight(entity: Entity): SentinelFight {
    const existing = fights.get(entity.id);
    if (existing) return existing;
    const fight = makeFight();
    fights.set(entity.id, fight);
    return fight;
}

function announce(dimension: Dimension, location: { x: number; y: number; z: number }, message: string): void {
    for (const player of dimension.getPlayers({ location, maxDistance: 48 })) {
        if (!player.isValid) continue;
        player.onScreenDisplay.setActionBar(message);
    }
}

function horizontalDistance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function flatMagnitude(vector: { x: number; z: number }): number {
    return Math.sqrt(vector.x * vector.x + vector.z * vector.z) || 1;
}

function nearestPlayer(entity: Entity, maxDistance: number): Player | undefined {
    if (!entity.isValid) return undefined;
    const candidates = entity.dimension.getPlayers({
        location: entity.location,
        maxDistance,
        closest: 1,
        excludeGameModes: [GameMode.Creative, GameMode.Spectator]
    });
    return candidates.find((candidate) => candidate.isValid);
}

function isEligibleVictim(candidate: Entity, sentinel: Entity): boolean {
    if (!candidate.isValid) return false;
    if (candidate.id === sentinel.id) return false;
    if (candidate.hasTag(TAG_KNOCKED)) return false;

    const families = candidate.getComponent("minecraft:type_family")?.getTypeFamilies();
    if (families?.includes("sentinel")) return false;

    if (candidate.typeId === "minecraft:player") {
        const mode = (candidate as Player).getGameMode();
        if (mode === GameMode.Creative || mode === GameMode.Spectator) return false;
    }
    return true;
}

function blockBelow(entity: Entity): ReturnType<Dimension["getBlock"]> {
    const feet = entity.location;
    const location = { x: Math.floor(feet.x), y: Math.floor(feet.y - 0.06), z: Math.floor(feet.z) };
    if (!isLoadedLocation(entity.dimension, location)) return undefined;
    return entity.dimension.getBlock(location);
}

function isAerialPlayer(player: Player): boolean {
    if (!player.isValid) return false;
    if (player.getVelocity().y > 0.03) return true;
    const below = blockBelow(player);
    return !below || below.isAir || below.isLiquid;
}

function isStandingOnGround(entity: Entity): boolean {
    if (!entity.isValid) return false;
    const below = blockBelow(entity);
    return !!below && !below.isAir && !below.isLiquid;
}

function spawnFx(entity: Entity, particle: string, location: Vector3, radius?: number, delay?: number): void {
    if (!entity.isValid) return;
    if (!isLoadedLocation(entity.dimension, location)) return;
    const vars = new MolangVariableMap();
    if (radius !== undefined) vars.setFloat("variable.radius", radius);
    if (delay !== undefined) vars.setFloat("variable.delay", delay);
    entity.dimension.spawnParticle(particle, location, vars);
}

function playAt(entity: Entity, sound: string, options?: { pitch?: number; volume?: number }): void {
    if (!entity.isValid) return;
    if (!isLoadedLocation(entity.dimension, entity.location)) return;
    entity.dimension.playSound(sound, entity.location, options);
}

function slamRadius(fight: SentinelFight, big: boolean): number {
    if (!big) return SLAM_SMALL_RADIUS;
    return fight.enraged ? SLAM_BIG_RADIUS + 1 : SLAM_BIG_RADIUS;
}

function slamTelegraph(entity: Entity, fight: SentinelFight): void {
    const radius = slamRadius(fight, (fight.hopsLeft ?? 1) <= 1);
    const spot = { x: entity.location.x, y: fight.groundY ?? entity.location.y, z: entity.location.z };
    spawnFx(entity, "ph:sentinel_slam_telegraph", spot, radius);
    spawnFx(entity, "ph:sentinel_slam_telegraph_pulse", spot, radius);
    spawnFx(entity, "ph:sentinel_slam_telegraph_edge", spot, radius);
}

function chargeTelegraph(entity: Entity, dir: { x: number; z: number }): void {
    const origin = entity.location;
    for (let i = 1; i <= CHARGE_TELEGRAPH_MARKS; i++) {
        const step = i * CHARGE_TELEGRAPH_SPACING;
        spawnFx(
            entity,
            "ph:sentinel_charge_telegraph",
            { x: origin.x + dir.x * step, y: origin.y, z: origin.z + dir.z * step },
            undefined,
            i * 0.035
        );
    }
}

function readSentinelState(entity: Entity): FightState {
    if (!entity.isValid) return "dormant";
    const state = String(entity.getProperty(STATE_PROP));
    switch (state) {
        case "dormant":
        case "awakening":
        case "active":
        case "ball":
        case "roll":
        case "unrolling":
            return state;
    }
    return "dormant";
}

function setSentinelState(entity: Entity, state: FightState): void {
    if (!entity.isValid) return;
    entity.setProperty(STATE_PROP, state);
}

function faceRollDirection(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir;
    if (!dir) return;
    if (!entity.isValid) return;
    const yaw = Math.atan2(-dir.x, dir.z) * (180 / Math.PI);
    entity.setRotation({ x: 0, y: yaw });
    entity.setProperty(ROLL_YAW_PROP, yaw);
}

function think(entity: Entity, fight: SentinelFight): void {
    if (!entity.isValid) {
        dropFight(entity);
        return;
    }

    switch (fight.state) {
        case "dormant": {
            const stalker = nearestPlayer(entity, WAKE_SCAN_RANGE);
            if (stalker) beginAwaken(entity, fight);
            return;
        }
        case "active":
            combatCycle(entity, fight);
            return;
        default:
            return;
    }
}

function combatCycle(entity: Entity, fight: SentinelFight): void {
    const target = nearestPlayer(entity, COMBAT_RANGE);
    if (!target) return;

    const distance = horizontalDistance(entity.location, target.location);
    const now = Date.now();
    if (now < fight.specialGapUntil) return;

    const ballReady = now >= fight.ballCd && distance >= BALL_TRIGGER_MIN && distance <= BALL_TRIGGER_MAX;
    const rollReady = now >= fight.rollCd && distance >= ROLL_TRIGGER_MIN;

    if (!ballReady && !rollReady) return;

    const pick: "ball" | "roll" = ballReady && rollReady
        ? (fight.lastSpecial === "ball" ? "roll" : "ball")
        : (ballReady ? "ball" : "roll");
    fight.lastSpecial = pick;

    if (pick === "ball") {
        startBall(entity, fight);
    } else {
        startRoll(entity, fight, target);
    }
}

function beginAwaken(entity: Entity, fight: SentinelFight): void {
    if (fight.state !== "dormant" || !entity.isValid) return;
    fight.state = "awakening";

    entity.triggerEvent("ph:awaken");
    setSentinelState(entity, "awakening");

    spawnFx(entity, "minecraft:knockback_roar_particle", {
        x: entity.location.x, y: entity.location.y + 0.9, z: entity.location.z
    });
    playAt(entity, "beacon.deactivate", { pitch: 0.5, volume: 1 });
    playAt(entity, "mob.armadillo.ambient", { pitch: 0.6, volume: 1 });

    system.runTimeout(() => finishAwaken(entity, fight), 52);
}

function finishAwaken(entity: Entity, fight: SentinelFight): void {
    if (!entity.isValid) {
        dropFight(entity);
        return;
    }
    const health = entity.getComponent("minecraft:health");
    if (fight.state !== "awakening" || !health || health.currentValue <= 0) return;

    fight.state = "active";
    entity.triggerEvent("ph:wake_up");
    setSentinelState(entity, "active");
    entity.playAnimation("animation.ph.sentinel.roar");

    spawnFx(entity, "minecraft:knockback_roar_particle", {
        x: entity.location.x, y: entity.location.y + 1, z: entity.location.z
    });

    playAt(entity, "mob.ravager.roar", { pitch: 0.85, volume: 1 });
    playAt(entity, "mob.armadillo.unroll_finish", { pitch: 0.7, volume: 1 });

    const now = Date.now();
    fight.ballCd = now + 4000;
    fight.rollCd = now + 8000;

    announce(entity.dimension, entity.location, "§4[BOSS] The Ancient Sentinel has awakened after a thousand years!");
    system.runTimeout(() => {
        if (!entity.isValid) return;
        announce(
            entity.dimension,
            entity.location,
            "§7Tip: JUMP when the Sentinel slams down - HIT the rolling ball to bat its charge away."
        );
    }, 60);
}

function startBall(entity: Entity, fight: SentinelFight): void {
    if (!entity.isValid) return;
    fight.state = "ball";
    fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);

    entity.triggerEvent("ph:start_ball");
    setSentinelState(entity, "ball");

    const now = Date.now();
    fight.ballCd = now + (fight.enraged ? BALL_CD_ENRAGED : BALL_CD_NORMAL);
    fight.hopsLeft = fight.enraged ? 2 : 1;
    fight.groundY = entity.location.y;

    slamTelegraph(entity, fight);
    system.runTimeout(() => {
        if (entity.isValid && fight.state === "ball") slamTelegraph(entity, fight);
    }, TELEGRAPH_INTERVAL);

    playAt(entity, "mob.armadillo.roll", { pitch: 1.1, volume: 1 });

    system.runTimeout(() => {
        if (!entity.isValid || fight.state !== "ball") return;
        fight.flightTicks = 0;
        entity.applyImpulse({ x: 0, y: LAUNCH_VELOCITY, z: 0 });
        entity.playAnimation("animation.ph.sentinel.launch");
        fight.ballLoopId = system.runInterval(() => ballTick(entity, fight), 1);
    }, 12);
}

function ballTick(entity: Entity, fight: SentinelFight): void {
    if (!entity.isValid) {
        if (fight.ballLoopId !== undefined) system.clearRun(fight.ballLoopId);
        fight.ballLoopId = undefined;
        dropFight(entity);
        return;
    }

    fight.flightTicks = (fight.flightTicks ?? 0) + 1;
    if (fight.flightTicks % TELEGRAPH_INTERVAL === 0) slamTelegraph(entity, fight);

    const velocity = entity.getVelocity();
    const grounded = Math.abs(velocity.y) < 0.03 && isStandingOnGround(entity);

    if (!grounded && fight.flightTicks < 130) return;

    if (fight.ballLoopId !== undefined) {
        system.clearRun(fight.ballLoopId);
        fight.ballLoopId = undefined;
    }

    fight.hopsLeft = (fight.hopsLeft ?? 0) - 1;

    if (fight.hopsLeft > 0) {
        shockwave(entity, fight, false);
        fight.flightTicks = 0;
        if (entity.isValid) {
            entity.applyImpulse({ x: 0, y: RELAUNCH_VELOCITY, z: 0 });
            entity.playAnimation("animation.ph.sentinel.launch");
        }
        fight.ballLoopId = system.runInterval(() => ballTick(entity, fight), 1);
        return;
    }

    if (entity.isValid) entity.playAnimation("animation.ph.sentinel.slam");
    shockwave(entity, fight, true);

    system.runTimeout(() => {
        if (!entity.isValid || fight.state !== "ball") return;
        resumeCombat(entity, fight, true);
    }, 8);
}

function shockwave(entity: Entity, fight: SentinelFight, big: boolean): void {
    if (!entity.isValid) return;
    const center = { x: entity.location.x, y: entity.location.y + 0.4, z: entity.location.z };
    const radius = slamRadius(fight, big);
    const damage = big
        ? (fight.enraged ? SLAM_BIG_DAMAGE_ENRAGED : SLAM_BIG_DAMAGE)
        : (fight.enraged ? SLAM_SMALL_DAMAGE_ENRAGED : SLAM_SMALL_DAMAGE);

    if (!isLoadedLocation(entity.dimension, center)) return;

    entity.dimension.playSound("random.explode", center, { pitch: big ? 0.9 : 1.1, volume: 1 });
    entity.dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
    entity.dimension.spawnParticle("minecraft:knockback_roar_particle", center);
    if (big) {
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            spawnFx(entity, "minecraft:basic_smoke_particle", {
                x: center.x + Math.cos(angle) * 2.4,
                y: center.y + 0.2,
                z: center.z + Math.sin(angle) * 2.4
            });
        }
    }
    const ground = entity.location;
    spawnFx(entity, "ph:sentinel_impact_ring", ground, radius);
    spawnFx(entity, "ph:sentinel_impact_dust", ground, radius);
    spawnFx(entity, "ph:sentinel_impact_debris", ground, radius);

    const victims = entity.dimension.getEntities({ location: center, maxDistance: radius });

    for (const victim of victims) {
        if (!isEligibleVictim(victim, entity)) continue;

        if (victim.typeId === "minecraft:player" && isAerialPlayer(victim as Player)) {
            (victim as Player).onScreenDisplay.setActionBar("§aDODGED! You jumped over the shockwave!");
            continue;
        }

        if (!entity.isValid) return;
        victim.applyDamage(damage, {
            cause: EntityDamageCause.entityAttack,
            damagingEntity: entity
        });

        if (!victim.isValid) continue;
        const flatAway = flatMagnitude({ x: victim.location.x - center.x, z: victim.location.z - center.z }) || 1;
        const awayX = (victim.location.x - center.x) / flatAway;
        const awayZ = (victim.location.z - center.z) / flatAway;
        victim.applyKnockback({ x: awayX * 1.9, z: awayZ * 1.9 }, 0.6);
    }

    if (!entity.isValid) return;
    for (const player of entity.dimension.getPlayers({ location: center, maxDistance: 16 })) {
        if (!player.isValid) continue;
        player.runCommand("camerashake add @s 0.4 0.6 positional");
    }
}

function startRoll(entity: Entity, fight: SentinelFight, target: Player): void {
    if (!entity.isValid || !target.isValid) return;
    fight.state = "roll";
    fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);

    entity.triggerEvent("ph:start_roll");
    setSentinelState(entity, "roll");

    const now = Date.now();
    fight.rollCd = now + (fight.enraged ? ROLL_CD_ENRAGED : ROLL_CD_NORMAL);

    const flat = flatMagnitude({ x: target.location.x - entity.location.x, z: target.location.z - entity.location.z });
    fight.rollDir = {
        x: (target.location.x - entity.location.x) / flat,
        z: (target.location.z - entity.location.z) / flat
    };
    fight.rollTicks = 0;
    fight.rollBounces = 0;
    fight.ticksSinceBounce = 0;
    fight.hitLocks = new Map();

    faceRollDirection(entity, fight);
    chargeTelegraph(entity, fight.rollDir);
    playAt(entity, "mob.armadillo.roll", { pitch: 0.8, volume: 1 });

    system.runTimeout(() => {
        if (!entity.isValid || fight.state !== "roll") return;
        fight.rollLoopId = system.runInterval(() => rollTick(entity, fight), 1);
    }, 9);
}

function rollTick(entity: Entity, fight: SentinelFight): void {
    if (!entity.isValid || !fight.rollDir) {
        if (fight.rollLoopId !== undefined) {
            system.clearRun(fight.rollLoopId);
            fight.rollLoopId = undefined;
        }
        if (!entity.isValid) dropFight(entity);
        return;
    }

    fight.rollTicks = (fight.rollTicks ?? 0) + 1;
    fight.ticksSinceBounce = (fight.ticksSinceBounce ?? 0) + 1;

    rollStep(entity, fight);

    if ((fight.ticksSinceBounce ?? 0) >= 6) rollWallCheck(entity, fight);

    if ((fight.rollTicks ?? 0) % 2 === 0) {
        rollTrail(entity, fight);
        rollContactDamage(entity, fight);
    }

    if ((fight.rollTicks ?? 0) >= ROLL_MAX_TICKS || (fight.rollBounces ?? 0) >= ROLL_MAX_BOUNCES) {
        if (fight.rollLoopId !== undefined) {
            system.clearRun(fight.rollLoopId);
            fight.rollLoopId = undefined;
        }
        resumeCombat(entity, fight, true);
    }
}

function rollStep(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir;
    if (!dir || !entity.isValid) return;
    const velocity = entity.getVelocity();
    const driftX = dir.x * ROLL_SPEED - velocity.x;
    const driftZ = dir.z * ROLL_SPEED - velocity.z;
    if (Math.abs(driftX) > 0.02 || Math.abs(driftZ) > 0.02) {
        entity.applyImpulse({ x: driftX, y: 0, z: driftZ });
    }
}

function rollWallCheck(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir;
    if (!dir || !entity.isValid) return;
    const origin = entity.location;

    for (const height of [0.45, 1.15]) {
        const rayStart = { x: origin.x + dir.x * 1.0, y: origin.y + height, z: origin.z + dir.z * 1.0 };
        if (!isLoadedLocation(entity.dimension, rayStart)) return;
        const hit = entity.dimension.getBlockFromRay(
            rayStart,
            { x: dir.x, y: 0, z: dir.z },
            { includeLiquidBlocks: false, includePassableBlocks: false, maxDistance: 1.4 }
        );
        if (!hit) continue;

        fight.rollDir = { x: -dir.x, z: -dir.z };
        fight.ticksSinceBounce = 0;
        fight.rollBounces = (fight.rollBounces ?? 0) + 1;
        faceRollDirection(entity, fight);

        entity.playAnimation("animation.ph.sentinel.slam");
        playAt(entity, "mob.armadillo.land", { pitch: 0.8, volume: 1 });
        spawnFx(entity, "minecraft:basic_smoke_particle", {
            x: origin.x + dir.x * 1.2,
            y: origin.y + 0.8,
            z: origin.z + dir.z * 1.2
        });
        return;
    }
}

function rollTrail(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir;
    if (!dir || !entity.isValid) return;
    spawnFx(entity, "minecraft:basic_smoke_particle", {
        x: entity.location.x - dir.x * 0.9,
        y: entity.location.y + 0.6,
        z: entity.location.z - dir.z * 0.9
    });
}

function rollContactDamage(entity: Entity, fight: SentinelFight): void {
    const locks = fight.hitLocks ?? (fight.hitLocks = new Map<string, number>());
    const now = Date.now();
    const damage = fight.enraged ? ROLL_DAMAGE_ENRAGED : ROLL_DAMAGE;
    const dir = fight.rollDir;
    if (!dir || !entity.isValid) return;

    const victims = entity.dimension.getEntities({
        location: entity.location,
        maxDistance: ROLL_CONTACT_RANGE
    });

    for (const victim of victims) {
        if (!isEligibleVictim(victim, entity)) continue;
        if (Math.abs(victim.location.y - entity.location.y) > 2.2) continue;

        const lockUntil = locks.get(victim.id);
        if (lockUntil !== undefined && now < lockUntil) continue;
        locks.set(victim.id, now + CONTACT_REHIT_MS);

        if (!entity.isValid) return;
        victim.applyDamage(damage, {
            cause: EntityDamageCause.entityAttack,
            damagingEntity: entity
        });

        if (!victim.isValid) continue;
        victim.applyKnockback({ x: dir.x * 1.6, z: dir.z * 1.6 }, 0.35);
    }
}

function resumeCombat(entity: Entity, fight: SentinelFight, withUnroll: boolean): void {
    if (fight.ballLoopId !== undefined) {
        system.clearRun(fight.ballLoopId);
        fight.ballLoopId = undefined;
    }
    if (fight.rollLoopId !== undefined) {
        system.clearRun(fight.rollLoopId);
        fight.rollLoopId = undefined;
    }

    if (!entity.isValid || !withUnroll) {
        fight.state = "active";
        fight.specialGapUntil = Date.now() + SPECIAL_GAP_MS;
        return;
    }

    fight.state = "unrolling";
    entity.triggerEvent("ph:resume_combat");
    setSentinelState(entity, "unrolling");

    system.runTimeout(() => {
        if (!entity.isValid) {
            dropFight(entity);
            return;
        }
        const health = entity.getComponent("minecraft:health");
        if (fight.state !== "unrolling" || !health || health.currentValue <= 0) return;

        fight.state = "active";
        fight.specialGapUntil = Date.now() + SPECIAL_GAP_MS;
        entity.triggerEvent("ph:end_unroll");
        setSentinelState(entity, "active");
    }, 15);
}

function dropFight(entity: Entity): void {
    const fight = fights.get(entity.id);
    if (fight?.thinkId !== undefined) system.clearRun(fight.thinkId);
    fights.delete(entity.id);
}

export function onSentinelSpawn(entity: Entity): void {
    if (!entity || entity.typeId !== SENTINEL_ID) return;
    if (!entity.isValid) return;

    const fight = getFight(entity);
    if (fight.thinkId === undefined) {
        fight.state = readSentinelState(entity);
        if (fight.state === "ball" || fight.state === "roll" || fight.state === "unrolling") {
            resumeCombat(entity, fight, true);
        } else if (fight.state === "awakening") {
            fight.state = "active";
            entity.triggerEvent("ph:wake_up");
            setSentinelState(entity, "active");
        }

        fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);
        fight.thinkId = system.runInterval(() => think(entity, fight), 4);
    }
}

export function onSentinelHurt(event: {
    hurtEntity: Entity;
    damageSource: { damagingEntity?: Entity };
    damage: number;
}): void {
    const sentinel = event.hurtEntity;
    if (!sentinel || sentinel.typeId !== SENTINEL_ID || !sentinel.isValid) return;

    const fight = getFight(sentinel);

    const health = sentinel.getComponent("minecraft:health");
    if (health && health.effectiveMax > 0 && !fight.enraged && health.currentValue <= health.effectiveMax / 2) {
        fight.enraged = true;
        sentinel.addTag(TAG_RAGED);
        sentinel.triggerEvent("ph:rage");
        sentinel.playAnimation("animation.ph.sentinel.roar");
        playAt(sentinel, "mob.ravager.roar", { pitch: 0.8, volume: 1 });
    }

    if (fight.state === "dormant") {
        beginAwaken(sentinel, fight);
        return;
    }

    if (!sentinel.isValid) return;
    if (fight.state === "roll" && event.damageSource?.damagingEntity?.typeId === "minecraft:player" && fight.rollDir) {
        const attacker = event.damageSource.damagingEntity;
        if (!attacker.isValid) return;
        const flat = flatMagnitude({ x: sentinel.location.x - attacker.location.x, z: sentinel.location.z - attacker.location.z });
        fight.rollDir = {
            x: (sentinel.location.x - attacker.location.x) / flat,
            z: (sentinel.location.z - attacker.location.z) / flat
        };
        fight.ticksSinceBounce = 3;
        faceRollDirection(sentinel, fight);

        spawnFx(sentinel, "ph:parry_success", {
            x: sentinel.location.x,
            y: sentinel.location.y + 1.1,
            z: sentinel.location.z
        });
        playAt(sentinel, "mob.armadillo.land", { pitch: 1.4, volume: 0.7 });
    }
}

export function onSentinelHit(damagingEntity?: Entity, hitEntity?: Entity): void {
    if (!hitEntity || hitEntity.typeId !== SENTINEL_ID || !hitEntity.isValid) return;
    if (!damagingEntity?.isValid) return;

    const fight = getFight(hitEntity);

    if (fight.state === "dormant") beginAwaken(hitEntity, fight);
}

export function onSentinelDie(entity: Entity): void {
    dropFight(entity);
}

const SWEEP_DIMENSION_IDS = ["overworld", "nether", "the_end"];

export function sweepSentinels(): void {
    for (const dimensionId of SWEEP_DIMENSION_IDS) {
        const tracked = world.getDimension(dimensionId).getEntities({ type: SENTINEL_ID });

        for (const entity of tracked) {
            if (!entity.isValid) continue;
            if (fights.has(entity.id)) continue;
            onSentinelSpawn(entity);
        }
    }
}

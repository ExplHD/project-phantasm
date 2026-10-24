import {
    world,
    system,
    Dimension,
    Entity,
    EntityDamageCause,
    GameMode,
    Player
} from "@minecraft/server";

// ======================================== Ancient Sentinel (giant armadillo boss) ========================================
// A giant armadillo that slept for a thousand years. Any damage or a nearby player stirs
// it awake and it goes berserk. Attack set:
//   - Skyfall Slam: curls into a ball, bounces skyward and slams down. Area damage on every
//     landing; players who are JUMPING at the moment of impact dodge it.
//   - Mirror Charge (sulfur-cube style): locks into one forward direction and rolls. Hit a wall
//     and it bounces straight back, still travelling in the bounce direction. A player HIT
//     bats the ball away in the direction of the blow, steering the charge.
//   - Base melee: closes distance and bites (vanilla melee_box_attack).
// At half health it enrages: faster, harder hits and a double Skyfall.

const SENTINEL_ID = "ph:ancient_sentinel";
const STATE_PROP = "ph:sentinel_state";
const TAG_RAGED = "ph:sentinel_enraged";
const TAG_KNOCKED = "parried"; // shared project tag: scripted attacks respect parry state

const WAKE_SCAN_RANGE = 14;    // blocks (dormant proximity wake)
const COMBAT_RANGE = 30;       // blocks (attacks start / aggro leash)
const BALL_TRIGGER_MIN = 4;    // never slam on top of a player standing on its feet
const BALL_TRIGGER_MAX = 26;
const ROLL_TRIGGER_MIN = 3;

const LAUNCH_VELOCITY = 1.2;   // blocks/tick upward on the big hop (~9 block jump)
const RELAUNCH_VELOCITY = 0.9; // second hop when enraged
const ROLL_SPEED = 0.48;       // blocks/tick sustained roll speed
const ROLL_MAX_TICKS = 110;    // 5.5 s
const ROLL_MAX_BOUNCES = 8;
const ROLL_CONTACT_RANGE = 2.3;
const CONTACT_REHIT_MS = 600;

const BALL_CD_NORMAL = 8000;
const BALL_CD_ENRAGED = 5000;
const ROLL_CD_NORMAL = 9500;
const ROLL_CD_ENRAGED = 6500;

const SLAM_BIG_RADIUS = 6;
const SLAM_BIG_DAMAGE = 16;
const SLAM_BIG_DAMAGE_ENRAGED = 22;
const SLAM_SMALL_RADIUS = 4;
const SLAM_SMALL_DAMAGE = 8;
const SLAM_SMALL_DAMAGE_ENRAGED = 12;
const ROLL_DAMAGE = 9;
const ROLL_DAMAGE_ENRAGED = 13;

type FightState = "dormant" | "awakening" | "active" | "ball" | "roll" | "unrolling";

/** Per-sentinel runtime brain. Cleared on death; rebuilt by the periodic re-scan. */
interface SentinelFight {
    state: FightState;
    thinkId?: number;
    /** Alternating special rotation so it does not spam the same attack twice. */
    lastSpecial: "ball" | "roll" | "";
    ballCd: number;
    rollCd: number;
    enraged: boolean;

    // Skyfall Slam machine
    ballLoopId?: number;
    flightTicks?: number;
    hopsLeft?: number;

    // Mirror Charge machine
    rollLoopId?: number;
    rollDir?: { x: number; z: number };
    rollTicks?: number;
    rollBounces?: number;
    ticksSinceBounce?: number;
    /** victim entity id -> epoch ms when their contact-damage re-hit lock expires */
    hitLocks?: Map<string, number>;
}

const fights = new Map<string, SentinelFight>();

function makeFight(): SentinelFight {
    return { state: "dormant", lastSpecial: "", ballCd: 0, rollCd: 0, enraged: false };
}

function getFight(entity: Entity): SentinelFight {
    let fight = fights.get(entity.id);
    if (!fight) {
        fight = makeFight();
        fights.set(entity.id, fight);
    }
    return fight;
}

// ======================================== small utilities ========================================

function announce(dimension: Dimension, location: { x: number; y: number; z: number }, message: string): void {
    try {
        for (const player of dimension.getPlayers({ location, maxDistance: 48 })) {
            player.onScreenDisplay.setActionBar(message);
        }
    } catch {
        // Dimension can be torn down mid-announcement; the fight continues without it.
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
    try {
        const candidates = entity.dimension.getPlayers({
            location: entity.location,
            maxDistance,
            closest: 1,
            excludeGameModes: [GameMode.Creative, GameMode.Spectator]
        });
        for (const candidate of candidates) {
            if (candidate.isValid) return candidate;
        }
    } catch {
        // Query failure means no target for this pass.
    }
    return undefined;
}

function isEligibleVictim(candidate: Entity, sentinel: Entity): boolean {
    if (!candidate.isValid) return false;
    if (candidate.id === sentinel.id) return false;
    if (candidate.hasTag(TAG_KNOCKED)) return false;

    const families = candidate.getComponent("minecraft:type_family")?.getTypeFamilies();
    if (families?.includes("sentinel")) return false;

    if (candidate.typeId === "minecraft:player") {
        try {
            const mode = (candidate as Player).getGameMode();
            if (mode === GameMode.Creative || mode === GameMode.Spectator) return false;
        } catch {
            // Unreadable gamemode defaults to eligible; hit effects on creative are no-ops anyway.
        }
    }
    return true;
}

/** True while a player is airborne - this is the counter window for the Skyfall Slam. */
function isAerialPlayer(player: Player): boolean {
    try {
        if (player.getVelocity().y > 0.03) return true;
        const feet = player.location;
        const below = player.dimension.getBlock({
            x: Math.floor(feet.x),
            y: Math.floor(feet.y - 0.06),
            z: Math.floor(feet.z)
        });
        return !below || below.isAir || below.isLiquid;
    } catch {
        return false;
    }
}

function isStandingOnGround(entity: Entity): boolean {
    try {
        const feet = entity.location;
        const below = entity.dimension.getBlock({
            x: Math.floor(feet.x),
            y: Math.floor(feet.y - 0.06),
            z: Math.floor(feet.z)
        });
        return !!below && !below.isAir && !below.isLiquid;
    } catch {
        return false;
    }
}

function playAt(entity: Entity, sound: string, options?: { pitch?: number; volume?: number }): void {
    try {
        entity.dimension.playSound(sound, entity.location, options);
    } catch {
        // Audio failure must never touch the state machine.
    }
}

function readSentinelState(entity: Entity): FightState {
    try {
        const accessor = entity as unknown as { getProperty?: (name: string) => unknown };
        const value = accessor.getProperty?.(STATE_PROP);
        const state = typeof value === "string" ? value : String(value);
        switch (state) {
            case "dormant":
            case "awakening":
            case "active":
            case "ball":
            case "roll":
            case "unrolling":
                return state;
        }
    } catch {
        // Fall through to the dormant default.
    }
    return "dormant";
}

function setSentinelState(entity: Entity, state: FightState): void {
    try {
        (entity as unknown as { setProperty: (name: string, value: string) => void }).setProperty(STATE_PROP, state);
    } catch {
        // Property failure still leaves the BP side tracking via component groups.
    }
}

function faceRollDirection(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir;
    if (!dir) return;
    try {
        const yaw = Math.atan2(-dir.x, dir.z) * (180 / Math.PI);
        (entity as unknown as { setRotation?: (rotation: { x: number; y: number }) => void })
            .setRotation?.({ x: 0, y: yaw });
    } catch {
        // Some entity contexts refuse rotation; the spin hides most of it anyway.
    }
}

// ======================================== think loop ========================================

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
            // awakening / ball / roll / unrolling are driven by their own loops.
            return;
    }
}

function combatCycle(entity: Entity, fight: SentinelFight): void {
    const target = nearestPlayer(entity, COMBAT_RANGE);
    if (!target) return;

    const distance = horizontalDistance(entity.location, target.location);
    const now = Date.now();

    const ballReady = now >= fight.ballCd && distance >= BALL_TRIGGER_MIN && distance <= BALL_TRIGGER_MAX;
    const rollReady = now >= fight.rollCd && distance >= ROLL_TRIGGER_MIN;

    if (!ballReady && !rollReady) return;

    let pick: "ball" | "roll" | undefined;
    if (ballReady && rollReady) {
        pick = fight.lastSpecial === "ball" ? "roll" : "ball";
    } else if (ballReady) {
        pick = "ball";
    } else {
        pick = "roll";
    }
    fight.lastSpecial = pick;

    if (pick === "ball") {
        startBall(entity, fight);
    } else {
        startRoll(entity, fight, target);
    }
}

// ======================================== awakening ========================================

function beginAwaken(entity: Entity, fight: SentinelFight): void {
    if (fight.state !== "dormant" || !entity.isValid) return;
    fight.state = "awakening";

    try {
        entity.triggerEvent("ph:awaken");
        setSentinelState(entity, "awakening");
    } catch (err) {
        console.warn(`[ph] sentinel awaken event failed: ${entity.id}: ${err}`);
        return;
    }

    try {
        entity.dimension.spawnParticle("minecraft:knockback_roar_particle", {
            x: entity.location.x, y: entity.location.y + 0.9, z: entity.location.z
        });
        playAt(entity, "beacon.deactivate", { pitch: 0.5, volume: 1 });
        playAt(entity, "mob.armadillo.ambient", { pitch: 0.6, volume: 1 });
    } catch {
        // Cosmetic only.
    }

    announce(entity.dimension, entity.location, "§cSomething ancient is stirring... the thousand-year sleeper is waking up!");
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
    try {
        entity.triggerEvent("ph:wake_up");
        setSentinelState(entity, "active");
        entity.playAnimation("animation.ph.sentinel.roar");
    } catch {
        // BP event failing here leaves the entity unrolled but fighting; acceptable degradation.
    }

    try {
        entity.dimension.spawnParticle("minecraft:knockback_roar_particle", {
            x: entity.location.x, y: entity.location.y + 1, z: entity.location.z
        });
    } catch {
        // Cosmetic only.
    }

    playAt(entity, "mob.ravager.roar", { pitch: 0.85, volume: 1 });
    playAt(entity, "mob.armadillo.unroll_finish", { pitch: 0.7, volume: 1 });

    const now = Date.now();
    fight.ballCd = now + 4000;
    fight.rollCd = now + 8000;

    announce(entity.dimension, entity.location, "§4[BOSS] The Ancient Sentinel has awakened after a thousand years!");
    system.runTimeout(() => {
        try {
            announce(
                entity.dimension,
                entity.location,
                "§7Tip: JUMP when the Sentinel slams down - HIT the rolling ball to bat its charge away."
            );
        } catch {
            // Cosmetic only.
        }
    }, 60);
}

// ======================================== attack 1: Skyfall Slam ========================================

function startBall(entity: Entity, fight: SentinelFight): void {
    fight.state = "ball";
    fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);

    try {
        entity.triggerEvent("ph:start_ball");
        setSentinelState(entity, "ball");
    } catch {
        fight.state = "active";
        return;
    }

    const now = Date.now();
    fight.ballCd = now + (fight.enraged ? BALL_CD_ENRAGED : BALL_CD_NORMAL);
    fight.hopsLeft = fight.enraged ? 2 : 1;

    playAt(entity, "mob.armadillo.roll", { pitch: 1.1, volume: 1 });
    announce(entity.dimension, entity.location, "§cThe Ancient Sentinel curls up and leaps skyward!");

    system.runTimeout(() => {
        if (!entity.isValid || fight.state !== "ball") return;
        fight.flightTicks = 0;
        try {
            entity.applyImpulse({ x: 0, y: LAUNCH_VELOCITY, z: 0 });
            entity.playAnimation("animation.ph.sentinel.launch");
        } catch {
            // Launcher failed; unroll back to combat instead of staying curled forever.
            resumeCombat(entity, fight, true);
            return;
        }
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

    const velocity = entity.getVelocity();
    const grounded = Math.abs(velocity.y) < 0.03 && isStandingOnGround(entity);

    // Safety valve: a hop that never comes down (ceiling pin, weird collision) still slams.
    if (!grounded && fight.flightTicks < 130) return;

    if (fight.ballLoopId !== undefined) {
        system.clearRun(fight.ballLoopId);
        fight.ballLoopId = undefined;
    }

    fight.hopsLeft = (fight.hopsLeft ?? 0) - 1;

    if (fight.hopsLeft > 0) {
        // Enraged second bounce: small shock first, then it hops again for the finisher.
        shockwave(entity, fight, false);
        fight.flightTicks = 0;
        try {
            entity.applyImpulse({ x: 0, y: RELAUNCH_VELOCITY, z: 0 });
            entity.playAnimation("animation.ph.sentinel.launch");
        } catch {
            // The next landing resolves the remaining hop anyway.
        }
        fight.ballLoopId = system.runInterval(() => ballTick(entity, fight), 1);
        return;
    }

    try {
        entity.playAnimation("animation.ph.sentinel.slam");
    } catch {
        // Cosmetic only.
    }
    shockwave(entity, fight, true);
    // Let the squash animation breathe briefly before unrolling back into combat.
    system.runTimeout(() => {
        if (!entity.isValid || fight.state !== "ball") return;
        resumeCombat(entity, fight, true);
    }, 8);
}

function shockwave(entity: Entity, fight: SentinelFight, big: boolean): void {
    const center = { x: entity.location.x, y: entity.location.y + 0.4, z: entity.location.z };
    const radius = big ? (fight.enraged ? SLAM_BIG_RADIUS + 1 : SLAM_BIG_RADIUS) : SLAM_SMALL_RADIUS;
    const damage = big
        ? (fight.enraged ? SLAM_BIG_DAMAGE_ENRAGED : SLAM_BIG_DAMAGE)
        : (fight.enraged ? SLAM_SMALL_DAMAGE_ENRAGED : SLAM_SMALL_DAMAGE);

    try {
        entity.dimension.playSound("random.explode", center, { pitch: big ? 0.9 : 1.1, volume: 1 });
        entity.dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
        entity.dimension.spawnParticle("minecraft:knockback_roar_particle", center);
        if (big) {
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                entity.dimension.spawnParticle("minecraft:basic_smoke_particle", {
                    x: center.x + Math.cos(angle) * 2.4,
                    y: center.y + 0.2,
                    z: center.z + Math.sin(angle) * 2.4
                });
            }
        }
    } catch {
        // Cosmetics can fail; the damage application below is the important part.
    }

    let victims: Entity[] = [];
    try {
        victims = entity.dimension.getEntities({ location: center, maxDistance: radius });
    } catch {
        return;
    }

    for (const victim of victims) {
        if (!isEligibleVictim(victim, entity)) continue;

        if (victim.typeId === "minecraft:player" && isAerialPlayer(victim as Player)) {
            // The counter: jumping players ride out the shockwave untouched.
            try {
                (victim as Player).onScreenDisplay.setActionBar("§aDODGED! You jumped over the shockwave!");
            } catch {
                // Cosmetic only.
            }
            continue;
        }

        try {
            victim.applyDamage(damage, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: entity
            });
        } catch {
            continue;
        }

        try {
            const flatAway = flatMagnitude({ x: victim.location.x - center.x, z: victim.location.z - center.z }) || 1;
            const awayX = (victim.location.x - center.x) / flatAway;
            const awayZ = (victim.location.z - center.z) / flatAway;
            victim.applyKnockback({ x: awayX * 1.9, z: awayZ * 1.9 }, 0.6);
        } catch {
            // Knockback failure does not undo the damage.
        }
    }

    // Camera feedback for anyone near the impact.
    try {
        for (const player of entity.dimension.getPlayers({ location: center, maxDistance: 16 })) {
            player.runCommand("camerashake add @s 0.4 0.6 positional");
        }
    } catch {
        // Cosmetic only.
    }
}

// ======================================== attack 2: Mirror Charge (sulfur cube bounce) ========================================

function startRoll(entity: Entity, fight: SentinelFight, target: Player): void {
    fight.state = "roll";
    fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);

    try {
        entity.triggerEvent("ph:start_roll");
        setSentinelState(entity, "roll");
    } catch {
        fight.state = "active";
        return;
    }

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
    playAt(entity, "mob.armadillo.roll", { pitch: 0.8, volume: 1 });
    announce(entity.dimension, entity.location, "§cThe Ancient Sentinel locks into a barrage charge!");

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

/** Exact sulfur-cube step: the ball only ever moves along its locked direction. */
function rollStep(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir!;
    try {
        const velocity = entity.getVelocity();
        const driftX = dir.x * ROLL_SPEED - velocity.x;
        const driftZ = dir.z * ROLL_SPEED - velocity.z;
        if (Math.abs(driftX) > 0.02 || Math.abs(driftZ) > 0.02) {
            entity.applyImpulse({ x: driftX, y: 0, z: driftZ });
        }
    } catch {
        // Velocity read failure just means gravity handles the fall this tick.
    }
}

function rollWallCheck(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir!;
    const origin = entity.location;

    for (const height of [0.45, 1.15]) {
        try {
            const hit = entity.dimension.getBlockFromRay(
                { x: origin.x + dir.x * 1.0, y: origin.y + height, z: origin.z + dir.z * 1.0 },
                { x: dir.x, y: 0, z: dir.z },
                { includeLiquidBlocks: false, includePassableBlocks: false, maxDistance: 1.4 }
            );
            if (!hit) continue;

            // Bounce: dead opposite direction, and the ball keeps travelling that way.
            fight.rollDir = { x: -dir.x, z: -dir.z };
            fight.ticksSinceBounce = 0;
            fight.rollBounces = (fight.rollBounces ?? 0) + 1;
            faceRollDirection(entity, fight);

            try {
                entity.playAnimation("animation.ph.sentinel.slam");
            } catch {
                // Cosmetic only.
            }
            playAt(entity, "mob.armadillo.land", { pitch: 0.8, volume: 1 });
            try {
                entity.dimension.spawnParticle("minecraft:basic_smoke_particle", {
                    x: origin.x + dir.x * 1.2,
                    y: origin.y + 0.8,
                    z: origin.z + dir.z * 1.2
                });
            } catch {
                // Cosmetic only.
            }
            return;
        } catch {
            // Ray failure skips the rest of this probe; the next tick's check catches the wall.
            return;
        }
    }
}

function rollTrail(entity: Entity, fight: SentinelFight): void {
    const dir = fight.rollDir!;
    try {
        entity.dimension.spawnParticle("minecraft:basic_smoke_particle", {
            x: entity.location.x - dir.x * 0.9,
            y: entity.location.y + 0.6,
            z: entity.location.z - dir.z * 0.9
        });
    } catch {
        // Cosmetic only.
    }
}

function rollContactDamage(entity: Entity, fight: SentinelFight): void {
    const locks = fight.hitLocks ?? (fight.hitLocks = new Map<string, number>());
    const now = Date.now();
    const damage = fight.enraged ? ROLL_DAMAGE_ENRAGED : ROLL_DAMAGE;
    const dir = fight.rollDir!;

    let victims: Entity[] = [];
    try {
        victims = entity.dimension.getEntities({
            location: entity.location,
            maxDistance: ROLL_CONTACT_RANGE
        });
    } catch {
        return;
    }

    for (const victim of victims) {
        if (!isEligibleVictim(victim, entity)) continue;
        if (Math.abs(victim.location.y - entity.location.y) > 2.2) continue;

        const lockUntil = locks.get(victim.id);
        if (lockUntil !== undefined && now < lockUntil) continue;
        locks.set(victim.id, now + CONTACT_REHIT_MS);

        try {
            victim.applyDamage(damage, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: entity
            });
        } catch {
            continue;
        }

        try {
            victim.applyKnockback({ x: dir.x * 1.6, z: dir.z * 1.6 }, 0.35);
        } catch {
            // Knockback failure does not undo the damage.
        }
    }
}

// ======================================== resume / cleanup ========================================

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
        return;
    }

    fight.state = "unrolling";
    try {
        entity.triggerEvent("ph:resume_combat");
        setSentinelState(entity, "unrolling");
    } catch {
        fight.state = "active";
        return;
    }

    system.runTimeout(() => {
        if (!entity.isValid) {
            dropFight(entity);
            return;
        }
        const health = entity.getComponent("minecraft:health");
        if (fight.state !== "unrolling" || !health || health.currentValue <= 0) return;

        fight.state = "active";
        try {
            entity.triggerEvent("ph:end_unroll");
            setSentinelState(entity, "active");
        } catch {
            // Degraded but still fighting.
        }
    }, 15);
}

function dropFight(entity: Entity): void {
    const fight = fights.get(entity.id);
    if (fight?.thinkId !== undefined) system.clearRun(fight.thinkId);
    fights.delete(entity.id);
}

// ======================================== event hooks (wired in events/index.ts) ========================================

export function onSentinelSpawn(entity: Entity): void {
    if (!entity || entity.typeId !== SENTINEL_ID) return;
    if (!entity.isValid) return;

    const fight = getFight(entity);
    if (fight.thinkId === undefined) {
        // Re-tracked entities (world reload) may be stuck in a scripted state with no brain.
        fight.state = readSentinelState(entity);
        if (fight.state === "ball" || fight.state === "roll" || fight.state === "unrolling") {
            resumeCombat(entity, fight, true); // recover into combat so the boss never soft-locks
        } else if (fight.state === "awakening") {
            // Shorten a torn-through wake into a straight combat resume.
            fight.state = "active";
            try {
                entity.triggerEvent("ph:wake_up");
                setSentinelState(entity, "active");
            } catch {
                // BP event failing here is degraded but still fighting.
            }
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

    // Enrage at half health.
    const health = sentinel.getComponent("minecraft:health");
    if (health && health.effectiveMax > 0 && !fight.enraged && health.currentValue <= health.effectiveMax / 2) {
        fight.enraged = true;
        try {
            sentinel.addTag(TAG_RAGED);
            sentinel.triggerEvent("ph:rage");
            sentinel.playAnimation("animation.ph.sentinel.roar");
        } catch {
            // Best effort; the enrage flags below still flip.
        }
        playAt(sentinel, "mob.ravager.roar", { pitch: 0.8, volume: 1 });
        announce(sentinel.dimension, sentinel.location, "§4The Ancient Sentinel goes berserk!");
    }

    // Being struck while dormant wakes it immediately ("something" disturbed the sleep).
    if (fight.state === "dormant") {
        beginAwaken(sentinel, fight);
        return;
    }

    // Getting hit mid-charge bats the ball away from the attacker: the charge
    // reverses into the direction of the blow, so hits steer it like a billiard shot.
    if (fight.state === "roll" && event.damageSource?.damagingEntity?.typeId === "minecraft:player" && fight.rollDir) {
        const attacker = event.damageSource.damagingEntity;
        const flat = flatMagnitude({ x: sentinel.location.x - attacker.location.x, z: sentinel.location.z - attacker.location.z });
        fight.rollDir = {
            x: (sentinel.location.x - attacker.location.x) / flat,
            z: (sentinel.location.z - attacker.location.z) / flat
        };
        fight.ticksSinceBounce = 3;
        faceRollDirection(sentinel, fight);

        try {
            sentinel.dimension.spawnParticle("ph:parry_success", {
                x: sentinel.location.x,
                y: sentinel.location.y + 1.1,
                z: sentinel.location.z
            });
        } catch {
            // Cosmetic only.
        }
        playAt(sentinel, "mob.armadillo.land", { pitch: 1.4, volume: 0.7 });
    }
}

export function onSentinelHit(damagingEntity?: Entity, hitEntity?: Entity): void {
    if (!hitEntity || hitEntity.typeId !== SENTINEL_ID || !hitEntity.isValid) return;
    if (!damagingEntity?.isValid) return;

    const fight = getFight(hitEntity);
    // Melee taps on the sleeping statue also count as the wake trigger.
    if (fight.state === "dormant") beginAwaken(hitEntity, fight);
}

export function onSentinelDie(entity: Entity): void {
    dropFight(entity);
}

// Safety net: catch sentinels the spawn hook never saw (world reload, restore, /clone...).
const SWEEP_DIMENSION_IDS = ["overworld", "nether", "the_end"];

system.runInterval(() => {
    for (const dimensionId of SWEEP_DIMENSION_IDS) {
        let dimension: Dimension;
        let tracked: Entity[] = [];
        try {
            dimension = world.getDimension(dimensionId);
            tracked = dimension.getEntities({ type: SENTINEL_ID });
        } catch {
            // Missing dimension / entity query trouble; the next sweep retries.
            continue;
        }

        for (const entity of tracked) {
            if (!entity.isValid) continue;
            if (fights.has(entity.id)) continue;
            onSentinelSpawn(entity);
        }
    }
}, 200);

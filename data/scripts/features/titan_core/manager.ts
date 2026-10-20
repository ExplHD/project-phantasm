import { world, system, Dimension, Entity, EntityHurtAfterEvent } from "@minecraft/server";

// ======================================== Titan Core (Titan Ridge) ========================================
// A 600 HP reactor core. Each time it crosses a 200 HP threshold it shields up and
// summons a defender wave (difficulty scaled). Defeat the whole wave to drop the
// shield; destroying the core triggers a 30-strong final defense swarm.

const CORE_ID = "ph:titan_core";
const MINION_TAG = "core_minion";
const MINION_TYPES = ["ph:plasmoid_drone", "ph:rupture_drone"];
const FINAL_DEFENSE_COUNT = 30;
const FALLBACK_DIFFICULTY = "normal";

// Wave size per world difficulty.
const WAVE_COUNTS: Record<string, number> = {
    easy: 10,
    normal: 20,
    hard: 35
};

const POLL_INTERVAL = 40;   // ticks between wave-clear checks
const WAVE_POLLS_MAX = 120; // 120 * 40 ticks = 4 minutes shielded max, then the shield drops anyway
const MINION_RANGE = 48;    // only minions near the core count for the wave

interface CoreFight {
    /** Highest phase already triggered (0 = none, 1 = shield at <=400, 2 = shield at <=200). */
    phase: number;
    shielded: boolean;
    watcher?: number;
    watcherPolls: number;
}

const fights = new Map<string, CoreFight>();

function getFight(core: Entity): CoreFight {
    let fight = fights.get(core.id);
    if (fight) return fight;

    fight = { phase: 0, shielded: false, watcherPolls: 0 };
    fights.set(core.id, fight);
    return fight;
}

function waveCount(): number {
    try {
        return WAVE_COUNTS[world.getDifficulty()] ?? WAVE_COUNTS[FALLBACK_DIFFICULTY];
    } catch {
        return WAVE_COUNTS[FALLBACK_DIFFICULTY];
    }
}

function announce(dimension: Dimension, location: { x: number; y: number; z: number }, message: string): void {
    try {
        for (const player of dimension.getPlayers({ location, maxDistance: 56 })) {
            player.onScreenDisplay.setActionBar(message);
        }
    } catch {
        // Player iteration can throw right before a dimension swap; the fight continues without it.
    }
}

function summonWave(core: Entity, count: number): void {
    const origin = core.location;
    const dimension = core.dimension;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 4 + Math.random() * 3;
        const typeId = i % 2 === 0 ? MINION_TYPES[0] : MINION_TYPES[1];

        const position = {
            x: origin.x + Math.cos(angle) * radius,
            y: origin.y + 1 + (i % 3),
            z: origin.z + Math.sin(angle) * radius
        };

        try {
            const minion = dimension.spawnEntity(typeId, position);
            minion.addTag(MINION_TAG);
            // Leash the minion to the core (minecraft:home, 16 blocks, all movement).
            minion.triggerEvent("ph:core_minion");
        } catch (err) {
            console.warn(`[ph] titan core minion spawn failed: ${err}`);
        }
    }

    announce(
        dimension,
        origin,
        count === FINAL_DEFENSE_COUNT
            ? "§cThe Titan Core unleashes its FINAL DEFENSE!"
            : "§cThe Titan Core summons its defenders!"
    );
}

function countMinions(core: Entity): number {
    let alive = 0;
    for (const typeId of MINION_TYPES) {
        try {
            alive += core.dimension.getEntities({
                type: typeId,
                tags: [MINION_TAG],
                location: core.location,
                maxDistance: MINION_RANGE
            }).length;
        } catch {
            // Dimension query failed (dimension torn down); assume no minions are left.
        }
    }
    return alive;
}

function endWave(core: Entity, fight: CoreFight): void {
    if (fight.watcher !== undefined) {
        system.clearRun(fight.watcher);
        fight.watcher = undefined;
    }
    fight.shielded = false;

    try {
        core.setProperty("ph:shielded", false);
        core.triggerEvent("ph:unshield");
    } catch (err) {
        console.warn(`[ph] titan core unshield failed: ${err}`);
    }

    announce(core.dimension, core.location, "§aThe Titan Core shield has collapsed!");
}

function watchWave(core: Entity, fight: CoreFight): void {
    fight.watcherPolls = 0;
    const interval = system.runInterval(() => {
        if (!core.isValid) {
            system.clearRun(interval);
            if (fight.watcher === interval) fight.watcher = undefined;
            fights.delete(core.id);
            return;
        }

        fight.watcherPolls++;
        const remaining = countMinions(core);

        // Wave finished, or safety release after too long (players leaving, minions despawning...).
        if (remaining === 0 || fight.watcherPolls >= WAVE_POLLS_MAX) {
            endWave(core, fight);
        }
    }, POLL_INTERVAL);
    fight.watcher = interval;
}

function beginShieldPhase(core: Entity, fight: CoreFight, phase: number): void {
    fight.phase = phase;
    fight.shielded = true;

    try {
        core.setProperty("ph:shielded", true);
        core.triggerEvent("ph:shield");
    } catch (err) {
        console.warn(`[ph] titan core shield failed: ${err}`);
    }

    summonWave(core, waveCount());
    watchWave(core, fight);
}

export function onTitanCoreHurt(event: EntityHurtAfterEvent): void {
    const core = event.hurtEntity;
    if (core.typeId !== CORE_ID) return;
    if (!core.isValid) return;

    const fight = getFight(core);
    if (fight.shielded) return; // shielded: thresholds cannot advance

    const healthComp = core.getComponent("minecraft:health");
    if (!healthComp) return;

    const health = healthComp.currentValue;

    // Thresholds: 400 HP opens phase 1, 200 HP opens phase 2.
    if (health <= 200 && fight.phase < 2) {
        beginShieldPhase(core, fight, 2);
    } else if (health <= 400 && fight.phase < 1) {
        beginShieldPhase(core, fight, 1);
    }
}

export function onTitanCoreDie(core: Entity): void {
    const fight = fights.get(core.id);
    if (fight) {
        if (fight.watcher !== undefined) {
            system.clearRun(fight.watcher);
            fight.watcher = undefined;
        }
        fights.delete(core.id);
    }

    try {
        core.dimension.spawnParticle("minecraft:huge_explosion_emitter", core.location);
        core.dimension.playSound("beacon.deactivate", core.location, { pitch: 0.6, volume: 1 });
    } catch {
        // Death bookkeeping must never block the final wave.
    }

    summonWave(core, FINAL_DEFENSE_COUNT);
}

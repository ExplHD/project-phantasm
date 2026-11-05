import { world, system, Dimension, Entity, EntityHurtAfterEvent } from "@minecraft/server";
import { isLoadedLocation } from "../../core/location";

const CORE_ID = "ph:titan_core";
const MINION_TAG = "core_minion";
const MINION_TYPES = ["ph:plasmoid_drone", "ph:rupture_drone"];
const FINAL_DEFENSE_COUNT = 30;
const FALLBACK_DIFFICULTY = "normal";

const WAVE_COUNTS: Record<string, number> = {
    easy: 10,
    normal: 17,
    hard: 22
};

const POLL_INTERVAL = 40;
const WAVE_POLLS_MAX = 120;
const MINION_RANGE = 48;

interface CoreFight {
    phase: number;
    shielded: boolean;
    watcher?: number;
    watcherPolls: number;
}

const fights = new Map<string, CoreFight>();

function getFight(core: Entity): CoreFight {
    const existing = fights.get(core.id);
    if (existing) return existing;

    const fight: CoreFight = { phase: 0, shielded: false, watcherPolls: 0 };
    fights.set(core.id, fight);
    return fight;
}

function waveCount(): number {
    return WAVE_COUNTS[world.getDifficulty()] ?? WAVE_COUNTS[FALLBACK_DIFFICULTY];
}

function announce(dimension: Dimension, location: { x: number; y: number; z: number }, message: string): void {
    for (const player of dimension.getPlayers({ location, maxDistance: 56 })) {
        if (!player.isValid) continue;
        player.onScreenDisplay.setActionBar(message);
    }
}

function summonWave(core: Entity, count: number): void {
    if (!core.isValid) return;
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

        if (!isLoadedLocation(dimension, position)) continue;
        const minion = dimension.spawnEntity(typeId, position);
        minion.addTag(MINION_TAG);
        minion.triggerEvent("ph:core_minion");
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
    if (!core.isValid) return 0;
    return MINION_TYPES.reduce((alive, typeId) => alive + core.dimension.getEntities({
        type: typeId,
        tags: [MINION_TAG],
        location: core.location,
        maxDistance: MINION_RANGE
    }).length, 0);
}

function endWave(core: Entity, fight: CoreFight): void {
    if (fight.watcher !== undefined) {
        system.clearRun(fight.watcher);
        fight.watcher = undefined;
    }
    fight.shielded = false;
    if (!core.isValid) return;

    core.setProperty("ph:shielded", false);
    core.triggerEvent("ph:unshield");

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

        if (remaining === 0 || fight.watcherPolls >= WAVE_POLLS_MAX) {
            endWave(core, fight);
        }
    }, POLL_INTERVAL);
    fight.watcher = interval;
}

function beginShieldPhase(core: Entity, fight: CoreFight, phase: number): void {
    fight.phase = phase;
    fight.shielded = true;
    if (!core.isValid) return;

    core.setProperty("ph:shielded", true);
    core.triggerEvent("ph:shield");

    summonWave(core, waveCount());
    watchWave(core, fight);
}

export function onTitanCoreHurt(event: EntityHurtAfterEvent): void {
    const core = event.hurtEntity;
    if (core.typeId !== CORE_ID) return;
    if (!core.isValid) return;

    const fight = getFight(core);
    if (fight.shielded) return;

    const healthComp = core.getComponent("minecraft:health");
    if (!healthComp) return;

    const health = healthComp.currentValue;

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

    if (!core.isValid) return;
    if (!isLoadedLocation(core.dimension, core.location)) return;
    core.dimension.spawnParticle("minecraft:huge_explosion_emitter", core.location);
    core.dimension.playSound("beacon.deactivate", core.location, { pitch: 0.6, volume: 1 });

    summonWave(core, FINAL_DEFENSE_COUNT);
}

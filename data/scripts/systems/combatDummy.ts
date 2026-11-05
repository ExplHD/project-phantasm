import { system, Entity, EntityHurtAfterEvent } from "@minecraft/server";

const COMBAT_TIMEOUT = 5000;
const DPS_WINDOW = 1000;
const SMOOTH_SPEED = 0.15;

interface DummyStats {
    readonly history: Array<{ readonly damage: number; readonly time: number }>;
    recentDamage: number;
    totalDamage: number;
    highestHit: number;
    hits: number;
    combatStart: number;
    lastHit: number;
    realDps: number;
    displayDps: number;
    interval: number | undefined;
    shownTag: string;
}

const DummyStatsMap = new Map<string, DummyStats>();

function getStats(dummy: Entity): DummyStats {
    const existing = DummyStatsMap.get(dummy.id);
    if (existing) return existing;

    const stats: DummyStats = {
        history: [],
        recentDamage: 0,

        totalDamage: 0,
        highestHit: 0,
        hits: 0,

        combatStart: 0,
        lastHit: 0,

        realDps: 0,
        displayDps: 0,

        interval: undefined,
        shownTag: ""
    };

    DummyStatsMap.set(dummy.id, stats);

    return stats;
}

function beginCombat(dummy: Entity, stats: DummyStats): void {
    if (stats.interval !== undefined)
        return;
    stats.interval = system.runInterval(() => {
        if (!dummy.isValid) {
            system.clearRun(stats.interval!);
            DummyStatsMap.delete(dummy.id);
            return;
        }

        const now = Date.now();

        while (
            stats.history.length &&
            now - stats.history[0].time > DPS_WINDOW
        ) {
            stats.recentDamage -= stats.history[0].damage;
            stats.history.shift();
        }

        stats.realDps = stats.recentDamage;

        stats.displayDps +=
            (stats.realDps - stats.displayDps) * SMOOTH_SPEED;
        const combatTime =
            Math.max((now - stats.combatStart) / 1000, 0.1);
        const averageDps =
            stats.totalDamage / combatTime;

        const nameTag =
`§e-= Combat Dummy =-

§fDPS §7: §a${Math.round(stats.displayDps)}
§fAverage DPS §7: §a${Math.round(averageDps)}

§fHighest Hit §7: §6${Math.round(stats.highestHit)}
§fTotal Damage §7: §c${Math.round(stats.totalDamage)}
§fHits §7: §b${stats.hits}`;

        if (stats.shownTag !== nameTag) {
            dummy.nameTag = nameTag;
            stats.shownTag = nameTag;
        }

        if (
            now - stats.lastHit >= COMBAT_TIMEOUT &&
            stats.displayDps < 1
        ) {
            dummy.nameTag = '';
            system.clearRun(stats.interval!);
            DummyStatsMap.delete(dummy.id);
        }
    }, 1);
}

function addDamage(dummy: Entity, damage: number): void {
    const stats = getStats(dummy);
    const now = Date.now();

    if (stats.hits === 0)
        stats.combatStart = now;

    stats.lastHit = now;

    stats.totalDamage += damage;
    stats.recentDamage += damage;
    stats.hits++;

    if (damage > stats.highestHit)
        stats.highestHit = damage;

    stats.history.push({
        damage,
        time: now
    });

    beginCombat(dummy, stats);
}

export function onDummyHurt(event: EntityHurtAfterEvent): void {
    const dummy = event.hurtEntity;
    if (dummy.typeId !== "ph:dummy")
        return;

    addDamage(dummy, event.damage);
}

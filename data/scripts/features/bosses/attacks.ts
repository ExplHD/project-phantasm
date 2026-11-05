import { Entity, EntityDamageCause, system, type EntityQueryOptions, type Vector3 } from '@minecraft/server'
import { summonOwned } from '~/core/summons'
import { isLoadedLocation } from '~/core/location'

const UNHITTABLE: Pick<EntityQueryOptions, "excludeTypes" | "excludeFamilies"> = {
    excludeTypes: ["minecraft:item", "minecraft:xp_orb"],
    excludeFamilies: ["inanimate"]
};

const DASH_TICKS = 14;
const DRIFT_PROPERTY = "ph:crimson_drift_point";
const DRIFT_MIN_RANGE = 3;
const DRIFT_MAX_RANGE = 24;
const DRIFT_MAX_HEIGHT = 3;

type Arg = string | number;

function parseArgs(message: string): Arg[] {
    return message.split(",").map(raw => {
        const value = raw.trim();
        return value !== "" && !isNaN(Number(value)) ? Number(value) : value;
    });
}

function num(value: Arg | undefined): number {
    return typeof value === "number" ? value : Number(value ?? 0);
}

function str(value: Arg | undefined): string {
    return value === undefined ? "" : String(value);
}

function playBossSound(source: Entity, sound: string, pitch = 1): void {
    if (sound) source.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 ${pitch} 0.3`);
}

function hasFamily(entity: Entity, family: string): boolean {
    return entity.getComponent("minecraft:type_family")?.hasTypeFamily(family) ?? false;
}

function distancePointToSegment(point: Vector3, start: Vector3, end: Vector3): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;

    const t = lengthSquared > 0
        ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared))
        : 0;

    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy), point.z - (start.z + t * dz));
}

export function bossSummonProjectile(source: Entity, message: string): void {
    summonProjectiles(source, message, false);
}

export function bossSummonProjectileFacing(source: Entity, message: string): void {
    summonProjectiles(source, message, true);
}

function summonProjectiles(source: Entity, message: string, withPitch: boolean): void {
    const [amount, yOffset, typeId, sound] = parseArgs(message);
    playBossSound(source, str(sound));

    const { x, y, z } = source.location;
    const spawnY = y + num(yOffset);
    for (let i = 0; i < num(amount); i++) {
        const yaw = Math.floor(Math.random() * 360);
        const pitch = withPitch ? Math.floor(-90 + Math.random() * 180) : 0;
        summonOwned(source, `summon ${typeId} ${x} ${spawnY} ${z} ${yaw} ${pitch}`);
    }
}

export function bossSummon(source: Entity, message: string): void {
    const [amount, yOffset, radius, typeId, sound, spawnEvent] = parseArgs(message);
    playBossSound(source, str(sound));

    const { x, y, z } = source.location;
    const spread = num(radius);
    const event = str(spawnEvent);
    for (let i = 0; i < num(amount); i++) {
        const offsetX = (Math.random() * 2 - 1) * spread;
        const offsetZ = (Math.random() * 2 - 1) * spread;
        const yaw = Math.floor(Math.random() * 360);
        summonOwned(source, `summon ${typeId} ${x + offsetX} ${y + num(yOffset)} ${z + offsetZ} ${yaw} 0 ${event}`.trimEnd());
    }
}

export function ramDash(source: Entity, message: string, vertical: boolean): void {
    const [force, damage, collisionRadius, sound, spareFamily] = parseArgs(message);
    const direction = source.getViewDirection();
    const push = num(force);

    source.applyImpulse({ x: direction.x * push, y: vertical ? direction.y * push : 0, z: direction.z * push });
    beginCollisionCheck(source, DASH_TICKS, num(damage), num(collisionRadius), str(spareFamily) || undefined);
    playBossSound(source, str(sound));
}

function beginCollisionCheck(dasher: Entity, duration: number, damage: number, collisionRadius: number, spareFamily?: string): void {
    let tick = 0;
    let prevPos = { ...dasher.location };
    const hitEntities = new Set<string>([dasher.id]);

    const interval = system.runInterval(() => {
        if (!dasher.isValid) {
            system.clearRun(interval);
            return;
        }

        tick++;
        const currentPos = { ...dasher.location };
        const travelled = Math.hypot(currentPos.x - prevPos.x, currentPos.y - prevPos.y, currentPos.z - prevPos.z);

        const targets = dasher.dimension.getEntities({
            ...UNHITTABLE,
            location: currentPos,
            maxDistance: collisionRadius + travelled + 1
        });

        for (const target of targets) {
            if (hitEntities.has(target.id) || !target.isValid) continue;
            if (target.hasTag("parried")) continue;
            if (spareFamily && hasFamily(target, spareFamily)) continue;
            if (distancePointToSegment(target.location, prevPos, currentPos) > collisionRadius) continue;

            hitEntities.add(target.id);
            if (!dasher.isValid) return;
            target.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: dasher });
        }

        prevPos = currentPos;
        if (tick >= duration) system.clearRun(interval);
    });
}

export function laserOnce(shooter: Entity, message: string): void {
    const [range, damage, width, sound, spareFamily] = parseArgs(message);
    const length = num(range);
    const halfWidth = num(width);
    const spare = str(spareFamily);

    const start = shooter.location;
    const dir = shooter.getViewDirection();
    const end = { x: start.x + dir.x * length, y: start.y + dir.y * length, z: start.z + dir.z * length };

    const targets = shooter.dimension.getEntities({ ...UNHITTABLE, location: start, maxDistance: length + halfWidth });
    for (const target of targets) {
        if (target.id === shooter.id || !target.isValid) continue;
        if (spare && hasFamily(target, spare)) continue;
        if (distancePointToSegment(target.location, start, end) > halfWidth) continue;
        if (!shooter.isValid) return;

        target.applyDamage(num(damage), { cause: EntityDamageCause.magic, damagingEntity: shooter });
    }

    playBossSound(shooter, str(sound));
}

export function crimsonDriftMark(boss: Entity): void {
    const point = findDriftPoint(boss) ?? boss.location;
    boss.setDynamicProperty(DRIFT_PROPERTY, point);

    const marker = { x: point.x, y: point.y + 1, z: point.z };
    boss.dimension.spawnParticle("ph:crimson_drift_small", marker);
    boss.dimension.spawnParticle("ph:crimson_drift_large", marker);
}

export function crimsonDriftStrike(boss: Entity): void {
    const stored = boss.getDynamicProperty(DRIFT_PROPERTY);
    boss.setDynamicProperty(DRIFT_PROPERTY, undefined);
    const point = isVector(stored) ? stored : boss.location;

    boss.teleport(point);

    const at = `execute positioned ${point.x} ${point.y} ${point.z} run`;
    boss.runCommand(`${at} playsound mob.zombie.remedy @a[r=32] ~~~ 1 1 0.3`);
    boss.runCommand(`${at} particle ph:crimson_roots_spread ~~1~`);
    boss.runCommand(`${at} damage @e[r=10,rm=0.1,family=!inanimate,family=!crimson_eye,type=!item] 10 magic entity @s`);
    boss.runCommand(`${at} camera @a[r=10] fade time 0 5 1 color 180 0 0`);
    boss.runCommand(`${at} effect @e[r=10,rm=0.1,family=!inanimate,family=!crimson_eye] wither 5 3 true`);
}

function isVector(value: unknown): value is Vector3 {
    return typeof value === "object" && value !== null && "x" in value && "y" in value && "z" in value;
}

function findDriftPoint(boss: Entity): Vector3 | undefined {
    const origin = boss.location;
    const top = origin.y + DRIFT_MAX_HEIGHT;

    for (let attempt = 0; attempt < 8; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = DRIFT_MIN_RANGE + Math.random() * (DRIFT_MAX_RANGE - DRIFT_MIN_RANGE);
        const x = origin.x + Math.cos(angle) * distance;
        const z = origin.z + Math.sin(angle) * distance;

        const rayStart = { x, y: top, z };
        if (!isLoadedLocation(boss.dimension, rayStart)) continue;
        const hit = boss.dimension.getBlockFromRay(rayStart, { x: 0, y: -1, z: 0 }, {
            maxDistance: 48,
            includeLiquidBlocks: false,
            includePassableBlocks: false
        });
        if (hit) return { x: Math.floor(x) + 0.5, y: hit.block.y + 1, z: Math.floor(z) + 0.5 };
    }
    return undefined;
}

import { Entity, MolangVariableMap, system, type RGB } from '@minecraft/server'
import { getItemRarity, type ItemRarity } from '../core/itemRarity'
import { isLoadedLocation } from '../core/location'

interface BeamStyle {
    readonly color: RGB;
    readonly height: number;
    readonly alpha: number;
}

interface TrackedBeam {
    readonly entity: Entity;
    readonly molang: MolangVariableMap;
    nextTick: number;
}

const BEAMS: Record<ItemRarity, BeamStyle> = {
    common: { color: hex(0xFFFFFF), height: 0.75, alpha: 0.4 },
    uncommon: { color: hex(0xFFFF54), height: 1, alpha: 0.85 },
    rare: { color: hex(0x54FFFF), height: 1.3, alpha: 0.85 },
    epic: { color: hex(0xFF54FF), height: 1.6, alpha: 0.85 },
    legendary: { color: hex(0xFF8C1A), height: 2, alpha: 1 }
}

const RENEW_TICKS = 20;
const MAX_COMMON_BEAMS = 32;

const BIG_STACK = 5;
const BIG_STACK_SCALE = 1.25;

const LAND_DELAY_TICKS = 4;
const WAITING = -1;

function hex(value: number): RGB {
    return { red: (value >> 16 & 255) / 255, green: (value >> 8 & 255) / 255, blue: (value & 255) / 255 };
}

const beams = new Map<string, TrackedBeam>();

export function trackLootItem(entity: Entity): void {
    if (entity.typeId !== "minecraft:item" || !entity.isValid || beams.has(entity.id)) return;
    const item = entity.getComponent("minecraft:item")?.itemStack;
    if (!item) return;

    const rarity = getItemRarity(item);
    if (rarity === "common" && beams.size >= MAX_COMMON_BEAMS) return;
    const beam = BEAMS[rarity];
    const molang = new MolangVariableMap();
    molang.setColorRGB("variable.color", beam.color);
    molang.setFloat("variable.height", beam.height);
    molang.setFloat("variable.alpha", beam.alpha);
    beams.set(entity.id, { entity, molang, nextTick: WAITING });
}

export function tickLootBeams(): void {
    const tick = system.currentTick;
    for (const [id, beam] of beams) {
        if (!beam.entity.isValid) {
            beams.delete(id);
            continue;
        }
        if (beam.nextTick === WAITING) {
            if (beam.entity.isOnGround || beam.entity.isInWater) beam.nextTick = tick + LAND_DELAY_TICKS;
            continue;
        }
        if (tick < beam.nextTick) continue;
        beam.nextTick = tick + RENEW_TICKS;

        const amount = beam.entity.getComponent("minecraft:item")?.itemStack.amount ?? 1;
        beam.molang.setFloat("variable.scale", amount > BIG_STACK ? BIG_STACK_SCALE : 1);
        if (!isLoadedLocation(beam.entity.dimension, beam.entity.location)) continue;
        beam.entity.dimension.spawnParticle("ph:loot_beam_glow", beam.entity.location, beam.molang);
        beam.entity.dimension.spawnParticle("ph:loot_beam", beam.entity.location, beam.molang);
    }
}

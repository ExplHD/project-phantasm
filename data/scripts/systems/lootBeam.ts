import { Entity, MolangVariableMap, system, type RGB } from '@minecraft/server'
import { getItemRarity, type ItemRarity } from '../core/itemRarity'

// Vanilla Bedrock rarity colors, plus Phantasm's own legendary in bright orange. Each tier
// is a little taller than the one below, and common is also dimmer so piles of everyday
// drops don't drown out the rarer beams. height is half the beam height in blocks.
const BEAMS: Record<ItemRarity, { color: RGB; height: number; alpha: number }> = {
    common: { color: hex(0xFFFFFF), height: 0.75, alpha: 0.4 },
    uncommon: { color: hex(0xFFFF54), height: 1, alpha: 0.85 },
    rare: { color: hex(0x54FFFF), height: 1.3, alpha: 0.85 },
    epic: { color: hex(0xFF54FF), height: 1.6, alpha: 0.85 },
    legendary: { color: hex(0xFF8C1A), height: 2, alpha: 1 }
}

// Both beam particles live 1.25s and fade over their first and last 0.25s. Renewing every
// 20 ticks lines each fade-in up with the previous fade-out, and since both layers are
// additive the two always add up to the same brightness, so the beam never blinks.
const RENEW_TICKS = 20;

// Stacks bigger than this get a slightly bigger beam
const BIG_STACK = 5;
const BIG_STACK_SCALE = 1.25;

// The beam starts this long after the item lands, so thrown or flying drops stay clean
const LAND_DELAY_TICKS = 4;
const WAITING = -1;

function hex(value: number): RGB {
    return { red: (value >> 16 & 255) / 255, green: (value >> 8 & 255) / 255, blue: (value & 255) / 255 };
}

const beams = new Map<string, { entity: Entity; molang: MolangVariableMap; nextTick: number }>();

// Called for item entities on spawn and on chunk load
export function trackLootItem(entity: Entity): void {
    if (entity.typeId !== "minecraft:item" || !entity.isValid || beams.has(entity.id)) return;
    const item = entity.getComponent("minecraft:item")?.itemStack;
    if (!item) return;

    const beam = BEAMS[getItemRarity(item)];
    const molang = new MolangVariableMap();
    molang.setColorRGB("variable.color", beam.color);
    molang.setFloat("variable.height", beam.height);
    molang.setFloat("variable.alpha", beam.alpha);
    beams.set(entity.id, { entity, molang, nextTick: WAITING });
}

// Runs every tick, but each item only spawns when its own renew tick comes up
export function tickLootBeams(): void {
    const tick = system.currentTick;
    for (const [id, beam] of beams) {
        if (!beam.entity.isValid) {
            beams.delete(id);
            continue;
        }
        if (beam.nextTick === WAITING) {
            // Water counts as landed, floating items never touch the ground
            if (beam.entity.isOnGround || beam.entity.isInWater) beam.nextTick = tick + LAND_DELAY_TICKS;
            continue;
        }
        if (tick < beam.nextTick) continue;
        beam.nextTick = tick + RENEW_TICKS;
        // Read every renew, the stack grows when nearby drops merge into it
        const amount = beam.entity.getComponent("minecraft:item")?.itemStack.amount ?? 1;
        beam.molang.setFloat("variable.scale", amount > BIG_STACK ? BIG_STACK_SCALE : 1);
        try {
            beam.entity.dimension.spawnParticle("ph:loot_beam_glow", beam.entity.location, beam.molang);
            beam.entity.dimension.spawnParticle("ph:loot_beam", beam.entity.location, beam.molang);
        } catch {
            // Chunk unloaded between the validity check and the spawn
        }
    }
}

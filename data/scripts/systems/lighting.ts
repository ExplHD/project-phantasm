import { /* [UNUSED] world */ system, BlockPermutation, Player, Block } from '@minecraft/server';
import { getAccessoryItems } from '../core/player';

export const lightLevelMap: Record<string, number> = {
    "minecraft:beacon": 15,
    "minecraft:conduit": 15,
    "minecraft:ochre_froglight": 15,
    "minecraft:pearlscent_froglight": 15,
    "minecraft:verdant_froglight": 15,
    "minecraft:glowstone": 15,
    "minecraft:jack_o_lantern": 15,
    "minecraft:lantern": 15,
    "minecraft:campfire": 15,
    "minecraft:sea_lantern": 15,
    "minecraft:shroomlight": 15,

    "minecraft:end_rod": 14,
    "minecraft:torch": 14,

    "minecraft:crying_obsidian": 10,
    "minecraft:soul_campfire": 10,
    "minecraft:soul_lantern": 10,
    "minecraft:soul_torch": 10,

    "minecraft:enchanting_table": 7,
    "minecraft:ender_chest": 7,
    "minecraft:glow_lichen": 7,
    "minecraft:redstone_torch": 7,
    "ph:solaris_verdant": 7,

    "minecraft:sculk_catalyst": 6,

    "minecraft:amethyst_cluster": 5,
    "minecraft:large_amethyst_bud": 4,
    "minecraft:magma": 3,
    "minecraft:medium_amethyst_bud": 2,

    "minecraft:brewing_stand": 1,
    "minecraft:brown_mushroom": 1,
    "minecraft:dragon_egg": 1,
    "minecraft:sculk_sensor": 1,
    "minecraft:small_amethyst_bud": 1
};

interface LightingState {
    interval: number;
    lastLightBlock: Block | undefined;
    maxLight: number;
    /** The single `light_<level>` tag this state added, so teardown only removes that one. */
    tag: string;
}

const lightingStates = new Map<string, LightingState>();

/**
 * Sweeps a box around the player for leftover light blocks. This is only the fallback for
 * light blocks this script lost track of (world reloaded while a light was placed), so it
 * runs on death and leave. The frequent accessory-swap teardown clears the exact block it
 * placed instead of paying 16 fill commands over ~296k block checks.
 */
function removeLightBlocks(player: Player): void {
    for (let i = 0; i <= 15; i++) {
        try {
            player.runCommand(`fill ~-16~-8~-16~16~8~16 air replace light_block_${i}`);
        } catch (e) {
            // Ignore, e.g. chunk not loaded / command unavailable
        }
    }
}

/** Clears the one light block this state placed, if it is still standing. */
function clearPlacedLight(state: LightingState): void {
    const block = state.lastLightBlock;
    state.lastLightBlock = undefined;
    if (!block) return;
    try {
        if (block.isValid && block.typeId.startsWith('minecraft:light_block')) {
            block.setType('minecraft:air');
        }
    } catch (e) {
        // Ignore, e.g. the chunk unloaded while the light was placed
    }
}

function safeRemoveTag(player: Player, tag: string): void {
    if (!player?.isValid) return;
    try {
        if (player.hasTag(tag)) player.removeTag(tag);
    } catch (e) {
        // Ignore InvalidEntityError (entity died/left between scheduling and run)
    }
}

export function clearPlayerLighting(player: Player): void {
    let key: string | undefined;
    try {
        key = player?.id;
    } catch (e) {
        return;
    }
    const state = key !== undefined ? lightingStates.get(key) : undefined;

    // Without a tracked state the player never carried a light accessory, so the sweep
    // below would be 16 commands over ~296k block checks to find nothing.
    if (!state) {
        return;
    }

    if (state.interval !== -1) {
        try {
            system.clearRun(state.interval);
        } catch (e) {
            // Ignore
        }
    }
    if (key !== undefined) lightingStates.delete(key);

    if (!player?.isValid) return;

    safeRemoveTag(player, state.tag);
    clearPlacedLight(state);
    removeLightBlocks(player);
}

export function onDynamicLighting(player: Player): void {
    const accessoryItems = getAccessoryItems(player);

    let maxLight = -1;

    for (const item of accessoryItems) {
        const light = lightLevelMap[item.typeId];

        if (light === undefined) continue;

        maxLight = Math.max(maxLight, light);
    }

    const existing = lightingStates.get(player.id);

    // Nothing changed -> keep the current lighting running (avoids flickering)
    if (existing && existing.maxLight === maxLight) return;

    // Tear down the old state. This runs on every accessory swap that changes the level, so
    // it clears the one block it placed and the one tag it added instead of sweeping the
    // whole box; the sweep stays in clearPlayerLighting as the reload fallback.
    if (existing) {
        if (existing.interval !== -1) {
            system.clearRun(existing.interval);
        }
        player.removeTag(existing.tag);
        clearPlacedLight(existing);
    }

    if (maxLight === -1) {
        lightingStates.delete(player.id);
        return;
    }

    const tag = `light_${maxLight}`;
    player.addTag(tag);

    const state: LightingState = {
        interval: -1,
        lastLightBlock: undefined,
        maxLight,
        tag
    };
    lightingStates.set(player.id, state);

    const updateLight = () => {
        if (!player.isValid) return;

        try {
			const finalLocation = player.getHeadLocation()

            const block = player.dimension.getBlock(finalLocation);
            if (!block) return;

            // Only place the light on air or liquid blocks (e.g. water).
            // Inside solid blocks or non-solid ones like tall grass, doors and
            // flowers we skip, so the block we're standing in isn't destroyed;
            // the previous light is then removed again once we step back out.
            if (!block.isAir && !block.isLiquid) return;

            // Clear the previous light first, but isolate that failure: a stale reference to
            // an unloaded chunk must not stop the new light from being placed.
            clearPlacedLight(state);

            block.setPermutation(
                BlockPermutation.resolve('minecraft:light_block', {
                    block_light_level: state.maxLight
                })
            );

            state.lastLightBlock = block;
        } catch (e) {
            // Ignore e.g. LocationInUnloadedChunkError while dead / in unloaded chunks
        }
    };

    // Place the light immediately so switching items doesn't flicker
    updateLight();

    state.interval = system.runInterval(updateLight, 4);
}
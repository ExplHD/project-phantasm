import { world, system, BlockPermutation } from '@minecraft/server';
import { getAccessoryItems } from './main';

export const lightLevelMap = {
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

const lightingStates = new Map();

function removeLightBlocks(player) {
    for (let i = 0; i <= 15; i++) {
        try {
            player.runCommand(`fill ~-16~-8~-16~16~8~16 air replace light_block_${i}`);
        } catch (e) {
            // Ignore, e.g. chunk not loaded / command unavailable
        }
    }
}

export function clearPlayerLighting(player) {
    const state = lightingStates.get(player.id);
    if (state && state.interval !== -1) {
        system.clearRun(state.interval);
    }
    lightingStates.delete(player.id);

    for (let i = 0; i <= 15; i++) {
        player.removeTag(`light_${i}`);
    }
    removeLightBlocks(player);
}

export function onDynamicLighting(player) {
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

    // Tear down the old state
    if (existing && existing.interval !== -1) {
        system.clearRun(existing.interval);
    }
    if (existing || maxLight !== -1) {
        for (let i = 0; i <= 15; i++) {
            player.removeTag(`light_${i}`);
        }
        removeLightBlocks(player);
    }

    if (maxLight === -1) {
        lightingStates.delete(player.id);
        return;
    }

    player.addTag(`light_${maxLight}`);

    const state = {
        interval: -1,
        lastLightBlock: undefined,
        maxLight
    };
    lightingStates.set(player.id, state);

    const updateLight = () => {
        if (!player.isValid) return;

        try {
            const finalLocation = {
                x: player.location.x,
                y: player.location.y + 1,
                z: player.location.z
            };

            const block = player.dimension.getBlock(finalLocation);
            if (!block) return;

            // Only place the light on air or liquid blocks (e.g. water).
            // Inside solid blocks or non-solid ones like tall grass, doors and
            // flowers we skip, so the block we're standing in isn't destroyed;
            // the previous light is then removed again once we step back out.
            if (!block.isAir && !block.isLiquid) return;

            if (state.lastLightBlock?.typeId.startsWith('minecraft:light_block')) {
                state.lastLightBlock.setType('minecraft:air');
            }

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

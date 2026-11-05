import { system, BlockPermutation, Player, Block } from '@minecraft/server';
import { getAccessoryItems } from '../core/player';
import { isLoadedLocation } from '../core/location';

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
    readonly maxLight: number;
    readonly tag: string;
}

const lightingStates = new Map<string, LightingState>();

function removeLightBlocks(player: Player): void {
    if (!player.isValid) return;
    if (!player.dimension.isChunkLoaded(player.location)) return;
    for (let i = 0; i <= 15; i++) {
        player.runCommand(`fill ~-16~-8~-16~16~8~16 air replace light_block_${i}`);
    }
}

function clearPlacedLight(state: LightingState): void {
    const block = state.lastLightBlock;
    state.lastLightBlock = undefined;
    if (!block?.isValid) return;
    if (!block.typeId.startsWith('minecraft:light_block')) return;
    block.setType('minecraft:air');
}

function safeRemoveTag(player: Player, tag: string): void {
    if (!player?.isValid) return;
    if (player.hasTag(tag)) player.removeTag(tag);
}

export function clearPlayerLighting(player: Player): void {
    const key = player?.id;
    if (key === undefined) return;
    const state = lightingStates.get(key);
    if (!state) return;

    if (state.interval !== -1) system.clearRun(state.interval);
    lightingStates.delete(key);

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

    if (existing && existing.maxLight === maxLight) return;

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

    const updateLight = (): void => {
        if (!player.isValid) return;

        const finalLocation = player.getHeadLocation();
        if (!isLoadedLocation(player.dimension, finalLocation)) return;

        const block = player.dimension.getBlock(finalLocation);
        if (!block) return;

        if (!block.isAir && !block.isLiquid) return;

        clearPlacedLight(state);

        block.setPermutation(
            BlockPermutation.resolve('minecraft:light_block', {
                block_light_level: state.maxLight
            })
        );

        state.lastLightBlock = block;
    };

    updateLight();

    state.interval = system.runInterval(updateLight, 4);
}

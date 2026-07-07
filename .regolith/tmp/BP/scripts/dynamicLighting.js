import { world, system, BlockPermutation } from '@minecraft/server';
import { getAccessoryItems } from './main';

let runInterval = Number()

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

world.afterEvents.playerInventoryItemChange.subscribe(({ player }) => {
    const accessoryItems = getAccessoryItems(player);

    // Deletes old Light Tag
    for (let i = 0; i <= 15; i++) {
        player.removeTag(`light_${i}`);
        try {
            player.runCommand(`fill ~-16~-8~-16~16~8~16 air replace light_block_${i}`);
        } catch (e) {
            console.warn(e);
        }
    }
    system.clearRun(runInterval);

    let maxLight = -1;

    for (const item of accessoryItems) {
        const light = lightLevelMap[item.typeId];

        if (light === undefined) continue;

        maxLight = Math.max(maxLight, light);
    }

    if (maxLight !== -1) {
        player.addTag(`light_${maxLight}`);

        let lastLightBlock;
        runInterval = system.runInterval(() => {
            if (lastLightBlock?.typeId === `minecraft:light_block_${maxLight}`) {
                lastLightBlock.setType("minecraft:air");
            }

            const block = player.dimension.getBlock(player.location);

            if (block.typeId !== "minecraft:air") return;

            block.setPermutation(
                BlockPermutation.resolve("minecraft:light_block", {
                    block_light_level: maxLight
                })
            );

            lastLightBlock = block;
        }, 4);
    }
});
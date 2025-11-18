import { world, system, ItemStack } from '@minecraft/server'

world.beforeEvents.playerBreakBlock.subscribe(({ player, itemStack, block, dimension }) => {
    let blockAndItems = [
        {
            block: "minecraft:prismarine",
            item: new ItemStack("minecraft:prismarine_shard", Math.floor(Math.random() * (7 - 4) + 4)),
            item_tag: "minecraft:is_pickaxe",
            tool: undefined
        }
    ]
    for (const splittedData of blockAndItems) {
        if (block.typeId === splittedData.block) {
            const tags = itemStack?.getTags();
            const enchantment = itemStack?.getComponent("enchantable")?.getEnchantment("silk_touch");
            const gameMode = player.getGameMode();
            if (gameMode == "Creative") return;
            if (enchantment) return;
            if (!enchantment && tags != undefined && splittedData.item_tag && tags.includes(splittedData.item_tag)) {
                system.run(() => {
                    block.dimension.runCommand("kill @e[r=0.2,type=item,name=Prismarine]")
                    block.dimension.spawnItem(splittedData.item, block.location);
                })
            } else {
                if (!splittedData.tool) {
                    return;
                }
                if (itemStack.typeId == splittedData.tool) {
                    system.run(() => {
                        block.dimension.runCommand("kill @e[r=0.2,type=item,name=Prismarine]")
                        block.dimension.spawnItem(splittedData.item, block.location);
                    })
                }
            }
        }
    }
})
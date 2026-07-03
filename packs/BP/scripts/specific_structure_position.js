import { world, system } from "@minecraft/server"

world.afterEvents.worldLoad.subscribe(() => {
    const prismarineStructure = world.getDynamicProperty("ph:prismarine_boss_arena") ?? false;
    if (!prismarineStructure || prismarineStructure != true) {
        world.structureManager.place("mystructure:prismarine_boss_arena", world.getDimension("overworld"), { x: 2976, y: 62, z: 2976 });
        world.setDynamicProperty("ph:prismarine_boss_arena", true);
        console.warn("Structure Loaded");
    }
})
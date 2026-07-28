import { EntityEquippableComponent, EquipmentSlot, Entity, ItemStack } from "@minecraft/server";

export const ExcludeFamilyTypes: string[] = ["immune", "unvenerable"];
export const ExcludeEntities: string[] = [
    "minecraft:item", "minecraft:xp_orb",
    "minecraft:armor_stand", "minecraft:iron_golem"
];

export const AllowedMaceEnchants: string[] = [
    "density", "wind_burst", "breach",
    "smite", "bane_of_arthropods", "fire_aspect",
    "unbreaking", "mending", "curse_of_vanishing"
];
export function isRestrictedMace(item: ItemStack | undefined): boolean {
    if (!item) return false;
    // Only prevent certain enchantments if the item has the tag.
    return item.hasTag("ph:is_mace");
}

export function isValidTarget(entity: Entity | undefined): boolean {
    try {
        if (!entity || entity.isValid === false) return false;
        if (ExcludeEntities.includes(entity.typeId)) return false;

        const tags = entity.getTags();
        for (const family of ExcludeFamilyTypes) {
            if (tags.includes(`minecraft:family_${family}`)) return false;
        }
        return true;
    } catch (e) { return false; }
}

// Reduce impulse to victim wearing netherite armor.
export function getKnockbackMultiplier(entity: Entity): number {
    try {
        const equipment = entity.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent | undefined;
        if (!equipment) return 1.0;

        const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
        let resistance = 0;

        for (const slot of slots) {
            const item = equipment.getEquipment(slot);
            if (item && item.hasTag("minecraft:netherite_tier")) {
                resistance += 0.10;
            }
        }
        return 1.0 - resistance;
    } catch (e) { return 1.0; }
}

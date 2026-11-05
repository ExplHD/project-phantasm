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

    return item.hasTag("ph:is_mace");
}

export function isValidTarget(entity: Entity | undefined): boolean {
    if (!entity?.isValid) return false;
    if (ExcludeEntities.includes(entity.typeId)) return false;

    const tags = entity.getTags();
    for (const family of ExcludeFamilyTypes) {
        if (tags.includes(`minecraft:family_${family}`)) return false;
    }
    return true;
}

export function getKnockbackMultiplier(entity: Entity): number {
    if (!entity.isValid) return 1.0;
    const equipment = entity.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent | undefined;
    if (!equipment?.isValid) return 1.0;

    const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
    const netheritePieces = slots.filter((slot) => equipment.getEquipment(slot)?.hasTag("minecraft:netherite_tier")).length;
    return 1.0 - netheritePieces * 0.10;
}

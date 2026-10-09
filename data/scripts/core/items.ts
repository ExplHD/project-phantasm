/**
 * Durability helpers. Mirrors vanilla Unbreaking roll chance on top of a flat damage amount.
 */
interface DurabilityDamageOptions {
    damage?: number;
    slot?: number;
    ignoreUnbreaking?: boolean;
    breakSound?: boolean;
}

export function applyDurabilityDamage(source: any, options: DurabilityDamageOptions = {}) {
    const {
        damage = 1,
        slot = source?.selectedSlotIndex,
        ignoreUnbreaking = false,
        breakSound = true
    } = options;

    const inventory = source?.getComponent("inventory")?.container;
    if (!inventory) return;

    const item = inventory.getItem(slot);
    if (!item) return;

    const durability = item.getComponent("durability");
    if (!durability) return;

    if (source.getGameMode && source.getGameMode() === "Creative") return;

    if (!ignoreUnbreaking) {
        const unbreaking = item
            ?.getComponent("enchantable")
            ?.getEnchantment("unbreaking")?.level ?? 0;

        const chance = unbreaking * 21;
        const roll = Math.floor(Math.random() * 101);

        if (roll <= chance) return;
    }

    const newDamage = durability.damage + damage;

    if (newDamage >= durability.maxDurability) {
        inventory.setItem(slot, undefined);

        if (breakSound && source.playSound) {
            source.playSound("random.break");
        }
        return;
    }

    durability.damage = newDamage;
    inventory.setItem(slot, item);
}
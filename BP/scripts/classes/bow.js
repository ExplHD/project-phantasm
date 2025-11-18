import {
    world,
    system,
    EquipmentSlot,
    GameMode,
    EntityHealthComponent,
    EntityInventoryComponent,
    ItemEnchantableComponent,
    EntityProjectileComponent,
    ItemDurabilityComponent
} from '@minecraft/server';

// Simpan cooldown antar tembakan
const bowCooldown = new Map(); // player.id -> tick terakhir

// Fungsi untuk mendapatkan tick dunia saat ini
function getCurrentTick() {
    return system.currentTick || 0;
}

class BowHandler {
    constructor(bowId, damage, ammunitions, projectiles, minChargeTime, sound, cooldownTicks = 10) {
        this.bowId = bowId;
        this.damage = damage;
        this.ammunitions = ammunitions;
        this.projectiles = projectiles;
        this.minChargeTime = minChargeTime; // dalam detik
        this.sound = sound;
        this.cooldownTicks = cooldownTicks; // waktu delay antar tembakan
    }

    static consumeAmmo(source, ammoTypes) {
        const isCreative = source.getGameMode() === GameMode.creative;
        if (isCreative) return { ammoId: 0, typeId: ammoTypes[0] };

        const inventory = source.getComponent("minecraft:inventory")?.container;
        if (!inventory) return null;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) continue;

            const ammoId = ammoTypes.indexOf(item.typeId);
            if (ammoId === -1) continue;

            if (item.amount > 1) {
                item.amount--;
                inventory.setItem(i, item);
            } else {
                inventory.setItem(i, undefined);
            }

            return { ammoId, typeId: item.typeId };
        }

        return null;
    }

    shoot(source, useDuration) {
        const durationSec = useDuration / 20;

        // 🔒 Cegah spam
        const nowTick = getCurrentTick();
        const lastShotTick = bowCooldown.get(source.id) || 0;
        if (nowTick - lastShotTick < this.cooldownTicks) {
            // Masih cooldown → batal
            return;
        }

        // Pastikan bow di-charge cukup
        if (durationSec < this.minChargeTime) return;

        // Set waktu tembakan terakhir
        bowCooldown.set(source.id, nowTick);

        // Rasio charge (maks 1.0)
        const chargeRatio = Math.min(durationSec / 1.0, 1);

        // Ambil amunisi
        const ammoData = BowHandler.consumeAmmo(source, this.ammunitions);
        if (!ammoData) return;

        const projectileType = this.projectiles[ammoData.ammoId];
        const headLoc = source.getHeadLocation();
        const arrow = source.dimension.spawnEntity(projectileType, headLoc);

        const mainhand = source.getComponent("equippable")?.getEquipment("Mainhand");
        const enchantable = mainhand?.getComponent(ItemEnchantableComponent.componentId);
        if (enchantable?.getEnchantment("flame")) arrow.setOnFire(5);

        // Damage skala penuh di chargeRatio=1
        const scaledDamage = this.damage * chargeRatio;
        arrow.setDynamicProperty("damage", scaledDamage);

        const viewDir = source.getViewDirection();
        const velocity = 4.8 * chargeRatio;

        const comp = arrow.getComponent(EntityProjectileComponent.componentId);
        if (!comp) return;

        comp.owner = source;
        comp.shoot({
            x: viewDir.x * velocity,
            y: viewDir.y * velocity,
            z: viewDir.z * velocity
        });

        source.dimension.playSound(this.sound, headLoc);
        this.decreaseDurability(source, mainhand, 1);
    }

    decreaseDurability(source, item, amount) {
        if (!item) return;
        const gamemode = source.getGameMode();
        if (gamemode === GameMode.creative) return;

        const comp = item.getComponent(ItemDurabilityComponent.componentId);
        if (!comp) return;

        const ench = item.getComponent(ItemEnchantableComponent.componentId)?.getEnchantment("unbreaking");
        const chance = ench ? ench.level * 0.25 : 0;
        if (Math.random() < chance) return;

        if (comp.damage + amount > comp.maxDurability) {
            source.playSound("random.break");
            source.getComponent("equippable")?.setEquipment(EquipmentSlot.Mainhand, undefined);
        } else {
            comp.damage += amount;
        }
    }
}

const spectricBow = new BowHandler(
    "ph:spectric_bow",
    12,
    ["minecraft:arrow", "ph:spectral_arrow"],
    ["minecraft:arrow", "ph:spectric_laser"],
    0.4, // minimal charge 0.4 detik
    "custom_sfx.high_voltage_spark",
    20 // cooldown antar tembakan (8 tick ≈ 0.4 detik)
);

const bowData = [spectricBow];

world.afterEvents.entityHurt.subscribe((data) => {
    const projectile = data.damageSource?.damagingProjectile;
    if (!projectile?.isValid) return;

    const damage = projectile.getDynamicProperty("damage");
    if (damage === undefined || isNaN(damage)) return;

    const entity = data.hurtEntity;
    if (!entity?.isValid) return;

    const comp = entity.getComponent(EntityHealthComponent.componentId);
    if (!comp) return;

    const baseDamage = data.damage;
    const extraDamage = Math.max(0, baseDamage * (damage / 12));

    comp.setCurrentValue(comp.currentValue - extraDamage);
    projectile.remove();
});

world.afterEvents.itemReleaseUse.subscribe(({ source, itemStack, useDuration }) => {
    if (!source || !itemStack) return;
    for (const bow of bowData) {
        if (itemStack.typeId === bow.bowId) {
            bow.shoot(source, useDuration);
        }
    }
});
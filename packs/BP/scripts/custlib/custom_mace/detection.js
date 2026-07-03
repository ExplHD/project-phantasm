import { world, system, EquipmentSlot, EnchantmentTypes } from "@minecraft/server";
import * as Manager from "./manager.js";

// Your custom mace identifier
const CustomMaceItems = new Set([
    "ph:cruxshaper"
]);

function isCustomMace(item) {
    return item && CustomMaceItems.has(item?.typeId);
}

// Handle fall distance
const FallDistance = 1.5;
const HeavySoundFallDistance = 5.5;

// Handle range
const MaceSmashHitRange = 6;
const MaceSmashRadius = 5;

// Handle impulse
const SmashHorizontalImpulse = 0.25;
const SmashVerticalImpulse = 0.5;

// Handler sounds and particles
const SmashAirSound = "mace.smash_air";
const SmashGroundSound = "mace.smash_ground";
const SmashHeavyGroundSound = "mace.heavy_smash_ground";

// Wind burst constants
const WindBurstSound = "wind_charge.burst";
const WindBurstParticle = "minecraft:wind_explosion_emitter";
const WindBurstLevelImpulse = {
    1: 0.85,
    2: 1.25,
    3: 1.75
};

const recentSwingHit = new Set();
const playerFallData = new Map();

world.afterEvents.playerSwingStart.subscribe((event) => {
    const player = event.player;
    const inventory = player.getComponent("minecraft:inventory");
    const equippable = player.getComponent("minecraft:equippable");

    if (!inventory || !equippable) return;

    const container = inventory.container;
    const slotIndex = player.selectedSlotIndex;
    const item = equippable.getEquipment(EquipmentSlot.Mainhand);

    if (!isCustomMace(item)) return;

    // Removes wind burst to cancel the built in one
    const enchantable = item.getComponent("minecraft:enchantable");
    const windBurstEnchant = enchantable?.getEnchantment("wind_burst");
    const wbLevel = windBurstEnchant?.level ?? 0;

    if (wbLevel > 0) {
        enchantable.removeEnchantment("wind_burst");
        container.setItem(slotIndex, item);
    }

    // Checks for a slam
    const startY = playerFallData.get(player.id);
    const fallDistance = startY ? startY - player.location.y : 0;

    const entities = player.getEntitiesFromViewDirection({ maxDistance: MaceSmashHitRange });

    if (entities.length > 0 && fallDistance >= FallDistance) {
        const victim = entities[0].entity;
        if (victim && Manager.isValidTarget(victim)) {
            recentSwingHit.add(player.id);
            system.runTimeout(() => recentSwingHit.delete(player.id), 5);
            // Pass the wbLevel we stored so our custom math works
            executeMaceSlam(player, victim, fallDistance, item, wbLevel);
        }
    }

    // restores the wind burst enchantment
    system.run(() => {
        if (!player.isValid) return;

        const itemToRestore = container.getItem(slotIndex);
        if (isCustomMace(itemToRestore) && wbLevel > 0) {
            const enchantableRestore = itemToRestore.getComponent("minecraft:enchantable");
            const enchantType = EnchantmentTypes.get("wind_burst");

            if (enchantType) {
                enchantableRestore.addEnchantment({ type: enchantType, level: wbLevel });
                container.setItem(slotIndex, itemToRestore);
            }
        }
    });
});

world.afterEvents.entityHitEntity.subscribe((event) => {
    const { damagingEntity: attacker, hitEntity: victim } = event;

    // If the playerSwingStart event got the slam it stops
    if (recentSwingHit.has(attacker.id)) return;

    const item = attacker.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    if (!isCustomMace(item)) return;

    const startY = playerFallData.get(attacker.id);
    if (startY === undefined) return;

    const fallDistance = startY - attacker.location.y;
    if (fallDistance >= FallDistance) {
        executeMaceSlam(attacker, victim, fallDistance, item);
    }
});

// Executes the slam
function executeMaceSlam(attacker, victim, fallDistance, item, wbLevel = 0) {
    if (!attacker.isValid || !victim.isValid) return;

    // Reset fall damage
    attacker.getComponent("minecraft:fall_damage")?.setCurrentValue(0);

    if (wbLevel === 0) {
        attacker.clearVelocity();
        attacker.teleport({
            x: attacker.location.x,
            y: attacker.location.y + 0.5,
            z: attacker.location.z
        });
    }

    const soundLoc = victim.location;
    attacker.dimension.playSound(fallDistance > HeavySoundFallDistance ? SmashHeavyGroundSound : SmashGroundSound, soundLoc);

    const blockBelow1 = victim.dimension.getBlock({ x: victim.location.x, y: victim.location.y - 1, z: victim.location.z });
    const blockBelow2 = victim.dimension.getBlock({ x: victim.location.x, y: victim.location.y - 2, z: victim.location.z });

    const isNearGround = (blockBelow1 && !blockBelow1.isAir && !blockBelow1.isLiquid) ||
        (blockBelow2 && !blockBelow2.isAir && !blockBelow2.isLiquid);

    if (!attacker.isOnGround && !victim.isOnGround && !isNearGround) {
        // If the slam happened high in the air (no ground within 2 blocks)
        attacker.dimension.playSound(SmashAirSound, soundLoc);
        attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", soundLoc);
    } else {
        try {
            attacker.dimension.spawnEntity("ph:mace_slam", soundLoc);
            attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", soundLoc);
        } catch (e) { }
    }

    if (wbLevel > 0) {
        handleWindBurst(attacker, victim, soundLoc, wbLevel);
    } else {
        handleStandardSlam(attacker, victim, soundLoc);
    }

    // 4. Damage calculation
    const enchantable = item.getComponent("minecraft:enchantable");
    let dmg = fallDistance <= 3 ? fallDistance * 8 : (fallDistance <= 8 ? 24 + (fallDistance - 3) * 4 : 44 + (fallDistance - 8) * 2);
    const density = enchantable?.getEnchantment("density")?.level ?? 0;
    const totalDmg = Math.floor(dmg + (density * 1.0 * fallDistance));

    try {
        victim.applyDamage(totalDmg, { cause: "maceSmash", damagingEntity: attacker });
    } catch (e) { }

    playerFallData.delete(attacker.id);
}

function handleStandardSlam(attacker, victim, vLoc) {
    const nearby = attacker.dimension.getEntities({
        location: vLoc,
        maxDistance: MaceSmashRadius
    });

    for (const ent of nearby) {
        if (ent.id === attacker.id || ent.id === victim.id) continue;

        if (ent.isValid && Manager.isValidTarget(ent)) {
            const kbResist = Manager.getKnockbackMultiplier(ent);

            const dx = ent.location.x - vLoc.x;
            const dz = ent.location.z - vLoc.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;

            ent.applyImpulse({
                x: (dx / dist) * SmashHorizontalImpulse * kbResist,
                y: SmashVerticalImpulse * kbResist,
                z: (dz / dist) * SmashHorizontalImpulse * kbResist
            });
        }
    }
}

function handleWindBurst(attacker, victim, vLoc, level) {
    const vImpulse = WindBurstLevelImpulse[level] || 0.5;

    attacker.clearVelocity();
    attacker.applyImpulse({ x: 0, y: vImpulse, z: 0 });
    attacker.dimension.spawnParticle(WindBurstParticle, attacker.location);
    attacker.dimension.playSound(WindBurstSound, vLoc);

    const nearby = attacker.dimension.getEntities({
        location: vLoc,
        maxDistance: MaceSmashRadius
    });

    for (const ent of nearby) {
        if (!ent.isValid) continue;
        if (ent.id === attacker.id || ent.id === victim.id) continue;

        if (Manager.isValidTarget(ent)) {
            const kbResist = Manager.getKnockbackMultiplier(ent);
            const dx = ent.location.x - vLoc.x;
            const dz = ent.location.z - vLoc.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;

            ent.applyImpulse({
                x: (dx / dist) * (SmashHorizontalImpulse * level) * kbResist,
                y: SmashVerticalImpulse * kbResist,
                z: (dz / dist) * (SmashHorizontalImpulse * level) * kbResist
            });
        }
    }
}

// Fall Detection
// I wouldn't touch this code since these cancel the slam
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
        const isMace = isCustomMace(item);

        const blockAt = player.dimension.getBlock(player.location);
        const isInWeb = blockAt?.typeId === "minecraft:web";
        const isInvalid = player.isInWater || player.isClimbing || player.isGliding || player.isFlying || player.getEffect("minecraft:slow_falling") || player.getEffect("minecraft:levitation") || isInWeb;

        if (isMace && !player.isOnGround && !isInvalid) {
            const currentStoredY = playerFallData.get(player.id) || 0;
            if (player.location.y > currentStoredY) {
                playerFallData.set(player.id, player.location.y);
            }
        } else {
            playerFallData.delete(player.id);
        }
    }
}, 1);
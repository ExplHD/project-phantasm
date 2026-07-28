import { world, system, EquipmentSlot, Player, Entity, ItemStack, EntityDamageCause, EntityComponentTypes } from "@minecraft/server";
import * as Manager from "./manager";

// Your custom mace identifier
const CustomMaceItems: Set<string> = new Set([
    "ph:cruxshaper"
]);

function isCustomMace(item: ItemStack | undefined): boolean {
    return !!item && CustomMaceItems.has(item?.typeId);
}

// Handle fall distance
const FallDistance: number = 1.5;
const HeavySoundFallDistance: number = 5.5;

// Handle range
const MaceSmashHitRange: number = 6;
const MaceSmashRadius: number = 5;

// Handle impulse
const SmashHorizontalImpulse: number = 0.25;
const SmashVerticalImpulse: number = 0.5;

// Handler sounds and particles
const SmashAirSound: string = "mace.smash_air";
const SmashGroundSound: string = "mace.smash_ground";
const SmashHeavyGroundSound: string = "mace.heavy_smash_ground";

// Wind burst constants
const WindBurstSound: string = "wind_charge.burst";
const WindBurstParticle: string = "minecraft:wind_explosion_emitter";
const WindBurstLevelImpulse: { [key: number]: number } = {
    1: 1.1,
    2: 1.65,
    3: 2
};

const recentSwingHit: Set<string> = new Set();
const playerFallData: Map<string, number> = new Map();

// Executes the slam
function executeMaceSlam(attacker: Player, victim: Entity, fallDistance: number, item: ItemStack, wbLevel: number = 0, firstHit?: boolean): void {
    if (!attacker.isValid || !victim.isValid) return;

    system.run(() => {
        // Reset fall damage
        (attacker.getComponent("minecraft:fall_damage") as any)?.setCurrentValue(0);

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

        const isNearGround: boolean = (!!(blockBelow1 && !blockBelow1.isAir && !blockBelow1.isLiquid)) ||
            (!!(blockBelow2 && !blockBelow2.isAir && !blockBelow2.isLiquid));

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
        let dmg: number = fallDistance <= 3 ? fallDistance * 8 : (fallDistance <= 8 ? 24 + (fallDistance - 3) * 4 : 44 + (fallDistance - 8) * 2);
        const density: number = (enchantable?.getEnchantment("density")?.level ?? 0) as number;
        const totalDmg: number = Math.floor(dmg + (density * 1.0 * fallDistance));

        try {
            victim.applyDamage(totalDmg, { cause: EntityDamageCause.maceSmash, damagingEntity: attacker });
        } catch (e) { }

        playerFallData.delete(attacker.id);
    })
}

function handleStandardSlam(attacker: Player, victim: Entity, vLoc: { x: number; y: number; z: number }): void {
    const nearby = attacker.dimension.getEntities({
        location: vLoc,
        maxDistance: MaceSmashRadius
    });

    for (const ent of nearby) {
        if (ent.id === attacker.id || ent.id === victim.id) continue;

        if (ent.isValid && Manager.isValidTarget(ent)) {
            const kbResist: number = Manager.getKnockbackMultiplier(ent);

            const dx: number = ent.location.x - vLoc.x;
            const dz: number = ent.location.z - vLoc.z;
            const dist: number = Math.sqrt(dx * dx + dz * dz) || 1;

            ent.applyImpulse({
                x: (dx / dist) * SmashHorizontalImpulse * kbResist,
                y: SmashVerticalImpulse * kbResist,
                z: (dz / dist) * SmashHorizontalImpulse * kbResist
            });
        }
    }
}

function handleWindBurst(attacker: Player, victim: Entity, vLoc: { x: number; y: number; z: number }, level: number): void {
    const vImpulse: number = WindBurstLevelImpulse[level] || 0.5;

    attacker.clearVelocity();
    attacker.applyImpulse({ x: 0, y: vImpulse, z: 0 });

    const nearby = attacker.dimension.getEntities({
        location: vLoc,
        maxDistance: MaceSmashRadius
    });

    for (const ent of nearby) {
        if (!ent.isValid) continue;
        if (ent.id === attacker.id || ent.id === victim.id) continue;

        if (Manager.isValidTarget(ent)) {
            const kbResist: number = Manager.getKnockbackMultiplier(ent);
            const dx: number = ent.location.x - vLoc.x;
            const dz: number = ent.location.z - vLoc.z;
            const dist: number = Math.sqrt(dx * dx + dz * dz) || 1;

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
        const item: ItemStack | undefined = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
        const isMace: boolean = isCustomMace(item);

        const blockAt = player?.dimension?.getBlock(player.location);
        const isInWeb: boolean = blockAt?.typeId === "minecraft:web";
        const isInvalid: boolean = player.isInWater || player.isClimbing || player.isGliding || player.isFlying || !!player.getEffect("minecraft:slow_falling") || !!player.getEffect("minecraft:levitation") || isInWeb;

        if (isMace && !player.isOnGround && !isInvalid) {
            const currentStoredY: number = playerFallData.get(player.id) || 0;
            if (player.location.y > currentStoredY) {
                playerFallData.set(player.id, player.location.y);
            }
        } else {
            playerFallData.delete(player.id);
        }
    }
}, 1);

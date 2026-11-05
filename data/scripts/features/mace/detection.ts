import { world, system, EquipmentSlot, Player, Entity, ItemStack, EntityDamageCause, EntityHurtBeforeEvent, type Dimension, type Vector3 } from "@minecraft/server";
import * as Manager from "./manager";

const CustomMaceItems: Set<string> = new Set([
    "ph:cruxshaper"
]);

function isCustomMace(item: ItemStack | undefined): boolean {
    return !!item && CustomMaceItems.has(item?.typeId);
}

const FallDistance: number = 1.5;
const HeavySoundFallDistance: number = 5.5;

const MaceSmashRadius: number = 5;

const SmashHorizontalImpulse: number = 0.25;
const SmashVerticalImpulse: number = 0.5;

const SmashAirSound: string = "mace.smash_air";
const SmashGroundSound: string = "mace.smash_ground";
const SmashHeavyGroundSound: string = "mace.heavy_smash_ground";

const WindBurstLevelImpulse: { [key: number]: number } = {
    1: 1.1,
    2: 1.65,
    3: 2
};

const recentSwingHit: Set<string> = new Set();
const playerFallData: Map<string, number> = new Map();

export function onMaceHurt(event: EntityHurtBeforeEvent): void {
    const { damageSource, hurtEntity: victim } = event;

    if (damageSource.cause === EntityDamageCause.maceSmash) return;

    const attacker = damageSource.damagingEntity;
    if (!(attacker instanceof Player)) return;

    if (recentSwingHit.has(attacker.id)) return;

    const item = attacker.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    if (!item || !isCustomMace(item)) return;

    const startY = playerFallData.get(attacker.id);
    if (startY === undefined) return;

    const fallDistance = startY - attacker.location.y;
    if (fallDistance < FallDistance) return;

    const windBurst = item.getComponent("minecraft:enchantable")?.getEnchantment("wind_burst")?.level ?? 0;
    event.cancel = true;
    executeMaceSlam(attacker, victim, fallDistance, item, windBurst);
}

function solidAt(dimension: Dimension, location: Vector3): boolean {
    if (location.y < dimension.heightRange.min) return false;
    const block = dimension.getBlock(location);
    return !!block && !block.isAir && !block.isLiquid;
}

function executeMaceSlam(attacker: Player, victim: Entity, fallDistance: number, item: ItemStack, wbLevel: number = 0): void {
    if (!attacker.isValid || !victim.isValid) return;

    system.run(() => {
        if (!attacker.isValid || !victim.isValid) return;
        if (!victim.dimension.isChunkLoaded(victim.location)) return;

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

        const { x, y, z } = victim.location;
        const isNearGround: boolean = solidAt(victim.dimension, { x, y: y - 1, z }) || solidAt(victim.dimension, { x, y: y - 2, z });

        if (!attacker.isOnGround && !victim.isOnGround && !isNearGround) {
            attacker.dimension.playSound(SmashAirSound, soundLoc);
            attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", soundLoc);
        } else {
            attacker.dimension.spawnEntity("ph:mace_slam", soundLoc);
            attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", soundLoc);
        }

        if (wbLevel > 0) {
            handleWindBurst(attacker, victim, soundLoc, wbLevel);
        } else {
            handleStandardSlam(attacker, victim, soundLoc);
        }

        const enchantable = item.getComponent("minecraft:enchantable");
        const dmg: number = fallDistance <= 3 ? fallDistance * 8 : (fallDistance <= 8 ? 24 + (fallDistance - 3) * 4 : 44 + (fallDistance - 8) * 2);
        const density: number = (enchantable?.getEnchantment("density")?.level ?? 0) as number;
        const totalDmg: number = Math.floor(dmg + (density * 1.0 * fallDistance));

        if (victim.isValid) victim.applyDamage(totalDmg, { cause: EntityDamageCause.maceSmash, damagingEntity: attacker });

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

export function trackMaceFall(): void {
    for (const player of world.getAllPlayers()) {
        const item: ItemStack | undefined = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);

        const isFallingWithMace =
            isCustomMace(item) &&
            !player.isOnGround &&
            !player.isInWater &&
            !player.isClimbing &&
            !player.isGliding &&
            !player.isFlying &&
            !player.getEffect("minecraft:slow_falling") &&
            !player.getEffect("minecraft:levitation");

        if (isFallingWithMace && player.dimension?.getBlock(player.location)?.typeId === "minecraft:web") {
            playerFallData.delete(player.id);
            continue;
        }

        if (isFallingWithMace) {
            const currentStoredY: number = playerFallData.get(player.id) || 0;
            if (player.location.y > currentStoredY) {
                playerFallData.set(player.id, player.location.y);
            }
        } else {
            playerFallData.delete(player.id);
        }
    }
}

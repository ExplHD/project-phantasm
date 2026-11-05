import { world, system, Player, Block, EquipmentSlot, ItemStack, EntityDamageCause, type EntityHealthComponent, type EntityHurtBeforeEvent } from '@minecraft/server'
import { setScore } from '../core/scoreboard'
import { runUntilMoved } from '../core/player'
import { applyDurabilityDamage } from '../core/items'
import { getItemRarity } from '../core/itemRarity'
import { LEGENDARY_TIER } from '../core/constants'

export function dashRuntime(player: Player): void {
    const scoreboard_dash = world.scoreboard.getObjective("dash_cd");
    if (!scoreboard_dash || (scoreboard_dash.getScore(player) ?? 0) > 0) return;
    if (player.getDynamicProperty("ph:dash_unlock") == 0) return;

    const dashLevel = player.getDynamicProperty("ph:dash_level");
    if (dashLevel == undefined || (dashLevel != 1 && dashLevel != 2)) return;

    const equipmentTag = player?.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.getTags();
    if (equipmentTag?.includes("minecraft:is_sword") || equipmentTag?.includes("minecraft:is_tool")) return;

    const view = player.getViewDirection();

    if (dashLevel == 1) {
        player.applyKnockback({ x: view.x * 3, z: view.z * 3 }, 0.2)
        setScore(player, 'dash_cd', 60);
        player.playSound("player.dash", {
            volume: 1
        });
        player.dimension.spawnParticle("ph:dash_particle", player.location);
        if (!player.isGliding) {
            player.playAnimation("animation.player_extend.dash", {
                stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
            });
        }
        return;
    }

    player.applyKnockback({ x: view.x * 5, z: view.z * 5 }, 0.3)
    setScore(player, 'dash_cd', 60);
    player.playSound("mob.enderdragon.flap", {
        volume: 0.75
    });
    player.dimension.spawnParticle("ph:copper_mech_explosion", player.location);
    if (!player.isGliding) {
        player.playAnimation("animation.player_extend.dash", {
            stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
        });
    }
}

// Wind Plunge, merged with the Luna plunge attack: short hang in the air, straight
// dive, area hit on landing. Fall damage is cancelled from the start of the plunge
// until NO_FALL_GRACE_TICKS after landing (onPlungeFallHurt), the fall damage event
// can arrive before or after tickPlunges sees the landing.
const PLUNGE_MIN_HEIGHT = 10;
const PLUNGE_RADIUS = 6;
const PLUNGE_DAMAGE = 10;
const PLUNGE_HANG_TICKS = 4; // matches the 0.2s windup of animation.player_extend.plunge_attack
const PLUNGE_DIVE_SPEED = 1.6;
const PLUNGE_MAX_TICKS = 100;
const NO_FALL_GRACE_TICKS = 5;
const PLUNGE_ANIM_OPTS = { controller: "ph_plunge", blendOutTime: 0.15 };

const plunging = new Map<string, number>(); // player id -> plunge start tick
const noFallUntil = new Map<string, number>(); // player id -> last tick without fall damage

function heightAboveGround(player: Player): number {
    try {
        const hit = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, {
            maxDistance: 64,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        return hit ? player.location.y - (hit.block.location.y + hit.faceLocation.y) : Infinity;
    } catch {
        return 0;
    }
}

export function isPlunging(player: Player): boolean {
    return plunging.has(player.id);
}

export function windPlungeRuntime(player: Player): boolean {
    if (player.getDynamicProperty("ph:plunge_unlock") !== true) return false;
    if (plunging.has(player.id)) return false;
    if (!player.isFalling || player.isOnGround || player.isInWater || player.isGliding || player.isFlying) return false;
    if (heightAboveGround(player) <= PLUNGE_MIN_HEIGHT) return false;

    plunging.set(player.id, system.currentTick);
    noFallUntil.set(player.id, Infinity);
    player.playAnimation("animation.player_extend.plunge_attack", PLUNGE_ANIM_OPTS);
    player.dimension.spawnParticle("minecraft:wind_explosion_emitter", player.location);
    player.dimension.playSound("wind_charge.burst", player.location);
    player.playSound("mob.enderdragon.flap", { volume: 0.5, pitch: 1.8 });
    return true;
}

function plungeImpact(player: Player): void {
    const dimension = player.dimension;
    const location = player.location;
    player.playAnimation("animation.player_extend.plunge_land", PLUNGE_ANIM_OPTS);
    try {
        dimension.playSound("random.explode", location, { volume: 0.5, pitch: 1.6 });
        dimension.playSound("dig.stone", location, { volume: 1, pitch: 0.6 });
        dimension.spawnParticle("minecraft:breeze_wind_explosion_emitter", location);
        dimension.spawnParticle("ph:plunge_shockwave", location);
        dimension.spawnParticle("minecraft:critical_hit_emitter", { x: location.x, y: location.y + 0.2, z: location.z });
        player.runCommand("camerashake add @s 0.25 0.15 positional");
    } catch { }

    // other players only take the hit when the pvp gamerule is on
    let pvp = true;
    try {
        pvp = world.gameRules.pvp;
    } catch { }
    const excludeTypes = ["minecraft:item", "minecraft:armor_stand"];
    if (!pvp) excludeTypes.push("minecraft:player");

    const targets = dimension.getEntities({
        location,
        maxDistance: PLUNGE_RADIUS,
        excludeTypes,
        excludeFamilies: ["inanimate"]
    });
    for (const target of targets) {
        if (target.id === player.id) continue;
        try {
            target.applyDamage(PLUNGE_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
        } catch { }
    }
}

export function tickPlunges(): void {
    const now = system.currentTick;
    for (const [id, start] of plunging) {
        const player = world.getEntity(id) as Player | undefined;
        if (!player?.isValid) {
            plunging.delete(id);
            noFallUntil.delete(id);
            continue;
        }

        const elapsedTicks = now - start;
        if (player.isOnGround || player.isInWater || elapsedTicks > PLUNGE_MAX_TICKS) {
            plunging.delete(id);
            noFallUntil.set(id, now + NO_FALL_GRACE_TICKS);
            if (player.isOnGround) plungeImpact(player);
            else player.playAnimation("animation.player_extend.plunge_land", PLUNGE_ANIM_OPTS);
            continue;
        }

        try {
            if (elapsedTicks < PLUNGE_HANG_TICKS) player.applyKnockback({ x: 0, z: 0 }, 0.04);
            else player.applyKnockback({ x: 0, z: 0 }, -PLUNGE_DIVE_SPEED);
        } catch { }
    }
}

export function onPlungeFallHurt(event: EntityHurtBeforeEvent): void {
    if (event.damageSource.cause !== EntityDamageCause.fall) return;
    const id = event.hurtEntity.id;
    const until = noFallUntil.get(id);
    if (until === undefined) return;
    if (system.currentTick <= until) event.cancel = true;
    else noFallUntil.delete(id);
}

export function clearPlungeState(playerId: string): void {
    plunging.delete(playerId);
    noFallUntil.delete(playerId);
}

function strippingSound(typeId: string): string | undefined {
    if (typeId === 'minecraft:cherry_log') return 'step.cherry_wood';
    if (typeId.includes('log')) return 'use.wood';
    if (typeId.includes('stem')) return 'use.stem';
    if (typeId.includes('bamboo')) return 'step.bamboo_wood';
    return undefined;
}

export function vanillaBlockInteractFix(player: Player, item: ItemStack | undefined, block: Block): void {
    if (!item || !item.hasComponent(`ph:vanilla_tool_fix`)) return;

    const tags = block.getTags();
    const typeId = block.typeId;

    if (item.hasTag('minecraft:is_axe')) {
        system.runTimeout(() => {
            if (!player.isValid || !block.isValid) return;
            if (typeId.includes('stripped') || !block.typeId.includes('stripped')) return;

            const materialSound = strippingSound(typeId);
            if (!materialSound) return;

            player.dimension.playSound(materialSound, block.center(), { volume: 1, pitch: 0.8 });

            applyDurabilityDamage(player);
        }, 1)
    }
    else if (item.hasTag('minecraft:is_hoe')) {
        system.runTimeout(() => {
            if (!player.isValid || !block.isValid) return;
            const isTillable = tags.includes('grass') || typeId === 'minecraft:dirt_with_roots';
            const hasBlockAbove = block.above()?.typeId !== 'minecraft:air';
            if (!isTillable || hasBlockAbove) return;

            player.dimension.playSound('use.gravel', block.center(), { volume: 1, pitch: 0.8 });

            applyDurabilityDamage(player);
        }, 1)
    }
    else if (item.hasTag('minecraft:is_shovel')) {
        const dirtPathable = [
            "minecraft:dirt",
            "minecraft:dirt_with_roots",
            "minecraft:podzol",
            "minecraft:mycellium",
            "minecraft:coarse_dirt"
        ]
        const isCoarsable = dirtPathable.includes(block.typeId) || block.typeId === 'minecraft:grass_block';
        const hasBlockAbove = block.above()?.typeId !== 'minecraft:air';

        if (!isCoarsable || hasBlockAbove) return;

        system.run(() => {
            if (!player.isValid) return;
            player.dimension.playSound('use.grass', block.center(), { volume: 1, pitch: 0.8 });

            applyDurabilityDamage(player);
        })
    }
}

const PARRY_ITEMS = new Set([
    "minecraft:wooden_sword",
    "minecraft:stone_sword",
    "minecraft:copper_sword",
    "minecraft:iron_sword",
    "minecraft:golden_sword",
    "minecraft:diamond_sword",
    "minecraft:netherite_sword",
    "ph:prismatic_sword",
    "ph:xeon_plasm_sword"
]);

export function parryRuntime(source: Player, itemStack: ItemStack | undefined): void {
    if (!itemStack?.typeId || !PARRY_ITEMS.has(itemStack.typeId)) return;
    if (source.hasTag("parried")) return;

    source.playAnimation("animation.player_extend.parry");
    source.dimension.spawnParticle("ph:parry_prepare", source.location);
    source.dimension.playSound("item.spear.use", source.location);
    source.addTag("parried");
    source.inputPermissions.setPermissionCategory(2, false);
    applyDurabilityDamage(source, { damage: 1 });
    system.runTimeout(() => {
        if (!source.isValid) return;
        if (source.hasTag("parried")) source.removeTag("parried");
        source.inputPermissions.setPermissionCategory(2, true);
    }, 6)
}

const CUSTOM_WEAPON_TAGS = ["minecraft:is_sword", "minecraft:is_axe", "minecraft:is_spear"];
const CUSTOM_PARRY_TICKS = 8;

function isEpicCustomWeapon(item: ItemStack | undefined): boolean {
    if (!item?.typeId.startsWith("ph:")) return false;
    const rarity = getItemRarity(item);
    if (rarity !== "epic" && rarity !== "legendary") return false;
    return (LEGENDARY_TIER as readonly string[]).includes(item.typeId) || CUSTOM_WEAPON_TAGS.some(tag => item.hasTag(tag));
}

// Parry for Epic+ custom weapons, triggered by the parry control (ph:parry_control)
export function customWeaponParry(player: Player): void {
    const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    if (!isEpicCustomWeapon(item)) return;
    if (player.hasTag("parried") || plunging.has(player.id)) return;

    player.playAnimation("animation.player_extend.parry");
    player.dimension.spawnParticle("ph:parry_prepare", player.location);
    player.dimension.playSound("item.spear.use", player.location);
    player.addTag("parried");
    system.runTimeout(() => {
        if (player.isValid && player.hasTag("parried")) player.removeTag("parried");
    }, CUSTOM_PARRY_TICKS);
}

export function startBetterMending(source: Player, itemStack: ItemStack | undefined): void {
	if (!source.isSneaking || !itemStack) return;
    const enchantment = itemStack?.getComponent("minecraft:enchantable")?.getEnchantment("mending");
    if (itemStack.hasTag("minecraft:is_tools") || itemStack.hasTag("minecraft:is_armor")) return;
    if (!enchantment) return;
    source.playSound("random.anvil_use");

    const runBetterMending = system.runInterval(() => {
        if (!source.isValid) {
            system.clearRun(runBetterMending);
            return;
        }

        const equippable = source.getComponent("minecraft:equippable");
        const currentItem = equippable?.getEquipment(EquipmentSlot.Mainhand);
        const durability = currentItem?.getComponent("minecraft:durability");
        const experience = source.getTotalXp();

        if (!equippable || !currentItem || !durability || durability.damage <= 0 || experience <= 0) {
            system.clearRun(runBetterMending);
            return;
        }

        const repairAmount = Math.min(durability.damage, 1);
        durability.damage -= repairAmount;
        equippable.setEquipment(EquipmentSlot.Mainhand, currentItem);

        source.addExperience(-2);
        if (source.xpEarnedAtCurrentLevel <= 2) {
            source.addExperience(source.totalXpNeededForNextLevel - 1);
            source.addLevels(-1);
        }
        source.playSound("random.orb", {
            pitch: Math.min(0.8, Math.random() + 0.5),
            volume: 0.5
        });
    }, 1);
}

export function javaSaturationRegen(player: Player): void {
    const health = player.getComponent("minecraft:health");
    if (!health) return;

    const playerHealthLevel = Number(player.getDynamicProperty("ph:health_level"));

    if (playerHealthLevel >= 1 && playerHealthLevel <= 3) {
        const maxAllowedHealth = 24 + (playerHealthLevel * 12);
        const maxHealth = health.effectiveMax;
        if (maxHealth < maxAllowedHealth) {
            const wantedAmplifier = 3 * playerHealthLevel;
            const active = player.getEffect("health_boost");
            if (!active || active.amplifier !== wantedAmplifier) {
                player.runCommand(`effect @s health_boost infinite ${wantedAmplifier} true`);
            }
        }
    }

    const hunger = player.getComponent("minecraft:player.hunger");
    const saturation = player.getComponent("minecraft:player.saturation");
    if (!hunger || !saturation) return;

    if (
        hunger.currentValue === 20 &&
        saturation.currentValue > 0 &&
        health.currentValue < health.effectiveMax
    ) {
        const healAmount = 1;
        const satCost = 1;

        health.setCurrentValue(
            Math.min(health.effectiveMax, health.currentValue + healAmount)
        );

        saturation.setCurrentValue(
            Math.max(0, saturation.currentValue - satCost)
        );
    }
}

const ABSORPTION_BASE = 8;
const ABSORPTION_PER_LEVEL = 2;

const absorptionPool = new Map<string, { amount: number; max: number }>();

function absorptionFor(amplifier: number): number {
    return ABSORPTION_BASE + ABSORPTION_PER_LEVEL * amplifier;
}

export function onAbsorptionAdded(player: Player, amplifier: number): void {
    const max = absorptionFor(amplifier);
    absorptionPool.set(player.id, { amount: max, max });
    healthBarRuntime(player, "absorptionChanged");
}

export function onAbsorptionHurt(player: Player, damage: number): void {
    const pool = absorptionPool.get(player.id);
    if (!pool || pool.amount <= 0) return;
    pool.amount = Math.max(0, pool.amount - damage);

    healthBarRuntime(player, "absorptionChanged");
}

export function syncAbsorption(player: Player): void {
    const effect = player.getEffect("absorption");
    const tracked = absorptionPool.has(player.id);
    if (effect && !tracked) {
        onAbsorptionAdded(player, effect.amplifier);
    } else if (!effect && tracked) {
        absorptionPool.delete(player.id);
        healthBarRuntime(player, "absorptionChanged");
    }
}

export function clearAbsorption(player: Player): void {
    absorptionPool.delete(player.id);
}

export function healthBarDisplay(player: Player, health: EntityHealthComponent, totalArmor: number | undefined, maxHealth: number): void {
    const pool = absorptionPool.get(player.id);
    const absorbing = pool !== undefined && pool.amount > 0;
    const current = health.currentValue + (absorbing ? pool.amount : 0);
    const max = maxHealth + (absorbing ? pool.max : 0);
    const scaled = (current / max) * 100;
    const color = absorbing ? "§e" : "";
    player.onScreenDisplay.setTitle(
        `bar0:${color}${Math.min(100, Math.max(0, Math.floor(scaled)))}%% healthind:${Math.floor(current)}/${max}${totalArmor}`,
        { fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 }
    );
}

export function healthBarRuntime(player: Player, eventType: string, beforeItemStack?: ItemStack, afterItemStack?: ItemStack): void {
    if (player.typeId !== "minecraft:player") return;
    const health = player?.getComponent("minecraft:health");
    const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
    const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;

    if (!health || !maxHealth) return;

    if (eventType == "healthChanged" || eventType == "absorptionChanged") {
        healthBarDisplay(player, health, totalArmor, maxHealth)
    }

    if (eventType == "inventoryItemChanged") {
        if (!beforeItemStack?.hasTag("minecraft:is_armor") && !afterItemStack?.hasTag("minecraft:is_armor")) return;
        healthBarDisplay(player, health, totalArmor, maxHealth)
    }

    if (eventType == "dimensionChanged") {
        runUntilMoved(player, 10, () => {
            if (!player.isValid) return;
            healthBarDisplay(player, health, totalArmor, maxHealth)
        })
    }

    if (eventType == "gamemodeChanged") {
        const gameMode = player.getGameMode();
        if (gameMode == "Creative" || gameMode == "Spectator") return;
		healthBarDisplay(player, health, totalArmor, maxHealth);
    }
}

export const specifiedFamilityAndSpeed = [
    {
        type_family: "animated_tp",
        speed: 1
    },
    {
        type_family: "animated_tp2",
        speed: 0.2
    },
    {
        type_family: "animated_tp3",
        speed: 2
    },
    {
        type_family: "animated_tp4",
        speed: 0.6
    }
]

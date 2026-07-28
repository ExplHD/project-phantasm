import { world, system, ItemStack, BlockVolume, Player, Block, Entity, Direction, EquipmentSlot } from '@minecraft/server'
import * as Helper from "./main"

// =========================================================================================================
// FUNCTION HELPER
// =========================================================================================================

// Passive Dash (triggered by playerButtonInput)
export function dashRuntime(player: Player): void {
    const scoreboard_dash = world.scoreboard.getObjective("dash_cd");
    const equipmentTag = player?.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.getTags()
    if (!player.isFalling || !scoreboard_dash || (scoreboard_dash?.getScore(player) ?? 0) > 0 || player.getDynamicProperty("ph:dash_unlock") == 0 || player.getDynamicProperty("ph:dash_level") == undefined || equipmentTag?.includes("minecraft:is_sword") || equipmentTag?.includes("minecraft:is_tool")) return;
    if (player.getDynamicProperty("ph:dash_level") == 1) {
        player.applyKnockback({ x: player.getViewDirection().x * 3, z: player.getViewDirection().z * 3 }, 0.2)
        Helper.setScore(player, 'dash_cd', 60);
        player.playSound("player.dash", {
            volume: 1
        });
        player.dimension.spawnParticle("ph:dash_particle", player.location);
        if (!player.isGliding) {
            player.playAnimation("animation.player_extend.dash", {
                stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
            });
        }
    }
    if (player.getDynamicProperty("ph:dash_level") == 2) {
        player.applyKnockback({ x: player.getViewDirection().x * 5, z: player.getViewDirection().z * 5 }, 0.3)
        Helper.setScore(player, 'dash_cd', 60);
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
}

// Wind Plunge Runtime (triggered by playerButtonInput)
export function windPlungeRuntime(player: Player): void {
    if (!player.isFalling || player.getDynamicProperty("ph:plunge_unlock") == false || player.getDynamicProperty("ph:plunge_unlock") == undefined) return;

    let isHighEnough = true;
    const { x, y, z } = player.location;
    const checkHeights = [1, 2, 3, 4, 6, 8, 10]

    for (const i of checkHeights) {
        const block = player.dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y) - i,
            z: Math.floor(z)
        });

        if (block && block.typeId !== "minecraft:air") {
            isHighEnough = false;
            break;
        }
    }

    if (!isHighEnough) return;
    if (player.hasTag('windPlunge')) return;

    function impact(): void {
        if (!player.isValid || !player.getComponent("minecraft:health")) return;

        if (player.hasTag("windPlunge")) {
            player.removeEffect("resistance");
            player.dimension.spawnParticle("minecraft:breeze_wind_explosion_emitter", player.location)
            player.runCommand("damage @e[r=6,rm=0.1] 10 entity_explosion entity @s")
            player.dimension.playSound("random.explode", player.location);
            player.removeTag("windPlunge");
        }
    }

    const runInterval = system.runInterval(() => {
        if (!player.isOnGround) return;
        system.run(impact);
        system.clearRun(runInterval);
    }, 2)

    player.applyKnockback({ x: 0, z: 0 }, -2);
    player.dimension.spawnParticle("minecraft:wind_explosion_emitter", player.location);
    player.playAnimation("animation.player_extend.plunge", {
        stopExpression: "query.is_on_ground"
    });
    player.dimension.playSound("wind_charge.burst", player.location);
    player.addTag("windPlunge");
    player.addEffect("resistance", 20000000, {
        amplifier: 3,
        showParticles: false
    })
}

// USED FOR FIXING VANILLA TOOLS BLOCK INTERACTION
export function vanillaBlockInteractFix(player: Player, item: any, block: Block): void {
    if (!item || !item.hasComponent(`ph:vanilla_tool_fix`)) return;

    const tags = block.getTags();
    const typeId = block.typeId;

    if (item.hasTag('minecraft:is_axe')) {
        system.runTimeout(() => {
            if (typeId.includes('stripped') || !block.typeId.includes('stripped')) return;

            let materialSound = '';
            if (typeId === 'minecraft:cherry_log') materialSound = 'step.cherry_wood';
            else if (typeId.includes('log')) materialSound = 'use.wood';
            else if (typeId.includes('stem')) materialSound = 'use.stem';
            else if (typeId.includes('bamboo')) materialSound = 'step.bamboo_wood';

            if (!materialSound) return;

            player.dimension.playSound(materialSound, block.center(), { volume: 1, pitch: 0.8 });

            Helper.applyDurabilityDamage(player);
        }, 1)
    }
    else if (item.hasTag('minecraft:is_hoe')) {
        system.runTimeout(() => {
            const isTillable = tags.includes('grass') || typeId === 'minecraft:dirt_with_roots';
            const hasBlockAbove = block.above()?.typeId !== 'minecraft:air';
            if (!isTillable || hasBlockAbove) return;

            player.dimension.playSound('use.gravel', block.center(), { volume: 1, pitch: 0.8 });

            Helper.applyDurabilityDamage(player);
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
            player.dimension.playSound('use.grass', block.center(), { volume: 1, pitch: 0.8 });

            Helper.applyDurabilityDamage(player);
        })
    }
}

// Parry Function Runtime!
export function parryRuntime(source: Player, itemStack: any): void {
    const itemList = [
        "minecraft:wooden_sword",
        "minecraft:stone_sword",
        "minecraft:copper_sword",
        "minecraft:iron_sword",
        "minecraft:golden_sword",
        "minecraft:diamond_sword",
        "minecraft:netherite_sword",
        "ph:prismatic_sword"
    ]

    for (const item of itemList) {
        if (itemStack?.typeId == item && !source.hasTag("parried")) {
            const durability = itemStack?.getComponent("minecraft:durability");
            source.playAnimation("animation.player_extend.parry");
            source.dimension.spawnParticle("ph:parry_prepare", source.location);
            source.dimension.playSound("item.spear.use", source.location);
            source.addTag("parried");
            source.inputPermissions.setPermissionCategory(2, false);
            Helper.applyDurabilityDamage(source, { damage: 1 });
            system.runTimeout(() => {
                if (source?.hasTag("parried")) source.removeTag("parried");
                source.inputPermissions.setPermissionCategory(2, true);
            }, 6) // 200ms
        }
    }
}

// Better Mending Aplication
let runBetterMending: number = Number();

export function startBetterMending(source: Player, itemStack: any): void {
	if (!source.isSneaking) return;
    const enchantment = itemStack?.getComponent("minecraft:enchantable")?.getEnchantment("mending");
    if (itemStack.hasTag("minecraft:is_tools") || itemStack.hasTag("minecraft:is_armor")) return;
    if (!enchantment) return;
    source.playSound("random.anvil_use");

    const runBetterMending = system.runInterval(() => {
        try {
            const equippable = source.getComponent("minecraft:equippable");
            const currentItem = equippable?.getEquipment(EquipmentSlot.Mainhand);
            const durability = currentItem?.getComponent("minecraft:durability");
            const experience = source.getTotalXp();

            if (!currentItem || !durability || durability.damage <= 0 || experience <= 0) {
                system.clearRun(runBetterMending);
                return;
            }

            // Real repair, 
            const repairAmount = Math.min(durability.damage, 1);
            durability.damage -= repairAmount;
            equippable?.setEquipment(EquipmentSlot.Mainhand, currentItem);

            source.addExperience(-2);
            if (source.xpEarnedAtCurrentLevel <= 2) {
                source.addExperience(source.totalXpNeededForNextLevel - 1);
                source.addLevels(-1);
            }
            source.playSound("random.orb", {
                pitch: Math.min(0.8, Math.random() + 0.5),
                volume: 0.5
            })
        } catch (error) {
            console.warn(`betterMending error untuk ${source.name}: ${error}`);
            system.clearRun(runBetterMending);
        }
    }, 1);
}

// Java Saturation Regeneration
export function javaSaturationRegen(player: Player): void {
    const health = player.getComponent("minecraft:health");
    const hunger = player.getComponent("minecraft:player.hunger");
    const saturation = player.getComponent("minecraft:player.saturation");
    const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
    const playerHealthLevel = Number(player?.getDynamicProperty("ph:health_level"));

    if (playerHealthLevel >= 1 && playerHealthLevel <= 3) {
        const maxAllowedHealth = 24 + (playerHealthLevel * 12);
        if (maxHealth && maxHealth < maxAllowedHealth) {
            player.runCommand(`effect @s health_boost infinite ${3 * playerHealthLevel} true`);
        }
    }

    if (!health || !hunger || !saturation) return;

    // kondisi regen (kayak Java)
    if (
        hunger.currentValue === 20 &&
        saturation.currentValue > 0 &&
        health.currentValue < health.effectiveMax
    ) {
        const healAmount = 1;
        const satCost = 1;

        // heal player
        health.setCurrentValue(
            Math.min(health.effectiveMax, health.currentValue + healAmount)
        );

        // kurangi saturation (anti out of bound)
        saturation.setCurrentValue(
            Math.max(0, saturation.currentValue - satCost)
        );
    }
}

export function healthBarDisplay(player: Player, health: any, totalArmor: any, maxHealth: number): void {
    let scaled = (health.currentValue / maxHealth) * 100;
    player.runCommand(`title @s title bar0:${Math.min(100, Math.max(0, Math.floor(scaled)))}%% healthind:${Math.floor(health.currentValue)}/${maxHealth} ${totalArmor}`)
}

// Health Bar Runtime
export function healthBarRuntime(player: Player, eventType: string, beforeItemStack?: any, afterItemStack?: any): void {
    const health = player?.getComponent("minecraft:health");
    const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
    const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;

    if (!health || !maxHealth) return;

    if (eventType == "healthChanged") {
        healthBarDisplay(player, health, totalArmor, maxHealth)
    }

    if (eventType == "inventoryItemChanged") {
        if (!beforeItemStack?.hasTag("minecraft:is_armor") && !afterItemStack?.hasTag("minecraft:is_armor")) return;
        healthBarDisplay(player, health, totalArmor, maxHealth)
    }

    if (eventType == "dimensionChanged") {
        Helper.runUntilMoved(player, 10, () => {
            healthBarDisplay(player, health, totalArmor, maxHealth)
        })
    }

    if (eventType == "gamemodeChanged") {
        const gameMode = player.getGameMode();
        if (gameMode == "Creative" || gameMode == "Spectator") return;
		healthBarDisplay(player, health, totalArmor, maxHealth);
    }
}

// =========================================================================================================
// CONFIGURATIONS
// =========================================================================================================

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

import { world, system, CustomCommandParamType, CommandPermissionLevel } from '@minecraft/server'
import { setScore, getScore } from 'main'

system.beforeEvents.startup.subscribe((initEvent) => {
    initEvent.itemComponentRegistry.registerCustomComponent("ph:charge_passive", {
        onHitEntity(e) {
            const hitEntity = e.hitEntity
            const source = e.attackingEntity
            const itemStack = e.itemStack

            if (itemStack.typeId === "ph:charged_copper_axe") {
                system.runTimeout(() => {
                    if (getScore(source, "charged_copper_axe") == 100) {
                        hitEntity.runCommand('summon lightning_bolt')
                    } let calculatedDamage = 10 + (getScore(source, "charged_copper_axe") / 10)
                    hitEntity.applyDamage(calculatedDamage)
                    setScore(source, "charged_copper_axe", 0)
                }, 3)
            }
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:time_polarizer", {
        onUse(e) {
            const source = e.source;
            if (source.isSneaking) {
                source.runCommand(`effect @e[r=8,rm=0.1] slowness 22 1 true`);
                source.runCommand(`effect @e[r=8,rm=0.1] slow_falling 22 1 true`);
                source.dimension.spawnParticle("ph:time_polarizer_slow_zone", source.location);
                return;
            }
            source.addEffect("speed", 500, {
                amplifier: 2
            })
            source.dimension.spawnParticle("ph:time_polarizer_speed", { x: source.location.x, y: source.location.y + 0.4, z: source.location.z })
            source.startItemCooldown("time_polarizer", 600)
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:dash", {
        onUse({ source, itemStack }, { params }) {
            const inventory = source?.getComponent("inventory")?.container;
            const item = inventory?.getItem(source.selectedSlotIndex);
            const durability = item?.getComponent("durability");
            const unbreaking = item?.getComponent("enchantable")?.getEnchantment("unbreaking")?.level ?? 0;
            const cooldownCategory = item?.getComponent("cooldown")?.cooldownCategory;

            const horizontalDashStrength = params.horizontal_dash_strength ?? 0;
            const verticalDashStrength = params.vertical_dash_strength ?? 0;
            const dashDirection = params.dashDirection ?? "view_direction";
            const soundEffect = params.sound_effect ?? "random.explode";
            const durabilityDamage = params.durability_damage ?? 0;
            const particleEffect = params.particle_effect ?? "minecraft:critical_hit_emitter";

            if (dashDirection == "view_direction") {
                source.applyKnockback({ x: source.getViewDirection().x * horizontalDashStrength, z: source.getViewDirection().z * horizontalDashStrength }, verticalDashStrength);
                source.dimension.playSound(soundEffect, source.location);
                source.dimension.spawnParticle(particleEffect, source.location);
                if (cooldownCategory) source.startItemCooldown(cooldownCategory, 20);

            } else if (dashDirection == "velocity") {
                source.applyKnockback({ x: source.getVelocity().x * horizontalDashStrength, z: source.getVelocity().z * horizontalDashStrength }, verticalDashStrength);
                source.dimension.playSound(soundEffect, source.location);
                source.dimension.spawnParticle(particleEffect, source.location);
                if (cooldownCategory) source.startItemCooldown(cooldownCategory, 20);
            }
            if (!durability) return;
            const unbreakingChance = unbreaking * 25;
            const randomChance = Math.floor(Math.random() * 101);
            if (randomChance <= unbreakingChance) return;
            if (durability.damage == durability.maxDurability) {
                inventory.setItem(source.selectedSlotIndex, undefined);
                source.playSound("random.break");
                return;
            }
            durability.damage += durabilityDamage;
            inventory.setItem(source.selectedSlotIndex, item);
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:treasure_bag", {
        onUse({ source }, { params }) {
            const inventory = source.getComponent("inventory").container;
            const loot = params.loot ?? "loot_tables/empty";
            inventory.setItem(source.selectedSlotIndex, undefined)
            source.runCommand(`loot give @s loot "${loot}"`)
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:food_effects", {
        onConsume({ source, itemStack }) {
            const tags = itemStack.getTags()
            for (const tag of tags) {
                if (tag.startsWith("ph:food_effects-")) {
                    const val = tag.split("-");
                    source.addEffect(val[1], parseFloat(val[2]), {
                        amplifier: parseFloat(val[3])
                    })
                }
            }
        }
    })

    initEvent.blockComponentRegistry.registerCustomComponent("ph:boss_summon", {
        onPlayerInteract({ player, block, faceLocation }) {
            // Blocks Custom Components Value
            const boss = block.getComponent("ph:boss_summon").customComponentParameters.params.boss;
            const bargaining_item = block.getComponent("ph:boss_summon").customComponentParameters.params.bargaining_item;
            let bargaining_item_amount = block.getComponent("ph:boss_summon").customComponentParameters.params.bargaining_item_amount;
            const message = block.getComponent("ph:boss_summon").customComponentParameters.params.message;

            // Player's component?
            const mainhand = player.getComponent("equippable").getEquipment("Mainhand");

            if (!bargaining_item_amount) bargaining_item_amount = 1;
            // Runtime Events
            if (mainhand.typeId === bargaining_item && mainhand.amount >= bargaining_item_amount) {
                block.dimension.spawnEntity(boss, { x: block.center().x, y: block.center().y, z: block.center().z })
                block.dimension.playSound("custom_sfx.boss_summoned", block.location)
                player.sendMessage(message)
            }
        }
    })
})
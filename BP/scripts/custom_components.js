import { world, system, CustomCommandParamType, CommandPermissionLevel, CustomCommandStatus, MolangVariableMap, EquipmentSlot, ItemStack, BlockType } from '@minecraft/server'
import { setScore, getScore, addScore, removeScore, applyDurabilityDamage } from 'main'
import { Forms } from 'formsGenerator'
import { skillUnlock, propertiesCheck } from 'forms/skillUnlock'

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
        },
        onUse(e) {
            const player = e.source;
            player.startItemCooldown("charged_copper_axe", 120);
            applyDurabilityDamage(player, { damage: 36 });
            system.run(() => {
                player.playAnimation("animation.charged_copper_axe.attack_3", player.location);
                system.runTimeout(() => {
                    player.dimension.playSound("weapon_slash.slash_heavy", player.location);
                    player.dimension.spawnParticle("ph:lightning_flash", player.location);
                    player.dimension.spawnParticle("ph:lightning_sparks", player.location);
                    player.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=4] 18 entity_attack entity "${player.name}"`);
                    player.runCommand('summon lightning_bolt ^^^5 ~ 0');
                    player.runCommand('summon lightning_bolt ^^^10 ~ 0');
                    player.runCommand('particle ph:lightning_sparks ^^^5');
                    player.runCommand('particle ph:lightning_sparks ^^^10');
                }, 8)
            })
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
            const cooldownCategory = itemStack?.getComponent("cooldown")?.cooldownCategory;

            const horizontalDashStrength = params.horizontal_dash_strength ?? 0;
            const verticalDashStrength = params.vertical_dash_strength ?? 0;
            const dashDirection = params.dashDirection ?? "view_direction";
            const soundEffect = params.sound_effect ?? "random.explode";
            const durabilityDamage = params.durability_damage ?? 0;
            const cooldownValue = params.cooldown_value ?? 20;
            const particleEffect = params.particle_effect ?? "minecraft:critical_hit_emitter";

            applyDurabilityDamage(source, { damage: durabilityDamage });

            switch (dashDirection) {
                case 'impulse':
                    source.applyImpulse({ x: source.getViewDirection().x * horizontalDashStrength, y: verticalDashStrength, z: source.getViewDirection().z * horizontalDashStrength });
                    source.dimension.playSound(soundEffect, source.location);
                    source.dimension.spawnParticle(particleEffect, source.location);
                    if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
                    break;
                case 'view_direction':
                    source.applyKnockback({ x: source.getViewDirection().x * horizontalDashStrength, z: source.getViewDirection().z * horizontalDashStrength }, verticalDashStrength);
                    source.dimension.playSound(soundEffect, source.location);
                    source.dimension.spawnParticle(particleEffect, source.location);
                    if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
                    break;
                case 'velocity':
                    source.applyKnockback({ x: source.getVelocity().x * horizontalDashStrength, z: source.getVelocity().z * horizontalDashStrength }, verticalDashStrength);
                    source.dimension.playSound(soundEffect, source.location);
                    source.dimension.spawnParticle(particleEffect, source.location);
                    if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
                    break;
                default: break;
            }
            if (!source.isGliding) {
                source.playAnimation("animation.player_extend.dash", {
                    stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
                });
            }
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:treasure_bag", {
        onUse({ source }, { params }) {
            const inventory = source.getComponent("inventory").container;
            const loot = params.loot ?? "loot_tables/empty";
            inventory.setItem(source.selectedSlotIndex, undefined)
            source.runCommand(`loot spawn ~~~ loot "${loot}"`)
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:food_effects", {
        onConsume({ source, itemStack }, { params }) {
            const playerHealthLevel = source?.getDynamicProperty("ph:health_level");
            const healthBoostLevel = params.health_boost_levels;
            const healthBoostDuration = params.health_boost_duration;

            const tags = itemStack.getTags()
            for (const tag of tags) {
                if (tag.startsWith("ph:food_effects-")) {
                    const val = tag.split("-");
                    source.addEffect(val[1], parseFloat(val[2]), {
                        amplifier: parseFloat(val[3])
                    })
                }
            }

            source.runCommand(`effect @s health_boost ${healthBoostDuration} ${3 * (playerHealthLevel + healthBoostLevel)} true`);
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:ability_upgrade", {
        onUse({ source }, { params }) {
            const min_level = params.min_level ?? 0;
            const passive_ability = params.passive_ability;
            const upgrade_to = params.upgrade_to ?? undefined;
            const upgrade_step = params.upgrade_step ?? 0;
            const upgrade_sound = params.upgrade_sound ?? "random.levelup";
            const upgrade_particle = params.upgrade_particle ?? "ph:auric_photonizer_explode";

            const inventory = source.getComponent("inventory").container;
            const property = source.getDynamicProperty(passive_ability);

            if (property < min_level) {
                source.sendMessage(`§cTo upgrade to this level, you need minimum ability level of ${min_level}`);
                return;
            }

            if (upgrade_to == undefined && upgrade_step < 1) {
                console.error(`Please give the specified value for the "upgrade_to" or "upgrade_step"`);
                return;
            }
            if (upgrade_to != undefined) source.setDynamicProperty(passive_ability, upgrade_to);
            if (upgrade_step > 0) source.setDynamicProperty(passive_ability, property + upgrade_step);
            source.sendMessage(`§aUpgrade successful, feels the difference of the abilities`);
            source.dimension.playSound(upgrade_sound, source.location);
            source.dimension.spawnParticle(upgrade_particle, source.location);
            source.runCommand(`clear @s ${inventory.getItem(source.selectedSlotIndex).typeId} -1 1`);
        }
    })

    // Custom Durability Fixes (Only fixes the sword wrong damage, mining blocks, and shovel tilting.)
    // Other actions like Aze Stripping, or Grass Tilting is on different file (vanilla_manipulation.js)
    initEvent.itemComponentRegistry.registerCustomComponent("ph:vanilla_tool_fix", {
        onUseOn({ source, block }) {
            const dirtPathable = [
                "minecraft:dirt",
                "minecraft:dirt_with_roots",
                "minecraft:podzol",
                "minecraft:mycellium",
                "minecraft:coarse_dirt"
            ]

            const inventory = source?.getComponent("inventory")?.container;
            const item = inventory?.getItem(source.selectedSlotIndex);

            if (item?.hasTag("minecraft:is_shovel") && block.typeId.includes(dirtPathable)) {
                block.dimension.setBlockType(block.location, "minecraft:dirt_path");
                source.playSound("use.grass");
                applyDurabilityDamage(source);
            }
        },
        onMineBlock({ source, itemStack }) {
            applyDurabilityDamage(source);
        },
        onBeforeDurabilityDamage({ durabilityDamage, itemStack }) {
            if (!itemStack.hasTag('minecraft:is_sword') || !itemStack.hasTag('minecraft:is_spear')) return;
            const inventory = source?.getComponent("inventory")?.container;
            const item = inventory?.getItem(source.selectedSlotIndex);
            const durability = item?.getComponent("durability");
            const unbreaking = item?.getComponent("enchantable")?.getEnchantment("unbreaking")?.level ?? 0;
            if (!durability || source.getGameMode() == "Creative") return;
            const unbreakingChance = unbreaking * 20;
            const randomChance = Math.floor(Math.random() * 101);
            if (randomChance <= unbreakingChance) {
                durabilityDamage--;
            }
            durabilityDamage--;
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_shooter", {
        onUse(e, { params }) {
            const projectileEntity = params.projectile_entity;
            const soundEffect = params.sound_effect ?? "random.explode";
            const costType = params.cost_type ?? "durability";
            const costAmount = params.cost_amount ?? 1;
            const altProjectileEvent = params.alt_projectile_event;
            const altCostType = params.alt_cost_type ?? "durability";
            const altCostAmount = params.alt_cost_amount ?? 1;
            const animation = params.animation;

            const player = e.source;
            const itemStack = e.itemStack;
            const cooldownCategory = itemStack?.getComponent("cooldown")?.cooldownCategory;
            const cooldownValue = itemStack?.getComponent("cooldown")?.cooldownTicks;

            const altEvents = {
                oceanic_attack: () => {
                    player.startItemCooldown("nature_staff", 50);

                    player.runCommand("summon ph:ocean_crystal_wave ~~~5 0 0");
                    player.runCommand("summon ph:ocean_crystal_wave ~-5~~ 90 0");
                    player.runCommand("summon ph:ocean_crystal_wave ~~~-5 180 0");
                    player.runCommand("summon ph:ocean_crystal_wave ~5~~ 270 0");

                    player.runCommand(
                        `playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`
                    );
                }
            };

            if (player.isSneaking) {
                const eventFunc = altEvents[altProjectileEvent];

                if (!eventFunc) {
                    player.sendMessage(`Unknown alt event: ${altProjectileEvent}`);
                    return;
                }

                if (costType === "durability") {
                    applyDurabilityDamage(player, { damage: altCostAmount });
                } else {
                    if (getScore(player, altCostType) < altCostAmount) return player.sendMessage("Insufficient Charges");
                    removeScore(player, altCostType, altCostAmount);
                }

                eventFunc();
                return;
            }

            if (costType === "durability") {
                applyDurabilityDamage(player, { damage: costAmount });
            } else {
                if (getScore(player, costType) < costAmount) return player.sendMessage("Insufficient Charges");
                removeScore(player, costType, costAmount);
            }

            if (cooldownCategory) player.startItemCooldown(cooldownCategory, cooldownValue);
            if (animation != undefined) player.playAnimation(animation);

            const head = player.getHeadLocation();
            const view = player.getViewDirection();
            const dir = {
                x: view.x,
                y: view.y,
                z: view.z
            };

            const offset = 0.6;
            const bullet = player.dimension.spawnEntity(`${projectileEntity}`, {
                x: head.x + view.x * offset,
                y: head.y + view.y * offset,
                z: head.z + view.z * offset

            });

            const proj = bullet.getComponent("minecraft:projectile");
            if (!proj) return;

            proj.owner = player;
            proj.shoot({
                x: dir.x * 2,
                y: dir.y * 2,
                z: dir.z * 2
            });

            player.runCommand(`playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`);
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:cruxshaper", {
        onUse(e) {
            const player = e.source;
            player.startItemCooldown("cruxshaper", 600);

            function impact() {
                player.removeEffect("slow_falling");
                player.dimension.spawnParticle("ph:cruxshaper_smash_explosion", player.location);
                player.dimension.playSound("random.explode", player.location);
                player.runCommand('damage @e[r=10,rm=0.1,family=!inanimate,type=!item] 50 entity_explosion entity @s');
                player.runCommand('execute as @s at @e[r=10,rm=0.1,family=!inanimate,type=!item] run setblock ~~~ fire')
            }

            system.run(() => {
                player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
                player.addEffect("levitation", 20, {
                    amplifier: 24
                })
                player.dimension.playSound("random.explode", player.location);
                system.runTimeout(() => {
                    player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
                    player.applyKnockback({ x: 0, z: 0 }, -2.1);
                    player.addEffect("slow_falling", 20);
                    player.playAnimation("animation.player_extend.plunge", {
                        stopExpression: "query.is_on_ground"
                    });
                    player.dimension.playSound("random.explode", player.location);
                    const intervalRun = system.runInterval(() => {
                        if (!player.isOnGround) return;
                        system.run(impact);
                        system.clearRun(intervalRun);
                    }, 2)
                }, 30)
            })

            applyDurabilityDamage(player, { damage: 50 });
        },
        onUseOn(e) {
            const player = e.source;
            system.run(() => {
                player.sendMessage("Look up while using the skill!")
            })
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:repair_full_inventory", {
        onUse({ source }, { params }) {
            const inventory = source?.getComponent("minecraft:inventory")?.container;
            const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];

            const repairRatio = params.repair_ratio ?? 100;
            const experienceCost = params.experience_cost;
            const cooldown = params.cooldown;

            const experienceLevel = source.level;
            if (experienceLevel < experienceCost) return;
            for (let i = 0; i < inventory.size; i++) {
                const item = inventory.getItem(i);
                if (!item) continue;

                const durability = item.getComponent("minecraft:durability");
                if (!durability) continue;
                const newDamage = durability.damage - (durability.damage * (repairRatio / 100));
                durability.damage = newDamage;
                inventory.setItem(i, item);
            }

            for (const slot of slots) {
                const equipmentSlot = source?.getComponent("minecraft:equippable")?.getEquipmentSlot(slot);
                const item = equipmentSlot.getItem();
                if (!item) continue;

                const durability = item.getComponent("minecraft:durability");
                if (!durability) continue;
                const newDamage = durability.damage - (durability.damage * (repairRatio / 100));
                durability.damage = newDamage;
                equipmentSlot.setItem(item);
            }
            const cost = Number(experienceCost);

            if (!isNaN(cost)) {
                source.addLevels(-cost);
            } else {
                console.log("experienceCost invalid:", experienceCost);
            }
            source.playSound("random.anvil_use");
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:auric_communicator", {
        onUse({ source, itemStack }) {
            const auricMode = getScore(source, "auric_communicator_mode");
            const block = source.getBlockFromViewDirection({
                includeLiquidBlocks: true,
                includePassableBlocks: false
            })?.block;
            if (!block) {
                addScore(source, "auric_communicator_mode", 1);
                return;
            }
            const blockLoc = block.location;
            block.dimension.runCommand("playsound random.toast @a[r=128] ~~~ 1 1.5 0.3");
            source.playSound("random.toast");
            block.dimension.spawnParticle("ph:auric_communicator_loading", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
            if (auricMode == 1) {
                source.addTag("AURIC_ORBITAL_NUKE");
                system.runTimeout(() => {
                    block.dimension.runCommand(`damage @e[r=48,tag=!AURIC_ORBITAL_NUKE,type=!item,family=!inanimate,x=${blockLoc.x},y=${blockLoc.y},z=${blockLoc.z}] 50 entity_explosion entity @e[tag=AURIC_ORBITAL_NUKE]`);
                    block.dimension.spawnParticle("ph:auric_stab_shot", { x: blockLoc.x, y: 0, z: blockLoc.z });
                    block.dimension.spawnParticle("ph:auric_nuke_shot", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
                    block.dimension.runCommand("playsound random.explode @a[r=192] ~~~ 1 1 0.5");
                    removeScore(source, "auric_charge", 100);
                    source.startItemCooldown("auric_communicator", 600);
                    source.removeTag("AURIC_ORBITAL_NUKE");
                }, 30);
                return;
            }
            // Stab Shot
            source.addTag("AURIC_ORBITAL_LASER");
            system.runTimeout(() => {
                for (let i = 0; i < 381; i += 10) {
                    block.dimension.runCommand(`damage @e[r=10,tag=!AURIC_ORBITAL_LASER,type=!item,family=!inanimate,x=${blockLoc.x},y=${i},z=${blockLoc.z}] 75 entity_explosion entity @e[tag=AURIC_ORBITAL_LASER]`);
                    block.dimension.runCommand(`playsound random.explode @a[r=128] ~ ${i} ~ 1 1 0.5`);
                }
                block.dimension.spawnParticle("ph:auric_stab_shot_refined", { x: blockLoc.x, y: 0, z: blockLoc.z });
                block.dimension.spawnParticle("ph:auric_stab_shot_line", { x: blockLoc.x, y: 0, z: blockLoc.z });
                removeScore(source, "auric_charge", 50);
                source.startItemCooldown("auric_communicator", 600);
                source.addTag("AURIC_ORBITAL_LASER")
            }, 30)
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:battery_container", {
        onUse({ source, itemStack }, { params }) {
            const whereToFill = params.where_to_fill || "auric_charge";

            const transferPerUse = params.charges || 100;
            const maxCharge = params.max_charge || 700;

            const durability = itemStack.getComponent("minecraft:durability");

            if (!durability) return;

            const maxDurability = durability.maxDurability;

            // container remaining charges
            const batteryCharge =
                maxDurability - durability.damage;

            if (batteryCharge <= 1) {
                source.sendMessage(
                    "§cYour Battery Container is empty."
                );
                return;
            }

            const currentCharge =
                getScore(source, whereToFill);

            // player remaining charges
            const missingCharge =
                maxCharge - currentCharge;

            if (missingCharge <= 0) {
                source.sendMessage(
                    "§eAuric Charge already full."
                );
                return;
            }

            const transferAmount = Math.min(
                transferPerUse,
                batteryCharge,
                missingCharge
            );

            setScore(
                source,
                whereToFill,
                currentCharge + transferAmount
            );

            applyDurabilityDamage(source, { damage: transferAmount })

            // ========================================

            source.sendMessage(
                `§b+${transferAmount} Auric Charge`
            );
        }
    })

    initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_parry_window", {
        onUse({ source, itemStack }, { params }) {
            const window_time = params.window_time;
            const animation = params.animation;

            source.playAnimation(animation);
            source.dimension.spawnParticle("ph:parry_prepare", source.location);
            source.dimension.playSound("item.spear.use", source.location);
            source.addTag("parried");
            source.inputPermissions.setPermissionCategory(2, false);
            applyDurabilityDamage(source, { damage: 1 });
            system.runTimeout(() => {
                if (source?.hasTag("parried")) source.removeTag("parried");
                source.inputPermissions.setPermissionCategory(2, true);
            }, window_time)
        }
    })

    initEvent.blockComponentRegistry.registerCustomComponent("ph:boss_summon", {
        onPlayerInteract({ player, block, faceLocation }) {
            // Blocks Custom Components Value
            const boss = block.getComponent("ph:boss_summon").customComponentParameters.params.boss;
            const bargaining_item = block.getComponent("ph:boss_summon").customComponentParameters.params.bargaining_item;
            let bargaining_item_amount = block.getComponent("ph:boss_summon").customComponentParameters.params.bargaining_item_amount;
            const message = block.getComponent("ph:boss_summon").customComponentParameters.params.message;
            let transform_into_entity = block.getComponent("ph:boss_summon").customComponentParameters.params.transform_into_entity;

            const mergedDataItem = new ItemStack(bargaining_item, bargaining_item_amount);

            // Player's component?
            const mainhand = player.getComponent("equippable").getEquipment("Mainhand");

            if (!bargaining_item_amount) bargaining_item_amount = 1;
            // Runtime Events
            if (mainhand?.typeId === bargaining_item && mainhand?.amount >= bargaining_item_amount) {
                if (transform_into_entity && !boss) {
                    block.dimension.setBlockType(block.location, "minecraft:air");
                    block.dimension.spawnEntity(`${transform_into_entity}`, block.center())
                    block.dimension.playSound("custom_sfx.boss_summoned", block.location);
                    player.runCommand(`clear @s ${bargaining_item} -1 ${bargaining_item_amount}`);
                    player.sendMessage(message);
                    return;
                }
                block.dimension.spawnEntity(boss, { x: block.center().x, y: block.center().y, z: block.center().z });
                block.dimension.playSound("custom_sfx.boss_summoned", block.location);
                player.runCommand(`clear @s ${bargaining_item} -1 ${bargaining_item_amount}`);
                player.sendMessage(message);
            } else {
                player.sendMessage({
                    rawtext: [
                        {
                            text: `You need §a${mergedDataItem?.amount}x `,
                        },
                        {
                            translate: `${mergedDataItem?.localizationKey}`
                        },
                        {
                            text: ` §rto activate this summoning block!`
                        }
                    ]
                });
                return;
            }
        }
    })

    initEvent.blockComponentRegistry.registerCustomComponent("ph:ancient_copper_core", {
        onPlayerInteract({ player, block, dimension }) {
            const northBlockState = block.north(2).permutation.getState("ph:activation_state");
            const eastBlockState = block.east(2).permutation.getState("ph:activation_state");
            const southBlockState = block.south(2).permutation.getState("ph:activation_state");
            const westBlockState = block.west(2).permutation.getState("ph:activation_state");

            if (northBlockState == 1 && eastBlockState == 1 && southBlockState == 1 && westBlockState == 1) {
                // Triggers the event here.
                player.sendMessage("Successfully activating the core. Waiting for his approach");
                block.dimension.setBlockType(block.north(2), "ph:core_battery");
                block.dimension.setBlockType(block.south(2), "ph:prismarine_battery");
                block.dimension.spawnParticle("ph:auric_beam", block.center());
                block.dimension.spawnParticle("ph:auric_light_flash", block.center());
                block.dimension.spawnParticle("ph:auric_beam_small", block.north(2).center());
                block.dimension.spawnParticle("ph:auric_beam_small", block.east(2).center());
                block.dimension.spawnParticle("ph:auric_beam_small", block.south(2).center());
                block.dimension.spawnParticle("ph:auric_beam_small", block.west(2).center());
                block.dimension.playSound("custom_sfx.boss_summoned", block.center());
                system.runTimeout(() => {
                    block.dimension.spawnEntity("ph:copper_mechanical_array", block.above(1.1));
                    block.dimension.playSound("mob.zombie.woodbreak", block.center());
                }, 100)
            }

            // Event if there's no Copper Battery nearby
            if (block.north(2).typeId != "minecraft:air" || block.east(2).typeId != "minecraft:air" || block.south(2).typeId != "minecraft:air" || block.west(2).typeId != "minecraft:air") return;
            block.dimension.playSound("tile.piston.in", block.center());
            if (block.north(2).typeId === "minecraft:air") block.dimension.setBlockType(block.north(2), "ph:core_battery");
            if (block.east(2).typeId === "minecraft:air") block.dimension.setBlockType(block.east(2), "ph:auric_battery");
            if (block.south(2).typeId === "minecraft:air") block.dimension.setBlockType(block.south(2), "ph:prismarine_battery");
            if (block.west(2).typeId === "minecraft:air") block.dimension.setBlockType(block.west(2), "ph:auric_battery");
        },
        onTick({ block, dimension }) {
            const northBlockState = block.north(2).permutation.getState("ph:activation_state");
            const eastBlockState = block.east(2).permutation.getState("ph:activation_state");
            const southBlockState = block.south(2).permutation.getState("ph:activation_state");
            const westBlockState = block.west(2).permutation.getState("ph:activation_state");

            let molangMap = new MolangVariableMap();
            molangMap.setFloat("variable.size", 1);
            molangMap.setColorRGBA("variable.rgba", { red: 1, green: 0.63137, blue: 0, alpha: 1 });
            let centerMap = new MolangVariableMap();
            centerMap.setFloat("variable.size", 3);
            centerMap.setColorRGBA("variable.rgba", { red: 1, green: 0.63137, blue: 0, alpha: 1 });
            let activatedCoreMap = new MolangVariableMap();
            activatedCoreMap.setFloat("variable.size", 1);
            activatedCoreMap.setColorRGBA("variable.rgba", { red: 1, green: 1, blue: 1, alpha: 1 });
            let activatedPrismarineMap = new MolangVariableMap();
            activatedPrismarineMap.setFloat("variable.size", 1);
            activatedPrismarineMap.setColorRGBA("variable.rgba", { red: 0.352, green: 1, blue: 0.705, alpha: 1 });
            if (northBlockState == 1) {
                block.dimension.spawnParticle("ph:bounding_circle", block.north(2).center(), activatedCoreMap);
            }
            if (eastBlockState == 1) {
                block.dimension.spawnParticle("ph:bounding_circle", block.east(2).center(), molangMap);
            }
            if (southBlockState == 1) {
                block.dimension.spawnParticle("ph:bounding_circle", block.south(2).center(), activatedPrismarineMap);
            }
            if (westBlockState == 1) {
                block.dimension.spawnParticle("ph:bounding_circle", block.west(2).center(), molangMap);
            }

            if (block.north(2).typeId != "minecraft:air" || block.east(2).typeId != "minecraft:air" || block.south(2).typeId != "minecraft:air" || block.west(2).typeId != "minecraft:air") return;
            block.dimension.spawnParticle("ph:bounding_circle", block.center(), centerMap);
            block.dimension.spawnParticle("ph:bounding_circle", block.north(2).center(), molangMap);
            block.dimension.spawnParticle("ph:bounding_circle", block.east(2).center(), molangMap);
            block.dimension.spawnParticle("ph:bounding_circle", block.south(2).center(), molangMap);
            block.dimension.spawnParticle("ph:bounding_circle", block.west(2).center(), molangMap);
        },
        onBreak({ block, dimension, brokenBlockPermutation }) {
            dimension.setBlockType(block.north(2), "minecraft:air");
            dimension.setBlockType(block.east(2), "minecraft:air");
            dimension.setBlockType(block.south(2), "minecraft:air");
            dimension.setBlockType(block.west(2), "minecraft:air");
        }
    })

    initEvent.blockComponentRegistry.registerCustomComponent("ph:copper_battery", {
        onPlayerInteract({ player, block, dimension }, { params }) {
            const chargeType = params.charge_type; // "item" or "player_charge"
            const item = params.item ?? "minecraft:netherite_ingot";
            const itemCount = params.item_count ?? 1;
            const playerChargeObjective = params.player_charge_objective ?? "superchargd_copper_axe"; // Scoreboard for charge value
            const chargeMin = params.charge_min ?? 0;

            const mergedDataItem = new ItemStack(item, itemCount);

            if (chargeType == "item") {
                if (player.getComponent("equippable")?.getEquipment("Mainhand")?.typeId != item) {
                    player.sendMessage({
                        rawtext: [
                            {
                                text: `You need §a${mergedDataItem?.amount}x `,
                            },
                            {
                                translate: `${mergedDataItem?.localizationKey}`
                            },
                            {
                                text: ` §rto activate this copper battery slot!`
                            }
                        ]
                    });
                    return;
                }
                block.setPermutation(block.permutation.withState("ph:activation_state", 1));
                block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
                player.runCommand(`clear @s ${item} -1 ${itemCount}`)

            }
            if (chargeType == "player_charge") {
                if (getScore(player, playerChargeObjective) < chargeMin) { player.sendMessage(`You need §a${chargeMin} §rCharges to activate this battery slot`); return; }
                block.setPermutation(block.permutation.withState("ph:activation_state", 1));
                block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
                removeScore(player, "auric_charge", chargeMin);
            }
        }
    })

    initEvent.blockComponentRegistry.registerCustomComponent("ph:item_charger", {
        onPlayerInteract({ player, block, dimension }, { params }) {
            const item = params.item;
            const maxBatteryStack = params.max_battery_stack || 4;
            const soundInput = params.sound_input;
            const soundPickup = params.sound_pickup;
            const itemData = new ItemStack(item);

            const batteryCount = block.permutation.getState("ph:battery_count");
            const batteryState = block.permutation.getState("ph:battery_state");

            const mainhand = player.getComponent("equippable").getEquipmentSlot("Mainhand");
            const itemStack = mainhand.getItem();
            const durability = itemStack?.getComponent("minecraft:durability");
            if (batteryState == "result") {
                for (let i = 0; i < batteryCount; i++) {
                    dimension.spawnItem(itemData, block.center());
                }
                dimension.playSound(soundPickup, block.center());
                block.setPermutation(block.permutation.withState("ph:battery_count", 0));
                block.setPermutation(block.permutation.withState("ph:battery_state", "open"));
                return;
            }
            if (batteryState == "processing") return;
            if (itemStack?.typeId === item && durability.damage < durability.maxDurability) {
                if (batteryCount > 3) return player.sendMessage("§cThe Battery slot is full.");
                mainhand.setItem(undefined);
                block.setPermutation(block.permutation.withState("ph:battery_count", batteryCount + 1));
                dimension.playSound(soundInput, block.center());
                return;
            } else if (batteryCount == 0) {
                player.sendMessage({
                    rawtext: [
                        {
                            text: "You need to put drained §a"
                        },
                        {
                            translate: `${itemData.localizationKey}`
                        }
                    ]
                })
                player.playSound("note.bass");
                return;
            } else {
                block.setPermutation(block.permutation.withState("ph:battery_state", "processing"));
            }
        },
        onTick({ block, dimension }) {
            const batteryState = block.permutation.getState("ph:battery_state");

            if (batteryState != "processing") return;
            block.setPermutation(block.permutation.withState("ph:battery_state", "result"));
            dimension.playSound("random.orb", block.center());
        }
    })

    initEvent.customCommandRegistry.registerCommand({
        name: "ph:unlockskill",
        description: "Opens a skill unlock ui",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any
    }, openForm)

    initEvent.customCommandRegistry.registerCommand({
        name: "ph:cleardynamicproperties",
        description: "Reset all of your dynamic properties",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.GameDirectors
    }, clearDynamicProperty)

    initEvent.customCommandRegistry.registerCommand({
        name: "ph:dynamicproperties",
        description: "Check all of your dynamic properties",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.GameDirectors
    }, openProperties)
})

function openForm({ sourceEntity: player }) {
    system.run(() => {
        skillUnlock(player);
    })
    return { status: CustomCommandStatus.Success };
}

function openProperties({ sourceEntity: player }) {
    system.run(() => {
        propertiesCheck(player);
    })
    return { status: CustomCommandStatus.Success };
}

function clearDynamicProperty({ sourceEntity: player }) {
    system.run(() => {
        player.clearDynamicProperties()
    })
    return { status: CustomCommandStatus.Success };
}
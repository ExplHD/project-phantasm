import { system, MolangVariableMap, ItemStack, Player, EquipmentSlot, type Block, type Dimension, type RGBA, type StartupEvent, type Vector3 } from '@minecraft/server'
import { setScore, getScore, addScore, removeScore } from '../../core/scoreboard'
import { applyDurabilityDamage } from '../../core/items'
import { summonOwned } from '../../core/summons'
import { isLoadedLocation } from '../../core/location'
import { crystallSupport, getCustomState, setCustomState } from '../../core/blocks'
import { readParams, numParam, strParam } from '../../core/params'

const BOSS_SPAWN_MIN_DISTANCE = 4;
const BOSS_SPAWN_MAX_DISTANCE = 12;

const BOSS_SPAWN_HEAD_ROOM = 4;

const BOSS_SPAWN_SEARCH_DEPTH = 12;

const ACTIVATION_STATE = "ph:activation_state";

const REPAIR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];

const DIRT_PATHABLE: string[] = [
    "minecraft:dirt",
    "minecraft:dirt_with_roots",
    "minecraft:podzol",
    "minecraft:mycellium",
    "minecraft:coarse_dirt"
];

function hasOrbitalTargets(dimension: Dimension, location: Vector3, maxDistance: number, sourceTag: string): boolean {
    return dimension.getEntities({
        location,
        maxDistance,
        excludeTags: [sourceTag],
        excludeTypes: ["minecraft:item"],
        excludeFamilies: ["inanimate"]
    }).length > 0;
}

function isGroundBlock(block: Block | undefined): boolean {
    return !!block && !block.isAir && !block.isLiquid;
}

function findBossSpawnPoint(dimension: Dimension, origin: Vector3, player: Player): Vector3 {
    const angles = 12;

    for (let i = 0; i < angles; i++) {
        const angle = ((i / angles) * Math.PI * 2) + Math.random() * 0.5;
        const distance = BOSS_SPAWN_MIN_DISTANCE + Math.random() * (BOSS_SPAWN_MAX_DISTANCE - BOSS_SPAWN_MIN_DISTANCE);
        const x = Math.floor(origin.x + Math.cos(angle) * distance);
        const z = Math.floor(origin.z + Math.sin(angle) * distance);
        const startY = Math.floor(player.location.y);

        for (let drop = 0; drop <= BOSS_SPAWN_SEARCH_DEPTH; drop++) {
            const y = startY - drop;
            const floorLocation = { x, y: y - 1, z };
            if (!isLoadedLocation(dimension, floorLocation)) continue;
            const floor = dimension.getBlock(floorLocation);
            if (!isGroundBlock(floor)) continue;

            const headRoom = Array.from({ length: BOSS_SPAWN_HEAD_ROOM }, (_, up) => ({ x, y: y + up, z }))
                .every((location) => isLoadedLocation(dimension, location) && dimension.getBlock(location)?.isAir === true);
            if (!headRoom) break;

            return { x: x + 0.5, y, z: z + 0.5 };
        }
    }

    return { x: origin.x, y: origin.y + 1.1, z: origin.z };
}

const COPPER_RING_COLOR: RGBA = { red: 1, green: 0.63137, blue: 0, alpha: 1 };

function coreRing(size: number, color: RGBA): MolangVariableMap {
    const map = new MolangVariableMap();
    map.setFloat("variable.size", size);
    map.setColorRGBA("variable.rgba", color);
    return map;
}

const copperRing = (): MolangVariableMap => coreRing(1, COPPER_RING_COLOR);

function isActive(block: Block | undefined): boolean {
    return !!block && getCustomState(block, ACTIVATION_STATE) == 1;
}

function sendNeedItem(player: Player, item: ItemStack, suffix: string): void {
    player.sendMessage({
        rawtext: [
            { text: `You need §a${item.amount}x ` },
            { translate: `${item.localizationKey}` },
            { text: suffix }
        ]
    });
}

export function registerCustomComponents(initEvent: StartupEvent): void {
    initEvent.itemComponentRegistry.registerCustomComponent("ph:charge_passive", {
        onHitEntity({ hitEntity, attackingEntity: source, itemStack }): void {
            if (itemStack?.typeId !== "ph:charged_copper_axe") return;
            system.runTimeout(() => {
                if (!source.isValid || !hitEntity.isValid) return;
                if (getScore(source, "charged_copper_axe") == 100) {
                    summonOwned(source, 'summon lightning_bolt', hitEntity);
                }
                const calculatedDamage = 10 + (getScore(source, "charged_copper_axe") / 10);
                hitEntity.applyDamage(calculatedDamage);
                setScore(source, "charged_copper_axe", 0);
            }, 3);
        },
        onUse({ source: player }): void {
            player.startItemCooldown("charged_copper_axe", 120);
            applyDurabilityDamage(player, { damage: 36 });
            system.run(() => {
                if (!player.isValid) return;
                player.playAnimation("animation.charged_copper_axe.attack_3");
                system.runTimeout(() => {
                    if (!player.isValid) return;
                    player.dimension.playSound("weapon_slash.slash_heavy", player.location);
                    player.dimension.spawnParticle("ph:lightning_flash", player.location);
                    player.dimension.spawnParticle("ph:lightning_sparks", player.location);
                    player.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=4] 18 entity_attack entity "${player.name}"`);
                    summonOwned(player, 'summon lightning_bolt ^^^5 ~ 0');
                    summonOwned(player, 'summon lightning_bolt ^^^10 ~ 0');
                    player.runCommand('particle ph:lightning_sparks ^^^5');
                    player.runCommand('particle ph:lightning_sparks ^^^10');
                }, 8);
            });
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:time_polarizer", {
        onUse({ source }): void {
            if (source.isSneaking) {
                source.runCommand(`effect @e[r=8,rm=0.1] slowness 22 1 true`);
                source.runCommand(`effect @e[r=8,rm=0.1] slow_falling 22 1 true`);
                source.dimension.spawnParticle("ph:time_polarizer_slow_zone", source.location);
                return;
            }
            source.addEffect("speed", 500, {
                amplifier: 2
            });
            source.dimension.spawnParticle("ph:time_polarizer_speed", { x: source.location.x, y: source.location.y + 0.4, z: source.location.z });
            source.startItemCooldown("time_polarizer", 600);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:dash", {
        onUse({ source, itemStack }, parameters): void {
            const params = readParams(parameters);
            const cooldownCategory = itemStack?.getComponent("cooldown")?.cooldownCategory;

            const horizontalDashStrength = numParam(params, "horizontal_dash_strength") ?? 0;
            const verticalDashStrength = numParam(params, "vertical_dash_strength") ?? 0;
            const dashDirection = strParam(params, "dashDirection") ?? "view_direction";
            const soundEffect = strParam(params, "sound_effect") ?? "random.explode";
            const durabilityDamage = numParam(params, "durability_damage") ?? 0;
            const cooldownValue = numParam(params, "cooldown_value") ?? 20;
            const particleEffect = strParam(params, "particle_effect") ?? "minecraft:critical_hit_emitter";

            applyDurabilityDamage(source, { damage: durabilityDamage });

            const dashed = dashDirection === 'impulse' || dashDirection === 'view_direction' || dashDirection === 'velocity';
            if (dashDirection === 'impulse') {
                source.applyImpulse({ x: source.getViewDirection().x * horizontalDashStrength, y: verticalDashStrength, z: source.getViewDirection().z * horizontalDashStrength });
            } else if (dashDirection === 'view_direction') {
                source.applyKnockback({ x: source.getViewDirection().x * horizontalDashStrength, z: source.getViewDirection().z * horizontalDashStrength }, verticalDashStrength);
            } else if (dashDirection === 'velocity') {
                source.applyKnockback({ x: source.getVelocity().x * horizontalDashStrength, z: source.getVelocity().z * horizontalDashStrength }, verticalDashStrength);
            }
            if (dashed) {
                source.dimension.playSound(soundEffect, source.location);
                source.dimension.spawnParticle(particleEffect, source.location);
                if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
            }
            if (!source.isGliding) {
                source.playAnimation("animation.player_extend.dash", {
                    stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
                });
            }
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:treasure_bag", {
        onUse({ source }, parameters): void {
            const inventory = source.getComponent("inventory")?.container;
            if (!inventory) return;
            const loot = strParam(readParams(parameters), "loot") ?? "loot_tables/empty";
            inventory.setItem(source.selectedSlotIndex, undefined);
            source.runCommand(`loot spawn ~~~ loot "${loot}"`);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:food_effects", {
        onConsume({ source, itemStack }, parameters): void {
            if (!source.isValid) return;
            const params = readParams(parameters);
            const playerHealthLevel = Number(source.getDynamicProperty("ph:health_level") ?? 0);
            const healthBoostLevel = numParam(params, "health_boost_levels") ?? 0;
            const healthBoostDuration = numParam(params, "health_boost_duration") ?? 0;

            for (const tag of itemStack.getTags()) {
                if (!tag.startsWith("ph:food_effects-")) continue;
                const [, effect, duration, amplifier] = tag.split("-");
                if (!effect) continue;
                source.addEffect(effect, parseFloat(duration ?? "0"), {
                    amplifier: parseFloat(amplifier ?? "0")
                });
            }

            source.runCommand(`effect @s health_boost ${healthBoostDuration} ${3 * (playerHealthLevel + healthBoostLevel)} true`);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:ability_upgrade", {
        onUse({ source }, parameters): void {
            const params = readParams(parameters);
            const minLevel = numParam(params, "min_level") ?? 0;
            const passiveAbility = strParam(params, "passive_ability");
            const upgradeTo = numParam(params, "upgrade_to");
            const upgradeStep = numParam(params, "upgrade_step") ?? 0;
            const upgradeSound = strParam(params, "upgrade_sound") ?? "random.levelup";
            const upgradeParticle = strParam(params, "upgrade_particle") ?? "ph:auric_photonizer_explode";

            if (!passiveAbility) {
                console.error(`Please give the specified value for "passive_ability"`);
                return;
            }

            const inventory = source.getComponent("inventory")?.container;
            const property = Number(source.getDynamicProperty(passiveAbility) ?? 0);

            if (property < minLevel) {
                source.sendMessage(`§cTo upgrade to this level, you need minimum ability level of ${minLevel}`);
                return;
            }

            if (upgradeTo === undefined && upgradeStep < 1) {
                console.error(`Please give the specified value for the "upgrade_to" or "upgrade_step"`);
                return;
            }
            if (upgradeTo !== undefined) source.setDynamicProperty(passiveAbility, upgradeTo);
            if (upgradeStep > 0) source.setDynamicProperty(passiveAbility, property + upgradeStep);
            source.sendMessage(`§aUpgrade successful, feel the difference`);
            source.dimension.playSound(upgradeSound, source.location);
            source.dimension.spawnParticle(upgradeParticle, source.location);
            const heldId = inventory?.getItem(source.selectedSlotIndex)?.typeId;
            if (heldId) source.runCommand(`clear @s ${heldId} -1 1`);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:vanilla_tool_fix", {
        onUseOn({ source, block }): void {
            if (!(source instanceof Player)) return;
            const item = source.getComponent("inventory")?.container?.getItem(source.selectedSlotIndex);

            if (item?.hasTag("minecraft:is_shovel") && DIRT_PATHABLE.includes(block.typeId)) {
                block.dimension.setBlockType(block.location, "minecraft:dirt_path");
                source.playSound("use.grass");
                applyDurabilityDamage(source);
            }
        },
        onMineBlock({ source }): void {
            if (source instanceof Player) applyDurabilityDamage(source);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_shooter", {
        onUse({ source: player, itemStack }, parameters): void {
            const params = readParams(parameters);
            const projectileEntity = strParam(params, "projectile_entity");
            const soundEffect = strParam(params, "sound_effect") ?? "random.explode";
            const costType = strParam(params, "cost_type") ?? "durability";
            const costAmount = numParam(params, "cost_amount") ?? 1;
            const altProjectileEvent = strParam(params, "alt_projectile_event");
            const altCostType = strParam(params, "alt_cost_type") ?? "durability";
            const altCostAmount = numParam(params, "alt_cost_amount") ?? 1;
            const animation = strParam(params, "animation");

            const cooldown = itemStack?.getComponent("cooldown");

            const altEvents: Record<string, () => void> = {
                oceanic_attack: () => {
                    player.startItemCooldown("nature_staff", 50);

                    summonOwned(player, "summon ph:ocean_crystal_wave ~~~5 0 0");
                    summonOwned(player, "summon ph:ocean_crystal_wave ~-5~~ 90 0");
                    summonOwned(player, "summon ph:ocean_crystal_wave ~~~-5 180 0");
                    summonOwned(player, "summon ph:ocean_crystal_wave ~5~~ 270 0");

                    player.runCommand(
                        `playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`
                    );
                }
            };

            if (player.isSneaking) {
                const eventFunc = altProjectileEvent === undefined ? undefined : altEvents[altProjectileEvent];

                if (!eventFunc) {
                    player.sendMessage(`Unknown alt event: ${altProjectileEvent}`);
                    return;
                }

                if (costType === "durability") {
                    applyDurabilityDamage(player, { damage: altCostAmount });
                } else {
                    if (getScore(player, altCostType) < altCostAmount) return player.sendMessage("Insufficient Charges");
                    removeScore(player, altCostType, altCostAmount);
                    applyDurabilityDamage(player, { damage: altCostAmount });
                }

                eventFunc();
                return;
            }

            if (costType === "durability") {
                applyDurabilityDamage(player, { damage: costAmount });
            } else {
                if (getScore(player, costType) < costAmount) return player.sendMessage("Insufficient Charges");
                removeScore(player, costType, costAmount);
                applyDurabilityDamage(player, { damage: costAmount });
            }

            if (cooldown?.cooldownCategory) player.startItemCooldown(cooldown.cooldownCategory, cooldown.cooldownTicks);
            if (animation !== undefined) player.playAnimation(animation);
            if (!projectileEntity) return;

            const head = player.getHeadLocation();
            const view = player.getViewDirection();

            const offset = 0.6;
            const spawnAt = {
                x: head.x + view.x * offset,
                y: head.y + view.y * offset,
                z: head.z + view.z * offset
            };
            if (!isLoadedLocation(player.dimension, spawnAt)) return;
            const bullet = player.dimension.spawnEntity(projectileEntity, spawnAt);

            const proj = bullet.getComponent("minecraft:projectile");
            if (!proj) return;

            proj.owner = player;
            proj.shoot({
                x: view.x * 2,
                y: view.y * 2,
                z: view.z * 2
            });

            player.runCommand(`playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:cruxshaper", {
        onUse({ source: player }): void {
            player.startItemCooldown("cruxshaper", 600);

            function impact(): void {
                if (!player.isValid) return;
                player.removeEffect("slow_falling");
                player.dimension.spawnParticle("ph:cruxshaper_smash_explosion", player.location);
                player.dimension.playSound("random.explode", player.location);
                player.runCommand('damage @e[r=10,rm=0.1,family=!inanimate,type=!item] 50 entity_explosion entity @s');
                player.runCommand('execute as @s at @e[r=10,rm=0.1,family=!inanimate,type=!item] run setblock ~~~ fire');
            }

            system.run(() => {
                if (!player.isValid) return;
                player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
                player.addEffect("levitation", 20, {
                    amplifier: 24
                });
                player.dimension.playSound("random.explode", player.location);
                system.runTimeout(() => {
                    if (!player.isValid) return;
                    player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
                    player.applyKnockback({ x: 0, z: 0 }, -2.1);
                    player.addEffect("slow_falling", 20);
                    player.playAnimation("animation.player_extend.plunge", {
                        stopExpression: "query.is_on_ground"
                    });
                    player.dimension.playSound("random.explode", player.location);
                    const intervalRun = system.runInterval(() => {
                        if (!player.isValid) {
                            system.clearRun(intervalRun);
                            return;
                        }
                        if (!player.isOnGround) return;
                        system.run(impact);
                        system.clearRun(intervalRun);
                    }, 2);
                }, 30);
            });

            applyDurabilityDamage(player, { damage: 50 });
        },
        onUseOn({ source }): void {
            if (!(source instanceof Player)) return;
            system.run(() => {
                if (source.isValid) source.sendMessage("Look up while using the skill!");
            });
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:repair_full_inventory", {
        onUse({ source }, parameters): void {
            const inventory = source.getComponent("minecraft:inventory")?.container;
            const equippable = source.getComponent("minecraft:equippable");
            if (!inventory || !equippable) return;

            const params = readParams(parameters);
            const repairRatio = numParam(params, "repair_ratio") ?? 100;
            const experienceCost = numParam(params, "experience_cost");

            if (experienceCost !== undefined && source.level < experienceCost) return;
            for (let i = 0; i < inventory.size; i++) {
                const item = inventory.getItem(i);
                if (!item) continue;

                const durability = item.getComponent("minecraft:durability");
                if (!durability) continue;
                durability.damage = durability.damage - (durability.damage * (repairRatio / 100));
                inventory.setItem(i, item);
            }

            for (const slot of REPAIR_SLOTS) {
                const equipmentSlot = equippable.getEquipmentSlot(slot);
                const item = equipmentSlot.getItem();
                if (!item) continue;

                const durability = item.getComponent("minecraft:durability");
                if (!durability) continue;
                durability.damage = durability.damage - (durability.damage * (repairRatio / 100));
                equipmentSlot.setItem(item);
            }

            if (experienceCost !== undefined) {
                source.addLevels(-experienceCost);
            } else {
                console.log("experienceCost invalid:", experienceCost);
            }
            source.playSound("random.anvil_use");
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:auric_communicator", {
        onUse({ source }): void {
            const auricMode = getScore(source, "auric_communicator_mode");
            const block = source.getBlockFromViewDirection({
                includeLiquidBlocks: true,
                includePassableBlocks: false
            })?.block;
            if (!block) {
                addScore(source, "auric_communicator_mode", 1);
                source.playSound("random.click");
                return;
            }
            const dimension = block.dimension;
            const blockLoc = block.location;
            dimension.playSound("random.toast", blockLoc);
            source.playSound("random.toast");
            dimension.spawnParticle("ph:auric_communicator_loading", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
            if (auricMode == 1) {
                source.addTag("AURIC_ORBITAL_NUKE");
                system.runTimeout(() => {
                    if (!source.isValid || !isLoadedLocation(dimension, blockLoc)) return;
                    dimension.playSound("random.explode", blockLoc);
                    if (hasOrbitalTargets(dimension, blockLoc, 48, "AURIC_ORBITAL_NUKE")) {
                        dimension.runCommand(`damage @e[r=48,tag=!AURIC_ORBITAL_NUKE,type=!item,family=!inanimate,x=${blockLoc.x},y=${blockLoc.y},z=${blockLoc.z}] 50 entity_explosion entity @e[tag=AURIC_ORBITAL_NUKE]`);
                    }
                    dimension.spawnParticle("ph:auric_stab_shot", { x: blockLoc.x, y: 0, z: blockLoc.z });
                    dimension.spawnParticle("ph:auric_nuke_shot", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
                    removeScore(source, "auric_charge", 100);
                    source.startItemCooldown("auric_communicator", 600);
                    source.removeTag("AURIC_ORBITAL_NUKE");
                }, 30);
                return;
            }

            source.addTag("AURIC_ORBITAL_LASER");
            system.runTimeout(() => {
                if (!source.isValid || !isLoadedLocation(dimension, blockLoc)) return;
                for (let i = 0; i < 381; i += 10) {
                    if (hasOrbitalTargets(dimension, { x: blockLoc.x, y: i, z: blockLoc.z }, 10, "AURIC_ORBITAL_LASER")) {
                        dimension.runCommand(`damage @e[r=10,tag=!AURIC_ORBITAL_LASER,type=!item,family=!inanimate,x=${blockLoc.x},y=${i},z=${blockLoc.z}] 80 entity_explosion entity @e[tag=AURIC_ORBITAL_LASER]`);
                    }
                    dimension.playSound("random.explode", { x: blockLoc.x, y: i, z: blockLoc.z });
                }
                dimension.spawnParticle("ph:auric_stab_shot_refined", { x: blockLoc.x, y: 0, z: blockLoc.z });
                dimension.spawnParticle("ph:auric_stab_shot_line", { x: blockLoc.x, y: 0, z: blockLoc.z });
                removeScore(source, "auric_charge", 50);
                source.startItemCooldown("auric_communicator", 600);
                source.removeTag("AURIC_ORBITAL_LASER");
            }, 30);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:battery_container", {
        onUse({ source, itemStack }, parameters): void {
            const params = readParams(parameters);
            const whereToFill = strParam(params, "where_to_fill") || "auric_charge";
            const transferPerUse = numParam(params, "charges") || 100;
            const maxCharge = numParam(params, "max_charge") || 700;

            const durability = itemStack?.getComponent("minecraft:durability");
            if (!durability) return;

            const batteryCharge = durability.maxDurability - durability.damage;

            if (batteryCharge <= 1) {
                source.sendMessage("§cYour Battery Container is empty.");
                return;
            }

            const currentCharge = getScore(source, whereToFill);
            const missingCharge = maxCharge - currentCharge;

            if (missingCharge <= 0) {
                source.sendMessage("§eAuric Charge already full.");
                return;
            }

            const transferAmount = Math.min(transferPerUse, batteryCharge, missingCharge);

            setScore(source, whereToFill, currentCharge + transferAmount);
            applyDurabilityDamage(source, { damage: transferAmount });
            source.sendMessage(`§b+${transferAmount} Auric Charge`);
        }
    });

    initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_parry_window", {
        onUse({ source }, parameters): void {
            const params = readParams(parameters);
            const windowTime = numParam(params, "window_time") ?? 1;
            const animation = strParam(params, "animation");

            if (animation) source.playAnimation(animation);
            source.dimension.spawnParticle("ph:parry_prepare", source.location);
            source.dimension.playSound("item.spear.use", source.location);
            source.addTag("parried");
            source.inputPermissions.setPermissionCategory(2, false);
            applyDurabilityDamage(source, { damage: 1 });
            system.runTimeout(() => {
                if (!source.isValid) return;
                if (source.hasTag("parried")) source.removeTag("parried");
                source.inputPermissions.setPermissionCategory(2, true);
            }, windowTime);
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:boss_summon", {
        onPlayerInteract({ player, block }, parameters): void {
            if (!player) return;
            const params = readParams(parameters);
            const boss = strParam(params, "boss");
            const bargainingItem = strParam(params, "bargaining_item");
            const bargainingItemAmount = numParam(params, "bargaining_item_amount") || 1;
            const message = strParam(params, "message");
            const transformIntoEntity = strParam(params, "transform_into_entity");
            if (!bargainingItem) return;

            const mergedDataItem = new ItemStack(bargainingItem, bargainingItemAmount);
            const mainhand = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);

            if (mainhand?.typeId !== bargainingItem || mainhand.amount < bargainingItemAmount) {
                sendNeedItem(player, mergedDataItem, ` §rto activate this summoning block!`);
                return;
            }

            if (transformIntoEntity && !boss) {
                block.dimension.setBlockType(block.location, "minecraft:air");
                block.dimension.spawnEntity(transformIntoEntity, block.center());
                block.dimension.playSound("custom_sfx.boss_summoned", block.location);
                player.runCommand(`clear @s ${bargainingItem} -1 ${bargainingItemAmount}`);
                if (message) player.sendMessage(message);
                return;
            }
            if (!boss) return;
            block.dimension.spawnEntity(boss, block.center());
            block.dimension.playSound("custom_sfx.boss_summoned", block.location);
            player.runCommand(`clear @s ${bargainingItem} -1 ${bargainingItemAmount}`);
            if (message) player.sendMessage(message);
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:ancient_copper_core", {
        onPlayerInteract({ player, block }): void {
            if (!player) return;
            const north = block.north(2);
            const east = block.east(2);
            const south = block.south(2);
            const west = block.west(2);
            if (!north || !east || !south || !west) return;

            if (isActive(north) && isActive(east) && isActive(south) && isActive(west)) {
                player.sendMessage("Core activated. Waiting for his approach");
                block.dimension.setBlockType(north.location, "ph:core_battery");
                block.dimension.setBlockType(south.location, "ph:prismarine_battery");
                block.dimension.spawnParticle("ph:auric_beam", block.center());
                block.dimension.spawnParticle("ph:auric_light_flash", block.center());
                block.dimension.spawnParticle("ph:auric_beam_small", north.center());
                block.dimension.spawnParticle("ph:auric_beam_small", east.center());
                block.dimension.spawnParticle("ph:auric_beam_small", south.center());
                block.dimension.spawnParticle("ph:auric_beam_small", west.center());
                block.dimension.playSound("custom_sfx.boss_summoned", block.center());
                const dimension = block.dimension;
                const bossSpawnPoint = findBossSpawnPoint(dimension, block.center(), player);
                system.runTimeout(() => {
                    if (!isLoadedLocation(dimension, bossSpawnPoint)) return;
                    dimension.spawnEntity("ph:copper_mechanical_array", bossSpawnPoint);
                    dimension.playSound("mob.zombie.woodbreak", bossSpawnPoint);
                    dimension.spawnParticle("ph:auric_beam_small", bossSpawnPoint);
                    dimension.spawnParticle("ph:auric_light_flash", bossSpawnPoint);
                }, 100);
            }

            if (north.typeId != "minecraft:air" || east.typeId != "minecraft:air" || south.typeId != "minecraft:air" || west.typeId != "minecraft:air") return;
            block.dimension.playSound("tile.piston.in", block.center());
            block.dimension.setBlockType(north.location, "ph:core_battery");
            block.dimension.setBlockType(east.location, "ph:auric_battery");
            block.dimension.setBlockType(south.location, "ph:prismarine_battery");
            block.dimension.setBlockType(west.location, "ph:auric_battery");
        },
        onTick({ block, dimension }): void {
            const north = block.north(2);
            const east = block.east(2);
            const south = block.south(2);
            const west = block.west(2);
            if (!north || !east || !south || !west) return;

            if (isActive(north)) {
                dimension.spawnParticle("ph:bounding_circle", north.center(), coreRing(1, { red: 1, green: 1, blue: 1, alpha: 1 }));
            }
            if (isActive(east)) {
                dimension.spawnParticle("ph:bounding_circle", east.center(), copperRing());
            }
            if (isActive(south)) {
                dimension.spawnParticle("ph:bounding_circle", south.center(), coreRing(1, { red: 0.352, green: 1, blue: 0.705, alpha: 1 }));
            }
            if (isActive(west)) {
                dimension.spawnParticle("ph:bounding_circle", west.center(), copperRing());
            }

            if (north.typeId != "minecraft:air" || east.typeId != "minecraft:air" || south.typeId != "minecraft:air" || west.typeId != "minecraft:air") return;
            dimension.spawnParticle("ph:bounding_circle", block.center(), coreRing(3, COPPER_RING_COLOR));
            dimension.spawnParticle("ph:bounding_circle", north.center(), copperRing());
            dimension.spawnParticle("ph:bounding_circle", east.center(), copperRing());
            dimension.spawnParticle("ph:bounding_circle", south.center(), copperRing());
            dimension.spawnParticle("ph:bounding_circle", west.center(), copperRing());
        },
        onBreak({ block, dimension }): void {
            for (const neighbor of [block.north(2), block.east(2), block.south(2), block.west(2)]) {
                if (neighbor) dimension.setBlockType(neighbor.location, "minecraft:air");
            }
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:copper_battery", {
        onPlayerInteract({ player, block }, parameters): void {
            if (!player) return;
            const params = readParams(parameters);
            const chargeType = strParam(params, "charge_type");
            const item = strParam(params, "item") ?? "minecraft:netherite_ingot";
            const itemCount = numParam(params, "item_count") ?? 1;
            const playerChargeObjective = strParam(params, "player_charge_objective") ?? "superchargd_copper_axe";
            const chargeMin = numParam(params, "charge_min") ?? 0;

            if (chargeType == "item") {
                if (player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId != item) {
                    sendNeedItem(player, new ItemStack(item, itemCount), ` §rto activate this copper battery slot!`);
                    return;
                }
                setCustomState(block, ACTIVATION_STATE, 1);
                block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
                player.runCommand(`clear @s ${item} -1 ${itemCount}`);
            }
            if (chargeType == "player_charge") {
                if (getScore(player, playerChargeObjective) < chargeMin) {
                    player.sendMessage(`You need §a${chargeMin} §rCharges to activate this battery slot`);
                    return;
                }
                setCustomState(block, ACTIVATION_STATE, 1);
                block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
                removeScore(player, "auric_charge", chargeMin);
            }
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:crystall_support", {
        onTick({ block, dimension }, parameters): void {
            if (!block.isValid) return;
            const support = crystallSupport(block);
            if (!support) return;
            if (!support.isAir && !support.isLiquid) return;

            const dropId = strParam(readParams(parameters), "drop_item");
            const loc = block.location;
            const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
            dimension.setBlockType(loc, "minecraft:air");
            if (dropId) dimension.spawnItem(new ItemStack(dropId, 1), center);
            dimension.playSound("dig.amethyst", center);
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:item_charger", {
        onPlayerInteract({ player, block, dimension }, parameters): void {
            if (!player) return;
            const params = readParams(parameters);
            const item = strParam(params, "item");
            if (!item) return;
            const maxBatteryStack = numParam(params, "max_battery_stack") || 4;
            const soundInput = strParam(params, "sound_input");
            const soundPickup = strParam(params, "sound_pickup");
            const itemData = new ItemStack(item);

            const batteryCount = Number(getCustomState(block, "ph:battery_count") ?? 0);
            const batteryState = getCustomState(block, "ph:battery_state");

            const mainhand = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
            if (!mainhand) return;
            const itemStack = mainhand.getItem();
            const durability = itemStack?.getComponent("minecraft:durability");
            if (batteryState == "result") {
                for (let i = 0; i < batteryCount; i++) {
                    dimension.spawnItem(itemData, block.center());
                }
                if (soundPickup) dimension.playSound(soundPickup, block.center());
                setCustomState(block, "ph:battery_count", 0);
                setCustomState(block, "ph:battery_state", "open");
                return;
            }
            if (batteryState == "processing") return;
            if (itemStack?.typeId === item && durability && durability.damage < durability.maxDurability) {
                if (batteryCount >= maxBatteryStack) return player.sendMessage("§cThe Battery slot is full.");
                mainhand.setItem(undefined);
                setCustomState(block, "ph:battery_count", batteryCount + 1);
                if (soundInput) dimension.playSound(soundInput, block.center());
                return;
            }
            if (batteryCount == 0) {
                player.sendMessage({
                    rawtext: [
                        { text: "You need to put drained §a" },
                        { translate: `${itemData.localizationKey}` }
                    ]
                });
                player.playSound("note.bass");
                return;
            }
            setCustomState(block, "ph:battery_state", "processing");
        },
        onTick({ block, dimension }): void {
            if (getCustomState(block, "ph:battery_state") != "processing") return;
            setCustomState(block, "ph:battery_state", "result");
            dimension.playSound("random.orb", block.center());
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:sky_gateway", {
        onPlayerInteract({ block, dimension }): void {
            const active = !getCustomState(block, "ph:active");
            setCustomState(block, "ph:active", active);
            dimension.playSound(active ? "beacon.activate" : "beacon.deactivate", block.center());
        },
        onTick({ block, dimension }): void {
            if (!getCustomState(block, "ph:active")) return;
            const center = block.center();
            dimension.spawnParticle("ph:sky_gateway_beam_up", center);
            dimension.spawnParticle("ph:sky_gateway_beam_down", center);
            dimension.spawnParticle("ph:sky_gateway_beam_sparkle", center);

            for (const dir of [1, -1]) {
                const pulse = new MolangVariableMap();
                pulse.setFloat("variable.dir", dir);
                dimension.spawnParticle("ph:sky_gateway_beam_pulse", center, pulse);
            }
        }
    });

    initEvent.blockComponentRegistry.registerCustomComponent("ph:icon_only", {
        beforeOnPlayerPlace(event): void {
            event.cancel = true;
        }
    });
}

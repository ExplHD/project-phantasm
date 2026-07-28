import { world, system, ItemStack, MolangVariableMap, EquipmentSlot, EntityDamageCause, Player } from '@minecraft/server'
import { setScore, getScore, addScore, removeScore, applyDurabilityDamage, unstuckPlayer, runUntilMoved, getAccessoryItems } from './main'
import { weaponSkills } from './data/weapon_skills'
import * as Phantasm from './phantasmConstants'
import { handleAccessory } from './accessoriesRuntime'
import { loadScoreboards, onPlayerSpawn } from './loader'
import { onDamageIndicator } from './damage_indicator'
import { onDummyHurt } from './dummy'
import { onDynamicLighting } from './dynamicLighting'
import { dashRuntime, windPlungeRuntime, vanillaBlockInteractFix, parryRuntime, startBetterMending, javaSaturationRegen, healthBarRuntime, specifiedFamilityAndSpeed } from './vanilla_manipulation'
import { weapons, switcherSkills } from './weapons'

// ======================================== World Before Events ========================================

world.beforeEvents.entityHurt.subscribe((acc) => {
    const hurtEntity = acc.hurtEntity;
    const damagingEntity = acc.damageSource.damagingEntity;

    handleAccessory(hurtEntity, "onHurt", acc);
    if (hurtEntity.typeId === "minecraft:player" && hurtEntity?.hasTag("parried")) {
        acc.cancel = true;
        system.run(() => {
            const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
            hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
            (hurtEntity as Player).dimension.spawnParticle(
                "ph:parry_invert_flash",
                {
                    x: hurtEntity.getHeadLocation().x + hurtEntity.getViewDirection().x * 1,
                    y: hurtEntity.getHeadLocation().y + hurtEntity.getViewDirection().y * 1,
                    z: hurtEntity.getHeadLocation().z + hurtEntity.getViewDirection().z * 1
                }
            )
            hurtEntity.runCommand('camerashake add @s 1 0.1 positional');
            hurtEntity.dimension.playSound("weapon_slash.slash_clash", hurtEntity.location);
            hurtEntity.removeTag("parried");
            if (mainItem?.typeId === "ph:seiketsu") {
                applyDurabilityDamage(hurtEntity, { damage: 1 });
                return;
            }
            applyDurabilityDamage(hurtEntity, { damage: 30 });
        })
    }
    if (getAccessoryItems(hurtEntity as Player).some(item => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === "ph:the_bleeding_spire") {
        if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
    }
})

world.beforeEvents.playerBreakBlock.subscribe((acc) => {
    const block = acc.block;
    const player = acc.player;

    handleAccessory(player, "onBreakBlock", acc, block);
})

world.beforeEvents.entityHurt.subscribe(data => {
    const player = data.hurtEntity;
    const cause = data?.damageSource?.cause;
    if (cause === "fall" || cause === "magic" || cause == "none" || cause == "selfDestruct") return;

    if (data.damage <= 0) return;

    const inventory = player.getComponent("minecraft:equippable");
    if (!inventory) return;

    const armorSlots = ["Head", "Chest", "Legs", "Feet"];
    let totalToughness = 0;

    for (const slot of armorSlots) {
        const item = inventory.getEquipment(slot as EquipmentSlot);
        if (!item || !item.getTags) continue;

        const tags = item.getTags();
        for (const tag of tags) {
            if (tag.startsWith("ph:toughness-")) {
                const val = parseFloat(tag.split("-")[1]);
                if (!isNaN(val)) totalToughness += val;
            }
        }
    }

    if (totalToughness <= 0) return;

    const armorPoints = player.getComponent("equippable")?.totalArmor ?? 0;

    const innerMax = Math.max(
        armorPoints / 5,
        armorPoints - (4 * data.damage) / (Math.min(totalToughness, 20) + 8)
    );

    const minResult = Math.min(20, innerMax);

    const reductionFraction = minResult / 25;

    const finalDamage = data.damage * (1 - reductionFraction);

    // console.warn(`Toughness: ${totalToughness}, originalDamage: ${data.damage}, restoredDamage: ${finalDamage.toFixed(2)}`);
    data.damage -= finalDamage;
});

world.beforeEvents.playerBreakBlock.subscribe((e) => {
    const player = e.player;
    const itemStack = e.itemStack;
    const block = e.block;
    const dimension = e.dimension;

    let blockAndItems = [
        {
            block: "minecraft:prismarine",
            item: new ItemStack("minecraft:prismarine_shard", Math.floor(Math.random() * (7 - 4) + 4)),
            item_tag: "minecraft:is_pickaxe",
            tool: undefined
        }
    ]

    if (block.typeId.includes("ore")) {
        const randomChance = Math.floor(Math.random() * 100);
        console.warn(`Random Chance : ${randomChance}`)
        if (player.getGameMode() === "Creative") return;
        if (randomChance != 1) return;
        system.run(() => {
            dimension.spawnItem(new ItemStack("ph:rust_coin", 1), block.location);
        })
    }

    for (const splittedData of blockAndItems) {
        if (block.typeId === splittedData.block) {
            const tags = itemStack?.getTags();
            const enchantment = itemStack?.getComponent("enchantable")?.getEnchantment("silk_touch");
            const gameMode = player.getGameMode();
            if (gameMode == "Creative") return;
            if (enchantment) return;
            if (!enchantment && tags != undefined && splittedData.item_tag && tags.includes(splittedData.item_tag)) {
                e.cancel = true;
                system.run(() => {
                    dimension.setBlockType(block.location, "minecraft:air");
                    dimension.spawnItem(splittedData.item, block.location);
                })
            } else {
                if (!splittedData.tool) {
                    return;
                }
                if (itemStack?.typeId == splittedData.tool) {
                    system.run(() => {
                        dimension.spawnItem(splittedData.item, block.location);
                    })
                }
            }
        }
    }
})

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, itemStack: item, block } = event;
    vanillaBlockInteractFix(player, item, block);
})

// ======================================== World After Events ========================================

world.afterEvents.entityHitEntity.subscribe((acc) => {
    const damagingEntity = acc.damagingEntity;
    const hitEntity = acc.hitEntity;

    handleAccessory(damagingEntity, "onHitEntity", acc, hitEntity);
})

world.afterEvents.entityHurt.subscribe(onDamageIndicator)
world.afterEvents.entityHurt.subscribe(onDummyHurt)

world.afterEvents.playerInventoryItemChange.subscribe(({ player }) => {
    onDynamicLighting(player);
})

world.afterEvents.worldLoad.subscribe(() => {
    loadScoreboards()
})

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    onPlayerSpawn(player, initialSpawn)
})

world.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
    for (const weapon of weapons) {
        if (heldItemStack?.typeId === weapon.itemId) {
            if (swingSource != "Mine" && swingSource != "Attack") return;
            weapon.handleAttack(player);
        }
    }
})

world.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
    const equippedItem = source?.getComponent('equippable')?.getEquipment(EquipmentSlot.Mainhand);

    if (button == "Jump" && newButtonState == "Pressed") {
        dashRuntime(source);
    }

    if (button == "Sneak" && newButtonState == "Pressed") {
        windPlungeRuntime(source);
    }

    if (!equippedItem) return;

    for (const ss of switcherSkills) {
        if (equippedItem.typeId === ss.itemId && button === "Sneak" && newButtonState == "Pressed") {
            if (!source.isSneaking) return;
            ss.switchSkill(source);
        }
    }
})

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (!itemStack) return;
    parryRuntime(source, itemStack);
    startBetterMending(source, itemStack);

    for (const skill of weaponSkills) {
        if (itemStack.typeId === skill.itemId) {
            skill.useSkill(source);
        }
    }
})

world.afterEvents.entityDie.subscribe(({ damageSource, deadEntity }) => {
    const killer = damageSource?.damagingEntity;
    if (!killer?.isValid) return;
    const mainhand = killer?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);

    if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
        addScore(killer, "auric_charge", 4);
        deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
    }
})

world.afterEvents.playerInventoryItemChange.subscribe(({ player }) => {
    const container = player.getComponent("inventory")?.container;
    if (!container) return;

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item) continue;
        const expectedLore =
            Phantasm.addLore.get(item.typeId) ??
            (item.typeId.startsWith("ph:") ? ["§9Phantasm"] : undefined);
        if (!expectedLore) continue;
        const currentLore = item.getLore() ?? [];
        const isSame =
            currentLore.length === expectedLore.length &&
            currentLore.every((line, index) => line === expectedLore[index]);
        if (isSame) continue;
        item.setLore(expectedLore);
        container.setItem(i, item);
    }

    for (let i = 0; i < container.size; i++) {
        const itemA = container.getItem(i);
        if (!itemA || itemA.amount >= itemA.maxAmount) continue;

        for (let j = i + 1; j < container.size; j++) {
            const itemB = container.getItem(j);
            if (!itemB) continue;
            if (!itemA.isStackableWith(itemB)) continue;

            const spaceLeft = itemA.maxAmount - itemA.amount;
            if (spaceLeft <= 0) break;

            const moveAmount = Math.min(spaceLeft, itemB.amount);
            itemA.amount += moveAmount;
            container.setItem(i, itemA);

            if (moveAmount >= itemB.amount) {
                container.setItem(j, undefined);
            } else {
                itemB.amount -= moveAmount;
                container.setItem(j, itemB);
            }
        }
    }
});

world.afterEvents.entityHealthChanged.subscribe(({ entity }) => {
    if (!entity.isValid) return;
    healthBarRuntime(entity as Player, "healthChanged");
})

world.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack }) => {
    healthBarRuntime(player, "inventoryItemChanged", beforeItemStack, itemStack);
})

world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
    healthBarRuntime(player, "dimensionChanged");
})

world.afterEvents.playerGameModeChange.subscribe(({ player, toGameMode }) => {
    healthBarRuntime(player, "gamemodeChanged");
})

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    if (cause != "Spawned") return;
    if (!entity.isValid) return;
    let RUN_INTERVAL_ANIMATED_TP: number | undefined;
    const family = entity?.getComponent("minecraft:type_family")?.getTypeFamilies();
    if (!family) return;
    const matchedFamily = specifiedFamilityAndSpeed.find(data =>
        family.includes(data.type_family)
    );

    if (entity?.isValid && matchedFamily) {
        if (RUN_INTERVAL_ANIMATED_TP === undefined) {
            const headLoc = entity?.getViewDirection();
            const dx = headLoc.x;
            const dy = headLoc.y;
            const dz = headLoc.z;

            RUN_INTERVAL_ANIMATED_TP = system.runInterval(() => {
                if (!entity?.isValid) {
                    system.clearRun(RUN_INTERVAL_ANIMATED_TP!);
                    return;
                }

                const SPEED = matchedFamily.speed;

                entity?.teleport({
                    x: entity.location.x + dx * SPEED,
                    y: entity.location.y + dy * SPEED,
                    z: entity.location.z + dz * SPEED
                });
            }, 1);
        }
    }
})

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        javaSaturationRegen(player);
    }
}, 6);

// ======================================== System After Events ========================================

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceBlock, sourceEntity }) => {
    const parseMessage = (message: string) => message.split(",").map(v => v.trim());
    switch (id) {
        case "ph:remove_target_lock":
            if (!sourceEntity) return;
            system.runTimeout(() => {
                sourceEntity.removeTag("locked")
            }, 5)
            break;
        case "ph:boss_summon_projectile":
            if (!sourceEntity) return;
            const [amount, yOffset, typeId, sound] =
                parseMessage(message).map(v =>
                    isNaN(Number(v)) ? v : Number(v)
                ) as [number, number, string, string];
            sourceEntity.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 1 0.3`)
            for (let i = 0; i < amount; i++) {
                const { x, y, z } = sourceEntity.location;
                const randXRot = Math.floor(Math.random() * 360)
                sourceEntity.runCommand(`summon ${typeId} ${x} ${y + yOffset} ${z} ${randXRot} 0`)
            }
            break;
        case "ph:boss_summon_projectile_with_y_facing":
            if (!sourceEntity) return;
            const [amountRT, yOffsetRT, typeIdRT, soundRT] =
                parseMessage(message).map(v =>
                    isNaN(Number(v)) ? v : Number(v)
                ) as [number, number, string, string];
            sourceEntity.runCommand(`playsound ${soundRT} @a[r=32] ~~~ 1 1 0.3`)
            for (let i = 0; i < amountRT; i++) {
                const { x, y, z } = sourceEntity.location;
                const randXRot = Math.floor(Math.random() * 360);
                const randYRot = Math.floor(-90 + Math.random() * 180);
                sourceEntity.runCommand(`summon ${typeIdRT} ${x} ${y + yOffsetRT} ${z} ${randXRot} ${randYRot}`)
            }
            break;
        case "ph:boss_summon":
            if (!sourceEntity) return;
            const [number, yAxis, radius, id2, sound2, spawnEvent] =
                parseMessage(message).map(v =>
                    isNaN(Number(v)) ? v : Number(v)
                ) as [number, number, number, string, string, string | undefined];

            sourceEntity.runCommand(`playsound ${sound2} @a[r=32] ~~~ 1 1 0.3`);

            for (let i = 0; i < number; i++) {
                const { x, y, z } = sourceEntity.location;

                const offsetX = (Math.random() * 2 - 1) * radius;
                const offsetZ = (Math.random() * 2 - 1) * radius;

                if (spawnEvent) {
                    sourceEntity.runCommand(`summon ${id2} ${x + offsetX} ${y + yAxis} ${z + offsetZ} ${Math.floor(Math.random() * 360)} 0 ${spawnEvent}`);
                } else {
                    sourceEntity.runCommand(`summon ${id2} ${x + offsetX} ${y + yAxis} ${z + offsetZ} ${Math.floor(Math.random() * 360)} 0 `);
                }
            }
            break;
        case "ph:ram_dash":
            if (!sourceEntity) return;
            const ramDirection = sourceEntity.getViewDirection();

            const ramDash = message.split(",");
            const force = Number(ramDash[0]);
            const ramDamage = Number(ramDash[1]);
            const collisionRadius = Number(ramDash[2]);
            sourceEntity.applyImpulse({ x: ramDirection.x * force, y: 0, z: ramDirection.z * force });
            beginCollisionCheck(sourceEntity, 14, ramDamage, collisionRadius);
            sourceEntity.runCommand(`playsound ${ramDash[3]} @a[r=32] ~~~ 1 1 0.3`);
            break;
        case "ph:laser_once":
            if (!sourceEntity) return;
            const laserBeamOnce = message.split(",");
            const range = Number(laserBeamOnce[0]);
            const damage2 = Number(laserBeamOnce[1]);
            const width = Number(laserBeamOnce[2]);
            fireLaserOnce(sourceEntity, range, damage2, width);
            sourceEntity.runCommand(`playsound ${laserBeamOnce[3]} @a[r=32] ~~~ 1 1 0.3`);
            break;
        case "ph:boss_laser_beam":
            if (!sourceEntity) return;
            const laserBeamHold = message.split(",");
            const charge = Number(laserBeamHold[0]);
            const duration = Number(laserBeamHold[1]);
            const range2 = Number(laserBeamHold[2]);
            const damagePerTick = Number(laserBeamHold[3]);
            const width2 = Number(laserBeamHold[4]);
            bossLaserBeam(sourceEntity, charge, duration, range2, damagePerTick, width2);
            sourceEntity.runCommand(`playsound ${laserBeamHold[5]} @a[r=32] ~~~ 1 0.8 0.3`);
            break;
        case "ph:cruxshaper_charge_particle":
            if (!sourceEntity) return;
            const particleAmount = getScore(sourceEntity, "cruxshaper_damage");
            const molang = new MolangVariableMap();

            molang.setFloat("variable.spawn_rate", Number(particleAmount));
            sourceEntity.dimension.spawnParticle("ph:cruxshaper_charge_arc", sourceEntity.location, molang);
            break;
        case "ph:particle_custom":
            system.run(() => {
                const particleMolang = new MolangVariableMap();

                particleMolang.setFloat("variable.spawn_rate", Number(message));
                if (sourceBlock) {
                    sourceBlock.dimension.spawnParticle("ph:bounding_circle", sourceBlock.center(), particleMolang);
                }
            })
            break;
        default: break;
    }
})

// ======================================== Helper Functions (moved from attack_sets) ========================================

function distancePointToSegment(point: { x: number; y: number; z: number }, start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): number {
    const px = point.x;
    const py = point.y;
    const pz = point.z;

    const sx = start.x;
    const sy = start.y;
    const sz = start.z;

    const ex = end.x;
    const ey = end.y;
    const ez = end.z;

    const dx = ex - sx;
    const dy = ey - sy;
    const dz = ez - sz;

    const lengthSquared = dx * dx + dy * dy + dz * dz;

    if (lengthSquared === 0) {
        return Math.sqrt(
            (px - sx) ** 2 +
            (py - sy) ** 2 +
            (pz - sz) ** 2
        );
    }

    let t = (
        (px - sx) * dx +
        (py - sy) * dy +
        (pz - sz) * dz
    ) / lengthSquared;

    t = Math.max(0, Math.min(1, t));

    const closestX = sx + t * dx;
    const closestY = sy + t * dy;
    const closestZ = sz + t * dz;

    return Math.sqrt(
        (px - closestX) ** 2 +
        (py - closestY) ** 2 +
        (pz - closestZ) ** 2
    );
}

function beginCollisionCheck(dasher: any, duration: number, damage: number, collisionRadius: number) {
    let tick = 0;
    let prevPos = { ...dasher.location };

    const hitEntities = new Set<string>();

    const interval = system.runInterval(() => {
        if (!dasher || !dasher.isValid) {
            system.clearRun(interval);
            return;
        }

        tick++;

        const currentPos = dasher.location;
        const dim = dasher.dimension;

        const entities = dim.getEntities({
            location: currentPos,
            maxDistance: collisionRadius + 50
        });

        for (const target of entities) {
            if (!target.isValid) continue;
            if (target.hasTag("parried")) continue;
            if (target.id === dasher.id) continue;
            if (hitEntities.has(target.id)) continue;

            const dist = distancePointToSegment(
                target.location,
                prevPos,
                currentPos
            );

            if (dist <= collisionRadius) {
                hitEntities.add(target.id);

                target.applyDamage(damage, {
                    cause: EntityDamageCause.entityAttack,
                    damagingEntity: dasher
                });
            }
        }

        prevPos = { ...currentPos };

        if (tick >= duration) {
            system.clearRun(interval);
        }
    });
}

function fireLaserOnce(shooter: any, range: number, damage: number, width: number) {
    const start = shooter.location;
    const dir = shooter.getViewDirection();

    const end = {
        x: start.x + dir.x * range,
        y: start.y + dir.y * range,
        z: start.z + dir.z * range
    };

    const dim = shooter.dimension;

    const entities = dim.getEntities({
        location: start,
        maxDistance: range
    });

    for (const target of entities) {
        if (!target.isValid) continue;
        if (target.id === shooter.id) continue;

        const dist = distancePointToSegment(
            target.location,
            start,
            end
        );

        if (dist <= width) {
            target.applyDamage(damage, {
                cause: EntityDamageCause.magic,
                damagingEntity: shooter
            });
        }
    }
}

function bossLaserBeam(boss: any, charge: number, duration: number, range: number, damagePerTick: number, width: number) {
    let tick = 0;
    let chargeTime = charge;

    const chargeInterval = system.runInterval(() => {
        if (!boss || !boss.isValid) {
            system.clearRun(chargeInterval);
            return;
        }

        const start = boss.location;
        const dir = boss.getViewDirection();
        for (let i = 0; i < range; i += 1.5) {
            const point = {
                x: start.x + dir.x * i,
                y: start.y + 1 + dir.y * i,
                z: start.z + dir.z * i
            };

            boss.dimension.spawnParticle("minecraft:basic_smoke_particle", point);
        }

        chargeTime--;

        if (chargeTime <= 0) {
            system.clearRun(chargeInterval);
            startLaser();
        }
    });

    function startLaser() {
        const interval = system.runInterval(() => {
            if (!boss || !boss.isValid) {
                system.clearRun(interval);
                return;
            }

            tick++;

            const start = boss.location;
            const dir = boss.getViewDirection();

            const end = {
                x: start.x + dir.x * range,
                y: start.y + dir.y * range,
                z: start.z + dir.z * range
            };

            const dim = boss.dimension;

            const entities = dim.getEntities({
                location: start,
                maxDistance: range
            });

            for (let i = 0; i < range; i += 0.8) {
                const point = {
                    x: start.x + dir.x * i,
                    y: start.y + 1 + dir.y * i,
                    z: start.z + dir.z * i
                };

                dim.spawnParticle("minecraft:vilager_happy", point);
            }

            for (const target of entities) {
                if (!target.isValid) continue;
                if (target.id === boss.id) continue;
                if (target.hasTag("parried")) continue;

                const dist = distancePointToSegment(
                    target.location,
                    start,
                    end
                );

                if (dist <= width) {
                    target.applyDamage(damagePerTick, {
                        cause: "magic",
                        damagingEntity: boss
                    });
                }
            }

            if (tick >= duration) {
                system.clearRun(interval);
            }
        });
    }
}

import { world, system, ItemStack, MolangVariableMap, EquipmentSlot, EntityDamageCause, Player } from '@minecraft/server'
import { setScore, getScore, addScore } from '../core/scoreboard'
import { applyDurabilityDamage } from '../core/items'
import { getAccessoryItems } from '../core/player'
import { weaponSkills } from '../features/weapons/weaponSkills'
import { handleAccessory } from '../systems/accessories'
import { loadScoreboards, onPlayerSpawn } from './loader'
import { onDamageIndicator } from '../systems/damageIndicator'
import { onDummyHurt } from '../systems/combatDummy'
import { clearPlayerLighting, onDynamicLighting } from '../systems/lighting'
import { windPlungeRuntime, vanillaBlockInteractFix, parryRuntime, startBetterMending, javaSaturationRegen, healthBarRuntime, specifiedFamilityAndSpeed } from '../systems/movement'
import { onControlButtonInput, onControlSwingInput, clearControlState } from '../systems/controls'
import { weapons } from '../features/weapons/weapons'

// ======================================== World Before Events ========================================

world.beforeEvents.entityHurt.subscribe((acc) => {
    const hurtEntity = acc.hurtEntity;

    // Accessories only exist on players, so every mob hurt event bails out here instead
    // of running the equipment scan twice for a result that is always empty.
    if (hurtEntity?.typeId !== "minecraft:player") return;

    const damagingEntity = acc.damageSource.damagingEntity;
    // One scan, reused by both the accessory hooks and the crimson laser check below.
    const player = hurtEntity as Player;
    const accessories = getAccessoryItems(player);

    handleAccessory(player, "onHurt", acc, undefined, accessories);
    if (hurtEntity.hasTag("parried")) {
        acc.cancel = true;
        system.run(() => {
            const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
            const head = hurtEntity.getHeadLocation();
            const view = hurtEntity.getViewDirection();
            hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
            (hurtEntity as Player).dimension.spawnParticle(
                "ph:parry_invert_flash",
                {
                    x: head.x + view.x,
                    y: head.y + view.y,
                    z: head.z + view.z
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
    if (accessories.some(item => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === "ph:the_bleeding_spire") {
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

// Ore blocks have a 1% chance to drop a rust coin, checked before the prismarine rule.
world.beforeEvents.playerBreakBlock.subscribe((e) => {
    if (!e.block.typeId.includes("ore")) return;
    if (Math.floor(Math.random() * 100) !== 1) return;
    if (e.player.getGameMode() === "Creative") return;
    system.run(() => {
        e.dimension.spawnItem(new ItemStack("ph:rust_coin", 1), e.block.location);
    })
})

// Prismarine drops a random shard stack when broken with a pickaxe and no Silk Touch.
// The typeId is matched first so an ordinary block break never allocates the ItemStack
// (the shard amount is rolled inside the branch, so it still varies per break).
world.beforeEvents.playerBreakBlock.subscribe((e) => {
    if (e.block.typeId !== "minecraft:prismarine") return;

    const player = e.player;
    const itemStack = e.itemStack;
    const block = e.block;
    const dimension = e.dimension;

    if (player.getGameMode() === "Creative") return;
    if (itemStack?.getComponent("enchantable")?.getEnchantment("silk_touch")) return;
    if (!itemStack?.getTags().includes("minecraft:is_pickaxe")) return;

    e.cancel = true;
    system.run(() => {
        dimension.setBlockType(block.location, "minecraft:air");
        dimension.spawnItem(new ItemStack("minecraft:prismarine_shard", Math.floor(Math.random() * 3 + 4)), block.location);
    })
})

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, itemStack: item, block } = event;
    vanillaBlockInteractFix(player, item, block);
})

// ======================================== Crystall support pop ========================================
// onTick di block JSON tidak jalan untuk block hasil world-gen/structure karena
// tidak pernah masuk antrian random tick, jadi pop dicek secara global di sini.

const crystallDrops: Record<string, string> = {
    "ph:small_crystall_bud": "ph:small_crystall_bud_item",
    "ph:large_crystall_bud": "ph:large_crystall_bud_item",
    "ph:crystall_cluster": "ph:crystall_cluster_item"
};

const crystallDropIds = new Set(Object.keys(crystallDrops));

// The six face neighbours, hoisted out of the handlers so the safety-net sweep does not
// rebuild the array for every player on every pass.
const faceOffsets = [
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }
];

function getCrystallSupport(block: any) {
    let face: string;
    try {
        face = block.permutation.getState("minecraft:block_face");
    } catch {
        return undefined;
    }
    switch (face) {
        case "up": return block.below();
        case "down": return block.above();
        // block_face = face support yang diklik, jadi support ada di arah lawan
        case "north": return block.south();
        case "south": return block.north();
        case "east": return block.west();
        case "west": return block.east();
        default: return undefined;
    }
}

function popCrystallIfFloating(block: any, drop = true): boolean {
    if (!block?.isValid) return false;
    const typeId: string = block.typeId;
    if (!crystallDropIds.has(typeId)) return false;
    const dropId: string | undefined = crystallDrops[typeId];
    const support = getCrystallSupport(block);
    if (!support) return false;
    if (!support.isAir && !support.isLiquid) return false;
    const loc = block.location;
    const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
    block.dimension.setBlockType(loc, "minecraft:air");
    if (drop) {
        try {
            block.dimension.spawnItem(new ItemStack(dropId, 1), center);
        } catch (err) {
            console.warn(`[ph] crystall drop failed for ${typeId}: ${err}`);
        }
    }
    try {
        block.dimension.playSound("dig.amethyst", center);
    } catch { }
    return true;
}

// Pop instan saat player menghancurkan block penyangga (berlaku untuk semua
// penempatan: manual, lama, maupun hasil structure/world-gen)
world.afterEvents.playerBreakBlock.subscribe((e) => {
    const loc = e.block.location;
    const dimension = e.dimension;
    let drop = true;
    try {
        drop = e.player?.getGameMode?.() !== "Creative";
    } catch { }
    system.run(() => {
        for (const off of faceOffsets) {
            try {
                const neighbor = dimension.getBlock({ x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z });
                if (neighbor) popCrystallIfFloating(neighbor, drop);
            } catch { }
        }
    });
});

// ======================================== World After Events ========================================

world.afterEvents.entityHitEntity.subscribe((acc) => {
    const damagingEntity = acc.damagingEntity;
    const hitEntity = acc.hitEntity;

    handleAccessory(damagingEntity, "onHitEntity", acc, hitEntity);
})

world.afterEvents.entityHurt.subscribe(onDamageIndicator)
world.afterEvents.entityHurt.subscribe(onDummyHurt)

// One subscription for the two things an inventory change triggers (dynamic lighting and
// the health bar). The stack merge used to sit here too, alongside a lore pass that
// re-applied addLore to every item on every pickup; descriptions now come from the native
// tile.<id>.tooltip keys in packs/RP/texts/en_US.lang, so only the merge is left.
world.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack }) => {
    onDynamicLighting(player);

    const container = player.getComponent("inventory")?.container;
    if (container) {
        const filled: { slot: number; item: any }[] = [];

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item) continue;

            filled.push({ slot: i, item });
        }

        // Merge partial stacks into earlier ones. Every full stack stays in the list as a
        // source, only a full target is skipped.
        for (let a = 0; a < filled.length; a++) {
            const slotA = filled[a];
            const itemA = slotA.item;
            if (itemA.amount >= itemA.maxAmount) continue;

            for (let b = a + 1; b < filled.length; b++) {
                const slotB = filled[b];
                const itemB = slotB.item;
                if (!itemA.isStackableWith(itemB)) continue;

                const spaceLeft = itemA.maxAmount - itemA.amount;
                if (spaceLeft <= 0) break;

                const moveAmount = Math.min(spaceLeft, itemB.amount);
                itemA.amount += moveAmount;
                container.setItem(slotA.slot, itemA);

                if (moveAmount >= itemB.amount) {
                    container.setItem(slotB.slot, undefined);
                } else {
                    itemB.amount -= moveAmount;
                    container.setItem(slotB.slot, itemB);
                }
            }
        }
    }

    healthBarRuntime(player, "inventoryItemChanged", beforeItemStack, itemStack);
})

world.afterEvents.worldLoad.subscribe(() => {
    loadScoreboards()
})

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
	onPlayerSpawn(player, initialSpawn)
    onDynamicLighting(player)
})

world.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
    onControlSwingInput(player, swingSource);

    for (const weapon of weapons) {
        if (heldItemStack?.typeId === weapon.itemId) {
			if (swingSource != "Mine" && swingSource != "Attack") return;
            weapon.handleAttack(player);
        }
    }
})

world.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
    if (newButtonState != "Pressed") return;

    if (button == "Sneak") {
        windPlungeRuntime(source);
    }

    // Jump and Sneak also drive the player-bound control schemes from /setting.
    onControlButtonInput(source, button);
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
	if (deadEntity?.typeId === "minecraft:player") {
		try {
			clearPlayerLighting(deadEntity as Player);
		} catch (e) {
			// Ignore cleanup errors for invalid entities
		}
	}
	if (!killer?.isValid) return;
    const mainhand = killer?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);

    if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
        addScore(killer, "auric_charge", 4);
        deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
    }
})

world.afterEvents.entityHealthChanged.subscribe(({ entity }) => {
    if (!entity.isValid) return;
    healthBarRuntime(entity as Player, "healthChanged");
})

world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
    healthBarRuntime(player, "dimensionChanged");
})

world.afterEvents.playerGameModeChange.subscribe(({ player, toGameMode }) => {
    healthBarRuntime(player, "gamemodeChanged");
})

// Family -> speed for the "animated_tp" entity families, looked up instead of scanning the
// config list (with an array allocation per family) on every single entity spawn.
const animatedTpSpeeds = new Map<string, number>(
    specifiedFamilityAndSpeed.map(data => [data.type_family, data.speed])
);

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    if (cause != "Spawned") return;
    if (!entity.isValid) return;

    const family = entity?.getComponent("minecraft:type_family")?.getTypeFamilies();
    if (!family) return;

    let speed: number | undefined;
    for (const typeFamily of family) {
        const matched = animatedTpSpeeds.get(typeFamily);
        if (matched !== undefined) {
            speed = matched;
            break;
        }
    }
    if (speed === undefined) return;

    // Direction is sampled once, so the entity keeps drifting along it.
    const dir = entity.getViewDirection();
    const dx = dir.x;
    const dy = dir.y;
    const dz = dir.z;

    const interval = system.runInterval(() => {
        if (!entity?.isValid) {
            system.clearRun(interval);
            return;
        }

        entity?.teleport({
            x: entity.location.x + dx * speed,
            y: entity.location.y + dy * speed,
            z: entity.location.z + dz * speed
        });
    }, 1);
})

world.beforeEvents.playerLeave.subscribe(({ player }) => {
    clearPlayerLighting(player);
    clearControlState(player);
});

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        javaSaturationRegen(player);
    }
}, 6);

// Safety net: pop bud/cluster world-gen yang sudah telanjur melayang
// (support hilang sebelum script ini ada / hancur oleh ledakan / command).
// Tiap 2 detik, box kecil di sekitar player biar murah.
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            const base = player.location;
            const dimension = player.dimension;
            const bx = Math.floor(base.x);
            const by = Math.floor(base.y);
            const bz = Math.floor(base.z);
            const HR = 5;
            const VR = 4;
            for (let dx = -HR; dx <= HR; dx++) {
                for (let dy = -VR; dy <= VR; dy++) {
                    for (let dz = -HR; dz <= HR; dz++) {
                        let block: any;
                        try {
                            block = dimension.getBlock({ x: bx + dx, y: by + dy, z: bz + dz });
                        } catch {
                            continue;
                        }
                        if (block && crystallDropIds.has(block.typeId)) {
                            popCrystallIfFloating(block, true);
                        }
                    }
                }
            }
        } catch { }
    }
}, 40);

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
        case "ph:ram_dash_3d":
            if (!sourceEntity) return;
            const ramDirection3d = sourceEntity.getViewDirection();

            const ramDash3d = message.split(",");
            const force3d = Number(ramDash3d[0]);
            const ramDamage3d = Number(ramDash3d[1]);
            const collisionRadius3d = Number(ramDash3d[2]);
            sourceEntity.applyImpulse({ x: ramDirection3d.x * force3d, y: ramDirection3d.y * force3d, z: ramDirection3d.z * force3d });
            beginCollisionCheck(sourceEntity, 14, ramDamage3d, collisionRadius3d, ramDash3d[4]);
            sourceEntity.runCommand(`playsound ${ramDash3d[3]} @a[r=32] ~~~ 1 1 0.3`);
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

function beginCollisionCheck(dasher: any, duration: number, damage: number, collisionRadius: number, spareFamily?: string) {
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
            if (spareFamily && target.getComponent("minecraft:type_family")?.getTypeFamilies()?.includes(spareFamily)) continue;

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

import { world, system, ItemStack, MolangVariableMap, EquipmentSlot, Player, type Block } from '@minecraft/server'
import { getScore, addScore } from '../core/scoreboard'
import { applyDurabilityDamage } from '../core/items'
import { getAccessoryItems } from '../core/player'
import { isLoadedLocation } from '../core/location'
import { crystallSupport } from '../core/blocks'
import { weaponSkills } from '../features/weapons/weaponSkills'
import { accessoryOnHurt, accessoryOnHitEntity, accessoryOnBreakBlock } from '../systems/accessories'
import { onDamageIndicator } from '../systems/damageIndicator'
import { onDummyHurt } from '../systems/combatDummy'
import { onTitanCoreHurt, onTitanCoreDie } from '../features/titan_core/manager'
import { onSentinelSpawn, onSentinelHurt, onSentinelHit, onSentinelDie } from '../features/ancient_sentinel/manager'
import { clearPlayerLighting, onDynamicLighting } from '../systems/lighting'
import { windPlungeRuntime, dashRuntime, vanillaBlockInteractFix, parryRuntime, startBetterMending, javaSaturationRegen, healthBarRuntime, specifiedFamilityAndSpeed, onAbsorptionAdded, onAbsorptionHurt, syncAbsorption, clearAbsorption } from '../systems/movement'
import { onControlButtonInput, onControlSwingInput, clearControlState, type ControlAction } from '../systems/controls'
import { weapons, switchHeldWeaponSkill } from '../features/weapons/weapons'
import { onMaceHurt, trackMaceFall } from '../features/mace/detection'
import { tickAccessories } from '../systems/accessories'
import { checkBlessingMilestones, onBlessingHurt, forgetWard } from '../systems/xeonniteBlessing'
import { onTrooperHurt, tickTroopers, onTrooperDie, onTrooperRemove } from '../features/forge_trooper/manager'
import { sweepSentinels } from '../features/ancient_sentinel/manager'
import { onPolarisItemUse, cancelPolarisCharge } from '../features/polaris_power/manager'
import { tickTitanRadiation } from '../features/titan_core/radiation'
import { tickShields, onShieldHurt, onShieldEffectAdd, onShieldSneak, onShieldSwing, onShieldItemUse, clearShieldState } from '../features/shield/manager'
import { tickTitanRidgeSites } from '../features/titan_core/sites'
import { trackLootItem, tickLootBeams } from '../systems/lootBeam'
import { bossSummon, bossSummonProjectile, bossSummonProjectileFacing, ramDash, laserOnce, crimsonDriftMark, crimsonDriftStrike } from '../features/bosses/attacks'

world.beforeEvents.entityHurt.subscribe((acc) => {
    const hurtEntity = acc.hurtEntity;

    if (hurtEntity?.typeId !== "minecraft:player") return;

    const damagingEntity = acc.damageSource.damagingEntity;

    const player = hurtEntity as Player;
    const accessories = getAccessoryItems(player);

    accessoryOnHurt(player, accessories);
    if (hurtEntity.hasTag("parried")) {
        acc.cancel = true;
        system.run(() => {
            if (!hurtEntity.isValid) return;
            const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
            const head = hurtEntity.getHeadLocation();
            const view = hurtEntity.getViewDirection();
            hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
            (hurtEntity as Player).dimension.spawnParticle(
                "ph:parry_flash",
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
                applyDurabilityDamage(player, { damage: 1 });
                return;
            }
            applyDurabilityDamage(player, { damage: 30 });
        })
    }
    if (accessories.some(item => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === "ph:the_bleeding_spire") {
        if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
    }
})

world.beforeEvents.playerBreakBlock.subscribe((acc) => {
    accessoryOnBreakBlock(acc.player, acc);
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

    data.damage -= finalDamage;
});

world.beforeEvents.entityHurt.subscribe(onMaceHurt)

world.beforeEvents.entityHurt.subscribe(onBlessingHurt)
world.beforeEvents.entityHurt.subscribe(onTrooperHurt)
world.beforeEvents.entityHurt.subscribe(onShieldHurt)

world.beforeEvents.effectAdd.subscribe(onShieldEffectAdd)

world.beforeEvents.itemUse.subscribe(onPolarisItemUse)

world.beforeEvents.playerBreakBlock.subscribe((e) => {
    if (!e.block.typeId.includes("ore")) return;
    if (Math.floor(Math.random() * 100) !== 1) return;
    if (e.player.getGameMode() === "Creative") return;
    const { dimension, block } = e;
    system.run(() => {
        if (!isLoadedLocation(dimension, block.location)) return;
        dimension.spawnItem(new ItemStack("ph:rust_coin", 1), block.location);
    })
})

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
        if (!isLoadedLocation(dimension, block.location)) return;
        dimension.setBlockType(block.location, "minecraft:air");
        dimension.spawnItem(new ItemStack("minecraft:prismarine_shard", Math.floor(Math.random() * 3 + 4)), block.location);
    })
})

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, itemStack: item, block } = event;
    vanillaBlockInteractFix(player, item, block);
})

const crystallDrops: Record<string, string> = {
    "ph:small_crystall_bud": "ph:small_crystall_bud_item",
    "ph:large_crystall_bud": "ph:large_crystall_bud_item",
    "ph:crystall_cluster": "ph:crystall_cluster_item"
};

const crystallDropIds = new Set(Object.keys(crystallDrops));

const faceOffsets = [
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }
];

function popCrystallIfFloating(block: Block, drop = true): boolean {
    if (!block.isValid) return false;
    const typeId = block.typeId;
    if (!crystallDropIds.has(typeId)) return false;
    const dropId: string | undefined = crystallDrops[typeId];
    const support = crystallSupport(block);
    if (!support) return false;
    if (!support.isAir && !support.isLiquid) return false;
    const loc = block.location;
    const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
    block.dimension.setBlockType(loc, "minecraft:air");
    if (drop && dropId) block.dimension.spawnItem(new ItemStack(dropId, 1), center);
    block.dimension.playSound("dig.amethyst", center);
    return true;
}

world.afterEvents.playerBreakBlock.subscribe((e) => {
    const loc = e.block.location;
    const dimension = e.dimension;
    const drop = !e.player.isValid || e.player.getGameMode() !== "Creative";
    system.run(() => {
        for (const off of faceOffsets) {
            const location = { x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z };
            if (!isLoadedLocation(dimension, location)) continue;
            const neighbor = dimension.getBlock(location);
            if (neighbor) popCrystallIfFloating(neighbor, drop);
        }
    });
});

world.afterEvents.entityHitEntity.subscribe((acc) => {
    const damagingEntity = acc.damagingEntity;
    const hitEntity = acc.hitEntity;

    accessoryOnHitEntity(damagingEntity, hitEntity);
    onSentinelHit(damagingEntity, hitEntity);
})

world.afterEvents.entityHurt.subscribe(onDamageIndicator)
world.afterEvents.entityHurt.subscribe(onDummyHurt)
world.afterEvents.entityHurt.subscribe(onTitanCoreHurt)
world.afterEvents.entityHurt.subscribe(onSentinelHurt)
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player" || !hurtEntity.isValid) return;
    onAbsorptionHurt(hurtEntity as Player, damage);
})

world.afterEvents.effectAdd.subscribe(({ entity, effect }) => {
    if (entity.typeId !== "minecraft:player" || !entity.isValid) return;
    if (effect.typeId.replace("minecraft:", "") !== "absorption") return;
    onAbsorptionAdded(entity as Player, effect.amplifier);
})

world.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack }) => {
    onDynamicLighting(player);
    healthBarRuntime(player, "inventoryItemChanged", beforeItemStack, itemStack);
})

function runControlAction(player: Player, action: ControlAction): void {
    if (action === "dash" || action === "airDash") dashRuntime(player);
    else if (action === "switchSkill") switchHeldWeaponSkill(player);
}

world.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
    runControlAction(player, onControlSwingInput(player, swingSource));
    onShieldSwing(player);

    for (const weapon of weapons) {
        if (heldItemStack?.typeId === weapon.itemId) {
			if (swingSource != "Mine" && swingSource != "Attack") return;
            weapon.handleAttack(player);
        }
    }
})

world.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
    if (button == "Sneak") onShieldSneak(source, newButtonState == "Pressed");
    if (newButtonState != "Pressed") return;

    if (button == "Sneak") {
        windPlungeRuntime(source);
    }

    runControlAction(source, onControlButtonInput(source, button));
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

world.afterEvents.itemStartUse.subscribe(({ source }) => onShieldItemUse(source, true))
world.afterEvents.itemStopUse.subscribe(({ itemStack, source }) => {
    cancelPolarisCharge(itemStack, source);
    onShieldItemUse(source, false);
})
world.afterEvents.itemReleaseUse.subscribe(({ itemStack, source }) => {
    cancelPolarisCharge(itemStack, source);
    onShieldItemUse(source, false);
})

world.afterEvents.entityDie.subscribe(({ damageSource, deadEntity }) => {
    const killer = damageSource?.damagingEntity;
	if (deadEntity?.typeId === "minecraft:player") {
		clearPlayerLighting(deadEntity as Player);
		clearAbsorption(deadEntity as Player);
	}
	if (deadEntity?.typeId === "ph:titan_core") {
		onTitanCoreDie(deadEntity);
	}
	if (deadEntity?.typeId === "ph:ancient_sentinel") {
		onSentinelDie(deadEntity);
	}
	if (!killer?.isValid) return;
    const mainhand = killer?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);

    if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
        addScore(killer, "auric_charge", 4);
        if (!deadEntity.isValid || !isLoadedLocation(deadEntity.dimension, deadEntity.location)) return;
        deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
    }
})

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => onTrooperDie(deadEntity, damageSource))

world.afterEvents.entityRemove.subscribe(({ removedEntityId, typeId }) => {
    forgetWard(removedEntityId);
    onTrooperRemove(removedEntityId, typeId);
})

world.afterEvents.entityHealthChanged.subscribe(({ entity }) => {
    if (!entity.isValid || !(entity instanceof Player)) return;
    healthBarRuntime(entity, "healthChanged");
})

world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
    healthBarRuntime(player, "dimensionChanged");
})

world.afterEvents.playerGameModeChange.subscribe(({ player }) => {
    healthBarRuntime(player, "gamemodeChanged");
})

const animatedTpSpeeds = new Map<string, number>(
    specifiedFamilityAndSpeed.map(data => [data.type_family, data.speed])
);

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    if (cause != "Spawned") return;
    if (!entity.isValid) return;

    const family = entity?.getComponent("minecraft:type_family")?.getTypeFamilies();
    if (!family) return;

    const matchedFamily = family.find((typeFamily) => animatedTpSpeeds.has(typeFamily));
    const speed = matchedFamily === undefined ? undefined : animatedTpSpeeds.get(matchedFamily);
    if (speed === undefined) return;

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

world.afterEvents.entitySpawn.subscribe(({ entity }) => onSentinelSpawn(entity))

world.afterEvents.entitySpawn.subscribe(({ entity }) => trackLootItem(entity))
world.afterEvents.entityLoad.subscribe(({ entity }) => trackLootItem(entity))

world.beforeEvents.playerLeave.subscribe(({ player }) => {
    clearPlayerLighting(player);
    clearControlState(player);
    clearAbsorption(player);
    clearShieldState(player.id);
});

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        javaSaturationRegen(player);
        syncAbsorption(player);
    }
}, 6);

system.runInterval(trackMaceFall, 1);

system.runInterval(tickTroopers, 4);
system.runInterval(tickShields, 1);
system.runInterval(checkBlessingMilestones, 20);
system.runInterval(tickTitanRadiation, 40);

system.runInterval(tickLootBeams, 1);

system.runInterval(tickTitanRidgeSites, 100);
system.runInterval(tickAccessories, 100);

system.runInterval(sweepSentinels, 200);

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (!player.isValid) continue;
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
                    const location = { x: bx + dx, y: by + dy, z: bz + dz };
                    if (!isLoadedLocation(dimension, location)) continue;
                    const block = dimension.getBlock(location);
                    if (block && crystallDropIds.has(block.typeId)) {
                        popCrystallIfFloating(block, true);
                    }
                }
            }
        }
    }
}, 40);

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceBlock, sourceEntity }) => {
    switch (id) {
        case "ph:remove_target_lock":
            if (!sourceEntity) return;
            system.runTimeout(() => {
                if (!sourceEntity.isValid) return;
                sourceEntity.removeTag("locked")
            }, 5)
            break;
        case "ph:boss_summon_projectile":
            if (sourceEntity) bossSummonProjectile(sourceEntity, message);
            break;
        case "ph:boss_summon_projectile_with_y_facing":
            if (sourceEntity) bossSummonProjectileFacing(sourceEntity, message);
            break;
        case "ph:boss_summon":
            if (sourceEntity) bossSummon(sourceEntity, message);
            break;
        case "ph:ram_dash":
            if (sourceEntity) ramDash(sourceEntity, message, false);
            break;
        case "ph:ram_dash_3d":
            if (sourceEntity) ramDash(sourceEntity, message, true);
            break;
        case "ph:laser_once":
            if (sourceEntity) laserOnce(sourceEntity, message);
            break;
        case "ph:crimson_drift_mark":
            if (sourceEntity) crimsonDriftMark(sourceEntity);
            break;
        case "ph:crimson_drift_strike":
            if (sourceEntity) crimsonDriftStrike(sourceEntity);
            break;
        case "ph:cruxshaper_charge_particle":
            if (!sourceEntity?.isValid) return;
            const particleAmount = getScore(sourceEntity, "cruxshaper_damage");
            const molang = new MolangVariableMap();

            molang.setFloat("variable.spawn_rate", Number(particleAmount));
            sourceEntity.dimension.spawnParticle("ph:cruxshaper_charge_arc", sourceEntity.location, molang);
            break;
        case "ph:particle_custom":
            system.run(() => {
                const particleMolang = new MolangVariableMap();

                particleMolang.setFloat("variable.spawn_rate", Number(message));
                if (sourceBlock?.isValid) {
                    sourceBlock.dimension.spawnParticle("ph:bounding_circle", sourceBlock.center(), particleMolang);
                }
            })
            break;
        default: break;
    }
})

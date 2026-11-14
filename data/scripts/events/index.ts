import { world, system, ItemStack, MolangVariableMap, EquipmentSlot, Player, BlockVolume, type Block } from '@minecraft/server'
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
import { windPlungeRuntime, isPlunging, tickPlunges, onPlungeFallHurt, clearPlungeState, weaponParry, dashRuntime, vanillaBlockInteractFix, startBetterMending, javaSaturationRegen, healthBarRuntime, specifiedFamilityAndSpeed, onAbsorptionAdded, onAbsorptionHurt, syncAbsorption, clearAbsorption } from '../systems/movement'
import { onControlButtonInput, onControlSwingInput, clearControlState, getParrySound, PARRY_SOUND, type ControlAction } from '../systems/controls'
import { weapons, switchHeldWeaponSkill } from '../features/weapons/weapons'
import { onMaceHurt, trackMaceFall } from '../features/mace/detection'
import { tickAccessories } from '../systems/accessories'
import { checkBlessingMilestones, onBlessingHurt, forgetWard } from '../systems/xeonniteBlessing'
import { onTrooperHurt, tickTroopers, onTrooperDie, onTrooperRemove } from '../features/forge_trooper/manager'
import { sweepSentinels } from '../features/ancient_sentinel/manager'
import { onPolarisItemUse, cancelPolarisCharge } from '../features/polaris_power/manager'
import { onAutoGunStartUse, onAutoGunStopUse, clearAutoGunState, tickAutoGuns } from '../features/weapons/autoGun'
import { onChargeBeamStartUse, onChargeBeamStopUse, clearChargeBeamState, tickChargeBeamGuns } from '../features/weapons/chargeBeamGun'
import { onGunScopeSneak, onGunScopeSlotChange, clearGunScopeState, tickGunScopes } from '../features/weapons/gunScope'
import { onShooterUse } from '../features/weapons/shooters'
import { forgetMana } from '../core/mana'
import { onAethelItemUse, onAethelStartUse, onAethelStopUse, onAethelHurt, onAethelStrike, clearAethelState } from '../features/weapons/aethelSynapse'
import { onInterstellarisHurt, tickInterstellaris, clearInterstellarisState } from '../features/weapons/interstellaris'
import { tickInterpolaris, clearInterpolarisState } from '../features/weapons/interpolaris'
import { tickAuricPhotonizer } from '../features/weapons/auricPhotonizer'
import { tickTitanRadiation } from '../features/titan_core/radiation'
import { tickShields, onShieldHurt, onShieldEffectAdd, onShieldSneak, onShieldSwing, onShieldItemUse, clearShieldState } from '../features/shield/manager'
import { tickTitanRidgeSites } from '../features/titan_core/sites'
import { trackLootItem, tickLootBeams } from '../systems/lootBeam'
import { bossSummon, bossSummonProjectile, bossSummonProjectileFacing, ramDash, laserOnce, crimsonDriftMark, crimsonDriftStrike } from '../features/bosses/attacks'
import { trackPolaris, onPolarisHurt, onPolarisDie, onPolarisRemove, tickPolaris } from '../features/bosses/polaris/manager'

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
            const parrySound = getParrySound(player) === PARRY_SOUND.LUNA ? "weapon_slash.parry_success" : "weapon_slash.slash_clash";
            hurtEntity.dimension.playSound(parrySound, hurtEntity.location);
            hurtEntity.removeTag("parried");
            if (mainItem?.typeId === "ph:seiketsu" || mainItem?.typeId === "ph:rupture_blade") {
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
world.beforeEvents.entityHurt.subscribe(onPlungeFallHurt)

world.beforeEvents.entityHurt.subscribe(onBlessingHurt)
world.beforeEvents.entityHurt.subscribe(onTrooperHurt)
world.beforeEvents.entityHurt.subscribe(onShieldHurt)
world.beforeEvents.entityHurt.subscribe(onAethelHurt)
world.beforeEvents.entityHurt.subscribe(onInterstellarisHurt)
world.beforeEvents.entityHurt.subscribe(onPolarisHurt)

world.beforeEvents.effectAdd.subscribe(onShieldEffectAdd)

world.beforeEvents.itemUse.subscribe(onPolarisItemUse)
world.beforeEvents.itemUse.subscribe(onAethelItemUse)

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
world.afterEvents.entityHurt.subscribe(onAethelStrike)
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

function runControlActions(player: Player, actions: ControlAction[], plunged: boolean = false): void {
    for (const action of actions) {
        if (action === "dash" || action === "airDash") dashRuntime(player);
        else if (action === "switchSkill") switchHeldWeaponSkill(player);
        else if (action === "parry" && !plunged) weaponParry(player);
    }
}

world.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
    const attacked = swingSource == "Mine" || swingSource == "Attack";
    if (attacked && (isPlunging(player) || windPlungeRuntime(player, "attack"))) return;

    runControlActions(player, onControlSwingInput(player, swingSource));
    onShieldSwing(player);
    if (!attacked) return;

    for (const weapon of weapons) {
        if (weapon.matches(player, heldItemStack?.typeId)) weapon.handleAttack(player);
    }
})

world.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
    if (button == "Sneak") {
        onShieldSneak(source, newButtonState == "Pressed");
        onGunScopeSneak(source, newButtonState == "Pressed");
    }
    if (newButtonState != "Pressed") return;

    const plunged = button == "Sneak" && windPlungeRuntime(source, "sneak");

    runControlActions(source, onControlButtonInput(source, button), plunged);
})

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (!itemStack) return;
    startBetterMending(source, itemStack);
    onShooterUse(source, itemStack);

    for (const skill of weaponSkills) {
        if (itemStack.typeId === skill.itemId) {
            skill.useSkill(source);
        }
    }
})

world.afterEvents.itemStartUse.subscribe(({ itemStack, source }) => {
    onShieldItemUse(source, true);
    onAutoGunStartUse(itemStack, source);
    onChargeBeamStartUse(itemStack, source);
    onAethelStartUse(itemStack, source);
})
world.afterEvents.itemStopUse.subscribe(({ itemStack, source }) => {
    cancelPolarisCharge(itemStack, source);
    onShieldItemUse(source, false);
    onAutoGunStopUse(source);
    onChargeBeamStopUse(source);
    onAethelStopUse(source);
})
world.afterEvents.itemReleaseUse.subscribe(({ itemStack, source }) => {
    cancelPolarisCharge(itemStack, source);
    onShieldItemUse(source, false);
    onAutoGunStopUse(source);
    onChargeBeamStopUse(source);
    onAethelStopUse(source);
})
world.afterEvents.itemCompleteUse.subscribe(({ source }) => {
    onAutoGunStopUse(source);
    onChargeBeamStopUse(source);
})
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(({ player, itemStack }) => onGunScopeSlotChange(player, itemStack))

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
	if (deadEntity?.typeId === "ph:polaris") {
		onPolarisDie(deadEntity);
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
    onPolarisRemove(removedEntityId, typeId);
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

world.afterEvents.entitySpawn.subscribe(({ entity }) => trackPolaris(entity))
world.afterEvents.entityLoad.subscribe(({ entity }) => trackPolaris(entity))

world.beforeEvents.playerLeave.subscribe(({ player }) => {
    forgetMana(player.id);
    clearPlayerLighting(player);
    clearControlState(player);
    clearPlungeState(player.id);
    clearAbsorption(player);
    clearShieldState(player.id);
    clearAutoGunState(player.id);
    clearChargeBeamState(player.id);
    clearGunScopeState(player.id);
    clearAethelState(player.id);
    clearInterstellarisState(player.id);
    clearInterpolarisState(player.id);
});

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        javaSaturationRegen(player);
        syncAbsorption(player);
    }
}, 6);

system.runInterval(trackMaceFall, 1);
system.runInterval(tickPlunges, 1);

system.runInterval(tickTroopers, 4);
system.runInterval(tickShields, 1);
system.runInterval(tickAutoGuns, 1);
system.runInterval(tickChargeBeamGuns, 1);
system.runInterval(tickGunScopes, 1);
system.runInterval(tickPolaris, 1);
system.runInterval(tickInterstellaris, 1);
system.runInterval(tickInterpolaris, 1);
system.runInterval(tickAuricPhotonizer, 1);
system.runInterval(checkBlessingMilestones, 20);
system.runInterval(tickTitanRadiation, 40);

system.runInterval(tickLootBeams, 1);

system.runInterval(tickTitanRidgeSites, 100);
system.runInterval(tickAccessories, 100);

system.runInterval(sweepSentinels, 200);

const crystallTypes = [...crystallDropIds];

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (!player.isValid) continue;
        const dimension = player.dimension;
        const { min, max } = dimension.heightRange;
        const bx = Math.floor(player.location.x);
        const by = Math.floor(player.location.y);
        const bz = Math.floor(player.location.z);
        const fromY = Math.max(min, by - 4);
        const toY = Math.min(max - 1, by + 4);
        if (fromY > toY || !dimension.isChunkLoaded(player.location)) continue;
        const volume = new BlockVolume({ x: bx - 5, y: fromY, z: bz - 5 }, { x: bx + 5, y: toY, z: bz + 5 });
        const found = dimension.getBlocks(volume, { includeTypes: crystallTypes }, true);
        for (const location of found.getBlockLocationIterator()) {
            const block = dimension.getBlock(location);
            if (block) popCrystallIfFloating(block, true);
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

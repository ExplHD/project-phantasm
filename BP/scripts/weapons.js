import { world, system } from '@minecraft/server'
import { WeaponHandler, SkillSwitcher, SkillHandler, CommandHandler } from './classes/weapon_handler'
import { weaponSkills } from './data/weapon_skills'
import { getScore, removeScore } from 'main'
import * as Phantasm from 'phantasmConstants'

/* --------------------------------------------------------------------------------------------------------------------------------------------------------
            Weapons Runtime
 -------------------------------------------------------------------------------------------------------------------------------------------------------- */

const solarisVerdant = new WeaponHandler("ph:solaris_verdant", "solaris_verdant_atk", [20, 9, 10], [
    { delay: 5, damage: 12, radius: 3.9, animation: "animation.solaris_verdant.attack_1", sound: "weapon_slash.slash_medium" },
    { delay: 7, damage: 12, radius: 3.9, animation: "animation.solaris_verdant.attack_2", sound: "weapon_slash.slash_medium" },
    {
        delay: 8, damage: 14, radius: 3.9, animation: "animation.solaris_verdant.attack_3", sound: "weapon_slash.slash_heavy", action: new CommandHandler([
            {
                delay: 8, action: (src) => {
                    src.runCommand("summon ph:solaris_slash ^^3^5.5 ~ 0");
                    if (getScore(src, "solaris_verdant_s3") > 2) {
                        removeScore(src, "solaris_verdant_s3", -3);
                    }
                    if (getScore(src, "solaris_verdant_s1") > 0) {
                        removeScore(src, "solaris_verdant_s1", -1);
                    }
                }
            }
        ])
    }
])

const solarisVerdantSS = new SkillSwitcher("ph:solaris_verdant", "solaris_verdant", [
    { skillSMessage: "Animirra" },
    { skillSMessage: "Solaris Slash" },
    { skillSMessage: "Natura Vulkan" }
])

const superchargedCopperAxe = new WeaponHandler("ph:supercharged_copper_axe", "supercharged_copper_axe_atk", [30, 12, 12, 12], [
    { delay: 4, damage: 16, radius: 4.5, animation: "animation.charged_copper_axe.attack_1", sound: "weapon_slash.slash_heavy" },
    { delay: 4, damage: 16, radius: 4.5, animation: "animation.charged_copper_axe.attack_2", sound: "weapon_slash.slash_heavy" },
    { delay: 8, damage: 18, radius: 4.5, animation: "animation.charged_copper_axe.attack_3", sound: "weapon_slash.slash_heavy" },
    {
        delay: 3, damage: 18, radius: 4.5, animation: "animation.charged_copper_axe.attack_4", sound: "weapon_slash.slash_heavy", action: new CommandHandler([
            {
                delay: 5, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_heavy", src.location);
                    src.dimension.spawnParticle("ph:lightning_flash", src.location);
                    src.dimension.spawnParticle("ph:lightning_sparks", src.location);
                    src.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=4] 18 entity_attack entity "${src.name}"`);
                    src.runCommand('summon lightning_bolt ~~~5 ~ 0');
                    src.runCommand('summon lightning_bolt ~~~-5 ~ 0');
                    src.runCommand('particle ph:lightning_sparks ~~~5');
                    src.runCommand('particle ph:lightning_sparks ~~~-5');
                }
            },
            {
                delay: 2, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_heavy", src.location);
                    src.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=4] 18 entity_attack entity "${src.name}"`);
                    src.runCommand('summon lightning_bolt ~5~~ ~ 0');
                    src.runCommand('summon lightning_bolt ~-5~~ ~ 0');
                    src.runCommand('particle ph:lightning_sparks ~5~~');
                    src.runCommand('particle ph:lightning_sparks ~-5~~');
                    WeaponHandler.addScore(src, "supercharged_copper_axe_s2", 1);
                    WeaponHandler.addScore(src, "supercharged_copper_axe_s3", 1);
                }
            }
        ])
    }
])

const superchargedCopperAxeSS = new SkillSwitcher("ph:supercharged_copper_axe", "supercharged_copper_axe", [
    { skillSMessage: "Charge" },
    { skillSMessage: "Discharge" },
    { skillSMessage: "Ultimate Discharge" }
])

const weapons = [solarisVerdant, superchargedCopperAxe];
const switcherSkills = [solarisVerdantSS, superchargedCopperAxeSS];

world.afterEvents.entityHitBlock.subscribe(({ damagingEntity: source, hitBlock }) => {
    const equippedItem = source?.getComponent('equippable')?.getEquipment('Mainhand');

    if (!equippedItem) return;

    for (const weapon of weapons) {
        if (equippedItem.typeId === weapon.itemId) {
            weapon.handleAttack(source);
        }
    }
})

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: source }) => {
    const equippedItem = source?.getComponent('equippable')?.getEquipment('Mainhand');

    if (!equippedItem) return;

    for (const weapon of weapons) {
        if (equippedItem.typeId === weapon.itemId) {
            weapon.handleAttack(source);
        }
    }
})

world.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
    const equippedItem = source?.getComponent('equippable')?.getEquipment('Mainhand');

    if (!equippedItem) return;

    for (const ss of switcherSkills) {
        if (equippedItem.typeId === ss.itemId && button === "Sneak" && newButtonState == "Pressed") {
            ss.switchSkill(source);
        }
    }
})

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (!itemStack) return;

    for (const skill of weaponSkills) {
        if (itemStack.typeId === skill.itemId) {
            skill.useSkill(source);
        }
    }
})

world.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack, inventoryType }) => {
    const playerContainer = player.getComponent("inventory").container;

    for (let i = 0; i < playerContainer.size; i++) {
        const item = playerContainer.getItem(i);
        if (!item) continue;
        if (item?.typeId.startsWith("ph:")) {
            const lore = item.getLore();
            if (lore?.length !== 0) continue;

            const itemLore = Phantasm.addLore.get(item.typeId);
            if (itemLore) {
                item.setLore(itemLore);
                playerContainer.setItem(i, item);
                continue;
            }
            item.setLore(["§9Phantasm"]);
            playerContainer.setItem(i, item);
        }
    }
})
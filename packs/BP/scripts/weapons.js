import { world, system } from '@minecraft/server'
import { WeaponHandler, SkillSwitcher, SkillHandler, CommandHandler, applyCustomDamage } from './classes/weapon_handler'
import { weaponSkills } from './data/weapon_skills'
import { addScore, getScore, removeScore } from 'main'
import * as Phantasm from 'phantasmConstants'

/* --------------------------------------------------------------------------------------------------------------------------------------------------------
            Weapons Runtime
 -------------------------------------------------------------------------------------------------------------------------------------------------------- */

const solarisVerdant = new WeaponHandler("ph:solaris_verdant", "solaris_verdant_atk", [10, 9, 10], [
    { delay: 5, damage: 21, radius: 3.9, animation: "animation.solaris_verdant.attack_1", sound: "weapon_slash.slash_medium" },
    { delay: 7, damage: 21, radius: 3.9, animation: "animation.solaris_verdant.attack_2", sound: "weapon_slash.slash_medium" },
    {
        delay: 8, damage: 23, radius: 3.9, animation: "animation.solaris_verdant.attack_3", sound: "weapon_slash.slash_heavy", action: new CommandHandler([
            {
                delay: 8, action: (src) => {
                    src.runCommand("summon ph:solaris_slash ^^3^5.5 ~ 0");
                    if (getScore(src, "solaris_verdant_s3") > 2) {
                        removeScore(src, "solaris_verdant_s3", 3);
                    }
                    if (getScore(src, "solaris_verdant_s1") > 0) {
                        removeScore(src, "solaris_verdant_s1", 1);
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

const superchargedCopperAxe = new WeaponHandler("ph:supercharged_copper_axe", "supercharged_copper_axe_atk", [12, 12, 12, 12], [
    { delay: 4, damage: 30, radius: 4.5, animation: "animation.charged_copper_axe.attack_1", sound: "weapon_slash.slash_heavy" },
    { delay: 4, damage: 30, radius: 4.5, animation: "animation.charged_copper_axe.attack_2", sound: "weapon_slash.slash_heavy" },
    { delay: 8, damage: 31, radius: 4.5, animation: "animation.charged_copper_axe.attack_3", sound: "weapon_slash.slash_heavy" },
    {
        delay: 3, damage: 31, radius: 4.5, animation: "animation.charged_copper_axe.attack_4", sound: "weapon_slash.slash_heavy", action: new CommandHandler([
            {
                delay: 5, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_heavy", src.location);
                    src.dimension.spawnParticle("ph:lightning_flash", src.location);
                    src.dimension.spawnParticle("ph:lightning_sparks", src.location);
                    applyCustomDamage(src, 31, 4.5);
                    src.runCommand('summon lightning_bolt ~~~5 ~ 0');
                    src.runCommand('summon lightning_bolt ~~~-5 ~ 0');
                    src.runCommand('particle ph:lightning_sparks ~~~5');
                    src.runCommand('particle ph:lightning_sparks ~~~-5');
                }
            },
            {
                delay: 2, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_heavy", src.location);
                    applyCustomDamage(src, 31, 4.5);
                    src.runCommand('summon lightning_bolt ~5~~ ~ 0');
                    src.runCommand('summon lightning_bolt ~-5~~ ~ 0');
                    src.runCommand('particle ph:lightning_sparks ~5~~');
                    src.runCommand('particle ph:lightning_sparks ~-5~~');
                    WeaponHandler.addScore(src, "supercharged_copper_axe_s3", 1);
                    WeaponHandler.addScore(src, "supercharged_copper_axe_s4", 1);
                }
            }
        ])
    }
])

const superchargedCopperAxeSS = new SkillSwitcher("ph:supercharged_copper_axe", "supercharged_copper_axe", [
    { skillSMessage: "Charge" },
    { skillSMessage: "Powered Leap" },
    { skillSMessage: "Discharge" },
    { skillSMessage: "Ultimate Discharge" }
])

const prismWeaver = new WeaponHandler("ph:prism_weaver", "prism_weaver_atk", [20, 15, 15], [
    {
        delay: 4, damage: 17, radius: 2, animation: "animation.prism_weaver.attack_1", sound: "weapon_slash.magic_staff", action: new CommandHandler([
            {
                delay: 0, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~ facing @e[c=1,rm=2.5,family=!inanimate,type=!item]")
                }
            }
        ])
    },
    {
        delay: 8, damage: 17, radius: 2, animation: "animation.prism_weaver.attack_2", sound: "weapon_slash.magic_staff", action: new CommandHandler([
            {
                delay: 0, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~ facing @e[c=1,rm=2.5,family=!inanimate,type=!item]")
                }
            }
        ])
    },
    {
        delay: 8, damage: 18, radius: 6, animation: "animation.prism_weaver.attack_3", sound: "weapon_slash.magic_staff", action: new CommandHandler([
            {
                delay: 0, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                }
            }
        ])
    }
])

const prismWeaverSS = new SkillSwitcher("ph:prism_weaver", "prism_weaver", [
    { skillSMessage: "Bubble Barrage" },
    { skillSMessage: "Prism Wave Wall" },
    { skillSMessage: "Vortex Prism" }
])

const auricPhotonizer = new WeaponHandler("ph:auric_photonizer", "auric_photonizer_atk", [10, 9, 9, 9, 9], [
    { delay: 4, damage: 29, radius: 4.5, animation: "animation.auric_photonizer.attack_1", sound: "weapon_slash.slash_medium" },
    { delay: 4, damage: 28, radius: 4.5, animation: "animation.auric_photonizer.attack_2", sound: "weapon_slash.slash_medium" },
    { delay: 5, damage: 30, radius: 4.5, animation: "animation.auric_photonizer.attack_3", sound: "weapon_slash.slash_medium" },
    { delay: 4, damage: 28, radius: 4.5, animation: "animation.auric_photonizer.attack_4", sound: "weapon_slash.slash_medium" },
    {
        delay: 3, damage: 30, radius: 4.5, animation: "animation.auric_photonizer.attack_5", sound: "weapon_slash.slash_medium", action: new CommandHandler([
            {
                delay: 5, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_medium", src.location);
                    src.dimension.spawnParticle("ph:lightning_flash", src.location);
                    src.dimension.spawnParticle("ph:lightning_sparks", src.location);
                    applyCustomDamage(src, 30, 4.5);
                }
            },
            {
                delay: 2, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_medium", src.location);
                    applyCustomDamage(src, 30, 4.5);
                }
            }
        ])
    }
])

const auricPhotonizerSS = new SkillSwitcher("ph:auric_photonizer", "auric_photonizer", [
    { skillSMessage: "Stab" },
    { skillSMessage: "Backleap" },
    { skillSMessage: "Blade Barrage" },
    { skillSMessage: "Ethereal Blade" }
])

const theBleedingSpire = new WeaponHandler("ph:the_bleeding_spire", "the_bleeding_spire_atk", [14, 14, 14, 14], [
    { delay: 8, damage: 27, radius: 4.5, animation: "animation.the_bleeding_spire.attack_1", sound: "weapon_slash.slash_medium" },
    { delay: 8, damage: 23, radius: 4.5, animation: "animation.the_bleeding_spire.attack_2", sound: "weapon_slash.slash_medium" },
    { delay: 6, damage: 27, radius: 4.5, animation: "animation.the_bleeding_spire.attack_3", sound: "weapon_slash.slash_medium" },
    { delay: 8, damage: 23, radius: 4.5, animation: "animation.the_bleeding_spire.attack_4", sound: "weapon_slash.slash_medium" }
])

const theBleedingSpireSS = new SkillSwitcher("ph:the_bleeding_spire", "the_bleeding_spire", [
    { skillSMessage: "Carnage" },
    { skillSMessage: "Entanglement" },
    { skillSMessage: "Crimson Ray" }
])

const seiketsu = new WeaponHandler("ph:seiketsu", "seiketsu_atk", [9, 9, 9], [
    { delay: 2, damage: 14, radius: 3, animation: "animation.seiketsu_1", sound: "weapon_slash.slash_medium" },
    { delay: 2, damage: 14, radius: 3, animation: "animation.seiketsu_2", sound: "weapon_slash.slash_medium" },
    {
        delay: 3, damage: 14, radius: 3, animation: "animation.seiketsu_3", sound: "weapon_slash.slash_heavy", action: new CommandHandler([
            {
                delay: 1, action: (src) => {
                    const entities = src.dimension.getEntities({
                        location: src.location,
                        excludeTypes: ["minecraft:item"],
                        excludeFamilies: ["inanimate"],
                        closest: 1,
                        maxDistance: 5,
                        minDistance: 0.1
                    });
                    src.addTag("parried");
                    src.addEffect("fire_resistance", 50, {
                        showParticle: false
                    })

                    entities.forEach(entity => {
                        entity.runCommand('summon lightning_bolt ~~~ ~ 0');
                        entity.runCommand('particle ph:lightning_sparks ~~~');
                        entity.setOnFire(7, false);
                    })
                }
            },
            {
                delay: 4, action: (src) => {
                    src.removeTag("parried");
                }
            }
        ])
    }
])

const weapons = [solarisVerdant, superchargedCopperAxe, prismWeaver, auricPhotonizer, theBleedingSpire, seiketsu];
const switcherSkills = [solarisVerdantSS, superchargedCopperAxeSS, prismWeaverSS, auricPhotonizerSS, theBleedingSpireSS];

world.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
    for (const weapon of weapons) {
        if (heldItemStack?.typeId === weapon.itemId) {
			if (swingSource != "Mine" && swingSource != "Attack") return;
			weapon.handleAttack(player);
        }
    }
})

world.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
    const equippedItem = source?.getComponent('equippable')?.getEquipment('Mainhand');

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

    for (const skill of weaponSkills) {
        if (itemStack.typeId === skill.itemId) {
            skill.useSkill(source);
        }
    }
})

// Executes if entity is dead, currently only "Charged Copper Axe" uses this event
world.afterEvents.entityDie.subscribe(({ damageSource, deadEntity }) => {
    const killer = damageSource?.damagingEntity;
    if (!killer?.isValid) return;
    const mainhand = killer?.getComponent("equippable")?.getEquipment("Mainhand");

    if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
        addScore(killer, "auric_charge", 4);
        deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
    }
})

world.afterEvents.playerInventoryItemChange.subscribe(({ player }) => {
    const container = player.getComponent("inventory")?.container;
    if (!container) return;

    // Step 1: apply expected lore (kode kamu yang lama)
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

    // Step 2: gabungin stack yang sekarang identik tapi masih kepisah slot
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
                container.setItem(j, undefined); // slot dikosongin total
            } else {
                itemB.amount -= moveAmount;	
                container.setItem(j, itemB); // sisa amount-nya
            }
        }
    }
});
import { EquipmentSlot, type Player } from '@minecraft/server'
import { WeaponHandler, SkillSwitcher, CommandHandler, applyCustomDamage } from './weaponHandler'
/* [UNUSED] import { weaponSkills } from './weaponSkills' - weapon skills are wired
   directly in events/index.ts (itemUse), not here. */
import { addScore, getScore, removeScore } from '../../core/scoreboard'
import { summonOwned } from '../../core/summons'
import { prismBolt, PRISM_FAN } from './prismWeaver'

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
                    summonOwned(src, "summon ph:solaris_slash ^^3^5.5 ~ 0");
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
                    summonOwned(src, 'summon lightning_bolt ~~~5 ~ 0');
                    summonOwned(src, 'summon lightning_bolt ~~~-5 ~ 0');
                    src.runCommand('particle ph:lightning_sparks ~~~5');
                    src.runCommand('particle ph:lightning_sparks ~~~-5');
                }
            },
            {
                delay: 2, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_heavy", src.location);
                    applyCustomDamage(src, 31, 4.5);
                    summonOwned(src, 'summon lightning_bolt ~5~~ ~ 0');
                    summonOwned(src, 'summon lightning_bolt ~-5~~ ~ 0');
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

// Native ranged: every hit fires script-driven bolts (projectile.ts) instead of summoning
// stationary ph:prism_weaver_laser damage orbs next to the player.
const prismWeaver = new WeaponHandler("ph:prism_weaver", "prism_weaver_atk", [20, 15, 15], [
    { delay: 6, damage: 17, radius: 0, animation: "animation.prism_weaver.attack_1", sound: "weapon_slash.magic_staff", projectile: prismBolt(-0.35) },
    { delay: 10, damage: 17, radius: 0, animation: "animation.prism_weaver.attack_2", sound: "weapon_slash.magic_staff", projectile: prismBolt(0.35) },
    { delay: 10, damage: 12, radius: 0, animation: "animation.prism_weaver.attack_3", sound: "weapon_slash.magic_staff", projectile: PRISM_FAN }
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
                        showParticles: false
                    })

                    entities.forEach(entity => {
                        summonOwned(src, 'summon lightning_bolt ~~~ ~ 0', entity);
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

export const weapons = [solarisVerdant, superchargedCopperAxe, prismWeaver, auricPhotonizer, theBleedingSpire, seiketsu];
export const switcherSkills = [solarisVerdantSS, superchargedCopperAxeSS, prismWeaverSS, auricPhotonizerSS, theBleedingSpireSS];

// switcherSkills is fixed at module load, so index it once instead of scanning it
// on every skill switch.
const switcherByItemId = new Map<string, (typeof switcherSkills)[number]>(
    switcherSkills.map(switcher => [switcher.itemId, switcher])
);

// Switches the skill of the Legendary weapon in the main hand. Returns false when the
// held item has no skill switcher.
export function switchHeldWeaponSkill(player: Player): boolean {
    const switcher = switcherByItemId.get(
        player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId ?? ""
    );
    if (!switcher) return false;

    switcher.switchSkill(player);
    return true;
}

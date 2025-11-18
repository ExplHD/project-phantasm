import { addScore } from '../main'
import { CommandHandler, SkillHandler } from '../classes/weapon_handler'

// Solaris Verdant (Animitta)
let solarisverdantSkill = new SkillHandler("ph:solaris_verdant", "solaris_verdant")
solarisverdantSkill.addSkill(1, {
    name: "§aAnimirra",
    type: "Ability",
    cooldown_objective: "solaris_verdant_s1",
    cooldown: 35,
    charge: false,
    action: (source) => {
        const location = { x: source.location.x, y: source.location.y + 1, z: source.location.z };
        source.addTag('animirra');
        source.playAnimation("animation.solaris_verdant.attack_3");
        source.dimension.spawnParticle("ph:solaris_verdant_animirra", location);
        source.runCommand('inputpermission set @s movement disabled');
        const animirra = new CommandHandler([
            {
                delay: 10, action: (src) => {
                    src.runCommand('particle ph:solaris_verdant_summon ~~1~7');
                    src.runCommand('particle ph:solaris_verdant_summon ~~1~-7');
                    src.runCommand('particle ph:solaris_verdant_summon ~7~1~');
                    src.runCommand('particle ph:solaris_verdant_summon ~-7~1~');
                    src.runCommand('summon ph:animirra_summon ~~1~7 ~~');
                    src.runCommand('summon ph:animirra_summon ~~1~-7 ~~');
                    src.runCommand('summon ph:animirra_summon ~7~1~ ~~');
                    src.runCommand('summon ph:animirra_summon ~-7~1~ ~~');
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                    source.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        animirra.run(source);
    }
})
solarisverdantSkill.addSkill(2, {
    name: "§aSolaris Slash",
    type: "Ability",
    cooldown_objective: "solaris_verdant_s2",
    cooldown: 20,
    charge: false,
    action: (source) => {
        source.playAnimation("animation.solaris_verdant.attack_3");
        source.runCommand('inputpermission set @s movement disabled');
        const solarisSlash = new CommandHandler([
            {
                delay: 10, action: (src) => {
                    src.dimension.playSound("weapon_slash.slash_heavy", src.location);
                    src.runCommand("summon ph:solaris_slash ^^3^5 ~ 0");
                    src.runCommand("summon ph:solaris_slash ^^3^5 ~-45 0");
                    src.runCommand("summon ph:solaris_slash ^^3^5 ~45 0");
                    source.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        solarisSlash.run(source);
    }
})
solarisverdantSkill.addSkill(3, {
    name: "§a§lNatura Vulkan",
    type: "Ultimate",
    cooldown_objective: "solaris_verdant_s3",
    cooldown: 60,
    charge: false,
    action: (source) => {
        const location = { x: source.location.x, y: source.location.y + 1, z: source.location.z };
        source.addTag('animirra');
        source.playAnimation("animation.solaris_verdant.attack_3");
        source.dimension.spawnParticle("ph:solaris_verdant_animirra", location);
        source.runCommand('inputpermission set @s movement disabled');
        const animirra = new CommandHandler([
            {
                delay: 10, action: (src) => {
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                    src.runCommand('particle ph:solaris_verdant_summon ~~1~7');
                    src.runCommand('particle ph:solaris_verdant_summon ~~1~-7');
                    src.runCommand('particle ph:solaris_verdant_summon ~7~1~');
                    src.runCommand('particle ph:solaris_verdant_summon ~-7~1~');
                    src.runCommand('summon ph:animirra_summon_ultimate ~~1~7 ~~');
                    src.runCommand('summon ph:animirra_summon_ultimate ~~1~-7 ~~');
                    src.runCommand('summon ph:animirra_summon_ultimate ~7~1~ ~~');
                    src.runCommand('summon ph:animirra_summon_ultimate ~-7~1~ ~~');
                }
            },
            {
                delay: 10, action: (src) => {
                    src.runCommand(`scriptevent ph:boss_summon_meteor 10, 20, 24, ph:animirra_meteor, custom_sfx.animirra_summon`);
                    source.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        animirra.run(source);
    }
})

let superchargedCopperAxeSkill = new SkillHandler("ph:supercharged_copper_axe", "supercharged_copper_axe")
superchargedCopperAxeSkill.addSkill(1, {
    name: "§6Charge",
    type: "Ability",
    cooldown_objective: "supercharged_copper_axe_s1",
    cooldown: 15,
    charge: false,
    action: (source) => {
        source.dimension.spawnParticle("ph:lightning_flash", source.location);
        source.dimension.spawnParticle("ph:lightning_sparks", source.location);
        source.addEffect("strength", 300, {
            amplifier: 1
        });
        source.runCommand(`damage @e[r=7,rm=0.1,family=!inanimate] 10 entity_attack entity @s`);
        source.dimension.playSound("custom_sfx.high_voltage_spark", source.location);
        addScore(source, "supercharged_copper_axe_s2", 5);
        addScore(source, "supercharged_copper_axe_s3", 5);
    }
})

superchargedCopperAxeSkill.addSkill(2, {
    name: "§6Discharge",
    type: "Ability",
    cooldown_objective: "supercharged_copper_axe_s2",
    cooldown: -5,
    charge: true,
    charge_min: 5,
    action: (source) => {
        source.dimension.spawnParticle("ph:lightning_flash", source.location);
        source.dimension.spawnParticle("ph:lightning_sparks", source.location);
        source.playAnimation("animation.charged_copper_axe.attack_4");
        const discharge = new CommandHandler([
            {
                delay: 3, action: (src) => {
                    src.runCommand('summon ph:charged_copper_laser ~~~ 90 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 270 0');
                    src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
                }
            },
            {
                delay: 2, action: (src) => {
                    src.runCommand('summon ph:charged_copper_laser ~~~ 45 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 135 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 215 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 315 0');
                    src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
                }
            },
            {
                delay: 2, action: (src) => {
                    src.runCommand('summon ph:charged_copper_laser ~~~ 0 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 180 0');
                    src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
                }
            }
        ])
        discharge.run(source);
    }
})

superchargedCopperAxeSkill.addSkill(3, {
    name: "§pUltimate §6Discharge",
    type: "Ultimate",
    cooldown_objective: "supercharged_copper_axe_s3",
    cooldown: -15,
    charge: true,
    charge_min: 15,
    action: (source) => {
        source.dimension.spawnParticle("ph:lightning_flash", source.location);
        source.dimension.spawnParticle("ph:lightning_sparks", source.location);
        source.playAnimation("animation.charged_copper_axe.attack_4");
        source.runCommand('inputpermission set @s camera disabled');
        source.runCommand('inputpermission set @s movement disabled');
        const discharge = new CommandHandler([
            {
                delay: 3, action: (src) => {
                    src.runCommand('summon ph:charged_copper_laser ~~~ 90 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 270 0');
                    src.runCommand('summon lightning_bolt ~5~~ ');
                    src.runCommand('summon lightning_bolt ~-5~~ ');
                    src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
                }
            },
            {
                delay: 2, action: (src) => {
                    src.runCommand('summon ph:charged_copper_laser ~~~ 45 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 135 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 215 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 315 0');
                    src.runCommand('summon lightning_bolt ~5~~5 ');
                    src.runCommand('summon lightning_bolt ~-5~~5 ');
                    src.runCommand('summon lightning_bolt ~5~~-5 ');
                    src.runCommand('summon lightning_bolt ~-5~~-5 ');
                    src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
                }
            },
            {
                delay: 2, action: (src) => {
                    src.runCommand('summon ph:charged_copper_laser ~~~ 0 0');
                    src.runCommand('summon ph:charged_copper_laser ~~~ 180 0');
                    src.runCommand('summon lightning_bolt ~~~5 ');
                    src.runCommand('summon lightning_bolt ~~~-5');
                    src.runCommand('summon lightning_bolt ~10~~ ');
                    src.runCommand('summon lightning_bolt ~-10~~ ');
                    src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
                }
            },
            {
                delay: 5, action: (src) => {
                    src.runCommand('summon lightning_bolt ~10~~10 ');
                    src.runCommand('summon lightning_bolt ~-10~~10 ');
                    src.runCommand('summon lightning_bolt ~10~~-10 ');
                    src.runCommand('summon lightning_bolt ~-10~~-10 ');
                }
            },
            {
                delay: 5, action: (src) => {
                    src.runCommand('summon lightning_bolt ~~~10 ');
                    src.runCommand('summon lightning_bolt ~~~-10');
                    src.runCommand('inputpermission set @s camera enabled');
                    src.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        discharge.run(source);
    }
})

const weaponSkills = [solarisverdantSkill, superchargedCopperAxeSkill];
export { weaponSkills }
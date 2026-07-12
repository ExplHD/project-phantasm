import { addScore, setScore } from '../main'
import { CommandHandler, SkillHandler, applyCustomDamage } from '../classes/weapon_handler'
import { MolangVariableMap, system } from '@minecraft/server';

function getAxisDelta(a, b) {
    return {
        x: b.x - a.x,
        y: b.y - a.y,
        z: b.z - a.z
    };
}

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
                    src.runCommand(`scriptevent ph:boss_summon 10, 20, 24, ph:animirra_meteor, custom_sfx.animirra_summon`);
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
        applyCustomDamage(source, 25, 7);
        source.dimension.playSound("custom_sfx.high_voltage_spark", source.location);
        addScore(source, "supercharged_copper_axe_s3", 5);
        addScore(source, "supercharged_copper_axe_s4", 5);
    }
})

superchargedCopperAxeSkill.addSkill(2, {
    name: "§ePowered Leap",
    type: "Ability",
    cooldown_objective: "supercharged_copper_axe_s2",
    cooldown: 10,
    charge: false,
    action: (source) => {
        source.dimension.spawnParticle("ph:lightning_flash", source.location);
        source.dimension.spawnParticle("ph:copper_mech_explosion", source.location);
        source.applyKnockback({ x: source.getViewDirection().x * 2, z: source.getViewDirection().z * 2 }, 1.2);
        source.dimension.createExplosion(source.location, 4, {
            breaksBlocks: false,
            source: source
        })
        source.dimension.playSound("custom_sfx.high_voltage_spark", source.location);
        addScore(source, "supercharged_copper_axe_s3", 1);
        addScore(source, "supercharged_copper_axe_s4", 1);
    }
})

superchargedCopperAxeSkill.addSkill(3, {
    name: "§6Discharge",
    type: "Ability",
    cooldown_objective: "supercharged_copper_axe_s3",
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

superchargedCopperAxeSkill.addSkill(4, {
    name: "§pUltimate §6Discharge",
    type: "Ultimate",
    cooldown_objective: "supercharged_copper_axe_s4",
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

let prismWeaverSkill = new SkillHandler("ph:prism_weaver", "prism_weaver")
prismWeaverSkill.addSkill(1, {
    name: "§3Bubble Barrage",
    type: "Skill",
    cooldown_objective: "prism_weaver_s1",
    cooldown: 25,
    charge: false,
    action: (source) => {
        source.runCommand('inputpermission set @s movement disabled');
        source.playAnimation("animation.prism_weaver.skill_1");
        const command = new CommandHandler([
            {
                delay: 7, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                }
            },
            {
                delay: 7, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                }
            },
            {
                delay: 7, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                }
            },
            {
                delay: 7, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                }
            },
            {
                delay: 7, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                }
            },
            {
                delay: 7, action: (src) => {
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
                    src.dimension.playSound("custom_sfx.animirra_summon", src.location);
                    src.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        command.run(source);
    }
})

prismWeaverSkill.addSkill(2, {
    name: "§bPrism Wave Wall",
    type: "Skill",
    cooldown_objective: "prism_weaver_s2",
    cooldown: 25,
    charge: false,
    action: (source) => {
        source.runCommand('inputpermission set @s movement disabled');
        source.playAnimation("animation.prism_weaver.attack_2");
        const command = new CommandHandler([
            {
                delay: 10, action: (src) => {
                    source.runCommand("summon ph:water_wall ^^^4 ~ 0");
                    source.runCommand("summon ph:water_wall ^-2^^3 ~ 0");
                    source.runCommand("summon ph:water_wall ^2^^3 ~ 0");
                    source.runCommand("summon ph:water_wall ^-4^^2 ~ 0");
                    source.runCommand("summon ph:water_wall ^4^^2 ~ 0");
                    source.dimension.playSound("custom_sfx.prism_fire", source.location);
                    src.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        command.run(source);
    }
})

prismWeaverSkill.addSkill(3, {
    name: "§3Vortex §bPrism",
    type: "Ultimate",
    cooldown_objective: "prism_weaver_s3",
    cooldown: 70,
    charge: false,
    action: (source) => {
        source.runCommand('inputpermission set @a[r=32] movement disabled');
        const entities = source.dimension.getEntities({
            location: source.location,
            excludeFamilies: ["boss"],
            maxDistance: 32,
            minDistance: 1
        });
        function normalize(v) {
            const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (len === 0) return { x: 0, y: 0, z: 0 };
            return { x: v.x / len, y: v.y / len, z: v.z / len };
        }
        entities.forEach(entity => {
            if (!entity || !entity.isValid) return;
            if (entity.id === source.id) return; // jangan tarik diri sendiri
            // ignore items / inanimate if you want
            if (entity.typeId?.startsWith("minecraft:item")) return;

            // compute vector from entity -> source (pull towards source)
            const dx = source.location.x - entity.location.x;
            const dy = source.location.y - entity.location.y;
            const dz = source.location.z - entity.location.z;

            const dir = normalize({ x: dx, y: dy, z: dz });

            // scale force (sesuaikan kekuatan)
            const pullStrength = 4.5; // coba 1.6, ubah sesuai kebutuhan
            const impulse = { x: dir.x * pullStrength, y: Math.max(dir.y * 0.7, 0.1), z: dir.z * pullStrength };

            // apply impulse (tarik)
            try {
                if (typeof entity.applyImpulse === "function") {
                    entity.applyImpulse(impulse);
                    entity.addEffect("slowness", 60, { amplifier: 255 })
                } else {
                    // fallback: teleport sedikit ke arah source (jika applyImpulse tidak tersedia)
                    entity.teleport({
                        x: entity.location.x + impulse.x,
                        y: entity.location.y + impulse.y,
                        z: entity.location.z + impulse.z
                    });
                }
            } catch (e) {
                console.warn("Failed to apply impulse:", e);
            }
        });
        applyCustomDamage(source, 40, 32);
        source.dimension.spawnParticle("ph:vortex_prism", source.location);
        source.dimension.playSound("custom_sfx.vortex_beam", source.location);
        source.playAnimation("animation.prism_weaver.attack_2");
        const command = new CommandHandler([
            {
                delay: 50, action: (src) => {
                    src.playAnimation("animation.prism_weaver.attack_3")
                }
            },
            {
                delay: 10, action: (src) => {
                    const entities = src.dimension.getEntities({
                        location: src.location,
                        maxDistance: 32,
                        minDistance: 1
                    });
                    src.dimension.spawnParticle("ph:vortex_prism_push", src.location);
                    function normalize(v) {
                        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
                        if (len === 0) return { x: 0, y: 0, z: 0 };
                        return { x: v.x / len, y: v.y / len, z: v.z / len };
                    }
                    entities.forEach(entity => {
                        if (!entity || !entity.isValid) return;
                        if (entity.id === source.id) return; // jangan tarik diri sendiri
                        // ignore items / inanimate if you want
                        if (entity.typeId?.startsWith("minecraft:item")) return;

                        // compute vector from entity -> source (pull towards source)
                        const dx = source.location.x - entity.location.x;
                        const dy = source.location.y - entity.location.y;
                        const dz = source.location.z - entity.location.z;

                        const dir = normalize({ x: dx, y: dy, z: dz });

                        // scale force (sesuaikan kekuatan)
                        const pullStrength = 8.6; // coba 1.6, ubah sesuai kebutuhan
                        const impulse = { x: dir.x * pullStrength, y: Math.max(dir.y * 0.7, 0.1), z: dir.z * -pullStrength };

                        // apply impulse (tarik)
                        try {
                            if (typeof entity.applyImpulse === "function") {
                                entity.applyImpulse(impulse);
                            } else {
                                // fallback: teleport sedikit ke arah source (jika applyImpulse tidak tersedia)
                                entity.teleport({
                                    x: entity.location.x + impulse.x,
                                    y: entity.location.y + impulse.y,
                                    z: entity.location.z + impulse.z
                                });
                            }
                        } catch (e) {
                            console.warn("Failed to apply impulse:", e);
                        }
                    });
                    applyCustomDamage(src, 55, 55);
                    src.dimension.playSound("custom_sfx.prism_fire", src.location);
                    src.runCommand('inputpermission set @a[r=32] movement enabled');
                }
            },
            {
                delay: 20, action: (src) => {
                    src.runCommand('inputpermission set @s movement enabled');
                }
            }
        ])
        command.run(source);
    }
})

let auricPhotonizerSkill = new SkillHandler("ph:auric_photonizer", "auric_photonizer")
auricPhotonizerSkill.addSkill(1, {
    name: "§eStab",
    type: "Skill",
    cooldown_objective: "auric_photonizer_s1",
    cooldown: 15,
    charge: false,
    action: (source) => {
        source.playAnimation("animation.auric_photonizer.skill_1");
        source.runCommand(`scriptevent ph:ram_dash 8, 50, 2, custom_sfx.judgement_cut`);
        source.applyImpulse({ x: 0, y: -3, z: 0 });
    }
})

auricPhotonizerSkill.addSkill(2, {
    name: "§eBackleap",
    type: "Skill",
    cooldown_objective: "auric_photonizer_s2",
    cooldown: 15,
    charge: false,
    action: (source) => {
        source.addTag("BACKLEAP");
        source.playAnimation("animation.auric_photonizer.skill_2");
        source.applyKnockback({ x: source.getViewDirection().x * -2, z: source.getViewDirection().z * -2 }, 1.1);
        source.runCommand(`summon armor_stand ~~~ 0 0 a BACKLEAP`);
        source.runCommand(`effect @e[name=BACKLEAP] invisibility infinite 0 true`);
        source.playSound("mob.enderdragon.flap");
        const command = new CommandHandler([
            {
                delay: 10, action: (src) => {
                    src.runCommand(`execute as @e[name=BACKLEAP] at @s run damage @e[r=4,tag=!BACKLEAP] 52 entity_explosion entity @s`);
                    src.runCommand(`execute at @e[name=BACKLEAP] run particle ph:auric_photonizer_explode ~~0.5~`);
                    src.runCommand(`execute at @e[name=BACKLEAP] run particle ph:copper_mech_explode ~~0.5~`);
                    src.runCommand(`kill @e[name=BACKLEAP]`);
                    src.removeTag("BACKLEAP")
                }
            }
        ])
        command.run(source);
    }
})

auricPhotonizerSkill.addSkill(3, {
    name: "§6Blade Barrage",
    type: "Skill",
    cooldown_objective: "auric_photonizer_s3",
    cooldown: 40,
    charge: false,
    action: (source) => {
        source.addTag("BBARRAGE");
        source.runCommand(`scriptevent ph:boss_summon 5, 0.6, 26, ph:copper_mech_double_blade, custom_sfx.prism_fire`);
        const command = new CommandHandler([
            {
                delay: 120, action: (src) => {
                    src.removeTag("BBARRAGE")
                }
            }
        ])
        command.run(source);
    }
})

auricPhotonizerSkill.addSkill(4, {
    name: "§6Ethereal Blade",
    type: "Ultimate",
    cooldown_objective: "auric_photonizer_s4",
    cooldown: 40,
    charge: false,
    action: (source) => {
        source.addTag("SWORDIMMUNE");
        source.runCommand(`scriptevent ph:boss_summon 32, 1, 24, ph:copper_mech_sword, custom_sfx.animirra_summon`);
        source.runCommand(`inputpermission set @a[r=28] movement disabled`);
        const command = new CommandHandler([
            {
                delay: 30, action: (src) => {
                    src.runCommand(`scriptevent ph:boss_summon 32, 1, 24, ph:copper_mech_sword, custom_sfx.animirra_summon`);
                    src.runCommand(`inputpermission set @a[r=28] movement disabled`);
                }
            },
            {
                delay: 30, action: (src) => {
                    src.runCommand(`scriptevent ph:boss_summon 32, 1, 24, ph:copper_mech_sword, custom_sfx.animirra_summon`);
                    src.runCommand(`inputpermission set @a[r=28] movement disabled`);
                }
            },
            {
                delay: 15, action: (src) => {
                    src.runCommand(`inputpermission set @a[r=28] movement enabled`);
                    src.removeTag("SWORDIMMUNE");
                }
            }
        ])
        command.run(source);
    }
})

let theBleedingSpireSkill = new SkillHandler("ph:the_bleeding_spire", "the_bleeding_spire")
theBleedingSpireSkill.addSkill(1, {
    name: "§4Carnage",
    type: "Skill",
    cooldown_objective: "the_bleeding_spire_s1",
    cooldown: 15,
    charge: false,
    action: (source) => {
        source.playAnimation("animation.the_bleeding_spire.skill_1");
        source.runCommand(`scriptevent ph:ram_dash 8, 25, 2, weapon_slash.slash_heavy`);
        source.applyImpulse({ x: 0, y: -3, z: 0 });
    }
})

theBleedingSpireSkill.addSkill(2, {
    name: "§4Entanglement",
    type: "Skill",
    cooldown_objective: "the_bleeding_spire_s2",
    cooldown: 30,
    charge: false,
    action: (source) => {
        source.playAnimation("animation.the_bleeding_spire.attack_3");
        const entities = source.dimension.getEntities({
            location: source.location,
            minDistance: 1.2,
            maxDistance: 32,
            closest: 3,
            excludeFamilies: ["inanimate"],
            excludeTypes: ["minecraft:item"]
        })

        const playerLoc = source.location;

        if (!entities) {
            source.sendMessage("Target not found, resetting the cooldown to 0");
            setScore(source, "the_bleeding_spire_s2", 0);
        }
        for (const entity of entities) {
            entity.applyDamage(28, {
                damagingEntity: source,
                cause: "magic"
            })
            source.addEffect("instant_health", 1, {
                amplifier: 2
            })
            if (entity?.typeId != "minecraft:player") {
                entity.addEffect("slowness", 100, {
                    amplifier: 255
                });
            } else {
                entity.addEffect("slowness", 100, {
                    amplifier: 4
                });
                entity.runCommand("inputpermission set @s jump disabled");
                entity.runCommand('tellraw @s {"rawtext":[{"text":"You have been stunned for 5 seconds."}]}');
                system.runTimeout(() => {
                    entity.runCommand('tellraw @s {"rawtext":[{"text":"Stunned effect is gone!"}]}');
                    entity.runCommand("inputpermission set @s jump enabled");
                }, 100);
            }
            const entityLoc = entity.location;

            let pConfig = new MolangVariableMap();
            pConfig.setFloat("variable.x", getAxisDelta(playerLoc, entityLoc).x);
            pConfig.setFloat("variable.y", getAxisDelta(playerLoc, entityLoc).y);
            pConfig.setFloat("variable.z", getAxisDelta(playerLoc, entityLoc).z);

            source.dimension.spawnParticle("ph:entanglement_lead_particle", source.location, pConfig);
        }
    }
})

theBleedingSpireSkill.addSkill(3, {
    name: "§cCrimson Ray",
    type: "Ultimate",
    cooldown_objective: "the_bleeding_spire_s3",
    cooldown: 30,
    charge: false,
    action: (source) => {
        source.playAnimation("animation.the_bleeding_spire.attack_1");
        source.runCommand(`scriptevent ph:boss_summon 24, 0.7, 32, ph:crimson_laser`)
        const entities = source.dimension.getEntities({
            location: source.location,
            minDistance: 1.2,
            maxDistance: 32,
            closest: 3,
            excludeFamilies: ["inanimate"],
            excludeTypes: ["minecraft:item"]
        })

        const playerLoc = source.location;

        if (!entities) {
            source.sendMessage("Target not found, resetting the cooldown to 0");
            setScore(source, "the_bleeding_spire_s2", 0);
        }
        for (const entity of entities) {
            entity.applyDamage(12, {
                damagingEntity: source,
                cause: "magic"
            })
            source.addEffect("instant_health", 1, {
                amplifier: 2
            })
            if (entity?.typeId != "minecraft:player") {
                entity.addEffect("slowness", 100, {
                    amplifier: 255
                });
            } else {
                entity.addEffect("slowness", 100, {
                    amplifier: 4
                });
                entity.runCommand("inputpermission set @s jump disabled");
                entity.runCommand('tellraw @s {"rawtext":[{"text":"You have been stunned for 5 seconds."}]}');
                system.runTimeout(() => {
                    entity.runCommand('tellraw @s {"rawtext":[{"text":"Stunned effect is gone!"}]}');
                    entity.runCommand("inputpermission set @s jump enabled");
                }, 100);
            }
            const entityLoc = entity.location;

            let pConfig = new MolangVariableMap();
            pConfig.setFloat("variable.x", getAxisDelta(playerLoc, entityLoc).x);
            pConfig.setFloat("variable.y", getAxisDelta(playerLoc, entityLoc).y);
            pConfig.setFloat("variable.z", getAxisDelta(playerLoc, entityLoc).z);

            source.dimension.spawnParticle("ph:entanglement_lead_particle", source.location, pConfig);
        }
        system.runTimeout(() => {
            source.runCommand("inputpermission set @s movement enabled");
        }, 20);
    }
})

const weaponSkills = [solarisverdantSkill, superchargedCopperAxeSkill, prismWeaverSkill, auricPhotonizerSkill, theBleedingSpireSkill];
export { weaponSkills }
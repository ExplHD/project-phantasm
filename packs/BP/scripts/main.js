// data/scripts/main.ts
import {
  world as world14,
  system as system14,
  EquipmentSlot as EquipmentSlot6
} from "@minecraft/server";

// data/scripts/events.ts
import { world as world8, system as system9, ItemStack as ItemStack4, MolangVariableMap as MolangVariableMap3, EquipmentSlot as EquipmentSlot3, EntityDamageCause as EntityDamageCause3 } from "@minecraft/server";

// data/scripts/classes/weapon_handler.ts
import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
var WeaponHandler = class {
  itemId;
  objective;
  delayPerAttackPattern;
  attackPatterns;
  /**
   * @param { string } itemId - Item identifier, ex: ph:solaris_verdant
   * @param { string } objective - Scoreboard's Objective to use
   * @param { Array<number> } delayPerAttackPattern - Delay to each attack pattern
   * @param { Array<string> } attackPatterns - List of attack patterns
   */
  constructor(itemId, objective, delayPerAttackPattern, attackPatterns) {
    this.itemId = itemId;
    this.objective = objective;
    this.delayPerAttackPattern = delayPerAttackPattern;
    this.attackPatterns = attackPatterns;
  }
  // -------- Scoreboard utils ----------
  static addScore(target, objective, score) {
    try {
      world.scoreboard.getObjective(objective).addScore(target, score);
    } catch (e) {
      target.runCommand(`scoreboard players add "${target.name}" ${objective} ${score}`);
    }
  }
  static removeScore(target, objective, score) {
    try {
      world.scoreboard.getObjective(objective).addScore(target, -score);
    } catch (e) {
      target.runCommand(`scoreboard players remove "${target.name}" ${objective} ${score}`);
    }
  }
  static setScore(target, objective, score) {
    try {
      world.scoreboard.getObjective(objective).setScore(target, score);
    } catch (e) {
      target.runCommand(`scoreboard players set "${target.name}" ${objective} ${score}`);
    }
  }
  static getScore(target, objective) {
    try {
      return world.scoreboard.getObjective(objective).getScore(target) || 0;
    } catch (error) {
      return 0;
    }
  }
  // -------- Core attack handler ----------
  handleAttack(source) {
    const currentStep = getScore(source, this.objective);
    if (currentStep < this.attackPatterns.length) {
      const pattern = this.attackPatterns[currentStep];
      const delay = this.delayPerAttackPattern[currentStep];
      if (getScore(source, "delayatk") > 0 && getScore(source, "delayatk") < delay) return;
      triggerAttack(source, pattern.delay, pattern.damage, pattern.radius, pattern.animation, pattern.sound);
      if (currentStep < this.attackPatterns.length - 1) {
        addScore(source, this.objective, 1);
      } else {
        setScore(source, this.objective, 0);
      }
      setScore(source, "delayatk", 1);
      if (!pattern.action) return;
      pattern.action.run(source);
    }
  }
};
var SkillSwitcher = class {
  itemId;
  objective;
  skills;
  constructor(itemId, objective, skills) {
    this.itemId = itemId;
    this.objective = objective;
    this.skills = skills;
  }
  switchSkill(source) {
    let currentSkill = WeaponHandler.getScore(source, this.objective);
    if (currentSkill >= this.skills.length) {
      WeaponHandler.setScore(source, this.objective, 0);
      currentSkill = 0;
    }
    const skillData = this.skills[currentSkill];
    if (!skillData) return;
    source.sendMessage(skillData.skillSMessage);
    if (currentSkill < this.skills.length) {
      WeaponHandler.addScore(source, this.objective, 1);
    } else {
      WeaponHandler.setScore(source, this.objective, 0);
    }
  }
};
var SkillHandler = class {
  itemId;
  skills;
  objective;
  /**
   * @param { string } itemId - Item identifier, ex: ph:solaris_verdant
   * @param { string } objective - The Skills Wheel, ex: solaris_verdant = 1 > Animitta Splitter
   */
  constructor(itemId, objective) {
    this.itemId = itemId;
    this.skills = {};
    this.objective = objective;
  }
  /**
   * Register new skills.
   *
   * @param {number} id - Unique Identifier for skill (number).
   * @param {SkillConfig} config - Configuration about the skill.
   *
   */
  /**
   * @property {string} config.name - Skill name.
   *
   * @property {"Skill" | "Ultimate"} config.type
   * Skill type, choose between "Skill", and "Ultimate".
   *
   * @property {string} config.cooldown_objective
   * The name of scoreboard objective for cooldown system.
   *
   * @property {number} config.cooldown
   * Cooldown length on seconds / charge
   * Use **negative value** If the skill using charge system.
   *
   * @property {boolean} config.charge
   * Is the skill using charge system.
   *
   * @property {number} config.charge_min?
   * Minimum charge for using the skill.
   *
   * @property {(source: import("@minecraft/server").Player) => void} config.action
   * Function that calls when the skill is used.
   * `source` is entity/player who uses the skill.
   */
  addSkill(id, config) {
    this.skills[id] = config;
  }
  runSkill(source, id) {
    const skill = this.skills[id];
    if (!skill) return console.error(`Skill ${id} not found!`);
    const currentCd = getScore(source, skill.cooldown_objective);
    if (currentCd > 0 && currentCd != void 0 && skill.charge == false) return;
    if (skill.charge == true && currentCd < skill.charge_min) return;
    source.runCommand(`tellraw @a[r=64] {"rawtext":[{"text":"${source.name} Used their ${skill.type} ${skill.name}"}]}`);
    skill.action(source);
    addScore(source, skill.cooldown_objective, skill.cooldown);
  }
  useSkill(source) {
    const currentSkill = getScore(source, this.objective) || 0;
    this.runSkill(source, currentSkill);
  }
};
var CommandHandler = class {
  commands;
  constructor(commands = []) {
    this.commands = commands;
  }
  addCommand(delay, action) {
    this.commands.push({ delay, action });
  }
  run(source) {
    let totalDelay = 0;
    for (const cmd of this.commands) {
      totalDelay += cmd.delay;
      system.runTimeout(() => {
        cmd.action(source);
      }, totalDelay);
    }
  }
};
function triggerAttack(source, delay, damage, radius, animation, sound) {
  if (!source) return console.error("No Players found!");
  if (!delay && !damage) return console.error("Specify Damage and Delay before Damage Value");
  if (!radius) return console.error("Specify Radius Value");
  if (!animation) return;
  source.playAnimation(animation);
  system.runTimeout(() => {
    applyCustomDamage(source, damage, radius);
    if (!sound) return;
    source.dimension.playSound(sound, source.location);
  }, delay);
}
function applyCustomDamage(source, damage, radius) {
  const strengthLevel = (source.getEffect("strength")?.amplifier ?? -1) + 1;
  const strengthFormula = 1 + strengthLevel * 0.45;
  const weaknessLevel = (source.getEffect("weakness")?.amplifier ?? -1) + 1;
  const weaknessFormula = Math.max(0, 1 - weaknessLevel * 0.24);
  const item = source?.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
  const sharpnessLevel = item?.getComponent("enchantable")?.getEnchantment("sharpness")?.level ?? 0;
  const sharpnessDamage = sharpnessLevel * 1.25;
  const calculatedDamage = (damage + sharpnessDamage) * strengthFormula * weaknessFormula;
  const fireAspect = item?.getComponent("enchantable")?.getEnchantment("fire_aspect")?.level ?? 0;
  const knockback = item?.getComponent("enchantable")?.getEnchantment("knockback")?.level ?? 0;
  const entities = source.dimension.getEntities({
    location: source.location,
    minDistance: 0.1,
    maxDistance: radius,
    excludeTypes: ["minecraft:item", "minecraft:lightning_bolt", "minecraft:xp_orb"],
    excludeFamilies: ["inanimate", "invulnerable"]
  });
  entities.forEach((entity) => {
    entity.applyDamage(calculatedDamage, {
      cause: EntityDamageCause.entityAttack,
      damagingEntity: source
    });
    let dx = entity.location.x - source.location.x;
    let dz = entity.location.z - source.location.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0) {
      dx /= dist;
      dz /= dist;
    } else {
      dx = 0;
      dz = 1;
    }
    const kbStrength = 1 + knockback * 1;
    entity.applyKnockback({ x: dx * kbStrength, z: dz * kbStrength }, 0.4);
    if (fireAspect > 0) entity.setOnFire(fireAspect * 4 - 1);
  });
}

// data/scripts/data/weapon_skills.ts
import { MolangVariableMap, system as system2, EntityDamageCause as EntityDamageCause2 } from "@minecraft/server";
function getAxisDelta(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z
  };
}
var solarisverdantSkill = new SkillHandler("ph:solaris_verdant", "solaris_verdant");
solarisverdantSkill.addSkill(1, {
  name: "\xA7aAnimirra",
  type: "Ability",
  cooldown_objective: "solaris_verdant_s1",
  cooldown: 35,
  charge: false,
  action: (source) => {
    const location = { x: source.location.x, y: source.location.y + 1, z: source.location.z };
    source.addTag("animirra");
    source.playAnimation("animation.solaris_verdant.attack_3");
    source.dimension.spawnParticle("ph:solaris_verdant_animirra", location);
    source.runCommand("inputpermission set @s movement disabled");
    const animirra = new CommandHandler([
      {
        delay: 10,
        action: (src) => {
          src.runCommand("particle ph:solaris_verdant_summon ~~1~7");
          src.runCommand("particle ph:solaris_verdant_summon ~~1~-7");
          src.runCommand("particle ph:solaris_verdant_summon ~7~1~");
          src.runCommand("particle ph:solaris_verdant_summon ~-7~1~");
          src.runCommand("summon ph:animirra_summon ~~1~7 ~~");
          src.runCommand("summon ph:animirra_summon ~~1~-7 ~~");
          src.runCommand("summon ph:animirra_summon ~7~1~ ~~");
          src.runCommand("summon ph:animirra_summon ~-7~1~ ~~");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
          source.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    animirra.run(source);
  }
});
solarisverdantSkill.addSkill(2, {
  name: "\xA7aSolaris Slash",
  type: "Ability",
  cooldown_objective: "solaris_verdant_s2",
  cooldown: 20,
  charge: false,
  action: (source) => {
    source.playAnimation("animation.solaris_verdant.attack_3");
    source.runCommand("inputpermission set @s movement disabled");
    const solarisSlash = new CommandHandler([
      {
        delay: 10,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_heavy", src.location);
          src.runCommand("summon ph:solaris_slash ^^3^5 ~ 0");
          src.runCommand("summon ph:solaris_slash ^^3^5 ~-45 0");
          src.runCommand("summon ph:solaris_slash ^^3^5 ~45 0");
          source.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    solarisSlash.run(source);
  }
});
solarisverdantSkill.addSkill(3, {
  name: "\xA7a\xA7lNatura Vulkan",
  type: "Ultimate",
  cooldown_objective: "solaris_verdant_s3",
  cooldown: 60,
  charge: false,
  action: (source) => {
    const location = { x: source.location.x, y: source.location.y + 1, z: source.location.z };
    source.addTag("animirra");
    source.playAnimation("animation.solaris_verdant.attack_3");
    source.dimension.spawnParticle("ph:solaris_verdant_animirra", location);
    source.runCommand("inputpermission set @s movement disabled");
    const animirra = new CommandHandler([
      {
        delay: 10,
        action: (src) => {
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
          src.runCommand("particle ph:solaris_verdant_summon ~~1~7");
          src.runCommand("particle ph:solaris_verdant_summon ~~1~-7");
          src.runCommand("particle ph:solaris_verdant_summon ~7~1~");
          src.runCommand("particle ph:solaris_verdant_summon ~-7~1~");
          src.runCommand("summon ph:animirra_summon_ultimate ~~1~7 ~~");
          src.runCommand("summon ph:animirra_summon_ultimate ~~1~-7 ~~");
          src.runCommand("summon ph:animirra_summon_ultimate ~7~1~ ~~");
          src.runCommand("summon ph:animirra_summon_ultimate ~-7~1~ ~~");
        }
      },
      {
        delay: 10,
        action: (src) => {
          src.runCommand(`scriptevent ph:boss_summon 24, 20, 24, ph:animirra_meteor, custom_sfx.animirra_summon`);
          src.runCommand("summon ph:animirra_summon_ultimate ~~1~14 ~~");
          src.runCommand("summon ph:animirra_summon_ultimate ~~1~-14 ~~");
          src.runCommand("summon ph:animirra_summon_ultimate ~14~1~ ~~");
          src.runCommand("summon ph:animirra_summon_ultimate ~-14~1~ ~~");
          source.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    animirra.run(source);
  }
});
var superchargedCopperAxeSkill = new SkillHandler("ph:supercharged_copper_axe", "supercharged_copper_axe");
superchargedCopperAxeSkill.addSkill(1, {
  name: "\xA76Charge",
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
});
superchargedCopperAxeSkill.addSkill(2, {
  name: "\xA7ePowered Leap",
  type: "Ability",
  cooldown_objective: "supercharged_copper_axe_s2",
  cooldown: 10,
  charge: false,
  action: (source) => {
    source.dimension.spawnParticle("ph:lightning_flash", source.location);
    source.dimension.spawnParticle("ph:copper_mech_explosion", source.location);
    source.applyKnockback({ x: source.getViewDirection().x * 2, z: source.getViewDirection().z * 2 }, 1.2);
    source.dimension.createExplosion(source.location, 6, {
      breaksBlocks: false,
      source
    });
    source.dimension.playSound("custom_sfx.high_voltage_spark", source.location);
    addScore(source, "supercharged_copper_axe_s3", 1);
    addScore(source, "supercharged_copper_axe_s4", 1);
  }
});
superchargedCopperAxeSkill.addSkill(3, {
  name: "\xA76Discharge",
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
        delay: 3,
        action: (src) => {
          src.runCommand("summon ph:charged_copper_laser ~~~ 90 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 270 0");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.runCommand("summon ph:charged_copper_laser ~~~ 45 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 135 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 215 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 315 0");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.runCommand("summon ph:charged_copper_laser ~~~ 0 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 180 0");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      }
    ]);
    discharge.run(source);
  }
});
superchargedCopperAxeSkill.addSkill(4, {
  name: "\xA7pUltimate \xA76Discharge",
  type: "Ultimate",
  cooldown_objective: "supercharged_copper_axe_s4",
  cooldown: -15,
  charge: true,
  charge_min: 15,
  action: (source) => {
    source.dimension.spawnParticle("ph:lightning_flash", source.location);
    source.dimension.spawnParticle("ph:lightning_sparks", source.location);
    source.playAnimation("animation.charged_copper_axe.attack_4");
    source.runCommand("inputpermission set @s camera disabled");
    source.runCommand("inputpermission set @s movement disabled");
    const discharge = new CommandHandler([
      {
        delay: 3,
        action: (src) => {
          src.runCommand("summon ph:charged_copper_laser ~~~ 90 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 270 0");
          src.runCommand("summon lightning_bolt ~5~~ ");
          src.runCommand("summon lightning_bolt ~-5~~ ");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.runCommand("summon ph:charged_copper_laser ~~~ 45 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 135 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 215 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 315 0");
          src.runCommand("summon lightning_bolt ~5~~5 ");
          src.runCommand("summon lightning_bolt ~-5~~5 ");
          src.runCommand("summon lightning_bolt ~5~~-5 ");
          src.runCommand("summon lightning_bolt ~-5~~-5 ");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.runCommand("summon ph:charged_copper_laser ~~~ 0 0");
          src.runCommand("summon ph:charged_copper_laser ~~~ 180 0");
          src.runCommand("summon lightning_bolt ~~~5 ");
          src.runCommand("summon lightning_bolt ~~~-5");
          src.runCommand("summon lightning_bolt ~10~~ ");
          src.runCommand("summon lightning_bolt ~-10~~ ");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 5,
        action: (src) => {
          src.runCommand("summon lightning_bolt ~10~~10 ");
          src.runCommand("summon lightning_bolt ~-10~~10 ");
          src.runCommand("summon lightning_bolt ~10~~-10 ");
          src.runCommand("summon lightning_bolt ~-10~~-10 ");
        }
      },
      {
        delay: 5,
        action: (src) => {
          src.runCommand("summon lightning_bolt ~~~10 ");
          src.runCommand("summon lightning_bolt ~~~-10");
          src.runCommand("inputpermission set @s camera enabled");
          src.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    discharge.run(source);
  }
});
var prismWeaverSkill = new SkillHandler("ph:prism_weaver", "prism_weaver");
prismWeaverSkill.addSkill(1, {
  name: "\xA73Bubble Barrage",
  type: "Skill",
  cooldown_objective: "prism_weaver_s1",
  cooldown: 25,
  charge: false,
  action: (source) => {
    source.runCommand("inputpermission set @s movement disabled");
    source.playAnimation("animation.prism_weaver.skill_1");
    const command = new CommandHandler([
      {
        delay: 7,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
        }
      },
      {
        delay: 7,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
        }
      },
      {
        delay: 7,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
        }
      },
      {
        delay: 7,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
        }
      },
      {
        delay: 7,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
        }
      },
      {
        delay: 7,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.dimension.playSound("custom_sfx.animirra_summon", src.location);
          src.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    command.run(source);
  }
});
prismWeaverSkill.addSkill(2, {
  name: "\xA7bPrism Wave Wall",
  type: "Skill",
  cooldown_objective: "prism_weaver_s2",
  cooldown: 25,
  charge: false,
  action: (source) => {
    source.runCommand("inputpermission set @s movement disabled");
    source.playAnimation("animation.prism_weaver.attack_2");
    const command = new CommandHandler([
      {
        delay: 10,
        action: (src) => {
          source.runCommand("summon ph:water_wall ^^^4 ~ 0");
          source.runCommand("summon ph:water_wall ^-2^^3 ~ 0");
          source.runCommand("summon ph:water_wall ^2^^3 ~ 0");
          source.runCommand("summon ph:water_wall ^-4^^2 ~ 0");
          source.runCommand("summon ph:water_wall ^4^^2 ~ 0");
          source.dimension.playSound("custom_sfx.prism_fire", source.location);
          src.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    command.run(source);
  }
});
prismWeaverSkill.addSkill(3, {
  name: "\xA73Vortex \xA7bPrism",
  type: "Ultimate",
  cooldown_objective: "prism_weaver_s3",
  cooldown: 70,
  charge: false,
  action: (source) => {
    source.runCommand("inputpermission set @a[r=32] movement disabled");
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
    entities.forEach((entity) => {
      if (!entity || !entity.isValid) return;
      if (entity.id === source.id) return;
      if (entity.typeId?.startsWith("minecraft:item")) return;
      const dx = source.location.x - entity.location.x;
      const dy = source.location.y - entity.location.y;
      const dz = source.location.z - entity.location.z;
      const dir = normalize({ x: dx, y: dy, z: dz });
      const pullStrength = 4.5;
      const impulse = { x: dir.x * pullStrength, y: Math.max(dir.y * 0.7, 0.1), z: dir.z * pullStrength };
      try {
        if (typeof entity.applyImpulse === "function") {
          entity.applyImpulse(impulse);
          entity.addEffect("slowness", 60, { amplifier: 255 });
        } else {
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
        delay: 50,
        action: (src) => {
          src.playAnimation("animation.prism_weaver.attack_3");
        }
      },
      {
        delay: 10,
        action: (src) => {
          const entities2 = src.dimension.getEntities({
            location: src.location,
            maxDistance: 32,
            minDistance: 1
          });
          src.dimension.spawnParticle("ph:vortex_prism_push", src.location);
          function normalize2(v) {
            const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (len === 0) return { x: 0, y: 0, z: 0 };
            return { x: v.x / len, y: v.y / len, z: v.z / len };
          }
          entities2.forEach((entity) => {
            if (!entity || !entity.isValid) return;
            if (entity.id === source.id) return;
            if (entity.typeId?.startsWith("minecraft:item")) return;
            const dx = source.location.x - entity.location.x;
            const dy = source.location.y - entity.location.y;
            const dz = source.location.z - entity.location.z;
            const dir = normalize2({ x: dx, y: dy, z: dz });
            const pullStrength = 8.6;
            const impulse = { x: dir.x * pullStrength, y: Math.max(dir.y * 0.7, 0.1), z: dir.z * -pullStrength };
            try {
              if (typeof entity.applyImpulse === "function") {
                entity.applyImpulse(impulse);
              } else {
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
          src.runCommand("inputpermission set @a[r=32] movement enabled");
        }
      },
      {
        delay: 20,
        action: (src) => {
          src.runCommand("inputpermission set @s movement enabled");
        }
      }
    ]);
    command.run(source);
  }
});
var auricPhotonizerSkill = new SkillHandler("ph:auric_photonizer", "auric_photonizer");
auricPhotonizerSkill.addSkill(1, {
  name: "\xA7eStab",
  type: "Skill",
  cooldown_objective: "auric_photonizer_s1",
  cooldown: 15,
  charge: false,
  action: (source) => {
    source.playAnimation("animation.auric_photonizer.skill_1");
    source.runCommand(`scriptevent ph:ram_dash 8, 50, 2, custom_sfx.judgement_cut`);
    source.applyImpulse({ x: 0, y: -3, z: 0 });
  }
});
auricPhotonizerSkill.addSkill(2, {
  name: "\xA7eBackleap",
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
        delay: 10,
        action: (src) => {
          src.runCommand(`execute as @e[name=BACKLEAP] at @s run damage @e[r=4,tag=!BACKLEAP] 52 entity_explosion entity @s`);
          src.runCommand(`execute at @e[name=BACKLEAP] run particle ph:auric_photonizer_explode ~~0.5~`);
          src.runCommand(`execute at @e[name=BACKLEAP] run particle ph:copper_mech_explode ~~0.5~`);
          src.runCommand(`kill @e[name=BACKLEAP]`);
          src.removeTag("BACKLEAP");
        }
      }
    ]);
    command.run(source);
  }
});
auricPhotonizerSkill.addSkill(3, {
  name: "\xA76Blade Barrage",
  type: "Skill",
  cooldown_objective: "auric_photonizer_s3",
  cooldown: 40,
  charge: false,
  action: (source) => {
    source.addTag("BBARRAGE");
    source.runCommand(`scriptevent ph:boss_summon 5, 0.6, 26, ph:copper_mech_double_blade, custom_sfx.prism_fire`);
    const command = new CommandHandler([
      {
        delay: 120,
        action: (src) => {
          src.removeTag("BBARRAGE");
        }
      }
    ]);
    command.run(source);
  }
});
auricPhotonizerSkill.addSkill(4, {
  name: "\xA76Ethereal Blade",
  type: "Ultimate",
  cooldown_objective: "auric_photonizer_s4",
  cooldown: 40,
  charge: false,
  action: (source) => {
    source.addTag("SWORDIMMUNE");
    source.runCommand(`scriptevent ph:boss_summon 32, 1, 24, ph:copper_mech_sword, custom_sfx.animirra_summon`);
    const command = new CommandHandler([
      {
        delay: 30,
        action: (src) => {
          src.runCommand(`scriptevent ph:boss_summon 32, 1, 24, ph:copper_mech_sword, custom_sfx.animirra_summon`);
          src.runCommand(`inputpermission set @a[r=28] movement disabled`);
        }
      },
      {
        delay: 30,
        action: (src) => {
          src.runCommand(`scriptevent ph:boss_summon 32, 1, 24, ph:copper_mech_sword, custom_sfx.animirra_summon`);
          src.runCommand(`inputpermission set @a[r=28] movement disabled`);
        }
      },
      {
        delay: 15,
        action: (src) => {
          src.removeTag("SWORDIMMUNE");
        }
      }
    ]);
    command.run(source);
  }
});
var theBleedingSpireSkill = new SkillHandler("ph:the_bleeding_spire", "the_bleeding_spire");
theBleedingSpireSkill.addSkill(1, {
  name: "\xA74Carnage",
  type: "Skill",
  cooldown_objective: "the_bleeding_spire_s1",
  cooldown: 15,
  charge: false,
  action: (source) => {
    source.playAnimation("animation.the_bleeding_spire.skill_1");
    source.runCommand(`scriptevent ph:ram_dash 8, 25, 2, weapon_slash.slash_heavy`);
    source.applyImpulse({ x: 0, y: -3, z: 0 });
  }
});
theBleedingSpireSkill.addSkill(2, {
  name: "\xA74Entanglement",
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
    });
    const playerLoc = source.location;
    if (!entities) {
      source.sendMessage("Target not found, resetting the cooldown to 0");
      setScore(source, "the_bleeding_spire_s2", 0);
    }
    for (const entity of entities) {
      entity.applyDamage(28, {
        damagingEntity: source,
        cause: EntityDamageCause2.magic
      });
      source.addEffect("instant_health", 2, {
        amplifier: 2
      });
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
        system2.runTimeout(() => {
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
});
theBleedingSpireSkill.addSkill(3, {
  name: "\xA7cCrimson Ray",
  type: "Ultimate",
  cooldown_objective: "the_bleeding_spire_s3",
  cooldown: 30,
  charge: false,
  action: (source) => {
    source.playAnimation("animation.the_bleeding_spire.attack_1");
    source.runCommand(`scriptevent ph:boss_summon 24, 0.7, 32, ph:crimson_laser`);
    const entities = source.dimension.getEntities({
      location: source.location,
      minDistance: 1.2,
      maxDistance: 32,
      closest: 3,
      excludeFamilies: ["inanimate"],
      excludeTypes: ["minecraft:item"]
    });
    const playerLoc = source.location;
    if (!entities) {
      source.sendMessage("Target not found, resetting the cooldown to 0");
      setScore(source, "the_bleeding_spire_s2", 0);
    }
    for (const entity of entities) {
      entity.applyDamage(12, {
        damagingEntity: source,
        cause: EntityDamageCause2.magic
      });
      source.addEffect("instant_health", 1, {
        amplifier: 2
      });
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
        system2.runTimeout(() => {
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
    system2.runTimeout(() => {
      source.runCommand("inputpermission set @s movement enabled");
    }, 20);
  }
});
var weaponSkills = [solarisverdantSkill, superchargedCopperAxeSkill, prismWeaverSkill, auricPhotonizerSkill, theBleedingSpireSkill];

// data/scripts/phantasmConstants.ts
var addLore = /* @__PURE__ */ new Map([
  ["ph:solaris_verdant", ["\xA7r\xA77Interact to :", " \xA7r\xA7cUse Skill", "\xA7r\xA77Sneak to :", " \xA7r\xA7cChange Skills", "\xA79Phantasm"]],
  ["ph:supercharged_copper_axe", ["\xA7r\xA77Interact to :", " \xA7r\xA7cUse Skill", "\xA7r\xA77Sneak to :", " \xA7r\xA7cChange Skills", "\xA79Phantasm"]],
  ["ph:prism_weaver", ["\xA7r\xA77Interact to :", " \xA7r\xA7cUse Skill", "\xA7r\xA77Sneak to :", " \xA7r\xA7cChange Skills", "\xA79Phantasm"]],
  ["ph:auric_photonizer", ["\xA7r\xA77Interact to :", " \xA7r\xA7cUse Skill", "\xA7r\xA77Sneak to :", " \xA7r\xA7cChange Skills", "\xA79Phantasm"]],
  ["ph:charged_copper_axe", ["\xA7r\xA79Has Charge Passive", "\xA7r\xA7cKilling with this grants Auric Charges", "\xA7r\xA7aInteract to perform Lightning Slash", "\xA79Phantasm"]],
  ["ph:spectric_bow", ["\xA7r\xA77Support Spectral Arrow", "\xA7r\xA7aUse Spectral Arrow for Maximum Potential", "\xA79Phantasm"]],
  ["ph:time_polarizer", ["\xA7r\xA77Speeds you up or Slow anything around if sneaking when interacted", "\xA7r\xA77Grants Permanent Speed boost when put into accessory slot", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA79Phantasm"]],
  ["ph:flow_channeler", ["\xA77Dash smoothly by interacting this item", "\xA79Enchantable", "\xA79Phantasm"]],
  ["ph:hell_charge", ["\xA77Spam interact to boost you", "\xA79Enchantable", "\xA79Phantasm"]],
  ["ph:ocean_tide_helmet", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:ocean_tide_chestplate", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:ocean_tide_leggings", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:ocean_tide_boots", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:naturalist_helmet", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:naturalist_chestplate", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:naturalist_leggings", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:naturalist_boots", ["\xA7r\xA79+4 Armor Toughness", "\xA79Phantasm"]],
  ["ph:impulse_booster", ["\xA77Dash absurdly fast by interacting this item", "Bypass 70% of the knockback resistance", "\xA79Enchantable", "\xA79Phantasm"]],
  ["ph:auric_star", ["\xA7aUpgrade your passive dash ability to second phase", "\xA79Upgrade to : Passive Dash Ability", "\xA79Phantasm"]],
  ["ph:cruxshaper", ["\xA7r\xA7aInteract to perform Plunge Attack", "\xA7r\xA79Mace Variant", "\xA79Phantasm"]],
  ["ph:nature_staff", ["\xA7r\xA79A Quarter-Close ranged weapons", " \xA7r\xA79Interact to shoot slow lasers", "\xA7r\xA7aSneaking will cast alternate attacks with longer cooldown.", "\xA79Phantasm"]],
  ["ph:weeping_repair", ["\xA7r\xA77Repairs everything in your inventory, to maximum durability INSTANTLY", "\xA7r\xA77Repairs all items slowly when put into accessory slot", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA7r\xA79Experience Cost : 30 Experience Level", "\xA7r\xA7cCooldown : 10 Minutes", "\xA79Phantasm"]],
  ["ph:suspicious_mushroom", ["\xA7r\xA77Minor improvement to all stats for 10 minutes", "\xA79Phantasm"]],
  ["ph:the_crimson_watcher", ["\xA7r\xA7725% Chance to summon laser when hitting entity / hurt by entity", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA79Phantasm"]],
  ["ph:fire_bracelet", ["\xA7r\xA77An Alternative to Fire Aspect Enchantment, gives you short Fire Res too", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA79Phantasm"]],
  ["minecraft:wooden_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["minecraft:stone_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["minecraft:copper_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["minecraft:iron_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["minecraft:golden_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["minecraft:diamond_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["minecraft:netherite_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA7aInteract to parry, damages 30 durability on success"]],
  ["ph:prismatic_sword", ["\xA7r\xA79+300ms Parry", "\xA7r\xA79+1 Reach", "\xA7r\xA7cPiercing Attack", "\xA7r\xA7aInteract to parry, damages 30 durability on success", "\xA79Phantasm"]],
  ["ph:seiketsu", ["\xA7r\xA79+700ms Parry", "\xA7r\xA7cArea Attack", "\xA7r\xA7aInteract to parry, damages 1 durability on success", "\xA79Phantasm"]],
  ["ph:auric_proton", ["\xA77Grants Auric Charge when hitting entity, being hurt, or periodically", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA79Phantasm"]],
  ["ph:condensed_sea_nature", ["\xA77Brings the gills, and the Nature Regeneration", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA79Phantasm"]],
  ["ph:dummy_spawn_egg", ["\xA7r\xA77Use this to test your damage!", "\xA7r\xA77Interact with this dummy to remove them", "\xA79Phantasm"]],
  ["ph:rust_coin", ["\xA77Double the Fortune, Double the Problem!", "\xA7r\xA79Accessory Item (Offhand, Hotbar Slot with +)", "\xA79Phantasm"]]
]);
var ORE_DROPS = /* @__PURE__ */ new Map([
  ["minecraft:coal_ore", "minecraft:coal"],
  ["minecraft:deepslate_coal_ore", "minecraft:coal"],
  ["minecraft:iron_ore", "minecraft:raw_iron"],
  ["minecraft:deepslate_iron_ore", "minecraft:raw_iron"],
  ["minecraft:copper_ore", "minecraft:raw_copper"],
  ["minecraft:deepslate_copper_ore", "minecraft:raw_copper"],
  ["minecraft:lapis_ore", "minecraft:lapis_lazuli"],
  ["minecraft:deepslate_lapis_ore", "minecraft:lapis_lazuli"],
  ["minecraft:gold_ore", "minecraft:raw_gold"],
  ["minecraft:deepslate_gold_ore", "minecraft:raw_gold"],
  ["minecraft:redstone_ore", "minecraft:redstone"],
  ["minecraft:deepslate_redstone_ore", "minecraft:redstone"],
  ["minecraft:emerald_ore", "minecraft:emerald"],
  ["minecraft:deepslate_emerald_ore", "minecraft:emerald"],
  ["minecraft:diamond_ore", "minecraft:diamond"],
  ["minecraft:deepslate_diamond_ore", "minecraft:diamond"],
  ["minecraft:nether_gold_ore", "minecraft:gold_ingot"],
  ["minecraft:quartz_ore", "minecraft:quartz"],
  ["minecraft:ancient_debris", "minecraft:ancient_debris"]
]);

// data/scripts/accessoriesRuntime.ts
import { world as world2, system as system3, ItemStack } from "@minecraft/server";
var accessoryRegistry = {
  "ph:fire_bracelet": {
    onHitEntity(player, event, hitTarget) {
      player.addEffect("fire_resistance", 100, { showParticles: false });
      hitTarget.setOnFire(7, true);
    }
  },
  "ph:rust_coin": {
    onBreakBlock(player, event, block) {
      const drop = ORE_DROPS.get(block.type.id);
      if (!drop) return;
      if (player.getGameMode() === "Creative") return;
      system3.run(() => {
        const itemDropped = player.dimension.getEntities({
          location: player.location,
          maxDistance: 5,
          type: "minecraft:item"
        });
        itemDropped.forEach((item) => {
          item.teleport(player.location);
        });
        event.dimension.spawnParticle("ph:rusted_coin_fortune", block.center());
        event.dimension.spawnItem(new ItemStack(drop, 1), player.location);
      });
    }
  },
  "ph:the_crimson_watcher": {
    onHurt(player, event) {
      system3.run(() => {
        const randomChance = Math.floor(Math.random() * 101);
        const { x, y, z } = player.location;
        if (randomChance < 26) {
          player.runCommand(`summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`);
        }
      });
    },
    onHitEntity(player, event, hitTarget) {
      const randomChance = Math.floor(Math.random() * 101);
      const { x, y, z } = hitTarget.location;
      if (randomChance < 26) {
        hitTarget.runCommand(`summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`);
      }
    }
  },
  "ph:auric_proton": {
    onHurt(player, event) {
      system3.run(() => {
        addScore(player, "auric_charge", 1);
        player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
      });
    },
    onHitEntity(player, event, hitTarget) {
      addScore(player, "auric_charge", 1);
      player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
    },
    onLoop(player, event) {
      system3.run(() => {
        addScore(player, "auric_charge", 1);
        player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
      });
    }
  },
  "ph:time_polarizer": {
    onLoop(player, event) {
      system3.run(() => {
        player.addEffect("speed", 100, {
          amplifier: 1,
          showParticles: false
        });
      });
    }
  },
  "ph:weeping_repair": {
    onLoop(player, event) {
      system3.run(() => {
        const inventory = player?.getComponent("minecraft:inventory")?.container;
        const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];
        for (let i = 0; i < inventory.size; i++) {
          const item = inventory.getItem(i);
          if (!item) continue;
          const durability = item.getComponent("minecraft:durability");
          if (!durability) continue;
          if (durability.damage == 0) continue;
          durability.damage -= 1;
          inventory.setItem(i, item);
        }
        for (const slot of slots) {
          const equipmentSlot = player?.getComponent("minecraft:equippable")?.getEquipmentSlot(slot);
          const item = equipmentSlot.getItem();
          if (!item) continue;
          const durability = item.getComponent("minecraft:durability");
          if (!durability) continue;
          if (durability.damage == 0) continue;
          durability.damage -= 1;
          equipmentSlot.setItem(item);
        }
      });
    }
  },
  "ph:condensed_sea_nature": {
    onLoop(player, event) {
      if (!player.isInWater) return;
      player.dimension.spawnParticle("ph:time_polarizer_speed", player.location);
      player.addEffect("water_breathing", 20);
      player.addEffect("regeneration", 100, { amplifier: 1 });
    }
  }
};
function handleAccessory(player, trigger, event, hitTarget) {
  for (const item of getAccessoryItems(player)) {
    const handler = accessoryRegistry[item.typeId]?.[trigger];
    handler?.(player, event, hitTarget, item);
  }
}
system3.runInterval(() => {
  for (const player of world2.getPlayers()) {
    handleAccessory(player, "onLoop", void 0);
  }
}, 100);

// data/scripts/loader.ts
import { world as world3, system as system4, ItemStack as ItemStack2 } from "@minecraft/server";
var objectives = [
  // System Scoreboard
  "delayatk",
  "sectick",
  "dash_cd",
  // Solaris Verdant (Animitta)
  "solaris_verdant",
  "solaris_verdant_atk",
  "solaris_verdant_s1",
  "solaris_verdant_s2",
  "solaris_verdant_s3",
  // Supercharged Copper Axe
  "supercharged_copper_axe",
  "supercharged_copper_axe_atk",
  "supercharged_copper_axe_s1",
  "supercharged_copper_axe_s2",
  "supercharged_copper_axe_s3",
  "supercharged_copper_axe_s4",
  // Other Weapon Runtime
  "charged_copper_axe",
  "auric_charge",
  "gapple_cooldown",
  // Prism Weaver
  "prism_weaver",
  "prism_weaver_atk",
  "prism_weaver_s1",
  "prism_weaver_s2",
  "prism_weaver_s3",
  // Auric Photonizer
  "auric_photonizer",
  "auric_photonizer_atk",
  "auric_photonizer_s1",
  "auric_photonizer_s2",
  "auric_photonizer_s3",
  "auric_photonizer_s4",
  // The Bleeding Spire
  "the_bleeding_spire",
  "the_bleeding_spire_atk",
  "the_bleeding_spire_s1",
  "the_bleeding_spire_s2",
  "the_bleeding_spire_s3",
  // Auric Communicator
  "auric_communicator_mode",
  "seiketsu_atk"
];
function loadScoreboards() {
  for (const objective of objectives) {
    if (!world3.scoreboard.getObjective(objective)) {
      world3.scoreboard.addObjective(objective);
      for (const player of world3.getPlayers()) {
        addScore(player, objective, 0);
      }
    }
  }
}
function onPlayerSpawn(player, initialSpawn) {
  const healthLevel = Number(player.getDynamicProperty("ph:health_level"));
  if (healthLevel != void 0 && healthLevel > 0) {
    player.runCommand(`effect @s health_boost infinite ${3 * healthLevel} true`);
    player.addEffect("instant_health", 1, {
      amplifier: 255,
      showParticles: false
    });
  }
  unstuckPlayer(player);
  const health = player?.getComponent("minecraft:health")?.currentValue;
  const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
  const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
  if (maxHealth && maxHealth > 0) {
    const healthVal = health ?? 0;
    let scaled = healthVal / maxHealth * 100;
    runUntilMoved(player, 10, () => {
      player.onScreenDisplay.setTitle(
        `bar0:${Math.min(100, Math.max(0, Math.floor(scaled)))}% healthind:${Math.floor(healthVal)}/${maxHealth} ${totalArmor}`,
        { fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 }
      );
    });
  }
  if (!initialSpawn) return;
  if (player.getDynamicProperty("ph:guidebook_acquired") === void 0 || player.getDynamicProperty("ph:guidebook_acquired") === false) {
    player.dimension.spawnItem(new ItemStack2("ph:guidebook"), player.location);
    player.sendMessage("\xA7eWelcome to Phantasm! Pick up your Guidebook or use /guide to learn the features of this add-on.");
  }
  const playerInput = player.inputInfo.lastInputModeUsed;
  if (playerInput == "Touch") {
    player.sendMessage("\xA7eIt is recommended for you to use the Joystick + Crosshair with Action Button Enabled, for making the using weapon experience easier");
  }
  const properties = [
    "ph:dash_level",
    "ph:health_level",
    "ph:plunge_unlock",
    "ph:guidebook_acquired"
  ];
  for (const property of properties) {
    if (player.getDynamicProperty(property) === void 0) {
      system4.runTimeout(() => {
        player.setDynamicProperty("ph:dash_level", 0);
        player.setDynamicProperty("ph:health_level", 0);
        player.setDynamicProperty("ph:plunge_unlock", false);
        player.setDynamicProperty("ph:guidebook_acquired", true);
      }, 20);
    }
  }
  for (const objective of objectives) {
    addScore(player, objective, 0);
  }
}

// data/scripts/damage_indicator.ts
import { MolangVariableMap as MolangVariableMap2 } from "@minecraft/server";
var VarSets = {
  physical: {
    icon: {
      "anvil": 3,
      "campfire": 2,
      "charging": 0,
      "contact": 4,
      "entityAttack": 0,
      "fall": 5,
      "fallingBlock": 3,
      "fire": 2,
      "fireTick": 2,
      "flyIntoWall": 4,
      "lava": 2,
      "magma": 2,
      "piston": 4,
      "projectile": 1,
      "ramAttack": 0,
      "soulCampfire": 2,
      "stalactite": 3,
      "stalagmite": 5
    },
    color: {
      red: 1,
      green: 1,
      blue: 1
    }
  },
  special: {
    icon: {
      "blockExplosion": 7,
      "drowning": 13,
      "entityExplosion": 7,
      "fireworks": 8,
      "maceSmash": 6,
      "thorns": 9
    },
    color: {
      red: 1,
      green: 1,
      blue: 0
    }
  },
  magic: {
    icon: {
      "lightning": 10,
      "magic": 10,
      "sonicBoom": 11,
      "wither": 12
    },
    color: {
      red: 1,
      green: 0.5,
      blue: 1
    }
  },
  fatal: {
    icon: {
      "freezing": 15,
      "none": 14,
      "override": 14,
      "selfDestruct": 14,
      "starve": 14,
      "suffocation": 13,
      "temperature": 15,
      "void": 14
    },
    color: {
      red: 1,
      green: 0,
      blue: 0
    }
  }
};
var DamageTypes = {};
for (const [, data] of Object.entries(VarSets)) {
  for (const [cause, icon] of Object.entries(data.icon)) {
    DamageTypes[cause] = {
      icon,
      color: data.color
    };
  }
}
function onDamageIndicator({ hurtEntity, damageSource, damage }) {
  const damageValue = Math.floor(damage);
  const damageData = DamageTypes[damageSource.cause];
  if (!hurtEntity || !hurtEntity.isValid) return;
  const loc = hurtEntity.location;
  loc.y += 1;
  const players = hurtEntity.dimension.getEntities({ type: "minecraft:player", location: loc, maxDistance: 64 });
  for (const ent of players) {
    const player = ent;
    const viewDir = player.getViewDirection();
    loc.x += -viewDir.x;
    loc.z += -viewDir.z;
    const rot = player.getRotation();
    const molang = new MolangVariableMap2();
    const iconMolang = new MolangVariableMap2();
    let absDamage = Math.abs(damageValue);
    if (absDamage > 999999)
      absDamage = 999999;
    molang.setFloat("variable.length", 1.5);
    iconMolang.setFloat("variable.length", 1.5);
    iconMolang.setFloat("variable.icon_offset", damageData.icon ?? 14);
    molang.setFloat("variable.damage", damageValue);
    molang.setFloat("variable.roty", rot.y);
    molang.setFloat("variable.digits", `${absDamage}`.length);
    molang.setFloat("variable.floored", absDamage % 10);
    molang.setFloat("variable.floored_tenths", Math.floor(absDamage / 10) % 10);
    molang.setFloat("variable.floored_hundreths", Math.floor(absDamage / 100) % 10);
    molang.setFloat("variable.floored_thousandths", Math.floor(absDamage / 1e3) % 10);
    molang.setFloat("variable.floored_ten_thousandths", Math.floor(absDamage / 1e4) % 10);
    molang.setFloat("variable.floored_hundred_thousandths", Math.floor(absDamage / 1e5) % 10);
    molang.setColorRGB("variable.damagecolor", damageData.color);
    try {
      player.spawnParticle("ph:damage_number", loc, molang);
    } catch {
    }
    try {
      player.spawnParticle("ph:damage_icons", { x: loc.x, y: loc.y + 0.6, z: loc.z }, iconMolang);
    } catch {
    }
  }
}

// data/scripts/dummy.ts
import { system as system6 } from "@minecraft/server";
var COMBAT_TIMEOUT = 5e3;
var DPS_WINDOW = 1e3;
var SMOOTH_SPEED = 0.15;
var DummyStatsMap = /* @__PURE__ */ new Map();
function getStats(dummy) {
  let stats = DummyStatsMap.get(dummy.id);
  if (stats) return stats;
  stats = {
    history: [],
    recentDamage: 0,
    totalDamage: 0,
    highestHit: 0,
    hits: 0,
    combatStart: 0,
    lastHit: 0,
    realDps: 0,
    displayDps: 0,
    interval: void 0
  };
  DummyStatsMap.set(dummy.id, stats);
  return stats;
}
function beginCombat(dummy, stats) {
  if (stats.interval !== void 0)
    return;
  stats.interval = system6.runInterval(() => {
    if (!dummy.isValid) {
      system6.clearRun(stats.interval);
      DummyStatsMap.delete(dummy.id);
      return;
    }
    const now = Date.now();
    while (stats.history.length && now - stats.history[0].time > DPS_WINDOW) {
      stats.recentDamage -= stats.history[0].damage;
      stats.history.shift();
    }
    stats.realDps = stats.recentDamage;
    stats.displayDps += (stats.realDps - stats.displayDps) * SMOOTH_SPEED;
    const combatTime = Math.max((now - stats.combatStart) / 1e3, 0.1);
    const averageDps = stats.totalDamage / combatTime;
    dummy.nameTag = `\xA7e-= Combat Dummy =-

\xA7fDPS \xA77: \xA7a${Math.round(stats.displayDps)}
\xA7fAverage DPS \xA77: \xA7a${Math.round(averageDps)}

\xA7fHighest Hit \xA77: \xA76${Math.round(stats.highestHit)}
\xA7fTotal Damage \xA77: \xA7c${Math.round(stats.totalDamage)}
\xA7fHits \xA77: \xA7b${stats.hits}`;
    if (now - stats.lastHit >= COMBAT_TIMEOUT && stats.displayDps < 1) {
      dummy.nameTag = "";
      system6.clearRun(stats.interval);
      DummyStatsMap.delete(dummy.id);
    }
  }, 1);
}
function addDamage(dummy, damage) {
  const stats = getStats(dummy);
  const now = Date.now();
  if (stats.hits === 0)
    stats.combatStart = now;
  stats.lastHit = now;
  stats.totalDamage += damage;
  stats.recentDamage += damage;
  stats.hits++;
  if (damage > stats.highestHit)
    stats.highestHit = damage;
  stats.history.push({
    damage,
    time: now
  });
  beginCombat(dummy, stats);
}
function onDummyHurt(event) {
  const dummy = event.hurtEntity;
  if (dummy.typeId !== "ph:dummy")
    return;
  addDamage(dummy, event.damage);
}

// data/scripts/dynamicLighting.ts
import { system as system7, BlockPermutation } from "@minecraft/server";
var lightLevelMap = {
  "minecraft:beacon": 15,
  "minecraft:conduit": 15,
  "minecraft:ochre_froglight": 15,
  "minecraft:pearlscent_froglight": 15,
  "minecraft:verdant_froglight": 15,
  "minecraft:glowstone": 15,
  "minecraft:jack_o_lantern": 15,
  "minecraft:lantern": 15,
  "minecraft:campfire": 15,
  "minecraft:sea_lantern": 15,
  "minecraft:shroomlight": 15,
  "minecraft:end_rod": 14,
  "minecraft:torch": 14,
  "minecraft:crying_obsidian": 10,
  "minecraft:soul_campfire": 10,
  "minecraft:soul_lantern": 10,
  "minecraft:soul_torch": 10,
  "minecraft:enchanting_table": 7,
  "minecraft:ender_chest": 7,
  "minecraft:glow_lichen": 7,
  "minecraft:redstone_torch": 7,
  "ph:solaris_verdant": 7,
  "minecraft:sculk_catalyst": 6,
  "minecraft:amethyst_cluster": 5,
  "minecraft:large_amethyst_bud": 4,
  "minecraft:magma": 3,
  "minecraft:medium_amethyst_bud": 2,
  "minecraft:brewing_stand": 1,
  "minecraft:brown_mushroom": 1,
  "minecraft:dragon_egg": 1,
  "minecraft:sculk_sensor": 1,
  "minecraft:small_amethyst_bud": 1
};
var lightingStates = /* @__PURE__ */ new Map();
function removeLightBlocks(player) {
  for (let i = 0; i <= 15; i++) {
    try {
      player.runCommand(`fill ~-16~-8~-16~16~8~16 air replace light_block_${i}`);
    } catch (e) {
    }
  }
}
function clearPlayerLighting(player) {
  const state = lightingStates.get(player.id);
  if (state && state.interval !== -1) {
    system7.clearRun(state.interval);
  }
  lightingStates.delete(player.id);
  for (let i = 0; i <= 15; i++) {
    player.removeTag(`light_${i}`);
  }
  removeLightBlocks(player);
}
function onDynamicLighting(player) {
  const accessoryItems = getAccessoryItems(player);
  let maxLight = -1;
  for (const item of accessoryItems) {
    const light = lightLevelMap[item.typeId];
    if (light === void 0) continue;
    maxLight = Math.max(maxLight, light);
  }
  const existing = lightingStates.get(player.id);
  if (existing && existing.maxLight === maxLight) return;
  if (existing && existing.interval !== -1) {
    system7.clearRun(existing.interval);
  }
  if (existing || maxLight !== -1) {
    for (let i = 0; i <= 15; i++) {
      player.removeTag(`light_${i}`);
    }
    removeLightBlocks(player);
  }
  if (maxLight === -1) {
    lightingStates.delete(player.id);
    return;
  }
  player.addTag(`light_${maxLight}`);
  const state = {
    interval: -1,
    lastLightBlock: void 0,
    maxLight
  };
  lightingStates.set(player.id, state);
  const updateLight = () => {
    if (!player.isValid) return;
    try {
      const finalLocation = {
        x: player.location.x,
        y: player.location.y + 1,
        z: player.location.z
      };
      const block = player.dimension.getBlock(finalLocation);
      if (!block) return;
      if (!block.isAir && !block.isLiquid) return;
      if (state.lastLightBlock?.typeId.startsWith("minecraft:light_block")) {
        state.lastLightBlock.setType("minecraft:air");
      }
      block.setPermutation(
        BlockPermutation.resolve("minecraft:light_block", {
          block_light_level: state.maxLight
        })
      );
      state.lastLightBlock = block;
    } catch (e) {
    }
  };
  updateLight();
  state.interval = system7.runInterval(updateLight, 4);
}

// data/scripts/vanilla_manipulation.ts
import { world as world7, system as system8, EquipmentSlot as EquipmentSlot2 } from "@minecraft/server";
function dashRuntime(player) {
  const scoreboard_dash = world7.scoreboard.getObjective("dash_cd");
  const equipmentTag = player?.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot2.Mainhand)?.getTags();
  if (!player.isFalling || !scoreboard_dash || (scoreboard_dash?.getScore(player) ?? 0) > 0 || player.getDynamicProperty("ph:dash_unlock") == 0 || player.getDynamicProperty("ph:dash_level") == void 0 || equipmentTag?.includes("minecraft:is_sword") || equipmentTag?.includes("minecraft:is_tool")) return;
  if (player.getDynamicProperty("ph:dash_level") == 1) {
    player.applyKnockback({ x: player.getViewDirection().x * 3, z: player.getViewDirection().z * 3 }, 0.2);
    setScore(player, "dash_cd", 60);
    player.playSound("player.dash", {
      volume: 1
    });
    player.dimension.spawnParticle("ph:dash_particle", player.location);
    if (!player.isGliding) {
      player.playAnimation("animation.player_extend.dash", {
        stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
      });
    }
  }
  if (player.getDynamicProperty("ph:dash_level") == 2) {
    player.applyKnockback({ x: player.getViewDirection().x * 5, z: player.getViewDirection().z * 5 }, 0.3);
    setScore(player, "dash_cd", 60);
    player.playSound("mob.enderdragon.flap", {
      volume: 0.75
    });
    player.dimension.spawnParticle("ph:copper_mech_explosion", player.location);
    if (!player.isGliding) {
      player.playAnimation("animation.player_extend.dash", {
        stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
      });
    }
  }
}
function windPlungeRuntime(player) {
  if (!player.isFalling || player.getDynamicProperty("ph:plunge_unlock") == false || player.getDynamicProperty("ph:plunge_unlock") == void 0) return;
  let isHighEnough = true;
  const { x, y, z } = player.location;
  const checkHeights = [1, 2, 3, 4, 6, 8, 10];
  for (const i of checkHeights) {
    const block = player.dimension.getBlock({
      x: Math.floor(x),
      y: Math.floor(y) - i,
      z: Math.floor(z)
    });
    if (block && block.typeId !== "minecraft:air") {
      isHighEnough = false;
      break;
    }
  }
  if (!isHighEnough) return;
  if (player.hasTag("windPlunge")) return;
  function impact() {
    if (!player.isValid || !player.getComponent("minecraft:health")) return;
    if (player.hasTag("windPlunge")) {
      player.removeEffect("resistance");
      player.dimension.spawnParticle("minecraft:breeze_wind_explosion_emitter", player.location);
      player.runCommand("damage @e[r=6,rm=0.1] 10 entity_explosion entity @s");
      player.dimension.playSound("random.explode", player.location);
      player.removeTag("windPlunge");
    }
  }
  const runInterval = system8.runInterval(() => {
    if (!player.isOnGround) return;
    system8.run(impact);
    system8.clearRun(runInterval);
  }, 2);
  player.applyKnockback({ x: 0, z: 0 }, -2);
  player.dimension.spawnParticle("minecraft:wind_explosion_emitter", player.location);
  player.playAnimation("animation.player_extend.plunge", {
    stopExpression: "query.is_on_ground"
  });
  player.dimension.playSound("wind_charge.burst", player.location);
  player.addTag("windPlunge");
  player.addEffect("resistance", 2e7, {
    amplifier: 3,
    showParticles: false
  });
}
function vanillaBlockInteractFix(player, item, block) {
  if (!item || !item.hasComponent(`ph:vanilla_tool_fix`)) return;
  const tags = block.getTags();
  const typeId = block.typeId;
  if (item.hasTag("minecraft:is_axe")) {
    system8.runTimeout(() => {
      if (typeId.includes("stripped") || !block.typeId.includes("stripped")) return;
      let materialSound = "";
      if (typeId === "minecraft:cherry_log") materialSound = "step.cherry_wood";
      else if (typeId.includes("log")) materialSound = "use.wood";
      else if (typeId.includes("stem")) materialSound = "use.stem";
      else if (typeId.includes("bamboo")) materialSound = "step.bamboo_wood";
      if (!materialSound) return;
      player.dimension.playSound(materialSound, block.center(), { volume: 1, pitch: 0.8 });
      applyDurabilityDamage2(player);
    }, 1);
  } else if (item.hasTag("minecraft:is_hoe")) {
    system8.runTimeout(() => {
      const isTillable = tags.includes("grass") || typeId === "minecraft:dirt_with_roots";
      const hasBlockAbove = block.above()?.typeId !== "minecraft:air";
      if (!isTillable || hasBlockAbove) return;
      player.dimension.playSound("use.gravel", block.center(), { volume: 1, pitch: 0.8 });
      applyDurabilityDamage2(player);
    }, 1);
  } else if (item.hasTag("minecraft:is_shovel")) {
    const dirtPathable = [
      "minecraft:dirt",
      "minecraft:dirt_with_roots",
      "minecraft:podzol",
      "minecraft:mycellium",
      "minecraft:coarse_dirt"
    ];
    const isCoarsable = dirtPathable.includes(block.typeId) || block.typeId === "minecraft:grass_block";
    const hasBlockAbove = block.above()?.typeId !== "minecraft:air";
    if (!isCoarsable || hasBlockAbove) return;
    system8.run(() => {
      player.dimension.playSound("use.grass", block.center(), { volume: 1, pitch: 0.8 });
      applyDurabilityDamage2(player);
    });
  }
}
function parryRuntime(source, itemStack) {
  const itemList = [
    "minecraft:wooden_sword",
    "minecraft:stone_sword",
    "minecraft:copper_sword",
    "minecraft:iron_sword",
    "minecraft:golden_sword",
    "minecraft:diamond_sword",
    "minecraft:netherite_sword",
    "ph:prismatic_sword"
  ];
  for (const item of itemList) {
    if (itemStack?.typeId == item && !source.hasTag("parried")) {
      const durability = itemStack?.getComponent("minecraft:durability");
      source.playAnimation("animation.player_extend.parry");
      source.dimension.spawnParticle("ph:parry_prepare", source.location);
      source.dimension.playSound("item.spear.use", source.location);
      source.addTag("parried");
      source.inputPermissions.setPermissionCategory(2, false);
      applyDurabilityDamage2(source, { damage: 1 });
      system8.runTimeout(() => {
        if (source?.hasTag("parried")) source.removeTag("parried");
        source.inputPermissions.setPermissionCategory(2, true);
      }, 6);
    }
  }
}
var runBetterMending = Number();
function startBetterMending(source, itemStack) {
  if (!source.isSneaking) return;
  const enchantment = itemStack?.getComponent("minecraft:enchantable")?.getEnchantment("mending");
  if (itemStack.hasTag("minecraft:is_tools") || itemStack.hasTag("minecraft:is_armor")) return;
  if (!enchantment) return;
  source.playSound("random.anvil_use");
  const runBetterMending2 = system8.runInterval(() => {
    try {
      const equippable = source.getComponent("minecraft:equippable");
      const currentItem = equippable?.getEquipment(EquipmentSlot2.Mainhand);
      const durability = currentItem?.getComponent("minecraft:durability");
      const experience = source.getTotalXp();
      if (!currentItem || !durability || durability.damage <= 0 || experience <= 0) {
        system8.clearRun(runBetterMending2);
        return;
      }
      const repairAmount = Math.min(durability.damage, 1);
      durability.damage -= repairAmount;
      equippable?.setEquipment(EquipmentSlot2.Mainhand, currentItem);
      source.addExperience(-2);
      if (source.xpEarnedAtCurrentLevel <= 2) {
        source.addExperience(source.totalXpNeededForNextLevel - 1);
        source.addLevels(-1);
      }
      source.playSound("random.orb", {
        pitch: Math.min(0.8, Math.random() + 0.5),
        volume: 0.5
      });
    } catch (error) {
      console.warn(`betterMending error untuk ${source.name}: ${error}`);
      system8.clearRun(runBetterMending2);
    }
  }, 1);
}
function javaSaturationRegen(player) {
  const health = player.getComponent("minecraft:health");
  const hunger = player.getComponent("minecraft:player.hunger");
  const saturation = player.getComponent("minecraft:player.saturation");
  const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
  const playerHealthLevel = Number(player?.getDynamicProperty("ph:health_level"));
  if (playerHealthLevel >= 1 && playerHealthLevel <= 3) {
    const maxAllowedHealth = 24 + playerHealthLevel * 12;
    if (maxHealth && maxHealth < maxAllowedHealth) {
      player.runCommand(`effect @s health_boost infinite ${3 * playerHealthLevel} true`);
    }
  }
  if (!health || !hunger || !saturation) return;
  if (hunger.currentValue === 20 && saturation.currentValue > 0 && health.currentValue < health.effectiveMax) {
    const healAmount = 1;
    const satCost = 1;
    health.setCurrentValue(
      Math.min(health.effectiveMax, health.currentValue + healAmount)
    );
    saturation.setCurrentValue(
      Math.max(0, saturation.currentValue - satCost)
    );
  }
}
function healthBarDisplay(player, health, totalArmor, maxHealth) {
  let scaled = health.currentValue / maxHealth * 100;
  player.onScreenDisplay.setTitle(
    `bar0:${Math.min(100, Math.max(0, Math.floor(scaled)))}% healthind:${Math.floor(health.currentValue)}/${maxHealth} ${totalArmor}`,
    { fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 }
  );
}
function healthBarRuntime(player, eventType, beforeItemStack, afterItemStack) {
  if (player.typeId !== "minecraft:player") return;
  const health = player?.getComponent("minecraft:health");
  const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
  const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
  if (!health || !maxHealth) return;
  if (eventType == "healthChanged") {
    healthBarDisplay(player, health, totalArmor, maxHealth);
  }
  if (eventType == "inventoryItemChanged") {
    if (!beforeItemStack?.hasTag("minecraft:is_armor") && !afterItemStack?.hasTag("minecraft:is_armor")) return;
    healthBarDisplay(player, health, totalArmor, maxHealth);
  }
  if (eventType == "dimensionChanged") {
    runUntilMoved(player, 10, () => {
      healthBarDisplay(player, health, totalArmor, maxHealth);
    });
  }
  if (eventType == "gamemodeChanged") {
    const gameMode = player.getGameMode();
    if (gameMode == "Creative" || gameMode == "Spectator") return;
    healthBarDisplay(player, health, totalArmor, maxHealth);
  }
}
var specifiedFamilityAndSpeed = [
  {
    type_family: "animated_tp",
    speed: 1
  },
  {
    type_family: "animated_tp2",
    speed: 0.2
  },
  {
    type_family: "animated_tp3",
    speed: 2
  },
  {
    type_family: "animated_tp4",
    speed: 0.6
  }
];

// data/scripts/weapons.ts
var solarisVerdant = new WeaponHandler("ph:solaris_verdant", "solaris_verdant_atk", [10, 9, 10], [
  { delay: 5, damage: 21, radius: 3.9, animation: "animation.solaris_verdant.attack_1", sound: "weapon_slash.slash_medium" },
  { delay: 7, damage: 21, radius: 3.9, animation: "animation.solaris_verdant.attack_2", sound: "weapon_slash.slash_medium" },
  {
    delay: 8,
    damage: 23,
    radius: 3.9,
    animation: "animation.solaris_verdant.attack_3",
    sound: "weapon_slash.slash_heavy",
    action: new CommandHandler([
      {
        delay: 8,
        action: (src) => {
          src.runCommand("summon ph:solaris_slash ^^3^5.5 ~ 0");
          if (getScore(src, "solaris_verdant_s3") > 2) {
            removeScore2(src, "solaris_verdant_s3", 3);
          }
          if (getScore(src, "solaris_verdant_s1") > 0) {
            removeScore2(src, "solaris_verdant_s1", 1);
          }
        }
      }
    ])
  }
]);
var solarisVerdantSS = new SkillSwitcher("ph:solaris_verdant", "solaris_verdant", [
  { skillSMessage: "Animirra" },
  { skillSMessage: "Solaris Slash" },
  { skillSMessage: "Natura Vulkan" }
]);
var superchargedCopperAxe = new WeaponHandler("ph:supercharged_copper_axe", "supercharged_copper_axe_atk", [12, 12, 12, 12], [
  { delay: 4, damage: 30, radius: 4.5, animation: "animation.charged_copper_axe.attack_1", sound: "weapon_slash.slash_heavy" },
  { delay: 4, damage: 30, radius: 4.5, animation: "animation.charged_copper_axe.attack_2", sound: "weapon_slash.slash_heavy" },
  { delay: 8, damage: 31, radius: 4.5, animation: "animation.charged_copper_axe.attack_3", sound: "weapon_slash.slash_heavy" },
  {
    delay: 3,
    damage: 31,
    radius: 4.5,
    animation: "animation.charged_copper_axe.attack_4",
    sound: "weapon_slash.slash_heavy",
    action: new CommandHandler([
      {
        delay: 5,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_heavy", src.location);
          src.dimension.spawnParticle("ph:lightning_flash", src.location);
          src.dimension.spawnParticle("ph:lightning_sparks", src.location);
          applyCustomDamage(src, 31, 4.5);
          src.runCommand("summon lightning_bolt ~~~5 ~ 0");
          src.runCommand("summon lightning_bolt ~~~-5 ~ 0");
          src.runCommand("particle ph:lightning_sparks ~~~5");
          src.runCommand("particle ph:lightning_sparks ~~~-5");
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_heavy", src.location);
          applyCustomDamage(src, 31, 4.5);
          src.runCommand("summon lightning_bolt ~5~~ ~ 0");
          src.runCommand("summon lightning_bolt ~-5~~ ~ 0");
          src.runCommand("particle ph:lightning_sparks ~5~~");
          src.runCommand("particle ph:lightning_sparks ~-5~~");
          WeaponHandler.addScore(src, "supercharged_copper_axe_s3", 1);
          WeaponHandler.addScore(src, "supercharged_copper_axe_s4", 1);
        }
      }
    ])
  }
]);
var superchargedCopperAxeSS = new SkillSwitcher("ph:supercharged_copper_axe", "supercharged_copper_axe", [
  { skillSMessage: "Charge" },
  { skillSMessage: "Powered Leap" },
  { skillSMessage: "Discharge" },
  { skillSMessage: "Ultimate Discharge" }
]);
var prismWeaver = new WeaponHandler("ph:prism_weaver", "prism_weaver_atk", [20, 15, 15], [
  {
    delay: 4,
    damage: 17,
    radius: 2,
    animation: "animation.prism_weaver.attack_1",
    sound: "weapon_slash.magic_staff",
    action: new CommandHandler([
      {
        delay: 0,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~ facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
        }
      }
    ])
  },
  {
    delay: 8,
    damage: 17,
    radius: 2,
    animation: "animation.prism_weaver.attack_2",
    sound: "weapon_slash.magic_staff",
    action: new CommandHandler([
      {
        delay: 0,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~ facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
        }
      }
    ])
  },
  {
    delay: 8,
    damage: 18,
    radius: 6,
    animation: "animation.prism_weaver.attack_3",
    sound: "weapon_slash.magic_staff",
    action: new CommandHandler([
      {
        delay: 0,
        action: (src) => {
          src.runCommand("summon ph:prism_weaver_laser ~2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
          src.runCommand("summon ph:prism_weaver_laser ~-2~1~-2 facing @e[c=1,rm=2.5,family=!inanimate,type=!item]");
        }
      }
    ])
  }
]);
var prismWeaverSS = new SkillSwitcher("ph:prism_weaver", "prism_weaver", [
  { skillSMessage: "Bubble Barrage" },
  { skillSMessage: "Prism Wave Wall" },
  { skillSMessage: "Vortex Prism" }
]);
var auricPhotonizer = new WeaponHandler("ph:auric_photonizer", "auric_photonizer_atk", [10, 9, 9, 9, 9], [
  { delay: 4, damage: 29, radius: 4.5, animation: "animation.auric_photonizer.attack_1", sound: "weapon_slash.slash_medium" },
  { delay: 4, damage: 28, radius: 4.5, animation: "animation.auric_photonizer.attack_2", sound: "weapon_slash.slash_medium" },
  { delay: 5, damage: 30, radius: 4.5, animation: "animation.auric_photonizer.attack_3", sound: "weapon_slash.slash_medium" },
  { delay: 4, damage: 28, radius: 4.5, animation: "animation.auric_photonizer.attack_4", sound: "weapon_slash.slash_medium" },
  {
    delay: 3,
    damage: 30,
    radius: 4.5,
    animation: "animation.auric_photonizer.attack_5",
    sound: "weapon_slash.slash_medium",
    action: new CommandHandler([
      {
        delay: 5,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_medium", src.location);
          src.dimension.spawnParticle("ph:lightning_flash", src.location);
          src.dimension.spawnParticle("ph:lightning_sparks", src.location);
          applyCustomDamage(src, 30, 4.5);
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_medium", src.location);
          applyCustomDamage(src, 30, 4.5);
        }
      }
    ])
  }
]);
var auricPhotonizerSS = new SkillSwitcher("ph:auric_photonizer", "auric_photonizer", [
  { skillSMessage: "Stab" },
  { skillSMessage: "Backleap" },
  { skillSMessage: "Blade Barrage" },
  { skillSMessage: "Ethereal Blade" }
]);
var theBleedingSpire = new WeaponHandler("ph:the_bleeding_spire", "the_bleeding_spire_atk", [14, 14, 14, 14], [
  { delay: 8, damage: 27, radius: 4.5, animation: "animation.the_bleeding_spire.attack_1", sound: "weapon_slash.slash_medium" },
  { delay: 8, damage: 23, radius: 4.5, animation: "animation.the_bleeding_spire.attack_2", sound: "weapon_slash.slash_medium" },
  { delay: 6, damage: 27, radius: 4.5, animation: "animation.the_bleeding_spire.attack_3", sound: "weapon_slash.slash_medium" },
  { delay: 8, damage: 23, radius: 4.5, animation: "animation.the_bleeding_spire.attack_4", sound: "weapon_slash.slash_medium" }
]);
var theBleedingSpireSS = new SkillSwitcher("ph:the_bleeding_spire", "the_bleeding_spire", [
  { skillSMessage: "Carnage" },
  { skillSMessage: "Entanglement" },
  { skillSMessage: "Crimson Ray" }
]);
var seiketsu = new WeaponHandler("ph:seiketsu", "seiketsu_atk", [9, 9, 9], [
  { delay: 2, damage: 14, radius: 3, animation: "animation.seiketsu_1", sound: "weapon_slash.slash_medium" },
  { delay: 2, damage: 14, radius: 3, animation: "animation.seiketsu_2", sound: "weapon_slash.slash_medium" },
  {
    delay: 3,
    damage: 14,
    radius: 3,
    animation: "animation.seiketsu_3",
    sound: "weapon_slash.slash_heavy",
    action: new CommandHandler([
      {
        delay: 1,
        action: (src) => {
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
          });
          entities.forEach((entity) => {
            entity.runCommand("summon lightning_bolt ~~~ ~ 0");
            entity.runCommand("particle ph:lightning_sparks ~~~");
            entity.setOnFire(7, false);
          });
        }
      },
      {
        delay: 4,
        action: (src) => {
          src.removeTag("parried");
        }
      }
    ])
  }
]);
var weapons = [solarisVerdant, superchargedCopperAxe, prismWeaver, auricPhotonizer, theBleedingSpire, seiketsu];
var switcherSkills = [solarisVerdantSS, superchargedCopperAxeSS, prismWeaverSS, auricPhotonizerSS, theBleedingSpireSS];

// data/scripts/events.ts
world8.beforeEvents.entityHurt.subscribe((acc) => {
  const hurtEntity = acc.hurtEntity;
  const damagingEntity = acc.damageSource.damagingEntity;
  handleAccessory(hurtEntity, "onHurt", acc);
  if (hurtEntity.typeId === "minecraft:player" && hurtEntity?.hasTag("parried")) {
    acc.cancel = true;
    system9.run(() => {
      const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot3.Mainhand);
      hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
      hurtEntity.dimension.spawnParticle(
        "ph:parry_invert_flash",
        {
          x: hurtEntity.getHeadLocation().x + hurtEntity.getViewDirection().x * 1,
          y: hurtEntity.getHeadLocation().y + hurtEntity.getViewDirection().y * 1,
          z: hurtEntity.getHeadLocation().z + hurtEntity.getViewDirection().z * 1
        }
      );
      hurtEntity.runCommand("camerashake add @s 1 0.1 positional");
      hurtEntity.dimension.playSound("weapon_slash.slash_clash", hurtEntity.location);
      hurtEntity.removeTag("parried");
      if (mainItem?.typeId === "ph:seiketsu") {
        applyDurabilityDamage2(hurtEntity, { damage: 1 });
        return;
      }
      applyDurabilityDamage2(hurtEntity, { damage: 30 });
    });
  }
  if (getAccessoryItems(hurtEntity).some((item) => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot3.Mainhand)?.typeId === "ph:the_bleeding_spire") {
    if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
  }
});
world8.beforeEvents.playerBreakBlock.subscribe((acc) => {
  const block = acc.block;
  const player = acc.player;
  handleAccessory(player, "onBreakBlock", acc, block);
});
world8.beforeEvents.entityHurt.subscribe((data) => {
  const player = data.hurtEntity;
  const cause = data?.damageSource?.cause;
  if (cause === "fall" || cause === "magic" || cause == "none" || cause == "selfDestruct") return;
  if (data.damage <= 0) return;
  const inventory = player.getComponent("minecraft:equippable");
  if (!inventory) return;
  const armorSlots = ["Head", "Chest", "Legs", "Feet"];
  let totalToughness = 0;
  for (const slot of armorSlots) {
    const item = inventory.getEquipment(slot);
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
    armorPoints - 4 * data.damage / (Math.min(totalToughness, 20) + 8)
  );
  const minResult = Math.min(20, innerMax);
  const reductionFraction = minResult / 25;
  const finalDamage = data.damage * (1 - reductionFraction);
  data.damage -= finalDamage;
});
world8.beforeEvents.playerBreakBlock.subscribe((e) => {
  const player = e.player;
  const itemStack = e.itemStack;
  const block = e.block;
  const dimension = e.dimension;
  let blockAndItems = [
    {
      block: "minecraft:prismarine",
      item: new ItemStack4("minecraft:prismarine_shard", Math.floor(Math.random() * (7 - 4) + 4)),
      item_tag: "minecraft:is_pickaxe",
      tool: void 0
    }
  ];
  if (block.typeId.includes("ore")) {
    const randomChance = Math.floor(Math.random() * 100);
    if (player.getGameMode() === "Creative") return;
    if (randomChance != 1) return;
    system9.run(() => {
      dimension.spawnItem(new ItemStack4("ph:rust_coin", 1), block.location);
    });
  }
  for (const splittedData of blockAndItems) {
    if (block.typeId === splittedData.block) {
      const tags = itemStack?.getTags();
      const enchantment = itemStack?.getComponent("enchantable")?.getEnchantment("silk_touch");
      const gameMode = player.getGameMode();
      if (gameMode == "Creative") return;
      if (enchantment) return;
      if (!enchantment && tags != void 0 && splittedData.item_tag && tags.includes(splittedData.item_tag)) {
        e.cancel = true;
        system9.run(() => {
          dimension.setBlockType(block.location, "minecraft:air");
          dimension.spawnItem(splittedData.item, block.location);
        });
      } else {
        if (!splittedData.tool) {
          return;
        }
        if (itemStack?.typeId == splittedData.tool) {
          system9.run(() => {
            dimension.spawnItem(splittedData.item, block.location);
          });
        }
      }
    }
  }
});
world8.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, itemStack: item, block } = event;
  vanillaBlockInteractFix(player, item, block);
});
world8.afterEvents.entityHitEntity.subscribe((acc) => {
  const damagingEntity = acc.damagingEntity;
  const hitEntity = acc.hitEntity;
  handleAccessory(damagingEntity, "onHitEntity", acc, hitEntity);
});
world8.afterEvents.entityHurt.subscribe(onDamageIndicator);
world8.afterEvents.entityHurt.subscribe(onDummyHurt);
world8.afterEvents.playerInventoryItemChange.subscribe(({ player }) => {
  onDynamicLighting(player);
});
world8.afterEvents.worldLoad.subscribe(() => {
  loadScoreboards();
});
world8.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  onPlayerSpawn(player, initialSpawn);
  onDynamicLighting(player);
});
world8.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
  for (const weapon of weapons) {
    if (heldItemStack?.typeId === weapon.itemId) {
      if (swingSource != "Mine" && swingSource != "Attack") return;
      weapon.handleAttack(player);
    }
  }
});
world8.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
  const equippedItem = source?.getComponent("equippable")?.getEquipment(EquipmentSlot3.Mainhand);
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
});
world8.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!itemStack) return;
  parryRuntime(source, itemStack);
  startBetterMending(source, itemStack);
  for (const skill of weaponSkills) {
    if (itemStack.typeId === skill.itemId) {
      skill.useSkill(source);
    }
  }
});
world8.afterEvents.entityDie.subscribe(({ damageSource, deadEntity }) => {
  const killer = damageSource?.damagingEntity;
  if (!killer?.isValid) return;
  clearPlayerLighting(deadEntity);
  const mainhand = killer?.getComponent("equippable")?.getEquipment(EquipmentSlot3.Mainhand);
  if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
    addScore(killer, "auric_charge", 4);
    deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
  }
});
world8.afterEvents.playerInventoryItemChange.subscribe(({ player }) => {
  const container = player.getComponent("inventory")?.container;
  if (!container) return;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    const expectedLore = addLore.get(item.typeId) ?? (item.typeId.startsWith("ph:") ? ["\xA79Phantasm"] : void 0);
    if (!expectedLore) continue;
    const currentLore = item.getLore() ?? [];
    const isSame = currentLore.length === expectedLore.length && currentLore.every((line, index) => line === expectedLore[index]);
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
        container.setItem(j, void 0);
      } else {
        itemB.amount -= moveAmount;
        container.setItem(j, itemB);
      }
    }
  }
});
world8.afterEvents.entityHealthChanged.subscribe(({ entity }) => {
  if (!entity.isValid) return;
  healthBarRuntime(entity, "healthChanged");
});
world8.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack }) => {
  healthBarRuntime(player, "inventoryItemChanged", beforeItemStack, itemStack);
});
world8.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  healthBarRuntime(player, "dimensionChanged");
});
world8.afterEvents.playerGameModeChange.subscribe(({ player, toGameMode }) => {
  healthBarRuntime(player, "gamemodeChanged");
});
world8.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  if (cause != "Spawned") return;
  if (!entity.isValid) return;
  let RUN_INTERVAL_ANIMATED_TP;
  const family = entity?.getComponent("minecraft:type_family")?.getTypeFamilies();
  if (!family) return;
  const matchedFamily = specifiedFamilityAndSpeed.find(
    (data) => family.includes(data.type_family)
  );
  if (entity?.isValid && matchedFamily) {
    if (RUN_INTERVAL_ANIMATED_TP === void 0) {
      const headLoc = entity?.getViewDirection();
      const dx = headLoc.x;
      const dy = headLoc.y;
      const dz = headLoc.z;
      RUN_INTERVAL_ANIMATED_TP = system9.runInterval(() => {
        if (!entity?.isValid) {
          system9.clearRun(RUN_INTERVAL_ANIMATED_TP);
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
});
world8.beforeEvents.playerLeave.subscribe(({ player }) => {
  clearPlayerLighting(player);
});
system9.runInterval(() => {
  for (const player of world8.getPlayers()) {
    javaSaturationRegen(player);
  }
}, 6);
system9.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceBlock, sourceEntity }) => {
  const parseMessage = (message2) => message2.split(",").map((v) => v.trim());
  switch (id) {
    case "ph:remove_target_lock":
      if (!sourceEntity) return;
      system9.runTimeout(() => {
        sourceEntity.removeTag("locked");
      }, 5);
      break;
    case "ph:boss_summon_projectile":
      if (!sourceEntity) return;
      const [amount, yOffset, typeId, sound] = parseMessage(message).map(
        (v) => isNaN(Number(v)) ? v : Number(v)
      );
      sourceEntity.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 1 0.3`);
      for (let i = 0; i < amount; i++) {
        const { x, y, z } = sourceEntity.location;
        const randXRot = Math.floor(Math.random() * 360);
        sourceEntity.runCommand(`summon ${typeId} ${x} ${y + yOffset} ${z} ${randXRot} 0`);
      }
      break;
    case "ph:boss_summon_projectile_with_y_facing":
      if (!sourceEntity) return;
      const [amountRT, yOffsetRT, typeIdRT, soundRT] = parseMessage(message).map(
        (v) => isNaN(Number(v)) ? v : Number(v)
      );
      sourceEntity.runCommand(`playsound ${soundRT} @a[r=32] ~~~ 1 1 0.3`);
      for (let i = 0; i < amountRT; i++) {
        const { x, y, z } = sourceEntity.location;
        const randXRot = Math.floor(Math.random() * 360);
        const randYRot = Math.floor(-90 + Math.random() * 180);
        sourceEntity.runCommand(`summon ${typeIdRT} ${x} ${y + yOffsetRT} ${z} ${randXRot} ${randYRot}`);
      }
      break;
    case "ph:boss_summon":
      if (!sourceEntity) return;
      const [number, yAxis, radius, id2, sound2, spawnEvent] = parseMessage(message).map(
        (v) => isNaN(Number(v)) ? v : Number(v)
      );
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
      const molang = new MolangVariableMap3();
      molang.setFloat("variable.spawn_rate", Number(particleAmount));
      sourceEntity.dimension.spawnParticle("ph:cruxshaper_charge_arc", sourceEntity.location, molang);
      break;
    case "ph:particle_custom":
      system9.run(() => {
        const particleMolang = new MolangVariableMap3();
        particleMolang.setFloat("variable.spawn_rate", Number(message));
        if (sourceBlock) {
          sourceBlock.dimension.spawnParticle("ph:bounding_circle", sourceBlock.center(), particleMolang);
        }
      });
      break;
    default:
      break;
  }
});
function distancePointToSegment(point, start, end) {
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
      (px - sx) ** 2 + (py - sy) ** 2 + (pz - sz) ** 2
    );
  }
  let t = ((px - sx) * dx + (py - sy) * dy + (pz - sz) * dz) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const closestX = sx + t * dx;
  const closestY = sy + t * dy;
  const closestZ = sz + t * dz;
  return Math.sqrt(
    (px - closestX) ** 2 + (py - closestY) ** 2 + (pz - closestZ) ** 2
  );
}
function beginCollisionCheck(dasher, duration, damage, collisionRadius) {
  let tick = 0;
  let prevPos = { ...dasher.location };
  const hitEntities = /* @__PURE__ */ new Set();
  const interval = system9.runInterval(() => {
    if (!dasher || !dasher.isValid) {
      system9.clearRun(interval);
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
          cause: EntityDamageCause3.entityAttack,
          damagingEntity: dasher
        });
      }
    }
    prevPos = { ...currentPos };
    if (tick >= duration) {
      system9.clearRun(interval);
    }
  });
}
function fireLaserOnce(shooter, range, damage, width) {
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
        cause: EntityDamageCause3.magic,
        damagingEntity: shooter
      });
    }
  }
}
function bossLaserBeam(boss, charge, duration, range, damagePerTick, width) {
  let tick = 0;
  let chargeTime = charge;
  const chargeInterval = system9.runInterval(() => {
    if (!boss || !boss.isValid) {
      system9.clearRun(chargeInterval);
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
      system9.clearRun(chargeInterval);
      startLaser();
    }
  });
  function startLaser() {
    const interval = system9.runInterval(() => {
      if (!boss || !boss.isValid) {
        system9.clearRun(interval);
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
        system9.clearRun(interval);
      }
    });
  }
}

// data/scripts/custom_components.ts
import { system as system12, CommandPermissionLevel, CustomCommandStatus, MolangVariableMap as MolangVariableMap4, ItemStack as ItemStack5 } from "@minecraft/server";

// data/scripts/forms/skillUnlock.ts
import { system as system10 } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
function skillUnlock(player) {
  let dashLevelStatus = player.getDynamicProperty("ph:dash_level") ?? 0;
  let healthLevelStatus = player.getDynamicProperty("ph:health_level") ?? 0;
  let plungeUnlockStatus = player.getDynamicProperty("ph:plunge_unlock") == true ? "\xA72UNLOCKED" : "\xA74LOCKED";
  const form = new ActionFormData().title("Skill Unlocking").body("Unlock your new potential by spending your 30 Experience level to one of the skill right here").button(`Passive Dash
\xA72Level : ${dashLevelStatus}`).button(`Extra Health
\xA72Level : ${healthLevelStatus}`).button(`Wind Plunge
${plungeUnlockStatus}`).show(player).then((r) => {
    if (r.cancelationReason == "UserBusy") system10.run(() => skillUnlock(player));
    if (r.selection == 0) dashUnlock(player);
    if (r.selection == 1) healthUpgrade(player);
    if (r.selection == 2) plungeUnlock(player);
  });
}
function dashUnlock(player) {
  const exp = player.level;
  let dashLevel = player.getDynamicProperty("ph:dash_level") ?? 0;
  const form = new MessageFormData().title("Confirm Selection").body(`Are you sure you want to unlock the passive dash? to use it press jump twice

Current Level : ${exp}
Required Level : 30`).button1("Confirm").button2("Cancel").show(player).then((r) => {
    if (r.selection == 0) {
      if (exp >= 30 && dashLevel == 0) {
        player.setDynamicProperty("ph:dash_level", 1);
        player.playSound("random.levelup");
        player.sendMessage("\xA7aUnlocked the Passive Dash successfully");
        player.addLevels(-30);
      } else {
        player.playSound("note.bass");
        if (dashLevel == 0) player.sendMessage("\xA7cInsufficient Experience Level!");
        else player.sendMessage("\xA7cMaximum level for dash is reached");
      }
    }
    if (r.selection == 1) {
      skillUnlock(player);
    }
  });
}
function healthUpgrade(player) {
  const exp = player.level;
  const form = new MessageFormData().title("Confirm Selection").body(`Are you sure you want to upgrade your max health? adds 16 HP at level 1, +12 HP at other level

Current Level : ${exp}
Required Level : 30`).button1("Confirm").button2("Cancel").show(player).then((r) => {
    if (r.selection == 0) {
      const healthLevel = player.getDynamicProperty("ph:health_level");
      if (exp < 30) {
        player.playSound("note.bass");
        player.sendMessage("\xA7cInsufficient Experience Level!");
        return;
      }
      if (!healthLevel || Number(healthLevel) < 3) {
        player.setDynamicProperty("ph:health_level", Number(healthLevel) + 1);
        player.runCommand(`effect @s health_boost infinite ${3 * Number(player.getDynamicProperty("ph:health_level"))}`);
        player.addEffect("instant_health", 1, {
          amplifier: 255,
          showParticles: false
        });
        player.playSound("random.levelup");
        player.sendMessage("\xA7aUpgraded your health successfully");
        player.addLevels(-30);
      } else {
        player.playSound("note.bass");
        player.sendMessage("\xA7cMaximum Level Reached!");
      }
    }
    if (r.selection == 1) {
      skillUnlock(player);
    }
  });
}
function plungeUnlock(player) {
  const exp = player.level;
  let plungeUnlock2 = player.getDynamicProperty("ph:plunge_unlock") ?? false;
  const form = new MessageFormData().title("Confirm Selection").body(`Are you sure you want to unlock the wind plunge passive? to use it press sneak while falling more than 10 blocks.

Current Level : ${exp}
Required Level : 30`).button1("Confirm").button2("Cancel").show(player).then((r) => {
    if (r.selection == 0) {
      if (exp >= 30 && plungeUnlock2 == false) {
        player.setDynamicProperty("ph:plunge_unlock", true);
        player.playSound("random.levelup");
        player.sendMessage("\xA7aUnlocked the Wind Plunging Passive successfully");
        player.addLevels(-30);
      } else {
        player.playSound("note.bass");
        player.sendMessage("\xA7cInsufficient Experience Level!");
      }
    }
    if (r.selection == 1) {
      skillUnlock(player);
    }
  });
}

// data/scripts/guidescreen/main_guide.ts
import { ActionFormData as ActionFormData9 } from "@minecraft/server-ui";
import "@minecraft/server";

// data/scripts/guidescreen/weapon_guide.ts
import { ActionFormData as ActionFormData2 } from "@minecraft/server-ui";
function guideWeapons(player) {
  const form = new ActionFormData2().title("Weapons").body("There are many variations of the weapons, starting from Common ones, until Legendary one.").button("\xA73Prismatic Tools", "textures/items/prismatic_sword").button("\xA75Charged Copper Axe", "textures/items/weapons/charged_copper_axe").button("\xA75Cruxshaper", "textures/items/weapons/cruxshaper").button("\xA75Nature Staff", "textures/items/weapons/nature_staff").button("\xA75Peacemaker Oath", "textures/items/weapons/peacemaker_oath").button("\xA75Seiketsu", "textures/items/weapons/seiketsu").button("\xA75Spectric Bow", "textures/items/weapons/spectric_bow").button("\xA75Thunder Gale", "textures/items/weapons/thunder_gale").button("\xA7pAnimitta", "textures/items/weapons/solaris_verdant").button("\xA7pAuric Photonizer", "textures/items/weapons/auric_photonizer").button("\xA7pPrism Weaver", "textures/items/weapons/prism_weaver").button("\xA7pSupercharged Copper Axe", "textures/items/weapons/supercharged_copper_axe").button("\xA7pThe Bleeding Spire", "textures/items/weapons/the_bleeding_spire").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 13) mainGuideScreen(player);
    if (r.selection == 0) prismaticTools(player);
    if (r.selection == 1) chargedCopperAxe(player);
    if (r.selection == 2) cruxshaper(player);
    if (r.selection == 3) natureStaff(player);
    if (r.selection == 4) peacemakerOath(player);
    if (r.selection == 5) seiketsu2(player);
    if (r.selection == 6) spectricBow(player);
    if (r.selection == 7) thunderGale(player);
    if (r.selection == 8) animitta(player);
    if (r.selection == 9) auricPhotonizer2(player);
    if (r.selection == 10) prismWeaver2(player);
    if (r.selection == 11) superchargedCopperAxe2(player);
    if (r.selection == 12) theBleedingSpire2(player);
  });
}
function prismaticTools(player) {
  const form = new ActionFormData2().title("Prismatic Tools").label("Prismatic Tools Tier is an Tier beyond Netherite, much better than Netherite Tier, slightly faster than Netherite tier, having 2 times the durability of Netherite Tier as their main perks of this Tier.").label("The sword has their special unique attack that makes the weapons capable of doing area piercing attack, but it cannot crits.").label("and The spear has it's own special perks that you can Dismount your enemies by just using charge attack with sprint jumping.").label("Prismatic Tools can be crafted with Prismatic Ingot, and Netherite Tools.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function chargedCopperAxe(player) {
  const form = new ActionFormData2().title("Charged Copper Axe").label("This axe weapons is an Epic Weapon, designed for striking your opponents with Lightning Attacks that you collect the charge before combat.").label("The Charge passive is used when the charge is fully charged, when you hit enemies with full charge, you can cast a Lightning Attacks to their enemies.").label("and when the enemies died, you will cast additional Lightning Attack, and adding 4 Auric Charges for you.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function cruxshaper(player) {
  const form = new ActionFormData2().title("Cruxshaper").label("This mace weapon just function like mace, but it gets better with the skills.").label("Look up to the skies to use the skill, you will jump really high, and then finally performs a plunge attack that deals up to 50 damage.").label("You can get this weapon same as mace, but with additional of Blaze Rod to the recipe.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function natureStaff(player) {
  const form = new ActionFormData2().title("Nature Staff").label("This staff can use magic attacks that is same as Soul of Nature boss").label("You can interact to cast the first magic attack, while sneaking you can cast the second magic attack, with slightly longer cooldown").label("This weapon crafted with Prismatic Ingot, Stick, and Nautilus Shell").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function peacemakerOath(player) {
  const form = new ActionFormData2().title("Peacemaker Oath").label("a Pistol that uses Auric Charges as their main bullet, capable of doing high damage and high attack speed with this weapon.").label("This weapon does not have a unique skill or passive because this weapon is already overpowered, with the Auric Proton Accessory.").label("You can get this weapon at Trial Chamber, same as Auric Proton.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function seiketsu2(player) {
  const form = new ActionFormData2().title("Seiketsu").label("a Katana that can performs an Attack Patterns like Legendary Tier, beating every epic weapons in the easier usage").label("Also with this weapon, you can perform a parry with longer window, different than regular sword").label("The katana crafted with Prismatic Sword, Blaze Rod, and Netherite Sword").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function spectricBow(player) {
  const form = new ActionFormData2().title("Spectric Bow").label("a Bow that beats every Epic weapons in terms of Damage, and Range, The projectile speed is very fast depends on Charging Stage and have ridiculous damage up to 70 damage").label("You can use this bow normally, but best used with Spectral Arrow, crafted with 4 Glowstone Dust and 1 Arrow").label("This bow crafted with Iron Ingot, Whole Glowstone, and String").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function thunderGale(player) {
  const form = new ActionFormData2().title("Thunder Gale").label("This Spear weapons is the classic, but powerful one, being the Strongest Spear, dealing over 1.6x multiplier on Charge Attack, 14 Base Damage, and very fast Spear Cooldown").label("This weapon only provides you with speeds when equipping this weapon").label("This Spear crafted with Prismatic Spear, Nether Star, and Netherite Spear").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function animitta(player) {
  const form = new ActionFormData2().title("Animitta").label("This is the first legendary weapons you will obtain alongside the Prism Weaver, This weapon capable of doing close, medium, and long range attacks with slightly lower damage than other Legendary Weapons. This weapon have 3 skills :").label("Animirra :\nCreates 4 Stars summon that will attacks other entities, this skill alone is powerful, but you never realized it.").label("Solaris Slash :\nDoes an attack that creates 3 Solaris Slash, spreading in each direction.").label("Natura Vulkan :\nSummons 8 Special Stars summons, that will explode at enemies with small distance explosion, but very powerful, alongside of casting a Meteor Rain.").label("This weapon obtained from killing Soul of Nature with 50% chance alongside with Prism Weaver, a 50/50 between those two weapons").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function prismWeaver2(player) {
  const form = new ActionFormData2().title("Prism Weaver").label("This is the first legendary weapons you will obtain alongside the Animitta, This weapon capable of doing long range attacks with low damage than other Legendary Weapons. This weapon have 3 skills :").label("Bubble Barrage :\nCasts a bursts of bubble projectiles in one attacks.").label("Prism Wave Wall :\nCasts a Prism Wall that deals massive damage when someone touches it.").label("Vortex Prism :\nPulls the target in large radius to you, and then repel them with massive damage.").label("This weapon obtained from killing Soul of Nature with 50% chance alongside with Animitta, a 50/50 between those two weapons").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function theBleedingSpire2(player) {
  const form = new ActionFormData2().title("The Bleeding Spire").label("This Legendary Spear does a polearm like attack with close distance, this weapon meant to be a support so that will not too powerful to destroy your target. This weapon have 3 skills :").label("Carnage :\nDash forward with this weapons, any mob collided with you will deal some damage.").label("Entanglement :\nLeash your target with Crimson Roots, making them stunned (literal stun) for 5 seconds, and giving you over 12 Health Points").label("Crimson Ray :\nDoes the same thing as Entanglement, but, you will cast a lot of Crimson Ray, shot in scattered directions.").label("This weapon obtained from killing Punicea").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function superchargedCopperAxe2(player) {
  const form = new ActionFormData2().title("Supercharged Copper Axe").label("This Legendary Axe, forged through the High-Grade Copper and Auric Material, is very powerful compared to other weapons, this weapon has very slow attack speed but has lightning bolt attacks when completing the attack pattern. This weapon have 4 skills :").label("Charge :\nGrants 5 Charges for your 2 skills, and Boost yourself temporarily, giving you a lot of extra damage when you attacking a mob.").label("Powered Leap :\nCreates an explosion that deals high damage for others than you to make you leap forward to your target, also giving you 1 Charge for your other skills.").label("Discharge :\nDischarge your collected charge, and cast a Auric Laser that moves in their direction, hitting a target will gives them a lot of damage.").label("Ultimate Discharge :\nDoes the same thing with Discharge, but it's more powerful, and combined with medium-range lightning attacks that covers both close and medium range.").label("This weapon obtained from killing Auric Automaton with 50% chance alongside with Auric Photonizer, a 50/50 between those two weapons").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function auricPhotonizer2(player) {
  const form = new ActionFormData2().title("Auric Photonizer").label("This Legendary Sword, forged through the High-Grade Copper and Auric Material, is powerful compared to other weapons, this weapon has very fast attack speed. This weapon have 4 skills :").label("Stab :\nDash and Stab forward with this weapons, any mob collided with you will deal a lot damage.").label("Powered Leap :\nLeaps backward to dodge your opponents, creates an explosion after short delay that deals a lot damage").label("Blade Barrage :\nSummon 5 Auric Double Blade, moving towards you, anyone other than you will deals a lot of damage").label("Ethereal Blade :\nSummon 3 sequence of a lot of Ethereal Sword stabbing in random direction dealing a lot of damage, you can still move while the skill is activated").label("This weapon obtained from killing Auric Automaton with 50% chance alongside with Supercharged Copper Axe, a 50/50 between those two weapons").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}

// data/scripts/guidescreen/mechanic_guide.ts
import { ActionFormData as ActionFormData3 } from "@minecraft/server-ui";
function mechanicsList(player) {
  const form = new ActionFormData3().title("Mechanics").body("There are the list of the mechanics in Phantasm, starting from the simple one to complex one.").button("Skill Unlock").button("Passive Dash").button("Extra Health").button("Wind Plunge").button("Dynamic Light").button("Legendary Items").button("Upgrading Items").button("Better Mending").button("Accessories").button("Auric Charges").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 10) mainGuideScreen(player);
    if (r.selection == 0) skillUnlockGuide(player);
    if (r.selection == 1) passiveDash(player);
    if (r.selection == 2) extraHealth(player);
    if (r.selection == 3) windPlunge(player);
    if (r.selection == 4) dynamicLighting(player);
    if (r.selection == 5) legendaryItems(player);
    if (r.selection == 6) upgradingItems(player);
    if (r.selection == 7) betterMending(player);
    if (r.selection == 8) accessories(player);
    if (r.selection == 9) auricCharges(player);
  });
}
function skillUnlockGuide(player) {
  const form = new ActionFormData3().title("Unlock Skill").header("Skill Unlocking").divider().label("Skill unlocking is an mechanics to upgrade yourself throughout the progress, you essentially need to upgrade your statistic by unlocking these skill listed in the /unlockskill command!").label("There are 3 Skill / Passive that you need to unlock :\n- Passive Dash\n- Extra health\n- Wind Plunge\nEach of them require 30 Experience levels to upgrade, and they have their own maximum level in the unlocking UI.").divider().button("Unlock Skill").button("Back").show(player).then((r) => {
    if (r.selection == 1 || r.canceled) mechanicsList(player);
    if (r.selection == 0) skillUnlock(player);
  });
}
function passiveDash(player) {
  const form = new ActionFormData3().title("Passive Dash").header("Passive Dash").divider().label("This skill able to make you dash forward without any dash item required, this skill is very useful at mobility and some combat style.").label("To use this skill / passive, you need to press Jump while falling.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function extraHealth(player) {
  const form = new ActionFormData3().title("Extra Health").header("Extra Health").divider().label("This passive will grants you additional health, +16 at the first level, +12 at level 2, and higher, this passive is essential for tanking boss / attacks from other players.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function windPlunge(player) {
  const form = new ActionFormData3().title("Wind Plunging").header("Wind Plunge Attack").divider().label("This skill will grants you ability to plunge down quickly while you falling at long distance, significantly reduces the fall damage, and creates an explosion when landing to damages anything.").label("To use this skill / passive, you need to press Sneak while falling over 10 blocks.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function dynamicLighting(player) {
  const form = new ActionFormData3().title("Dynamic Light").header("Phantasm Light System").divider().label("a Mechanic that already exists in some add-ons, but this one is slightly different because you don't need to hold the items to use it").label("To use the mechanic, please put your Light Items into a Hotbar slot with + Sign (Accessories Slot).").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function legendaryItems(player) {
  const form = new ActionFormData3().title("Legendary Items").header("Legendary Mechanics").divider().label("Legendary Tier like Weapons, items, mechanic can be slightly complicated, so how do I use it?").label("To perform an attack, just Left-Click (KBM), or Press Attack to the ground,\nTo use a skill Press Interact / Right Click,\nand for Changing a skill to use in the Legendary Item, just Press Sneak.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function upgradingItems(player) {
  const form = new ActionFormData3().title("Item Upgrade").header("Upgrading Item").divider().label("You can use some items to upgrade yourself such dash ability, health, or damage. You can upgrade yourself permanently or temporarily by using an items.").label("Currently, there are only 3 Items that will upgrade yourself :\n- Auric Star (permanent)\n- Suspicious Mushroom (temporary)\n- Supercharged Copper Axe with Charge Skill (temporary)").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function betterMending(player) {
  const form = new ActionFormData3().title("Better Mending").header("Mending QoL").divider().label("Mending has its own mechanic, while they can repair themselves with exp orb, you can use your stored level to repair the items.").label("To use the second mechanics of mending, you need to Sneak and Use the items, and they will start using your level to repair the items until full durability or you ran out of experience points. To cancel the repairing, just change to other items.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function accessories(player) {
  const form = new ActionFormData3().title("Accessories").header("Accessories").divider().label("This mechanic allow you to use an Accessory Type Items to make yourself stronger by a lot while sacrificing up to 4 slots of your inventory, you can combine them to create such a perfect build that you'd like.").label("To use an Accessory Item, put the Accessory slot in Offhand Slot, and Hotbar Slots with + Sign.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function auricCharges(player) {
  const form = new ActionFormData3().title("Auric Charge").header("Auric Charge").divider().label("This universal charges is used for an ammunition for some Items, collect Auric Charges using Charged Copper Axe, Auric Stock Battery, and Auric Proton to gain some charges.").label("To use it, please use an Items that costs Auric Charge.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}

// data/scripts/guidescreen/item_guide.ts
import { ActionFormData as ActionFormData4 } from "@minecraft/server-ui";
function guideItems(player) {
  const form = new ActionFormData4().title("Items").label("This is the list of Usable Items, any items that doesn't show up here is an Items that only be used as a recipe").button("Auric Communicator", "textures/items/auric_communicator").button("Auric Stock Battery", "textures/items/auric_stock_battery").button("Combat Dummy", "textures/items/dummy").button("Flow Channeler", "textures/items/flow_channeler").button("Hell Charge", "textures/items/hell_charge").button("Suspicious Mushroom", "textures/items/suspicious_mushroom").button("Back").show(player).then((r) => {
    if (r.selection === 6 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) auricCommunicator(player);
    if (r.selection === 1) auricStockBattery(player);
    if (r.selection === 2) combatDummy(player);
    if (r.selection === 3) flowChanneler(player);
    if (r.selection === 4) hellCharge(player);
    if (r.selection === 5) suspiciousMushroom(player);
  });
}
function auricCommunicator(player) {
  const form = new ActionFormData4().title("Auric Communicator").label("Auric Communicator is an item that used to call an Orbital Strike, this item uses your Auric Charges to cast the strike.").label("This item has 2 modes that you can use, one is Stab Shot which can be used to cast a direct strike, the other is Nuke Shot which can be used to call a spread strike.").label("Interact to use it, sneaking with Interact will change the mode of the item.").label("This item can be obtained from Auric Automaton : Copper Mechanical Array.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function auricStockBattery(player) {
  const form = new ActionFormData4().title("Auric Stock Battery").label("Auric Stock Battery is an item that used to recharge your Auric Charges quickly by one click.").label("This item can be used up to 2 times recharging your Auric Charges up to 100 per use.").label("Interact to use it, if the charges ran out, put it at Auric Battery Recharge Station.").label("This item can be obtained from Crafting with Auric Stars / Ancient Copper Core with Copper Block, obtained from Trial Chamber, and from Auric Automaton : Copper Mechanical Array.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function combatDummy(player) {
  const form = new ActionFormData4().title("Combat Dummy").label("Combat Dummy is an item that can be used to test your combat skills, and testing your maximum damage output.").label("Place it on the ground and try to hit it with your best weapon to test your damage output.").label("To pick it up, interact with it while sneaking.").label("This item can be crafted with 2 Planks, 2 Sticks, and 3 Smooth Stone Slabs.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function flowChanneler(player) {
  const form = new ActionFormData4().title("Flow Channeler").label("Flow Channeler is an Active Support item that can be used to dash forward, and evading your enemies.").label("Interact with this item to dash forward, and you can enchant your items with Mending and Unbreaking.").label("This item can be obtained by killing Sealed Soul of Nature.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function hellCharge(player) {
  const form = new ActionFormData4().title("Hell Charge").label("Hell Charge is an Active Support item that boosts your mobility by giving you small boost into your movement.").label("Interact with this item to boost your mobility, you can also Spam Interact with this item to make you flying or falling slowly. Use with best control set-up to maximize this item capabilities.").label("But remember, this item is very fragile, long spammed use and your item gone. To prevent this happening, you can enchant your items with Mending and Unbreaking.").label("This item can be crafted with Magma Cream, and 4 Blaze Powder.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function suspiciousMushroom(player) {
  const form = new ActionFormData4().title("Suspicious Mushroom").label("Suspicious Mushroom is an Active Support item that boosts all of your stats minimally.").label("Eat this item to improve your stats without any side effects, Stats will be increased temporarily for 10 minutes.").label("But remember, this item is hard to get, use wisely.").label("This item can be obtained from Punicea : A Crimson Eye.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}

// data/scripts/guidescreen/block_guide.ts
import { ActionFormData as ActionFormData5 } from "@minecraft/server-ui";
function guideBlocks(player) {
  const form = new ActionFormData5().title("Blocks").label("This is the list of Blocks that exist in the add-on, each blocks showed here have a functionality.").button("Ancient Copper Core").button("Auric Battery Recharge Station").button("Nature Soul Altar").button("Suspicious Crimson Eye").button("Back").show(player).then((r) => {
    if (r.selection === 4 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) ancientCopperCore(player);
    if (r.selection === 1) auricRechargeStation(player);
    if (r.selection === 2) natureSoulAltar(player);
    if (r.selection === 3) suspiciousCrimsonEye(player);
  });
}
function ancientCopperCore(player) {
  const form = new ActionFormData5().title("Ancient Copper Core").label("Ancient Copper Core is a block that contains large power of Auric Charges, those power needs a specific power to fully activate the blocks.").label("This block will create another battery if you interact with it, Fill those block scattered with the specific item, and try to interact the core again, and you'll see the boss : Auric Automaton - Copper Mechanical Array.").label("This block can be found in Trial Chamber.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function auricRechargeStation(player) {
  const form = new ActionFormData5().title("Auric Battery Recharge Station").label("Auric Battery Recharge Station is a block that used to recharge your Auric Battery by placing them in the block, interacting while there's battery inside will charge the battery slowly, It takes 100 seconds to complete the charging session, better place more batteries inside since the time to charge will not be changed regardless how many the battery is.").label("This block can't be broken while there are batteries inside.").label("This block can be crafted with Ancient Copper Core, Copper Block, Auric Charging Module.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function natureSoulAltar(player) {
  const form = new ActionFormData5().title("Nature Soul Altar").label("Nature Soul Altar is a natural block that spawned with Prismarine Arena that appears underwater in the ocean.").label("Try to give it Prismarine Shard, and the fight will begin..").label("This block only found naturally in Prismarine Arena.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function suspiciousCrimsonEye(player) {
  const form = new ActionFormData5().title("Suspicious Crimson Eye").label("Suspicious Crimson Eye is a natural block that spawned with Crimson Overgrowth that appears in the Crimson FOREST.").label("Try to give it 5 Essence of Crimson, and the fight will begin..").label("This block only found naturally in Crimson Overgrowth.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}

// data/scripts/guidescreen/boss_guide.ts
import { ActionFormData as ActionFormData6 } from "@minecraft/server-ui";
function guideBosses(player) {
  const form = new ActionFormData6().title("Bosses").label("This is the list of Bosses that exist in the add-on, you will face each of these bosses through your progression.").button("Soul of Nature").button("Punicea - A Crimson Eye").button("Auric Automaton - Copper Mechanical Array").button("Back").show(player).then((r) => {
    if (r.selection === 4 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) soulOfNature(player);
    if (r.selection === 1) puniceaCrimsonEye(player);
    if (r.selection === 2) copperMechanicalArray(player);
  });
}
function soulOfNature(player) {
  const form = new ActionFormData6().title("Sealed Soul of Nature").label("Sealed Soul of Nature is a boss that possesses the power of nature, and the prism. this have several deadly attacks that can deplete your oxgen level during fighting.").label("This boss generally have 500 HP and 3 different attack patterns. when reached 70% HP, the boss will spawn more Nature and Prism Crystal assisting the bossfight to make the fight harder.").label("You can summon this boss by interacting Nature Soul Altar in Prismarine Arena located underwater..").label("Defeating this boss ensure that Phantasm journey have just started and you will get a Treasure bag...").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}
function puniceaCrimsonEye(player) {
  const form = new ActionFormData6().title("Punicea - A Crimson Eye").label("Punicea is a boss that wield the power of crimson corruption. this have 6 different attacks and very tough Health.").label("This boss generally have 3000 HP and 6 different attack patterns. Each attack patterns are well telegraphed, so the attack will deal more damages, and easier to dodge. Just be careful with your movement.").label("You can summon this boss by interacting Suspicious Crimson Eye in Crimson Overgrowth.").label("Defeating this boss ensure that you learned how to dodge very well, and you will get a Treasure bag...").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}
function copperMechanicalArray(player) {
  const form = new ActionFormData6().title("Auric Automaton - Copper Mechanical Array").label("Auric Mechanical Array is a mechanical boss that wield the ultimate power of Auric. this boss have very complicated attack patterns, massive damage, combined with it's great mobility, this boss can obliterate anything easily. Ensure you have Ultimate Gear setup before you fight this abomination.").label("This boss generally have less hp than other end game bosses, 1750 HP and 7 different attack patterns based of how you fight. Each attack patterns are very dangerous to tank, so be more mobile than it. to survive, and kill the boss.").label("You can summon this boss by completing the ritual of Ancient Copper Core.").label("Defeating this boss will drop a Treasure bag, completing the journey of Phantasm, for now... Stay tuned for the next Phantasm Update!").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}

// data/scripts/guidescreen/accessories_guide.ts
import { ActionFormData as ActionFormData7 } from "@minecraft/server-ui";
function guideAccessories(player) {
  const form = new ActionFormData7().title("Accessories").label("Every accessory explains its own effect in its item description, so hover over the item to read what it does!").divider().label("Accessories are an Item Type that can be used as a combat support, or anything to enhance your experience. Accessories can be found anywhere, from doing mining, looting structures, until fighting a boss").divider().label("There are two types of accessories :").label("Active Accessories :\nActive accessories are an accessory that have both passive, and interactability, this type of accessories are recommended to use it at the hotbar with plus sign.").label("Passive Accessories :\nPassive accessories are an accessory that have only passive effect, this type of accessories are recommended to use it at offhand slot, but you can still use it at the hotbar with plus sign.").divider().label("To use accessory, put an accessories item type into Offhand Slot, or Hotbar with plus sign. The passive effect will automatically be applied as soon you equip it.").button("Back").show(player).then((r) => {
    if (r.selection === 0 || r.canceled) mainGuideScreen(player);
  });
}

// data/scripts/guidescreen/enemies_guide.ts
import { ActionFormData as ActionFormData8 } from "@minecraft/server-ui";
function guideEnemies(player) {
  const form = new ActionFormData8().title("Enemies").divider().label("Currently we only have 1 type of enemies, Crimson Tentacles").label("Crimson Tentacles spawn naturally in Crimson Forest, when defeated drop Essence of Crimson with chance of 50%").divider().button("Back").show(player).then((r) => {
    if (r.selection === 0 || r.canceled) mainGuideScreen(player);
  });
}

// data/scripts/guidescreen/main_guide.ts
function mainGuideScreen(player) {
  const form = new ActionFormData9().title("Guide").header("Phantasm Guide").divider().label(
    "Phantasm is an add-on that adds a lot of content into your world: new weapons, mechanics, enemies, and bosses. This add-on is updated regularly, so stay tuned for the next content!"
  ).label("New to the add-on? Click Getting Started below to learn where to begin!").divider().button("Getting Started").button("Mechanics", "textures/ui/speed_effect").button("Weapons", "textures/items/diamond_sword").button("Items", "textures/items/essence_of_crimson").button("Blocks", "textures/blocks/stonebrick_carved").button("Accessories", "textures/items/fire_bracelet").button("Bosses", "textures/items/the_crimson_watcher").button("Enemies", "textures/items/egg_zombie").divider().button("Changelogs").button("Contact the Developer!").divider().label(
    "Are you stuck? You can press this button to unstuck yourself, or use /unstuck command. Sometimes, minecraft can be really bugged with inputpermission so I add these button and command for that reason."
  ).button("Unstuck (reset some effects and tags)").divider().button("Exit").show(player).then((r) => {
    if (r.canceled) player.sendMessage("\xA7eYou can use /guide to check the guide or list of features in Phantasm!");
    if (r.selection == 0) gettingStarted(player);
    if (r.selection == 1) mechanicsList(player);
    if (r.selection == 2) guideWeapons(player);
    if (r.selection == 3) guideItems(player);
    if (r.selection == 4) guideBlocks(player);
    if (r.selection == 5) guideAccessories(player);
    if (r.selection == 6) guideBosses(player);
    if (r.selection == 7) guideEnemies(player);
    if (r.selection == 8) Changelogs(player);
    if (r.selection == 9) developer(player);
    if (r.selection == 10) unstuckPlayer(player);
  });
}
function gettingStarted(player) {
  const form = new ActionFormData9().title("Getting Started").header("Where to begin?").divider().header("Early Game \u2014 Mining").label("- Mine ores to get a chance at the Rusted Fortune Coin and Item Magnet Ore (1% chance per ore).").label("- Use /unlockskill to upgrade your passive abilities: Passive Dash, Extra Health, and Wind Plunge.").divider().header("Mid Game \u2014 Exploration").label("- Explore Trial Chambers to find the Ancient Copper Core, Auric Proton, and the Peacemaker Oath.").label("- Visit the Crimson Forest: fight Crimson Tentacles for Essence of Crimson, and locate the Crimson Overgrowth.").divider().header("Bosses \u2014 Your Progression").label("1. Sealed Soul of Nature (Prismarine Arena, underwater) \u2014 your first boss, drops Prismatic Ingots and a treasure bag (Animitta / Prism Weaver).").label("2. Punicea : A Crimson Eye (Crimson Overgrowth) \u2014 drops The Bleeding Spire and Suspicious Mushroom.").label("3. Auric Automaton : Copper Mechanical Array (Ancient Copper Core ritual) \u2014 the final boss, drops Supercharged Copper Axe / Auric Photonizer.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mainGuideScreen(player);
  });
}
function Changelogs(player) {
  const form = new ActionFormData9().title("Changelogs").header("v1.5.1").divider().header("Removal").label("- Removed the debug log spam that printed on every ore mined - ExplerHD").divider().header("Changes").label("= Rewrote the Dynamic Light System: no more flickering when switching items, lights are placed instantly, and they only spawn on air or liquid blocks so they won't break tall grass, flowers, or doors - ExplerHD").label("= Health Bar now uses the native on-screen display, so it no longer spams the chat and shows correctly on respawn - ExplerHD").label('= Fixed a crash ("setTitle of undefined") that occurred whenever a mob took damage - ExplerHD').label("= Overhauled the Guidescreen: fixed wrong weapon titles and a wrong drop source, cleaned up typos, and corrected outdated HP data - ExplerHD").label("= Fixed the Damage Indicator icons being mispositioned - ExplerHD").label("= Moved the Dash cooldown scoreboard to be initialized when a player joins - ExplerHD").divider().header("Addition").label("+ Added a Getting Started page to the Guidescreen with a recommended progression path, plus a welcome message on first join - ExplerHD").label("+ Added a crafting recipe to turn a Rusted Fortune Coin into 4 Gold Blocks - ExplerHD").divider().header("v1.5.0").divider().header("Removal").label("- Removed the Glyph System, but you can still use the glyphs available in Phantasm - ExplerHD").label("- Removed the mining functionality from Legendary Weapons, as they were never designed for that purpose - ExplerHD").label("- Removed the Direct Hit feature from Legendary Weapons and Seiketsu - ExplerHD").divider().header("Changes").label("= Refactored the Custom Mace system - ExplerHD").label("= Reworked the Damage Indicator system to use Runtime Particles - ExplerHD").label("= Changed Prism Boss Arena from fixed ground positions to locatable underwater structures - ExplerHD").label("= Updated the Soul of Nature boss fight to follow the new structure generation (underwater boss fight) - ExplerHD").label("= Adjusted the placement of the Crimson Overgrowth structure to make it more logical and visible - ExplerHD").label("= Increased Seiketsu damage by +4 - ExplerHD").label("= Slightly updated the visuals of The Bleeding Spire attack - ExplerHD").label("= Rebalanced the damage of all Legendary Weapons so they can compete with enchanted Epic Weapons - ExplerHD").label("= Made Soul of Nature, Punicea, and Auric Automaton have 500 HP, 3000 HP, and 1750 HP due to Recent Weapons changes. - ExplerHD").label("= Added support for Fire Aspect, Knockback, and Weakness on Legendary Weapons - ExplerHD").label("= Updated all Legendary Weapons so their attack patterns now loop continuously without an ending cooldown - ExplerHD").label('= Fixed a bug where upgrading Dash to Level 2 would display "Insufficient Experience Level" instead of "Maximum level of Dash is reached." - ExplerHD').divider().header("Addition").label("+ Added the `damage_number` and `damage_icons` particles - ExplerHD").label("+ Added the Better than Mending feature - ExplerHD").label("+ Added a Combat Dummy - ExplerHD").label("+ Added a Turtle Shell item to the Prismarine Boss Arena to make the boss fight in that arena easier - ExplerHD").label("+ Added Rusted Fortune Coin, which doubles ore drops, and the Item Magnet Ore. Both can be obtained from a 1% chance when mining any ore - Passive Type - ExplerHD").label("+ Added Condensed Sea Nature, providing much longer underwater breathing and slightly faster health regeneration while underwater - Passive Type - ExplerHD").label("+ Added Guidescreen - ExplerHD & ZeroMaster178").divider().label("Stay tuned for the next content update!").button("Back").show(player).then((r) => {
    if (r.selection == 0) mainGuideScreen(player);
  });
}
function developer(player) {
  const form = new ActionFormData9().title("Developer Contact").header("Contact Us!").divider().label("ExplerHD\nGitHub : ExplHD\nDiscord : explerhd\nYoutube : ExplerHD (@ExplHD)\nMCPEDL : ExplerHD\nCurseforge : ExplerHD").label("ZeroMaster178\nInstagram : zeromaster_178\nMCPEDL : Zeromaster 178\nCurseforge : Zeromaster178\nTiktok : Zeromaster_178\nYoutube : zeromaster178\nDiscord : zeromaster178").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0) mainGuideScreen(player);
  });
}

// data/scripts/dynamicPropertyEdit.ts
import "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
var DYNAMIC_PROPERTY_IDS = ["ph:dash_level", "ph:health_level", "ph:plunge_unlock", "ph:guidebook_acquired"];
function getPropertyType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "undefined";
}
function openDynamicPropertyMenu(player) {
  const selectedIndex = new ObservableNumber(0, { clientWritable: true });
  const toggleValue = new ObservableBoolean(false, { clientWritable: true });
  const textValue = new ObservableString("", { clientWritable: true });
  const showToggle = new ObservableBoolean(false);
  const showText = new ObservableBoolean(false);
  const confirmReset = new ObservableBoolean(false, { clientWritable: true });
  const statusMessage = new ObservableString("");
  let currentType = "undefined";
  function refreshForIndex(index) {
    const propertyId = DYNAMIC_PROPERTY_IDS[index];
    const currentValue = player.getDynamicProperty(propertyId);
    currentType = getPropertyType(currentValue);
    if (currentType === "boolean") {
      showToggle.setData(true);
      showText.setData(false);
      toggleValue.setData(currentValue);
    } else {
      showToggle.setData(false);
      showText.setData(true);
      textValue.setData(currentValue !== void 0 ? currentValue.toString() : "");
    }
  }
  refreshForIndex(selectedIndex.getData());
  selectedIndex.subscribe((newIndex) => {
    refreshForIndex(newIndex);
    statusMessage.setData("");
  });
  const dropdownItems = DYNAMIC_PROPERTY_IDS.map((id, i) => ({ label: id, value: i }));
  new CustomForm(player, "DynamicProperty Manager").label("Choose DynamicProperty to change:").dropdown("Property", selectedIndex, dropdownItems).divider().toggle("Value (boolean)", toggleValue, { visible: showToggle }).textField("Value (number/string)", textValue, {
    description: "Input text/string value",
    visible: showText
  }).spacer().button("Save", () => {
    const propertyId = DYNAMIC_PROPERTY_IDS[selectedIndex.getData()];
    try {
      if (currentType === "boolean") {
        player.setDynamicProperty(propertyId, toggleValue.getData());
      } else if (currentType === "number") {
        const parsed = Number(textValue.getData());
        if (Number.isNaN(parsed)) {
          statusMessage.setData("\xA7cIncorrect Type, Expected Type : Number!");
          return;
        }
        if (propertyId === DYNAMIC_PROPERTY_IDS[1]) {
          player.removeEffect("health_boost");
          player.runCommand(`effect @s health_boost infinite ${3 * parsed} true`);
          player.addEffect("instant_health", 20, { amplifier: 255, showParticles: false });
        }
        player.setDynamicProperty(propertyId, parsed);
      } else {
        player.setDynamicProperty(propertyId, textValue.getData());
      }
      statusMessage.setData(`\xA7aSuccessfully changed ${propertyId}!`);
    } catch (e) {
      statusMessage.setData(`\xA7cFailed to change property: ${e}`);
    }
  }).divider().label("Reset all DynamicProperties in the list:").toggle("Turn on to confirm", confirmReset).button("Reset All Properties", () => {
    if (!confirmReset.getData()) {
      statusMessage.setData("\xA7eTurn on the toggle before resetting!");
      return;
    }
    for (const id of DYNAMIC_PROPERTY_IDS) {
      player.setDynamicProperty(id, void 0);
    }
    confirmReset.setData(false);
    refreshForIndex(selectedIndex.getData());
    statusMessage.setData("\xA7aAll DynamicProperties are successfully reset!");
  }).divider().label(statusMessage).closeButton().show().catch((e) => {
    console.error(e);
  });
}

// data/scripts/custom_components.ts
system12.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.itemComponentRegistry.registerCustomComponent("ph:charge_passive", {
    onHitEntity(e) {
      const hitEntity = e.hitEntity;
      const source = e.attackingEntity;
      const itemStack = e.itemStack;
      if (itemStack.typeId === "ph:charged_copper_axe") {
        system12.runTimeout(() => {
          if (getScore(source, "charged_copper_axe") == 100) {
            hitEntity.runCommand("summon lightning_bolt");
          }
          let calculatedDamage = 10 + getScore(source, "charged_copper_axe") / 10;
          hitEntity.applyDamage(calculatedDamage);
          setScore(source, "charged_copper_axe", 0);
        }, 3);
      }
    },
    onUse(e) {
      const player = e.source;
      player.startItemCooldown("charged_copper_axe", 120);
      applyDurabilityDamage2(player, { damage: 36 });
      system12.run(() => {
        player.playAnimation("animation.charged_copper_axe.attack_3", player.location);
        system12.runTimeout(() => {
          player.dimension.playSound("weapon_slash.slash_heavy", player.location);
          player.dimension.spawnParticle("ph:lightning_flash", player.location);
          player.dimension.spawnParticle("ph:lightning_sparks", player.location);
          player.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=4] 18 entity_attack entity "${player.name}"`);
          player.runCommand("summon lightning_bolt ^^^5 ~ 0");
          player.runCommand("summon lightning_bolt ^^^10 ~ 0");
          player.runCommand("particle ph:lightning_sparks ^^^5");
          player.runCommand("particle ph:lightning_sparks ^^^10");
        }, 8);
      });
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:time_polarizer", {
    onUse(e) {
      const source = e.source;
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
    onUse({ source, itemStack }, { params }) {
      const cooldownCategory = itemStack?.getComponent("cooldown")?.cooldownCategory;
      const horizontalDashStrength = params.horizontal_dash_strength ?? 0;
      const verticalDashStrength = params.vertical_dash_strength ?? 0;
      const dashDirection = params.dashDirection ?? "view_direction";
      const soundEffect = params.sound_effect ?? "random.explode";
      const durabilityDamage = params.durability_damage ?? 0;
      const cooldownValue = params.cooldown_value ?? 20;
      const particleEffect = params.particle_effect ?? "minecraft:critical_hit_emitter";
      applyDurabilityDamage2(source, { damage: durabilityDamage });
      switch (dashDirection) {
        case "impulse":
          source.applyImpulse({ x: source.getViewDirection().x * horizontalDashStrength, y: verticalDashStrength, z: source.getViewDirection().z * horizontalDashStrength });
          source.dimension.playSound(soundEffect, source.location);
          source.dimension.spawnParticle(particleEffect, source.location);
          if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
          break;
        case "view_direction":
          source.applyKnockback({ x: source.getViewDirection().x * horizontalDashStrength, z: source.getViewDirection().z * horizontalDashStrength }, verticalDashStrength);
          source.dimension.playSound(soundEffect, source.location);
          source.dimension.spawnParticle(particleEffect, source.location);
          if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
          break;
        case "velocity":
          source.applyKnockback({ x: source.getVelocity().x * horizontalDashStrength, z: source.getVelocity().z * horizontalDashStrength }, verticalDashStrength);
          source.dimension.playSound(soundEffect, source.location);
          source.dimension.spawnParticle(particleEffect, source.location);
          if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
          break;
        default:
          break;
      }
      if (!source.isGliding) {
        source.playAnimation("animation.player_extend.dash", {
          stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
        });
      }
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:treasure_bag", {
    onUse({ source }, { params }) {
      const inventory = source.getComponent("inventory").container;
      const loot = params.loot ?? "loot_tables/empty";
      inventory.setItem(source.selectedSlotIndex, void 0);
      source.runCommand(`loot spawn ~~~ loot "${loot}"`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:food_effects", {
    onConsume({ source, itemStack }, { params }) {
      const playerHealthLevel = source?.getDynamicProperty("ph:health_level");
      const healthBoostLevel = params.health_boost_levels;
      const healthBoostDuration = params.health_boost_duration;
      const tags = itemStack.getTags();
      for (const tag of tags) {
        if (tag.startsWith("ph:food_effects-")) {
          const val = tag.split("-");
          source.addEffect(val[1], parseFloat(val[2]), {
            amplifier: parseFloat(val[3])
          });
        }
      }
      source.runCommand(`effect @s health_boost ${healthBoostDuration} ${3 * (playerHealthLevel + healthBoostLevel)} true`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:ability_upgrade", {
    onUse({ source }, { params }) {
      const min_level = params.min_level ?? 0;
      const passive_ability = params.passive_ability;
      const upgrade_to = params.upgrade_to ?? void 0;
      const upgrade_step = params.upgrade_step ?? 0;
      const upgrade_sound = params.upgrade_sound ?? "random.levelup";
      const upgrade_particle = params.upgrade_particle ?? "ph:auric_photonizer_explode";
      const inventory = source.getComponent("inventory").container;
      const property = source.getDynamicProperty(passive_ability);
      if (property < min_level) {
        source.sendMessage(`\xA7cTo upgrade to this level, you need minimum ability level of ${min_level}`);
        return;
      }
      if (upgrade_to == void 0 && upgrade_step < 1) {
        console.error(`Please give the specified value for the "upgrade_to" or "upgrade_step"`);
        return;
      }
      if (upgrade_to != void 0) source.setDynamicProperty(passive_ability, upgrade_to);
      if (upgrade_step > 0) source.setDynamicProperty(passive_ability, property + upgrade_step);
      source.sendMessage(`\xA7aUpgrade successful, feels the difference of the abilities`);
      source.dimension.playSound(upgrade_sound, source.location);
      source.dimension.spawnParticle(upgrade_particle, source.location);
      source.runCommand(`clear @s ${inventory.getItem(source.selectedSlotIndex).typeId} -1 1`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:vanilla_tool_fix", {
    onUseOn({ source, block }) {
      const dirtPathable = [
        "minecraft:dirt",
        "minecraft:dirt_with_roots",
        "minecraft:podzol",
        "minecraft:mycellium",
        "minecraft:coarse_dirt"
      ];
      const inventory = source?.getComponent("inventory")?.container;
      const item = inventory?.getItem(source.selectedSlotIndex);
      if (item?.hasTag("minecraft:is_shovel") && block.typeId.includes(dirtPathable)) {
        block.dimension.setBlockType(block.location, "minecraft:dirt_path");
        source.playSound("use.grass");
        applyDurabilityDamage2(source);
      }
    },
    onMineBlock({ source, itemStack }) {
      applyDurabilityDamage2(source);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_shooter", {
    onUse(e, { params }) {
      const projectileEntity = params.projectile_entity;
      const soundEffect = params.sound_effect ?? "random.explode";
      const costType = params.cost_type ?? "durability";
      const costAmount = params.cost_amount ?? 1;
      const altProjectileEvent = params.alt_projectile_event;
      const altCostType = params.alt_cost_type ?? "durability";
      const altCostAmount = params.alt_cost_amount ?? 1;
      const animation = params.animation;
      const player = e.source;
      const itemStack = e.itemStack;
      const cooldownCategory = itemStack?.getComponent("cooldown")?.cooldownCategory;
      const cooldownValue = itemStack?.getComponent("cooldown")?.cooldownTicks;
      const altEvents = {
        oceanic_attack: () => {
          player.startItemCooldown("nature_staff", 50);
          player.runCommand("summon ph:ocean_crystal_wave ~~~5 0 0");
          player.runCommand("summon ph:ocean_crystal_wave ~-5~~ 90 0");
          player.runCommand("summon ph:ocean_crystal_wave ~~~-5 180 0");
          player.runCommand("summon ph:ocean_crystal_wave ~5~~ 270 0");
          player.runCommand(
            `playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`
          );
        }
      };
      if (player.isSneaking) {
        const eventFunc = altEvents[altProjectileEvent];
        if (!eventFunc) {
          player.sendMessage(`Unknown alt event: ${altProjectileEvent}`);
          return;
        }
        if (costType === "durability") {
          applyDurabilityDamage2(player, { damage: altCostAmount });
        } else {
          if (getScore(player, altCostType) < altCostAmount) return player.sendMessage("Insufficient Charges");
          removeScore2(player, altCostType, altCostAmount);
          applyDurabilityDamage2(player, { damage: altCostAmount });
        }
        eventFunc();
        return;
      }
      if (costType === "durability") {
        applyDurabilityDamage2(player, { damage: costAmount });
      } else {
        if (getScore(player, costType) < costAmount) return player.sendMessage("Insufficient Charges");
        removeScore2(player, costType, costAmount);
        applyDurabilityDamage2(player, { damage: costAmount });
      }
      if (cooldownCategory) player.startItemCooldown(cooldownCategory, cooldownValue);
      if (animation != void 0) player.playAnimation(animation);
      const head = player.getHeadLocation();
      const view = player.getViewDirection();
      const dir = {
        x: view.x,
        y: view.y,
        z: view.z
      };
      const offset = 0.6;
      const bullet = player.dimension.spawnEntity(`${projectileEntity}`, {
        x: head.x + view.x * offset,
        y: head.y + view.y * offset,
        z: head.z + view.z * offset
      });
      const proj = bullet.getComponent("minecraft:projectile");
      if (!proj) return;
      proj.owner = player;
      proj.shoot({
        x: dir.x * 2,
        y: dir.y * 2,
        z: dir.z * 2
      });
      player.runCommand(`playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:cruxshaper", {
    onUse(e) {
      const player = e.source;
      player.startItemCooldown("cruxshaper", 600);
      function impact() {
        player.removeEffect("slow_falling");
        player.dimension.spawnParticle("ph:cruxshaper_smash_explosion", player.location);
        player.dimension.playSound("random.explode", player.location);
        player.runCommand("damage @e[r=10,rm=0.1,family=!inanimate,type=!item] 50 entity_explosion entity @s");
        player.runCommand("execute as @s at @e[r=10,rm=0.1,family=!inanimate,type=!item] run setblock ~~~ fire");
      }
      system12.run(() => {
        player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
        player.addEffect("levitation", 20, {
          amplifier: 24
        });
        player.dimension.playSound("random.explode", player.location);
        system12.runTimeout(() => {
          player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
          player.applyKnockback({ x: 0, z: 0 }, -2.1);
          player.addEffect("slow_falling", 20);
          player.playAnimation("animation.player_extend.plunge", {
            stopExpression: "query.is_on_ground"
          });
          player.dimension.playSound("random.explode", player.location);
          const intervalRun = system12.runInterval(() => {
            if (!player.isOnGround) return;
            system12.run(impact);
            system12.clearRun(intervalRun);
          }, 2);
        }, 30);
      });
      applyDurabilityDamage2(player, { damage: 50 });
    },
    onUseOn(e) {
      const player = e.source;
      system12.run(() => {
        player.sendMessage("Look up while using the skill!");
      });
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:repair_full_inventory", {
    onUse({ source }, { params }) {
      const inventory = source?.getComponent("minecraft:inventory")?.container;
      const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];
      const repairRatio = params.repair_ratio ?? 100;
      const experienceCost = params.experience_cost;
      const cooldown = params.cooldown;
      const experienceLevel = source.level;
      if (experienceLevel < experienceCost) return;
      for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;
        const durability = item.getComponent("minecraft:durability");
        if (!durability) continue;
        const newDamage = durability.damage - durability.damage * (repairRatio / 100);
        durability.damage = newDamage;
        inventory.setItem(i, item);
      }
      for (const slot of slots) {
        const equipmentSlot = source?.getComponent("minecraft:equippable")?.getEquipmentSlot(slot);
        const item = equipmentSlot.getItem();
        if (!item) continue;
        const durability = item.getComponent("minecraft:durability");
        if (!durability) continue;
        const newDamage = durability.damage - durability.damage * (repairRatio / 100);
        durability.damage = newDamage;
        equipmentSlot.setItem(item);
      }
      const cost = Number(experienceCost);
      if (!isNaN(cost)) {
        source.addLevels(-cost);
      } else {
        console.log("experienceCost invalid:", experienceCost);
      }
      source.playSound("random.anvil_use");
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:auric_communicator", {
    onUse({ source, itemStack }) {
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
      const blockLoc = block.location;
      block.dimension.runCommand("playsound random.toast @a[r=128] ~~~ 1 1.5 0.3");
      source.playSound("random.toast");
      block.dimension.spawnParticle("ph:auric_communicator_loading", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
      if (auricMode == 1) {
        source.addTag("AURIC_ORBITAL_NUKE");
        system12.runTimeout(() => {
          block.dimension.runCommand(`damage @e[r=48,tag=!AURIC_ORBITAL_NUKE,type=!item,family=!inanimate,x=${blockLoc.x},y=${blockLoc.y},z=${blockLoc.z}] 50 entity_explosion entity @e[tag=AURIC_ORBITAL_NUKE]`);
          block.dimension.spawnParticle("ph:auric_stab_shot", { x: blockLoc.x, y: 0, z: blockLoc.z });
          block.dimension.spawnParticle("ph:auric_nuke_shot", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
          block.dimension.runCommand("playsound random.explode @a[r=192] ~~~ 1 1 0.5");
          removeScore2(source, "auric_charge", 100);
          source.startItemCooldown("auric_communicator", 600);
          source.removeTag("AURIC_ORBITAL_NUKE");
        }, 30);
        return;
      }
      source.addTag("AURIC_ORBITAL_LASER");
      system12.runTimeout(() => {
        for (let i = 0; i < 381; i += 10) {
          block.dimension.runCommand(`damage @e[r=10,tag=!AURIC_ORBITAL_LASER,type=!item,family=!inanimate,x=${blockLoc.x},y=${i},z=${blockLoc.z}] 80 entity_explosion entity @e[tag=AURIC_ORBITAL_LASER]`);
          block.dimension.runCommand(`playsound random.explode @a[r=128] ~ ${i} ~ 1 1 0.5`);
        }
        block.dimension.spawnParticle("ph:auric_stab_shot_refined", { x: blockLoc.x, y: 0, z: blockLoc.z });
        block.dimension.spawnParticle("ph:auric_stab_shot_line", { x: blockLoc.x, y: 0, z: blockLoc.z });
        removeScore2(source, "auric_charge", 50);
        source.startItemCooldown("auric_communicator", 600);
        source.removeTag("AURIC_ORBITAL_LASER");
      }, 30);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:battery_container", {
    onUse({ source, itemStack }, { params }) {
      const whereToFill = params.where_to_fill || "auric_charge";
      const transferPerUse = params.charges || 100;
      const maxCharge = params.max_charge || 700;
      const durability = itemStack.getComponent("minecraft:durability");
      if (!durability) return;
      const maxDurability = durability.maxDurability;
      const batteryCharge = maxDurability - durability.damage;
      if (batteryCharge <= 1) {
        source.sendMessage(
          "\xA7cYour Battery Container is empty."
        );
        return;
      }
      const currentCharge = getScore(source, whereToFill);
      const missingCharge = maxCharge - currentCharge;
      if (missingCharge <= 0) {
        source.sendMessage(
          "\xA7eAuric Charge already full."
        );
        return;
      }
      const transferAmount = Math.min(
        transferPerUse,
        batteryCharge,
        missingCharge
      );
      setScore(
        source,
        whereToFill,
        currentCharge + transferAmount
      );
      applyDurabilityDamage2(source, { damage: transferAmount });
      source.sendMessage(
        `\xA7b+${transferAmount} Auric Charge`
      );
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_parry_window", {
    onUse({ source, itemStack }, { params }) {
      const window_time = params.window_time;
      const animation = params.animation;
      source.playAnimation(animation);
      source.dimension.spawnParticle("ph:parry_prepare", source.location);
      source.dimension.playSound("item.spear.use", source.location);
      source.addTag("parried");
      source.inputPermissions.setPermissionCategory(2, false);
      applyDurabilityDamage2(source, { damage: 1 });
      system12.runTimeout(() => {
        if (source?.hasTag("parried")) source.removeTag("parried");
        source.inputPermissions.setPermissionCategory(2, true);
      }, window_time);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:guidebook", {
    onUse({ source }) {
      mainGuideScreen(source);
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:boss_summon", {
    onPlayerInteract({ player, block, faceLocation }) {
      const boss = block.getComponent("ph:boss_summon").customComponentParameters.params.boss;
      const bargaining_item = block.getComponent("ph:boss_summon").customComponentParameters.params.bargaining_item;
      let bargaining_item_amount = block.getComponent("ph:boss_summon").customComponentParameters.params.bargaining_item_amount;
      const message = block.getComponent("ph:boss_summon").customComponentParameters.params.message;
      let transform_into_entity = block.getComponent("ph:boss_summon").customComponentParameters.params.transform_into_entity;
      const mergedDataItem = new ItemStack5(bargaining_item, bargaining_item_amount);
      const mainhand = player.getComponent("equippable").getEquipment("Mainhand");
      if (!bargaining_item_amount) bargaining_item_amount = 1;
      if (mainhand?.typeId === bargaining_item && mainhand?.amount >= bargaining_item_amount) {
        if (transform_into_entity && !boss) {
          block.dimension.setBlockType(block.location, "minecraft:air");
          block.dimension.spawnEntity(`${transform_into_entity}`, block.center());
          block.dimension.playSound("custom_sfx.boss_summoned", block.location);
          player.runCommand(`clear @s ${bargaining_item} -1 ${bargaining_item_amount}`);
          player.sendMessage(message);
          return;
        }
        block.dimension.spawnEntity(boss, { x: block.center().x, y: block.center().y, z: block.center().z });
        block.dimension.playSound("custom_sfx.boss_summoned", block.location);
        player.runCommand(`clear @s ${bargaining_item} -1 ${bargaining_item_amount}`);
        player.sendMessage(message);
      } else {
        player.sendMessage({
          rawtext: [
            {
              text: `You need \xA7a${mergedDataItem?.amount}x `
            },
            {
              translate: `${mergedDataItem?.localizationKey}`
            },
            {
              text: ` \xA7rto activate this summoning block!`
            }
          ]
        });
        return;
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:ancient_copper_core", {
    onPlayerInteract({ player, block, dimension }) {
      const northBlockState = block.north(2).permutation.getState("ph:activation_state");
      const eastBlockState = block.east(2).permutation.getState("ph:activation_state");
      const southBlockState = block.south(2).permutation.getState("ph:activation_state");
      const westBlockState = block.west(2).permutation.getState("ph:activation_state");
      if (northBlockState == 1 && eastBlockState == 1 && southBlockState == 1 && westBlockState == 1) {
        player.sendMessage("Successfully activating the core. Waiting for his approach");
        block.dimension.setBlockType(block.north(2), "ph:core_battery");
        block.dimension.setBlockType(block.south(2), "ph:prismarine_battery");
        block.dimension.spawnParticle("ph:auric_beam", block.center());
        block.dimension.spawnParticle("ph:auric_light_flash", block.center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.north(2).center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.east(2).center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.south(2).center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.west(2).center());
        block.dimension.playSound("custom_sfx.boss_summoned", block.center());
        system12.runTimeout(() => {
          block.dimension.spawnEntity("ph:copper_mechanical_array", block.above(1.1));
          block.dimension.playSound("mob.zombie.woodbreak", block.center());
        }, 100);
      }
      if (block.north(2).typeId != "minecraft:air" || block.east(2).typeId != "minecraft:air" || block.south(2).typeId != "minecraft:air" || block.west(2).typeId != "minecraft:air") return;
      block.dimension.playSound("tile.piston.in", block.center());
      if (block.north(2).typeId === "minecraft:air") block.dimension.setBlockType(block.north(2), "ph:core_battery");
      if (block.east(2).typeId === "minecraft:air") block.dimension.setBlockType(block.east(2), "ph:auric_battery");
      if (block.south(2).typeId === "minecraft:air") block.dimension.setBlockType(block.south(2), "ph:prismarine_battery");
      if (block.west(2).typeId === "minecraft:air") block.dimension.setBlockType(block.west(2), "ph:auric_battery");
    },
    onTick({ block, dimension }) {
      const northBlockState = block.north(2).permutation.getState("ph:activation_state");
      const eastBlockState = block.east(2).permutation.getState("ph:activation_state");
      const southBlockState = block.south(2).permutation.getState("ph:activation_state");
      const westBlockState = block.west(2).permutation.getState("ph:activation_state");
      let molangMap = new MolangVariableMap4();
      molangMap.setFloat("variable.size", 1);
      molangMap.setColorRGBA("variable.rgba", { red: 1, green: 0.63137, blue: 0, alpha: 1 });
      let centerMap = new MolangVariableMap4();
      centerMap.setFloat("variable.size", 3);
      centerMap.setColorRGBA("variable.rgba", { red: 1, green: 0.63137, blue: 0, alpha: 1 });
      let activatedCoreMap = new MolangVariableMap4();
      activatedCoreMap.setFloat("variable.size", 1);
      activatedCoreMap.setColorRGBA("variable.rgba", { red: 1, green: 1, blue: 1, alpha: 1 });
      let activatedPrismarineMap = new MolangVariableMap4();
      activatedPrismarineMap.setFloat("variable.size", 1);
      activatedPrismarineMap.setColorRGBA("variable.rgba", { red: 0.352, green: 1, blue: 0.705, alpha: 1 });
      if (northBlockState == 1) {
        block.dimension.spawnParticle("ph:bounding_circle", block.north(2).center(), activatedCoreMap);
      }
      if (eastBlockState == 1) {
        block.dimension.spawnParticle("ph:bounding_circle", block.east(2).center(), molangMap);
      }
      if (southBlockState == 1) {
        block.dimension.spawnParticle("ph:bounding_circle", block.south(2).center(), activatedPrismarineMap);
      }
      if (westBlockState == 1) {
        block.dimension.spawnParticle("ph:bounding_circle", block.west(2).center(), molangMap);
      }
      if (block.north(2).typeId != "minecraft:air" || block.east(2).typeId != "minecraft:air" || block.south(2).typeId != "minecraft:air" || block.west(2).typeId != "minecraft:air") return;
      block.dimension.spawnParticle("ph:bounding_circle", block.center(), centerMap);
      block.dimension.spawnParticle("ph:bounding_circle", block.north(2).center(), molangMap);
      block.dimension.spawnParticle("ph:bounding_circle", block.east(2).center(), molangMap);
      block.dimension.spawnParticle("ph:bounding_circle", block.south(2).center(), molangMap);
      block.dimension.spawnParticle("ph:bounding_circle", block.west(2).center(), molangMap);
    },
    onBreak({ block, dimension, brokenBlockPermutation }) {
      dimension.setBlockType(block.north(2), "minecraft:air");
      dimension.setBlockType(block.east(2), "minecraft:air");
      dimension.setBlockType(block.south(2), "minecraft:air");
      dimension.setBlockType(block.west(2), "minecraft:air");
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:copper_battery", {
    onPlayerInteract({ player, block, dimension }, { params }) {
      const chargeType = params.charge_type;
      const item = params.item ?? "minecraft:netherite_ingot";
      const itemCount = params.item_count ?? 1;
      const playerChargeObjective = params.player_charge_objective ?? "superchargd_copper_axe";
      const chargeMin = params.charge_min ?? 0;
      const mergedDataItem = new ItemStack5(item, itemCount);
      if (chargeType == "item") {
        if (player.getComponent("equippable")?.getEquipment("Mainhand")?.typeId != item) {
          player.sendMessage({
            rawtext: [
              {
                text: `You need \xA7a${mergedDataItem?.amount}x `
              },
              {
                translate: `${mergedDataItem?.localizationKey}`
              },
              {
                text: ` \xA7rto activate this copper battery slot!`
              }
            ]
          });
          return;
        }
        block.setPermutation(block.permutation.withState("ph:activation_state", 1));
        block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
        player.runCommand(`clear @s ${item} -1 ${itemCount}`);
      }
      if (chargeType == "player_charge") {
        if (getScore(player, playerChargeObjective) < chargeMin) {
          player.sendMessage(`You need \xA7a${chargeMin} \xA7rCharges to activate this battery slot`);
          return;
        }
        block.setPermutation(block.permutation.withState("ph:activation_state", 1));
        block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
        removeScore2(player, "auric_charge", chargeMin);
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:item_charger", {
    onPlayerInteract({ player, block, dimension }, { params }) {
      const item = params.item;
      const maxBatteryStack = params.max_battery_stack || 4;
      const soundInput = params.sound_input;
      const soundPickup = params.sound_pickup;
      const itemData = new ItemStack5(item);
      const batteryCount = block.permutation.getState("ph:battery_count");
      const batteryState = block.permutation.getState("ph:battery_state");
      const mainhand = player.getComponent("equippable").getEquipmentSlot("Mainhand");
      const itemStack = mainhand.getItem();
      const durability = itemStack?.getComponent("minecraft:durability");
      if (batteryState == "result") {
        for (let i = 0; i < batteryCount; i++) {
          dimension.spawnItem(itemData, block.center());
        }
        dimension.playSound(soundPickup, block.center());
        block.setPermutation(block.permutation.withState("ph:battery_count", 0));
        block.setPermutation(block.permutation.withState("ph:battery_state", "open"));
        return;
      }
      if (batteryState == "processing") return;
      if (itemStack?.typeId === item && durability.damage < durability.maxDurability) {
        if (batteryCount > 3) return player.sendMessage("\xA7cThe Battery slot is full.");
        mainhand.setItem(void 0);
        block.setPermutation(block.permutation.withState("ph:battery_count", batteryCount + 1));
        dimension.playSound(soundInput, block.center());
        return;
      } else if (batteryCount == 0) {
        player.sendMessage({
          rawtext: [
            {
              text: "You need to put drained \xA7a"
            },
            {
              translate: `${itemData.localizationKey}`
            }
          ]
        });
        player.playSound("note.bass");
        return;
      } else {
        block.setPermutation(block.permutation.withState("ph:battery_state", "processing"));
      }
    },
    onTick({ block, dimension }) {
      const batteryState = block.permutation.getState("ph:battery_state");
      if (batteryState != "processing") return;
      block.setPermutation(block.permutation.withState("ph:battery_state", "result"));
      dimension.playSound("random.orb", block.center());
    }
  });
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:unlockskill",
    description: "Opens a skill unlock ui",
    cheatsRequired: false,
    permissionLevel: CommandPermissionLevel.Any
  }, openForm);
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:cleardynamicproperties",
    description: "Reset all of your dynamic properties",
    cheatsRequired: true,
    permissionLevel: CommandPermissionLevel.GameDirectors
  }, clearDynamicProperty);
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:dynamicproperties",
    description: "Check all of your dynamic properties",
    cheatsRequired: true,
    permissionLevel: CommandPermissionLevel.GameDirectors
  }, (origin) => {
    system12.run(() => {
      openDynamicPropertyMenu(origin.sourceEntity);
    });
  });
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:guide",
    description: "Opens Guide Screen",
    cheatsRequired: false,
    permissionLevel: CommandPermissionLevel.Any
  }, (origin) => {
    system12.run(() => {
      mainGuideScreen(origin.sourceEntity);
    });
  });
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:unstuck",
    description: "Unstuck yourself when you cannot move.",
    cheatsRequired: true,
    permissionLevel: CommandPermissionLevel.Any
  }, (origin) => {
    unstuckPlayer(origin.sourceEntity);
    origin.sourceEntity.sendMessage("Successfully unstuck");
  });
});
function openForm({ sourceEntity: player }) {
  system12.run(() => {
    skillUnlock(player);
  });
  return { status: CustomCommandStatus.Success };
}
function clearDynamicProperty({ sourceEntity: player }) {
  system12.run(() => {
    player.clearDynamicProperties();
  });
  return { status: CustomCommandStatus.Success };
}

// data/scripts/custom_mace/detection.ts
import { world as world13, system as system13, EquipmentSlot as EquipmentSlot5, EntityDamageCause as EntityDamageCause4 } from "@minecraft/server";

// data/scripts/custom_mace/manager.ts
import { EntityEquippableComponent, EquipmentSlot as EquipmentSlot4 } from "@minecraft/server";

// data/scripts/custom_mace/detection.ts
var CustomMaceItems = /* @__PURE__ */ new Set([
  "ph:cruxshaper"
]);
function isCustomMace(item) {
  return !!item && CustomMaceItems.has(item?.typeId);
}
var playerFallData = /* @__PURE__ */ new Map();
system13.runInterval(() => {
  for (const player of world13.getAllPlayers()) {
    const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot5.Mainhand);
    const isMace = isCustomMace(item);
    const blockAt = player?.dimension?.getBlock(player.location);
    const isInWeb = blockAt?.typeId === "minecraft:web";
    const isInvalid = player.isInWater || player.isClimbing || player.isGliding || player.isFlying || !!player.getEffect("minecraft:slow_falling") || !!player.getEffect("minecraft:levitation") || isInWeb;
    if (isMace && !player.isOnGround && !isInvalid) {
      const currentStoredY = playerFallData.get(player.id) || 0;
      if (player.location.y > currentStoredY) {
        playerFallData.set(player.id, player.location.y);
      }
    } else {
      playerFallData.delete(player.id);
    }
  }
}, 1);

// data/scripts/main.ts
console.warn("\xA7a\xA7lPhantasm 1.5.1 Activated!");
function addScore(target, objective, score) {
  try {
    world14.scoreboard.getObjective(objective).addScore(target, score);
  } catch (e) {
    target.runCommand(`scoreboard players add "${target.name}" ${objective} ${score}`);
  }
}
function removeScore2(target, objective, score) {
  try {
    world14.scoreboard.getObjective(objective).addScore(target, -score);
  } catch (e) {
    target.runCommand(`scoreboard players remove "${target.name}" ${objective} ${score}`);
  }
}
function setScore(target, objective, score) {
  try {
    world14.scoreboard.getObjective(objective).setScore(target, score);
  } catch (e) {
    target.runCommand(`scoreboard players set "${target.name}" ${objective} ${score}`);
  }
}
function getScore(target, objective) {
  try {
    return world14.scoreboard.getObjective(objective).getScore(target) ?? 0;
  } catch (error) {
    return 0;
  }
}
function applyDurabilityDamage2(source, options = {}) {
  const {
    damage = 1,
    slot = source?.selectedSlotIndex,
    ignoreUnbreaking = false,
    breakSound = true
  } = options;
  const inventory = source?.getComponent("inventory")?.container;
  if (!inventory) return;
  const item = inventory.getItem(slot);
  if (!item) return;
  const durability = item.getComponent("durability");
  if (!durability) return;
  if (source.getGameMode && source.getGameMode() === "Creative") return;
  if (!ignoreUnbreaking) {
    const unbreaking = item?.getComponent("enchantable")?.getEnchantment("unbreaking")?.level ?? 0;
    const chance = unbreaking * 21;
    const roll = Math.floor(Math.random() * 101);
    if (roll <= chance) return;
  }
  const newDamage = durability.damage + damage;
  if (newDamage >= durability.maxDurability) {
    inventory.setItem(slot, void 0);
    if (breakSound && source.playSound) {
      source.playSound("random.break");
    }
    return;
  }
  durability.damage = newDamage;
  inventory.setItem(slot, item);
}
function detectMove2(entity, tickInterval = 1, callback) {
  const startLocation = {
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z)
  };
  const interval = system14.runInterval(() => {
    if (!entity?.isValid) {
      system14.clearRun(interval);
      return;
    }
    const currentLocation = {
      x: Math.floor(entity.location.x),
      y: Math.floor(entity.location.y),
      z: Math.floor(entity.location.z)
    };
    if (currentLocation.x !== startLocation.x || currentLocation.y !== startLocation.y || currentLocation.z !== startLocation.z) {
      callback(currentLocation, startLocation);
      system14.clearRun(interval);
    }
  }, tickInterval);
  return interval;
}
function runUntilMoved(entity, tickInterval = 1, callback) {
  const startLocation = {
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z)
  };
  const interval = system14.runInterval(() => {
    if (!entity?.isValid) {
      system14.clearRun(interval);
      return;
    }
    const currentLocation = {
      x: Math.floor(entity.location.x),
      y: Math.floor(entity.location.y),
      z: Math.floor(entity.location.z)
    };
    callback(currentLocation, startLocation);
    if (currentLocation.x !== startLocation.x || currentLocation.y !== startLocation.y || currentLocation.z !== startLocation.z) {
      system14.clearRun(interval);
    }
  }, tickInterval);
  return interval;
}
function getAccessoryItems(player) {
  const items = [];
  if (player.typeId !== "minecraft:player") return items;
  const equippable = player.getComponent("minecraft:equippable");
  const inventory = player.getComponent("minecraft:inventory")?.container;
  const offhand = equippable?.getEquipment(EquipmentSlot6.Offhand);
  if (offhand) items.push(offhand);
  for (const slot of [6, 7, 8]) {
    const item = inventory?.getItem(slot);
    if (item) items.push(item);
    if (!item) continue;
    const processed = /* @__PURE__ */ new Set();
    if (processed.has(item.typeId)) continue;
    processed.add(item.typeId);
  }
  return items;
}
function unstuckPlayer(player) {
  system14.run(() => {
    player.runCommand("inputpermission set @s movement enabled");
    player.runCommand("inputpermission set @s jump enabled");
    player.runCommand("inputpermission set @s camera enabled");
    player.removeTag("parried");
    player.runCommand("camera @s clear");
  });
}
export {
  addScore,
  applyDurabilityDamage2 as applyDurabilityDamage,
  detectMove2 as detectMove,
  getAccessoryItems,
  getScore,
  removeScore2 as removeScore,
  runUntilMoved,
  setScore,
  unstuckPlayer
};

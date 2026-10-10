// data/scripts/events/index.ts
import { world as world6, system as system9, ItemStack as ItemStack3, MolangVariableMap as MolangVariableMap3, EquipmentSlot as EquipmentSlot5, EntityDamageCause as EntityDamageCause3 } from "@minecraft/server";

// data/scripts/core/scoreboard.ts
import { world } from "@minecraft/server";
function addScore(target, objective, score) {
  try {
    world.scoreboard.getObjective(objective).addScore(target, score);
  } catch (e) {
    target.runCommand(`scoreboard players add "${target.name}" ${objective} ${score}`);
  }
}
function removeScore(target, objective, score) {
  try {
    world.scoreboard.getObjective(objective).addScore(target, -score);
  } catch (e) {
    target.runCommand(`scoreboard players remove "${target.name}" ${objective} ${score}`);
  }
}
function setScore(target, objective, score) {
  try {
    world.scoreboard.getObjective(objective).setScore(target, score);
  } catch (e) {
    target.runCommand(`scoreboard players set "${target.name}" ${objective} ${score}`);
  }
}
function getScore(target, objective) {
  try {
    return world.scoreboard.getObjective(objective).getScore(target) ?? 0;
  } catch (error) {
    return 0;
  }
}

// data/scripts/core/items.ts
function applyDurabilityDamage(source, options = {}) {
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

// data/scripts/core/player.ts
import { system, EquipmentSlot } from "@minecraft/server";
function runUntilMoved(entity, tickInterval = 1, callback) {
  const startLocation = {
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z)
  };
  const interval = system.runInterval(() => {
    if (!entity?.isValid) {
      system.clearRun(interval);
      return;
    }
    const currentLocation = {
      x: Math.floor(entity.location.x),
      y: Math.floor(entity.location.y),
      z: Math.floor(entity.location.z)
    };
    callback(currentLocation, startLocation);
    if (currentLocation.x !== startLocation.x || currentLocation.y !== startLocation.y || currentLocation.z !== startLocation.z) {
      system.clearRun(interval);
    }
  }, tickInterval);
  return interval;
}
var ACCESSORY_SLOTS = [6, 7, 8];
var NO_ACCESSORIES = [];
function getAccessoryItems(player) {
  if (player?.typeId !== "minecraft:player") return NO_ACCESSORIES;
  const equippable = player.getComponent("minecraft:equippable");
  const inventory = player.getComponent("minecraft:inventory")?.container;
  const items = [];
  const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
  if (offhand) items.push(offhand);
  for (const slot of ACCESSORY_SLOTS) {
    const item = inventory?.getItem(slot);
    if (item) items.push(item);
  }
  return items;
}
function unstuckPlayer(player) {
  system.run(() => {
    player.runCommand("inputpermission set @s movement enabled");
    player.runCommand("inputpermission set @s jump enabled");
    player.runCommand("inputpermission set @s camera enabled");
    player.removeTag("parried");
    player.runCommand("camera @s clear");
  });
}

// data/scripts/features/weapons/weaponHandler.ts
import { world as world2, system as system2, EquipmentSlot as EquipmentSlot2, EntityDamageCause } from "@minecraft/server";
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
      world2.scoreboard.getObjective(objective).addScore(target, score);
    } catch (e) {
      target.runCommand(`scoreboard players add "${target.name}" ${objective} ${score}`);
    }
  }
  static removeScore(target, objective, score) {
    try {
      world2.scoreboard.getObjective(objective).addScore(target, -score);
    } catch (e) {
      target.runCommand(`scoreboard players remove "${target.name}" ${objective} ${score}`);
    }
  }
  static setScore(target, objective, score) {
    try {
      world2.scoreboard.getObjective(objective).setScore(target, score);
    } catch (e) {
      target.runCommand(`scoreboard players set "${target.name}" ${objective} ${score}`);
    }
  }
  static getScore(target, objective) {
    try {
      return world2.scoreboard.getObjective(objective).getScore(target) || 0;
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
      system2.runTimeout(() => {
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
  system2.runTimeout(() => {
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
  const item = source?.getComponent("equippable")?.getEquipment(EquipmentSlot2.Mainhand);
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

// data/scripts/features/weapons/weaponSkills.ts
import { MolangVariableMap, system as system3, EntityDamageCause as EntityDamageCause2 } from "@minecraft/server";
function setAxisDelta(map, a, b) {
  map.setFloat("variable.x", b.x - a.x);
  map.setFloat("variable.y", b.y - a.y);
  map.setFloat("variable.z", b.z - a.z);
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
          src.dimension.playSound("random.explode", src.location);
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
          src.runCommand(`inputpermission set @a[r=28] movement enabled`);
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
        system3.runTimeout(() => {
          entity.runCommand('tellraw @s {"rawtext":[{"text":"Stunned effect is gone!"}]}');
          entity.runCommand("inputpermission set @s jump enabled");
        }, 100);
      }
      const entityLoc = entity.location;
      const pConfig = new MolangVariableMap();
      setAxisDelta(pConfig, playerLoc, entityLoc);
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
        system3.runTimeout(() => {
          entity.runCommand('tellraw @s {"rawtext":[{"text":"Stunned effect is gone!"}]}');
          entity.runCommand("inputpermission set @s jump enabled");
        }, 100);
      }
      const entityLoc = entity.location;
      const pConfig = new MolangVariableMap();
      setAxisDelta(pConfig, playerLoc, entityLoc);
      source.dimension.spawnParticle("ph:entanglement_lead_particle", source.location, pConfig);
    }
    system3.runTimeout(() => {
      source.runCommand("inputpermission set @s movement enabled");
    }, 20);
  }
});
var weaponSkills = [solarisverdantSkill, superchargedCopperAxeSkill, prismWeaverSkill, auricPhotonizerSkill, theBleedingSpireSkill];

// data/scripts/systems/accessories.ts
import { world as world3, system as system4, ItemStack } from "@minecraft/server";

// data/scripts/core/constants.ts
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

// data/scripts/systems/accessories.ts
var ARMOUR_SLOTS = ["Head", "Chest", "Legs", "Feet", "Offhand"];
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
      system4.run(() => {
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
      system4.run(() => {
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
      system4.run(() => {
        addScore(player, "auric_charge", 1);
        player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
      });
    },
    onHitEntity(player, event, hitTarget) {
      addScore(player, "auric_charge", 1);
      player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
    },
    onLoop(player, event) {
      system4.run(() => {
        addScore(player, "auric_charge", 1);
        player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
      });
    }
  },
  "ph:time_polarizer": {
    onLoop(player, event) {
      system4.run(() => {
        player.addEffect("speed", 100, {
          amplifier: 1,
          showParticles: false
        });
      });
    }
  },
  "ph:weeping_repair": {
    onLoop(player, event) {
      system4.run(() => {
        const inventory = player?.getComponent("minecraft:inventory")?.container;
        for (let i = 0; i < inventory.size; i++) {
          const item = inventory.getItem(i);
          if (!item) continue;
          const durability = item.getComponent("minecraft:durability");
          if (!durability) continue;
          if (durability.damage == 0) continue;
          durability.damage -= 1;
          inventory.setItem(i, item);
        }
        for (const slot of ARMOUR_SLOTS) {
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
function handleAccessory(player, trigger, event, hitTarget, items) {
  if (player?.typeId !== "minecraft:player") return;
  for (const item of items ?? getAccessoryItems(player)) {
    const handler = accessoryRegistry[item.typeId]?.[trigger];
    handler?.(player, event, hitTarget, item);
  }
}
system4.runInterval(() => {
  for (const player of world3.getPlayers()) {
    handleAccessory(player, "onLoop", void 0);
  }
}, 100);

// data/scripts/events/loader.ts
import { world as world4, system as system5, ItemStack as ItemStack2 } from "@minecraft/server";
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
    if (!world4.scoreboard.getObjective(objective)) {
      world4.scoreboard.addObjective(objective);
    }
  }
}
function loadPlayerScore(player) {
  for (const objective of objectives) {
    addScore(player, objective, 0);
    if (objective.includes("_atk")) {
      setScore(player, objective, 0);
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
  loadPlayerScore(player);
  if (player.getDynamicProperty("ph:guidebook_acquired") === void 0 || player.getDynamicProperty("ph:guidebook_acquired") === false) {
    player.dimension.spawnItem(new ItemStack2("ph:guidebook"), player.location);
    player.sendMessage("\xA7eWelcome to Phantasm! Pick up your Guidebook or use /guide to learn the features of this add-on.");
  }
  const playerInput = player.inputInfo.lastInputModeUsed;
  if (playerInput == "Touch") {
    player.sendMessage("\xA7eTouch controls? Joystick + Crosshair with the Action Button enabled makes weapons easier to use");
  }
  const properties = [
    "ph:dash_level",
    "ph:health_level",
    "ph:plunge_unlock",
    "ph:guidebook_acquired",
    "ph:dash_control",
    "ph:skill_switch_control"
  ];
  for (const property of properties) {
    if (player.getDynamicProperty(property) === void 0) {
      system5.runTimeout(() => {
        player.setDynamicProperty("ph:dash_level", 0);
        player.setDynamicProperty("ph:health_level", 0);
        player.setDynamicProperty("ph:plunge_unlock", false);
        player.setDynamicProperty("ph:guidebook_acquired", true);
        player.setDynamicProperty("ph:dash_control", 0);
        player.setDynamicProperty("ph:skill_switch_control", 0);
      }, 20);
    }
  }
  for (const objective of objectives) {
    addScore(player, objective, 0);
  }
}

// data/scripts/systems/damageIndicator.ts
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

// data/scripts/systems/combatDummy.ts
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
    interval: void 0,
    shownTag: ""
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
    const nameTag = `\xA7e-= Combat Dummy =-

\xA7fDPS \xA77: \xA7a${Math.round(stats.displayDps)}
\xA7fAverage DPS \xA77: \xA7a${Math.round(averageDps)}

\xA7fHighest Hit \xA77: \xA76${Math.round(stats.highestHit)}
\xA7fTotal Damage \xA77: \xA7c${Math.round(stats.totalDamage)}
\xA7fHits \xA77: \xA7b${stats.hits}`;
    if (stats.shownTag !== nameTag) {
      dummy.nameTag = nameTag;
      stats.shownTag = nameTag;
    }
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

// data/scripts/systems/lighting.ts
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
function clearPlacedLight(state) {
  const block = state.lastLightBlock;
  state.lastLightBlock = void 0;
  if (!block) return;
  try {
    if (block.isValid && block.typeId.startsWith("minecraft:light_block")) {
      block.setType("minecraft:air");
    }
  } catch (e) {
  }
}
function safeRemoveTag(player, tag) {
  if (!player?.isValid) return;
  try {
    if (player.hasTag(tag)) player.removeTag(tag);
  } catch (e) {
  }
}
function clearPlayerLighting(player) {
  let key;
  try {
    key = player?.id;
  } catch (e) {
    return;
  }
  const state = key !== void 0 ? lightingStates.get(key) : void 0;
  if (!state) {
    return;
  }
  if (state.interval !== -1) {
    try {
      system7.clearRun(state.interval);
    } catch (e) {
    }
  }
  if (key !== void 0) lightingStates.delete(key);
  if (!player?.isValid) return;
  safeRemoveTag(player, state.tag);
  clearPlacedLight(state);
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
  if (existing) {
    if (existing.interval !== -1) {
      system7.clearRun(existing.interval);
    }
    player.removeTag(existing.tag);
    clearPlacedLight(existing);
  }
  if (maxLight === -1) {
    lightingStates.delete(player.id);
    return;
  }
  const tag = `light_${maxLight}`;
  player.addTag(tag);
  const state = {
    interval: -1,
    lastLightBlock: void 0,
    maxLight,
    tag
  };
  lightingStates.set(player.id, state);
  const updateLight = () => {
    if (!player.isValid) return;
    try {
      const finalLocation = player.getHeadLocation();
      const block = player.dimension.getBlock(finalLocation);
      if (!block) return;
      if (!block.isAir && !block.isLiquid) return;
      clearPlacedLight(state);
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

// data/scripts/systems/movement.ts
import { world as world5, system as system8, EquipmentSlot as EquipmentSlot3 } from "@minecraft/server";
function dashRuntime(player, requireFalling = true) {
  const scoreboard_dash = world5.scoreboard.getObjective("dash_cd");
  if (!scoreboard_dash || (scoreboard_dash.getScore(player) ?? 0) > 0) return;
  if (player.getDynamicProperty("ph:dash_unlock") == 0) return;
  const dashLevel = player.getDynamicProperty("ph:dash_level");
  if (dashLevel == void 0 || dashLevel != 1 && dashLevel != 2) return;
  const equipmentTag = player?.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot3.Mainhand)?.getTags();
  if (equipmentTag?.includes("minecraft:is_sword") || equipmentTag?.includes("minecraft:is_tool")) return;
  const view = player.getViewDirection();
  if (dashLevel == 1) {
    player.applyKnockback({ x: view.x * 3, z: view.z * 3 }, 0.2);
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
    return;
  }
  player.applyKnockback({ x: view.x * 5, z: view.z * 5 }, 0.3);
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
      applyDurabilityDamage(player);
    }, 1);
  } else if (item.hasTag("minecraft:is_hoe")) {
    system8.runTimeout(() => {
      const isTillable = tags.includes("grass") || typeId === "minecraft:dirt_with_roots";
      const hasBlockAbove = block.above()?.typeId !== "minecraft:air";
      if (!isTillable || hasBlockAbove) return;
      player.dimension.playSound("use.gravel", block.center(), { volume: 1, pitch: 0.8 });
      applyDurabilityDamage(player);
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
      applyDurabilityDamage(player);
    });
  }
}
var PARRY_ITEMS = /* @__PURE__ */ new Set([
  "minecraft:wooden_sword",
  "minecraft:stone_sword",
  "minecraft:copper_sword",
  "minecraft:iron_sword",
  "minecraft:golden_sword",
  "minecraft:diamond_sword",
  "minecraft:netherite_sword",
  "ph:prismatic_sword"
]);
function parryRuntime(source, itemStack) {
  if (!itemStack?.typeId || !PARRY_ITEMS.has(itemStack.typeId)) return;
  if (source.hasTag("parried")) return;
  source.playAnimation("animation.player_extend.parry");
  source.dimension.spawnParticle("ph:parry_prepare", source.location);
  source.dimension.playSound("item.spear.use", source.location);
  source.addTag("parried");
  source.inputPermissions.setPermissionCategory(2, false);
  applyDurabilityDamage(source, { damage: 1 });
  system8.runTimeout(() => {
    if (source?.hasTag("parried")) source.removeTag("parried");
    source.inputPermissions.setPermissionCategory(2, true);
  }, 6);
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
      const currentItem = equippable?.getEquipment(EquipmentSlot3.Mainhand);
      const durability = currentItem?.getComponent("minecraft:durability");
      const experience = source.getTotalXp();
      if (!currentItem || !durability || durability.damage <= 0 || experience <= 0) {
        system8.clearRun(runBetterMending2);
        return;
      }
      const repairAmount = Math.min(durability.damage, 1);
      durability.damage -= repairAmount;
      equippable?.setEquipment(EquipmentSlot3.Mainhand, currentItem);
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
  if (!health) return;
  const playerHealthLevel = Number(player.getDynamicProperty("ph:health_level"));
  if (playerHealthLevel >= 1 && playerHealthLevel <= 3) {
    const maxAllowedHealth = 24 + playerHealthLevel * 12;
    const maxHealth = health.effectiveMax;
    if (maxHealth < maxAllowedHealth) {
      const wantedAmplifier = 3 * playerHealthLevel;
      const active = player.getEffect("health_boost");
      if (!active || active.amplifier !== wantedAmplifier) {
        player.runCommand(`effect @s health_boost infinite ${wantedAmplifier} true`);
      }
    }
  }
  const hunger = player.getComponent("minecraft:player.hunger");
  const saturation = player.getComponent("minecraft:player.saturation");
  if (!hunger || !saturation) return;
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

// data/scripts/systems/controls.ts
import { EquipmentSlot as EquipmentSlot4 } from "@minecraft/server";

// data/scripts/features/weapons/weapons.ts
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
            removeScore(src, "solaris_verdant_s3", 3);
          }
          if (getScore(src, "solaris_verdant_s1") > 0) {
            removeScore(src, "solaris_verdant_s1", 1);
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

// data/scripts/systems/controls.ts
var DASH_CONTROL = {
  DOUBLE_TAP_JUMP: 0,
  SPRINT_JUMP: 1,
  JUMP_SNEAK: 2
};
var SKILL_SWITCH_CONTROL = {
  SNEAK: 0,
  SNEAK_ATTACK: 1,
  DOUBLE_SNEAK: 2
};
var DASH_CONTROL_NAMES = [
  "Double-tap Jump",
  "Sprint + Jump",
  "Jump + Sneak"
];
var SKILL_SWITCH_CONTROL_NAMES = [
  "Sneak",
  "Sneak + Attack",
  "Double Sneak"
];
var DASH_CONTROL_HINTS = [
  "\xA7aDouble-tap Jump \xA77- Press Jump twice quickly while falling.",
  "\xA7aSprint + Jump \xA77- Press Jump while sprinting and falling.",
  "\xA7aJump + Sneak \xA77- Press Jump, then Sneak while in midair."
];
var SKILL_SWITCH_CONTROL_HINTS = [
  "\xA7aSneak \xA77- Press Sneak while holding a Legendary weapon.",
  "\xA7aSneak + Attack \xA77- Press Sneak, then Attack while holding a Legendary weapon.",
  "\xA7aDouble Sneak \xA77- Press Sneak twice quickly while holding a Legendary weapon."
];
var DOUBLE_TAP_WINDOW = 300;
var COMBO_WINDOW = 500;
var states = /* @__PURE__ */ new Map();
var switcherByItemId = new Map(
  switcherSkills.map((switcher) => [switcher.itemId, switcher])
);
function elapsed(now, then) {
  const gap = now - then;
  return gap < 0 ? Infinity : gap;
}
function getState(player) {
  let state = states.get(player.id);
  if (!state) {
    state = {
      dash: readControl(player, "ph:dash_control", DASH_CONTROL_NAMES.length),
      skill: readControl(player, "ph:skill_switch_control", SKILL_SWITCH_CONTROL_NAMES.length),
      jumpAt: -Infinity,
      sneakAt: -Infinity
    };
    states.set(player.id, state);
  }
  return state;
}
function readControl(player, property, length) {
  const stored = Number(player.getDynamicProperty(property));
  return stored >= 0 && stored < length ? stored : 0;
}
function getDashControl(player) {
  return getState(player).dash;
}
function setDashControl(player, control) {
  player.setDynamicProperty("ph:dash_control", control);
  getState(player).dash = control;
}
function getSkillSwitchControl(player) {
  return getState(player).skill;
}
function setSkillSwitchControl(player, control) {
  player.setDynamicProperty("ph:skill_switch_control", control);
  getState(player).skill = control;
}
function clearControlState(player) {
  states.delete(player.id);
}
function switchSkill(player, requireSneaking = true) {
  if (requireSneaking && !player.isSneaking) return false;
  const switcher = switcherByItemId.get(
    player.getComponent("equippable")?.getEquipment(EquipmentSlot4.Mainhand)?.typeId ?? ""
  );
  if (!switcher) return false;
  switcher.switchSkill(player);
  return true;
}
function onControlButtonInput(player, button) {
  if (button != "Jump" && button != "Sneak") return;
  const now = Date.now();
  const state = getState(player);
  if (button == "Jump") {
    const doubleTapped2 = elapsed(now, state.jumpAt) <= DOUBLE_TAP_WINDOW;
    state.jumpAt = now;
    if (state.dash == DASH_CONTROL.SPRINT_JUMP) {
      if (player.isSprinting) dashRuntime(player);
    } else if (state.dash == DASH_CONTROL.DOUBLE_TAP_JUMP && doubleTapped2) {
      dashRuntime(player);
    }
    return;
  }
  const doubleTapped = elapsed(now, state.sneakAt) <= DOUBLE_TAP_WINDOW;
  state.sneakAt = now;
  if (state.dash == DASH_CONTROL.JUMP_SNEAK && elapsed(now, state.jumpAt) <= COMBO_WINDOW) {
    state.jumpAt = -Infinity;
    dashRuntime(player, false);
    return;
  }
  if (state.skill == SKILL_SWITCH_CONTROL.SNEAK) {
    switchSkill(player);
    return;
  }
  if (state.skill == SKILL_SWITCH_CONTROL.DOUBLE_SNEAK && doubleTapped) {
    state.sneakAt = -Infinity;
    switchSkill(player, false);
  }
}
function onControlSwingInput(player, swingSource) {
  if (swingSource != "Mine" && swingSource != "Attack") return;
  const state = getState(player);
  if (state.skill != SKILL_SWITCH_CONTROL.SNEAK_ATTACK) return;
  if (elapsed(Date.now(), state.sneakAt) > COMBO_WINDOW) return;
  state.sneakAt = -Infinity;
  switchSkill(player, false);
}

// data/scripts/events/index.ts
world6.beforeEvents.entityHurt.subscribe((acc) => {
  const hurtEntity = acc.hurtEntity;
  if (hurtEntity?.typeId !== "minecraft:player") return;
  const damagingEntity = acc.damageSource.damagingEntity;
  const player = hurtEntity;
  const accessories2 = getAccessoryItems(player);
  handleAccessory(player, "onHurt", acc, void 0, accessories2);
  if (hurtEntity.hasTag("parried")) {
    acc.cancel = true;
    system9.run(() => {
      const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot5.Mainhand);
      const head = hurtEntity.getHeadLocation();
      const view = hurtEntity.getViewDirection();
      hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
      hurtEntity.dimension.spawnParticle(
        "ph:parry_invert_flash",
        {
          x: head.x + view.x,
          y: head.y + view.y,
          z: head.z + view.z
        }
      );
      hurtEntity.runCommand("camerashake add @s 1 0.1 positional");
      hurtEntity.dimension.playSound("weapon_slash.slash_clash", hurtEntity.location);
      hurtEntity.removeTag("parried");
      if (mainItem?.typeId === "ph:seiketsu") {
        applyDurabilityDamage(hurtEntity, { damage: 1 });
        return;
      }
      applyDurabilityDamage(hurtEntity, { damage: 30 });
    });
  }
  if (accessories2.some((item) => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot5.Mainhand)?.typeId === "ph:the_bleeding_spire") {
    if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
  }
});
world6.beforeEvents.playerBreakBlock.subscribe((acc) => {
  const block = acc.block;
  const player = acc.player;
  handleAccessory(player, "onBreakBlock", acc, block);
});
world6.beforeEvents.entityHurt.subscribe((data) => {
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
world6.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (!e.block.typeId.includes("ore")) return;
  if (Math.floor(Math.random() * 100) !== 1) return;
  if (e.player.getGameMode() === "Creative") return;
  system9.run(() => {
    e.dimension.spawnItem(new ItemStack3("ph:rust_coin", 1), e.block.location);
  });
});
world6.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (e.block.typeId !== "minecraft:prismarine") return;
  const player = e.player;
  const itemStack = e.itemStack;
  const block = e.block;
  const dimension = e.dimension;
  if (player.getGameMode() === "Creative") return;
  if (itemStack?.getComponent("enchantable")?.getEnchantment("silk_touch")) return;
  if (!itemStack?.getTags().includes("minecraft:is_pickaxe")) return;
  e.cancel = true;
  system9.run(() => {
    dimension.setBlockType(block.location, "minecraft:air");
    dimension.spawnItem(new ItemStack3("minecraft:prismarine_shard", Math.floor(Math.random() * 3 + 4)), block.location);
  });
});
world6.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, itemStack: item, block } = event;
  vanillaBlockInteractFix(player, item, block);
});
var crystallDrops = {
  "ph:small_crystall_bud": "ph:small_crystall_bud_item",
  "ph:large_crystall_bud": "ph:large_crystall_bud_item",
  "ph:crystall_cluster": "ph:crystall_cluster_item"
};
var crystallDropIds = new Set(Object.keys(crystallDrops));
var faceOffsets = [
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 }
];
function getCrystallSupport(block) {
  let face;
  try {
    face = block.permutation.getState("minecraft:block_face");
  } catch {
    return void 0;
  }
  switch (face) {
    case "up":
      return block.below();
    case "down":
      return block.above();
    // block_face = face support yang diklik, jadi support ada di arah lawan
    case "north":
      return block.south();
    case "south":
      return block.north();
    case "east":
      return block.west();
    case "west":
      return block.east();
    default:
      return void 0;
  }
}
function popCrystallIfFloating(block, drop = true) {
  if (!block?.isValid) return false;
  const typeId = block.typeId;
  if (!crystallDropIds.has(typeId)) return false;
  const dropId = crystallDrops[typeId];
  const support = getCrystallSupport(block);
  if (!support) return false;
  if (!support.isAir && !support.isLiquid) return false;
  const loc = block.location;
  const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
  block.dimension.setBlockType(loc, "minecraft:air");
  if (drop) {
    try {
      block.dimension.spawnItem(new ItemStack3(dropId, 1), center);
    } catch (err) {
      console.warn(`[ph] crystall drop failed for ${typeId}: ${err}`);
    }
  }
  try {
    block.dimension.playSound("dig.amethyst", center);
  } catch {
  }
  return true;
}
world6.afterEvents.playerBreakBlock.subscribe((e) => {
  const loc = e.block.location;
  const dimension = e.dimension;
  let drop = true;
  try {
    drop = e.player?.getGameMode?.() !== "Creative";
  } catch {
  }
  system9.run(() => {
    for (const off of faceOffsets) {
      try {
        const neighbor = dimension.getBlock({ x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z });
        if (neighbor) popCrystallIfFloating(neighbor, drop);
      } catch {
      }
    }
  });
});
world6.afterEvents.entityHitEntity.subscribe((acc) => {
  const damagingEntity = acc.damagingEntity;
  const hitEntity = acc.hitEntity;
  handleAccessory(damagingEntity, "onHitEntity", acc, hitEntity);
});
world6.afterEvents.entityHurt.subscribe(onDamageIndicator);
world6.afterEvents.entityHurt.subscribe(onDummyHurt);
world6.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack }) => {
  onDynamicLighting(player);
  const container = player.getComponent("inventory")?.container;
  if (container) {
    const filled = [];
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      filled.push({ slot: i, item });
    }
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
          container.setItem(slotB.slot, void 0);
        } else {
          itemB.amount -= moveAmount;
          container.setItem(slotB.slot, itemB);
        }
      }
    }
  }
  healthBarRuntime(player, "inventoryItemChanged", beforeItemStack, itemStack);
});
world6.afterEvents.worldLoad.subscribe(() => {
  loadScoreboards();
});
world6.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  onPlayerSpawn(player, initialSpawn);
  onDynamicLighting(player);
});
world6.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
  onControlSwingInput(player, swingSource);
  for (const weapon of weapons) {
    if (heldItemStack?.typeId === weapon.itemId) {
      if (swingSource != "Mine" && swingSource != "Attack") return;
      weapon.handleAttack(player);
    }
  }
});
world6.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
  if (newButtonState != "Pressed") return;
  if (button == "Sneak") {
    windPlungeRuntime(source);
  }
  onControlButtonInput(source, button);
});
world6.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!itemStack) return;
  parryRuntime(source, itemStack);
  startBetterMending(source, itemStack);
  for (const skill of weaponSkills) {
    if (itemStack.typeId === skill.itemId) {
      skill.useSkill(source);
    }
  }
});
world6.afterEvents.entityDie.subscribe(({ damageSource, deadEntity }) => {
  const killer = damageSource?.damagingEntity;
  if (deadEntity?.typeId === "minecraft:player") {
    try {
      clearPlayerLighting(deadEntity);
    } catch (e) {
    }
  }
  if (!killer?.isValid) return;
  const mainhand = killer?.getComponent("equippable")?.getEquipment(EquipmentSlot5.Mainhand);
  if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
    addScore(killer, "auric_charge", 4);
    deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
  }
});
world6.afterEvents.entityHealthChanged.subscribe(({ entity }) => {
  if (!entity.isValid) return;
  healthBarRuntime(entity, "healthChanged");
});
world6.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  healthBarRuntime(player, "dimensionChanged");
});
world6.afterEvents.playerGameModeChange.subscribe(({ player, toGameMode }) => {
  healthBarRuntime(player, "gamemodeChanged");
});
var animatedTpSpeeds = new Map(
  specifiedFamilityAndSpeed.map((data) => [data.type_family, data.speed])
);
world6.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  if (cause != "Spawned") return;
  if (!entity.isValid) return;
  const family = entity?.getComponent("minecraft:type_family")?.getTypeFamilies();
  if (!family) return;
  let speed;
  for (const typeFamily of family) {
    const matched = animatedTpSpeeds.get(typeFamily);
    if (matched !== void 0) {
      speed = matched;
      break;
    }
  }
  if (speed === void 0) return;
  const dir = entity.getViewDirection();
  const dx = dir.x;
  const dy = dir.y;
  const dz = dir.z;
  const interval = system9.runInterval(() => {
    if (!entity?.isValid) {
      system9.clearRun(interval);
      return;
    }
    entity?.teleport({
      x: entity.location.x + dx * speed,
      y: entity.location.y + dy * speed,
      z: entity.location.z + dz * speed
    });
  }, 1);
});
world6.beforeEvents.playerLeave.subscribe(({ player }) => {
  clearPlayerLighting(player);
  clearControlState(player);
});
system9.runInterval(() => {
  for (const player of world6.getPlayers()) {
    javaSaturationRegen(player);
  }
}, 6);
system9.runInterval(() => {
  for (const player of world6.getPlayers()) {
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
            let block;
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
    } catch {
    }
  }
}, 40);
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
function beginCollisionCheck(dasher, duration, damage, collisionRadius, spareFamily) {
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
      if (spareFamily && target.getComponent("minecraft:type_family")?.getTypeFamilies()?.includes(spareFamily)) continue;
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

// data/scripts/features/blocks/customComponents.ts
import { system as system12, CommandPermissionLevel, CustomCommandStatus, MolangVariableMap as MolangVariableMap4, ItemStack as ItemStack4 } from "@minecraft/server";

// data/scripts/ui/forms/skillUnlock.ts
import { system as system10 } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
function skillUnlock(player) {
  let dashLevelStatus = player.getDynamicProperty("ph:dash_level") ?? 0;
  let healthLevelStatus = player.getDynamicProperty("ph:health_level") ?? 0;
  let plungeUnlockStatus = player.getDynamicProperty("ph:plunge_unlock") == true ? "\xA72UNLOCKED" : "\xA74LOCKED";
  const form = new ActionFormData().title("Skill Unlocking").body("Spend 30 experience levels to unlock one of these skills").button(`Passive Dash
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
  const form = new MessageFormData().title("Confirm Selection").body(`Are you sure you want to unlock Passive Dash? Press Jump twice to use it.

Current Level : ${exp}
Required Level : 30

You can change this control later with /setting.`).button1("Confirm").button2("Cancel").show(player).then((r) => {
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
  const form = new MessageFormData().title("Confirm Selection").body(`Are you sure you want to upgrade your max health? +16 HP at level 1, +12 HP at later levels.

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
  const form = new MessageFormData().title("Confirm Selection").body(`Are you sure you want to unlock Wind Plunge? Press Sneak while falling more than 10 blocks to use it.

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

// data/scripts/ui/forms/settingsForm.ts
import { system as system11 } from "@minecraft/server";
import { ActionFormData as ActionFormData2 } from "@minecraft/server-ui";
function openSettings(player) {
  const dashControl = getDashControl(player);
  const skillSwitchControl = getSkillSwitchControl(player);
  const form = new ActionFormData2().title("Phantasm Settings").body("Pick the controls you want for Phantasm mechanics. Every setting is saved to you only.").button(`Passive Dash
\xA77Currently: \xA7f${DASH_CONTROL_NAMES[dashControl]}`).button(`Legendary Weapon Skills
\xA77Currently: \xA7f${SKILL_SWITCH_CONTROL_NAMES[skillSwitchControl]}`).button("Reset To Defaults").button("Close").show(player).then((r) => {
    if (r.cancelationReason == "UserBusy") system11.run(() => openSettings(player));
    if (r.selection == 0) dashControlMenu(player);
    if (r.selection == 1) skillSwitchControlMenu(player);
    if (r.selection == 2) resetSettings(player);
  });
}
function dashControlMenu(player) {
  const current = getDashControl(player);
  const form = new ActionFormData2().title("Passive Dash Control").body(DASH_CONTROL_HINTS.join("\n\n"));
  DASH_CONTROL_NAMES.forEach((name, index) => {
    form.button(index == current ? `\xA7a${name}
\xA77Currently selected` : name);
  });
  form.button("\xA7cBack").show(player).then((r) => {
    if (r.canceled) return openSettings(player);
    if (r.selection == DASH_CONTROL_NAMES.length) return openSettings(player);
    setDashControl(player, r.selection);
    player.playSound("random.levelup");
    player.sendMessage(`\xA7aPassive Dash control set to \xA7f${DASH_CONTROL_NAMES[r.selection]}`);
    openSettings(player);
  });
}
function skillSwitchControlMenu(player) {
  const current = getSkillSwitchControl(player);
  const form = new ActionFormData2().title("Skill Switch Control").body(SKILL_SWITCH_CONTROL_HINTS.join("\n\n"));
  SKILL_SWITCH_CONTROL_NAMES.forEach((name, index) => {
    form.button(index == current ? `\xA7a${name}
\xA77Currently selected` : name);
  });
  form.button("\xA7cBack").show(player).then((r) => {
    if (r.canceled) return openSettings(player);
    if (r.selection == SKILL_SWITCH_CONTROL_NAMES.length) return openSettings(player);
    setSkillSwitchControl(player, r.selection);
    player.playSound("random.levelup");
    player.sendMessage(`\xA7aSkill switch control set to \xA7f${SKILL_SWITCH_CONTROL_NAMES[r.selection]}`);
    openSettings(player);
  });
}
function resetSettings(player) {
  setDashControl(player, 0);
  setSkillSwitchControl(player, 0);
  player.playSound("random.levelup");
  player.sendMessage("\xA7aSettings reset to defaults: \xA7fDouble-tap Jump\xA77 and \xA7fSneak");
  openSettings(player);
}

// data/scripts/ui/guide/main_guide.ts
import { ActionFormData as ActionFormData10 } from "@minecraft/server-ui";

// data/scripts/ui/guide/weapon_guide.ts
import { ActionFormData as ActionFormData3 } from "@minecraft/server-ui";

// data/scripts/ui/guide/guidebookTitle.ts
var GUIDEBOOK_TITLE_MARK = "\xA7r\xA70\xA77";
function guideTitle(title) {
  return `${title}${GUIDEBOOK_TITLE_MARK}`;
}

// data/scripts/ui/guide/weapon_guide.ts
function guideWeapons(player) {
  const form = new ActionFormData3().title(guideTitle("Weapons")).body("Weapons come in many variants, from Common up to Legendary.").button("\xA73Prismatic Tools", "textures/items/prismatic_sword").button("\xA75Charged Copper Axe", "textures/items/weapons/charged_copper_axe").button("\xA75Cruxshaper", "textures/items/weapons/cruxshaper").button("\xA75Nature Staff", "textures/items/weapons/nature_staff").button("\xA75Peacemaker Oath", "textures/items/weapons/peacemaker_oath").button("\xA75Seiketsu", "textures/items/weapons/seiketsu").button("\xA75Spectric Bow", "textures/items/weapons/spectric_bow").button("\xA75Thunder Gale", "textures/items/weapons/thunder_gale").button("\xA7pAnimitta", "textures/items/weapons/solaris_verdant").button("\xA7pAuric Photonizer", "textures/items/weapons/auric_photonizer").button("\xA7pPrism Weaver", "textures/items/weapons/prism_weaver").button("\xA7pSupercharged Copper Axe", "textures/items/weapons/supercharged_copper_axe").button("\xA7pThe Bleeding Spire", "textures/items/weapons/the_bleeding_spire").button("Back").show(player).then((r) => {
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
  const form = new ActionFormData3().title(guideTitle("Prismatic Tools")).label("Prismatic is a tier beyond Netherite: slightly faster, with twice the durability.").label("The sword's special attack pierces through an area, but it cannot crit.").label("The spear can dismount enemies with a sprint-jump charge attack.").label("Craft Prismatic Tools with Prismatic Ingots and Netherite Tools.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function chargedCopperAxe(player) {
  const form = new ActionFormData3().title(guideTitle("Charged Copper Axe")).label("This Epic axe hits opponents with Lightning attacks. Collect charges before combat.").label("At full charge, hitting an enemy casts Lightning at them.").label("Killing an enemy casts another Lightning strike and grants 4 Auric Charges.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function cruxshaper(player) {
  const form = new ActionFormData3().title(guideTitle("Cruxshaper")).label("This mace works like a vanilla mace, plus skills.").label("Look at the sky to use the skill. You jump high, then plunge down for up to 50 damage.").label("Craft it like a mace, with a Blaze Rod added to the recipe.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function natureStaff(player) {
  const form = new ActionFormData3().title(guideTitle("Nature Staff")).label("This staff casts the same magic attacks as the Soul of Nature boss.").label("Interact to cast the first attack. Sneak-interact for the second attack, which has a slightly longer cooldown.").label("Craft it with Prismatic Ingots, a Stick, and a Nautilus Shell.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function peacemakerOath(player) {
  const form = new ActionFormData3().title(guideTitle("Peacemaker Oath")).label("A pistol that fires Auric Charges. High damage and high attack speed.").label("It has no unique skill or passive because it is already strong, especially with the Auric Proton accessory.").label("Find it in Trial Chambers, same as the Auric Proton.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function seiketsu2(player) {
  const form = new ActionFormData3().title(guideTitle("Seiketsu")).label("A katana with Legendary-style attack patterns. Easier to use than any Epic weapon.").label("Its parry window is longer than a regular sword's.").label("Craft it with a Prismatic Sword, a Blaze Rod, and a Netherite Sword.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function spectricBow(player) {
  const form = new ActionFormData3().title(guideTitle("Spectric Bow")).label("A bow that beats every Epic weapon in damage and range. Arrow speed scales with charge stage, up to 70 damage.").label("Works with normal arrows, but best with Spectral Arrows, crafted from 4 Glowstone Dust and 1 Arrow.").label("Craft it with Iron Ingot, Whole Glowstone, and String.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function thunderGale(player) {
  const form = new ActionFormData3().title(guideTitle("Thunder Gale")).label("A classic but powerful spear, and the strongest of its kind: 14 base damage, a 1.6x charge attack multiplier, and a very fast cooldown.").label("It also grants bonus speed while equipped.").label("Craft it with a Prismatic Spear, a Nether Star, and a Netherite Spear.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function animitta(player) {
  const form = new ActionFormData3().title(guideTitle("Animitta")).label("One of the first Legendary weapons you can get, alongside the Prism Weaver. It fights at close, medium, and long range, with slightly lower damage than other Legendary weapons. It has 3 skills:").label("Animirra :\nSummons 4 stars that attack nearby entities.").label("Solaris Slash :\nFires 3 Solaris Slashes spreading outward.").label("Natura Vulkan :\nSummons 8 special stars that explode on enemies with small but powerful blasts, alongside a Meteor Rain.").label("Drops from the Soul of Nature at 50% chance, alternating with the Prism Weaver (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function prismWeaver2(player) {
  const form = new ActionFormData3().title(guideTitle("Prism Weaver")).label("One of the first Legendary weapons you can get, alongside the Animitta. It fights at long range with lower damage than other Legendary weapons. It has 3 skills:").label("Bubble Barrage :\nFires a burst of bubble projectiles in one attack.").label("Prism Wave Wall :\nCasts a Prism Wall that deals massive damage on touch.").label("Vortex Prism :\nPulls targets in a large radius toward you, then repels them with massive damage.").label("Drops from the Soul of Nature at 50% chance, alternating with the Animitta (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function theBleedingSpire2(player) {
  const form = new ActionFormData3().title(guideTitle("The Bleeding Spire")).label("This Legendary spear fights polearm-style at close range. It is a support weapon, so it holds back on damage. It has 3 skills:").label("Carnage :\nDash forward. Mobs you collide with take damage.").label("Entanglement :\nLeash your target with Crimson Roots, stunning it for 5 seconds and restoring 12 health.").label("Crimson Ray :\nLike Entanglement, but fires many Crimson Rays in scattered directions.").label("Drops from Punicea.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function superchargedCopperAxe2(player) {
  const form = new ActionFormData3().title(guideTitle("Supercharged Copper Axe")).label("This Legendary axe, forged from high-grade Copper and Auric material, hits very hard but swings very slowly, with lightning bolts on a completed attack pattern. It has 4 skills:").label("Charge :\nGrants 5 Charges for your other skills and briefly boosts your damage.").label("Powered Leap :\nCreates an explosion that damages everything except you and leaps you toward your target. Grants 1 Charge.").label("Discharge :\nSpends your charges to fire an Auric Laser forward. Direct hits deal heavy damage.").label("Ultimate Discharge :\nA stronger Discharge, combined with medium-range lightning covering close and medium range.").label("Drops from the Auric Automaton at 50% chance, alternating with the Auric Photonizer (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function auricPhotonizer2(player) {
  const form = new ActionFormData3().title(guideTitle("Auric Photonizer")).label("This Legendary sword, forged from high-grade Copper and Auric material, swings very fast. It has 4 skills:").label("Stab :\nDash-stab forward. Mobs you collide with take heavy damage.").label("Powered Leap :\nLeap backward to dodge, leaving an explosion after a short delay that deals heavy damage.").label("Blade Barrage :\nSummons 5 Auric Double Blades that fly toward you, heavily damaging anything else in the way.").label("Ethereal Blade :\nSummons 3 waves of Ethereal Swords stabbing in random directions for heavy damage. You can keep moving while it fires.").label("Drops from the Auric Automaton at 50% chance, alternating with the Supercharged Copper Axe (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}

// data/scripts/ui/guide/mechanic_guide.ts
import { ActionFormData as ActionFormData4 } from "@minecraft/server-ui";
function mechanicsList(player) {
  const form = new ActionFormData4().title(guideTitle("Mechanics")).body("The mechanics in Phantasm, from simplest to most complex.").button("Skill Unlock").button("Passive Dash").button("Extra Health").button("Wind Plunge").button("Dynamic Light").button("Legendary Items").button("Upgrading Items").button("Better Mending").button("Accessories").button("Auric Charges").button("Back").show(player).then((r) => {
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
  const form = new ActionFormData4().title(guideTitle("Unlock Skill")).header("Skill Unlocking").divider().label("Skill Unlock upgrades your stats as you progress. Unlock the skills listed in the /unlockskill command!").label("3 skills to unlock :\n- Passive Dash\n- Extra Health\n- Wind Plunge\nEach costs 30 experience levels per upgrade, up to its own max level in the unlock UI.").divider().button("Unlock Skill").button("Back").show(player).then((r) => {
    if (r.selection == 1 || r.canceled) mechanicsList(player);
    if (r.selection == 0) skillUnlock(player);
  });
}
function passiveDash(player) {
  const form = new ActionFormData4().title(guideTitle("Passive Dash")).header("Passive Dash").divider().label("This skill lets you dash forward with no dash item. Useful for mobility and some combat styles.").label("Press Jump while falling to dash. Use /setting if you want a different control (double-tap Jump, Sprint + Jump, or Jump + Sneak).").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function extraHealth(player) {
  const form = new ActionFormData4().title(guideTitle("Extra Health")).header("Extra Health").divider().label("This passive grants bonus health: +16 at level 1, +12 at level 2 and above. Essential for tanking bosses and other players.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function windPlunge(player) {
  const form = new ActionFormData4().title(guideTitle("Wind Plunging")).header("Wind Plunge Attack").divider().label("This skill lets you plunge down fast when falling a long distance. It greatly reduces fall damage and explodes on landing, damaging everything nearby.").label("Sneak while falling more than 10 blocks to plunge.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function dynamicLighting(player) {
  const form = new ActionFormData4().title(guideTitle("Dynamic Light")).header("Phantasm Light System").divider().label("Other add-ons have this mechanic, but here you do not need to hold the light item.").label("Put a light item in a hotbar slot with a + sign (accessory slot).").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function legendaryItems(player) {
  const form = new ActionFormData4().title(guideTitle("Legendary Items")).header("Legendary Mechanics").divider().label("Legendary weapons and items can be complicated. Here is how to use them:").label("Attack: left-click (or tap Attack).\nSkill: Interact / right-click.\nSwitch skill: Sneak.").label("Use /setting to change how you switch skill: Sneak, Sneak + Attack, or Double Sneak.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function upgradingItems(player) {
  const form = new ActionFormData4().title(guideTitle("Item Upgrade")).header("Upgrading Item").divider().label("Some items upgrade your dash, health, or damage, permanently or temporarily.").label("Only 3 items do this :\n- Auric Star (permanent)\n- Suspicious Mushroom (temporary)\n- Supercharged Copper Axe Charge skill (temporary)").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function betterMending(player) {
  const form = new ActionFormData4().title(guideTitle("Better Mending")).header("Mending QoL").divider().label("Mending still repairs with EXP orbs, but you can also spend your stored levels to repair items directly.").label("Sneak and use the item to spend levels on repairs until it is full or you run out of EXP. Switch items to cancel.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function accessories(player) {
  const form = new ActionFormData4().title(guideTitle("Accessories")).header("Accessories").divider().label("Accessories make you much stronger at the cost of up to 4 inventory slots. Combine them into whatever build you like.").label("Put accessories in the offhand slot or hotbar slots with a + sign.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function auricCharges(player) {
  const form = new ActionFormData4().title(guideTitle("Auric Charge")).header("Auric Charge").divider().label("Auric Charges are universal ammo for some items. Collect them with the Charged Copper Axe, Auric Stock Battery, or Auric Proton.").label("Spend them by using an item that costs Auric Charges.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}

// data/scripts/ui/guide/item_guide.ts
import { ActionFormData as ActionFormData5 } from "@minecraft/server-ui";
function guideItems(player) {
  const form = new ActionFormData5().title(guideTitle("Items")).label("Usable items. Anything not listed here is recipe-only.").button("Auric Communicator", "textures/items/auric_communicator").button("Auric Stock Battery", "textures/items/auric_stock_battery").button("Combat Dummy", "textures/items/dummy").button("Flow Channeler", "textures/items/flow_channeler").button("Hell Charge", "textures/items/hell_charge").button("Suspicious Mushroom", "textures/items/suspicious_mushroom").button("Back").show(player).then((r) => {
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
  const form = new ActionFormData5().title(guideTitle("Auric Communicator")).label("The Auric Communicator calls an Orbital Strike using your Auric Charges.").label("It has 2 modes: Stab Shot for a direct strike, Nuke Shot for a spread strike.").label("Interact to fire. Sneak-interact to switch modes.").label("Drops from the Auric Automaton (Copper Mechanical Array).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function auricStockBattery(player) {
  const form = new ActionFormData5().title(guideTitle("Auric Stock Battery")).label("The Auric Stock Battery recharges your Auric Charges in one click.").label("2 uses. Each restores up to 100 Auric Charges.").label("Interact to use it. When empty, recharge it at an Auric Battery Recharge Station.").label("Craft it with Auric Stars or an Ancient Copper Core plus Copper Blocks. Those come from Trial Chambers. It also drops from the Auric Automaton.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function combatDummy(player) {
  const form = new ActionFormData5().title(guideTitle("Combat Dummy")).label("The Combat Dummy tests your combat skills and max damage output.").label("Place it down and hit it with your best weapon.").label("To pick it up, interact with it while sneaking.").label("This item can be crafted with 2 Planks, 2 Sticks, and 3 Smooth Stone Slabs.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function flowChanneler(player) {
  const form = new ActionFormData5().title(guideTitle("Flow Channeler")).label("The Flow Channeler is Active Support. It dashes you forward, away from enemies.").label("Interact to dash. Enchantable with Mending and Unbreaking.").label("Drops from the Sealed Soul of Nature.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function hellCharge(player) {
  const form = new ActionFormData5().title(guideTitle("Hell Charge")).label("Hell Charge is Active Support. It boosts your mobility.").label("Interact for a mobility boost. Spam interact to fly or fall slowly. Tune your controls to get the most out of it.").label("But it is fragile: long spam breaks it. Enchant with Mending and Unbreaking to make it last.").label("Craft it with Magma Cream and 4 Blaze Powder.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function suspiciousMushroom(player) {
  const form = new ActionFormData5().title(guideTitle("Suspicious Mushroom")).label("The Suspicious Mushroom is Active Support. It slightly boosts all your stats.").label("Eat it for 10 minutes of boosted stats, no side effects.").label("But remember, this item is hard to get, use wisely.").label("Drops from Punicea, the Crimson Eye.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}

// data/scripts/ui/guide/block_guide.ts
import { ActionFormData as ActionFormData6 } from "@minecraft/server-ui";
function guideBlocks(player) {
  const form = new ActionFormData6().title(guideTitle("Blocks")).label("Every functional block in the add-on.").button("Ancient Copper Core").button("Auric Recharge Station").button("Nature Soul Altar").button("Suspicious Crimson Eye").button("Back").show(player).then((r) => {
    if (r.selection === 4 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) ancientCopperCore(player);
    if (r.selection === 1) auricRechargeStation(player);
    if (r.selection === 2) natureSoulAltar(player);
    if (r.selection === 3) suspiciousCrimsonEye(player);
  });
}
function ancientCopperCore(player) {
  const form = new ActionFormData6().title(guideTitle("Ancient Copper Core")).label("The Ancient Copper Core holds a large charge of Auric power, and needs specific items to fully activate.").label("Interact with it to create another battery. Fill the scattered batteries with the required item, interact with the core again, and the boss appears: Auric Automaton, the Copper Mechanical Array.").label("Found in Trial Chambers.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function auricRechargeStation(player) {
  const form = new ActionFormData6().title(guideTitle("Auric Battery Recharge Station")).label("The Auric Battery Recharge Station recharges Auric Batteries placed inside it. Interact while a battery is inside to charge it slowly. A full charge takes 100 seconds no matter how many batteries are inside, so load it up.").label("It cannot be broken while batteries are inside.").label("Craft it with Ancient Copper Core, Copper Block, and Auric Charging Module.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function natureSoulAltar(player) {
  const form = new ActionFormData6().title(guideTitle("Nature Soul Altar")).label("The Nature Soul Altar generates with the underwater Prismarine Arena.").label("Give it a Prismarine Shard to start the fight.").label("Only found in the Prismarine Arena.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function suspiciousCrimsonEye(player) {
  const form = new ActionFormData6().title(guideTitle("Suspicious Crimson Eye")).label("The Suspicious Crimson Eye generates with the Crimson Overgrowth in the Crimson Forest.").label("Give it 5 Essence of Crimson to start the fight.").label("Only found in the Crimson Overgrowth.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}

// data/scripts/ui/guide/boss_guide.ts
import { ActionFormData as ActionFormData7 } from "@minecraft/server-ui";
function guideBosses(player) {
  const form = new ActionFormData7().title(guideTitle("Bosses")).label("Every boss in the add-on, in progression order.").button("Soul of Nature").button("Punicea - A Crimson Eye").button("Auric Automaton").button("Back").show(player).then((r) => {
    if (r.selection === 4 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) soulOfNature(player);
    if (r.selection === 1) puniceaCrimsonEye(player);
    if (r.selection === 2) copperMechanicalArray(player);
  });
}
function soulOfNature(player) {
  const form = new ActionFormData7().title(guideTitle("Sealed Soul of Nature")).label("Sealed Soul of Nature wields nature and prism power. Its attacks can drain your oxygen mid-fight.").label("It has 500 HP and 3 attack patterns. At 70% HP it spawns extra Nature and Prism Crystals, making the fight harder.").label("Summon it by interacting with the Nature Soul Altar in the underwater Prismarine Arena.").label("Defeating it marks the true start of your Phantasm journey. You get a treasure bag...").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}
function puniceaCrimsonEye(player) {
  const form = new ActionFormData7().title(guideTitle("Punicea - A Crimson Eye")).label("Punicea wields crimson corruption. It has 6 attacks and very high health.").label("It has 3000 HP and 6 attack patterns. Each is well telegraphed but hits hard, so keep moving.").label("Summon it by interacting with the Suspicious Crimson Eye in the Crimson Overgrowth.").label("Defeating it proves you can dodge. You get a treasure bag...").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}
function copperMechanicalArray(player) {
  const form = new ActionFormData7().title(guideTitle("Auric Automaton - Copper Mechanical Array")).label("The Auric Mechanical Array wields ultimate Auric power. Complicated patterns, massive damage, and high mobility. Bring your best gear.").label("It has 1750 HP and 7 attack patterns that adapt to how you fight. Do not try to tank them. Stay mobile to survive and kill it.").label("Summon it by completing the Ancient Copper Core ritual.").label("It drops a treasure bag. That completes the Phantasm journey, for now. Stay tuned for the next update!").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}

// data/scripts/ui/guide/accessories_guide.ts
import { ActionFormData as ActionFormData8 } from "@minecraft/server-ui";
function guideAccessories(player) {
  const form = new ActionFormData8().title(guideTitle("Accessories")).label("Every accessory explains its own effect in its item description, so hover over the item to read what it does!").divider().label("Accessories are items that support you in combat and beyond. Find them anywhere: mining, looting structures, even boss fights.").divider().label("Two types:").label("Active accessories :\nThey have both a passive effect and an interact use. Keep them in a hotbar slot with a plus sign.").label("Passive accessories :\nPassive effect only. Best in the offhand slot, but a plus-sign hotbar slot works too.").divider().label("Put an accessory in the offhand slot or a plus-sign hotbar slot. Its passive applies as soon as you equip it.").button("Back").show(player).then((r) => {
    if (r.selection === 0 || r.canceled) mainGuideScreen(player);
  });
}

// data/scripts/ui/guide/enemies_guide.ts
import { ActionFormData as ActionFormData9 } from "@minecraft/server-ui";
function guideEnemies(player) {
  const form = new ActionFormData9().title(guideTitle("Enemies")).divider().label("Only one enemy type so far: Crimson Tentacles.").label("They spawn naturally in the Crimson Forest and drop Essence of Crimson at 50% chance.").divider().button("Back").show(player).then((r) => {
    if (r.selection === 0 || r.canceled) mainGuideScreen(player);
  });
}

// data/scripts/ui/guide/main_guide.ts
function mainGuideScreen(player) {
  const form = new ActionFormData10().title(guideTitle("Guide")).header("Phantasm Guide").divider().label(
    "Phantasm is an add-on that adds a lot of content into your world: new weapons, mechanics, enemies, and bosses. This add-on is updated regularly, so stay tuned for the next content!"
  ).label("New to the add-on? Click Getting Started below to learn where to begin!").divider().button("Getting Started").button("Mechanics", "textures/ui/speed_effect").button("Weapons", "textures/items/diamond_sword").button("Items", "textures/items/essence_of_crimson").button("Blocks", "textures/blocks/stonebrick_carved").button("Accessories", "textures/items/fire_bracelet").button("Bosses", "textures/items/the_crimson_watcher").button("Enemies", "textures/items/egg_zombie").divider().button("Changelogs").button("Contact the Developer!").divider().label(
    "Stuck? Press this button or use /unstuck. Minecraft's input permission bugs out sometimes, so I added both for that reason."
  ).button("Unstuck").divider().button("Exit").show(player).then((r) => {
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
  const form = new ActionFormData10().title(guideTitle("Getting Started")).header("Where to begin?").divider().header("Early Game \u2014 Mining").label("- Mine ores to get a chance at the Rusted Fortune Coin and Item Magnet Ore (1% chance per ore).").label("- Use /unlockskill to upgrade your passive abilities: Passive Dash, Extra Health, and Wind Plunge.").divider().header("Mid Game \u2014 Exploration").label("- Explore Trial Chambers to find the Ancient Copper Core, Auric Proton, and the Peacemaker Oath.").label("- Visit the Crimson Forest: fight Crimson Tentacles for Essence of Crimson, and locate the Crimson Overgrowth.").divider().header("Bosses \u2014 Your Progression").label("1. Sealed Soul of Nature (Prismarine Arena, underwater) \u2014 your first boss, drops Prismatic Ingots and a treasure bag (Animitta / Prism Weaver).").label("2. Punicea : A Crimson Eye (Crimson Overgrowth) \u2014 drops The Bleeding Spire and Suspicious Mushroom.").label("3. Auric Automaton : Copper Mechanical Array (Ancient Copper Core ritual) \u2014 the final boss, drops Supercharged Copper Axe / Auric Photonizer.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mainGuideScreen(player);
  });
}
function Changelogs(player) {
  const form = new ActionFormData10().title(guideTitle("Changelogs")).header("v1.5.2").divider().header("Changes").label("= Added a cooldown between Legendary Weapon attacks (Solaris Verdant, Supercharged Copper Axe, Prism Weaver, Auric Photonizer, The Bleeding Spire, and Seiketsu) so attack patterns can no longer be spammed without a pause - ExplerHD").label("= Fixed player scoreboard initialization: all scores are now reset when a player spawns (including weapon attack scores), so no leftover scores remain from previous sessions - ExplerHD").divider().header("Addition").label("+ Upgraded several particle textures to use PBR (metalness/emissive/roughness) so they can glow and look smoother: circle_fade, circle_load, crosshair_warning, slash_effect_white, slash_effect_white_2, sonic_explosion_grayscaled, sparkle, and the Damage Indicator - ExplerHD").divider().header("v1.5.1").divider().header("Removal").label("- Removed the debug log spam that printed on every ore mined - ExplerHD").divider().header("Changes").label("= Rewrote the Dynamic Light System: no more flickering when switching items, lights are placed instantly, and they only spawn on air or liquid blocks so they won't break tall grass, flowers, or doors - ExplerHD").label("= Health Bar now uses the native on-screen display, so it no longer spams the chat and shows correctly on respawn - ExplerHD").label('= Fixed a crash ("setTitle of undefined") that occurred whenever a mob took damage - ExplerHD').label("= Overhauled the Guidescreen: fixed wrong weapon titles and a wrong drop source, cleaned up typos, and corrected outdated HP data - ExplerHD").label("= Fixed the Damage Indicator icons being mispositioned - ExplerHD").label("= Moved the Dash cooldown scoreboard to be initialized when a player joins - ExplerHD").divider().header("Addition").label("+ Added a Getting Started page to the Guidescreen with a recommended progression path, plus a welcome message on first join - ExplerHD").label("+ Added a crafting recipe to turn a Rusted Fortune Coin into 4 Gold Blocks - ExplerHD").divider().header("v1.5.0").divider().header("Removal").label("- Removed the Glyph System, but you can still use the glyphs available in Phantasm - ExplerHD").label("- Removed the mining functionality from Legendary Weapons, as they were never designed for that purpose - ExplerHD").label("- Removed the Direct Hit feature from Legendary Weapons and Seiketsu - ExplerHD").divider().header("Changes").label("= Refactored the Custom Mace system - ExplerHD").label("= Reworked the Damage Indicator system to use Runtime Particles - ExplerHD").label("= Changed Prism Boss Arena from fixed ground positions to locatable underwater structures - ExplerHD").label("= Updated the Soul of Nature boss fight to follow the new structure generation (underwater boss fight) - ExplerHD").label("= Adjusted the placement of the Crimson Overgrowth structure to make it more logical and visible - ExplerHD").label("= Increased Seiketsu damage by +4 - ExplerHD").label("= Slightly updated the visuals of The Bleeding Spire attack - ExplerHD").label("= Rebalanced the damage of all Legendary Weapons so they can compete with enchanted Epic Weapons - ExplerHD").label("= Made Soul of Nature, Punicea, and Auric Automaton have 500 HP, 3000 HP, and 1750 HP due to Recent Weapons changes. - ExplerHD").label("= Added support for Fire Aspect, Knockback, and Weakness on Legendary Weapons - ExplerHD").label("= Updated all Legendary Weapons so their attack patterns now loop continuously without an ending cooldown - ExplerHD").label('= Fixed a bug where upgrading Dash to Level 2 would display "Insufficient Experience Level" instead of "Maximum level of Dash is reached." - ExplerHD').divider().header("Addition").label("+ Added the `damage_number` and `damage_icons` particles - ExplerHD").label("+ Added the Better than Mending feature - ExplerHD").label("+ Added a Combat Dummy - ExplerHD").label("+ Added a Turtle Shell item to the Prismarine Boss Arena to make the boss fight in that arena easier - ExplerHD").label("+ Added Rusted Fortune Coin, which doubles ore drops, and the Item Magnet Ore. Both can be obtained from a 1% chance when mining any ore - Passive Type - ExplerHD").label("+ Added Condensed Sea Nature, providing much longer underwater breathing and slightly faster health regeneration while underwater - Passive Type - ExplerHD").label("+ Added Guidescreen - ExplerHD & ZeroMaster178").divider().label("Stay tuned for the next content update!").button("Back").show(player).then((r) => {
    if (r.selection == 0) mainGuideScreen(player);
  });
}
function developer(player) {
  const form = new ActionFormData10().title(guideTitle("Developer Contact")).header("Contact Us!").divider().label("ExplerHD\nGitHub : ExplHD\nDiscord : explerhd\nYoutube : ExplerHD (@ExplHD)\nMCPEDL : ExplerHD\nCurseforge : ExplerHD").label("ZeroMaster178\nInstagram : zeromaster_178\nMCPEDL : Zeromaster 178\nCurseforge : Zeromaster178\nTiktok : Zeromaster_178\nYoutube : zeromaster178\nDiscord : zeromaster178").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0) mainGuideScreen(player);
  });
}

// data/scripts/ui/forms/dynamicProperties.ts
import "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
var DYNAMIC_PROPERTY_IDS = ["ph:dash_level", "ph:health_level", "ph:plunge_unlock", "ph:guidebook_acquired", "ph:dash_control", "ph:skill_switch_control"];
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

// data/scripts/features/blocks/customComponents.ts
var BOSS_SPAWN_MIN_DISTANCE = 4;
var BOSS_SPAWN_MAX_DISTANCE = 12;
var BOSS_SPAWN_HEAD_ROOM = 4;
var BOSS_SPAWN_SEARCH_DEPTH = 12;
function isGroundBlock(block) {
  return !!block && !block.isAir && !block.isLiquid;
}
function findBossSpawnPoint(dimension, origin, player) {
  const angles = 12;
  for (let i = 0; i < angles; i++) {
    const angle = i / angles * Math.PI * 2 + Math.random() * 0.5;
    const distance = BOSS_SPAWN_MIN_DISTANCE + Math.random() * (BOSS_SPAWN_MAX_DISTANCE - BOSS_SPAWN_MIN_DISTANCE);
    const x = Math.floor(origin.x + Math.cos(angle) * distance);
    const z = Math.floor(origin.z + Math.sin(angle) * distance);
    const startY = Math.floor(player.location.y);
    for (let drop = 0; drop <= BOSS_SPAWN_SEARCH_DEPTH; drop++) {
      const y = startY - drop;
      const floor = dimension.getBlock({ x, y: y - 1, z });
      if (!isGroundBlock(floor)) continue;
      let headRoom = true;
      for (let up = 0; up < BOSS_SPAWN_HEAD_ROOM; up++) {
        const space = dimension.getBlock({ x, y: y + up, z });
        if (!space || !space.isAir) {
          headRoom = false;
          break;
        }
      }
      if (!headRoom) break;
      return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return { x: origin.x, y: origin.y + 1.1, z: origin.z };
}
var COPPER_RING_COLOR = { red: 1, green: 0.63137, blue: 0, alpha: 1 };
function coreRing(size, color) {
  const map = new MolangVariableMap4();
  map.setFloat("variable.size", size);
  map.setColorRGBA("variable.rgba", color);
  return map;
}
var copperRing = () => coreRing(1, COPPER_RING_COLOR);
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
      applyDurabilityDamage(player, { damage: 36 });
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
      applyDurabilityDamage(source, { damage: durabilityDamage });
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
      source.sendMessage(`\xA7aUpgrade successful, feel the difference`);
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
        applyDurabilityDamage(source);
      }
    },
    onMineBlock({ source, itemStack }) {
      applyDurabilityDamage(source);
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
          applyDurabilityDamage(player, { damage: altCostAmount });
        } else {
          if (getScore(player, altCostType) < altCostAmount) return player.sendMessage("Insufficient Charges");
          removeScore(player, altCostType, altCostAmount);
          applyDurabilityDamage(player, { damage: altCostAmount });
        }
        eventFunc();
        return;
      }
      if (costType === "durability") {
        applyDurabilityDamage(player, { damage: costAmount });
      } else {
        if (getScore(player, costType) < costAmount) return player.sendMessage("Insufficient Charges");
        removeScore(player, costType, costAmount);
        applyDurabilityDamage(player, { damage: costAmount });
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
      applyDurabilityDamage(player, { damage: 50 });
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
      block.dimension.playSound("random.toast", blockLoc);
      source.playSound("random.toast");
      block.dimension.spawnParticle("ph:auric_communicator_loading", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
      if (auricMode == 1) {
        source.addTag("AURIC_ORBITAL_NUKE");
        system12.runTimeout(() => {
          block.dimension.playSound("random.explode", blockLoc);
          try {
            block.dimension.runCommand(`damage @e[r=48,tag=!AURIC_ORBITAL_NUKE,type=!item,family=!inanimate,x=${blockLoc.x},y=${blockLoc.y},z=${blockLoc.z}] 50 entity_explosion entity @e[tag=AURIC_ORBITAL_NUKE]`);
          } catch (e) {
          }
          block.dimension.spawnParticle("ph:auric_stab_shot", { x: blockLoc.x, y: 0, z: blockLoc.z });
          block.dimension.spawnParticle("ph:auric_nuke_shot", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
          removeScore(source, "auric_charge", 100);
          source.startItemCooldown("auric_communicator", 600);
          source.removeTag("AURIC_ORBITAL_NUKE");
        }, 30);
        return;
      }
      source.addTag("AURIC_ORBITAL_LASER");
      system12.runTimeout(() => {
        for (let i = 0; i < 381; i += 10) {
          try {
            block.dimension.runCommand(`damage @e[r=10,tag=!AURIC_ORBITAL_LASER,type=!item,family=!inanimate,x=${blockLoc.x},y=${i},z=${blockLoc.z}] 80 entity_explosion entity @e[tag=AURIC_ORBITAL_LASER]`);
          } catch (e) {
          }
          block.dimension.playSound("random.explode", { x: blockLoc.x, y: i, z: blockLoc.z });
        }
        block.dimension.spawnParticle("ph:auric_stab_shot_refined", { x: blockLoc.x, y: 0, z: blockLoc.z });
        block.dimension.spawnParticle("ph:auric_stab_shot_line", { x: blockLoc.x, y: 0, z: blockLoc.z });
        removeScore(source, "auric_charge", 50);
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
      applyDurabilityDamage(source, { damage: transferAmount });
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
      applyDurabilityDamage(source, { damage: 1 });
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
      const mergedDataItem = new ItemStack4(bargaining_item, bargaining_item_amount);
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
        player.sendMessage("Core activated. Waiting for his approach");
        block.dimension.setBlockType(block.north(2), "ph:core_battery");
        block.dimension.setBlockType(block.south(2), "ph:prismarine_battery");
        block.dimension.spawnParticle("ph:auric_beam", block.center());
        block.dimension.spawnParticle("ph:auric_light_flash", block.center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.north(2).center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.east(2).center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.south(2).center());
        block.dimension.spawnParticle("ph:auric_beam_small", block.west(2).center());
        block.dimension.playSound("custom_sfx.boss_summoned", block.center());
        const bossSpawnPoint = findBossSpawnPoint(block.dimension, block.center(), player);
        system12.runTimeout(() => {
          block.dimension.spawnEntity("ph:copper_mechanical_array", bossSpawnPoint);
          block.dimension.playSound("mob.zombie.woodbreak", bossSpawnPoint);
          block.dimension.spawnParticle("ph:auric_beam_small", bossSpawnPoint);
          block.dimension.spawnParticle("ph:auric_light_flash", bossSpawnPoint);
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
      const north = block.north(2);
      const east = block.east(2);
      const south = block.south(2);
      const west = block.west(2);
      const northActive = north.permutation.getState("ph:activation_state") == 1;
      const eastActive = east.permutation.getState("ph:activation_state") == 1;
      const southActive = south.permutation.getState("ph:activation_state") == 1;
      const westActive = west.permutation.getState("ph:activation_state") == 1;
      if (northActive) {
        dimension.spawnParticle("ph:bounding_circle", north.center(), coreRing(1, { red: 1, green: 1, blue: 1, alpha: 1 }));
      }
      if (eastActive) {
        dimension.spawnParticle("ph:bounding_circle", east.center(), copperRing());
      }
      if (southActive) {
        dimension.spawnParticle("ph:bounding_circle", south.center(), coreRing(1, { red: 0.352, green: 1, blue: 0.705, alpha: 1 }));
      }
      if (westActive) {
        dimension.spawnParticle("ph:bounding_circle", west.center(), copperRing());
      }
      if (north.typeId != "minecraft:air" || east.typeId != "minecraft:air" || south.typeId != "minecraft:air" || west.typeId != "minecraft:air") return;
      dimension.spawnParticle("ph:bounding_circle", block.center(), coreRing(3, { red: 1, green: 0.63137, blue: 0, alpha: 1 }));
      dimension.spawnParticle("ph:bounding_circle", north.center(), copperRing());
      dimension.spawnParticle("ph:bounding_circle", east.center(), copperRing());
      dimension.spawnParticle("ph:bounding_circle", south.center(), copperRing());
      dimension.spawnParticle("ph:bounding_circle", west.center(), copperRing());
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
      const mergedDataItem = new ItemStack4(item, itemCount);
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
        removeScore(player, "auric_charge", chargeMin);
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:crystall_support", {
    onTick({ block, dimension }) {
      if (!block?.isValid) return;
      let face;
      try {
        face = block.permutation.getState("minecraft:block_face");
      } catch {
        return;
      }
      let support;
      switch (face) {
        case "up":
          support = block.below();
          break;
        case "down":
          support = block.above();
          break;
        // block_face = face of support that was clicked, so support is opposite
        case "north":
          support = block.south();
          break;
        case "south":
          support = block.north();
          break;
        case "east":
          support = block.west();
          break;
        case "west":
          support = block.east();
          break;
        default:
          return;
      }
      if (!support) return;
      if (!support.isAir && !support.isLiquid) return;
      let dropId;
      try {
        dropId = block.getComponent("ph:crystall_support")?.customComponentParameters?.params?.drop_item;
      } catch {
        dropId = void 0;
      }
      const loc = block.location;
      const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
      dimension.setBlockType(loc, "minecraft:air");
      if (dropId) {
        try {
          dimension.spawnItem(new ItemStack4(dropId, 1), center);
        } catch {
        }
      }
      try {
        dimension.playSound("dig.amethyst", center);
      } catch {
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:item_charger", {
    onPlayerInteract({ player, block, dimension }, { params }) {
      const item = params.item;
      const maxBatteryStack = params.max_battery_stack || 4;
      const soundInput = params.sound_input;
      const soundPickup = params.sound_pickup;
      const itemData = new ItemStack4(item);
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
    name: "ph:setting",
    description: "Opens the settings ui to configure your controls",
    cheatsRequired: false,
    permissionLevel: CommandPermissionLevel.Any
  }, (origin) => {
    const player = origin.sourceEntity;
    if (player?.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure };
    system12.run(() => {
      openSettings(player);
    });
    return { status: CustomCommandStatus.Success };
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

// data/scripts/features/mace/detection.ts
import { world as world7, system as system13, EquipmentSlot as EquipmentSlot7, EntityDamageCause as EntityDamageCause4 } from "@minecraft/server";

// data/scripts/features/mace/manager.ts
import { EntityEquippableComponent, EquipmentSlot as EquipmentSlot6 } from "@minecraft/server";

// data/scripts/features/mace/detection.ts
var CustomMaceItems = /* @__PURE__ */ new Set([
  "ph:cruxshaper"
]);
function isCustomMace(item) {
  return !!item && CustomMaceItems.has(item?.typeId);
}
var playerFallData = /* @__PURE__ */ new Map();
system13.runInterval(() => {
  for (const player of world7.getAllPlayers()) {
    const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot7.Mainhand);
    const isFallingWithMace = isCustomMace(item) && !player.isOnGround && !player.isInWater && !player.isClimbing && !player.isGliding && !player.isFlying && !player.getEffect("minecraft:slow_falling") && !player.getEffect("minecraft:levitation");
    if (isFallingWithMace && player.dimension?.getBlock(player.location)?.typeId === "minecraft:web") {
      playerFallData.delete(player.id);
      continue;
    }
    if (isFallingWithMace) {
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
console.warn("\xA7a\xA7lPhantasm 1.5.2 Activated!");

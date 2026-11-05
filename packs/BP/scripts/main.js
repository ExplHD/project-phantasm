// data/scripts/events/index.ts
import { world as world12, system as system18, ItemStack as ItemStack8, MolangVariableMap as MolangVariableMap6, EquipmentSlot as EquipmentSlot10, Player as Player19 } from "@minecraft/server";

// data/scripts/core/scoreboard.ts
import { world } from "@minecraft/server";
function addScore(target, objective, score) {
  if (!target.isValid) return;
  world.scoreboard.getObjective(objective)?.addScore(target, score);
}
function removeScore(target, objective, score) {
  if (!target.isValid) return;
  world.scoreboard.getObjective(objective)?.addScore(target, -score);
}
function setScore(target, objective, score) {
  if (!target.isValid) return;
  world.scoreboard.getObjective(objective)?.setScore(target, score);
}
function getScore(target, objective) {
  if (!target.isValid) return 0;
  return world.scoreboard.getObjective(objective)?.getScore(target) ?? 0;
}

// data/scripts/core/items.ts
import { GameMode } from "@minecraft/server";
function applyDurabilityDamage(source, options = {}) {
  if (!source.isValid) return;
  const {
    damage = 1,
    slot = source?.selectedSlotIndex,
    ignoreUnbreaking = false,
    breakSound = true
  } = options;
  const inventory = source.getComponent("inventory")?.container;
  if (!inventory) return;
  const item = inventory.getItem(slot);
  if (!item) return;
  const durability = item.getComponent("durability");
  if (!durability) return;
  if (source.getGameMode() === GameMode.Creative) return;
  if (!ignoreUnbreaking) {
    const unbreaking = item?.getComponent("enchantable")?.getEnchantment("unbreaking")?.level ?? 0;
    const chance = unbreaking * 21;
    const roll = Math.floor(Math.random() * 101);
    if (roll <= chance) return;
  }
  const newDamage = durability.damage + damage;
  if (newDamage >= durability.maxDurability) {
    inventory.setItem(slot, void 0);
    if (breakSound) source.playSound("random.break");
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
    if (!player.isValid) return;
    player.runCommand("inputpermission set @s movement enabled");
    player.runCommand("inputpermission set @s jump enabled");
    player.runCommand("inputpermission set @s camera enabled");
    player.removeTag("parried");
    player.runCommand("camera @s clear");
  });
}

// data/scripts/core/location.ts
function isLoadedLocation(dimension, location) {
  const { min, max } = dimension.heightRange;
  if (location.y < min || location.y >= max) return false;
  return dimension.isChunkLoaded(location);
}

// data/scripts/core/blocks.ts
import { BlockPermutation } from "@minecraft/server";
function getCustomState(block, name) {
  return block.permutation.getAllStates()[name];
}
function setCustomState(block, name, value) {
  const states3 = { ...block.permutation.getAllStates(), [name]: value };
  block.setPermutation(BlockPermutation.resolve(block.typeId, states3));
}
function crystallSupport(block) {
  switch (block.permutation.getState("minecraft:block_face")) {
    case "up":
      return block.below();
    case "down":
      return block.above();
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

// data/scripts/core/summons.ts
import "@minecraft/server";
var SUMMONER_PROPERTY = "ph:summoner";
var SCAN_RADIUS = 64;
function getOwnerId(entity) {
  if (entity.typeId === "minecraft:player") return entity.id;
  if (!entity.isValid) return void 0;
  const owner = entity.getDynamicProperty(SUMMONER_PROPERTY);
  return typeof owner === "string" ? owner : void 0;
}
function summonOwned(owner, command, source = owner) {
  const ownerId = getOwnerId(owner);
  if (!source.isValid) return;
  if (!ownerId) {
    source.runCommand(command);
    return;
  }
  const rawTypeId = command.trim().split(/\s+/)[1];
  if (!rawTypeId) return;
  const typeId = rawTypeId.includes(":") ? rawTypeId : `minecraft:${rawTypeId}`;
  const query = { type: typeId, location: source.location, maxDistance: SCAN_RADIUS };
  const existing = new Set(source.dimension.getEntities(query).map((e) => e.id));
  source.runCommand(command);
  for (const entity of source.dimension.getEntities(query)) {
    if (existing.has(entity.id)) continue;
    if (!entity.isValid) continue;
    entity.setDynamicProperty(SUMMONER_PROPERTY, ownerId);
  }
}

// data/scripts/features/weapons/weaponHandler.ts
import { system as system3 } from "@minecraft/server";

// data/scripts/features/weapons/damage.ts
import { EquipmentSlot as EquipmentSlot2, EntityDamageCause } from "@minecraft/server";
function strikeStats(source, baseDamage) {
  const strengthLevel = (source.getEffect("strength")?.amplifier ?? -1) + 1;
  const strengthFormula = 1 + strengthLevel * 0.45;
  const weaknessLevel = (source.getEffect("weakness")?.amplifier ?? -1) + 1;
  const weaknessFormula = Math.max(0, 1 - weaknessLevel * 0.24);
  const enchantable = source.getComponent("equippable")?.getEquipment(EquipmentSlot2.Mainhand)?.getComponent("enchantable");
  const sharpnessDamage = (enchantable?.getEnchantment("sharpness")?.level ?? 0) * 1.25;
  return {
    damage: (baseDamage + sharpnessDamage) * strengthFormula * weaknessFormula,
    fireAspect: enchantable?.getEnchantment("fire_aspect")?.level ?? 0,
    knockback: enchantable?.getEnchantment("knockback")?.level ?? 0
  };
}
var EXCLUDED_TYPES = ["minecraft:item", "minecraft:lightning_bolt", "minecraft:xp_orb"];
var EXCLUDED_FAMILIES = ["inanimate", "invulnerable"];
function canWeaponHit(source, entity) {
  if (!entity.isValid || entity.id === source.id) return false;
  if (getOwnerId(entity) === source.id) return false;
  return entity.getComponent("tameable")?.tamedToPlayerId !== source.id;
}
function strikeEntity(source, entity, stats, push, knockbackScale = 1) {
  if (!entity.isValid) return;
  entity.applyDamage(stats.damage, {
    cause: EntityDamageCause.entityAttack,
    damagingEntity: source
  });
  const kbStrength = (1 + stats.knockback) * knockbackScale;
  if (!entity.isValid) return;
  entity.applyKnockback({ x: push.x * kbStrength, z: push.z * kbStrength }, 0.4 * Math.min(1, knockbackScale + 0.25));
  if (stats.fireAspect > 0) entity.setOnFire(stats.fireAspect * 4 - 1);
}
function applyCustomDamage(source, damage, radius) {
  const stats = strikeStats(source, damage);
  const entities = source.dimension.getEntities({
    location: source.location,
    minDistance: 0.1,
    maxDistance: radius,
    excludeTypes: EXCLUDED_TYPES,
    excludeFamilies: EXCLUDED_FAMILIES
  });
  for (const entity of entities) {
    if (!canWeaponHit(source, entity)) continue;
    const dx = entity.location.x - source.location.x;
    const dz = entity.location.z - source.location.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const push = dist > 0 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 1 };
    strikeEntity(source, entity, stats, push);
  }
}

// data/scripts/features/weapons/projectile.ts
import { system as system2 } from "@minecraft/server";
var STEP = 0.45;
var bolts = [];
var runner;
function normalize(v) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return length > 0 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function rotateYaw(v, degrees) {
  const r = degrees * Math.PI / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: v.x * cos - v.z * sin, y: v.y, z: v.x * sin + v.z * cos };
}
function steer(from, to, maxDegrees) {
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(from, to))));
  const max = maxDegrees * Math.PI / 180;
  if (angle <= max || angle < 1e-4) return to;
  const t = max / angle;
  return normalize({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
}
function bodyCenter(entity) {
  const base = entity.location;
  const head = entity.getHeadLocation();
  return { x: base.x, y: base.y + (head.y - base.y) * 0.6, z: base.z };
}
function lockTarget(owner, eye, view, range, coneDegrees) {
  if (!isLoadedLocation(owner.dimension, eye)) return void 0;
  const minDot = Math.cos(coneDegrees * Math.PI / 180);
  let best;
  let bestDot = minDot;
  for (const entity of owner.dimension.getEntities({ location: eye, maxDistance: range, excludeTypes: EXCLUDED_TYPES, excludeFamilies: EXCLUDED_FAMILIES })) {
    if (!canWeaponHit(owner, entity)) continue;
    const center = bodyCenter(entity);
    const offset = { x: center.x - eye.x, y: center.y - eye.y, z: center.z - eye.z };
    const distance = Math.sqrt(dot(offset, offset));
    if (distance < 0.5) continue;
    const facing = dot(view, offset) / distance;
    if (facing <= bestDot) continue;
    const wall = owner.dimension.getBlockFromRay(eye, normalize(offset), { maxDistance: distance, includePassableBlocks: false, includeLiquidBlocks: false });
    if (wall) continue;
    best = entity;
    bestDot = facing;
  }
  return best;
}
function fireProjectile(owner, config) {
  if (!owner.isValid) return;
  const view = normalize(owner.getViewDirection());
  const eye = owner.getHeadLocation();
  const right = normalize({ x: -view.z, y: 0, z: view.x });
  const forward = config.origin?.forward ?? 0.6;
  const side = config.origin?.side ?? 0;
  const up = config.origin?.up ?? -0.15;
  const start = {
    x: eye.x + view.x * forward + right.x * side,
    y: eye.y + view.y * forward + up,
    z: eye.z + view.z * forward + right.z * side
  };
  const target = lockTarget(owner, eye, view, config.range, config.lockCone ?? 12);
  const stats = strikeStats(owner, config.damage);
  for (const yaw of config.spread ?? [0]) {
    const aim = target ? bodyCenter(target) : { x: eye.x + view.x * 16, y: eye.y + view.y * 16, z: eye.z + view.z * 16 };
    const dir = yaw === 0 ? normalize({ x: aim.x - start.x, y: aim.y - start.y, z: aim.z - start.z }) : rotateYaw(view, yaw);
    bolts.push({
      owner,
      dimension: owner.dimension,
      pos: { ...start },
      dir,
      config,
      stats,
      target,
      travelled: 0,
      pierceLeft: config.pierce ?? 0,
      hit: /* @__PURE__ */ new Set()
    });
  }
  runner ??= system2.runInterval(tickBolts, 1);
}
function tickBolts() {
  for (let i = bolts.length - 1; i >= 0; i--) {
    if (!advance(bolts[i])) bolts.splice(i, 1);
  }
  if (bolts.length === 0 && runner !== void 0) {
    system2.clearRun(runner);
    runner = void 0;
  }
}
function advance(bolt) {
  const { config, dimension } = bolt;
  if (!bolt.owner.isValid) return false;
  const steps = Math.max(1, Math.ceil(config.speed / STEP));
  const stepLength = config.speed / steps;
  const homing = (config.homing ?? 0) / steps;
  for (let s = 0; s < steps; s++) {
    if (!isLoadedLocation(dimension, bolt.pos)) return false;
    if (bolt.target && homing > 0) {
      if (bolt.target.isValid) {
        const center = bodyCenter(bolt.target);
        bolt.dir = steer(bolt.dir, normalize({ x: center.x - bolt.pos.x, y: center.y - bolt.pos.y, z: center.z - bolt.pos.z }), homing);
      } else {
        bolt.target = void 0;
      }
    }
    const wall = dimension.getBlockFromRay(bolt.pos, bolt.dir, { maxDistance: stepLength, includePassableBlocks: false, includeLiquidBlocks: false });
    const wallDistance = wall ? Math.sqrt(
      (wall.block.location.x + wall.faceLocation.x - bolt.pos.x) ** 2 + (wall.block.location.y + wall.faceLocation.y - bolt.pos.y) ** 2 + (wall.block.location.z + wall.faceLocation.z - bolt.pos.z) ** 2
    ) : Infinity;
    const hits = dimension.getEntitiesFromRay(bolt.pos, bolt.dir, {
      maxDistance: Math.min(stepLength, wallDistance),
      ignoreBlockCollision: true,
      excludeTypes: EXCLUDED_TYPES,
      excludeFamilies: EXCLUDED_FAMILIES
    });
    for (const { entity, distance } of hits.sort((a, b) => a.distance - b.distance)) {
      if (!bolt.owner.isValid) return false;
      if (bolt.hit.has(entity.id) || !canWeaponHit(bolt.owner, entity)) continue;
      bolt.hit.add(entity.id);
      strikeEntity(bolt.owner, entity, bolt.stats, normalize({ x: bolt.dir.x, y: 0, z: bolt.dir.z }), config.knockback ?? 0.35);
      if (bolt.pierceLeft-- <= 0) {
        impact(bolt, along(bolt, distance));
        return false;
      }
    }
    if (bolt.target?.isValid && !bolt.hit.has(bolt.target.id)) {
      const center = bodyCenter(bolt.target);
      const dx = center.x - bolt.pos.x, dy = center.y - bolt.pos.y, dz = center.z - bolt.pos.z;
      if (dx * dx + dy * dy + dz * dz < 0.7 * 0.7) {
        bolt.hit.add(bolt.target.id);
        strikeEntity(bolt.owner, bolt.target, bolt.stats, normalize({ x: bolt.dir.x, y: 0, z: bolt.dir.z }), config.knockback ?? 0.35);
        if (bolt.pierceLeft-- <= 0) {
          impact(bolt, bolt.pos);
          return false;
        }
        bolt.target = void 0;
      }
    }
    if (wall) {
      impact(bolt, along(bolt, wallDistance));
      return false;
    }
    bolt.pos = along(bolt, stepLength);
    bolt.travelled += stepLength;
    if (!isLoadedLocation(dimension, bolt.pos)) return false;
    dimension.spawnParticle(config.core, bolt.pos);
    if (bolt.travelled >= config.range) {
      impact(bolt, bolt.pos);
      return false;
    }
  }
  if (config.trail) dimension.spawnParticle(config.trail, bolt.pos);
  return true;
}
function along(bolt, distance) {
  return { x: bolt.pos.x + bolt.dir.x * distance, y: bolt.pos.y + bolt.dir.y * distance, z: bolt.pos.z + bolt.dir.z * distance };
}
function impact(bolt, at) {
  if (!isLoadedLocation(bolt.dimension, at)) return;
  for (const particle of bolt.config.impact ?? []) bolt.dimension.spawnParticle(particle, at);
  if (bolt.config.impactSound) bolt.dimension.playSound(bolt.config.impactSound, at, { volume: 0.6, pitch: 1.2 + Math.random() * 0.4 });
}

// data/scripts/features/weapons/weaponHandler.ts
var WeaponHandler = class {
  itemId;
  objective;
  delayPerAttackPattern;
  attackPatterns;
  constructor(itemId, objective, delayPerAttackPattern, attackPatterns) {
    this.itemId = itemId;
    this.objective = objective;
    this.delayPerAttackPattern = delayPerAttackPattern;
    this.attackPatterns = attackPatterns;
  }
  static addScore(target, objective, score) {
    addScore(target, objective, score);
  }
  static removeScore(target, objective, score) {
    removeScore(target, objective, score);
  }
  static setScore(target, objective, score) {
    setScore(target, objective, score);
  }
  static getScore(target, objective) {
    return getScore(target, objective);
  }
  handleAttack(source) {
    const currentStep = getScore(source, this.objective);
    if (currentStep < this.attackPatterns.length) {
      const pattern = this.attackPatterns[currentStep];
      const delay = this.delayPerAttackPattern[currentStep];
      if (getScore(source, "delayatk") > 0 && getScore(source, "delayatk") < delay) return;
      triggerAttack(source, pattern.delay, pattern.damage, pattern.radius, pattern.animation, pattern.sound, pattern.projectile);
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
    const storedSkill = WeaponHandler.getScore(source, this.objective);
    if (storedSkill >= this.skills.length) WeaponHandler.setScore(source, this.objective, 0);
    const currentSkill = storedSkill >= this.skills.length ? 0 : storedSkill;
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
  constructor(itemId, objective) {
    this.itemId = itemId;
    this.skills = {};
    this.objective = objective;
  }
  addSkill(id, config) {
    this.skills[id] = config;
  }
  runSkill(source, id) {
    const skill = this.skills[id];
    if (!skill) return console.error(`Skill ${id} not found!`);
    if (!source.isValid) return;
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
      system3.runTimeout(() => {
        if (!source.isValid) return;
        if (!source.dimension.isChunkLoaded(source.location)) return;
        cmd.action(source);
      }, totalDelay);
    }
  }
};
function triggerAttack(source, delay, damage, radius, animation, sound, projectile) {
  if (!source) return console.error("No Players found!");
  if (!delay && !damage) return console.error("Specify Damage and Delay before Damage Value");
  if (!radius && !projectile) return console.error("Specify Radius Value");
  if (!animation) return;
  if (!source.isValid) return;
  source.playAnimation(animation);
  system3.runTimeout(() => {
    if (!source.isValid) return;
    if (projectile) fireProjectile(source, projectile);
    else applyCustomDamage(source, damage, radius);
    if (!sound) return;
    source.dimension.playSound(sound, source.location);
  }, delay);
}

// data/scripts/features/weapons/prismWeaver.ts
var BOLT_FX = {
  core: "ph:prism_bolt",
  trail: "ph:prism_bolt_trail",
  impact: ["ph:prism_bolt_impact", "ph:prism_weaver_flash"],
  impactSound: "random.glass"
};
function prismBolt(side) {
  return { ...BOLT_FX, damage: 17, speed: 1.8, range: 28, homing: 6, lockCone: 10, origin: { side } };
}
var PRISM_FAN = {
  ...BOLT_FX,
  damage: 12,
  speed: 1.6,
  range: 24,
  homing: 9,
  lockCone: 14,
  pierce: 1,
  spread: [-9, 0, 9]
};
function prismBubble(side, up) {
  return {
    core: "ph:prism_bubble",
    impact: ["ph:prism_bubble_pop"],
    impactSound: "random.pop",
    damage: 22,
    speed: 0.9,
    range: 20,
    homing: 14,
    lockCone: 25,
    knockback: 0.15,
    pierce: Infinity,
    origin: { forward: 0.2, side, up }
  };
}

// data/scripts/features/weapons/weaponSkills.ts
import { MolangVariableMap, system as system4, EntityDamageCause as EntityDamageCause2 } from "@minecraft/server";
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
    source.playAnimation("animation.solaris_verdant.skill_1");
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
          summonOwned(src, "summon ph:animirra_summon ~~1~7 ~~");
          summonOwned(src, "summon ph:animirra_summon ~~1~-7 ~~");
          summonOwned(src, "summon ph:animirra_summon ~7~1~ ~~");
          summonOwned(src, "summon ph:animirra_summon ~-7~1~ ~~");
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
    source.playAnimation("animation.solaris_verdant.skill_2");
    source.runCommand("inputpermission set @s movement disabled");
    const solarisSlash = new CommandHandler([
      {
        delay: 10,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_heavy", src.location);
          summonOwned(src, "summon ph:solaris_slash ^^3^5 ~ 0");
          summonOwned(src, "summon ph:solaris_slash ^^3^5 ~-45 0");
          summonOwned(src, "summon ph:solaris_slash ^^3^5 ~45 0");
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
    source.playAnimation("animation.solaris_verdant.skill_3");
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
          summonOwned(src, "summon ph:animirra_summon_ultimate ~~1~7 ~~");
          summonOwned(src, "summon ph:animirra_summon_ultimate ~~1~-7 ~~");
          summonOwned(src, "summon ph:animirra_summon_ultimate ~7~1~ ~~");
          summonOwned(src, "summon ph:animirra_summon_ultimate ~-7~1~ ~~");
        }
      },
      {
        delay: 10,
        action: (src) => {
          src.runCommand(`scriptevent ph:boss_summon 24, 20, 24, ph:animirra_meteor, custom_sfx.animirra_summon`);
          summonOwned(src, "summon ph:animirra_summon_ultimate ~~1~14 ~~");
          summonOwned(src, "summon ph:animirra_summon_ultimate ~~1~-14 ~~");
          summonOwned(src, "summon ph:animirra_summon_ultimate ~14~1~ ~~");
          summonOwned(src, "summon ph:animirra_summon_ultimate ~-14~1~ ~~");
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
    source.playAnimation("animation.charged_copper_axe.skill_1");
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
    source.playAnimation("animation.charged_copper_axe.skill_2");
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
    source.playAnimation("animation.charged_copper_axe.skill_3");
    const discharge = new CommandHandler([
      {
        delay: 3,
        action: (src) => {
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 90 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 270 0");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 45 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 135 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 215 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 315 0");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 0 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 180 0");
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
    source.playAnimation("animation.charged_copper_axe.skill_4");
    source.runCommand("inputpermission set @s camera disabled");
    source.runCommand("inputpermission set @s movement disabled");
    const discharge = new CommandHandler([
      {
        delay: 3,
        action: (src) => {
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 90 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 270 0");
          summonOwned(src, "summon lightning_bolt ~5~~ ");
          summonOwned(src, "summon lightning_bolt ~-5~~ ");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 45 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 135 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 215 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 315 0");
          summonOwned(src, "summon lightning_bolt ~5~~5 ");
          summonOwned(src, "summon lightning_bolt ~-5~~5 ");
          summonOwned(src, "summon lightning_bolt ~5~~-5 ");
          summonOwned(src, "summon lightning_bolt ~-5~~-5 ");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 2,
        action: (src) => {
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 0 0");
          summonOwned(src, "summon ph:charged_copper_laser ~~~ 180 0");
          summonOwned(src, "summon lightning_bolt ~~~5 ");
          summonOwned(src, "summon lightning_bolt ~~~-5");
          summonOwned(src, "summon lightning_bolt ~10~~ ");
          summonOwned(src, "summon lightning_bolt ~-10~~ ");
          src.dimension.playSound("custom_sfx.high_voltage_spark", src.location);
        }
      },
      {
        delay: 5,
        action: (src) => {
          summonOwned(src, "summon lightning_bolt ~10~~10 ");
          summonOwned(src, "summon lightning_bolt ~-10~~10 ");
          summonOwned(src, "summon lightning_bolt ~10~~-10 ");
          summonOwned(src, "summon lightning_bolt ~-10~~-10 ");
        }
      },
      {
        delay: 5,
        action: (src) => {
          summonOwned(src, "summon lightning_bolt ~~~10 ");
          summonOwned(src, "summon lightning_bolt ~~~-10");
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
    const volley = (src) => {
      for (const [side, up] of [[-1.1, 0.5], [1.1, 0.5], [-0.7, -0.3], [0.7, -0.3]]) fireProjectile(src, prismBubble(side, up));
      src.dimension.playSound("custom_sfx.animirra_summon", src.location);
    };
    const command = new CommandHandler([
      { delay: 7, action: volley },
      { delay: 7, action: volley },
      { delay: 7, action: volley },
      { delay: 7, action: volley },
      { delay: 7, action: volley },
      {
        delay: 7,
        action: (src) => {
          volley(src);
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
    source.playAnimation("animation.prism_weaver.skill_2");
    const command = new CommandHandler([
      {
        delay: 10,
        action: (src) => {
          summonOwned(source, "summon ph:water_wall ^^^4 ~ 0");
          summonOwned(source, "summon ph:water_wall ^-2^^3 ~ 0");
          summonOwned(source, "summon ph:water_wall ^2^^3 ~ 0");
          summonOwned(source, "summon ph:water_wall ^-4^^2 ~ 0");
          summonOwned(source, "summon ph:water_wall ^4^^2 ~ 0");
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
    function normalize3(v) {
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
      const dir = normalize3({ x: dx, y: dy, z: dz });
      const pullStrength = 4.5;
      const impulse = { x: dir.x * pullStrength, y: Math.max(dir.y * 0.7, 0.1), z: dir.z * pullStrength };
      entity.applyImpulse(impulse);
      entity.addEffect("slowness", 60, { amplifier: 255 });
    });
    applyCustomDamage(source, 40, 32);
    source.dimension.spawnParticle("ph:vortex_prism", source.location);
    source.dimension.playSound("custom_sfx.vortex_beam", source.location);
    source.playAnimation("animation.prism_weaver.skill_3");
    const command = new CommandHandler([
      {
        delay: 60,
        action: (src) => {
          const entities2 = src.dimension.getEntities({
            location: src.location,
            maxDistance: 32,
            minDistance: 1
          });
          src.dimension.spawnParticle("ph:vortex_prism_push", src.location);
          function normalize4(v) {
            const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (len === 0) return { x: 0, y: 0, z: 0 };
            return { x: v.x / len, y: v.y / len, z: v.z / len };
          }
          entities2.forEach((entity) => {
            if (!entity || !entity.isValid) return;
            if (!source.isValid) return;
            if (entity.id === source.id) return;
            if (entity.typeId?.startsWith("minecraft:item")) return;
            const dx = source.location.x - entity.location.x;
            const dy = source.location.y - entity.location.y;
            const dz = source.location.z - entity.location.z;
            const dir = normalize4({ x: dx, y: dy, z: dz });
            const pullStrength = 8.6;
            const impulse = { x: dir.x * pullStrength, y: Math.max(dir.y * 0.7, 0.1), z: dir.z * -pullStrength };
            entity.applyImpulse(impulse);
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
    summonOwned(source, `summon armor_stand ~~~ 0 0 a BACKLEAP`);
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
    source.playAnimation("animation.auric_photonizer.skill_3");
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
    source.playAnimation("animation.auric_photonizer.skill_4");
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
    source.playAnimation("animation.the_bleeding_spire.skill_2");
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
      if (!entity.isValid) continue;
      entity.applyDamage(28, {
        damagingEntity: source,
        cause: EntityDamageCause2.magic
      });
      source.addEffect("instant_health", 2, {
        amplifier: 2
      });
      if (!entity.isValid) continue;
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
        system4.runTimeout(() => {
          if (!entity.isValid) return;
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
    source.playAnimation("animation.the_bleeding_spire.skill_3");
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
      if (!entity.isValid) continue;
      entity.applyDamage(12, {
        damagingEntity: source,
        cause: EntityDamageCause2.magic
      });
      source.addEffect("instant_health", 1, {
        amplifier: 2
      });
      if (!entity.isValid) continue;
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
        system4.runTimeout(() => {
          if (!entity.isValid) return;
          entity.runCommand('tellraw @s {"rawtext":[{"text":"Stunned effect is gone!"}]}');
          entity.runCommand("inputpermission set @s jump enabled");
        }, 100);
      }
      const entityLoc = entity.location;
      const pConfig = new MolangVariableMap();
      setAxisDelta(pConfig, playerLoc, entityLoc);
      source.dimension.spawnParticle("ph:entanglement_lead_particle", source.location, pConfig);
    }
    system4.runTimeout(() => {
      if (!source.isValid) return;
      source.runCommand("inputpermission set @s movement enabled");
    }, 20);
  }
});
var weaponSkills = [solarisverdantSkill, superchargedCopperAxeSkill, prismWeaverSkill, auricPhotonizerSkill, theBleedingSpireSkill];

// data/scripts/systems/accessories.ts
import { world as world2, system as system5, ItemStack as ItemStack2, Player as Player6, EquipmentSlot as EquipmentSlot3, GameMode as GameMode2 } from "@minecraft/server";

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
var ARMOUR_SLOTS = [EquipmentSlot3.Head, EquipmentSlot3.Chest, EquipmentSlot3.Legs, EquipmentSlot3.Feet, EquipmentSlot3.Offhand];
var AURIC_CHARGE_ACTIONBAR = 'titleraw @s actionbar {"rawtext":[{"text":"\xA7gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}';
function crimsonLaserCommand(x, z) {
  return `summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`;
}
function addAuricCharge(player) {
  if (!player.isValid) return;
  addScore(player, "auric_charge", 1);
  player.runCommand(AURIC_CHARGE_ACTIONBAR);
}
var accessoryRegistry = {
  "ph:fire_bracelet": {
    onHitEntity(player, target) {
      player.addEffect("fire_resistance", 100, { showParticles: false });
      if (target.isValid) target.setOnFire(7, true);
    }
  },
  "ph:rust_coin": {
    onBreakBlock(player, event) {
      const { block, dimension } = event;
      const drop = ORE_DROPS.get(block.typeId);
      if (!drop) return;
      if (player.getGameMode() === GameMode2.Creative) return;
      const center = block.center();
      system5.run(() => {
        if (!player.isValid) return;
        if (!isLoadedLocation(dimension, center)) return;
        const itemDropped = player.dimension.getEntities({
          location: player.location,
          maxDistance: 5,
          type: "minecraft:item"
        });
        itemDropped.forEach((item) => {
          if (item.isValid) item.teleport(player.location);
        });
        dimension.spawnParticle("ph:rusted_coin_fortune", center);
        dimension.spawnItem(new ItemStack2(drop, 1), player.location);
      });
    }
  },
  "ph:the_crimson_watcher": {
    onHurt(player) {
      system5.run(() => {
        if (!player.isValid) return;
        const randomChance = Math.floor(Math.random() * 101);
        const { x, z } = player.location;
        if (randomChance < 26) summonOwned(player, crimsonLaserCommand(x, z));
      });
    },
    onHitEntity(player, target) {
      if (!target.isValid) return;
      const randomChance = Math.floor(Math.random() * 101);
      const { x, z } = target.location;
      if (randomChance < 26) summonOwned(player, crimsonLaserCommand(x, z), target);
    }
  },
  "ph:auric_proton": {
    onHurt(player) {
      system5.run(() => addAuricCharge(player));
    },
    onHitEntity(player) {
      addAuricCharge(player);
    },
    onLoop(player) {
      system5.run(() => addAuricCharge(player));
    }
  },
  "ph:time_polarizer": {
    onLoop(player) {
      system5.run(() => {
        if (!player.isValid) return;
        player.addEffect("speed", 100, {
          amplifier: 1,
          showParticles: false
        });
      });
    }
  },
  "ph:weeping_repair": {
    onLoop(player) {
      system5.run(() => {
        if (!player.isValid) return;
        const inventory = player.getComponent("minecraft:inventory")?.container;
        const equippable = player.getComponent("minecraft:equippable");
        if (!inventory || !equippable) return;
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
          const equipmentSlot = equippable.getEquipmentSlot(slot);
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
    onLoop(player) {
      if (!player.isInWater) return;
      player.dimension.spawnParticle("ph:time_polarizer_speed", player.location);
      player.addEffect("water_breathing", 20);
      player.addEffect("regeneration", 100, { amplifier: 1 });
    }
  }
};
function handlersFor(player, items = getAccessoryItems(player)) {
  return items.flatMap((item) => accessoryRegistry[item.typeId] ?? []);
}
function accessoryOnHurt(player, items) {
  for (const handlers of handlersFor(player, items)) handlers.onHurt?.(player);
}
function accessoryOnHitEntity(attacker, target) {
  if (!(attacker instanceof Player6)) return;
  for (const handlers of handlersFor(attacker)) handlers.onHitEntity?.(attacker, target);
}
function accessoryOnBreakBlock(player, event) {
  for (const handlers of handlersFor(player)) handlers.onBreakBlock?.(player, event);
}
function tickAccessories() {
  for (const player of world2.getPlayers()) {
    if (!player.isValid) continue;
    for (const handlers of handlersFor(player)) handlers.onLoop?.(player);
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
  const damageData = DamageTypes[damageSource.cause] ?? DamageTypes["none"];
  if (!hurtEntity || !hurtEntity.isValid) return;
  const { center, extent } = hurtEntity.getAABB();
  const radius = Math.hypot(extent.x, extent.z) + 0.3;
  const players = hurtEntity.dimension.getEntities({ type: "minecraft:player", location: center, maxDistance: 64 });
  for (const ent of players) {
    const player = ent;
    if (!player.isValid) continue;
    if (!player.dimension.isChunkLoaded(center)) continue;
    let dx = player.location.x - center.x;
    let dz = player.location.z - center.z;
    let len = Math.hypot(dx, dz);
    if (len < 1e-3) {
      const viewDir = player.getViewDirection();
      dx = -viewDir.x;
      dz = -viewDir.z;
      len = Math.hypot(dx, dz) || 1;
    }
    const loc = {
      x: center.x + dx / len * radius,
      y: center.y + extent.y * 0.5,
      z: center.z + dz / len * radius
    };
    const iconMolang = new MolangVariableMap2();
    const absDamage = Math.min(Math.abs(damageValue), 999999);
    iconMolang.setFloat("variable.length", 1.5);
    iconMolang.setFloat("variable.icon_offset", damageData.icon ?? 14);
    iconMolang.setColorRGB("variable.damagecolor", damageData.color);
    const leftX = -dz / len;
    const leftZ = dx / len;
    const digits = `${absDamage}`;
    for (let i = 0; i < digits.length; i++) {
      const offset = ((digits.length - 1) / 2 - i) / 3;
      const molang = new MolangVariableMap2();
      molang.setFloat("variable.length", 1.5);
      molang.setFloat("variable.digit", Number(digits[i]));
      molang.setColorRGB("variable.damagecolor", damageData.color);
      player.spawnParticle("ph:damage_number", { x: loc.x + leftX * offset, y: loc.y, z: loc.z + leftZ * offset }, molang);
    }
    player.spawnParticle("ph:damage_icons", { x: loc.x, y: loc.y + 0.6, z: loc.z }, iconMolang);
  }
}

// data/scripts/systems/combatDummy.ts
import { system as system6 } from "@minecraft/server";
var COMBAT_TIMEOUT = 5e3;
var DPS_WINDOW = 1e3;
var SMOOTH_SPEED = 0.15;
var DummyStatsMap = /* @__PURE__ */ new Map();
function getStats(dummy) {
  const existing = DummyStatsMap.get(dummy.id);
  if (existing) return existing;
  const stats = {
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

// data/scripts/features/titan_core/manager.ts
import { world as world3, system as system7 } from "@minecraft/server";
var CORE_ID = "ph:titan_core";
var MINION_TAG = "core_minion";
var MINION_TYPES = ["ph:plasmoid_drone", "ph:rupture_drone"];
var FINAL_DEFENSE_COUNT = 30;
var FALLBACK_DIFFICULTY = "normal";
var WAVE_COUNTS = {
  easy: 10,
  normal: 17,
  hard: 22
};
var POLL_INTERVAL = 40;
var WAVE_POLLS_MAX = 120;
var MINION_RANGE = 48;
var fights = /* @__PURE__ */ new Map();
function getFight(core) {
  const existing = fights.get(core.id);
  if (existing) return existing;
  const fight = { phase: 0, shielded: false, watcherPolls: 0 };
  fights.set(core.id, fight);
  return fight;
}
function waveCount() {
  return WAVE_COUNTS[world3.getDifficulty()] ?? WAVE_COUNTS[FALLBACK_DIFFICULTY];
}
function announce(dimension, location, message) {
  for (const player of dimension.getPlayers({ location, maxDistance: 56 })) {
    if (!player.isValid) continue;
    player.onScreenDisplay.setActionBar(message);
  }
}
function summonWave(core, count) {
  if (!core.isValid) return;
  const origin = core.location;
  const dimension = core.dimension;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + Math.random() * 0.5;
    const radius = 4 + Math.random() * 3;
    const typeId = i % 2 === 0 ? MINION_TYPES[0] : MINION_TYPES[1];
    const position = {
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + 1 + i % 3,
      z: origin.z + Math.sin(angle) * radius
    };
    if (!isLoadedLocation(dimension, position)) continue;
    const minion = dimension.spawnEntity(typeId, position);
    minion.addTag(MINION_TAG);
    minion.triggerEvent("ph:core_minion");
  }
  announce(
    dimension,
    origin,
    count === FINAL_DEFENSE_COUNT ? "\xA7cThe Titan Core unleashes its FINAL DEFENSE!" : "\xA7cThe Titan Core summons its defenders!"
  );
}
function countMinions(core) {
  if (!core.isValid) return 0;
  return MINION_TYPES.reduce((alive, typeId) => alive + core.dimension.getEntities({
    type: typeId,
    tags: [MINION_TAG],
    location: core.location,
    maxDistance: MINION_RANGE
  }).length, 0);
}
function endWave(core, fight) {
  if (fight.watcher !== void 0) {
    system7.clearRun(fight.watcher);
    fight.watcher = void 0;
  }
  fight.shielded = false;
  if (!core.isValid) return;
  core.setProperty("ph:shielded", false);
  core.triggerEvent("ph:unshield");
  announce(core.dimension, core.location, "\xA7aThe Titan Core shield has collapsed!");
}
function watchWave(core, fight) {
  fight.watcherPolls = 0;
  const interval = system7.runInterval(() => {
    if (!core.isValid) {
      system7.clearRun(interval);
      if (fight.watcher === interval) fight.watcher = void 0;
      fights.delete(core.id);
      return;
    }
    fight.watcherPolls++;
    const remaining = countMinions(core);
    if (remaining === 0 || fight.watcherPolls >= WAVE_POLLS_MAX) {
      endWave(core, fight);
    }
  }, POLL_INTERVAL);
  fight.watcher = interval;
}
function beginShieldPhase(core, fight, phase) {
  fight.phase = phase;
  fight.shielded = true;
  if (!core.isValid) return;
  core.setProperty("ph:shielded", true);
  core.triggerEvent("ph:shield");
  summonWave(core, waveCount());
  watchWave(core, fight);
}
function onTitanCoreHurt(event) {
  const core = event.hurtEntity;
  if (core.typeId !== CORE_ID) return;
  if (!core.isValid) return;
  const fight = getFight(core);
  if (fight.shielded) return;
  const healthComp = core.getComponent("minecraft:health");
  if (!healthComp) return;
  const health = healthComp.currentValue;
  if (health <= 200 && fight.phase < 2) {
    beginShieldPhase(core, fight, 2);
  } else if (health <= 400 && fight.phase < 1) {
    beginShieldPhase(core, fight, 1);
  }
}
function onTitanCoreDie(core) {
  const fight = fights.get(core.id);
  if (fight) {
    if (fight.watcher !== void 0) {
      system7.clearRun(fight.watcher);
      fight.watcher = void 0;
    }
    fights.delete(core.id);
  }
  if (!core.isValid) return;
  if (!isLoadedLocation(core.dimension, core.location)) return;
  core.dimension.spawnParticle("minecraft:huge_explosion_emitter", core.location);
  core.dimension.playSound("beacon.deactivate", core.location, { pitch: 0.6, volume: 1 });
  summonWave(core, FINAL_DEFENSE_COUNT);
}

// data/scripts/features/ancient_sentinel/manager.ts
import {
  world as world4,
  system as system8,
  EntityDamageCause as EntityDamageCause3,
  GameMode as GameMode3,
  MolangVariableMap as MolangVariableMap3
} from "@minecraft/server";
var SENTINEL_ID = "ph:ancient_sentinel";
var STATE_PROP = "ph:sentinel_state";
var ROLL_YAW_PROP = "ph:roll_yaw";
var TAG_RAGED = "ph:sentinel_enraged";
var TAG_KNOCKED = "parried";
var WAKE_SCAN_RANGE = 14;
var COMBAT_RANGE = 30;
var BALL_TRIGGER_MIN = 4;
var BALL_TRIGGER_MAX = 26;
var ROLL_TRIGGER_MIN = 3;
var LAUNCH_VELOCITY = 1.2;
var RELAUNCH_VELOCITY = 0.9;
var ROLL_SPEED = 0.48;
var ROLL_MAX_TICKS = 110;
var ROLL_MAX_BOUNCES = 8;
var ROLL_CONTACT_RANGE = 2.3;
var CONTACT_REHIT_MS = 600;
var BALL_CD_NORMAL = 8e3;
var BALL_CD_ENRAGED = 5e3;
var ROLL_CD_NORMAL = 9500;
var ROLL_CD_ENRAGED = 6500;
var SPECIAL_GAP_MS = 5e3;
var SLAM_BIG_RADIUS = 6;
var SLAM_BIG_DAMAGE = 16;
var SLAM_BIG_DAMAGE_ENRAGED = 22;
var SLAM_SMALL_RADIUS = 4;
var SLAM_SMALL_DAMAGE = 8;
var SLAM_SMALL_DAMAGE_ENRAGED = 12;
var ROLL_DAMAGE = 9;
var ROLL_DAMAGE_ENRAGED = 13;
var TELEGRAPH_INTERVAL = 8;
var CHARGE_TELEGRAPH_MARKS = 8;
var CHARGE_TELEGRAPH_SPACING = 1.5;
var fights2 = /* @__PURE__ */ new Map();
function makeFight() {
  return { state: "dormant", lastSpecial: "", ballCd: 0, rollCd: 0, specialGapUntil: 0, enraged: false };
}
function getFight2(entity) {
  const existing = fights2.get(entity.id);
  if (existing) return existing;
  const fight = makeFight();
  fights2.set(entity.id, fight);
  return fight;
}
function announce2(dimension, location, message) {
  for (const player of dimension.getPlayers({ location, maxDistance: 48 })) {
    if (!player.isValid) continue;
    player.onScreenDisplay.setActionBar(message);
  }
}
function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
function flatMagnitude(vector) {
  return Math.sqrt(vector.x * vector.x + vector.z * vector.z) || 1;
}
function nearestPlayer(entity, maxDistance) {
  if (!entity.isValid) return void 0;
  const candidates = entity.dimension.getPlayers({
    location: entity.location,
    maxDistance,
    closest: 1,
    excludeGameModes: [GameMode3.Creative, GameMode3.Spectator]
  });
  return candidates.find((candidate) => candidate.isValid);
}
function isEligibleVictim(candidate, sentinel) {
  if (!candidate.isValid) return false;
  if (candidate.id === sentinel.id) return false;
  if (candidate.hasTag(TAG_KNOCKED)) return false;
  const families = candidate.getComponent("minecraft:type_family")?.getTypeFamilies();
  if (families?.includes("sentinel")) return false;
  if (candidate.typeId === "minecraft:player") {
    const mode = candidate.getGameMode();
    if (mode === GameMode3.Creative || mode === GameMode3.Spectator) return false;
  }
  return true;
}
function blockBelow(entity) {
  const feet = entity.location;
  const location = { x: Math.floor(feet.x), y: Math.floor(feet.y - 0.06), z: Math.floor(feet.z) };
  if (!isLoadedLocation(entity.dimension, location)) return void 0;
  return entity.dimension.getBlock(location);
}
function isAerialPlayer(player) {
  if (!player.isValid) return false;
  if (player.getVelocity().y > 0.03) return true;
  const below = blockBelow(player);
  return !below || below.isAir || below.isLiquid;
}
function isStandingOnGround(entity) {
  if (!entity.isValid) return false;
  const below = blockBelow(entity);
  return !!below && !below.isAir && !below.isLiquid;
}
function spawnFx(entity, particle, location, radius, delay) {
  if (!entity.isValid) return;
  if (!isLoadedLocation(entity.dimension, location)) return;
  const vars = new MolangVariableMap3();
  if (radius !== void 0) vars.setFloat("variable.radius", radius);
  if (delay !== void 0) vars.setFloat("variable.delay", delay);
  entity.dimension.spawnParticle(particle, location, vars);
}
function playAt(entity, sound, options) {
  if (!entity.isValid) return;
  if (!isLoadedLocation(entity.dimension, entity.location)) return;
  entity.dimension.playSound(sound, entity.location, options);
}
function slamRadius(fight, big) {
  if (!big) return SLAM_SMALL_RADIUS;
  return fight.enraged ? SLAM_BIG_RADIUS + 1 : SLAM_BIG_RADIUS;
}
function slamTelegraph(entity, fight) {
  const radius = slamRadius(fight, (fight.hopsLeft ?? 1) <= 1);
  const spot = { x: entity.location.x, y: fight.groundY ?? entity.location.y, z: entity.location.z };
  spawnFx(entity, "ph:sentinel_slam_telegraph", spot, radius);
  spawnFx(entity, "ph:sentinel_slam_telegraph_pulse", spot, radius);
  spawnFx(entity, "ph:sentinel_slam_telegraph_edge", spot, radius);
}
function chargeTelegraph(entity, dir) {
  const origin = entity.location;
  for (let i = 1; i <= CHARGE_TELEGRAPH_MARKS; i++) {
    const step = i * CHARGE_TELEGRAPH_SPACING;
    spawnFx(
      entity,
      "ph:sentinel_charge_telegraph",
      { x: origin.x + dir.x * step, y: origin.y, z: origin.z + dir.z * step },
      void 0,
      i * 0.035
    );
  }
}
function readSentinelState(entity) {
  if (!entity.isValid) return "dormant";
  const state = String(entity.getProperty(STATE_PROP));
  switch (state) {
    case "dormant":
    case "awakening":
    case "active":
    case "ball":
    case "roll":
    case "unrolling":
      return state;
  }
  return "dormant";
}
function setSentinelState(entity, state) {
  if (!entity.isValid) return;
  entity.setProperty(STATE_PROP, state);
}
function faceRollDirection(entity, fight) {
  const dir = fight.rollDir;
  if (!dir) return;
  if (!entity.isValid) return;
  const yaw = Math.atan2(-dir.x, dir.z) * (180 / Math.PI);
  entity.setRotation({ x: 0, y: yaw });
  entity.setProperty(ROLL_YAW_PROP, yaw);
}
function think(entity, fight) {
  if (!entity.isValid) {
    dropFight(entity);
    return;
  }
  switch (fight.state) {
    case "dormant": {
      const stalker = nearestPlayer(entity, WAKE_SCAN_RANGE);
      if (stalker) beginAwaken(entity, fight);
      return;
    }
    case "active":
      combatCycle(entity, fight);
      return;
    default:
      return;
  }
}
function combatCycle(entity, fight) {
  const target = nearestPlayer(entity, COMBAT_RANGE);
  if (!target) return;
  const distance = horizontalDistance(entity.location, target.location);
  const now = Date.now();
  if (now < fight.specialGapUntil) return;
  const ballReady = now >= fight.ballCd && distance >= BALL_TRIGGER_MIN && distance <= BALL_TRIGGER_MAX;
  const rollReady = now >= fight.rollCd && distance >= ROLL_TRIGGER_MIN;
  if (!ballReady && !rollReady) return;
  const pick = ballReady && rollReady ? fight.lastSpecial === "ball" ? "roll" : "ball" : ballReady ? "ball" : "roll";
  fight.lastSpecial = pick;
  if (pick === "ball") {
    startBall(entity, fight);
  } else {
    startRoll(entity, fight, target);
  }
}
function beginAwaken(entity, fight) {
  if (fight.state !== "dormant" || !entity.isValid) return;
  fight.state = "awakening";
  entity.triggerEvent("ph:awaken");
  setSentinelState(entity, "awakening");
  spawnFx(entity, "minecraft:knockback_roar_particle", {
    x: entity.location.x,
    y: entity.location.y + 0.9,
    z: entity.location.z
  });
  playAt(entity, "beacon.deactivate", { pitch: 0.5, volume: 1 });
  playAt(entity, "mob.armadillo.ambient", { pitch: 0.6, volume: 1 });
  system8.runTimeout(() => finishAwaken(entity, fight), 52);
}
function finishAwaken(entity, fight) {
  if (!entity.isValid) {
    dropFight(entity);
    return;
  }
  const health = entity.getComponent("minecraft:health");
  if (fight.state !== "awakening" || !health || health.currentValue <= 0) return;
  fight.state = "active";
  entity.triggerEvent("ph:wake_up");
  setSentinelState(entity, "active");
  entity.playAnimation("animation.ph.sentinel.roar");
  spawnFx(entity, "minecraft:knockback_roar_particle", {
    x: entity.location.x,
    y: entity.location.y + 1,
    z: entity.location.z
  });
  playAt(entity, "mob.ravager.roar", { pitch: 0.85, volume: 1 });
  playAt(entity, "mob.armadillo.unroll_finish", { pitch: 0.7, volume: 1 });
  const now = Date.now();
  fight.ballCd = now + 4e3;
  fight.rollCd = now + 8e3;
  announce2(entity.dimension, entity.location, "\xA74[BOSS] The Ancient Sentinel has awakened after a thousand years!");
  system8.runTimeout(() => {
    if (!entity.isValid) return;
    announce2(
      entity.dimension,
      entity.location,
      "\xA77Tip: JUMP when the Sentinel slams down - HIT the rolling ball to bat its charge away."
    );
  }, 60);
}
function startBall(entity, fight) {
  if (!entity.isValid) return;
  fight.state = "ball";
  fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);
  entity.triggerEvent("ph:start_ball");
  setSentinelState(entity, "ball");
  const now = Date.now();
  fight.ballCd = now + (fight.enraged ? BALL_CD_ENRAGED : BALL_CD_NORMAL);
  fight.hopsLeft = fight.enraged ? 2 : 1;
  fight.groundY = entity.location.y;
  slamTelegraph(entity, fight);
  system8.runTimeout(() => {
    if (entity.isValid && fight.state === "ball") slamTelegraph(entity, fight);
  }, TELEGRAPH_INTERVAL);
  playAt(entity, "mob.armadillo.roll", { pitch: 1.1, volume: 1 });
  system8.runTimeout(() => {
    if (!entity.isValid || fight.state !== "ball") return;
    fight.flightTicks = 0;
    entity.applyImpulse({ x: 0, y: LAUNCH_VELOCITY, z: 0 });
    entity.playAnimation("animation.ph.sentinel.launch");
    fight.ballLoopId = system8.runInterval(() => ballTick(entity, fight), 1);
  }, 12);
}
function ballTick(entity, fight) {
  if (!entity.isValid) {
    if (fight.ballLoopId !== void 0) system8.clearRun(fight.ballLoopId);
    fight.ballLoopId = void 0;
    dropFight(entity);
    return;
  }
  fight.flightTicks = (fight.flightTicks ?? 0) + 1;
  if (fight.flightTicks % TELEGRAPH_INTERVAL === 0) slamTelegraph(entity, fight);
  const velocity = entity.getVelocity();
  const grounded = Math.abs(velocity.y) < 0.03 && isStandingOnGround(entity);
  if (!grounded && fight.flightTicks < 130) return;
  if (fight.ballLoopId !== void 0) {
    system8.clearRun(fight.ballLoopId);
    fight.ballLoopId = void 0;
  }
  fight.hopsLeft = (fight.hopsLeft ?? 0) - 1;
  if (fight.hopsLeft > 0) {
    shockwave(entity, fight, false);
    fight.flightTicks = 0;
    if (entity.isValid) {
      entity.applyImpulse({ x: 0, y: RELAUNCH_VELOCITY, z: 0 });
      entity.playAnimation("animation.ph.sentinel.launch");
    }
    fight.ballLoopId = system8.runInterval(() => ballTick(entity, fight), 1);
    return;
  }
  if (entity.isValid) entity.playAnimation("animation.ph.sentinel.slam");
  shockwave(entity, fight, true);
  system8.runTimeout(() => {
    if (!entity.isValid || fight.state !== "ball") return;
    resumeCombat(entity, fight, true);
  }, 8);
}
function shockwave(entity, fight, big) {
  if (!entity.isValid) return;
  const center = { x: entity.location.x, y: entity.location.y + 0.4, z: entity.location.z };
  const radius = slamRadius(fight, big);
  const damage = big ? fight.enraged ? SLAM_BIG_DAMAGE_ENRAGED : SLAM_BIG_DAMAGE : fight.enraged ? SLAM_SMALL_DAMAGE_ENRAGED : SLAM_SMALL_DAMAGE;
  if (!isLoadedLocation(entity.dimension, center)) return;
  entity.dimension.playSound("random.explode", center, { pitch: big ? 0.9 : 1.1, volume: 1 });
  entity.dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
  entity.dimension.spawnParticle("minecraft:knockback_roar_particle", center);
  if (big) {
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * Math.PI * 2;
      spawnFx(entity, "minecraft:basic_smoke_particle", {
        x: center.x + Math.cos(angle) * 2.4,
        y: center.y + 0.2,
        z: center.z + Math.sin(angle) * 2.4
      });
    }
  }
  const ground = entity.location;
  spawnFx(entity, "ph:sentinel_impact_ring", ground, radius);
  spawnFx(entity, "ph:sentinel_impact_dust", ground, radius);
  spawnFx(entity, "ph:sentinel_impact_debris", ground, radius);
  const victims = entity.dimension.getEntities({ location: center, maxDistance: radius });
  for (const victim of victims) {
    if (!isEligibleVictim(victim, entity)) continue;
    if (victim.typeId === "minecraft:player" && isAerialPlayer(victim)) {
      victim.onScreenDisplay.setActionBar("\xA7aDODGED! You jumped over the shockwave!");
      continue;
    }
    if (!entity.isValid) return;
    victim.applyDamage(damage, {
      cause: EntityDamageCause3.entityAttack,
      damagingEntity: entity
    });
    if (!victim.isValid) continue;
    const flatAway = flatMagnitude({ x: victim.location.x - center.x, z: victim.location.z - center.z }) || 1;
    const awayX = (victim.location.x - center.x) / flatAway;
    const awayZ = (victim.location.z - center.z) / flatAway;
    victim.applyKnockback({ x: awayX * 1.9, z: awayZ * 1.9 }, 0.6);
  }
  if (!entity.isValid) return;
  for (const player of entity.dimension.getPlayers({ location: center, maxDistance: 16 })) {
    if (!player.isValid) continue;
    player.runCommand("camerashake add @s 0.4 0.6 positional");
  }
}
function startRoll(entity, fight, target) {
  if (!entity.isValid || !target.isValid) return;
  fight.state = "roll";
  fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);
  entity.triggerEvent("ph:start_roll");
  setSentinelState(entity, "roll");
  const now = Date.now();
  fight.rollCd = now + (fight.enraged ? ROLL_CD_ENRAGED : ROLL_CD_NORMAL);
  const flat = flatMagnitude({ x: target.location.x - entity.location.x, z: target.location.z - entity.location.z });
  fight.rollDir = {
    x: (target.location.x - entity.location.x) / flat,
    z: (target.location.z - entity.location.z) / flat
  };
  fight.rollTicks = 0;
  fight.rollBounces = 0;
  fight.ticksSinceBounce = 0;
  fight.hitLocks = /* @__PURE__ */ new Map();
  faceRollDirection(entity, fight);
  chargeTelegraph(entity, fight.rollDir);
  playAt(entity, "mob.armadillo.roll", { pitch: 0.8, volume: 1 });
  system8.runTimeout(() => {
    if (!entity.isValid || fight.state !== "roll") return;
    fight.rollLoopId = system8.runInterval(() => rollTick(entity, fight), 1);
  }, 9);
}
function rollTick(entity, fight) {
  if (!entity.isValid || !fight.rollDir) {
    if (fight.rollLoopId !== void 0) {
      system8.clearRun(fight.rollLoopId);
      fight.rollLoopId = void 0;
    }
    if (!entity.isValid) dropFight(entity);
    return;
  }
  fight.rollTicks = (fight.rollTicks ?? 0) + 1;
  fight.ticksSinceBounce = (fight.ticksSinceBounce ?? 0) + 1;
  rollStep(entity, fight);
  if ((fight.ticksSinceBounce ?? 0) >= 6) rollWallCheck(entity, fight);
  if ((fight.rollTicks ?? 0) % 2 === 0) {
    rollTrail(entity, fight);
    rollContactDamage(entity, fight);
  }
  if ((fight.rollTicks ?? 0) >= ROLL_MAX_TICKS || (fight.rollBounces ?? 0) >= ROLL_MAX_BOUNCES) {
    if (fight.rollLoopId !== void 0) {
      system8.clearRun(fight.rollLoopId);
      fight.rollLoopId = void 0;
    }
    resumeCombat(entity, fight, true);
  }
}
function rollStep(entity, fight) {
  const dir = fight.rollDir;
  if (!dir || !entity.isValid) return;
  const velocity = entity.getVelocity();
  const driftX = dir.x * ROLL_SPEED - velocity.x;
  const driftZ = dir.z * ROLL_SPEED - velocity.z;
  if (Math.abs(driftX) > 0.02 || Math.abs(driftZ) > 0.02) {
    entity.applyImpulse({ x: driftX, y: 0, z: driftZ });
  }
}
function rollWallCheck(entity, fight) {
  const dir = fight.rollDir;
  if (!dir || !entity.isValid) return;
  const origin = entity.location;
  for (const height of [0.45, 1.15]) {
    const rayStart = { x: origin.x + dir.x * 1, y: origin.y + height, z: origin.z + dir.z * 1 };
    if (!isLoadedLocation(entity.dimension, rayStart)) return;
    const hit = entity.dimension.getBlockFromRay(
      rayStart,
      { x: dir.x, y: 0, z: dir.z },
      { includeLiquidBlocks: false, includePassableBlocks: false, maxDistance: 1.4 }
    );
    if (!hit) continue;
    fight.rollDir = { x: -dir.x, z: -dir.z };
    fight.ticksSinceBounce = 0;
    fight.rollBounces = (fight.rollBounces ?? 0) + 1;
    faceRollDirection(entity, fight);
    entity.playAnimation("animation.ph.sentinel.slam");
    playAt(entity, "mob.armadillo.land", { pitch: 0.8, volume: 1 });
    spawnFx(entity, "minecraft:basic_smoke_particle", {
      x: origin.x + dir.x * 1.2,
      y: origin.y + 0.8,
      z: origin.z + dir.z * 1.2
    });
    return;
  }
}
function rollTrail(entity, fight) {
  const dir = fight.rollDir;
  if (!dir || !entity.isValid) return;
  spawnFx(entity, "minecraft:basic_smoke_particle", {
    x: entity.location.x - dir.x * 0.9,
    y: entity.location.y + 0.6,
    z: entity.location.z - dir.z * 0.9
  });
}
function rollContactDamage(entity, fight) {
  const locks2 = fight.hitLocks ?? (fight.hitLocks = /* @__PURE__ */ new Map());
  const now = Date.now();
  const damage = fight.enraged ? ROLL_DAMAGE_ENRAGED : ROLL_DAMAGE;
  const dir = fight.rollDir;
  if (!dir || !entity.isValid) return;
  const victims = entity.dimension.getEntities({
    location: entity.location,
    maxDistance: ROLL_CONTACT_RANGE
  });
  for (const victim of victims) {
    if (!isEligibleVictim(victim, entity)) continue;
    if (Math.abs(victim.location.y - entity.location.y) > 2.2) continue;
    const lockUntil = locks2.get(victim.id);
    if (lockUntil !== void 0 && now < lockUntil) continue;
    locks2.set(victim.id, now + CONTACT_REHIT_MS);
    if (!entity.isValid) return;
    victim.applyDamage(damage, {
      cause: EntityDamageCause3.entityAttack,
      damagingEntity: entity
    });
    if (!victim.isValid) continue;
    victim.applyKnockback({ x: dir.x * 1.6, z: dir.z * 1.6 }, 0.35);
  }
}
function resumeCombat(entity, fight, withUnroll) {
  if (fight.ballLoopId !== void 0) {
    system8.clearRun(fight.ballLoopId);
    fight.ballLoopId = void 0;
  }
  if (fight.rollLoopId !== void 0) {
    system8.clearRun(fight.rollLoopId);
    fight.rollLoopId = void 0;
  }
  if (!entity.isValid || !withUnroll) {
    fight.state = "active";
    fight.specialGapUntil = Date.now() + SPECIAL_GAP_MS;
    return;
  }
  fight.state = "unrolling";
  entity.triggerEvent("ph:resume_combat");
  setSentinelState(entity, "unrolling");
  system8.runTimeout(() => {
    if (!entity.isValid) {
      dropFight(entity);
      return;
    }
    const health = entity.getComponent("minecraft:health");
    if (fight.state !== "unrolling" || !health || health.currentValue <= 0) return;
    fight.state = "active";
    fight.specialGapUntil = Date.now() + SPECIAL_GAP_MS;
    entity.triggerEvent("ph:end_unroll");
    setSentinelState(entity, "active");
  }, 15);
}
function dropFight(entity) {
  const fight = fights2.get(entity.id);
  if (fight?.thinkId !== void 0) system8.clearRun(fight.thinkId);
  fights2.delete(entity.id);
}
function onSentinelSpawn(entity) {
  if (!entity || entity.typeId !== SENTINEL_ID) return;
  if (!entity.isValid) return;
  const fight = getFight2(entity);
  if (fight.thinkId === void 0) {
    fight.state = readSentinelState(entity);
    if (fight.state === "ball" || fight.state === "roll" || fight.state === "unrolling") {
      resumeCombat(entity, fight, true);
    } else if (fight.state === "awakening") {
      fight.state = "active";
      entity.triggerEvent("ph:wake_up");
      setSentinelState(entity, "active");
    }
    fight.enraged = fight.enraged || entity.hasTag(TAG_RAGED);
    fight.thinkId = system8.runInterval(() => think(entity, fight), 4);
  }
}
function onSentinelHurt(event) {
  const sentinel = event.hurtEntity;
  if (!sentinel || sentinel.typeId !== SENTINEL_ID || !sentinel.isValid) return;
  const fight = getFight2(sentinel);
  const health = sentinel.getComponent("minecraft:health");
  if (health && health.effectiveMax > 0 && !fight.enraged && health.currentValue <= health.effectiveMax / 2) {
    fight.enraged = true;
    sentinel.addTag(TAG_RAGED);
    sentinel.triggerEvent("ph:rage");
    sentinel.playAnimation("animation.ph.sentinel.roar");
    playAt(sentinel, "mob.ravager.roar", { pitch: 0.8, volume: 1 });
  }
  if (fight.state === "dormant") {
    beginAwaken(sentinel, fight);
    return;
  }
  if (!sentinel.isValid) return;
  if (fight.state === "roll" && event.damageSource?.damagingEntity?.typeId === "minecraft:player" && fight.rollDir) {
    const attacker = event.damageSource.damagingEntity;
    if (!attacker.isValid) return;
    const flat = flatMagnitude({ x: sentinel.location.x - attacker.location.x, z: sentinel.location.z - attacker.location.z });
    fight.rollDir = {
      x: (sentinel.location.x - attacker.location.x) / flat,
      z: (sentinel.location.z - attacker.location.z) / flat
    };
    fight.ticksSinceBounce = 3;
    faceRollDirection(sentinel, fight);
    spawnFx(sentinel, "ph:parry_success", {
      x: sentinel.location.x,
      y: sentinel.location.y + 1.1,
      z: sentinel.location.z
    });
    playAt(sentinel, "mob.armadillo.land", { pitch: 1.4, volume: 0.7 });
  }
}
function onSentinelHit(damagingEntity, hitEntity) {
  if (!hitEntity || hitEntity.typeId !== SENTINEL_ID || !hitEntity.isValid) return;
  if (!damagingEntity?.isValid) return;
  const fight = getFight2(hitEntity);
  if (fight.state === "dormant") beginAwaken(hitEntity, fight);
}
function onSentinelDie(entity) {
  dropFight(entity);
}
var SWEEP_DIMENSION_IDS = ["overworld", "nether", "the_end"];
function sweepSentinels() {
  for (const dimensionId of SWEEP_DIMENSION_IDS) {
    const tracked = world4.getDimension(dimensionId).getEntities({ type: SENTINEL_ID });
    for (const entity of tracked) {
      if (!entity.isValid) continue;
      if (fights2.has(entity.id)) continue;
      onSentinelSpawn(entity);
    }
  }
}

// data/scripts/systems/lighting.ts
import { system as system9, BlockPermutation as BlockPermutation2 } from "@minecraft/server";
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
  if (!player.isValid) return;
  if (!player.dimension.isChunkLoaded(player.location)) return;
  for (let i = 0; i <= 15; i++) {
    player.runCommand(`fill ~-16~-8~-16~16~8~16 air replace light_block_${i}`);
  }
}
function clearPlacedLight(state) {
  const block = state.lastLightBlock;
  state.lastLightBlock = void 0;
  if (!block?.isValid) return;
  if (!block.typeId.startsWith("minecraft:light_block")) return;
  block.setType("minecraft:air");
}
function safeRemoveTag(player, tag) {
  if (!player?.isValid) return;
  if (player.hasTag(tag)) player.removeTag(tag);
}
function clearPlayerLighting(player) {
  const key = player?.id;
  if (key === void 0) return;
  const state = lightingStates.get(key);
  if (!state) return;
  if (state.interval !== -1) system9.clearRun(state.interval);
  lightingStates.delete(key);
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
      system9.clearRun(existing.interval);
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
    const finalLocation = player.getHeadLocation();
    if (!isLoadedLocation(player.dimension, finalLocation)) return;
    const block = player.dimension.getBlock(finalLocation);
    if (!block) return;
    if (!block.isAir && !block.isLiquid) return;
    clearPlacedLight(state);
    block.setPermutation(
      BlockPermutation2.resolve("minecraft:light_block", {
        block_light_level: state.maxLight
      })
    );
    state.lastLightBlock = block;
  };
  updateLight();
  state.interval = system9.runInterval(updateLight, 4);
}

// data/scripts/systems/movement.ts
import { world as world5, system as system10, EquipmentSlot as EquipmentSlot4 } from "@minecraft/server";
function dashRuntime(player) {
  const scoreboard_dash = world5.scoreboard.getObjective("dash_cd");
  if (!scoreboard_dash || (scoreboard_dash.getScore(player) ?? 0) > 0) return;
  if (player.getDynamicProperty("ph:dash_unlock") == 0) return;
  const dashLevel = player.getDynamicProperty("ph:dash_level");
  if (dashLevel == void 0 || dashLevel != 1 && dashLevel != 2) return;
  const equipmentTag = player?.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot4.Mainhand)?.getTags();
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
  const { x, y, z } = player.location;
  const checkHeights = [1, 2, 3, 4, 6, 8, 10];
  const minHeight = player.dimension.heightRange.min;
  const isHighEnough = checkHeights.every((i) => {
    const location = { x: Math.floor(x), y: Math.floor(y) - i, z: Math.floor(z) };
    if (location.y < minHeight) return true;
    const block = player.dimension.getBlock(location);
    return !block || block.typeId === "minecraft:air";
  });
  if (!isHighEnough) return;
  if (player.hasTag("windPlunge")) return;
  function impact2() {
    if (!player.isValid || !player.getComponent("minecraft:health")) return;
    if (player.hasTag("windPlunge")) {
      player.removeEffect("resistance");
      player.dimension.spawnParticle("minecraft:breeze_wind_explosion_emitter", player.location);
      player.runCommand("damage @e[r=6,rm=0.1] 10 entity_explosion entity @s");
      player.dimension.playSound("random.explode", player.location);
      player.removeTag("windPlunge");
    }
  }
  const runInterval = system10.runInterval(() => {
    if (!player.isValid) {
      system10.clearRun(runInterval);
      return;
    }
    if (!player.isOnGround) return;
    system10.run(impact2);
    system10.clearRun(runInterval);
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
function strippingSound(typeId) {
  if (typeId === "minecraft:cherry_log") return "step.cherry_wood";
  if (typeId.includes("log")) return "use.wood";
  if (typeId.includes("stem")) return "use.stem";
  if (typeId.includes("bamboo")) return "step.bamboo_wood";
  return void 0;
}
function vanillaBlockInteractFix(player, item, block) {
  if (!item || !item.hasComponent(`ph:vanilla_tool_fix`)) return;
  const tags = block.getTags();
  const typeId = block.typeId;
  if (item.hasTag("minecraft:is_axe")) {
    system10.runTimeout(() => {
      if (!player.isValid || !block.isValid) return;
      if (typeId.includes("stripped") || !block.typeId.includes("stripped")) return;
      const materialSound = strippingSound(typeId);
      if (!materialSound) return;
      player.dimension.playSound(materialSound, block.center(), { volume: 1, pitch: 0.8 });
      applyDurabilityDamage(player);
    }, 1);
  } else if (item.hasTag("minecraft:is_hoe")) {
    system10.runTimeout(() => {
      if (!player.isValid || !block.isValid) return;
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
    system10.run(() => {
      if (!player.isValid) return;
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
  "ph:prismatic_sword",
  "ph:xeon_plasm_sword"
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
  system10.runTimeout(() => {
    if (!source.isValid) return;
    if (source.hasTag("parried")) source.removeTag("parried");
    source.inputPermissions.setPermissionCategory(2, true);
  }, 6);
}
function startBetterMending(source, itemStack) {
  if (!source.isSneaking || !itemStack) return;
  const enchantment = itemStack?.getComponent("minecraft:enchantable")?.getEnchantment("mending");
  if (itemStack.hasTag("minecraft:is_tools") || itemStack.hasTag("minecraft:is_armor")) return;
  if (!enchantment) return;
  source.playSound("random.anvil_use");
  const runBetterMending = system10.runInterval(() => {
    if (!source.isValid) {
      system10.clearRun(runBetterMending);
      return;
    }
    const equippable = source.getComponent("minecraft:equippable");
    const currentItem = equippable?.getEquipment(EquipmentSlot4.Mainhand);
    const durability = currentItem?.getComponent("minecraft:durability");
    const experience = source.getTotalXp();
    if (!equippable || !currentItem || !durability || durability.damage <= 0 || experience <= 0) {
      system10.clearRun(runBetterMending);
      return;
    }
    const repairAmount = Math.min(durability.damage, 1);
    durability.damage -= repairAmount;
    equippable.setEquipment(EquipmentSlot4.Mainhand, currentItem);
    source.addExperience(-2);
    if (source.xpEarnedAtCurrentLevel <= 2) {
      source.addExperience(source.totalXpNeededForNextLevel - 1);
      source.addLevels(-1);
    }
    source.playSound("random.orb", {
      pitch: Math.min(0.8, Math.random() + 0.5),
      volume: 0.5
    });
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
var ABSORPTION_BASE = 8;
var ABSORPTION_PER_LEVEL = 2;
var absorptionPool = /* @__PURE__ */ new Map();
function absorptionFor(amplifier) {
  return ABSORPTION_BASE + ABSORPTION_PER_LEVEL * amplifier;
}
function onAbsorptionAdded(player, amplifier) {
  const max = absorptionFor(amplifier);
  absorptionPool.set(player.id, { amount: max, max });
  healthBarRuntime(player, "absorptionChanged");
}
function onAbsorptionHurt(player, damage) {
  const pool = absorptionPool.get(player.id);
  if (!pool || pool.amount <= 0) return;
  pool.amount = Math.max(0, pool.amount - damage);
  healthBarRuntime(player, "absorptionChanged");
}
function syncAbsorption(player) {
  const effect = player.getEffect("absorption");
  const tracked = absorptionPool.has(player.id);
  if (effect && !tracked) {
    onAbsorptionAdded(player, effect.amplifier);
  } else if (!effect && tracked) {
    absorptionPool.delete(player.id);
    healthBarRuntime(player, "absorptionChanged");
  }
}
function clearAbsorption(player) {
  absorptionPool.delete(player.id);
}
function healthBarDisplay(player, health, totalArmor, maxHealth) {
  const pool = absorptionPool.get(player.id);
  const absorbing = pool !== void 0 && pool.amount > 0;
  const current = health.currentValue + (absorbing ? pool.amount : 0);
  const max = maxHealth + (absorbing ? pool.max : 0);
  const scaled = current / max * 100;
  const color = absorbing ? "\xA7e" : "";
  player.onScreenDisplay.setTitle(
    `bar0:${color}${Math.min(100, Math.max(0, Math.floor(scaled)))}%% healthind:${Math.floor(current)}/${max}\uE101${totalArmor}`,
    { fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 }
  );
}
function healthBarRuntime(player, eventType, beforeItemStack, afterItemStack) {
  if (player.typeId !== "minecraft:player") return;
  const health = player?.getComponent("minecraft:health");
  const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
  const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
  if (!health || !maxHealth) return;
  if (eventType == "healthChanged" || eventType == "absorptionChanged") {
    healthBarDisplay(player, health, totalArmor, maxHealth);
  }
  if (eventType == "inventoryItemChanged") {
    if (!beforeItemStack?.hasTag("minecraft:is_armor") && !afterItemStack?.hasTag("minecraft:is_armor")) return;
    healthBarDisplay(player, health, totalArmor, maxHealth);
  }
  if (eventType == "dimensionChanged") {
    runUntilMoved(player, 10, () => {
      if (!player.isValid) return;
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
import "@minecraft/server";
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
function elapsed(now, then) {
  const gap = now - then;
  return gap < 0 ? Infinity : gap;
}
function getState(player) {
  const existing = states.get(player.id);
  if (existing) return existing;
  const state = {
    dash: readControl(player, "ph:dash_control", DASH_CONTROL_NAMES.length),
    skill: readControl(player, "ph:skill_switch_control", SKILL_SWITCH_CONTROL_NAMES.length),
    jumpAt: -Infinity,
    sneakAt: -Infinity
  };
  states.set(player.id, state);
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
function onControlButtonInput(player, button) {
  if (button != "Jump" && button != "Sneak") return;
  const now = Date.now();
  const state = getState(player);
  if (button == "Jump") {
    const doubleTapped2 = elapsed(now, state.jumpAt) <= DOUBLE_TAP_WINDOW;
    state.jumpAt = now;
    if (state.dash == DASH_CONTROL.SPRINT_JUMP) {
      if (player.isSprinting) return "dash";
    } else if (state.dash == DASH_CONTROL.DOUBLE_TAP_JUMP && doubleTapped2) {
      return "dash";
    }
    return;
  }
  const doubleTapped = elapsed(now, state.sneakAt) <= DOUBLE_TAP_WINDOW;
  state.sneakAt = now;
  if (state.dash == DASH_CONTROL.JUMP_SNEAK && elapsed(now, state.jumpAt) <= COMBO_WINDOW) {
    state.jumpAt = -Infinity;
    return "airDash";
  }
  if (state.skill == SKILL_SWITCH_CONTROL.SNEAK) {
    return player.isSneaking ? "switchSkill" : void 0;
  }
  if (state.skill == SKILL_SWITCH_CONTROL.DOUBLE_SNEAK && doubleTapped) {
    state.sneakAt = -Infinity;
    return "switchSkill";
  }
}
function onControlSwingInput(player, swingSource) {
  if (swingSource != "Mine" && swingSource != "Attack") return;
  const state = getState(player);
  if (state.skill != SKILL_SWITCH_CONTROL.SNEAK_ATTACK) return;
  if (elapsed(Date.now(), state.sneakAt) > COMBO_WINDOW) return;
  state.sneakAt = -Infinity;
  return "switchSkill";
}

// data/scripts/features/weapons/weapons.ts
import { EquipmentSlot as EquipmentSlot5 } from "@minecraft/server";
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
          summonOwned(src, "summon lightning_bolt ~~~5 ~ 0");
          summonOwned(src, "summon lightning_bolt ~~~-5 ~ 0");
          src.runCommand("particle ph:lightning_sparks ~~~5");
          src.runCommand("particle ph:lightning_sparks ~~~-5");
        }
      },
      {
        delay: 2,
        action: (src) => {
          src.dimension.playSound("weapon_slash.slash_heavy", src.location);
          applyCustomDamage(src, 31, 4.5);
          summonOwned(src, "summon lightning_bolt ~5~~ ~ 0");
          summonOwned(src, "summon lightning_bolt ~-5~~ ~ 0");
          src.runCommand("particle ph:lightning_sparks ~5~~");
          src.runCommand("particle ph:lightning_sparks ~-5~~");
          addScore(src, "supercharged_copper_axe_s3", 1);
          addScore(src, "supercharged_copper_axe_s4", 1);
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
  { delay: 6, damage: 17, radius: 0, animation: "animation.prism_weaver.attack_1", sound: "weapon_slash.magic_staff", projectile: prismBolt(-0.35) },
  { delay: 10, damage: 17, radius: 0, animation: "animation.prism_weaver.attack_2", sound: "weapon_slash.magic_staff", projectile: prismBolt(0.35) },
  { delay: 10, damage: 12, radius: 0, animation: "animation.prism_weaver.attack_3", sound: "weapon_slash.magic_staff", projectile: PRISM_FAN }
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
            summonOwned(src, "summon lightning_bolt ~~~ ~ 0", entity);
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
var switcherByItemId = new Map(
  switcherSkills.map((switcher) => [switcher.itemId, switcher])
);
function switchHeldWeaponSkill(player) {
  const switcher = switcherByItemId.get(
    player.getComponent("equippable")?.getEquipment(EquipmentSlot5.Mainhand)?.typeId ?? ""
  );
  if (!switcher) return false;
  switcher.switchSkill(player);
  return true;
}

// data/scripts/features/mace/detection.ts
import { world as world6, system as system11, EquipmentSlot as EquipmentSlot7, Player as Player12, EntityDamageCause as EntityDamageCause4 } from "@minecraft/server";

// data/scripts/features/mace/manager.ts
import { EntityEquippableComponent, EquipmentSlot as EquipmentSlot6 } from "@minecraft/server";
var ExcludeFamilyTypes = ["immune", "unvenerable"];
var ExcludeEntities = [
  "minecraft:item",
  "minecraft:xp_orb",
  "minecraft:armor_stand",
  "minecraft:iron_golem"
];
function isValidTarget(entity) {
  if (!entity?.isValid) return false;
  if (ExcludeEntities.includes(entity.typeId)) return false;
  const tags = entity.getTags();
  for (const family of ExcludeFamilyTypes) {
    if (tags.includes(`minecraft:family_${family}`)) return false;
  }
  return true;
}
function getKnockbackMultiplier(entity) {
  if (!entity.isValid) return 1;
  const equipment = entity.getComponent(EntityEquippableComponent.componentId);
  if (!equipment?.isValid) return 1;
  const slots = [EquipmentSlot6.Head, EquipmentSlot6.Chest, EquipmentSlot6.Legs, EquipmentSlot6.Feet];
  const netheritePieces = slots.filter((slot) => equipment.getEquipment(slot)?.hasTag("minecraft:netherite_tier")).length;
  return 1 - netheritePieces * 0.1;
}

// data/scripts/features/mace/detection.ts
var CustomMaceItems = /* @__PURE__ */ new Set([
  "ph:cruxshaper"
]);
function isCustomMace(item) {
  return !!item && CustomMaceItems.has(item?.typeId);
}
var FallDistance = 1.5;
var HeavySoundFallDistance = 5.5;
var MaceSmashRadius = 5;
var SmashHorizontalImpulse = 0.25;
var SmashVerticalImpulse = 0.5;
var SmashAirSound = "mace.smash_air";
var SmashGroundSound = "mace.smash_ground";
var SmashHeavyGroundSound = "mace.heavy_smash_ground";
var WindBurstLevelImpulse = {
  1: 1.1,
  2: 1.65,
  3: 2
};
var recentSwingHit = /* @__PURE__ */ new Set();
var playerFallData = /* @__PURE__ */ new Map();
function onMaceHurt(event) {
  const { damageSource, hurtEntity: victim } = event;
  if (damageSource.cause === EntityDamageCause4.maceSmash) return;
  const attacker = damageSource.damagingEntity;
  if (!(attacker instanceof Player12)) return;
  if (recentSwingHit.has(attacker.id)) return;
  const item = attacker.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot7.Mainhand);
  if (!item || !isCustomMace(item)) return;
  const startY = playerFallData.get(attacker.id);
  if (startY === void 0) return;
  const fallDistance = startY - attacker.location.y;
  if (fallDistance < FallDistance) return;
  const windBurst = item.getComponent("minecraft:enchantable")?.getEnchantment("wind_burst")?.level ?? 0;
  event.cancel = true;
  executeMaceSlam(attacker, victim, fallDistance, item, windBurst);
}
function solidAt(dimension, location) {
  if (location.y < dimension.heightRange.min) return false;
  const block = dimension.getBlock(location);
  return !!block && !block.isAir && !block.isLiquid;
}
function executeMaceSlam(attacker, victim, fallDistance, item, wbLevel = 0) {
  if (!attacker.isValid || !victim.isValid) return;
  system11.run(() => {
    if (!attacker.isValid || !victim.isValid) return;
    if (!victim.dimension.isChunkLoaded(victim.location)) return;
    if (wbLevel === 0) {
      attacker.clearVelocity();
      attacker.teleport({
        x: attacker.location.x,
        y: attacker.location.y + 0.5,
        z: attacker.location.z
      });
    }
    const soundLoc = victim.location;
    attacker.dimension.playSound(fallDistance > HeavySoundFallDistance ? SmashHeavyGroundSound : SmashGroundSound, soundLoc);
    const { x, y, z } = victim.location;
    const isNearGround = solidAt(victim.dimension, { x, y: y - 1, z }) || solidAt(victim.dimension, { x, y: y - 2, z });
    if (!attacker.isOnGround && !victim.isOnGround && !isNearGround) {
      attacker.dimension.playSound(SmashAirSound, soundLoc);
      attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", soundLoc);
    } else {
      attacker.dimension.spawnEntity("ph:mace_slam", soundLoc);
      attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", soundLoc);
    }
    if (wbLevel > 0) {
      handleWindBurst(attacker, victim, soundLoc, wbLevel);
    } else {
      handleStandardSlam(attacker, victim, soundLoc);
    }
    const enchantable = item.getComponent("minecraft:enchantable");
    const dmg = fallDistance <= 3 ? fallDistance * 8 : fallDistance <= 8 ? 24 + (fallDistance - 3) * 4 : 44 + (fallDistance - 8) * 2;
    const density = enchantable?.getEnchantment("density")?.level ?? 0;
    const totalDmg = Math.floor(dmg + density * 1 * fallDistance);
    if (victim.isValid) victim.applyDamage(totalDmg, { cause: EntityDamageCause4.maceSmash, damagingEntity: attacker });
    playerFallData.delete(attacker.id);
  });
}
function handleStandardSlam(attacker, victim, vLoc) {
  const nearby = attacker.dimension.getEntities({
    location: vLoc,
    maxDistance: MaceSmashRadius
  });
  for (const ent of nearby) {
    if (ent.id === attacker.id || ent.id === victim.id) continue;
    if (ent.isValid && isValidTarget(ent)) {
      const kbResist = getKnockbackMultiplier(ent);
      const dx = ent.location.x - vLoc.x;
      const dz = ent.location.z - vLoc.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      ent.applyImpulse({
        x: dx / dist * SmashHorizontalImpulse * kbResist,
        y: SmashVerticalImpulse * kbResist,
        z: dz / dist * SmashHorizontalImpulse * kbResist
      });
    }
  }
}
function handleWindBurst(attacker, victim, vLoc, level) {
  const vImpulse = WindBurstLevelImpulse[level] || 0.5;
  attacker.clearVelocity();
  attacker.applyImpulse({ x: 0, y: vImpulse, z: 0 });
  const nearby = attacker.dimension.getEntities({
    location: vLoc,
    maxDistance: MaceSmashRadius
  });
  for (const ent of nearby) {
    if (!ent.isValid) continue;
    if (ent.id === attacker.id || ent.id === victim.id) continue;
    if (isValidTarget(ent)) {
      const kbResist = getKnockbackMultiplier(ent);
      const dx = ent.location.x - vLoc.x;
      const dz = ent.location.z - vLoc.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      ent.applyImpulse({
        x: dx / dist * (SmashHorizontalImpulse * level) * kbResist,
        y: SmashVerticalImpulse * kbResist,
        z: dz / dist * (SmashHorizontalImpulse * level) * kbResist
      });
    }
  }
}
function trackMaceFall() {
  for (const player of world6.getAllPlayers()) {
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
}

// data/scripts/systems/xeonniteBlessing.ts
import {
  world as world7,
  system as system12,
  Player as Player14,
  EasingType,
  EntityComponentTypes,
  EntityDamageCause as EntityDamageCause5,
  InputPermissionCategory,
  MolangVariableMap as MolangVariableMap4
} from "@minecraft/server";

// data/scripts/core/camera.ts
import "@minecraft/server";
function playerCameraBasis(player, anchorHeight = 1.1) {
  const { x, y, z } = player.location;
  const view = player.getViewDirection();
  const flat = Math.sqrt(view.x * view.x + view.z * view.z) || 1;
  const forward = { x: view.x / flat, y: 0, z: view.z / flat };
  return {
    anchor: { x, y: y + anchorHeight, z },
    forward,
    right: { x: -forward.z, y: 0, z: forward.x }
  };
}
function shotLocation(basis, distance, side, height) {
  const { anchor, forward, right } = basis;
  return {
    x: anchor.x + forward.x * distance + right.x * side,
    y: anchor.y + height,
    z: anchor.z + forward.z * distance + right.z * side
  };
}
function clearShotLocation(dimension, anchor, desired) {
  const dx = desired.x - anchor.x;
  const dy = desired.y - anchor.y;
  const dz = desired.z - anchor.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length < 0.01) return desired;
  const direction = { x: dx / length, y: dy / length, z: dz / length };
  if (!isLoadedLocation(dimension, anchor)) return desired;
  const hit = dimension.getBlockFromRay(anchor, direction, { maxDistance: length, includePassableBlocks: false });
  if (!hit) return desired;
  const { x, y, z } = hit.block.location;
  const hitDistance = Math.sqrt((x + hit.faceLocation.x - anchor.x) ** 2 + (y + hit.faceLocation.y - anchor.y) ** 2 + (z + hit.faceLocation.z - anchor.z) ** 2);
  const safe = Math.max(hitDistance - 0.35, 0.6);
  return { x: anchor.x + direction.x * safe, y: anchor.y + direction.y * safe, z: anchor.z + direction.z * safe };
}

// data/scripts/systems/xeonniteBlessing.ts
var BLESSING_PROPERTY = "ph:xeonnite_blessing";
var CUBE_PROPERTY = "ph:ever_obtained_xeonnite_cube";
var RIDGE_PROPERTY = "ph:ever_visited_titan_ridge";
var CUTSCENE_PROPERTY = "ph:xeonnite_cutscene_active";
var XEONNITE_CUBE = "ph:xeonnite_cube";
var TITAN_RIDGE_TAG = "ph:titan_ridge";
var TITAN_RIDGE_FAMILY = "titan_ridge";
function isBlessed(player) {
  if (!player.isValid) return false;
  return player.getDynamicProperty(BLESSING_PROPERTY) === true;
}
function holdsCube(player) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory)?.container;
  if (!inventory) return false;
  for (let slot = 0; slot < inventory.size; slot++) {
    if (inventory.getItem(slot)?.typeId === XEONNITE_CUBE) return true;
  }
  return false;
}
function inTitanRidge(player) {
  if (!isLoadedLocation(player.dimension, player.location)) return false;
  return player.dimension.getBiome(player.location).hasTags([TITAN_RIDGE_TAG]);
}
function checkBlessingMilestones() {
  for (const player of world7.getAllPlayers()) {
    if (!player.isValid) continue;
    if (isBlessed(player)) continue;
    if (player.getDynamicProperty(CUBE_PROPERTY) !== true && holdsCube(player)) {
      player.setDynamicProperty(CUBE_PROPERTY, true);
    }
    if (player.getDynamicProperty(RIDGE_PROPERTY) !== true && inTitanRidge(player)) {
      player.setDynamicProperty(RIDGE_PROPERTY, true);
    }
    if (player.getDynamicProperty(CUBE_PROPERTY) !== true || player.getDynamicProperty(RIDGE_PROPERTY) !== true) continue;
    player.setDynamicProperty(BLESSING_PROPERTY, true);
    playBlessingCutscene(player);
  }
}
var BURST_TICK = 48;
var FADE_OUT_TICK = 84;
var RELEASE_TICK = 90;
var SHOTS = [
  { tick: 1, ease: 1.15, easeType: EasingType.InOutSine, distance: 0.6, side: 2.6, height: 0.1 },
  { tick: 24, ease: 1, easeType: EasingType.InOutSine, distance: -1.3, side: 2.1, height: 0.5 },
  { tick: BURST_TICK, ease: 0.55, easeType: EasingType.OutCubic, distance: 1.8, side: 4.8, height: 2 },
  { tick: 59, ease: 1.25, easeType: EasingType.InOutSine, distance: 3.6, side: 3.6, height: 2.6 }
];
var OPENING_SHOT = { distance: 2.4, side: 1, height: -0.4 };
function cameraTo(player, basis, shot, ease) {
  const location = clearShotLocation(player.dimension, basis.anchor, shotLocation(basis, shot.distance, shot.side, shot.height));
  player.camera.setCamera("minecraft:free", {
    location,
    facingLocation: basis.anchor,
    easeOptions: ease ? { easeTime: ease.time, easeType: ease.type } : void 0
  });
}
function setLocked(player, locked) {
  player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !locked);
  player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, !locked);
}
var cutsceneRuns = /* @__PURE__ */ new Map();
function releaseBlessingCutscene(player) {
  for (const run of cutsceneRuns.get(player.id) ?? []) system12.clearRun(run);
  cutsceneRuns.delete(player.id);
  if (!player.isValid) return;
  setLocked(player, false);
  player.camera.clear();
  player.setDynamicProperty(CUTSCENE_PROPERTY, void 0);
}
function playBlessingCutscene(player) {
  const basis = playerCameraBasis(player);
  const dimension = player.dimension;
  const feet = { ...player.location };
  const chest = { x: feet.x, y: feet.y + 1.1, z: feet.z };
  player.setDynamicProperty(CUTSCENE_PROPERTY, true);
  setLocked(player, true);
  player.addEffect("resistance", RELEASE_TICK + 10, { amplifier: 4, showParticles: false });
  player.addEffect("slow_falling", RELEASE_TICK + 10, { showParticles: false });
  player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0, holdTime: 0.1, fadeOutTime: 0.6 } });
  cameraTo(player, basis, OPENING_SHOT);
  player.playAnimation("animation.player_extend.xeonnite_blessing", { blendOutTime: 0.25 });
  player.playSound("beacon.activate", { pitch: 0.8 });
  dimension.spawnParticle("ph:xeonnite_bless_rune", feet);
  dimension.spawnParticle("ph:xeonnite_bless_gather", chest);
  dimension.spawnParticle("ph:xeonnite_bless_motes", feet);
  const runs = [];
  cutsceneRuns.set(player.id, runs);
  const at = (tick, action) => {
    runs.push(system12.runTimeout(() => {
      if (!player.isValid) return;
      if (!dimension.isChunkLoaded(feet)) return;
      action();
    }, tick));
  };
  for (const shot of SHOTS) {
    at(shot.tick, () => cameraTo(player, basis, shot, { time: shot.ease, type: shot.easeType }));
  }
  at(24, () => player.playSound("beacon.ambient", { pitch: 1.4 }));
  at(BURST_TICK, () => {
    player.camera.fade({ fadeColor: { red: 1, green: 0.75, blue: 0.45 }, fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: 0.55 } });
    player.runCommand("camerashake add @s 0.35 0.7 positional");
    dimension.spawnParticle("ph:xeonnite_bless_flash", chest);
    dimension.spawnParticle("ph:xeonnite_bless_shards", chest);
    dimension.spawnParticle("ph:xeonnite_bless_shockwave", feet);
    dimension.spawnParticle("ph:xeonnite_bless_pillar", feet);
    dimension.spawnParticle("ph:xeonnite_bless_dust", feet);
    dimension.playSound("random.totem", feet, { volume: 0.9 });
    dimension.playSound("random.explode", feet, { volume: 0.5, pitch: 1.3 });
  });
  at(BURST_TICK + 2, () => dimension.spawnParticle("ph:xeonnite_bless_motes", feet));
  at(60, () => player.playSound("random.levelup", { pitch: 0.9 }));
  at(
    FADE_OUT_TICK,
    () => player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.25, holdTime: 0.2, fadeOutTime: 0.5 } })
  );
  runs.push(system12.runTimeout(() => {
    if (!player.isValid) return;
    releaseBlessingCutscene(player);
    player.onScreenDisplay.setActionBar("\xA76Xeonnite Blessing \xA77awakened: Titan Ridge foes can now be wounded");
  }, RELEASE_TICK));
}
function onBlessingSpawn(player, initialSpawn) {
  if (!initialSpawn) return;
  if (player.getDynamicProperty(CUTSCENE_PROPERTY) === true) releaseBlessingCutscene(player);
}
function damageDealer(acc) {
  const { damagingEntity, damagingProjectile, cause } = acc.damageSource;
  if (damagingEntity ?? damagingProjectile) return damagingEntity ?? damagingProjectile;
  if (cause !== EntityDamageCause5.lightning) return void 0;
  const { location, dimension } = acc.hurtEntity;
  return dimension.getEntities({ type: "minecraft:lightning_bolt", location, maxDistance: 6, closest: 1 })[0];
}
var WARD_COOLDOWN_TICKS = 3;
var lastWard = /* @__PURE__ */ new Map();
function showWard(hurtEntity, from, player) {
  const now = system12.currentTick;
  if ((lastWard.get(hurtEntity.id) ?? -WARD_COOLDOWN_TICKS) + WARD_COOLDOWN_TICKS > now) return;
  lastWard.set(hurtEntity.id, now);
  const base = hurtEntity.location;
  const head = hurtEntity.getHeadLocation();
  const center = { x: base.x, y: base.y + (head.y - base.y) * 0.65, z: base.z };
  const dx = from.x - center.x;
  const dy = from.y - center.y;
  const dz = from.z - center.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const dir = { x: dx / length, y: dy / length, z: dz / length };
  const contact = { x: center.x + dir.x * 0.75, y: center.y + dir.y * 0.75, z: center.z + dir.z * 0.75 };
  const vars = new MolangVariableMap4();
  vars.setVector3("variable.dir", dir);
  const dimension = hurtEntity.dimension;
  dimension.spawnParticle("ph:xeonnite_ward_ring", contact, vars);
  dimension.spawnParticle("ph:xeonnite_ward_cross", contact, vars);
  dimension.spawnParticle("ph:xeonnite_ward_sparks", contact, vars);
  if (player) {
    player.playSound("random.anvil_land", { volume: 0.35, pitch: 1.8 });
    player.onScreenDisplay.setActionBar("\xA77Requires the \xA76Xeonnite Blessing");
  }
}
function onBlessingHurt(acc) {
  const dealer = damageDealer(acc);
  if (!dealer) return;
  const ownerId = getOwnerId(dealer);
  if (!ownerId) return;
  const hurtEntity = acc.hurtEntity;
  if (!hurtEntity.isValid) return;
  if (!hurtEntity.getComponent("minecraft:type_family")?.hasTypeFamily(TITAN_RIDGE_FAMILY)) return;
  const owner = world7.getEntity(ownerId);
  const player = owner instanceof Player14 ? owner : void 0;
  if (player && isBlessed(player)) return;
  acc.cancel = true;
  if (!dealer.isValid) return;
  const from = dealer.getHeadLocation();
  system12.run(() => {
    if (!hurtEntity.isValid) return;
    if (!hurtEntity.dimension.isChunkLoaded(hurtEntity.location)) return;
    showWard(hurtEntity, from, player?.isValid ? player : void 0);
  });
}
function forgetWard(removedEntityId) {
  lastWard.delete(removedEntityId);
}

// data/scripts/features/forge_trooper/manager.ts
import {
  world as world8,
  system as system13,
  EntityDamageCause as EntityDamageCause6
} from "@minecraft/server";
var TROOPER_ID = "ph:forge_trooper";
var NERF_PROPERTY = "ph:forge_parry_nerf_until";
var FRIENDLY_FAMILIES = ["titan_ridge", "inanimate"];
var TARGET_RANGE = 24;
var VARIANT_GOLD = 0;
var VARIANT_PLASMA = 1;
var VARIANT_AMBER = 2;
var SWEEP_RADIUS = 3.2;
var SWEEP_DAMAGE = 30;
var SWEEP_HIT_TICK = 11;
var SWEEP_ANIM_MS = 1250;
var ATTACK_REACH = SWEEP_RADIUS + 0.8;
var FLEE_MS = 3e3;
var DASH_RANGE_MIN = 10;
var DASH_COOLDOWN_MS = 12e3;
var DASH_AIR_TICKS = 8;
var DASH_PUSHES_PER_BLOCK = 0.5;
var DASH_IMPULSE = 0.35;
var DASH_SWEEP_REACH = SWEEP_RADIUS + 1.5;
var DASH_MAX_MS = (DASH_AIR_TICKS + 2 * Math.ceil(TARGET_RANGE * DASH_PUSHES_PER_BLOCK)) * 50 + 500;
var states2 = /* @__PURE__ */ new Map();
function getState2(trooper) {
  const existing = states2.get(trooper.id);
  if (existing) return existing;
  const st = { phase: "chase", phaseUntil: 0, dashCd: 0 };
  states2.set(trooper.id, st);
  setPhase(trooper, st, "chase", 0);
  return st;
}
function setPhase(trooper, st, phase, durationMs) {
  st.phase = phase;
  st.phaseUntil = Date.now() + durationMs;
  if (!trooper.isValid) return;
  trooper.triggerEvent(`ph:state_${phase}`);
}
function forgetState(key) {
  states2.delete(key);
}
function variantOf(trooper) {
  return trooper.getComponent("minecraft:variant")?.value ?? 0;
}
var VARIANT_FX = ["gold", "plasma", "amber"];
function playMove(trooper, move) {
  trooper.playAnimation(`animation.forge_trooper.${move}`);
  const variant = VARIANT_FX[variantOf(trooper)] ?? VARIANT_FX[VARIANT_GOLD];
  trooper.playAnimation(`animation.forge_trooper.${move}_fx_${variant}`, { controller: "ph:forge_trooper_fx" });
}
function isNerfed(player) {
  if (!player.isValid) return false;
  const until = player.getDynamicProperty(NERF_PROPERTY);
  return typeof until === "number" && Date.now() < until;
}
function isValidTarget2(target) {
  if (!target.isValid || target.typeId === TROOPER_ID) return false;
  if (target.typeId === "minecraft:player") {
    const mode = target.getGameMode();
    return mode !== "Creative" && mode !== "Spectator";
  }
  if (!target.getComponent("minecraft:health")) return false;
  const family = target.getComponent("minecraft:type_family");
  return !FRIENDLY_FAMILIES.some((f) => family?.hasTypeFamily(f));
}
function distanceBetween(a, b) {
  const dx = a.location.x - b.location.x;
  const dy = a.location.y - b.location.y;
  const dz = a.location.z - b.location.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function nearestTarget(trooper) {
  if (!trooper.isValid) return void 0;
  return trooper.dimension.getEntities({ location: trooper.location, maxDistance: TARGET_RANGE, excludeFamilies: FRIENDLY_FAMILIES }).find(isValidTarget2);
}
function onTrooperHurt(acc) {
  const hurtEntity = acc.hurtEntity;
  const attacker = acc.damageSource.damagingEntity;
  if (attacker?.typeId === "minecraft:player" && isNerfed(attacker)) {
    acc.cancel = true;
    return;
  }
  if (hurtEntity?.typeId !== TROOPER_ID) return;
  if (attacker?.typeId !== "minecraft:player") return;
  const player = attacker;
  if (!isBlessed(player)) return;
  if (Math.random() < 0.2) {
    acc.cancel = true;
    const trooper = hurtEntity;
    system13.run(() => {
      if (!trooper.isValid || !player.isValid) return;
      playMove(trooper, "parry");
      const dim = trooper.dimension;
      dim.spawnParticle("ph:parry_prepare", {
        x: trooper.location.x,
        y: trooper.location.y + 1.2,
        z: trooper.location.z
      });
      dim.playSound("weapon_slash.slash_clash", trooper.location);
      player.addEffect("weakness", 40, {
        amplifier: 255,
        showParticles: true
      });
      player.setDynamicProperty(NERF_PROPERTY, Date.now() + 2e3);
      player.onScreenDisplay.setActionBar("\xA7c\xA7lPARRIED! \xA77Damage output nullified");
    });
    return;
  }
}
function startSweep(trooper, st) {
  setPhase(trooper, st, "attack", SWEEP_ANIM_MS);
  if (!trooper.isValid) return;
  trooper.clearVelocity();
  trooper.addEffect("slowness", Math.ceil(SWEEP_ANIM_MS / 50), { amplifier: 10, showParticles: false });
  playMove(trooper, "sweep");
  const variant = variantOf(trooper);
  const radius = variant === VARIANT_PLASMA ? SWEEP_RADIUS + 1 : SWEEP_RADIUS;
  const damage = variant === VARIANT_AMBER ? SWEEP_DAMAGE + 3 : SWEEP_DAMAGE;
  system13.runTimeout(() => {
    if (!trooper.isValid) return;
    const location = trooper.location;
    const targets = trooper.dimension.getEntities({
      location,
      maxDistance: radius,
      excludeFamilies: FRIENDLY_FAMILIES
    });
    for (const target of targets) {
      if (target.id === trooper.id || !isValidTarget2(target)) continue;
      if (!trooper.isValid) return;
      target.applyDamage(damage, {
        cause: EntityDamageCause6.entityAttack,
        damagingEntity: trooper
      });
    }
    if (!trooper.isValid) return;
    trooper.dimension.playSound("weapon_slash.slash_heavy", location);
  }, SWEEP_HIT_TICK);
}
function startDash(trooper, st, dist) {
  setPhase(trooper, st, "dash", DASH_MAX_MS);
  st.dashCd = Date.now() + DASH_COOLDOWN_MS;
  if (!trooper.isValid) {
    setPhase(trooper, st, "chase", 0);
    return;
  }
  playMove(trooper, "dash");
  trooper.applyImpulse({ x: 0, y: 0.9, z: 0 });
  system13.runTimeout(() => {
    if (!trooper.isValid || st.phase !== "dash") return;
    let pushes = Math.ceil(dist * DASH_PUSHES_PER_BLOCK);
    const push = system13.runInterval(() => {
      if (!trooper.isValid || st.phase !== "dash") {
        system13.clearRun(push);
        return;
      }
      const target = nearestTarget(trooper);
      if (target === void 0 || pushes <= 0) {
        system13.clearRun(push);
        setPhase(trooper, st, "chase", 0);
        return;
      }
      if (distanceBetween(trooper, target) <= DASH_SWEEP_REACH) {
        system13.clearRun(push);
        startSweep(trooper, st);
        return;
      }
      const dx = target.location.x - trooper.location.x;
      const dz = target.location.z - trooper.location.z;
      const flat = Math.sqrt(dx * dx + dz * dz) || 1;
      trooper.applyImpulse({ x: dx / flat * DASH_IMPULSE, y: 0, z: dz / flat * DASH_IMPULSE });
      pushes--;
    }, 2);
  }, DASH_AIR_TICKS);
}
function tickTroopers() {
  const now = Date.now();
  const troopers = /* @__PURE__ */ new Map();
  for (const player of world8.getAllPlayers()) {
    if (!player.isValid) continue;
    for (const trooper of player.dimension.getEntities({
      type: TROOPER_ID,
      location: player.location,
      maxDistance: 48
    })) {
      troopers.set(trooper.id, trooper);
    }
  }
  for (const trooper of troopers.values()) {
    if (!trooper.isValid) continue;
    const st = getState2(trooper);
    switch (st.phase) {
      case "chase": {
        const target = nearestTarget(trooper);
        if (target === void 0) break;
        const dist = distanceBetween(trooper, target);
        if (dist <= ATTACK_REACH) {
          startSweep(trooper, st);
        } else if (variantOf(trooper) === VARIANT_GOLD && dist >= DASH_RANGE_MIN && now >= st.dashCd) {
          startDash(trooper, st, dist);
        }
        break;
      }
      case "dash":
        if (now >= st.phaseUntil) setPhase(trooper, st, "chase", 0);
        break;
      case "attack":
        if (now >= st.phaseUntil) setPhase(trooper, st, "flee", FLEE_MS);
        break;
      case "flee":
        if (now >= st.phaseUntil) setPhase(trooper, st, "chase", 0);
        break;
    }
  }
}
function onTrooperDie(deadEntity, damageSource) {
  if (deadEntity?.typeId !== TROOPER_ID) return;
  forgetState(deadEntity.id);
  const killer = damageSource?.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;
  const player = killer;
  if (Math.random() >= 0.3) return;
  if (!deadEntity.isValid || !player.isValid) return;
  switch (variantOf(deadEntity)) {
    case VARIANT_GOLD:
      player.addEffect("speed", 400, { amplifier: 0 });
      break;
    case VARIANT_PLASMA:
      player.addEffect("instant_health", 1, { amplifier: 0 });
      break;
    case VARIANT_AMBER:
      player.addEffect("resistance", 400, { amplifier: 0 });
      break;
  }
}
function onTrooperRemove(removedEntityId, typeId) {
  if (typeId === TROOPER_ID) forgetState(removedEntityId);
}

// data/scripts/features/polaris_power/manager.ts
import {
  system as system14,
  EntityDamageCause as EntityDamageCause7,
  GameMode as GameMode4,
  InputPermissionCategory as InputPermissionCategory2
} from "@minecraft/server";
var ITEM_ID = "ph:a_part_of_polaris_power";
var COOLDOWN_CATEGORY = "polaris_power";
var COOLDOWN_TICKS = 200;
var STRIKE_TAG = "ph:polaris_strike";
var CHARGING_PROPERTY = "ph:polaris_charging";
var CHARGE_TICKS = 30;
var CHARGE_FX_INTERVAL = 5;
var LOCK_MAX_TICKS = CHARGE_TICKS + 20;
var BEAM_RANGE = 32;
var BEAM_DAMAGE = 100;
var BEAM_HIT_RADIUS = 1.2;
var CORE_STEP = 0.25;
var SPIRAL_STEP = 0.25;
var SPIRAL_RADIUS = 0.55;
var SPIRAL_TURN_LENGTH = 1.6;
var SKIP_FAMILIES = ["inanimate"];
var SKIP_TYPES = ["minecraft:item", "minecraft:xp_orb", "minecraft:player"];
var locks = /* @__PURE__ */ new Map();
var readyAt = /* @__PURE__ */ new Map();
function add(a, b, scale = 1) {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function normalize2(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}
function distanceToSegment(point, start, dir, length) {
  const rel = { x: point.x - start.x, y: point.y - start.y, z: point.z - start.z };
  const along2 = Math.max(0, Math.min(length, rel.x * dir.x + rel.y * dir.y + rel.z * dir.z));
  const closest = add(start, dir, along2);
  return Math.hypot(point.x - closest.x, point.y - closest.y, point.z - closest.z);
}
function spawn(dimension, id, location) {
  if (!isLoadedLocation(dimension, location)) return;
  dimension.spawnParticle(id, location);
}
function lock(player) {
  release(player);
  if (!player.isValid) return;
  const anchor = { ...player.location };
  player.inputPermissions.setPermissionCategory(InputPermissionCategory2.Movement, false);
  player.setDynamicProperty(CHARGING_PROPERTY, true);
  let ticks = 0;
  const interval = system14.runInterval(() => {
    if (!player.isValid || ++ticks > LOCK_MAX_TICKS) {
      release(player);
      return;
    }
    const loc = player.location;
    if (Math.abs(loc.x - anchor.x) + Math.abs(loc.y - anchor.y) + Math.abs(loc.z - anchor.z) > 0.01) {
      player.teleport(anchor);
    }
    if (ticks % CHARGE_FX_INTERVAL === 0) {
      spawn(player.dimension, "ph:polaris_charge", add(loc, { x: 0, y: 1, z: 0 }));
      player.dimension.playSound("beacon.ambient", loc, { pitch: 1 + ticks / CHARGE_TICKS, volume: 0.8 });
    }
  }, 1);
  locks.set(player.id, { anchor, interval });
}
function release(player) {
  const current = locks.get(player.id);
  if (current) {
    system14.clearRun(current.interval);
    locks.delete(player.id);
  }
  if (!player.isValid) return;
  player.inputPermissions.setPermissionCategory(InputPermissionCategory2.Movement, true);
  player.setDynamicProperty(CHARGING_PROPERTY, void 0);
}
function beamLength(dimension, start, dir) {
  if (!isLoadedLocation(dimension, start)) return BEAM_RANGE;
  const blockHit = dimension.getBlockFromRay(start, dir, { maxDistance: BEAM_RANGE, includeLiquidBlocks: false, includePassableBlocks: false });
  if (!blockHit) return BEAM_RANGE;
  const face = add(blockHit.block.location, blockHit.faceLocation);
  return Math.hypot(face.x - start.x, face.y - start.y, face.z - start.z);
}
function fireBeam(player) {
  if (!player.isValid) return;
  const dimension = player.dimension;
  const start = player.getHeadLocation();
  const dir = normalize2(player.getViewDirection());
  const length = beamLength(dimension, start, dir);
  const end = add(start, dir, length);
  const up = Math.abs(dir.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = normalize2(cross(dir, up));
  const v = cross(dir, u);
  for (let d = 0; d <= length; d += CORE_STEP) spawn(dimension, "ph:polaris_beam_core", add(start, dir, d));
  for (let d = 0.6; d <= length; d += SPIRAL_STEP) {
    const angle = d / SPIRAL_TURN_LENGTH * Math.PI * 2;
    const center = add(start, dir, d);
    for (const offset of [0, Math.PI]) {
      const cos = Math.cos(angle + offset) * SPIRAL_RADIUS;
      const sin = Math.sin(angle + offset) * SPIRAL_RADIUS;
      spawn(dimension, "ph:polaris_beam_spiral", add(add(center, u, cos), v, sin));
    }
  }
  spawn(dimension, "ph:polaris_impact", end);
  dimension.playSound("mob.warden.sonic_boom", start, { pitch: 1.5, volume: 1 });
  dimension.playSound("beacon.power.select", start, { pitch: 1.8, volume: 1 });
  player.runCommand("camerashake add @s 0.4 0.2 positional");
  const midpoint = add(start, dir, length / 2);
  const targets = dimension.getEntities({
    location: midpoint,
    maxDistance: length / 2 + 3,
    excludeFamilies: SKIP_FAMILIES,
    excludeTypes: SKIP_TYPES
  });
  player.addTag(STRIKE_TAG);
  for (const target of targets) {
    if (!isInBeam(target, start, dir, length)) continue;
    if (!player.isValid) break;
    target.applyDamage(BEAM_DAMAGE, { cause: EntityDamageCause7.magic, damagingEntity: player });
  }
  if (player.isValid) player.removeTag(STRIKE_TAG);
}
function isInBeam(target, start, dir, length) {
  if (!target.isValid) return false;
  const feet = target.location;
  const head = target.getHeadLocation();
  const middle = { x: (feet.x + head.x) / 2, y: (feet.y + head.y) / 2, z: (feet.z + head.z) / 2 };
  return [feet, middle, head].some((point) => distanceToSegment(point, start, dir, length) <= BEAM_HIT_RADIUS);
}
function consumeOne(player) {
  if (player.getGameMode() === GameMode4.Creative) return;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const slot = player.selectedSlotIndex;
  const item = container.getItem(slot);
  if (item?.typeId !== ITEM_ID) return;
  if (item.amount <= 1) {
    container.setItem(slot, void 0);
  } else {
    item.amount--;
    container.setItem(slot, item);
  }
}
function onPolarisItemUse(event) {
  if (event.itemStack.typeId !== ITEM_ID) return;
  if (system14.currentTick < (readyAt.get(event.source.id) ?? 0)) event.cancel = true;
}
function cancelPolarisCharge(itemStack, source) {
  if (itemStack?.typeId !== ITEM_ID) return;
  if (!locks.has(source.id)) return;
  release(source);
  if (!source.isValid) return;
  source.startItemCooldown(COOLDOWN_CATEGORY, 0);
}
function registerPolarisComponent({ itemComponentRegistry }) {
  itemComponentRegistry.registerCustomComponent("ph:polaris_power", {
    onUse({ source }) {
      lock(source);
    },
    onCompleteUse({ source }) {
      release(source);
      readyAt.set(source.id, system14.currentTick + COOLDOWN_TICKS);
      source.startItemCooldown(COOLDOWN_CATEGORY, COOLDOWN_TICKS);
      consumeOne(source);
      fireBeam(source);
    }
  });
}
function onPolarisSpawn(player, initialSpawn) {
  if (!initialSpawn) return;
  if (player.getDynamicProperty(CHARGING_PROPERTY) === true) release(player);
}

// data/scripts/features/titan_core/radiation.ts
import { world as world9, GameMode as GameMode5, EntityComponentTypes as EntityComponentTypes2, EntityDamageCause as EntityDamageCause8, EquipmentSlot as EquipmentSlot8 } from "@minecraft/server";
var CORE_ID2 = "ph:titan_core";
var SET_TAG = "ph:xeon_plasm_tier";
var CORE_RADIUS = 32;
var CORE_DAMAGE = 16;
var BIOME_DAMAGE = 4;
var ARMOR_SLOTS = [EquipmentSlot8.Head, EquipmentSlot8.Chest, EquipmentSlot8.Legs, EquipmentSlot8.Feet];
function hasXeonPlasmSet(player) {
  const equippable = player.getComponent(EntityComponentTypes2.Equippable);
  if (!equippable) return false;
  return ARMOR_SLOTS.every((slot) => equippable.getEquipment(slot)?.hasTag(SET_TAG) === true);
}
function nearLivingCore(player) {
  const cores = player.dimension.getEntities({ type: CORE_ID2, location: player.location, maxDistance: CORE_RADIUS });
  return cores.some((core) => core.isValid && (core.getComponent(EntityComponentTypes2.Health)?.currentValue ?? 0) > 0);
}
function tickTitanRadiation() {
  for (const player of world9.getPlayers({ excludeGameModes: [GameMode5.Creative, GameMode5.Spectator] })) {
    if (!player.isValid || (player.getComponent(EntityComponentTypes2.Health)?.currentValue ?? 0) <= 0) continue;
    if (hasXeonPlasmSet(player)) continue;
    if (nearLivingCore(player)) {
      player.applyDamage(CORE_DAMAGE, { cause: EntityDamageCause8.magic });
    } else if (inTitanRidge(player)) {
      player.applyDamage(BIOME_DAMAGE, { cause: EntityDamageCause8.magic });
    }
  }
}

// data/scripts/features/shield/manager.ts
import {
  system as system15,
  world as world10,
  EntityDamageCause as EntityDamageCause9,
  EntityEquippableComponent as EntityEquippableComponent2,
  EntityOnFireComponent,
  EquipmentSlot as EquipmentSlot9,
  GameMode as GameMode6,
  ItemCooldownComponent,
  ItemDurabilityComponent,
  ItemEnchantableComponent,
  Player as Player18
} from "@minecraft/server";
var COMPONENT_ID = "ph:shield";
var onBlock = {};
var shielding = /* @__PURE__ */ new Set();
var usingItem = /* @__PURE__ */ new Set();
var heldShield = /* @__PURE__ */ new Map();
var animations = /* @__PURE__ */ new Map();
var delays = /* @__PURE__ */ new Map();
var visualDelays = /* @__PURE__ */ new Map();
var cancelledEffects = /* @__PURE__ */ new Set();
function getParams(item) {
  return item.getComponent(COMPONENT_ID)?.customComponentParameters.params ?? {};
}
function onCooldown(player, item) {
  return (item.getComponent(ItemCooldownComponent.componentId)?.getCooldownTicksRemaining(player) ?? 0) > 0;
}
function getHeldShield(player, withCooldown = true) {
  const isValid = (item) => !!item && item.hasComponent(COMPONENT_ID) && !(withCooldown && onCooldown(player, item));
  const equippable = player.getComponent(EntityEquippableComponent2.componentId);
  if (!equippable) return void 0;
  const offhand = equippable.getEquipmentSlot(EquipmentSlot9.Offhand);
  const offItem = offhand.getItem();
  if (isValid(offItem)) return { item: offItem, slot: offhand, hand: "off_hand" };
  const mainhand = equippable.getEquipmentSlot(EquipmentSlot9.Mainhand);
  const mainItem = mainhand.getItem();
  if (isValid(mainItem)) return { item: mainItem, slot: mainhand, hand: "main_hand" };
  return void 0;
}
function clearRun(map, id) {
  const run = map.get(id);
  if (run !== void 0) system15.clearRun(run);
  map.delete(id);
}
function startDelay(player, seconds, visual = true) {
  const id = player.id;
  clearRun(delays, id);
  delays.set(id, system15.runTimeout(() => delays.delete(id), seconds * 20));
  if (!visual) {
    visualDelays.delete(id);
    return;
  }
  clearRun(visualDelays, id);
  visualDelays.set(id, system15.runTimeout(() => visualDelays.delete(id), seconds * 20));
}
function stopAnimation(player, animation) {
  player.playAnimation(animation, { blendOutTime: 0, stopExpression: "return true;" });
}
function registerShieldComponent({ itemComponentRegistry }) {
  itemComponentRegistry.registerCustomComponent(COMPONENT_ID, {});
}
function tickShields() {
  for (const player of world10.getAllPlayers()) {
    const id = player.id;
    const shield = getHeldShield(player);
    const delay = shield ? getParams(shield.item).delay : void 0;
    if (shield?.item.typeId !== heldShield.get(id)) {
      if (!shield) clearRun(delays, id);
      if (delay !== void 0) startDelay(player, delay);
    }
    const idle = usingItem.has(id) || visualDelays.has(id) || !player.isSneaking || !shield;
    const current = animations.get(id);
    const anim = idle ? void 0 : `animation.ph.player.shield_block_${shield.hand}`;
    if (anim !== current) {
      if (current) stopAnimation(player, current);
      if (anim) player.playAnimation(anim, { blendOutTime: 99999, stopExpression: "q.is_sneaking" });
    }
    if (anim) animations.set(id, anim);
    else animations.delete(id);
    if (shield) heldShield.set(id, shield.item.typeId);
    else heldShield.delete(id);
    if (shield && player.isSneaking) shielding.add(id);
    else shielding.delete(id);
  }
}
function onShieldSneak(player, pressed) {
  if (!pressed) {
    clearRun(delays, player.id);
    return;
  }
  const shield = getHeldShield(player);
  const delay = shield ? getParams(shield.item).delay : void 0;
  if (delay !== void 0) startDelay(player, delay, false);
}
function onShieldSwing(player) {
  if (!player.isSneaking) return;
  const shield = getHeldShield(player);
  const delay = shield ? getParams(shield.item).delay : void 0;
  if (delay !== void 0) startDelay(player, delay);
}
function onShieldItemUse(player, using) {
  if (using) usingItem.add(player.id);
  else usingItem.delete(player.id);
}
function onShieldHurt(data) {
  if (!(data.hurtEntity instanceof Player18)) return;
  const player = data.hurtEntity;
  const id = player.id;
  if (!shielding.has(id) || delays.has(id) || usingItem.has(id)) return;
  const source = data.damageSource;
  const damageLocation = source.damagingEntity?.location ?? source.damagingProjectile?.location;
  if (!damageLocation) return;
  const playerLoc = player.location;
  const view = player.getViewDirection();
  const toDamage = { x: damageLocation.x - playerLoc.x, z: damageLocation.z - playerLoc.z };
  if (toDamage.x * view.x + toDamage.z * view.z < 0) return;
  let rawDamage = data.damage;
  const equippable = player.getComponent(EntityEquippableComponent2.componentId);
  if (equippable) {
    let protection = 0;
    for (const slot of [EquipmentSlot9.Head, EquipmentSlot9.Chest, EquipmentSlot9.Legs, EquipmentSlot9.Feet]) {
      const ench = equippable.getEquipment(slot)?.getComponent(ItemEnchantableComponent.componentId);
      protection += ench?.getEnchantment("protection")?.level ?? 0;
      if (source.cause === EntityDamageCause9.projectile) protection += ench?.getEnchantment("projectile_protection")?.level ?? 0;
    }
    const armor = Math.min(equippable.totalArmor, 20);
    if (armor) rawDamage /= 1 - armor * 0.04;
    if (protection) rawDamage /= 1 - Math.min(protection, 20) * 0.04;
  }
  const attacker = source.damagingEntity;
  const disables = !!attacker && (attacker.typeId === "minecraft:vindicator" || attacker.typeId === "minecraft:piglin_brute" || attacker.typeId === "minecraft:warden" && source.cause === EntityDamageCause9.entityAttack || !!attacker.getComponent(EntityEquippableComponent2.componentId)?.getEquipment(EquipmentSlot9.Mainhand)?.hasTag("minecraft:is_axe"));
  const hadFire = player.getComponent(EntityOnFireComponent.componentId) !== void 0;
  data.cancel = true;
  cancelledEffects.add(id);
  system15.run(() => {
    cancelledEffects.delete(id);
    if (!player.isValid) return;
    const shield = getHeldShield(player);
    if (!shield) return;
    const params = getParams(shield.item);
    if (attacker?.isValid && attacker.typeId === "minecraft:ravager" && source.cause === EntityDamageCause9.entityAttack) {
      attacker.triggerEvent("minecraft:become_stunned");
    }
    if (!hadFire && player.getComponent(EntityOnFireComponent.componentId)) player.extinguishFire();
    onBlock[shield.item.typeId]?.({ event: data, item: shield.item, source: player, slot: shield.slot });
    if (shield.item.hasComponent(ItemDurabilityComponent.componentId)) {
      shield.slot.setItem(wearShield(player, shield.item, Math.floor(rawDamage) + 1));
    }
    if (params.knockback && attacker?.isValid && !source.damagingProjectile) {
      const total = Math.abs(toDamage.x) + Math.abs(toDamage.z) || 1;
      const strength = params.knockback.x ?? 0;
      attacker.applyKnockback({ x: toDamage.x / total * strength, z: toDamage.z / total * strength }, params.knockback.y ?? 0.1);
    }
    if (params.block) player.dimension.playSound(params.block, player.location);
    if (params.command) player.runCommand(params.command);
    const cooldown = shield.item.getComponent(ItemCooldownComponent.componentId);
    if (cooldown && disables) {
      cooldown.startCooldown(player);
      if (params.disable_sound) player.dimension.playSound(params.disable_sound, player.location);
    }
  });
}
function onShieldEffectAdd(data) {
  if (cancelledEffects.has(data.entity.id)) data.cancel = true;
}
function clearShieldState(playerId) {
  shielding.delete(playerId);
  usingItem.delete(playerId);
  heldShield.delete(playerId);
  animations.delete(playerId);
  clearRun(delays, playerId);
  clearRun(visualDelays, playerId);
}
function wearShield(player, item, damage) {
  if (player.getGameMode() === GameMode6.Creative) return item;
  const durability = item.getComponent(ItemDurabilityComponent.componentId);
  if (!durability) return item;
  const unbreaking = item.getComponent(ItemEnchantableComponent.componentId)?.getEnchantment("unbreaking");
  if (unbreaking && Math.random() >= 1 / (unbreaking.level + 1)) return item;
  if (durability.damage + damage > durability.maxDurability) {
    player.dimension.playSound("random.break", player.location);
    return void 0;
  }
  durability.damage += damage;
  return item;
}

// data/scripts/features/titan_core/sites.ts
import { world as world11, StructureRotation } from "@minecraft/server";
var RIDGE_TAG = "ph:titan_ridge";
var PROPERTY_PREFIX = "ph:titan_ridge_site_";
var CORE_NAMES = ["mystructure:titan_ridge/tr_core", "titan_ridge:tr_core"];
var GATEWAY_NAMES = ["mystructure:titan_ridge/tr_gateway", "titan_ridge:tr_gateway"];
var CORE_SIZE = 9;
var GATEWAY_SIZE = 11;
var GROUND = /* @__PURE__ */ new Set([
  "minecraft:cobbled_deepslate",
  "minecraft:tuff",
  "minecraft:stone",
  "minecraft:deepslate",
  "minecraft:gravel",
  "minecraft:dirt",
  "minecraft:coarse_dirt",
  "minecraft:granite",
  "minecraft:diorite",
  "minecraft:andesite"
]);
var FILL_BLOCK = "minecraft:cobbled_deepslate";
var MAX_SCAN_CELLS = 1024;
var MAX_STORED_CELLS = 2500;
var NEARBY_SITE = 256;
var MAX_STEP = 2;
var MIN_GAP = 32;
var PLAYER_CLEARANCE = 8;
var MAX_CANDIDATES = 48;
var ROTATIONS = [StructureRotation.None, StructureRotation.Rotate90, StructureRotation.Rotate180, StructureRotation.Rotate270];
var ridges;
var warnedMissing = false;
function loadRidges() {
  if (ridges) return ridges;
  ridges = [];
  for (const id of world11.getDynamicPropertyIds()) {
    if (!id.startsWith(PROPERTY_PREFIX)) continue;
    const raw = world11.getDynamicProperty(id);
    if (typeof raw !== "string" || !raw.startsWith("{") || !raw.endsWith("}")) continue;
    const data = JSON.parse(raw);
    if (!data.core || !data.gateway || !Array.isArray(data.cells)) continue;
    ridges.push({ id, data, cells: new Set(data.cells) });
  }
  return ridges;
}
function saveRidge(ridge) {
  ridge.data.cells = [...ridge.cells];
  world11.setDynamicProperty(ridge.id, JSON.stringify(ridge.data));
}
function cellKey(cx, cz) {
  return `${cx},${cz}`;
}
function cellCenter(key) {
  const [cx, cz] = key.split(",").map(Number);
  return { x: cx * 16 + 8, z: cz * 16 + 8 };
}
function scanRidge(dimension, origin) {
  const start = cellKey(Math.floor(origin.x / 16), Math.floor(origin.z / 16));
  const cells = /* @__PURE__ */ new Set([start]);
  const seen = /* @__PURE__ */ new Set([start]);
  const queue = [start];
  let complete = true;
  while (queue.length > 0) {
    const key = queue.pop();
    const [cx, cz] = key.split(",").map(Number);
    if (key !== start) {
      const center = { x: cx * 16 + 8, y: origin.y, z: cz * 16 + 8 };
      if (!isLoadedLocation(dimension, center)) {
        complete = false;
        continue;
      }
      if (!dimension.getBiome(center).hasTags([RIDGE_TAG])) continue;
      cells.add(key);
      if (cells.size >= MAX_SCAN_CELLS) return { cells, complete: false };
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = cellKey(cx + dx, cz + dz);
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { cells, complete };
}
function horizontalDistance2(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
function findSpot(dimension, x, z, size, players) {
  const x0 = x - Math.floor(size / 2);
  const z0 = z - Math.floor(size / 2);
  const middle = { x: x0 + size / 2, z: z0 + size / 2 };
  if (players.some((p) => horizontalDistance2(p, middle) < size / 2 + PLAYER_CLEARANCE)) return void 0;
  const minY = dimension.heightRange.min;
  let highest = -Infinity;
  let lowest = Infinity;
  for (let bx = x0 - 1; bx <= x0 + size; bx++) {
    for (let bz = z0 - 1; bz <= z0 + size; bz++) {
      if (!dimension.isChunkLoaded({ x: bx, y: minY, z: bz })) return void 0;
      const block = dimension.getTopmostBlock({ x: bx, z: bz });
      if (!block || !GROUND.has(block.typeId)) return void 0;
      highest = Math.max(highest, block.location.y);
      lowest = Math.min(lowest, block.location.y);
      if (highest - lowest > MAX_STEP) return void 0;
    }
  }
  return { x: x0, y: highest + 1, z: z0 };
}
function fillUnder(dimension, corner, size) {
  for (let x = corner.x; x < corner.x + size; x++) {
    for (let z = corner.z; z < corner.z + size; z++) {
      const top = dimension.getTopmostBlock({ x, z })?.location.y ?? corner.y - 1;
      for (let y = top + 1; y < corner.y; y++) {
        dimension.getBlock({ x, y, z })?.setType(FILL_BLOCK);
      }
    }
  }
}
function areaLoaded(dimension, corner, size) {
  const far = { x: corner.x + size - 1, y: corner.y, z: corner.z + size - 1 };
  return isLoadedLocation(dimension, corner) && isLoadedLocation(dimension, far) && dimension.isChunkLoaded({ x: far.x, y: corner.y, z: corner.z }) && dimension.isChunkLoaded({ x: corner.x, y: corner.y, z: far.z });
}
function placeStructure(names, dimension, corner, size) {
  const rotation = ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
  const name = names.find((candidate) => world11.structureManager.get(candidate) !== void 0);
  if (!name) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(`[Titan Ridge] could not place ${names[0]}`);
    }
    return false;
  }
  if (!areaLoaded(dimension, corner, size)) return false;
  fillUnder(dimension, corner, size);
  world11.structureManager.place(name, dimension, corner, { rotation });
  return true;
}
function placePair(dimension, cells) {
  const centers = [...cells].map(cellCenter);
  const centroid = {
    x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
    z: centers.reduce((sum, c) => sum + c.z, 0) / centers.length
  };
  centers.sort((a, b) => horizontalDistance2(a, centroid) - horizontalDistance2(b, centroid));
  const players = dimension.getPlayers().map((p) => p.location);
  let core;
  let gateway;
  for (const center of centers.slice(0, MAX_CANDIDATES)) {
    if (!core) {
      core = findSpot(dimension, center.x, center.z, CORE_SIZE, players);
      continue;
    }
    if (horizontalDistance2(center, core) < MIN_GAP) continue;
    gateway = findSpot(dimension, center.x, center.z, GATEWAY_SIZE, players);
    if (gateway) break;
  }
  if (!core || !gateway) return;
  if (!placeStructure(CORE_NAMES, dimension, core, CORE_SIZE)) return;
  placeStructure(GATEWAY_NAMES, dimension, gateway, GATEWAY_SIZE);
  const all = loadRidges();
  const ridge = { id: `${PROPERTY_PREFIX}${all.length}`, data: { core, gateway, cells: [] }, cells };
  all.push(ridge);
  saveRidge(ridge);
}
function tickTitanRidgeSites() {
  const scanned = /* @__PURE__ */ new Set();
  for (const player of world11.getPlayers()) {
    if (!player.isValid) continue;
    const dimension = player.dimension;
    if (dimension.id !== "minecraft:overworld" || !inTitanRidge(player)) continue;
    const startKey = cellKey(Math.floor(player.location.x / 16), Math.floor(player.location.z / 16));
    if (scanned.has(startKey)) continue;
    const scan = scanRidge(dimension, player.location);
    scan.cells.forEach((cell) => scanned.add(cell));
    const known = loadRidges().find((ridge) => [...scan.cells].some((cell) => ridge.cells.has(cell)));
    if (known) {
      const before = known.cells.size;
      for (const cell of scan.cells) {
        if (known.cells.size >= MAX_STORED_CELLS) break;
        known.cells.add(cell);
      }
      if (known.cells.size !== before) saveRidge(known);
      continue;
    }
    if (!scan.complete && loadRidges().some((ridge) => horizontalDistance2(ridge.data.core, player.location) < NEARBY_SITE)) continue;
    placePair(dimension, scan.cells);
  }
}

// data/scripts/systems/lootBeam.ts
import { MolangVariableMap as MolangVariableMap5, system as system16 } from "@minecraft/server";

// data/scripts/core/itemRarity.ts
import "@minecraft/server";
var RARITY = /* @__PURE__ */ new Map([
  ["ph:a_part_of_polaris_power", "epic"],
  ["ph:astral_upgrade_smithing_template", "rare"],
  ["ph:astralith_alloy", "rare"],
  ["ph:astralith_axe", "epic"],
  ["ph:astralith_boots", "epic"],
  ["ph:astralith_chestplate", "epic"],
  ["ph:astralith_helmet", "epic"],
  ["ph:astralith_hoe", "epic"],
  ["ph:astralith_leggings", "epic"],
  ["ph:astralith_pickaxe", "epic"],
  ["ph:astralith_shovel", "epic"],
  ["ph:astralith_spear", "epic"],
  ["ph:astralith_sword", "epic"],
  ["ph:astralium", "uncommon"],
  ["ph:astralium_axe", "rare"],
  ["ph:astralium_boots", "rare"],
  ["ph:astralium_chestplate", "rare"],
  ["ph:astralium_helmet", "rare"],
  ["ph:astralium_hoe", "rare"],
  ["ph:astralium_leggings", "rare"],
  ["ph:astralium_pickaxe", "rare"],
  ["ph:astralium_shovel", "rare"],
  ["ph:astralium_spear", "rare"],
  ["ph:astralium_sword", "rare"],
  ["ph:auric_charging_module", "rare"],
  ["ph:auric_communicator", "epic"],
  ["ph:auric_photonizer", "legendary"],
  ["ph:auric_proton", "epic"],
  ["ph:auric_star", "rare"],
  ["ph:auric_stock_battery", "rare"],
  ["ph:charged_copper_axe", "epic"],
  ["ph:condensed_sea_nature", "epic"],
  ["ph:copper_mechanical_array_treasure_bag", "epic"],
  ["ph:cruxshaper", "epic"],
  ["ph:fire_bracelet", "epic"],
  ["ph:flow_channeler", "epic"],
  ["ph:guidebook", "uncommon"],
  ["ph:hell_charge", "uncommon"],
  ["ph:impulse_booster", "epic"],
  ["ph:naturalist_boots", "rare"],
  ["ph:naturalist_chestplate", "rare"],
  ["ph:naturalist_helmet", "rare"],
  ["ph:naturalist_leggings", "rare"],
  ["ph:nature_staff", "epic"],
  ["ph:ocean_tide_boots", "rare"],
  ["ph:ocean_tide_chestplate", "rare"],
  ["ph:ocean_tide_helmet", "rare"],
  ["ph:ocean_tide_leggings", "rare"],
  ["ph:peacemaker_oath", "epic"],
  ["ph:prism_weaver", "legendary"],
  ["ph:prismatic_axe", "rare"],
  ["ph:prismatic_hoe", "rare"],
  ["ph:prismatic_ingot", "rare"],
  ["ph:prismatic_pickaxe", "rare"],
  ["ph:prismatic_shovel", "rare"],
  ["ph:prismatic_spear", "rare"],
  ["ph:prismatic_sword", "rare"],
  ["ph:punicea_crimson_eye_treasure_bag", "epic"],
  ["ph:rust_coin", "epic"],
  ["ph:scimitar", "rare"],
  ["ph:scimitar_2", "rare"],
  ["ph:seiketsu", "epic"],
  ["ph:sentinel_scale", "rare"],
  ["ph:sentinel_shield", "rare"],
  ["ph:solaris_verdant", "legendary"],
  ["ph:solarium_axe", "rare"],
  ["ph:solarium_boots", "uncommon"],
  ["ph:solarium_chestplate", "uncommon"],
  ["ph:solarium_helmet", "uncommon"],
  ["ph:solarium_hoe", "rare"],
  ["ph:solarium_ingot", "uncommon"],
  ["ph:solarium_leggings", "uncommon"],
  ["ph:solarium_pickaxe", "rare"],
  ["ph:solarium_shovel", "rare"],
  ["ph:solarium_spear", "rare"],
  ["ph:solarium_sword", "rare"],
  ["ph:soul_of_nature_treasure_bag", "epic"],
  ["ph:spectral_arrow", "uncommon"],
  ["ph:spectric_bow", "epic"],
  ["ph:supercharged_copper_axe", "legendary"],
  ["ph:suspicious_mushroom", "epic"],
  ["ph:the_bleeding_spire", "legendary"],
  ["ph:the_crimson_watcher", "epic"],
  ["ph:thunder_gale", "epic"],
  ["ph:time_polarizer", "epic"],
  ["ph:titan_upgrade_smithing_template", "rare"],
  ["ph:weeping_repair", "epic"],
  ["ph:wither_treasure_bag", "epic"],
  ["ph:xeon_plasm_axe", "epic"],
  ["ph:xeon_plasm_boots", "epic"],
  ["ph:xeon_plasm_chestplate", "epic"],
  ["ph:xeon_plasm_helmet", "epic"],
  ["ph:xeon_plasm_hoe", "epic"],
  ["ph:xeon_plasm_leggings", "epic"],
  ["ph:xeon_plasm_pickaxe", "epic"],
  ["ph:xeon_plasm_shovel", "epic"],
  ["ph:xeon_plasm_spear", "epic"],
  ["ph:xeon_plasm_sword", "epic"],
  ["ph:xeon_plasma", "rare"],
  ["ph:xeonnite_cube", "rare"],
  ["ph:xeonnite_shard", "uncommon"],
  ["minecraft:creeper_banner_pattern", "uncommon"],
  ["minecraft:piglin_banner_pattern", "uncommon"],
  ["minecraft:book", "uncommon"],
  ["minecraft:sniffer_egg", "uncommon"],
  ["minecraft:chainmail_helmet", "uncommon"],
  ["minecraft:chainmail_chestplate", "uncommon"],
  ["minecraft:chainmail_leggings", "uncommon"],
  ["minecraft:chainmail_boots", "uncommon"],
  ["minecraft:recovery_compass", "uncommon"],
  ["minecraft:disc_fragment_5", "uncommon"],
  ["minecraft:nautilus_shell", "uncommon"],
  ["minecraft:echo_shard", "uncommon"],
  ["minecraft:goat_horn", "uncommon"],
  ["minecraft:ominous_bottle", "uncommon"],
  ["minecraft:netherite_upgrade_smithing_template", "uncommon"],
  ["minecraft:totem_of_undying", "uncommon"],
  ["minecraft:experience_bottle", "uncommon"],
  ["minecraft:conduit", "uncommon"],
  ["minecraft:heart_of_the_sea", "uncommon"],
  ["minecraft:dragon_breath", "uncommon"],
  ["minecraft:player_head", "uncommon"],
  ["minecraft:zombie_head", "uncommon"],
  ["minecraft:creeper_head", "uncommon"],
  ["minecraft:skeleton_skull", "uncommon"],
  ["minecraft:piglin_head", "uncommon"],
  ["minecraft:angler_pottery_sherd", "uncommon"],
  ["minecraft:archer_pottery_sherd", "uncommon"],
  ["minecraft:arms_up_pottery_sherd", "uncommon"],
  ["minecraft:blade_pottery_sherd", "uncommon"],
  ["minecraft:brewer_pottery_sherd", "uncommon"],
  ["minecraft:burn_pottery_sherd", "uncommon"],
  ["minecraft:danger_pottery_sherd", "uncommon"],
  ["minecraft:explorer_pottery_sherd", "uncommon"],
  ["minecraft:flow_pottery_sherd", "uncommon"],
  ["minecraft:friend_pottery_sherd", "uncommon"],
  ["minecraft:guster_pottery_sherd", "uncommon"],
  ["minecraft:heart_pottery_sherd", "uncommon"],
  ["minecraft:heartbreak_pottery_sherd", "uncommon"],
  ["minecraft:howl_pottery_sherd", "uncommon"],
  ["minecraft:miner_pottery_sherd", "uncommon"],
  ["minecraft:mourner_pottery_sherd", "uncommon"],
  ["minecraft:plenty_pottery_sherd", "uncommon"],
  ["minecraft:prize_pottery_sherd", "uncommon"],
  ["minecraft:scrape_pottery_sherd", "uncommon"],
  ["minecraft:sheaf_pottery_sherd", "uncommon"],
  ["minecraft:shelter_pottery_sherd", "uncommon"],
  ["minecraft:skull_pottery_sherd", "uncommon"],
  ["minecraft:snort_pottery_sherd", "uncommon"],
  ["minecraft:sentry_armor_trim_smithing_template", "uncommon"],
  ["minecraft:dune_armor_trim_smithing_template", "uncommon"],
  ["minecraft:coast_armor_trim_smithing_template", "uncommon"],
  ["minecraft:wild_armor_trim_smithing_template", "uncommon"],
  ["minecraft:tide_armor_trim_smithing_template", "uncommon"],
  ["minecraft:snout_armor_trim_smithing_template", "uncommon"],
  ["minecraft:rib_armor_trim_smithing_template", "uncommon"],
  ["minecraft:wayfinder_armor_trim_smithing_template", "uncommon"],
  ["minecraft:shaper_armor_trim_smithing_template", "uncommon"],
  ["minecraft:raiser_armor_trim_smithing_template", "uncommon"],
  ["minecraft:host_armor_trim_smithing_template", "uncommon"],
  ["minecraft:flow_armor_trim_smithing_template", "uncommon"],
  ["minecraft:bolt_armor_trim_smithing_template", "uncommon"],
  ["minecraft:music_disc_13", "uncommon"],
  ["minecraft:music_disc_cat", "uncommon"],
  ["minecraft:music_disc_blocks", "uncommon"],
  ["minecraft:music_disc_chirp", "uncommon"],
  ["minecraft:music_disc_far", "uncommon"],
  ["minecraft:music_disc_mall", "uncommon"],
  ["minecraft:music_disc_mellohi", "uncommon"],
  ["minecraft:music_disc_stal", "uncommon"],
  ["minecraft:music_disc_strad", "uncommon"],
  ["minecraft:music_disc_ward", "uncommon"],
  ["minecraft:music_disc_11", "uncommon"],
  ["minecraft:music_disc_wait", "uncommon"],
  ["minecraft:music_disc_5", "uncommon"],
  ["minecraft:music_disc_relic", "uncommon"],
  ["minecraft:music_disc_creator_music_box", "uncommon"],
  ["minecraft:music_disc_precipice", "uncommon"],
  ["minecraft:music_disc_tears", "uncommon"],
  ["minecraft:music_disc_lava_chicken", "uncommon"],
  ["minecraft:flow_banner_pattern", "rare"],
  ["minecraft:guster_banner_pattern", "rare"],
  ["minecraft:skull_banner_pattern", "rare"],
  ["minecraft:mojang_banner_pattern", "rare"],
  ["minecraft:enchanted_golden_apple", "rare"],
  ["minecraft:trident", "rare"],
  ["minecraft:nether_star", "rare"],
  ["minecraft:wither_skeleton_skull", "rare"],
  ["minecraft:beacon", "rare"],
  ["minecraft:ward_armor_trim_smithing_template", "rare"],
  ["minecraft:eye_armor_trim_smithing_template", "rare"],
  ["minecraft:vex_armor_trim_smithing_template", "rare"],
  ["minecraft:spire_armor_trim_smithing_template", "rare"],
  ["minecraft:music_disc_pigstep", "rare"],
  ["minecraft:music_disc_otherside", "rare"],
  ["minecraft:music_disc_creator", "rare"],
  ["minecraft:elytra", "epic"],
  ["minecraft:dragon_head", "epic"],
  ["minecraft:dragon_egg", "epic"],
  ["minecraft:heavy_core", "epic"],
  ["minecraft:mace", "epic"],
  ["minecraft:silence_armor_trim_smithing_template", "epic"]
]);
var UPGRADE = { common: "rare", uncommon: "rare", rare: "epic", epic: "epic", legendary: "legendary" };
function getItemRarity(item) {
  const base = RARITY.get(item.typeId) ?? "common";
  if (base === "epic" || base === "legendary" || item.typeId === "minecraft:enchanted_book") return base;
  const enchanted = (item.getComponent("minecraft:enchantable")?.getEnchantments().length ?? 0) > 0;
  return enchanted ? UPGRADE[base] : base;
}

// data/scripts/systems/lootBeam.ts
var BEAMS = {
  common: { color: hex(16777215), height: 0.75, alpha: 0.4 },
  uncommon: { color: hex(16777044), height: 1, alpha: 0.85 },
  rare: { color: hex(5570559), height: 1.3, alpha: 0.85 },
  epic: { color: hex(16733439), height: 1.6, alpha: 0.85 },
  legendary: { color: hex(16747546), height: 2, alpha: 1 }
};
var RENEW_TICKS = 20;
var BIG_STACK = 5;
var BIG_STACK_SCALE = 1.25;
var LAND_DELAY_TICKS = 4;
var WAITING = -1;
function hex(value) {
  return { red: (value >> 16 & 255) / 255, green: (value >> 8 & 255) / 255, blue: (value & 255) / 255 };
}
var beams = /* @__PURE__ */ new Map();
function trackLootItem(entity) {
  if (entity.typeId !== "minecraft:item" || !entity.isValid || beams.has(entity.id)) return;
  const item = entity.getComponent("minecraft:item")?.itemStack;
  if (!item) return;
  const beam = BEAMS[getItemRarity(item)];
  const molang = new MolangVariableMap5();
  molang.setColorRGB("variable.color", beam.color);
  molang.setFloat("variable.height", beam.height);
  molang.setFloat("variable.alpha", beam.alpha);
  beams.set(entity.id, { entity, molang, nextTick: WAITING });
}
function tickLootBeams() {
  const tick = system16.currentTick;
  for (const [id, beam] of beams) {
    if (!beam.entity.isValid) {
      beams.delete(id);
      continue;
    }
    if (beam.nextTick === WAITING) {
      if (beam.entity.isOnGround || beam.entity.isInWater) beam.nextTick = tick + LAND_DELAY_TICKS;
      continue;
    }
    if (tick < beam.nextTick) continue;
    beam.nextTick = tick + RENEW_TICKS;
    const amount = beam.entity.getComponent("minecraft:item")?.itemStack.amount ?? 1;
    beam.molang.setFloat("variable.scale", amount > BIG_STACK ? BIG_STACK_SCALE : 1);
    if (!isLoadedLocation(beam.entity.dimension, beam.entity.location)) continue;
    beam.entity.dimension.spawnParticle("ph:loot_beam_glow", beam.entity.location, beam.molang);
    beam.entity.dimension.spawnParticle("ph:loot_beam", beam.entity.location, beam.molang);
  }
}

// data/scripts/features/bosses/attacks.ts
import { EntityDamageCause as EntityDamageCause10, system as system17 } from "@minecraft/server";
var UNHITTABLE = {
  excludeTypes: ["minecraft:item", "minecraft:xp_orb"],
  excludeFamilies: ["inanimate"]
};
var DASH_TICKS = 14;
var DRIFT_PROPERTY = "ph:crimson_drift_point";
var DRIFT_MIN_RANGE = 3;
var DRIFT_MAX_RANGE = 24;
var DRIFT_MAX_HEIGHT = 3;
function parseArgs(message) {
  return message.split(",").map((raw) => {
    const value = raw.trim();
    return value !== "" && !isNaN(Number(value)) ? Number(value) : value;
  });
}
function num(value) {
  return typeof value === "number" ? value : Number(value ?? 0);
}
function str(value) {
  return value === void 0 ? "" : String(value);
}
function playBossSound(source, sound, pitch = 1) {
  if (sound) source.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 ${pitch} 0.3`);
}
function hasFamily(entity, family) {
  return entity.getComponent("minecraft:type_family")?.hasTypeFamily(family) ?? false;
}
function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy), point.z - (start.z + t * dz));
}
function bossSummonProjectile(source, message) {
  summonProjectiles(source, message, false);
}
function bossSummonProjectileFacing(source, message) {
  summonProjectiles(source, message, true);
}
function summonProjectiles(source, message, withPitch) {
  const [amount, yOffset, typeId, sound] = parseArgs(message);
  playBossSound(source, str(sound));
  const { x, y, z } = source.location;
  const spawnY = y + num(yOffset);
  for (let i = 0; i < num(amount); i++) {
    const yaw = Math.floor(Math.random() * 360);
    const pitch = withPitch ? Math.floor(-90 + Math.random() * 180) : 0;
    summonOwned(source, `summon ${typeId} ${x} ${spawnY} ${z} ${yaw} ${pitch}`);
  }
}
function bossSummon(source, message) {
  const [amount, yOffset, radius, typeId, sound, spawnEvent] = parseArgs(message);
  playBossSound(source, str(sound));
  const { x, y, z } = source.location;
  const spread = num(radius);
  const event = str(spawnEvent);
  for (let i = 0; i < num(amount); i++) {
    const offsetX = (Math.random() * 2 - 1) * spread;
    const offsetZ = (Math.random() * 2 - 1) * spread;
    const yaw = Math.floor(Math.random() * 360);
    summonOwned(source, `summon ${typeId} ${x + offsetX} ${y + num(yOffset)} ${z + offsetZ} ${yaw} 0 ${event}`.trimEnd());
  }
}
function ramDash(source, message, vertical) {
  const [force, damage, collisionRadius, sound, spareFamily] = parseArgs(message);
  const direction = source.getViewDirection();
  const push = num(force);
  source.applyImpulse({ x: direction.x * push, y: vertical ? direction.y * push : 0, z: direction.z * push });
  beginCollisionCheck(source, DASH_TICKS, num(damage), num(collisionRadius), str(spareFamily) || void 0);
  playBossSound(source, str(sound));
}
function beginCollisionCheck(dasher, duration, damage, collisionRadius, spareFamily) {
  let tick = 0;
  let prevPos = { ...dasher.location };
  const hitEntities = /* @__PURE__ */ new Set([dasher.id]);
  const interval = system17.runInterval(() => {
    if (!dasher.isValid) {
      system17.clearRun(interval);
      return;
    }
    tick++;
    const currentPos = { ...dasher.location };
    const travelled = Math.hypot(currentPos.x - prevPos.x, currentPos.y - prevPos.y, currentPos.z - prevPos.z);
    const targets = dasher.dimension.getEntities({
      ...UNHITTABLE,
      location: currentPos,
      maxDistance: collisionRadius + travelled + 1
    });
    for (const target of targets) {
      if (hitEntities.has(target.id) || !target.isValid) continue;
      if (target.hasTag("parried")) continue;
      if (spareFamily && hasFamily(target, spareFamily)) continue;
      if (distancePointToSegment(target.location, prevPos, currentPos) > collisionRadius) continue;
      hitEntities.add(target.id);
      if (!dasher.isValid) return;
      target.applyDamage(damage, { cause: EntityDamageCause10.entityAttack, damagingEntity: dasher });
    }
    prevPos = currentPos;
    if (tick >= duration) system17.clearRun(interval);
  });
}
function laserOnce(shooter, message) {
  const [range, damage, width, sound, spareFamily] = parseArgs(message);
  const length = num(range);
  const halfWidth = num(width);
  const spare = str(spareFamily);
  const start = shooter.location;
  const dir = shooter.getViewDirection();
  const end = { x: start.x + dir.x * length, y: start.y + dir.y * length, z: start.z + dir.z * length };
  const targets = shooter.dimension.getEntities({ ...UNHITTABLE, location: start, maxDistance: length + halfWidth });
  for (const target of targets) {
    if (target.id === shooter.id || !target.isValid) continue;
    if (spare && hasFamily(target, spare)) continue;
    if (distancePointToSegment(target.location, start, end) > halfWidth) continue;
    if (!shooter.isValid) return;
    target.applyDamage(num(damage), { cause: EntityDamageCause10.magic, damagingEntity: shooter });
  }
  playBossSound(shooter, str(sound));
}
function crimsonDriftMark(boss) {
  const point = findDriftPoint(boss) ?? boss.location;
  boss.setDynamicProperty(DRIFT_PROPERTY, point);
  const marker = { x: point.x, y: point.y + 1, z: point.z };
  boss.dimension.spawnParticle("ph:crimson_drift_small", marker);
  boss.dimension.spawnParticle("ph:crimson_drift_large", marker);
}
function crimsonDriftStrike(boss) {
  const stored = boss.getDynamicProperty(DRIFT_PROPERTY);
  boss.setDynamicProperty(DRIFT_PROPERTY, void 0);
  const point = isVector(stored) ? stored : boss.location;
  boss.teleport(point);
  const at = `execute positioned ${point.x} ${point.y} ${point.z} run`;
  boss.runCommand(`${at} playsound mob.zombie.remedy @a[r=32] ~~~ 1 1 0.3`);
  boss.runCommand(`${at} particle ph:crimson_roots_spread ~~1~`);
  boss.runCommand(`${at} damage @e[r=10,rm=0.1,family=!inanimate,family=!crimson_eye,type=!item] 10 magic entity @s`);
  boss.runCommand(`${at} camera @a[r=10] fade time 0 5 1 color 180 0 0`);
  boss.runCommand(`${at} effect @e[r=10,rm=0.1,family=!inanimate,family=!crimson_eye] wither 5 3 true`);
}
function isVector(value) {
  return typeof value === "object" && value !== null && "x" in value && "y" in value && "z" in value;
}
function findDriftPoint(boss) {
  const origin = boss.location;
  const top = origin.y + DRIFT_MAX_HEIGHT;
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = DRIFT_MIN_RANGE + Math.random() * (DRIFT_MAX_RANGE - DRIFT_MIN_RANGE);
    const x = origin.x + Math.cos(angle) * distance;
    const z = origin.z + Math.sin(angle) * distance;
    const rayStart = { x, y: top, z };
    if (!isLoadedLocation(boss.dimension, rayStart)) continue;
    const hit = boss.dimension.getBlockFromRay(rayStart, { x: 0, y: -1, z: 0 }, {
      maxDistance: 48,
      includeLiquidBlocks: false,
      includePassableBlocks: false
    });
    if (hit) return { x: Math.floor(x) + 0.5, y: hit.block.y + 1, z: Math.floor(z) + 0.5 };
  }
  return void 0;
}

// data/scripts/events/index.ts
world12.beforeEvents.entityHurt.subscribe((acc) => {
  const hurtEntity = acc.hurtEntity;
  if (hurtEntity?.typeId !== "minecraft:player") return;
  const damagingEntity = acc.damageSource.damagingEntity;
  const player = hurtEntity;
  const accessories2 = getAccessoryItems(player);
  accessoryOnHurt(player, accessories2);
  if (hurtEntity.hasTag("parried")) {
    acc.cancel = true;
    system18.run(() => {
      if (!hurtEntity.isValid) return;
      const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot10.Mainhand);
      const head = hurtEntity.getHeadLocation();
      const view = hurtEntity.getViewDirection();
      hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
      hurtEntity.dimension.spawnParticle(
        "ph:parry_flash",
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
        applyDurabilityDamage(player, { damage: 1 });
        return;
      }
      applyDurabilityDamage(player, { damage: 30 });
    });
  }
  if (accessories2.some((item) => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment(EquipmentSlot10.Mainhand)?.typeId === "ph:the_bleeding_spire") {
    if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
  }
});
world12.beforeEvents.playerBreakBlock.subscribe((acc) => {
  accessoryOnBreakBlock(acc.player, acc);
});
world12.beforeEvents.entityHurt.subscribe((data) => {
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
world12.beforeEvents.entityHurt.subscribe(onMaceHurt);
world12.beforeEvents.entityHurt.subscribe(onBlessingHurt);
world12.beforeEvents.entityHurt.subscribe(onTrooperHurt);
world12.beforeEvents.entityHurt.subscribe(onShieldHurt);
world12.beforeEvents.effectAdd.subscribe(onShieldEffectAdd);
world12.beforeEvents.itemUse.subscribe(onPolarisItemUse);
world12.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (!e.block.typeId.includes("ore")) return;
  if (Math.floor(Math.random() * 100) !== 1) return;
  if (e.player.getGameMode() === "Creative") return;
  const { dimension, block } = e;
  system18.run(() => {
    if (!isLoadedLocation(dimension, block.location)) return;
    dimension.spawnItem(new ItemStack8("ph:rust_coin", 1), block.location);
  });
});
world12.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (e.block.typeId !== "minecraft:prismarine") return;
  const player = e.player;
  const itemStack = e.itemStack;
  const block = e.block;
  const dimension = e.dimension;
  if (player.getGameMode() === "Creative") return;
  if (itemStack?.getComponent("enchantable")?.getEnchantment("silk_touch")) return;
  if (!itemStack?.getTags().includes("minecraft:is_pickaxe")) return;
  e.cancel = true;
  system18.run(() => {
    if (!isLoadedLocation(dimension, block.location)) return;
    dimension.setBlockType(block.location, "minecraft:air");
    dimension.spawnItem(new ItemStack8("minecraft:prismarine_shard", Math.floor(Math.random() * 3 + 4)), block.location);
  });
});
world12.beforeEvents.playerInteractWithBlock.subscribe((event) => {
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
function popCrystallIfFloating(block, drop = true) {
  if (!block.isValid) return false;
  const typeId = block.typeId;
  if (!crystallDropIds.has(typeId)) return false;
  const dropId = crystallDrops[typeId];
  const support = crystallSupport(block);
  if (!support) return false;
  if (!support.isAir && !support.isLiquid) return false;
  const loc = block.location;
  const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
  block.dimension.setBlockType(loc, "minecraft:air");
  if (drop && dropId) block.dimension.spawnItem(new ItemStack8(dropId, 1), center);
  block.dimension.playSound("dig.amethyst", center);
  return true;
}
world12.afterEvents.playerBreakBlock.subscribe((e) => {
  const loc = e.block.location;
  const dimension = e.dimension;
  const drop = !e.player.isValid || e.player.getGameMode() !== "Creative";
  system18.run(() => {
    for (const off of faceOffsets) {
      const location = { x: loc.x + off.x, y: loc.y + off.y, z: loc.z + off.z };
      if (!isLoadedLocation(dimension, location)) continue;
      const neighbor = dimension.getBlock(location);
      if (neighbor) popCrystallIfFloating(neighbor, drop);
    }
  });
});
world12.afterEvents.entityHitEntity.subscribe((acc) => {
  const damagingEntity = acc.damagingEntity;
  const hitEntity = acc.hitEntity;
  accessoryOnHitEntity(damagingEntity, hitEntity);
  onSentinelHit(damagingEntity, hitEntity);
});
world12.afterEvents.entityHurt.subscribe(onDamageIndicator);
world12.afterEvents.entityHurt.subscribe(onDummyHurt);
world12.afterEvents.entityHurt.subscribe(onTitanCoreHurt);
world12.afterEvents.entityHurt.subscribe(onSentinelHurt);
world12.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
  if (hurtEntity.typeId !== "minecraft:player" || !hurtEntity.isValid) return;
  onAbsorptionHurt(hurtEntity, damage);
});
world12.afterEvents.effectAdd.subscribe(({ entity, effect }) => {
  if (entity.typeId !== "minecraft:player" || !entity.isValid) return;
  if (effect.typeId.replace("minecraft:", "") !== "absorption") return;
  onAbsorptionAdded(entity, effect.amplifier);
});
world12.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, beforeItemStack }) => {
  onDynamicLighting(player);
  healthBarRuntime(player, "inventoryItemChanged", beforeItemStack, itemStack);
});
function runControlAction(player, action) {
  if (action === "dash" || action === "airDash") dashRuntime(player);
  else if (action === "switchSkill") switchHeldWeaponSkill(player);
}
world12.afterEvents.playerSwingStart.subscribe(({ player, heldItemStack, swingSource }) => {
  runControlAction(player, onControlSwingInput(player, swingSource));
  onShieldSwing(player);
  for (const weapon of weapons) {
    if (heldItemStack?.typeId === weapon.itemId) {
      if (swingSource != "Mine" && swingSource != "Attack") return;
      weapon.handleAttack(player);
    }
  }
});
world12.afterEvents.playerButtonInput.subscribe(({ player: source, button, newButtonState }) => {
  if (button == "Sneak") onShieldSneak(source, newButtonState == "Pressed");
  if (newButtonState != "Pressed") return;
  if (button == "Sneak") {
    windPlungeRuntime(source);
  }
  runControlAction(source, onControlButtonInput(source, button));
});
world12.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!itemStack) return;
  parryRuntime(source, itemStack);
  startBetterMending(source, itemStack);
  for (const skill of weaponSkills) {
    if (itemStack.typeId === skill.itemId) {
      skill.useSkill(source);
    }
  }
});
world12.afterEvents.itemStartUse.subscribe(({ source }) => onShieldItemUse(source, true));
world12.afterEvents.itemStopUse.subscribe(({ itemStack, source }) => {
  cancelPolarisCharge(itemStack, source);
  onShieldItemUse(source, false);
});
world12.afterEvents.itemReleaseUse.subscribe(({ itemStack, source }) => {
  cancelPolarisCharge(itemStack, source);
  onShieldItemUse(source, false);
});
world12.afterEvents.entityDie.subscribe(({ damageSource, deadEntity }) => {
  const killer = damageSource?.damagingEntity;
  if (deadEntity?.typeId === "minecraft:player") {
    clearPlayerLighting(deadEntity);
    clearAbsorption(deadEntity);
  }
  if (deadEntity?.typeId === "ph:titan_core") {
    onTitanCoreDie(deadEntity);
  }
  if (deadEntity?.typeId === "ph:ancient_sentinel") {
    onSentinelDie(deadEntity);
  }
  if (!killer?.isValid) return;
  const mainhand = killer?.getComponent("equippable")?.getEquipment(EquipmentSlot10.Mainhand);
  if (killer?.typeId === "minecraft:player" && mainhand?.typeId === "ph:charged_copper_axe") {
    addScore(killer, "auric_charge", 4);
    if (!deadEntity.isValid || !isLoadedLocation(deadEntity.dimension, deadEntity.location)) return;
    deadEntity.dimension.spawnEntity("minecraft:lightning_bolt", deadEntity.location);
  }
});
world12.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => onTrooperDie(deadEntity, damageSource));
world12.afterEvents.entityRemove.subscribe(({ removedEntityId, typeId }) => {
  forgetWard(removedEntityId);
  onTrooperRemove(removedEntityId, typeId);
});
world12.afterEvents.entityHealthChanged.subscribe(({ entity }) => {
  if (!entity.isValid || !(entity instanceof Player19)) return;
  healthBarRuntime(entity, "healthChanged");
});
world12.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  healthBarRuntime(player, "dimensionChanged");
});
world12.afterEvents.playerGameModeChange.subscribe(({ player }) => {
  healthBarRuntime(player, "gamemodeChanged");
});
var animatedTpSpeeds = new Map(
  specifiedFamilityAndSpeed.map((data) => [data.type_family, data.speed])
);
world12.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  if (cause != "Spawned") return;
  if (!entity.isValid) return;
  const family = entity?.getComponent("minecraft:type_family")?.getTypeFamilies();
  if (!family) return;
  const matchedFamily = family.find((typeFamily) => animatedTpSpeeds.has(typeFamily));
  const speed = matchedFamily === void 0 ? void 0 : animatedTpSpeeds.get(matchedFamily);
  if (speed === void 0) return;
  const dir = entity.getViewDirection();
  const dx = dir.x;
  const dy = dir.y;
  const dz = dir.z;
  const interval = system18.runInterval(() => {
    if (!entity?.isValid) {
      system18.clearRun(interval);
      return;
    }
    entity?.teleport({
      x: entity.location.x + dx * speed,
      y: entity.location.y + dy * speed,
      z: entity.location.z + dz * speed
    });
  }, 1);
});
world12.afterEvents.entitySpawn.subscribe(({ entity }) => onSentinelSpawn(entity));
world12.afterEvents.entitySpawn.subscribe(({ entity }) => trackLootItem(entity));
world12.afterEvents.entityLoad.subscribe(({ entity }) => trackLootItem(entity));
world12.beforeEvents.playerLeave.subscribe(({ player }) => {
  clearPlayerLighting(player);
  clearControlState(player);
  clearAbsorption(player);
  clearShieldState(player.id);
});
system18.runInterval(() => {
  for (const player of world12.getPlayers()) {
    javaSaturationRegen(player);
    syncAbsorption(player);
  }
}, 6);
system18.runInterval(trackMaceFall, 1);
system18.runInterval(tickTroopers, 4);
system18.runInterval(tickShields, 1);
system18.runInterval(checkBlessingMilestones, 20);
system18.runInterval(tickTitanRadiation, 40);
system18.runInterval(tickLootBeams, 1);
system18.runInterval(tickTitanRidgeSites, 100);
system18.runInterval(tickAccessories, 100);
system18.runInterval(sweepSentinels, 200);
system18.runInterval(() => {
  for (const player of world12.getPlayers()) {
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
system18.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceBlock, sourceEntity }) => {
  switch (id) {
    case "ph:remove_target_lock":
      if (!sourceEntity) return;
      system18.runTimeout(() => {
        if (!sourceEntity.isValid) return;
        sourceEntity.removeTag("locked");
      }, 5);
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
      const molang = new MolangVariableMap6();
      molang.setFloat("variable.spawn_rate", Number(particleAmount));
      sourceEntity.dimension.spawnParticle("ph:cruxshaper_charge_arc", sourceEntity.location, molang);
      break;
    case "ph:particle_custom":
      system18.run(() => {
        const particleMolang = new MolangVariableMap6();
        particleMolang.setFloat("variable.spawn_rate", Number(message));
        if (sourceBlock?.isValid) {
          sourceBlock.dimension.spawnParticle("ph:bounding_circle", sourceBlock.center(), particleMolang);
        }
      });
      break;
    default:
      break;
  }
});

// data/scripts/events/loader.ts
import { world as world13, system as system23, ItemStack as ItemStack11 } from "@minecraft/server";

// data/scripts/core/playerProperties.ts
var PLAYER_PROPERTIES = [
  { id: "ph:dash_control", label: "Passive Dash control", type: "number", group: "Settings", default: 0 },
  { id: "ph:skill_switch_control", label: "Skill switch control", type: "number", group: "Settings", default: 0 },
  { id: "ph:dash_level", label: "Dash level", type: "number", group: "Progress", default: 0 },
  { id: "ph:health_level", label: "Health level", type: "number", group: "Progress", default: 0 },
  { id: "ph:plunge_unlock", label: "Wind Plunge unlocked", type: "boolean", group: "Progress", default: false },
  { id: "ph:guidebook_acquired", label: "Guidebook received", type: "boolean", group: "Progress", default: true },
  { id: "ph:ever_obtained_xeonnite_cube", label: "Held a Xeonnite Cube", type: "boolean", group: "Progress", default: false },
  { id: "ph:ever_visited_titan_ridge", label: "Visited Titan Ridge", type: "boolean", group: "Progress", default: false },
  { id: "ph:xeonnite_blessing", label: "Xeonnite Blessing", type: "boolean", group: "Progress", default: false },
  { id: "ph:dash_unlock", label: "Dash unlock (0 disables dash)", type: "number", group: "Progress" },
  { id: "ph:forge_parry_nerf_until", label: "Forge parry nerf ends (ms)", type: "number", group: "Runtime" },
  { id: "ph:xeonnite_cutscene_active", label: "Blessing cutscene running", type: "boolean", group: "Runtime" },
  { id: "ph:polaris_charging", label: "Polaris Power charging", type: "boolean", group: "Runtime" }
];
function applyPropertyDefaults(player) {
  for (const def of PLAYER_PROPERTIES) {
    if (def.default === void 0) continue;
    if (player.getDynamicProperty(def.id) === void 0) player.setDynamicProperty(def.id, def.default);
  }
}

// data/scripts/features/blocks/customComponents.ts
import { system as system19, MolangVariableMap as MolangVariableMap7, ItemStack as ItemStack9, Player as Player20, EquipmentSlot as EquipmentSlot11 } from "@minecraft/server";

// data/scripts/core/params.ts
function readParams(parameters) {
  const raw = parameters.params;
  return typeof raw === "object" && raw !== null ? raw : {};
}
function numParam(params, key) {
  const value = params[key];
  return typeof value === "number" ? value : void 0;
}
function strParam(params, key) {
  const value = params[key];
  return typeof value === "string" ? value : void 0;
}

// data/scripts/features/blocks/customComponents.ts
var BOSS_SPAWN_MIN_DISTANCE = 4;
var BOSS_SPAWN_MAX_DISTANCE = 12;
var BOSS_SPAWN_HEAD_ROOM = 4;
var BOSS_SPAWN_SEARCH_DEPTH = 12;
var ACTIVATION_STATE = "ph:activation_state";
var REPAIR_SLOTS = [EquipmentSlot11.Head, EquipmentSlot11.Chest, EquipmentSlot11.Legs, EquipmentSlot11.Feet, EquipmentSlot11.Offhand];
var DIRT_PATHABLE = [
  "minecraft:dirt",
  "minecraft:dirt_with_roots",
  "minecraft:podzol",
  "minecraft:mycellium",
  "minecraft:coarse_dirt"
];
function hasOrbitalTargets(dimension, location, maxDistance, sourceTag) {
  return dimension.getEntities({
    location,
    maxDistance,
    excludeTags: [sourceTag],
    excludeTypes: ["minecraft:item"],
    excludeFamilies: ["inanimate"]
  }).length > 0;
}
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
      const floorLocation = { x, y: y - 1, z };
      if (!isLoadedLocation(dimension, floorLocation)) continue;
      const floor = dimension.getBlock(floorLocation);
      if (!isGroundBlock(floor)) continue;
      const headRoom = Array.from({ length: BOSS_SPAWN_HEAD_ROOM }, (_, up) => ({ x, y: y + up, z })).every((location) => isLoadedLocation(dimension, location) && dimension.getBlock(location)?.isAir === true);
      if (!headRoom) break;
      return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return { x: origin.x, y: origin.y + 1.1, z: origin.z };
}
var COPPER_RING_COLOR = { red: 1, green: 0.63137, blue: 0, alpha: 1 };
function coreRing(size, color) {
  const map = new MolangVariableMap7();
  map.setFloat("variable.size", size);
  map.setColorRGBA("variable.rgba", color);
  return map;
}
var copperRing = () => coreRing(1, COPPER_RING_COLOR);
function isActive(block) {
  return !!block && getCustomState(block, ACTIVATION_STATE) == 1;
}
function sendNeedItem(player, item, suffix) {
  player.sendMessage({
    rawtext: [
      { text: `You need \xA7a${item.amount}x ` },
      { translate: `${item.localizationKey}` },
      { text: suffix }
    ]
  });
}
function registerCustomComponents(initEvent) {
  initEvent.itemComponentRegistry.registerCustomComponent("ph:charge_passive", {
    onHitEntity({ hitEntity, attackingEntity: source, itemStack }) {
      if (itemStack?.typeId !== "ph:charged_copper_axe") return;
      system19.runTimeout(() => {
        if (!source.isValid || !hitEntity.isValid) return;
        if (getScore(source, "charged_copper_axe") == 100) {
          summonOwned(source, "summon lightning_bolt", hitEntity);
        }
        const calculatedDamage = 10 + getScore(source, "charged_copper_axe") / 10;
        hitEntity.applyDamage(calculatedDamage);
        setScore(source, "charged_copper_axe", 0);
      }, 3);
    },
    onUse({ source: player }) {
      player.startItemCooldown("charged_copper_axe", 120);
      applyDurabilityDamage(player, { damage: 36 });
      system19.run(() => {
        if (!player.isValid) return;
        player.playAnimation("animation.charged_copper_axe.attack_3");
        system19.runTimeout(() => {
          if (!player.isValid) return;
          player.dimension.playSound("weapon_slash.slash_heavy", player.location);
          player.dimension.spawnParticle("ph:lightning_flash", player.location);
          player.dimension.spawnParticle("ph:lightning_sparks", player.location);
          player.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=4] 18 entity_attack entity "${player.name}"`);
          summonOwned(player, "summon lightning_bolt ^^^5 ~ 0");
          summonOwned(player, "summon lightning_bolt ^^^10 ~ 0");
          player.runCommand("particle ph:lightning_sparks ^^^5");
          player.runCommand("particle ph:lightning_sparks ^^^10");
        }, 8);
      });
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:time_polarizer", {
    onUse({ source }) {
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
    onUse({ source, itemStack }, parameters) {
      const params = readParams(parameters);
      const cooldownCategory = itemStack?.getComponent("cooldown")?.cooldownCategory;
      const horizontalDashStrength = numParam(params, "horizontal_dash_strength") ?? 0;
      const verticalDashStrength = numParam(params, "vertical_dash_strength") ?? 0;
      const dashDirection = strParam(params, "dashDirection") ?? "view_direction";
      const soundEffect = strParam(params, "sound_effect") ?? "random.explode";
      const durabilityDamage = numParam(params, "durability_damage") ?? 0;
      const cooldownValue = numParam(params, "cooldown_value") ?? 20;
      const particleEffect = strParam(params, "particle_effect") ?? "minecraft:critical_hit_emitter";
      applyDurabilityDamage(source, { damage: durabilityDamage });
      const dashed = dashDirection === "impulse" || dashDirection === "view_direction" || dashDirection === "velocity";
      if (dashDirection === "impulse") {
        source.applyImpulse({ x: source.getViewDirection().x * horizontalDashStrength, y: verticalDashStrength, z: source.getViewDirection().z * horizontalDashStrength });
      } else if (dashDirection === "view_direction") {
        source.applyKnockback({ x: source.getViewDirection().x * horizontalDashStrength, z: source.getViewDirection().z * horizontalDashStrength }, verticalDashStrength);
      } else if (dashDirection === "velocity") {
        source.applyKnockback({ x: source.getVelocity().x * horizontalDashStrength, z: source.getVelocity().z * horizontalDashStrength }, verticalDashStrength);
      }
      if (dashed) {
        source.dimension.playSound(soundEffect, source.location);
        source.dimension.spawnParticle(particleEffect, source.location);
        if (cooldownCategory) source.startItemCooldown(cooldownCategory, cooldownValue);
      }
      if (!source.isGliding) {
        source.playAnimation("animation.player_extend.dash", {
          stopExpression: "query.is_on_ground || query.is_gliding || query.is_in_water"
        });
      }
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:treasure_bag", {
    onUse({ source }, parameters) {
      const inventory = source.getComponent("inventory")?.container;
      if (!inventory) return;
      const loot = strParam(readParams(parameters), "loot") ?? "loot_tables/empty";
      inventory.setItem(source.selectedSlotIndex, void 0);
      source.runCommand(`loot spawn ~~~ loot "${loot}"`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:food_effects", {
    onConsume({ source, itemStack }, parameters) {
      if (!source.isValid) return;
      const params = readParams(parameters);
      const playerHealthLevel = Number(source.getDynamicProperty("ph:health_level") ?? 0);
      const healthBoostLevel = numParam(params, "health_boost_levels") ?? 0;
      const healthBoostDuration = numParam(params, "health_boost_duration") ?? 0;
      for (const tag of itemStack.getTags()) {
        if (!tag.startsWith("ph:food_effects-")) continue;
        const [, effect, duration, amplifier] = tag.split("-");
        if (!effect) continue;
        source.addEffect(effect, parseFloat(duration ?? "0"), {
          amplifier: parseFloat(amplifier ?? "0")
        });
      }
      source.runCommand(`effect @s health_boost ${healthBoostDuration} ${3 * (playerHealthLevel + healthBoostLevel)} true`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:ability_upgrade", {
    onUse({ source }, parameters) {
      const params = readParams(parameters);
      const minLevel = numParam(params, "min_level") ?? 0;
      const passiveAbility = strParam(params, "passive_ability");
      const upgradeTo = numParam(params, "upgrade_to");
      const upgradeStep = numParam(params, "upgrade_step") ?? 0;
      const upgradeSound = strParam(params, "upgrade_sound") ?? "random.levelup";
      const upgradeParticle = strParam(params, "upgrade_particle") ?? "ph:auric_photonizer_explode";
      if (!passiveAbility) {
        console.error(`Please give the specified value for "passive_ability"`);
        return;
      }
      const inventory = source.getComponent("inventory")?.container;
      const property = Number(source.getDynamicProperty(passiveAbility) ?? 0);
      if (property < minLevel) {
        source.sendMessage(`\xA7cTo upgrade to this level, you need minimum ability level of ${minLevel}`);
        return;
      }
      if (upgradeTo === void 0 && upgradeStep < 1) {
        console.error(`Please give the specified value for the "upgrade_to" or "upgrade_step"`);
        return;
      }
      if (upgradeTo !== void 0) source.setDynamicProperty(passiveAbility, upgradeTo);
      if (upgradeStep > 0) source.setDynamicProperty(passiveAbility, property + upgradeStep);
      source.sendMessage(`\xA7aUpgrade successful, feel the difference`);
      source.dimension.playSound(upgradeSound, source.location);
      source.dimension.spawnParticle(upgradeParticle, source.location);
      const heldId = inventory?.getItem(source.selectedSlotIndex)?.typeId;
      if (heldId) source.runCommand(`clear @s ${heldId} -1 1`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:vanilla_tool_fix", {
    onUseOn({ source, block }) {
      if (!(source instanceof Player20)) return;
      const item = source.getComponent("inventory")?.container?.getItem(source.selectedSlotIndex);
      if (item?.hasTag("minecraft:is_shovel") && DIRT_PATHABLE.includes(block.typeId)) {
        block.dimension.setBlockType(block.location, "minecraft:dirt_path");
        source.playSound("use.grass");
        applyDurabilityDamage(source);
      }
    },
    onMineBlock({ source }) {
      if (source instanceof Player20) applyDurabilityDamage(source);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_shooter", {
    onUse({ source: player, itemStack }, parameters) {
      const params = readParams(parameters);
      const projectileEntity = strParam(params, "projectile_entity");
      const soundEffect = strParam(params, "sound_effect") ?? "random.explode";
      const costType = strParam(params, "cost_type") ?? "durability";
      const costAmount = numParam(params, "cost_amount") ?? 1;
      const altProjectileEvent = strParam(params, "alt_projectile_event");
      const altCostType = strParam(params, "alt_cost_type") ?? "durability";
      const altCostAmount = numParam(params, "alt_cost_amount") ?? 1;
      const animation = strParam(params, "animation");
      const cooldown = itemStack?.getComponent("cooldown");
      const altEvents = {
        oceanic_attack: () => {
          player.startItemCooldown("nature_staff", 50);
          summonOwned(player, "summon ph:ocean_crystal_wave ~~~5 0 0");
          summonOwned(player, "summon ph:ocean_crystal_wave ~-5~~ 90 0");
          summonOwned(player, "summon ph:ocean_crystal_wave ~~~-5 180 0");
          summonOwned(player, "summon ph:ocean_crystal_wave ~5~~ 270 0");
          player.runCommand(
            `playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`
          );
        }
      };
      if (player.isSneaking) {
        const eventFunc = altProjectileEvent === void 0 ? void 0 : altEvents[altProjectileEvent];
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
      if (cooldown?.cooldownCategory) player.startItemCooldown(cooldown.cooldownCategory, cooldown.cooldownTicks);
      if (animation !== void 0) player.playAnimation(animation);
      if (!projectileEntity) return;
      const head = player.getHeadLocation();
      const view = player.getViewDirection();
      const offset = 0.6;
      const spawnAt = {
        x: head.x + view.x * offset,
        y: head.y + view.y * offset,
        z: head.z + view.z * offset
      };
      if (!isLoadedLocation(player.dimension, spawnAt)) return;
      const bullet = player.dimension.spawnEntity(projectileEntity, spawnAt);
      const proj = bullet.getComponent("minecraft:projectile");
      if (!proj) return;
      proj.owner = player;
      proj.shoot({
        x: view.x * 2,
        y: view.y * 2,
        z: view.z * 2
      });
      player.runCommand(`playsound ${soundEffect} @a[r=24] ~~~ 1 1 0.3`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:cruxshaper", {
    onUse({ source: player }) {
      player.startItemCooldown("cruxshaper", 600);
      function impact2() {
        if (!player.isValid) return;
        player.removeEffect("slow_falling");
        player.dimension.spawnParticle("ph:cruxshaper_smash_explosion", player.location);
        player.dimension.playSound("random.explode", player.location);
        player.runCommand("damage @e[r=10,rm=0.1,family=!inanimate,type=!item] 50 entity_explosion entity @s");
        player.runCommand("execute as @s at @e[r=10,rm=0.1,family=!inanimate,type=!item] run setblock ~~~ fire");
      }
      system19.run(() => {
        if (!player.isValid) return;
        player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
        player.addEffect("levitation", 20, {
          amplifier: 24
        });
        player.dimension.playSound("random.explode", player.location);
        system19.runTimeout(() => {
          if (!player.isValid) return;
          player.dimension.spawnParticle("ph:cruxshaper_flung", player.location);
          player.applyKnockback({ x: 0, z: 0 }, -2.1);
          player.addEffect("slow_falling", 20);
          player.playAnimation("animation.player_extend.plunge", {
            stopExpression: "query.is_on_ground"
          });
          player.dimension.playSound("random.explode", player.location);
          const intervalRun = system19.runInterval(() => {
            if (!player.isValid) {
              system19.clearRun(intervalRun);
              return;
            }
            if (!player.isOnGround) return;
            system19.run(impact2);
            system19.clearRun(intervalRun);
          }, 2);
        }, 30);
      });
      applyDurabilityDamage(player, { damage: 50 });
    },
    onUseOn({ source }) {
      if (!(source instanceof Player20)) return;
      system19.run(() => {
        if (source.isValid) source.sendMessage("Look up while using the skill!");
      });
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:repair_full_inventory", {
    onUse({ source }, parameters) {
      const inventory = source.getComponent("minecraft:inventory")?.container;
      const equippable = source.getComponent("minecraft:equippable");
      if (!inventory || !equippable) return;
      const params = readParams(parameters);
      const repairRatio = numParam(params, "repair_ratio") ?? 100;
      const experienceCost = numParam(params, "experience_cost");
      if (experienceCost !== void 0 && source.level < experienceCost) return;
      for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;
        const durability = item.getComponent("minecraft:durability");
        if (!durability) continue;
        durability.damage = durability.damage - durability.damage * (repairRatio / 100);
        inventory.setItem(i, item);
      }
      for (const slot of REPAIR_SLOTS) {
        const equipmentSlot = equippable.getEquipmentSlot(slot);
        const item = equipmentSlot.getItem();
        if (!item) continue;
        const durability = item.getComponent("minecraft:durability");
        if (!durability) continue;
        durability.damage = durability.damage - durability.damage * (repairRatio / 100);
        equipmentSlot.setItem(item);
      }
      if (experienceCost !== void 0) {
        source.addLevels(-experienceCost);
      } else {
        console.log("experienceCost invalid:", experienceCost);
      }
      source.playSound("random.anvil_use");
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:auric_communicator", {
    onUse({ source }) {
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
      const dimension = block.dimension;
      const blockLoc = block.location;
      dimension.playSound("random.toast", blockLoc);
      source.playSound("random.toast");
      dimension.spawnParticle("ph:auric_communicator_loading", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
      if (auricMode == 1) {
        source.addTag("AURIC_ORBITAL_NUKE");
        system19.runTimeout(() => {
          if (!source.isValid || !isLoadedLocation(dimension, blockLoc)) return;
          dimension.playSound("random.explode", blockLoc);
          if (hasOrbitalTargets(dimension, blockLoc, 48, "AURIC_ORBITAL_NUKE")) {
            dimension.runCommand(`damage @e[r=48,tag=!AURIC_ORBITAL_NUKE,type=!item,family=!inanimate,x=${blockLoc.x},y=${blockLoc.y},z=${blockLoc.z}] 50 entity_explosion entity @e[tag=AURIC_ORBITAL_NUKE]`);
          }
          dimension.spawnParticle("ph:auric_stab_shot", { x: blockLoc.x, y: 0, z: blockLoc.z });
          dimension.spawnParticle("ph:auric_nuke_shot", { x: blockLoc.x, y: blockLoc.y + 1, z: blockLoc.z });
          removeScore(source, "auric_charge", 100);
          source.startItemCooldown("auric_communicator", 600);
          source.removeTag("AURIC_ORBITAL_NUKE");
        }, 30);
        return;
      }
      source.addTag("AURIC_ORBITAL_LASER");
      system19.runTimeout(() => {
        if (!source.isValid || !isLoadedLocation(dimension, blockLoc)) return;
        for (let i = 0; i < 381; i += 10) {
          if (hasOrbitalTargets(dimension, { x: blockLoc.x, y: i, z: blockLoc.z }, 10, "AURIC_ORBITAL_LASER")) {
            dimension.runCommand(`damage @e[r=10,tag=!AURIC_ORBITAL_LASER,type=!item,family=!inanimate,x=${blockLoc.x},y=${i},z=${blockLoc.z}] 80 entity_explosion entity @e[tag=AURIC_ORBITAL_LASER]`);
          }
          dimension.playSound("random.explode", { x: blockLoc.x, y: i, z: blockLoc.z });
        }
        dimension.spawnParticle("ph:auric_stab_shot_refined", { x: blockLoc.x, y: 0, z: blockLoc.z });
        dimension.spawnParticle("ph:auric_stab_shot_line", { x: blockLoc.x, y: 0, z: blockLoc.z });
        removeScore(source, "auric_charge", 50);
        source.startItemCooldown("auric_communicator", 600);
        source.removeTag("AURIC_ORBITAL_LASER");
      }, 30);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:battery_container", {
    onUse({ source, itemStack }, parameters) {
      const params = readParams(parameters);
      const whereToFill = strParam(params, "where_to_fill") || "auric_charge";
      const transferPerUse = numParam(params, "charges") || 100;
      const maxCharge = numParam(params, "max_charge") || 700;
      const durability = itemStack?.getComponent("minecraft:durability");
      if (!durability) return;
      const batteryCharge = durability.maxDurability - durability.damage;
      if (batteryCharge <= 1) {
        source.sendMessage("\xA7cYour Battery Container is empty.");
        return;
      }
      const currentCharge = getScore(source, whereToFill);
      const missingCharge = maxCharge - currentCharge;
      if (missingCharge <= 0) {
        source.sendMessage("\xA7eAuric Charge already full.");
        return;
      }
      const transferAmount = Math.min(transferPerUse, batteryCharge, missingCharge);
      setScore(source, whereToFill, currentCharge + transferAmount);
      applyDurabilityDamage(source, { damage: transferAmount });
      source.sendMessage(`\xA7b+${transferAmount} Auric Charge`);
    }
  });
  initEvent.itemComponentRegistry.registerCustomComponent("ph:custom_parry_window", {
    onUse({ source }, parameters) {
      const params = readParams(parameters);
      const windowTime = numParam(params, "window_time") ?? 1;
      const animation = strParam(params, "animation");
      if (animation) source.playAnimation(animation);
      source.dimension.spawnParticle("ph:parry_prepare", source.location);
      source.dimension.playSound("item.spear.use", source.location);
      source.addTag("parried");
      source.inputPermissions.setPermissionCategory(2, false);
      applyDurabilityDamage(source, { damage: 1 });
      system19.runTimeout(() => {
        if (!source.isValid) return;
        if (source.hasTag("parried")) source.removeTag("parried");
        source.inputPermissions.setPermissionCategory(2, true);
      }, windowTime);
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:boss_summon", {
    onPlayerInteract({ player, block }, parameters) {
      if (!player) return;
      const params = readParams(parameters);
      const boss = strParam(params, "boss");
      const bargainingItem = strParam(params, "bargaining_item");
      const bargainingItemAmount = numParam(params, "bargaining_item_amount") || 1;
      const message = strParam(params, "message");
      const transformIntoEntity = strParam(params, "transform_into_entity");
      if (!bargainingItem) return;
      const mergedDataItem = new ItemStack9(bargainingItem, bargainingItemAmount);
      const mainhand = player.getComponent("equippable")?.getEquipment(EquipmentSlot11.Mainhand);
      if (mainhand?.typeId !== bargainingItem || mainhand.amount < bargainingItemAmount) {
        sendNeedItem(player, mergedDataItem, ` \xA7rto activate this summoning block!`);
        return;
      }
      if (transformIntoEntity && !boss) {
        block.dimension.setBlockType(block.location, "minecraft:air");
        block.dimension.spawnEntity(transformIntoEntity, block.center());
        block.dimension.playSound("custom_sfx.boss_summoned", block.location);
        player.runCommand(`clear @s ${bargainingItem} -1 ${bargainingItemAmount}`);
        if (message) player.sendMessage(message);
        return;
      }
      if (!boss) return;
      block.dimension.spawnEntity(boss, block.center());
      block.dimension.playSound("custom_sfx.boss_summoned", block.location);
      player.runCommand(`clear @s ${bargainingItem} -1 ${bargainingItemAmount}`);
      if (message) player.sendMessage(message);
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:ancient_copper_core", {
    onPlayerInteract({ player, block }) {
      if (!player) return;
      const north = block.north(2);
      const east = block.east(2);
      const south = block.south(2);
      const west = block.west(2);
      if (!north || !east || !south || !west) return;
      if (isActive(north) && isActive(east) && isActive(south) && isActive(west)) {
        player.sendMessage("Core activated. Waiting for his approach");
        block.dimension.setBlockType(north.location, "ph:core_battery");
        block.dimension.setBlockType(south.location, "ph:prismarine_battery");
        block.dimension.spawnParticle("ph:auric_beam", block.center());
        block.dimension.spawnParticle("ph:auric_light_flash", block.center());
        block.dimension.spawnParticle("ph:auric_beam_small", north.center());
        block.dimension.spawnParticle("ph:auric_beam_small", east.center());
        block.dimension.spawnParticle("ph:auric_beam_small", south.center());
        block.dimension.spawnParticle("ph:auric_beam_small", west.center());
        block.dimension.playSound("custom_sfx.boss_summoned", block.center());
        const dimension = block.dimension;
        const bossSpawnPoint = findBossSpawnPoint(dimension, block.center(), player);
        system19.runTimeout(() => {
          if (!isLoadedLocation(dimension, bossSpawnPoint)) return;
          dimension.spawnEntity("ph:copper_mechanical_array", bossSpawnPoint);
          dimension.playSound("mob.zombie.woodbreak", bossSpawnPoint);
          dimension.spawnParticle("ph:auric_beam_small", bossSpawnPoint);
          dimension.spawnParticle("ph:auric_light_flash", bossSpawnPoint);
        }, 100);
      }
      if (north.typeId != "minecraft:air" || east.typeId != "minecraft:air" || south.typeId != "minecraft:air" || west.typeId != "minecraft:air") return;
      block.dimension.playSound("tile.piston.in", block.center());
      block.dimension.setBlockType(north.location, "ph:core_battery");
      block.dimension.setBlockType(east.location, "ph:auric_battery");
      block.dimension.setBlockType(south.location, "ph:prismarine_battery");
      block.dimension.setBlockType(west.location, "ph:auric_battery");
    },
    onTick({ block, dimension }) {
      const north = block.north(2);
      const east = block.east(2);
      const south = block.south(2);
      const west = block.west(2);
      if (!north || !east || !south || !west) return;
      if (isActive(north)) {
        dimension.spawnParticle("ph:bounding_circle", north.center(), coreRing(1, { red: 1, green: 1, blue: 1, alpha: 1 }));
      }
      if (isActive(east)) {
        dimension.spawnParticle("ph:bounding_circle", east.center(), copperRing());
      }
      if (isActive(south)) {
        dimension.spawnParticle("ph:bounding_circle", south.center(), coreRing(1, { red: 0.352, green: 1, blue: 0.705, alpha: 1 }));
      }
      if (isActive(west)) {
        dimension.spawnParticle("ph:bounding_circle", west.center(), copperRing());
      }
      if (north.typeId != "minecraft:air" || east.typeId != "minecraft:air" || south.typeId != "minecraft:air" || west.typeId != "minecraft:air") return;
      dimension.spawnParticle("ph:bounding_circle", block.center(), coreRing(3, COPPER_RING_COLOR));
      dimension.spawnParticle("ph:bounding_circle", north.center(), copperRing());
      dimension.spawnParticle("ph:bounding_circle", east.center(), copperRing());
      dimension.spawnParticle("ph:bounding_circle", south.center(), copperRing());
      dimension.spawnParticle("ph:bounding_circle", west.center(), copperRing());
    },
    onBreak({ block, dimension }) {
      for (const neighbor of [block.north(2), block.east(2), block.south(2), block.west(2)]) {
        if (neighbor) dimension.setBlockType(neighbor.location, "minecraft:air");
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:copper_battery", {
    onPlayerInteract({ player, block }, parameters) {
      if (!player) return;
      const params = readParams(parameters);
      const chargeType = strParam(params, "charge_type");
      const item = strParam(params, "item") ?? "minecraft:netherite_ingot";
      const itemCount = numParam(params, "item_count") ?? 1;
      const playerChargeObjective = strParam(params, "player_charge_objective") ?? "superchargd_copper_axe";
      const chargeMin = numParam(params, "charge_min") ?? 0;
      if (chargeType == "item") {
        if (player.getComponent("equippable")?.getEquipment(EquipmentSlot11.Mainhand)?.typeId != item) {
          sendNeedItem(player, new ItemStack9(item, itemCount), ` \xA7rto activate this copper battery slot!`);
          return;
        }
        setCustomState(block, ACTIVATION_STATE, 1);
        block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
        player.runCommand(`clear @s ${item} -1 ${itemCount}`);
      }
      if (chargeType == "player_charge") {
        if (getScore(player, playerChargeObjective) < chargeMin) {
          player.sendMessage(`You need \xA7a${chargeMin} \xA7rCharges to activate this battery slot`);
          return;
        }
        setCustomState(block, ACTIVATION_STATE, 1);
        block.dimension.spawnEntity("minecraft:lightning_bolt", block.center());
        removeScore(player, "auric_charge", chargeMin);
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:crystall_support", {
    onTick({ block, dimension }, parameters) {
      if (!block.isValid) return;
      const support = crystallSupport(block);
      if (!support) return;
      if (!support.isAir && !support.isLiquid) return;
      const dropId = strParam(readParams(parameters), "drop_item");
      const loc = block.location;
      const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
      dimension.setBlockType(loc, "minecraft:air");
      if (dropId) dimension.spawnItem(new ItemStack9(dropId, 1), center);
      dimension.playSound("dig.amethyst", center);
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:item_charger", {
    onPlayerInteract({ player, block, dimension }, parameters) {
      if (!player) return;
      const params = readParams(parameters);
      const item = strParam(params, "item");
      if (!item) return;
      const maxBatteryStack = numParam(params, "max_battery_stack") || 4;
      const soundInput = strParam(params, "sound_input");
      const soundPickup = strParam(params, "sound_pickup");
      const itemData = new ItemStack9(item);
      const batteryCount = Number(getCustomState(block, "ph:battery_count") ?? 0);
      const batteryState = getCustomState(block, "ph:battery_state");
      const mainhand = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot11.Mainhand);
      if (!mainhand) return;
      const itemStack = mainhand.getItem();
      const durability = itemStack?.getComponent("minecraft:durability");
      if (batteryState == "result") {
        for (let i = 0; i < batteryCount; i++) {
          dimension.spawnItem(itemData, block.center());
        }
        if (soundPickup) dimension.playSound(soundPickup, block.center());
        setCustomState(block, "ph:battery_count", 0);
        setCustomState(block, "ph:battery_state", "open");
        return;
      }
      if (batteryState == "processing") return;
      if (itemStack?.typeId === item && durability && durability.damage < durability.maxDurability) {
        if (batteryCount >= maxBatteryStack) return player.sendMessage("\xA7cThe Battery slot is full.");
        mainhand.setItem(void 0);
        setCustomState(block, "ph:battery_count", batteryCount + 1);
        if (soundInput) dimension.playSound(soundInput, block.center());
        return;
      }
      if (batteryCount == 0) {
        player.sendMessage({
          rawtext: [
            { text: "You need to put drained \xA7a" },
            { translate: `${itemData.localizationKey}` }
          ]
        });
        player.playSound("note.bass");
        return;
      }
      setCustomState(block, "ph:battery_state", "processing");
    },
    onTick({ block, dimension }) {
      if (getCustomState(block, "ph:battery_state") != "processing") return;
      setCustomState(block, "ph:battery_state", "result");
      dimension.playSound("random.orb", block.center());
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:sky_gateway", {
    onPlayerInteract({ block, dimension }) {
      const active = !getCustomState(block, "ph:active");
      setCustomState(block, "ph:active", active);
      dimension.playSound(active ? "beacon.activate" : "beacon.deactivate", block.center());
    },
    onTick({ block, dimension }) {
      if (!getCustomState(block, "ph:active")) return;
      const center = block.center();
      dimension.spawnParticle("ph:sky_gateway_beam_up", center);
      dimension.spawnParticle("ph:sky_gateway_beam_down", center);
      dimension.spawnParticle("ph:sky_gateway_beam_sparkle", center);
      for (const dir of [1, -1]) {
        const pulse = new MolangVariableMap7();
        pulse.setFloat("variable.dir", dir);
        dimension.spawnParticle("ph:sky_gateway_beam_pulse", center, pulse);
      }
    }
  });
  initEvent.blockComponentRegistry.registerCustomComponent("ph:icon_only", {
    beforeOnPlayerPlace(event) {
      event.cancel = true;
    }
  });
}

// data/scripts/ui/commands.ts
import { system as system22, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType, Player as Player22 } from "@minecraft/server";

// data/scripts/ui/forms/skillUnlock.ts
import { system as system20 } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
function skillUnlock(player) {
  const dashLevelStatus = player.getDynamicProperty("ph:dash_level") ?? 0;
  const healthLevelStatus = player.getDynamicProperty("ph:health_level") ?? 0;
  const plungeUnlockStatus = player.getDynamicProperty("ph:plunge_unlock") == true ? "\xA72UNLOCKED" : "\xA74LOCKED";
  new ActionFormData().title("Skill Unlocking").body("Spend 30 experience levels to unlock one of these skills").button(`Passive Dash
\xA72Level : ${dashLevelStatus}`).button(`Extra Health
\xA72Level : ${healthLevelStatus}`).button(`Wind Plunge
${plungeUnlockStatus}`).show(player).then((r) => {
    if (r.cancelationReason == "UserBusy") system20.run(() => skillUnlock(player));
    if (r.selection == 0) dashUnlock(player);
    if (r.selection == 1) healthUpgrade(player);
    if (r.selection == 2) plungeUnlock(player);
  });
}
function dashUnlock(player) {
  const exp = player.level;
  const dashLevel = player.getDynamicProperty("ph:dash_level") ?? 0;
  new MessageFormData().title("Confirm Selection").body(`Are you sure you want to unlock Passive Dash? Press Jump twice to use it.

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
  new MessageFormData().title("Confirm Selection").body(`Are you sure you want to upgrade your max health? +16 HP at level 1, +12 HP at later levels.

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
  const plungeUnlock2 = player.getDynamicProperty("ph:plunge_unlock") ?? false;
  new MessageFormData().title("Confirm Selection").body(`Are you sure you want to unlock Wind Plunge? Press Sneak while falling more than 10 blocks to use it.

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
import { system as system21 } from "@minecraft/server";
import { ActionFormData as ActionFormData2 } from "@minecraft/server-ui";
function openSettings(player) {
  const dashControl = getDashControl(player);
  const skillSwitchControl = getSkillSwitchControl(player);
  new ActionFormData2().title("Phantasm Settings").body("Pick the controls you want for Phantasm mechanics. Every setting is saved to you only.").button(`Passive Dash
\xA77Currently: \xA7f${DASH_CONTROL_NAMES[dashControl]}`).button(`Legendary Weapon Skills
\xA77Currently: \xA7f${SKILL_SWITCH_CONTROL_NAMES[skillSwitchControl]}`).button("Reset To Defaults").button("Close").show(player).then((r) => {
    if (r.cancelationReason == "UserBusy") system21.run(() => openSettings(player));
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
  new ActionFormData3().title(guideTitle("Weapons")).body("Weapons come in many variants, from Common up to Legendary.").button("\xA73Prismatic Tools", "textures/items/prismatic_sword").button("\xA75Xeon Plasm Tools", "textures/items/xeon_plasm_sword").button("\xA75Charged Copper Axe", "textures/items/weapons/charged_copper_axe").button("\xA75Cruxshaper", "textures/items/weapons/cruxshaper").button("\xA75Nature Staff", "textures/items/weapons/nature_staff").button("\xA75Peacemaker Oath", "textures/items/weapons/peacemaker_oath").button("\xA75Seiketsu", "textures/items/weapons/seiketsu").button("\xA75Spectric Bow", "textures/items/weapons/spectric_bow").button("\xA75Thunder Gale", "textures/items/weapons/thunder_gale").button("\xA7pAnimitta", "textures/items/weapons/solaris_verdant").button("\xA7pAuric Photonizer", "textures/items/weapons/auric_photonizer").button("\xA7pPrism Weaver", "textures/items/weapons/prism_weaver").button("\xA7pSupercharged Copper Axe", "textures/items/weapons/supercharged_copper_axe").button("\xA7pThe Bleeding Spire", "textures/items/weapons/the_bleeding_spire").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 14) mainGuideScreen(player);
    if (r.selection == 0) prismaticTools(player);
    if (r.selection == 1) xeonPlasmTools(player);
    if (r.selection == 2) chargedCopperAxe(player);
    if (r.selection == 3) cruxshaper(player);
    if (r.selection == 4) natureStaff(player);
    if (r.selection == 5) peacemakerOath(player);
    if (r.selection == 6) seiketsu2(player);
    if (r.selection == 7) spectricBow(player);
    if (r.selection == 8) thunderGale(player);
    if (r.selection == 9) animitta(player);
    if (r.selection == 10) auricPhotonizer2(player);
    if (r.selection == 11) prismWeaver2(player);
    if (r.selection == 12) superchargedCopperAxe2(player);
    if (r.selection == 13) theBleedingSpire2(player);
  });
}
function prismaticTools(player) {
  new ActionFormData3().title(guideTitle("Prismatic Tools")).label("Prismatic is a tier beyond Netherite: slightly faster, with twice the durability.").label("The sword's special attack pierces through an area, but it cannot crit.").label("The spear can dismount enemies with a sprint-jump charge attack.").label("Craft Prismatic Tools with Prismatic Ingots and Netherite Tools.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function xeonPlasmTools(player) {
  new ActionFormData3().title(guideTitle("Xeon Plasm Tools")).label("Xeon Plasm is a tier beyond Prismatic: twice the damage, durability, and mining speed.").label("The sword and spear work like their Prismatic versions.").label("Repair them with Xeonnite Cubes or Plasmoid Scrap.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function chargedCopperAxe(player) {
  new ActionFormData3().title(guideTitle("Charged Copper Axe")).label("This Epic axe hits opponents with Lightning attacks. Collect charges before combat.").label("At full charge, hitting an enemy casts Lightning at them.").label("Killing an enemy casts another Lightning strike and grants 4 Auric Charges.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function cruxshaper(player) {
  new ActionFormData3().title(guideTitle("Cruxshaper")).label("This mace works like a vanilla mace, plus skills.").label("Look at the sky to use the skill. You jump high, then plunge down for up to 50 damage.").label("Craft it like a mace, with a Blaze Rod added to the recipe.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function natureStaff(player) {
  new ActionFormData3().title(guideTitle("Nature Staff")).label("This staff casts the same magic attacks as the Soul of Nature boss.").label("Interact to cast the first attack. Sneak-interact for the second attack, which has a slightly longer cooldown.").label("Craft it with Prismatic Ingots, a Stick, and a Nautilus Shell.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function peacemakerOath(player) {
  new ActionFormData3().title(guideTitle("Peacemaker Oath")).label("A pistol that fires Auric Charges. High damage and high attack speed.").label("It has no unique skill or passive because it is already strong, especially with the Auric Proton accessory.").label("Find it in Trial Chambers, same as the Auric Proton.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function seiketsu2(player) {
  new ActionFormData3().title(guideTitle("Seiketsu")).label("A katana with Legendary-style attack patterns. Easier to use than any Epic weapon.").label("Its parry window is longer than a regular sword's.").label("Craft it with a Prismatic Sword, a Blaze Rod, and a Netherite Sword.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function spectricBow(player) {
  new ActionFormData3().title(guideTitle("Spectric Bow")).label("A bow that beats every Epic weapon in damage and range. Arrow speed scales with charge stage, up to 70 damage.").label("Works with normal arrows, but best with Spectral Arrows, crafted from 4 Glowstone Dust and 1 Arrow.").label("Craft it with Iron Ingot, Whole Glowstone, and String.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function thunderGale(player) {
  new ActionFormData3().title(guideTitle("Thunder Gale")).label("A classic but powerful spear, and the strongest of its kind: 14 base damage, a 1.6x charge attack multiplier, and a very fast cooldown.").label("It also grants bonus speed while equipped.").label("Craft it with a Prismatic Spear, a Nether Star, and a Netherite Spear.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function animitta(player) {
  new ActionFormData3().title(guideTitle("Animitta")).label("One of the first Legendary weapons you can get, alongside the Prism Weaver. It fights at close, medium, and long range, with slightly lower damage than other Legendary weapons. It has 3 skills:").label("Animirra :\nSummons 4 stars that attack nearby entities.").label("Solaris Slash :\nFires 3 Solaris Slashes spreading outward.").label("Natura Vulkan :\nSummons 8 special stars that explode on enemies with small but powerful blasts, alongside a Meteor Rain.").label("Drops from the Soul of Nature at 50% chance, alternating with the Prism Weaver (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function prismWeaver2(player) {
  new ActionFormData3().title(guideTitle("Prism Weaver")).label("One of the first Legendary weapons you can get, alongside the Animitta. It fights at long range with lower damage than other Legendary weapons. Attacks fire prism bolts at your crosshair that curve slightly onto the target you aim at; every third attack fans out three piercing bolts. It has 3 skills:").label("Bubble Barrage :\nFires a burst of bubble projectiles in one attack.").label("Prism Wave Wall :\nCasts a Prism Wall that deals massive damage on touch.").label("Vortex Prism :\nPulls targets in a large radius toward you, then repels them with massive damage.").label("Drops from the Soul of Nature at 50% chance, alternating with the Animitta (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function theBleedingSpire2(player) {
  new ActionFormData3().title(guideTitle("The Bleeding Spire")).label("This Legendary spear fights polearm-style at close range. It is a support weapon, so it holds back on damage. It has 3 skills:").label("Carnage :\nDash forward. Mobs you collide with take damage.").label("Entanglement :\nLeash your target with Crimson Roots, stunning it for 5 seconds and restoring 12 health.").label("Crimson Ray :\nLike Entanglement, but fires many Crimson Rays in scattered directions.").label("Drops from Punicea.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function superchargedCopperAxe2(player) {
  new ActionFormData3().title(guideTitle("Supercharged Copper Axe")).label("This Legendary axe, forged from high-grade Copper and Auric material, hits very hard but swings very slowly, with lightning bolts on a completed attack pattern. It has 4 skills:").label("Charge :\nGrants 5 Charges for your other skills and briefly boosts your damage.").label("Powered Leap :\nCreates an explosion that damages everything except you and leaps you toward your target. Grants 1 Charge.").label("Discharge :\nSpends your charges to fire an Auric Laser forward. Direct hits deal heavy damage.").label("Ultimate Discharge :\nA stronger Discharge, combined with medium-range lightning covering close and medium range.").label("Drops from the Auric Automaton at 50% chance, alternating with the Auric Photonizer (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}
function auricPhotonizer2(player) {
  new ActionFormData3().title(guideTitle("Auric Photonizer")).label("This Legendary sword, forged from high-grade Copper and Auric material, swings very fast. It has 4 skills:").label("Stab :\nDash-stab forward. Mobs you collide with take heavy damage.").label("Powered Leap :\nLeap backward to dodge, leaving an explosion after a short delay that deals heavy damage.").label("Blade Barrage :\nSummons 5 Auric Double Blades that fly toward you, heavily damaging anything else in the way.").label("Ethereal Blade :\nSummons 3 waves of Ethereal Swords stabbing in random directions for heavy damage. You can keep moving while it fires.").label("Drops from the Auric Automaton at 50% chance, alternating with the Supercharged Copper Axe (50/50).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideWeapons(player);
  });
}

// data/scripts/ui/guide/mechanic_guide.ts
import { ActionFormData as ActionFormData4 } from "@minecraft/server-ui";
function mechanicsList(player) {
  new ActionFormData4().title(guideTitle("Mechanics")).body("The mechanics in Phantasm, from simplest to most complex.").button("Skill Unlock").button("Passive Dash").button("Extra Health").button("Wind Plunge").button("Dynamic Light").button("Legendary Items").button("Upgrading Items").button("Better Mending").button("Accessories").button("Auric Charges").button("Back").show(player).then((r) => {
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
  new ActionFormData4().title(guideTitle("Unlock Skill")).header("Skill Unlocking").divider().label("Skill Unlock upgrades your stats as you progress. Unlock the skills listed in the /unlockskill command!").label("3 skills to unlock :\n- Passive Dash\n- Extra Health\n- Wind Plunge\nEach costs 30 experience levels per upgrade, up to its own max level in the unlock UI.").divider().button("Unlock Skill").button("Back").show(player).then((r) => {
    if (r.selection == 1 || r.canceled) mechanicsList(player);
    if (r.selection == 0) player.runCommand("ph:unlockskill");
  });
}
function passiveDash(player) {
  new ActionFormData4().title(guideTitle("Passive Dash")).header("Passive Dash").divider().label("This skill lets you dash forward with no dash item. Useful for mobility and some combat styles.").label("Press Jump while falling to dash. Use /setting if you want a different control (double-tap Jump, Sprint + Jump, or Jump + Sneak).").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function extraHealth(player) {
  new ActionFormData4().title(guideTitle("Extra Health")).header("Extra Health").divider().label("This passive grants bonus health: +16 at level 1, +12 at level 2 and above. Essential for tanking bosses and other players.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function windPlunge(player) {
  new ActionFormData4().title(guideTitle("Wind Plunging")).header("Wind Plunge Attack").divider().label("This skill lets you plunge down fast when falling a long distance. It greatly reduces fall damage and explodes on landing, damaging everything nearby.").label("Sneak while falling more than 10 blocks to plunge.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function dynamicLighting(player) {
  new ActionFormData4().title(guideTitle("Dynamic Light")).header("Phantasm Light System").divider().label("Other add-ons have this mechanic, but here you do not need to hold the light item.").label("Put a light item in a hotbar slot with a + sign (accessory slot).").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function legendaryItems(player) {
  new ActionFormData4().title(guideTitle("Legendary Items")).header("Legendary Mechanics").divider().label("Legendary weapons and items can be complicated. Here is how to use them:").label("Attack: left-click (or tap Attack).\nSkill: Interact / right-click.\nSwitch skill: Sneak.").label("Use /setting to change how you switch skill: Sneak, Sneak + Attack, or Double Sneak.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function upgradingItems(player) {
  new ActionFormData4().title(guideTitle("Item Upgrade")).header("Upgrading Item").divider().label("Some items upgrade your dash, health, or damage, permanently or temporarily.").label("Only 3 items do this :\n- Auric Star (permanent)\n- Suspicious Mushroom (temporary)\n- Supercharged Copper Axe Charge skill (temporary)").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function betterMending(player) {
  new ActionFormData4().title(guideTitle("Better Mending")).header("Mending QoL").divider().label("Mending still repairs with EXP orbs, but you can also spend your stored levels to repair items directly.").label("Sneak and use the item to spend levels on repairs until it is full or you run out of EXP. Switch items to cancel.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function accessories(player) {
  new ActionFormData4().title(guideTitle("Accessories")).header("Accessories").divider().label("Accessories make you much stronger at the cost of up to 4 inventory slots. Combine them into whatever build you like.").label("Put accessories in the offhand slot or hotbar slots with a + sign.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}
function auricCharges(player) {
  new ActionFormData4().title(guideTitle("Auric Charge")).header("Auric Charge").divider().label("Auric Charges are universal ammo for some items. Collect them with the Charged Copper Axe, Auric Stock Battery, or Auric Proton.").label("Spend them by using an item that costs Auric Charges.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mechanicsList(player);
  });
}

// data/scripts/ui/guide/item_guide.ts
import { ActionFormData as ActionFormData5 } from "@minecraft/server-ui";
function guideItems(player) {
  new ActionFormData5().title(guideTitle("Items")).label("Usable items. Anything not listed here is recipe-only.").button("Auric Communicator", "textures/items/auric_communicator").button("Auric Stock Battery", "textures/items/auric_stock_battery").button("Combat Dummy", "textures/items/dummy").button("Flow Channeler", "textures/items/flow_channeler").button("Hell Charge", "textures/items/hell_charge").button("Suspicious Mushroom", "textures/items/suspicious_mushroom").button("Back").show(player).then((r) => {
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
  new ActionFormData5().title(guideTitle("Auric Communicator")).label("The Auric Communicator calls an Orbital Strike using your Auric Charges.").label("It has 2 modes: Stab Shot for a direct strike, Nuke Shot for a spread strike.").label("Interact to fire. Sneak-interact to switch modes.").label("Drops from the Auric Automaton (Copper Mechanical Array).").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function auricStockBattery(player) {
  new ActionFormData5().title(guideTitle("Auric Stock Battery")).label("The Auric Stock Battery recharges your Auric Charges in one click.").label("2 uses. Each restores up to 100 Auric Charges.").label("Interact to use it. When empty, recharge it at an Auric Battery Recharge Station.").label("Craft it with Auric Stars or an Ancient Copper Core plus Copper Blocks. Those come from Trial Chambers. It also drops from the Auric Automaton.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function combatDummy(player) {
  new ActionFormData5().title(guideTitle("Combat Dummy")).label("The Combat Dummy tests your combat skills and max damage output.").label("Place it down and hit it with your best weapon.").label("To pick it up, interact with it while sneaking.").label("This item can be crafted with 2 Planks, 2 Sticks, and 3 Smooth Stone Slabs.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function flowChanneler(player) {
  new ActionFormData5().title(guideTitle("Flow Channeler")).label("The Flow Channeler is Active Support. It dashes you forward, away from enemies.").label("Interact to dash. Enchantable with Mending and Unbreaking.").label("Drops from the Sealed Soul of Nature.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function hellCharge(player) {
  new ActionFormData5().title(guideTitle("Hell Charge")).label("Hell Charge is Active Support. It boosts your mobility.").label("Interact for a mobility boost. Spam interact to fly or fall slowly. Tune your controls to get the most out of it.").label("But it is fragile: long spam breaks it. Enchant with Mending and Unbreaking to make it last.").label("Craft it with Magma Cream and 4 Blaze Powder.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}
function suspiciousMushroom(player) {
  new ActionFormData5().title(guideTitle("Suspicious Mushroom")).label("The Suspicious Mushroom is Active Support. It slightly boosts all your stats.").label("Eat it for 10 minutes of boosted stats, no side effects.").label("But remember, this item is hard to get, use wisely.").label("Drops from Punicea, the Crimson Eye.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideItems(player);
  });
}

// data/scripts/ui/guide/block_guide.ts
import { ActionFormData as ActionFormData6 } from "@minecraft/server-ui";
function guideBlocks(player) {
  new ActionFormData6().title(guideTitle("Blocks")).label("Every functional block in the add-on.").button("Ancient Copper Core").button("Auric Recharge Station").button("Nature Soul Altar").button("Suspicious Crimson Eye").button("Back").show(player).then((r) => {
    if (r.selection === 4 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) ancientCopperCore(player);
    if (r.selection === 1) auricRechargeStation(player);
    if (r.selection === 2) natureSoulAltar(player);
    if (r.selection === 3) suspiciousCrimsonEye(player);
  });
}
function ancientCopperCore(player) {
  new ActionFormData6().title(guideTitle("Ancient Copper Core")).label("The Ancient Copper Core holds a large charge of Auric power, and needs specific items to fully activate.").label("Interact with it to create another battery. Fill the scattered batteries with the required item, interact with the core again, and the boss appears: Auric Automaton, the Copper Mechanical Array.").label("Found in Trial Chambers.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function auricRechargeStation(player) {
  new ActionFormData6().title(guideTitle("Auric Battery Recharge Station")).label("The Auric Battery Recharge Station recharges Auric Batteries placed inside it. Interact while a battery is inside to charge it slowly. A full charge takes 100 seconds no matter how many batteries are inside, so load it up.").label("It cannot be broken while batteries are inside.").label("Craft it with Ancient Copper Core, Copper Block, and Auric Charging Module.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function natureSoulAltar(player) {
  new ActionFormData6().title(guideTitle("Nature Soul Altar")).label("The Nature Soul Altar generates with the underwater Prismarine Arena.").label("Give it a Prismarine Shard to start the fight.").label("Only found in the Prismarine Arena.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}
function suspiciousCrimsonEye(player) {
  new ActionFormData6().title(guideTitle("Suspicious Crimson Eye")).label("The Suspicious Crimson Eye generates with the Crimson Overgrowth in the Crimson Forest.").label("Give it 5 Essence of Crimson to start the fight.").label("Only found in the Crimson Overgrowth.").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBlocks(player);
  });
}

// data/scripts/ui/guide/boss_guide.ts
import { ActionFormData as ActionFormData7 } from "@minecraft/server-ui";
function guideBosses(player) {
  new ActionFormData7().title(guideTitle("Bosses")).label("Every boss in the add-on, in progression order.").button("Soul of Nature").button("Punicea - A Crimson Eye").button("Auric Automaton").button("Back").show(player).then((r) => {
    if (r.selection === 4 || r.canceled) mainGuideScreen(player);
    if (r.selection === 0) soulOfNature(player);
    if (r.selection === 1) puniceaCrimsonEye(player);
    if (r.selection === 2) copperMechanicalArray(player);
  });
}
function soulOfNature(player) {
  new ActionFormData7().title(guideTitle("Sealed Soul of Nature")).label("Sealed Soul of Nature wields nature and prism power. Its attacks can drain your oxygen mid-fight.").label("It has 500 HP and 3 attack patterns. At 70% HP it spawns extra Nature and Prism Crystals, making the fight harder.").label("Summon it by interacting with the Nature Soul Altar in the underwater Prismarine Arena.").label("Defeating it marks the true start of your Phantasm journey. You get a treasure bag...").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}
function puniceaCrimsonEye(player) {
  new ActionFormData7().title(guideTitle("Punicea - A Crimson Eye")).label("Punicea wields crimson corruption. It has 6 attacks and very high health.").label("It has 3000 HP and 6 attack patterns. Each is well telegraphed but hits hard, so keep moving.").label("Summon it by interacting with the Suspicious Crimson Eye in the Crimson Overgrowth.").label("Defeating it proves you can dodge. You get a treasure bag...").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}
function copperMechanicalArray(player) {
  new ActionFormData7().title(guideTitle("Auric Automaton - Copper Mechanical Array")).label("The Auric Mechanical Array wields ultimate Auric power. Complicated patterns, massive damage, and high mobility. Bring your best gear.").label("It has 1750 HP and 7 attack patterns that adapt to how you fight. Do not try to tank them. Stay mobile to survive and kill it.").label("Summon it by completing the Ancient Copper Core ritual.").label("It drops a treasure bag. That completes the Phantasm journey, for now. Stay tuned for the next update!").button("Back").show(player).then((r) => {
    if (r.canceled || r.selection == 0) guideBosses(player);
  });
}

// data/scripts/ui/guide/accessories_guide.ts
import { ActionFormData as ActionFormData8 } from "@minecraft/server-ui";
function guideAccessories(player) {
  new ActionFormData8().title(guideTitle("Accessories")).label("Every accessory explains its own effect in its item description, so hover over the item to read what it does!").divider().label("Accessories are items that support you in combat and beyond. Find them anywhere: mining, looting structures, even boss fights.").divider().label("Two types:").label("Active accessories :\nThey have both a passive effect and an interact use. Keep them in a hotbar slot with a plus sign.").label("Passive accessories :\nPassive effect only. Best in the offhand slot, but a plus-sign hotbar slot works too.").divider().label("Put an accessory in the offhand slot or a plus-sign hotbar slot. Its passive applies as soon as you equip it.").button("Back").show(player).then((r) => {
    if (r.selection === 0 || r.canceled) mainGuideScreen(player);
  });
}

// data/scripts/ui/guide/enemies_guide.ts
import { ActionFormData as ActionFormData9 } from "@minecraft/server-ui";
function guideEnemies(player) {
  new ActionFormData9().title(guideTitle("Enemies")).divider().label("Only one enemy type so far: Crimson Tentacles.").label("They spawn naturally in the Crimson Forest and drop Essence of Crimson at 50% chance.").divider().button("Back").show(player).then((r) => {
    if (r.selection === 0 || r.canceled) mainGuideScreen(player);
  });
}

// data/scripts/ui/guide/main_guide.ts
function mainGuideScreen(player) {
  new ActionFormData10().title(guideTitle("Guide")).header("Phantasm Guide").divider().label(
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
  new ActionFormData10().title(guideTitle("Getting Started")).header("Where to begin?").divider().header("Early Game - Mining").label("- Mine ores to get a chance at the Rusted Fortune Coin and Item Magnet Ore (1% chance per ore).").label("- Use /unlockskill to upgrade your passive abilities: Passive Dash, Extra Health, and Wind Plunge.").divider().header("Mid Game - Exploration").label("- Explore Trial Chambers to find the Ancient Copper Core, Auric Proton, and the Peacemaker Oath.").label("- Visit the Crimson Forest: fight Crimson Tentacles for Essence of Crimson, and locate the Crimson Overgrowth.").divider().header("Bosses - Your Progression").label("1. Sealed Soul of Nature (Prismarine Arena, underwater) - your first boss, drops Prismatic Ingots and a treasure bag (Animitta / Prism Weaver).").label("2. Punicea : A Crimson Eye (Crimson Overgrowth) - drops The Bleeding Spire and Suspicious Mushroom.").label("3. Auric Automaton : Copper Mechanical Array (Ancient Copper Core ritual) - the final boss, drops Supercharged Copper Axe / Auric Photonizer.").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0 || r.canceled) mainGuideScreen(player);
  });
}
function Changelogs(player) {
  new ActionFormData10().title(guideTitle("Changelogs")).header("v1.5.2").divider().header("Changes").label("= Added a cooldown between Legendary Weapon attacks (Solaris Verdant, Supercharged Copper Axe, Prism Weaver, Auric Photonizer, The Bleeding Spire, and Seiketsu) so attack patterns can no longer be spammed without a pause - ExplerHD").label("= Fixed player scoreboard initialization: all scores are now reset when a player spawns (including weapon attack scores), so no leftover scores remain from previous sessions - ExplerHD").divider().header("Addition").label("+ Upgraded several particle textures to use PBR (metalness/emissive/roughness) so they can glow and look smoother: circle_fade, circle_load, crosshair_warning, slash_effect_white, slash_effect_white_2, sonic_explosion_grayscaled, sparkle, and the Damage Indicator - ExplerHD").divider().header("v1.5.1").divider().header("Removal").label("- Removed the debug log spam that printed on every ore mined - ExplerHD").divider().header("Changes").label("= Rewrote the Dynamic Light System: no more flickering when switching items, lights are placed instantly, and they only spawn on air or liquid blocks so they won't break tall grass, flowers, or doors - ExplerHD").label("= Health Bar now uses the native on-screen display, so it no longer spams the chat and shows correctly on respawn - ExplerHD").label('= Fixed a crash ("setTitle of undefined") that occurred whenever a mob took damage - ExplerHD').label("= Overhauled the Guidescreen: fixed wrong weapon titles and a wrong drop source, cleaned up typos, and corrected outdated HP data - ExplerHD").label("= Fixed the Damage Indicator icons being mispositioned - ExplerHD").label("= Moved the Dash cooldown scoreboard to be initialized when a player joins - ExplerHD").divider().header("Addition").label("+ Added a Getting Started page to the Guidescreen with a recommended progression path, plus a welcome message on first join - ExplerHD").label("+ Added a crafting recipe to turn a Rusted Fortune Coin into 4 Gold Blocks - ExplerHD").divider().header("v1.5.0").divider().header("Removal").label("- Removed the Glyph System, but you can still use the glyphs available in Phantasm - ExplerHD").label("- Removed the mining functionality from Legendary Weapons, as they were never designed for that purpose - ExplerHD").label("- Removed the Direct Hit feature from Legendary Weapons and Seiketsu - ExplerHD").divider().header("Changes").label("= Refactored the Custom Mace system - ExplerHD").label("= Reworked the Damage Indicator system to use Runtime Particles - ExplerHD").label("= Changed Prism Boss Arena from fixed ground positions to locatable underwater structures - ExplerHD").label("= Updated the Soul of Nature boss fight to follow the new structure generation (underwater boss fight) - ExplerHD").label("= Adjusted the placement of the Crimson Overgrowth structure to make it more logical and visible - ExplerHD").label("= Increased Seiketsu damage by +4 - ExplerHD").label("= Slightly updated the visuals of The Bleeding Spire attack - ExplerHD").label("= Rebalanced the damage of all Legendary Weapons so they can compete with enchanted Epic Weapons - ExplerHD").label("= Made Soul of Nature, Punicea, and Auric Automaton have 500 HP, 3000 HP, and 1750 HP due to Recent Weapons changes. - ExplerHD").label("= Added support for Fire Aspect, Knockback, and Weakness on Legendary Weapons - ExplerHD").label("= Updated all Legendary Weapons so their attack patterns now loop continuously without an ending cooldown - ExplerHD").label('= Fixed a bug where upgrading Dash to Level 2 would display "Insufficient Experience Level" instead of "Maximum level of Dash is reached." - ExplerHD').divider().header("Addition").label("+ Added the `damage_number` and `damage_icons` particles - ExplerHD").label("+ Added the Better than Mending feature - ExplerHD").label("+ Added a Combat Dummy - ExplerHD").label("+ Added a Turtle Shell item to the Prismarine Boss Arena to make the boss fight in that arena easier - ExplerHD").label("+ Added Rusted Fortune Coin, which doubles ore drops, and the Item Magnet Ore. Both can be obtained from a 1% chance when mining any ore - Passive Type - ExplerHD").label("+ Added Condensed Sea Nature, providing much longer underwater breathing and slightly faster health regeneration while underwater - Passive Type - ExplerHD").label("+ Added Guidescreen - ExplerHD & ZeroMaster178").divider().label("Stay tuned for the next content update!").button("Back").show(player).then((r) => {
    if (r.selection == 0) mainGuideScreen(player);
  });
}
function developer(player) {
  new ActionFormData10().title(guideTitle("Developer Contact")).header("Contact Us!").divider().label("ExplerHD\nGitHub : ExplHD\nDiscord : explerhd\nYoutube : ExplerHD (@ExplHD)\nMCPEDL : ExplerHD\nCurseforge : ExplerHD").label("ZeroMaster178\nInstagram : zeromaster_178\nMCPEDL : Zeromaster 178\nCurseforge : Zeromaster178\nTiktok : Zeromaster_178\nYoutube : zeromaster178\nDiscord : zeromaster178").divider().button("Back").show(player).then((r) => {
    if (r.selection == 0) mainGuideScreen(player);
  });
}

// data/scripts/ui/forms/dynamicProperties.ts
import { ItemStack as ItemStack10 } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
function syncPlayerProperty(player, id) {
  const value = player.getDynamicProperty(id);
  switch (id) {
    case "ph:dash_control":
    case "ph:skill_switch_control":
      clearControlState(player);
      break;
    case "ph:health_level": {
      player.removeEffect("health_boost");
      const level = Number(value ?? 0);
      if (level > 0) {
        player.runCommand(`effect @s health_boost infinite ${3 * level} true`);
        player.addEffect("instant_health", 20, { amplifier: 255, showParticles: false });
      }
      break;
    }
    case "ph:xeonnite_cutscene_active":
      if (value !== true) releaseBlessingCutscene(player);
      break;
  }
}
function resetPlayerProperties(player) {
  releaseBlessingCutscene(player);
  const wasNerfed = player.getDynamicProperty("ph:forge_parry_nerf_until") !== void 0;
  player.clearDynamicProperties();
  applyPropertyDefaults(player);
  for (const def of PLAYER_PROPERTIES) syncPlayerProperty(player, def.id);
  if (wasNerfed) player.removeEffect("weakness");
  player.dimension.spawnItem(new ItemStack10("ph:guidebook"), player.location);
}
function formatValue(value) {
  return value === void 0 ? "\xA78(unset)" : `\xA7f${value}`;
}
function openDynamicPropertyMenu(player) {
  if (!player.isValid) return;
  const selectedIndex = new ObservableNumber(0, { clientWritable: true });
  const toggleValue = new ObservableBoolean(false, { clientWritable: true });
  const textValue = new ObservableString("", { clientWritable: true });
  const showToggle = new ObservableBoolean(false);
  const showText = new ObservableBoolean(false);
  const confirmReset = new ObservableBoolean(false, { clientWritable: true });
  const currentLabel = new ObservableString("");
  const statusMessage = new ObservableString("");
  function refreshForIndex(index) {
    const def = PLAYER_PROPERTIES[index];
    const currentValue = player.getDynamicProperty(def.id);
    currentLabel.setData(`\xA77${def.id}
\xA77Current: ${formatValue(currentValue)}`);
    const isBoolean = def.type === "boolean";
    showToggle.setData(isBoolean);
    showText.setData(!isBoolean);
    if (isBoolean) toggleValue.setData(currentValue === true);
    else textValue.setData(currentValue !== void 0 ? currentValue.toString() : "");
  }
  refreshForIndex(selectedIndex.getData());
  selectedIndex.subscribe((newIndex) => {
    refreshForIndex(newIndex);
    statusMessage.setData("");
  });
  const dropdownItems = PLAYER_PROPERTIES.map((def, i) => ({ label: `[${def.group}] ${def.label}`, value: i }));
  new CustomForm(player, "DynamicProperty Manager").label("Choose DynamicProperty to change:").dropdown("Property", selectedIndex, dropdownItems).label(currentLabel).divider().toggle("Value (boolean)", toggleValue, { visible: showToggle }).textField("Value (number)", textValue, {
    description: "Leave empty to unset",
    visible: showText
  }).spacer().button("Save", () => {
    const def = PLAYER_PROPERTIES[selectedIndex.getData()];
    if (!def) {
      statusMessage.setData("\xA7cFailed to change property: unknown property.");
      return;
    }
    if (!player.isValid) return;
    if (def.type === "boolean") {
      player.setDynamicProperty(def.id, toggleValue.getData());
    } else {
      const raw = textValue.getData().trim();
      const parsed = Number(raw);
      if (raw !== "" && !Number.isFinite(parsed)) {
        statusMessage.setData("\xA7cIncorrect Type, Expected Type : Number!");
        return;
      }
      player.setDynamicProperty(def.id, raw === "" ? void 0 : parsed);
    }
    syncPlayerProperty(player, def.id);
    refreshForIndex(selectedIndex.getData());
    statusMessage.setData(`\xA7aSuccessfully changed ${def.label}!`);
  }).divider().label("Reset every Phantasm property to a fresh start (same as /cleardynamicproperties):").toggle("Turn on to confirm", confirmReset).button("Reset All Properties", () => {
    if (!confirmReset.getData()) {
      statusMessage.setData("\xA7eTurn on the toggle before resetting!");
      return;
    }
    resetPlayerProperties(player);
    confirmReset.setData(false);
    refreshForIndex(selectedIndex.getData());
    statusMessage.setData("\xA7aAll DynamicProperties are successfully reset!");
  }).divider().label(statusMessage).closeButton().show();
}

// data/scripts/ui/commands.ts
function originPlayer(origin) {
  return origin.sourceEntity instanceof Player22 ? origin.sourceEntity : void 0;
}
function registerUiCommands(initEvent) {
  initEvent.itemComponentRegistry.registerCustomComponent("ph:guidebook", {
    onUse({ source }) {
      mainGuideScreen(source);
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
    description: "Reset every Phantasm property (upgrades, blessing, controls) to a fresh start",
    cheatsRequired: true,
    permissionLevel: CommandPermissionLevel.GameDirectors,
    optionalParameters: [{ name: "target", type: CustomCommandParamType.PlayerSelector }]
  }, clearDynamicProperty);
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:dynamicproperties",
    description: "Check all of your dynamic properties",
    cheatsRequired: true,
    permissionLevel: CommandPermissionLevel.GameDirectors
  }, (origin) => {
    const player = originPlayer(origin);
    if (!player) return { status: CustomCommandStatus.Failure };
    system22.run(() => {
      openDynamicPropertyMenu(player);
    });
    return { status: CustomCommandStatus.Success };
  });
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:guide",
    description: "Opens Guide Screen",
    cheatsRequired: false,
    permissionLevel: CommandPermissionLevel.Any
  }, (origin) => {
    const player = originPlayer(origin);
    if (!player) return { status: CustomCommandStatus.Failure };
    system22.run(() => {
      mainGuideScreen(player);
    });
    return { status: CustomCommandStatus.Success };
  });
  initEvent.customCommandRegistry.registerCommand({
    name: "ph:setting",
    description: "Opens the settings ui to configure your controls",
    cheatsRequired: false,
    permissionLevel: CommandPermissionLevel.Any
  }, (origin) => {
    const player = originPlayer(origin);
    if (!player) return { status: CustomCommandStatus.Failure };
    system22.run(() => {
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
    const player = originPlayer(origin);
    if (!player) return { status: CustomCommandStatus.Failure };
    unstuckPlayer(player);
    player.sendMessage("Successfully unstuck");
    return { status: CustomCommandStatus.Success };
  });
}
function openForm(origin) {
  const player = originPlayer(origin);
  if (!player) return { status: CustomCommandStatus.Failure };
  system22.run(() => {
    skillUnlock(player);
  });
  return { status: CustomCommandStatus.Success };
}
function clearDynamicProperty(origin, targets) {
  const source = originPlayer(origin);
  const players = targets ?? (source ? [source] : []);
  if (players.length === 0) {
    return { status: CustomCommandStatus.Failure, message: "No player to reset. Run it as a player or pass a target." };
  }
  system22.run(() => {
    for (const player of players) {
      if (!player.isValid) continue;
      resetPlayerProperties(player);
      player.sendMessage("\xA7aYour Phantasm progress and settings were reset.");
    }
  });
  return { status: CustomCommandStatus.Success, message: `Reset ${players.length} player(s).` };
}

// data/scripts/events/loader.ts
var objectives = [
  "delayatk",
  "sectick",
  "dash_cd",
  "sfx_cd",
  "solaris_verdant",
  "solaris_verdant_atk",
  "solaris_verdant_s1",
  "solaris_verdant_s2",
  "solaris_verdant_s3",
  "supercharged_copper_axe",
  "supercharged_copper_axe_atk",
  "supercharged_copper_axe_s1",
  "supercharged_copper_axe_s2",
  "supercharged_copper_axe_s3",
  "supercharged_copper_axe_s4",
  "charged_copper_axe",
  "auric_charge",
  "gapple_cooldown",
  "prism_weaver",
  "prism_weaver_atk",
  "prism_weaver_s1",
  "prism_weaver_s2",
  "prism_weaver_s3",
  "auric_photonizer",
  "auric_photonizer_atk",
  "auric_photonizer_s1",
  "auric_photonizer_s2",
  "auric_photonizer_s3",
  "auric_photonizer_s4",
  "the_bleeding_spire",
  "the_bleeding_spire_atk",
  "the_bleeding_spire_s1",
  "the_bleeding_spire_s2",
  "the_bleeding_spire_s3",
  "auric_communicator_mode",
  "seiketsu_atk"
];
system23.beforeEvents.startup.subscribe((initEvent) => {
  registerCustomComponents(initEvent);
  registerPolarisComponent(initEvent);
  registerShieldComponent(initEvent);
  registerUiCommands(initEvent);
});
world13.afterEvents.worldLoad.subscribe(() => {
  loadScoreboards();
  for (const id of ["overworld", "nether", "the_end"]) {
    for (const entity of world13.getDimension(id).getEntities({ type: "minecraft:item" })) {
      trackLootItem(entity);
    }
  }
});
world13.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  onPlayerSpawn(player, initialSpawn);
  onDynamicLighting(player);
  onBlessingSpawn(player, initialSpawn);
  onPolarisSpawn(player, initialSpawn);
});
function loadScoreboards() {
  for (const objective of objectives) {
    if (!world13.scoreboard.getObjective(objective)) {
      world13.scoreboard.addObjective(objective);
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
  const health = player?.getComponent("minecraft:health");
  const maxHealth = health?.effectiveMax;
  const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
  if (health && maxHealth && maxHealth > 0) {
    runUntilMoved(player, 10, () => {
      healthBarDisplay(player, health, totalArmor, maxHealth);
    });
  }
  if (!initialSpawn) return;
  loadPlayerScore(player);
  if (player.getDynamicProperty("ph:guidebook_acquired") === void 0 || player.getDynamicProperty("ph:guidebook_acquired") === false) {
    player.dimension.spawnItem(new ItemStack11("ph:guidebook"), player.location);
    player.sendMessage("\xA7eWelcome to Phantasm! Pick up your Guidebook or use /guide to learn the features of this add-on.");
  }
  const playerInput = player.inputInfo.lastInputModeUsed;
  if (playerInput == "Touch") {
    player.sendMessage("\xA7eTouch controls? Joystick + Crosshair with the Action Button enabled makes weapons easier to use");
  }
  system23.runTimeout(() => {
    if (player.isValid) applyPropertyDefaults(player);
  }, 20);
  for (const objective of objectives) {
    addScore(player, objective, 0);
  }
}

// data/scripts/main.ts
console.warn("\xA7a\xA7lPhantasm 1.5.2 Activated!");

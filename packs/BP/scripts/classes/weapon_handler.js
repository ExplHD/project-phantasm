import { world, system } from "@minecraft/server";
import { addScore, removeScore, setScore, getScore } from "main";

class WeaponHandler {
	/**
	 * @param { string } itemId - Item identifier, ex: ph:solaris_verdant
	 * @param { string } objective - Scoreboard's Objective to use
	 * @param { Array<number> } delayPerAttackPattern - Delay to each attack pattern
	 * @param { Array<string> } attackPatterns - List of attack patterns
	 */
	constructor(itemId, objective, delayPerAttackPattern, attackPatterns) {
		this.itemId = itemId; // ex: "ph:solaris_verdant"
		this.objective = objective; // ex: "solaris_verdant_atk"
		this.delayPerAttackPattern = delayPerAttackPattern; //; Arrays of attack pattern delay
		this.attackPatterns = attackPatterns; // array pattern
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
}

class SkillSwitcher {
	constructor(itemId, objective, skills) {
		this.itemId = itemId; // ex: "ph:solaris_verdant"
		this.objective = objective; // ex: "solaris_verdant"
		this.skills = skills; // array of skills [{ message: "Skill 1" }, { message: "Skill 2" }, ...]
	}

	switchSkill(source) {
		let currentSkill = WeaponHandler.getScore(source, this.objective);

		// reset if larger than skill
		if (currentSkill >= this.skills.length) {
			WeaponHandler.setScore(source, this.objective, 0);
			currentSkill = 0;
		}

		const skillData = this.skills[currentSkill];
		if (!skillData) return;

		// show skill message
		source.sendMessage(skillData.skillSMessage);

		// update score to next skill
		if (currentSkill < this.skills.length) {
			WeaponHandler.addScore(source, this.objective, 1);
		} else {
			WeaponHandler.setScore(source, this.objective, 0);
		}
	}
}

class SkillHandler {
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

		// cek cooldown
		const currentCd = getScore(source, skill.cooldown_objective);
		if (currentCd > 0 && currentCd != undefined && skill.charge == false) return; // stiil on cooldown
		if (skill.charge == true && currentCd < skill.charge_min) return; // Not enough charge

		// jalankan skill
		source.runCommand(`tellraw @a[r=64] {"rawtext":[{"text":"${source.name} Used their ${skill.type} ${skill.name}"}]}`);
		skill.action(source);

		// set cooldown
		addScore(source, skill.cooldown_objective, skill.cooldown);
	}

	useSkill(source) {
		const currentSkill = getScore(source, this.objective) || 0;

		this.runSkill(source, currentSkill);
	}
}

class CommandHandler {
	constructor(commands = []) {
		this.commands = commands;
		// array object: { delay: number, action: (source) => {} }
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
}

export { WeaponHandler, SkillSwitcher, SkillHandler, CommandHandler };

export function triggerAttack(source, delay, damage, radius, animation, sound) {
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

export function applyCustomDamage(source, damage, radius) {
	const strengthLevel = (source.getEffect("strength")?.amplifier ?? -1) + 1;
	const strengthFormula = 1 + strengthLevel * 0.45;
	const weaknessLevel = (source.getEffect("weakness")?.amplifier ?? -1) + 1;
	const weaknessFormula = Math.max(0, 1 - weaknessLevel * 0.24);
	const item = source?.getComponent("equippable")?.getEquipment("Mainhand");
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
		excludeFamiliies: ["inanimate", "invulnerable"],
	});

	entities.forEach((entity) => {
		entity.applyDamage(calculatedDamage, {
			cause: "entityAttack",
			damagingEntity: source,
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

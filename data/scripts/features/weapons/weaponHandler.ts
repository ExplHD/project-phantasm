import { system, Player } from "@minecraft/server";
import { addScore, removeScore, setScore, getScore } from "../../core/scoreboard";
import { applyCustomDamage } from "./damage";
import { type ProjectileConfig, fireProjectile } from "./projectile";

interface AttackPattern {
	readonly delay: number;
	readonly damage: number;
	readonly radius: number;
	readonly animation: string;
	readonly sound: string;
	readonly action?: CommandHandler;
	readonly projectile?: ProjectileConfig;
}

interface SkillConfig {
	readonly name: string;
	readonly type: "Skill" | "Ultimate" | "Ability";
	readonly cooldown_objective: string;
	readonly cooldown: number;
	readonly charge: boolean;
	readonly charge_min?: number;
	readonly action: (source: Player) => void;
}

interface SkillData {
	[key: number]: SkillConfig;
}

interface CommandEntry {
	readonly delay: number;
	readonly action: (source: Player) => void;
}

class WeaponHandler {
	readonly itemId: string;
	readonly objective: string;
	readonly delayPerAttackPattern: number[];
	readonly attackPatterns: AttackPattern[];

	constructor(itemId: string, objective: string, delayPerAttackPattern: number[], attackPatterns: AttackPattern[]) {
		this.itemId = itemId;
		this.objective = objective;
		this.delayPerAttackPattern = delayPerAttackPattern
		this.attackPatterns = attackPatterns;
	}

	static addScore(target: Player, objective: string, score: number): void {
		addScore(target, objective, score);
	}

	static removeScore(target: Player, objective: string, score: number): void {
		removeScore(target, objective, score);
	}

	static setScore(target: Player, objective: string, score: number): void {
		setScore(target, objective, score);
	}

	static getScore(target: Player, objective: string): number {
		return getScore(target, objective);
	}

	handleAttack(source: Player): void {
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
}

class SkillSwitcher {
	readonly itemId: string;
	readonly objective: string;
	readonly skills: { readonly skillSMessage: string }[];

	constructor(itemId: string, objective: string, skills: { skillSMessage: string }[]) {
		this.itemId = itemId;
		this.objective = objective;
		this.skills = skills;
	}

	switchSkill(source: Player): void {
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
}

class SkillHandler {
	readonly itemId: string;
	readonly skills: SkillData;
	readonly objective: string;

	constructor(itemId: string, objective: string) {
		this.itemId = itemId;
		this.skills = {};
		this.objective = objective;
	}

	addSkill(id: number, config: SkillConfig): void {
		this.skills[id] = config;
	}

	runSkill(source: Player, id: number): void {
		const skill = this.skills[id];
		if (!skill) return console.error(`Skill ${id} not found!`);
		if (!source.isValid) return;

		const currentCd = getScore(source, skill.cooldown_objective);
		if (currentCd > 0 && currentCd != undefined && skill.charge == false) return;
		if (skill.charge == true && currentCd < skill.charge_min!) return;

		source.runCommand(`tellraw @a[r=64] {"rawtext":[{"text":"${source.name} Used their ${skill.type} ${skill.name}"}]}`);
		skill.action(source);

		addScore(source, skill.cooldown_objective, skill.cooldown);
	}

	useSkill(source: Player): void {
		const currentSkill = getScore(source, this.objective) || 0;

		this.runSkill(source, currentSkill);
	}
}

class CommandHandler {
	readonly commands: CommandEntry[];

	constructor(commands: CommandEntry[] = []) {
		this.commands = commands;
	}

	addCommand(delay: number, action: (source: Player) => void): void {
		this.commands.push({ delay, action });
	}

	run(source: Player): void {
		let totalDelay = 0;

		for (const cmd of this.commands) {
			totalDelay += cmd.delay;

			system.runTimeout(() => {
				if (!source.isValid) return;
				if (!source.dimension.isChunkLoaded(source.location)) return;
				cmd.action(source);
			}, totalDelay);
		}
	}
}

export { WeaponHandler, SkillSwitcher, SkillHandler, CommandHandler };

export { applyCustomDamage };

export function triggerAttack(source: Player, delay: number, damage: number, radius: number, animation: string, sound: string, projectile?: ProjectileConfig): void {
	if (!source) return console.error("No Players found!");
	if (!delay && !damage) return console.error("Specify Damage and Delay before Damage Value");
	if (!radius && !projectile) return console.error("Specify Radius Value");
	if (!animation) return;
	if (!source.isValid) return;

	source.playAnimation(animation);
	system.runTimeout(() => {
		if (!source.isValid) return;
		if (projectile) fireProjectile(source, projectile);
		else applyCustomDamage(source, damage, radius);
		if (!sound) return;
		source.dimension.playSound(sound, source.location);
	}, delay);
}

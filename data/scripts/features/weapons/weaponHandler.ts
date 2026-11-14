import { system, Player, EquipmentSlot, type Entity } from "@minecraft/server";
import { addScore, removeScore, setScore, getScore } from "../../core/scoreboard";
import { applyCustomDamage } from "./damage";
import { spendMana } from "../../core/mana";
import { type ProjectileConfig, fireProjectile } from "./projectile";

interface AttackPattern {
	readonly delay: number;
	readonly damage: number;
	readonly radius: number;
	readonly animation: string;
	readonly sound: string;
	readonly action?: CommandHandler;
	readonly projectile?: ProjectileConfig;
	readonly controller?: string;
	readonly onStrike?: (source: Player, target: Entity) => void;
	readonly cast?: (source: Player, damage: number, range: number) => void;
	readonly mana?: number;
}

interface SpecialAttack {
	readonly objective: string;
	readonly hits: number;
	readonly recovery: number;
	readonly pattern: AttackPattern;
}

interface SkillConfig {
	readonly name: string;
	readonly type: "Skill" | "Ultimate" | "Ability";
	readonly cooldown_objective: string;
	readonly cooldown: number;
	readonly charge: boolean;
	readonly charge_min?: number;
	readonly action: (source: Player) => void;
	readonly canUse?: (source: Player) => boolean;
	readonly mana?: number;
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
	readonly pairedWith: readonly string[];
	readonly dual: boolean;
	readonly special?: SpecialAttack;

	constructor(itemId: string, objective: string, delayPerAttackPattern: number[], attackPatterns: AttackPattern[], pairedWith: readonly string[] = [], dual: boolean = false, special?: SpecialAttack) {
		this.itemId = itemId;
		this.objective = objective;
		this.delayPerAttackPattern = delayPerAttackPattern
		this.attackPatterns = attackPatterns;
		this.pairedWith = pairedWith;
		this.dual = dual;
		this.special = special;
	}

	matches(source: Player, mainhandId: string | undefined): boolean {
		if (mainhandId !== this.itemId) return false;
		if (this.pairedWith.length === 0) return true;
		const offhandId = source.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand)?.typeId;
		const holdsPair = offhandId !== undefined && this.pairedWith.includes(offhandId);
		return holdsPair === this.dual;
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
		const special = this.special;
		if (special) {
			const charge = getScore(source, special.objective);
			const sinceLast = getScore(source, "delayatk");
			if (charge < 0) {
				if (sinceLast > 0 && sinceLast < special.recovery) return;
				setScore(source, special.objective, 0);
			}
			if (charge >= special.hits) {
				if (sinceLast > 0 && sinceLast < (this.delayPerAttackPattern[getScore(source, this.objective)] ?? 0)) return;
				const pattern = special.pattern;
				triggerAttack(source, pattern.delay, pattern.damage, pattern.radius, pattern.animation, pattern.sound, pattern.projectile, pattern.controller);
				setScore(source, special.objective, -1);
				setScore(source, this.objective, 0);
				setScore(source, "delayatk", 1);
				pattern.action?.run(source);
				return;
			}
		}

		const currentStep = getScore(source, this.objective);

		if (currentStep < this.attackPatterns.length) {
			const pattern = this.attackPatterns[currentStep];
			const delay = this.delayPerAttackPattern[currentStep];

			if (getScore(source, "delayatk") > 0 && getScore(source, "delayatk") < delay) return;
			if (!spendMana(source, pattern.mana)) return;

			triggerAttack(source, pattern.delay, pattern.damage, pattern.radius, pattern.animation, pattern.sound, pattern.projectile, pattern.controller, special ? (hits) => {
				if (hits > 0) addScore(source, special.objective, 1);
			} : undefined, pattern.onStrike, pattern.cast);

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
		if (skill.canUse && !skill.canUse(source)) return;
		if (!spendMana(source, skill.mana)) return;

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

export function triggerAttack(source: Player, delay: number, damage: number, radius: number, animation: string, sound: string, projectile?: ProjectileConfig, controller?: string, onHit?: (hits: number) => void, onStrike?: (source: Player, target: Entity) => void, cast?: (source: Player, damage: number, range: number) => void): void {
	if (!source) return console.error("No Players found!");
	if (!delay && !damage) return console.error("Specify Damage and Delay before Damage Value");
	if (!radius && !projectile) return console.error("Specify Radius Value");
	if (!animation) return;
	if (!source.isValid) return;

	source.playAnimation(animation, controller ? { controller, blendOutTime: 0 } : undefined);
	system.runTimeout(() => {
		if (!source.isValid) return;
		if (projectile) fireProjectile(source, projectile);
		else if (cast) cast(source, damage, radius);
		else {
			const hits = applyCustomDamage(source, damage, radius, 1, onStrike ? (target) => onStrike(source, target) : undefined);
			onHit?.(hits);
		}
		if (!sound) return;
		source.dimension.playSound(sound, source.location);
	}, delay);
}

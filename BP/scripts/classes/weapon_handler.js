import { world, system } from '@minecraft/server'
import { addScore, removeScore, setScore, getScore } from 'main'

class WeaponHandler {
    constructor(itemId, objective, delayPerAttackPattern, attackPatterns) {
        this.itemId = itemId; // ex: "ph:solaris_verdant"
        this.objective = objective; // ex: "solaris_verdant_atk"
        this.delayPerAttackPattern = delayPerAttackPattern //; Arrays of attack pattern delay
        this.attackPatterns = attackPatterns; // array pattern
    }

    // -------- Scoreboard utils ----------
    static addScore(target, objective, score) {
        try {
            world.scoreboard.getObjective(objective).addScore(target, score);
        } catch (e) {
            target.runCommand(
                `scoreboard players add "${target.name}" ${objective} ${score}`
            );
        }
    }

    static removeScore(target, objective, score) {
        try {
            world.scoreboard.getObjective(objective).addScore(target, score);
        } catch (e) {
            target.runCommand(
                `scoreboard players remove "${target.name}" ${objective} ${score}`
            );
        }
    }

    static setScore(target, objective, score) {
        try {
            world.scoreboard.getObjective(objective).setScore(target, score);
        } catch (e) {
            target.runCommand(
                `scoreboard players set "${target.name}" ${objective} ${score}`
            );
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

            triggerAttack(
                source,
                pattern.delay,
                pattern.damage,
                pattern.radius,
                pattern.animation,
                pattern.sound
            );

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
        this.itemId = itemId;       // ex: "ph:solaris_verdant"
        this.objective = objective; // ex: "solaris_verdant"
        this.skills = skills;       // array of skills [{ message: "Skill 1" }, { message: "Skill 2" }, ...]
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
    constructor(itemId, objective) {
        this.itemId = itemId; // The Items, ex: ph:solaris_verdant
        this.skills = {}; // Saves Skills, and Cooldown, type = Object
        this.objective = objective; // The Skills Wheel, ex: solaris_verdant = 1 > Animitta Splitter
    }

    addSkill(id, config) {
        /* 
        *   {@param} config = {
        *       name: "Name",
        *       type: "Skill" // Ability or Ultimate
        *       cooldown_objective: "name",
        *       cooldown: number, // Use Negative value for charge
        *       charge: boolean,
        *       charge_min: number,
        *       action: (source) => {}
        *   }
        */
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
        source.runCommand(`tellraw @a[r=64] {"rawtext":[{"text":"${source.name} Used their ${skill.type} ${skill.name}"}]}`)
        skill.action(source);

        // set cooldown
        addScore(source, skill.cooldown_objective, skill.cooldown);
    }

    useSkill(source) {
        const currentSkill = getScore(source, this.objective) || 0;

        this.runSkill(source, currentSkill)
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
    if (!source) return console.error('No Players found!');
    if (!delay && !damage) return console.error('Specify Damage and Delay before Damage Value');
    if (!radius) return console.error('Specify Radius Value');
    if (!animation) return;
    const strengthLevel = source.getEffect("strength")?.amplifier ?? 0;
    let strengthFormula = 1 + (0.3 * strengthLevel);
    const item = source?.getComponent('equippable')?.getEquipment('Mainhand');
    const sharpnessLevel = item.getComponent("enchantable")?.getEnchantment("sharpness")?.level ?? 0;
    let sharpnessDamage = sharpnessLevel * 1.25;
    let calculatedDamage = (damage + sharpnessDamage) * strengthFormula;

    source.playAnimation(animation);
    system.runTimeout(() => {
        if (!source.getEffect("strength")) {
            source.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=${radius}] ${(damage + sharpnessDamage).toFixed(0)} entity_attack entity "${source.name}"`);
        } else {
            source.runCommand(`damage @e[type=!item,family=!inanimate,rm=0.1,r=${radius}] ${calculatedDamage.toFixed(0)} entity_attack entity "${source.name}"`);
        }
        if (!sound) return;
        source.dimension.playSound(sound, source.location);
    }, delay)
}
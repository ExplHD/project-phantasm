import {
    world, system, CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus
} from '@minecraft/server'
import { } from 'weapons'
import { } from 'loader'
import { } from 'custom_components'
import { } from 'vanilla_manipulation'
import { } from 'specific_structure_position'
import { } from 'formsGenerator'
import { } from 'data/attack_sets'
import { } from 'forms/skillUnlock'
import { } from 'accessoriesRuntime'
import { } from 'damage_indicator'
import * as Phantasm from 'phantasmConstants'

// For Custom Library (PLEASE CREDIT THEM IF YOU WANT TO USE IT!)
import { } from 'custlib/custom_mace/detection' // Credits to @biggamers4u

console.warn("§a§lPhantasm 1.4.0 Activated!");

export function addScore(target, objective, score) {
    try {
        world.scoreboard.getObjective(objective).addScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players add "${target.name}" ${objective} ${score}`)
    }
}

export function removeScore(target, objective, score) {
    try {
        world.scoreboard.getObjective(objective).addScore(target, -score)
    } catch (e) {
        target.runCommand(`scoreboard players remove "${target.name}" ${objective} ${score}`)
    }
}

export function setScore(target, objective, score) {
    try {
        world.scoreboard.getObjective(objective).setScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players set "${target.name}" ${objective} ${score}`)
    }
}

export function getScore(target, objective) {
    try {
        return world.scoreboard.getObjective(objective).getScore(target)
    } catch (error) {
        return 0;
    }
}
/**
 * Apply durability damage ke item di inventory
 * @param {Player|Entity} source - entity who's holding the item
 * @param {Object} options
 * @param {number} [options.damage=1] - damage count
 * @param {number} [options.slot] - slot index (default: selected slot)
 * @param {boolean} [options.ignoreUnbreaking=false] - bypass unbreaking
 * @param {boolean} [options.breakSound=true] - play sound when item break
 */
export function applyDurabilityDamage(source, options = {}) {
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
        const unbreaking = item
            ?.getComponent("enchantable")
            ?.getEnchantment("unbreaking")?.level ?? 0;

        const chance = unbreaking * 21;
        const roll = Math.floor(Math.random() * 101);

        if (roll <= chance) return;
    }

    const newDamage = durability.damage + damage;

    if (newDamage >= durability.maxDurability) {
        inventory.setItem(slot, undefined);

        if (breakSound && source.playSound) {
            source.playSound("random.break");
        }
        return;
    }

    durability.damage = newDamage;
    inventory.setItem(slot, item);
}
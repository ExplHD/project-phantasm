import {
    world, system, CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus
} from '@minecraft/server'
import { } from './weapons'
import { } from './loader'
import { } from './custom_components'
import { } from './vanilla_manipulation'
import { } from './formsGenerator'
import { } from './data/attack_sets'
import { } from './forms/skillUnlock'
import { } from './accessoriesRuntime'
import { } from './damage_indicator'
import { } from './dynamicLighting'
import { } from './dummy'
import * as Phantasm from './phantasmConstants'

// For Custom Library (PLEASE CREDIT THEM IF YOU WANT TO USE IT!)
import { } from 'custlib/custom_mace/detection' // Credits to @biggamers4u for older mechanics, now ALL of the MECHANICS are remade by me.

console.warn("§a§lPhantasm 1.5.0 Activated!");

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

/**
 * Detects any Entity Movement, Run the callback when the entity moved
 * Clears runInterval when moved
 * @param {Entity} entity 
 * @param {*} tickInterval 
 * @param {*} callback 
 * @returns 
 */
export function detectMove(entity, tickInterval = 1, callback) {
    const startLocation = {
        x: Math.floor(entity.location.x),
        y: Math.floor(entity.location.y),
        z: Math.floor(entity.location.z)
    };

    const interval = system.runInterval(() => {
        // Entity invalid / hilang
        if (!entity?.isValid) {
            system.clearRun(interval);
            return;
        }

        const currentLocation = {
            x: Math.floor(entity.location.x),
            y: Math.floor(entity.location.y),
            z: Math.floor(entity.location.z)
        };

        // if position was changed
        if (
            currentLocation.x !== startLocation.x ||
            currentLocation.y !== startLocation.y ||
            currentLocation.z !== startLocation.z
        ) {
            // run event
            callback(currentLocation, startLocation);

            // stop interval
            system.clearRun(interval);
        }
    }, tickInterval);

    return interval;
}

/**
 * Run the callback until entity is moved
 * Clears runInterval when moved
 * @param {Entity} entity 
 * @param {*} tickInterval 
 * @param {*} callback 
 * @returns 
 */
export function runUntilMoved(entity, tickInterval = 1, callback) {
    const startLocation = {
        x: Math.floor(entity.location.x),
        y: Math.floor(entity.location.y),
        z: Math.floor(entity.location.z)
    };

    const interval = system.runInterval(() => {
        // Entity invalid / hilang
        if (!entity?.isValid) {
            system.clearRun(interval);
            return;
        }

        const currentLocation = {
            x: Math.floor(entity.location.x),
            y: Math.floor(entity.location.y),
            z: Math.floor(entity.location.z)
        };

        // run event
            callback(currentLocation, startLocation);

        // if position was changed
        if (
            currentLocation.x !== startLocation.x ||
            currentLocation.y !== startLocation.y ||
            currentLocation.z !== startLocation.z
        ) {
            // stop interval
            system.clearRun(interval);
        }
    }, tickInterval);

    return interval;
}

/**
 * Gets an Item that placed on Offhand, and Accessory Slots
 * @param {*} player 
 * @returns items[];
 */
export function getAccessoryItems(player) {
    const items = [];

    if (player.typeId !== "minecraft:player") return items;

    const equippable = player.getComponent("minecraft:equippable");
    const inventory = player.getComponent("minecraft:inventory")?.container;

    const offhand = equippable?.getEquipment("Offhand");
    if (offhand) items.push(offhand);

    for (const slot of [6, 7, 8]) {
        const item = inventory?.getItem(slot);
        if (item) items.push(item);

        if (!item) continue;
        const processed = new Set();
        if (processed.has(item.typeId)) continue;
        processed.add(item.typeId);
    }

    return items;
}
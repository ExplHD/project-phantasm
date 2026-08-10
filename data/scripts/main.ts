import {
    world, system,
    Entity,
    Player,
    EquipmentSlot
} from '@minecraft/server'

// ======================================== Event Subscriptions (consolidated) ========================================
import { } from './events'

// ======================================== General Script Behavior ========================================
import { } from './weapons'
import { } from './loader'
import { } from './custom_components'
import { } from './vanilla_manipulation'
import { } from './accessoriesRuntime'
import { } from './damage_indicator'
import { } from './dynamicLighting'
import { } from './dummy'

// ======================================== Guide Screen ========================================
import { } from './guidescreen/main_guide'

// For Custom Library (PLEASE CREDIT THEM IF YOU WANT TO USE IT!)
import { } from './custom_mace/detection' // Credits to @biggamers4u for older mechanics, now ALL of the MECHANICS are remade by me.

console.warn("§a§lPhantasm 1.5.2 Activated!");

export function addScore(target: Entity, objective: string, score: number) {
    try {
        world.scoreboard.getObjective(objective)!.addScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players add "${(target as Player).name}" ${objective} ${score}`)
    }
}

export function removeScore(target: Entity, objective: string, score: number) {
    try {
        world.scoreboard.getObjective(objective)!.addScore(target, -score)
    } catch (e) {
        target.runCommand(`scoreboard players remove "${(target as Player).name}" ${objective} ${score}`)
    }
}

export function setScore(target: Entity, objective: string, score: number) {
    try {
        world.scoreboard.getObjective(objective)!.setScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players set "${(target as Player).name}" ${objective} ${score}`)
    }
}

export function getScore(target: Entity, objective: string): number {
    try {
        return world.scoreboard.getObjective(objective)!.getScore(target) ?? 0
    } catch (error) {
        return 0;
    }
}

interface DurabilityDamageOptions {
    damage?: number;
    slot?: number;
    ignoreUnbreaking?: boolean;
    breakSound?: boolean;
}

export function applyDurabilityDamage(source: any, options: DurabilityDamageOptions = {}) {
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

export function detectMove(entity: Entity, tickInterval: number = 1, callback: (currentLocation: { x: number; y: number; z: number }, startLocation: { x: number; y: number; z: number }) => void) {
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

        if (
            currentLocation.x !== startLocation.x ||
            currentLocation.y !== startLocation.y ||
            currentLocation.z !== startLocation.z
        ) {
            callback(currentLocation, startLocation);
            system.clearRun(interval);
        }
    }, tickInterval);

    return interval;
}

export function runUntilMoved(entity: Entity, tickInterval: number = 1, callback: (currentLocation: { x: number; y: number; z: number }, startLocation: { x: number; y: number; z: number }) => void) {
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

        if (
            currentLocation.x !== startLocation.x ||
            currentLocation.y !== startLocation.y ||
            currentLocation.z !== startLocation.z
        ) {
            system.clearRun(interval);
        }
    }, tickInterval);

    return interval;
}

export function getAccessoryItems(player: Player) {
    const items: any[] = [];

    if (player.typeId !== "minecraft:player") return items;

    const equippable = player.getComponent("minecraft:equippable");
    const inventory = player.getComponent("minecraft:inventory")?.container;

    const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
    if (offhand) items.push(offhand);

    for (const slot of [6, 7, 8]) {
        const item = inventory?.getItem(slot);
        if (item) items.push(item);

        if (!item) continue;
        const processed = new Set<string>();
        if (processed.has(item.typeId)) continue;
        processed.add(item.typeId);
    }

    return items;
}

export function unstuckPlayer(player: Player) {
	system.run(() => {
		player.runCommand("inputpermission set @s movement enabled")
		player.runCommand("inputpermission set @s jump enabled")
		player.runCommand("inputpermission set @s camera enabled")
		player.removeTag("parried")
		player.runCommand("camera @s clear")
	})
}

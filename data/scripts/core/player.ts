import { system, Entity, Player, EquipmentSlot } from '@minecraft/server'

/**
 * Polls until the entity leaves its starting block position, then fires once and stops.
 */
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

/**
 * Same as detectMove, but fires the callback on every tick until the entity moves.
 */
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

// Offhand plus the three accessory hotbar slots (6, 7, 8). Called on every hurt, hit and
// accessory loop tick, so the slot list is hoisted and nothing is allocated for the
// non-player case that most entity events hit.
const ACCESSORY_SLOTS = [6, 7, 8];

const NO_ACCESSORIES: any[] = [];

/**
 * Offhand plus the three accessory hotbar slots (6, 7, 8).
 * The result is read-only: callers must not mutate it, the empty case is shared.
 */
export function getAccessoryItems(player: Player) {
    if (player?.typeId !== "minecraft:player") return NO_ACCESSORIES;

    const equippable = player.getComponent("minecraft:equippable");
    const inventory = player.getComponent("minecraft:inventory")?.container;

    const items: any[] = [];

    const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
    if (offhand) items.push(offhand);

    for (const slot of ACCESSORY_SLOTS) {
        const item = inventory?.getItem(slot);
        if (item) items.push(item);
    }

    return items;
}

/**
 * Clears the input permission and camera state that can wedge a player after certain hits.
 */
export function unstuckPlayer(player: Player) {
    system.run(() => {
        player.runCommand("inputpermission set @s movement enabled")
        player.runCommand("inputpermission set @s jump enabled")
        player.runCommand("inputpermission set @s camera enabled")
        player.removeTag("parried")
        player.runCommand("camera @s clear")
    })
}
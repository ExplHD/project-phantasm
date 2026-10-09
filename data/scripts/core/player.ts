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

/**
 * Offhand plus the three accessory hotbar slots (6, 7, 8).
 */
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
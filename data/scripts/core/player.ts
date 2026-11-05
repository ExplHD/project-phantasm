import { system, Entity, Player, EquipmentSlot, ItemStack } from '@minecraft/server'

export function detectMove(entity: Entity, tickInterval: number = 1, callback: (currentLocation: { x: number; y: number; z: number }, startLocation: { x: number; y: number; z: number }) => void): number {
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

export function runUntilMoved(entity: Entity, tickInterval: number = 1, callback: (currentLocation: { x: number; y: number; z: number }, startLocation: { x: number; y: number; z: number }) => void): number {
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

const ACCESSORY_SLOTS = [6, 7, 8];

const NO_ACCESSORIES: ItemStack[] = [];

export function getAccessoryItems(player: Player): ItemStack[] {
    if (player?.typeId !== "minecraft:player") return NO_ACCESSORIES;

    const equippable = player.getComponent("minecraft:equippable");
    const inventory = player.getComponent("minecraft:inventory")?.container;

    const items: ItemStack[] = [];

    const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
    if (offhand) items.push(offhand);

    for (const slot of ACCESSORY_SLOTS) {
        const item = inventory?.getItem(slot);
        if (item) items.push(item);
    }

    return items;
}

export function unstuckPlayer(player: Player): void {
    system.run(() => {
        if (!player.isValid) return;
        player.runCommand("inputpermission set @s movement enabled")
        player.runCommand("inputpermission set @s jump enabled")
        player.runCommand("inputpermission set @s camera enabled")
        player.removeTag("parried")
        player.runCommand("camera @s clear")
    })
}

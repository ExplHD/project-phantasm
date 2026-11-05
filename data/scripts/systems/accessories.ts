import { world, system, ItemStack, Player, Entity, EquipmentSlot, GameMode, type PlayerBreakBlockBeforeEvent } from '@minecraft/server'
import { addScore } from '../core/scoreboard'
import { getAccessoryItems } from '../core/player'
import { summonOwned } from '../core/summons'
import { isLoadedLocation } from '../core/location'
import * as Phantasm from '../core/constants'

const ARMOUR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];

const AURIC_CHARGE_ACTIONBAR = 'titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}';

interface AccessoryHandlers {
    readonly onHurt?: (player: Player) => void;
    readonly onHitEntity?: (player: Player, target: Entity) => void;
    readonly onBreakBlock?: (player: Player, event: PlayerBreakBlockBeforeEvent) => void;
    readonly onLoop?: (player: Player) => void;
}

function crimsonLaserCommand(x: number, z: number): string {
    return `summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`;
}

function addAuricCharge(player: Player): void {
    if (!player.isValid) return;
    addScore(player, "auric_charge", 1);
    player.runCommand(AURIC_CHARGE_ACTIONBAR);
}

const accessoryRegistry: Record<string, AccessoryHandlers> = {
    "ph:fire_bracelet": {
        onHitEntity(player: Player, target: Entity): void {
            player.addEffect("fire_resistance", 100, { showParticles: false });
            if (target.isValid) target.setOnFire(7, true);
        }
    },
    "ph:rust_coin": {
        onBreakBlock(player: Player, event: PlayerBreakBlockBeforeEvent): void {
            const { block, dimension } = event;
            const drop = Phantasm.ORE_DROPS.get(block.typeId);
            if (!drop) return;
            if (player.getGameMode() === GameMode.Creative) return;
            const center = block.center();

            system.run(() => {
                if (!player.isValid) return;
                if (!isLoadedLocation(dimension, center)) return;
                const itemDropped = player.dimension.getEntities({
                    location: player.location,
                    maxDistance: 5,
                    type: "minecraft:item"
                });
                itemDropped.forEach((item: Entity) => {
                    if (item.isValid) item.teleport(player.location);
                });

                dimension.spawnParticle("ph:rusted_coin_fortune", center);
                dimension.spawnItem(new ItemStack(drop, 1), player.location);
            });
        }
    },
    "ph:the_crimson_watcher": {
        onHurt(player: Player): void {
            system.run(() => {
                if (!player.isValid) return;
                const randomChance = Math.floor(Math.random() * 101);
                const { x, z } = player.location;
                if (randomChance < 26) summonOwned(player, crimsonLaserCommand(x, z));
            });
        },
        onHitEntity(player: Player, target: Entity): void {
            if (!target.isValid) return;
            const randomChance = Math.floor(Math.random() * 101);
            const { x, z } = target.location;
            if (randomChance < 26) summonOwned(player, crimsonLaserCommand(x, z), target);
        }
    },
    "ph:auric_proton": {
        onHurt(player: Player): void {
            system.run(() => addAuricCharge(player));
        },
        onHitEntity(player: Player): void {
            addAuricCharge(player);
        },
        onLoop(player: Player): void {
            system.run(() => addAuricCharge(player));
        }
    },
    "ph:time_polarizer": {
        onLoop(player: Player): void {
            system.run(() => {
                if (!player.isValid) return;
                player.addEffect("speed", 100, {
                    amplifier: 1,
                    showParticles: false
                });
            });
        }
    },
    "ph:weeping_repair": {
        onLoop(player: Player): void {
            system.run(() => {
                if (!player.isValid) return;
                const inventory = player.getComponent("minecraft:inventory")?.container;
                const equippable = player.getComponent("minecraft:equippable");
                if (!inventory || !equippable) return;

                for (let i = 0; i < inventory.size; i++) {
                    const item = inventory.getItem(i);
                    if (!item) continue;

                    const durability = item.getComponent("minecraft:durability");
                    if (!durability) continue;
                    if (durability.damage == 0) continue;
                    durability.damage -= 1;
                    inventory.setItem(i, item);
                }

                for (const slot of ARMOUR_SLOTS) {
                    const equipmentSlot = equippable.getEquipmentSlot(slot);
                    const item = equipmentSlot.getItem();
                    if (!item) continue;

                    const durability = item.getComponent("minecraft:durability");
                    if (!durability) continue;
                    if (durability.damage == 0) continue;
                    durability.damage -= 1;
                    equipmentSlot.setItem(item);
                }
            });
        }
    },
    "ph:condensed_sea_nature": {
        onLoop(player: Player): void {
            if (!player.isInWater) return;
            player.dimension.spawnParticle("ph:time_polarizer_speed", player.location);
            player.addEffect("water_breathing", 20);
            player.addEffect("regeneration", 100, { amplifier: 1 });
        }
    }
};

function handlersFor(player: Player, items: ItemStack[] = getAccessoryItems(player)): AccessoryHandlers[] {
    return items.flatMap((item) => accessoryRegistry[item.typeId] ?? []);
}

export function accessoryOnHurt(player: Player, items?: ItemStack[]): void {
    for (const handlers of handlersFor(player, items)) handlers.onHurt?.(player);
}

export function accessoryOnHitEntity(attacker: Entity, target: Entity): void {
    if (!(attacker instanceof Player)) return;
    for (const handlers of handlersFor(attacker)) handlers.onHitEntity?.(attacker, target);
}

export function accessoryOnBreakBlock(player: Player, event: PlayerBreakBlockBeforeEvent): void {
    for (const handlers of handlersFor(player)) handlers.onBreakBlock?.(player, event);
}

export function tickAccessories(): void {
    for (const player of world.getPlayers()) {
        if (!player.isValid) continue;
        for (const handlers of handlersFor(player)) handlers.onLoop?.(player);
    }
}

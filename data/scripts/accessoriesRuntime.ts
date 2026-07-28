import { world, system, ItemStack } from '@minecraft/server'
import { applyDurabilityDamage, addScore, getAccessoryItems } from './main';
import * as Phantasm from './phantasmConstants'

const accessoryRegistry: Record<string, Record<string, (player: any, event: any, ...args: any[]) => void>> = {
    "ph:fire_bracelet": {
        onHitEntity(player: any, event: any, hitTarget: any) {
            player.addEffect("fire_resistance", 100, { showParticles: false });
            hitTarget.setOnFire(7, true);
        }
	},
	"ph:rust_coin": {
        onBreakBlock(player: any, event: any, block: any) {
			const drop = Phantasm.ORE_DROPS.get(block.type.id);
			if (!drop) return;

			if (player.getGameMode() === "Creative") return;
			system.run(() => {
				const itemDropped = player.dimension.getEntities({
					location: player.location,
					maxDistance: 5,
					type: "minecraft:item"
				})
				itemDropped.forEach((item: any) => {
					item.teleport(player.location)
				})

				event.dimension.spawnParticle("ph:rusted_coin_fortune", block.center());
				event.dimension.spawnItem(new ItemStack(drop, 1), player.location);
			})
        }
    },
    "ph:the_crimson_watcher": {
        onHurt(player: any, event: any) {
            system.run(() => {
                const randomChance = Math.floor(Math.random() * 101);
                const { x, y, z } = player.location;
                if (randomChance < 26) {
                    player.runCommand(`summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`);
                }
            })
        },
        onHitEntity(player: any, event: any, hitTarget: any) {
            const randomChance = Math.floor(Math.random() * 101);
            const { x, y, z } = hitTarget.location;
            if (randomChance < 26) {
                hitTarget.runCommand(`summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`);
            }
        }
    },
    "ph:auric_proton": {
        onHurt(player: any, event: any) {
            system.run(() => {
                addScore(player, "auric_charge", 1);
                player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
            })
        },
        onHitEntity(player: any, event: any, hitTarget: any) {
            addScore(player, "auric_charge", 1);
            player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
        },
        onLoop(player: any, event: any) {
            system.run(() => {
                addScore(player, "auric_charge", 1);
                player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
            })
        }
    },
    "ph:time_polarizer": {
        onLoop(player: any, event: any) {
            system.run(() => {
                player.addEffect("speed", 100, {
                    amplifier: 1,
                    showParticles: false
                })
            })
        }
    },
    "ph:weeping_repair": {
        onLoop(player: any, event: any) {
            system.run(() => {
                const inventory = player?.getComponent("minecraft:inventory")?.container;
                const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];

                for (let i = 0; i < inventory.size; i++) {
                    const item = inventory.getItem(i);
                    if (!item) continue;

                    const durability = item.getComponent("minecraft:durability");
                    if (!durability) continue;
                    if (durability.damage == 0) continue;
                    durability.damage -= 1;
                    inventory.setItem(i, item);
                }

                for (const slot of slots) {
                    const equipmentSlot = player?.getComponent("minecraft:equippable")?.getEquipmentSlot(slot);
                    const item = equipmentSlot.getItem();
                    if (!item) continue;

                    const durability = item.getComponent("minecraft:durability");
                    if (!durability) continue;
                    if (durability.damage == 0) continue;
                    durability.damage -= 1;
                    equipmentSlot.setItem(item);
                }
            })
        }
	},
	"ph:condensed_sea_nature": {
		onLoop(player: any, event: any) {
			if (!player.isInWater) return;
			player.dimension.spawnParticle("ph:time_polarizer_speed", player.location);
			player.addEffect("water_breathing", 20);
			player.addEffect("regeneration", 100, { amplifier: 1 })
		}
    }
};

export function handleAccessory(player: any, trigger: string, event: any, hitTarget?: any) {
    for (const item of getAccessoryItems(player)) {
        const handler =
            accessoryRegistry[item.typeId]?.[trigger];

        handler?.(player, event, hitTarget, item);
    }
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        handleAccessory(player, "onLoop", undefined);
    }
}, 100)

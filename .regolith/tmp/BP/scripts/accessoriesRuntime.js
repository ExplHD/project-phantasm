import { world, system, ItemUseBeforeEvent } from '@minecraft/server'
import { applyDurabilityDamage, addScore, getAccessoryItems } from './main';

const accessoryRegistry = {
    "ph:fire_bracelet": {
        onHitEntity(player, event, hitTarget) {
            player.addEffect("fire_resistance", 100, { showParticles: false });
            hitTarget.setOnFire(7, true);
        }
    },
    "ph:the_crimson_watcher": {
        onHurt(player, event) {
            system.run(() => {
                const randomChance = Math.floor(Math.random() * 101);
                const { x, y, z } = player.location;
                if (randomChance < 26) {
                    player.runCommand(`summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`);
                }
            })
        },
        onHitEntity(player, event, hitTarget) {
            const randomChance = Math.floor(Math.random() * 101);
            const { x, y, z } = hitTarget.location;
            if (randomChance < 26) {
                hitTarget.runCommand(`summon ph:crimson_laser ${x + -15 + Math.floor(Math.random() * 30)} ~ ${z + -15 + Math.floor(Math.random() * 30)} facing @n`);
            }
        }
    },
    "ph:auric_proton": {
        onHurt(player, event) {
            system.run(() => {
                addScore(player, "auric_charge", 1);
                player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
            })
        },
        onHitEntity(player, event, hitTarget) {
            addScore(player, "auric_charge", 1);
            player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
        },
        onLoop(player, event) {
            system.run(() => {
                addScore(player, "auric_charge", 1);
                player.runCommand('titleraw @s actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}');
            })
        }
    },
    "ph:time_polarizer": {
        onLoop(player, event) {
            system.run(() => {
                player.addEffect("speed", 100, {
                    amplifier: 1,
                    showParticles: false
                })
            })
        }
    },
    "ph:weeping_repair": {
        onLoop(player, event) {
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
    }
};

function handleAccessory(player, trigger, event, hitTarget) {
    for (const item of getAccessoryItems(player)) {
        const handler =
            accessoryRegistry[item.typeId]?.[trigger];

        handler?.(player, event, hitTarget, item);
    }
}

world.beforeEvents.entityHurt.subscribe((acc) => {
    const hurtEntity = acc.hurtEntity;
    const damagingEntity = acc.damageSource.damagingEntity;
    const cause = acc.damageSource.cause;

    handleAccessory(hurtEntity, "onHurt", acc);
    if (hurtEntity.typeId === "minecraft:player" && hurtEntity?.hasTag("parried")) {
        acc.cancel = true;
        system.run(() => {
            const mainItem = hurtEntity?.getComponent("equippable")?.getEquipment("Mainhand");
            hurtEntity.runCommand(`particle ph:parry_success ^^^0.5`);
            hurtEntity.spawnParticle(
                "ph:parry_invert_flash",
                {
                    x: hurtEntity.getHeadLocation().x + hurtEntity.getViewDirection().x * 1,
                    y: hurtEntity.getHeadLocation().y + hurtEntity.getViewDirection().y * 1,
                    z: hurtEntity.getHeadLocation().z + hurtEntity.getViewDirection().z * 1
                }
            )
            hurtEntity.runCommand('camerashake add @s 1 0.1 positional');
            hurtEntity.dimension.playSound("weapon_slash.slash_clash", hurtEntity.location);
            hurtEntity.removeTag("parried");
            if (mainItem.typeId === "ph:seiketsu") {
                applyDurabilityDamage(hurtEntity, { damage: 1 });
                return;
            }
            applyDurabilityDamage(hurtEntity, { damage: 30 });
        })
    }
    if (getAccessoryItems(hurtEntity).some(item => item.typeId === "ph:the_crimson_watcher") || hurtEntity?.getComponent("equippable")?.getEquipment("Mainhand")?.typeId === "ph:the_bleeding_spire") {
        if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
    }
})

world.afterEvents.entityHitEntity.subscribe((acc) => {
    const damagingEntity = acc.damagingEntity;
    const hitEntity = acc.hitEntity;

    handleAccessory(damagingEntity, "onHitEntity", acc, hitEntity);
})

system.runInterval((event) => {
    for (const player of world.getPlayers()) {
        handleAccessory(player, "onLoop", event);
    }
}, 100)
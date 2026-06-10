import { world, system } from '@minecraft/server'
import { applyDurabilityDamage } from './main';

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
    }
};

function handleAccessory(player, trigger, event, hitTarget) {
    const item = player?.getComponent("minecraft:equippable")?.getEquipment("Offhand");

    if (!item) return;

    const data = accessoryRegistry[item.typeId];
    if (!data) return;

    const handler = data[trigger];
    if (handler) {
        handler(player, event, hitTarget);
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
            if (mainItem.typeId === "ph:seikatsu") {
                applyDurabilityDamage(hurtEntity, { damage: 1 });
                return;
            }
            applyDurabilityDamage(hurtEntity, { damage: 30 });
        })
    }
    if (hurtEntity?.getComponent("minecraft:equippable")?.getEquipment('Offhand')?.typeId === "ph:the_crimson_watcher" || hurtEntity?.getComponent("minecraft:equippable")?.getEquipment('Mainhand')?.typeId === "ph:the_bleeding_spire") {
        if (damagingEntity?.typeId === "ph:crimson_laser") acc.cancel = true;
    }
})

world.afterEvents.entityHitEntity.subscribe((acc) => {
    const damagingEntity = acc.damagingEntity;
    const hitEntity = acc.hitEntity;

    handleAccessory(damagingEntity, "onHitEntity", acc, hitEntity);
})
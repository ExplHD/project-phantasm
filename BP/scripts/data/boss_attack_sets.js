import { world, system } from '@minecraft/server'

system.afterEvents.scriptEventReceive.subscribe(({ id, initiator, message, sourceType, sourceBlock, sourceEntity }) => {
    switch (id) {
        case "ph:remove_target_lock":
            system.runTimeout(() => {
                sourceEntity.removeTag("locked")
            }, 5)
            break;
        case "ph:boss_summon_projectile":
            // Example Message : 3, ph:solaris_slash, custom_sfx.animirra_summon
            const splittedData = message.split(",");
            let num = splittedData[0];
            let id = splittedData[1];
            sourceEntity.runCommand(`playsound ${splittedData[2]} @a[r=32] ~~~ 1 1 0.3`)
            for (let i = 0; i < num; i++) {
                const randXRot = Math.floor(Math.random() * 360)
                sourceEntity.runCommand(`summon ${id} ~~1.5~ ${randXRot} ~`)
            }
            break;
        case "ph:boss_summon_meteor":
            // Example Message : 10, 20, 24, ph:animirra_meteor, custom_sfx.animirra_summon
            const splittedData2 = message.split(",").map(v => v.trim());
            const number = Number(splittedData2[0]);
            const yAxis = Number(splittedData2[1]);
            const radius = Number(splittedData2[2]);
            const id2 = splittedData2[3];
            const sound = splittedData2[4];

            // main sound
            sourceEntity.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 1 0.3`);

            for (let i = 0; i < number; i++) {
                const { x, y, z } = sourceEntity.location;

                const offsetX = (Math.random() * 2 - 1) * radius;
                const offsetZ = (Math.random() * 2 - 1) * radius;

                // spawn meteor
                sourceEntity.runCommand(
                    `summon ${id2} ${x + offsetX} ${y + yAxis} ${z + offsetZ}`
                );
            }
            break;
        default: break;
    }
})
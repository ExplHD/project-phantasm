import { world, system } from '@minecraft/server'
import { addScore, runUntilMoved } from 'main'

let objectives = [
    // System Scoreboard
    "delayatk",
    "sectick",
    // Solaris Verdant (Animitta)
    "solaris_verdant",
    "solaris_verdant_atk",
    "solaris_verdant_s1",
    "solaris_verdant_s2",
    "solaris_verdant_s3",
    // Supercharged Copper Axe
    "supercharged_copper_axe",
    "supercharged_copper_axe_atk",
    "supercharged_copper_axe_s1",
    "supercharged_copper_axe_s2",
    "supercharged_copper_axe_s3",
    "supercharged_copper_axe_s4",
    // Other Weapon Runtime
    "charged_copper_axe",
    "auric_charge",
    "gapple_cooldown",
    // Prism Weaver
    "prism_weaver",
    "prism_weaver_atk",
    "prism_weaver_s1",
    "prism_weaver_s2",
    "prism_weaver_s3",
    // Auric Photonizer
    "auric_photonizer",
    "auric_photonizer_atk",
    "auric_photonizer_s1",
    "auric_photonizer_s2",
    "auric_photonizer_s3",
    "auric_photonizer_s4",
    // The Bleeding Spire
    "the_bleeding_spire",
    "the_bleeding_spire_atk",
    "the_bleeding_spire_s1",
    "the_bleeding_spire_s2",
    "the_bleeding_spire_s3",
    // Auric Communicator
    "auric_communicator_mode",
    "seiketsu_atk"
]

world.afterEvents.worldLoad.subscribe(() => {
    for (const objective of objectives) {
        if (!world.scoreboard.getObjective(objective)) {
            world.scoreboard.addObjective(objective)
        }
    }
})

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (player.getDynamicProperty("ph:health_level") != undefined && player.getDynamicProperty("ph:health_level") > 0) {
        player.runCommand(`effect @s health_boost infinite ${3 * player.getDynamicProperty("ph:health_level")} true`)
        player.addEffect("instant_health", 1, {
            amplifier: 255,
            showParticles: false
        })
    }

    if (!initialSpawn) return;
    const health = player?.getComponent("minecraft:health")?.currentValue;
    const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
    const totalArmor = player?.getComponent("minecraft:equippable").totalArmor;
    if (maxHealth <= 0) return 0;

    let scaled = (health / maxHealth) * 100;
    runUntilMoved(player, 10, () => {
        player.runCommand(`title @s title bar0:${Math.min(100, Math.max(0, Math.floor(scaled)))}%% healthind:${Math.floor(health)}/${maxHealth} ${totalArmor}`);
    });
    const playerInput = player.inputInfo.lastInputModeUsed;
    if (playerInput == "Touch") {
        player.sendMessage("§eIt is recommended for you to use the Joystick + Crosshair with Action Button Enabled, for making the using weapon experience easier");
    }
    const properties = [
        "ph:dash_level",
        "ph:health_level",
        "ph:plunge_unlock"
    ]
    for (const property of properties) {
        if (player.getDynamicProperty(property) === undefined) {
            system.runTimeout(() => {
                player.setDynamicProperty("ph:dash_level", 0);
                player.setDynamicProperty("ph:health_level", 0);
                player.setDynamicProperty("ph:plunge_unlock", false);
            }, 20)
        }
    }
    for (const objective of objectives) {
        addScore(player, objective, 0)
    }
})
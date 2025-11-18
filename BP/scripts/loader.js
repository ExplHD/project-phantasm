import { world, system } from '@minecraft/server'
import { addScore } from 'main'

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
    "charged_copper_axe"
]

world.afterEvents.worldLoad.subscribe(() => {
    for (const objective of objectives) {
        if (!world.scoreboard.getObjective(objective)) {
            world.scoreboard.addObjective(objective)
        }
    }
})

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;

    for (const objective of objectives) {
        addScore(player, objective, 0)
    }
})
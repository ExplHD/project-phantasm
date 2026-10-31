import { world, system, ItemStack, Player } from '@minecraft/server'
import { addScore, setScore } from '../core/scoreboard'
import { runUntilMoved, unstuckPlayer } from '../core/player'
import { applyPropertyDefaults } from '../core/playerProperties'
import { healthBarDisplay } from '../systems/movement'
import { onDynamicLighting } from '../systems/lighting'
import { onBlessingSpawn } from '../systems/xeonniteBlessing'
import { registerCustomComponents } from '../features/blocks/customComponents'
import { registerPolarisComponent, onPolarisSpawn } from '../features/polaris_power/manager'
import { registerUiCommands } from '../ui/commands'

const objectives: string[] = [
    // System Scoreboard
    "delayatk",
	"sectick",
    "dash_cd",
    "sfx_cd",
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

// Custom item/block components and slash commands have to be registered during startup
system.beforeEvents.startup.subscribe((initEvent) => {
    registerCustomComponents(initEvent);
    registerPolarisComponent(initEvent);
    registerUiCommands(initEvent);
})

world.afterEvents.worldLoad.subscribe(() => {
    loadScoreboards()
})

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    onPlayerSpawn(player, initialSpawn)
    onDynamicLighting(player)
    // Both undo a state the player quit in the middle of (cutscene, Polaris charge)
    onBlessingSpawn(player, initialSpawn)
    onPolarisSpawn(player, initialSpawn)
})

function loadScoreboards(): void {
    for (const objective of objectives) {
        if (!world.scoreboard.getObjective(objective)) {
			world.scoreboard.addObjective(objective)
        }
    }
}

function loadPlayerScore(player: Player) { 
	for (const objective of objectives) {
		addScore(player, objective, 0)
		if (objective.includes("_atk")) {
			setScore(player, objective, 0)
		}
	}
}

function onPlayerSpawn(player: Player, initialSpawn: boolean): void {
    const healthLevel = Number(player.getDynamicProperty("ph:health_level"));
    if (healthLevel != undefined && healthLevel > 0) {
        player.runCommand(`effect @s health_boost infinite ${3 * healthLevel} true`)
        player.addEffect("instant_health", 1, {
            amplifier: 255,
            showParticles: false
        })
	}

    unstuckPlayer(player)

    // Health bar shows on every spawn (both initial join and respawn)
    const health = player?.getComponent("minecraft:health");
    const maxHealth = health?.effectiveMax;
    const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
    if (health && maxHealth && maxHealth > 0) {
        runUntilMoved(player, 10, () => {
            healthBarDisplay(player, health, totalArmor, maxHealth);
        });
    }

	if (!initialSpawn) return;
	loadPlayerScore(player)
    if (player.getDynamicProperty("ph:guidebook_acquired") === undefined || player.getDynamicProperty("ph:guidebook_acquired") === false) {
		player.dimension.spawnItem(new ItemStack("ph:guidebook"), player.location);
        player.sendMessage("§eWelcome to Phantasm! Pick up your Guidebook or use /guide to learn the features of this add-on.");
    }
    const playerInput = player.inputInfo.lastInputModeUsed;
    if (playerInput == "Touch") {
        player.sendMessage("§eTouch controls? Joystick + Crosshair with the Action Button enabled makes weapons easier to use");
    }
    // Only fills in what's missing; existing progress is never overwritten.
    system.runTimeout(() => {
        if (player.isValid) applyPropertyDefaults(player);
    }, 20)
    for (const objective of objectives) {
        addScore(player, objective, 0)
    }
}

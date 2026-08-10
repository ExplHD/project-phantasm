import { world, system, ItemStack, Player } from '@minecraft/server'
import { addScore, detectMove, runUntilMoved, setScore, unstuckPlayer } from './main'

const objectives: string[] = [
    // System Scoreboard
    "delayatk",
	"sectick",
    "dash_cd",
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

export function loadScoreboards(): void {
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

export function onPlayerSpawn(player: Player, initialSpawn: boolean): void {
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
    const health = player?.getComponent("minecraft:health")?.currentValue;
    const maxHealth = player?.getComponent("minecraft:health")?.effectiveMax;
    const totalArmor = player?.getComponent("minecraft:equippable")?.totalArmor;
    if (maxHealth && maxHealth > 0) {
        const healthVal = health ?? 0;
        let scaled = (healthVal / maxHealth) * 100;
        runUntilMoved(player, 10, () => {
            player.onScreenDisplay.setTitle(
                `bar0:${Math.min(100, Math.max(0, Math.floor(scaled)))}% healthind:${Math.floor(healthVal)}/${maxHealth} ${totalArmor}`,
                { fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 }
            );
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
        player.sendMessage("§eIt is recommended for you to use the Joystick + Crosshair with Action Button Enabled, for making the using weapon experience easier");
    }
    const properties: string[] = [
        "ph:dash_level",
        "ph:health_level",
		"ph:plunge_unlock",
        "ph:guidebook_acquired"
    ]
    for (const property of properties) {
        if (player.getDynamicProperty(property) === undefined) {
            system.runTimeout(() => {
                player.setDynamicProperty("ph:dash_level", 0);
                player.setDynamicProperty("ph:health_level", 0);
				player.setDynamicProperty("ph:plunge_unlock", false);
				player.setDynamicProperty("ph:guidebook_acquired", true);
            }, 20)
        }
    }
    for (const objective of objectives) {
        addScore(player, objective, 0)
    }
}

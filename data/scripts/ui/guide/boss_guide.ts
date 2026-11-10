import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";
import { guideTitle } from "./guidebookTitle";

export default function guideBosses(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Bosses"))
		.label("Every boss in the add-on, in progression order.")
		.button("Soul of Nature")
		.button("Punicea - A Crimson Eye")
		.button("Polaris")
		.button("Auric Automaton")
		.button("Back")
		.show(player).then(r => {
			if (r.selection === 4 || r.canceled) mainGuideScreen(player);
			if (r.selection === 0) soulOfNature(player);
			if (r.selection === 1) puniceaCrimsonEye(player);
			if (r.selection === 2) polaris(player);
			if (r.selection === 3) copperMechanicalArray(player);
		})
}

function soulOfNature(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Sealed Soul of Nature"))
		.label("Sealed Soul of Nature wields nature and prism power. Its attacks can drain your oxygen mid-fight.")
		.label("It has 500 HP and 3 attack patterns. At 70% HP it spawns extra Nature and Prism Crystals, making the fight harder.")
		.label("Summon it by interacting with the Nature Soul Altar in the underwater Prismarine Arena.")
		.label("Defeating it marks the true start of your Phantasm journey. You get a treasure bag...")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}

function puniceaCrimsonEye(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Punicea - A Crimson Eye"))
		.label("Punicea wields crimson corruption. It has 6 attacks and very high health.")
		.label("It has 3000 HP and 6 attack patterns. Each is well telegraphed but hits hard, so keep moving.")
		.label("Summon it by interacting with the Suspicious Crimson Eye in the Crimson Overgrowth.")
		.label("Defeating it proves you can dodge. You get a treasure bag...")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}

function polaris(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Polaris - The Interdimensional Communicator"))
		.label("Polaris leads the Titan Ridge. It fights in two phases, and each phase has its own bar of 1570 HP.")
		.label("Phase one has 4 attacks in a fixed order: corrupted floor tiles, a False Clone you must destroy within 15 seconds, a laser grid with one-block gaps, and The Punishment. The Punishment kills anyone who has not picked up 3 Polaris Gifts before it lands.")
		.label("At 1 HP Polaris refills its health and switches to a fast duel with 7 attacks. The last one, The Phase Collapse, wipes the arena after 20 seconds unless you break every charger node.")
		.label("Mace smashes and fire do nothing to it, and you need the Xeonnite Blessing to hurt it.")
		.label("It drops 25000 XP and a Polaris Edge Treasure Bag.")
		.label("Its arena, the Core Room of the Sky Fortress, is not in the game yet. Until then, /summon ph:polaris is the only way to fight it.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}

function copperMechanicalArray(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Auric Automaton - Copper Mechanical Array"))
		.label("The Auric Mechanical Array wields ultimate Auric power. Complicated patterns, massive damage, and high mobility. Bring your best gear.")
		.label("It has 1750 HP and 7 attack patterns that adapt to how you fight. Do not try to tank them. Stay mobile to survive and kill it.")
		.label("Summon it by completing the Ancient Copper Core ritual.")
		.label("It drops a treasure bag. That completes the Phantasm journey, for now. Stay tuned for the next update!")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}

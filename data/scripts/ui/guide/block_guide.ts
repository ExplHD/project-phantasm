import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";
import { guideTitle } from "./guidebookTitle";

export default function guideBlocks(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Blocks"))
		.label("Every functional block in the add-on.")
		.button("Ancient Copper Core")
		.button("Auric Recharge Station")
		.button("Nature Soul Altar")
		.button("Suspicious Crimson Eye")
		.button("Back")
		.show(player).then(r => {
			if (r.selection === 4 || r.canceled) mainGuideScreen(player);
			if (r.selection === 0) ancientCopperCore(player);
			if (r.selection === 1) auricRechargeStation(player);
			if (r.selection === 2) natureSoulAltar(player);
			if (r.selection === 3) suspiciousCrimsonEye(player);
		})
}

function ancientCopperCore(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Ancient Copper Core"))
		.label("The Ancient Copper Core holds a large charge of Auric power, and needs specific items to fully activate.")
		.label("Interact with it to create another battery. Fill the scattered batteries with the required item, interact with the core again, and the boss appears: Auric Automaton, the Copper Mechanical Array.")
		.label("Found in Trial Chambers.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBlocks(player);
		})
}

function auricRechargeStation(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Auric Battery Recharge Station"))
		.label("The Auric Battery Recharge Station recharges Auric Batteries placed inside it. Interact while a battery is inside to charge it slowly. A full charge takes 100 seconds no matter how many batteries are inside, so load it up.")
		.label("It cannot be broken while batteries are inside.")
		.label("Craft it with Ancient Copper Core, Copper Block, and Auric Charging Module.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBlocks(player);
		})
}

function natureSoulAltar(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Nature Soul Altar"))
		.label("The Nature Soul Altar generates with the underwater Prismarine Arena.")
		.label("Give it a Prismarine Shard to start the fight.")
		.label("Only found in the Prismarine Arena.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBlocks(player);
		})
}

function suspiciousCrimsonEye(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Suspicious Crimson Eye"))
		.label("The Suspicious Crimson Eye generates with the Crimson Overgrowth in the Crimson Forest.")
		.label("Give it 5 Essence of Crimson to start the fight.")
		.label("Only found in the Crimson Overgrowth.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBlocks(player);
		})
}

import { ActionFormData } from "@minecraft/server-ui";
import { mainGuideScreen } from "./main_guide";

export default function guideBlocks(player) {
	const form = new ActionFormData()
		.title("Blocks")
		.label("This is the list of Blocks that exist in the add-on, each blocks showed here have a functionality.")
		.button("Ancient Copper Core")
		.button("Auric Battery Recharge Station")
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

function ancientCopperCore(player) {
	const form = new ActionFormData()
		.title("Ancient Copper Core")
		.label("Ancient Copper Core is a block that contains large power of Auric Charges, those power needs a specific power to fully activate the blocks.")
		.label("This block will create another battery if you interact with it, Fill those block scattered with the specific item, and try to interact the core again, and you'll see the boss : Auric Automaton - Copper Mechanical Array.")
		.label("This block can be found in Trial Chamber.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function auricRechargeStation(player) {
	const form = new ActionFormData()
		.title("Auric Battery Recharge Station")
		.label("Auric Battery Recharge Station is a block that used to recharge your Auric Battery by placing them in the block, interacting while there's battery inside will charge the battery slowly, It takes 100 seconds to complete the charging session, better place more batteries inside since the time to charge will not be changed regardless how many the battery is.")
		.label("This block can't be broken while there are batteries inside.")
		.label("This block can be crafted with Ancient Copper Core, Copper Block, Auric Charging Module.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function natureSoulAltar(player) {
	const form = new ActionFormData()
		.title("Nature Soul Altar")
		.label("Nature Soul Altar is a natural block that spawned with Prismarine Arena that appears underwater in the ocean.")
		.label("Try to give it Prismarine Shard, and the fight will begin..")
		.label("This block only found naturally in Prismarine Arena.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function suspiciousCrimsonEye(player) {
	const form = new ActionFormData()
		.title("Suspicious Crimson Eye")
		.label("Suspicious Crimson Eye is a natural block that spawned with Crimson Overgrowth that appears in the Crimson Forest.")
		.label("Try to give it 5 Essence of Crimson, and the fight will begin..")
		.label("This block only found naturally in Crimson Overgrowth.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}
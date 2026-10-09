import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";
import { guideTitle } from "./guidebook_title";

export default function guideItems(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Items"))
		.label("Usable items. Anything not listed here is recipe-only.")
		.button("Auric Communicator", "textures/items/auric_communicator")
		.button("Auric Stock Battery", "textures/items/auric_stock_battery")
		.button("Combat Dummy", "textures/items/dummy")
		.button("Flow Channeler", "textures/items/flow_channeler")
		.button("Hell Charge", "textures/items/hell_charge")
		.button("Suspicious Mushroom", "textures/items/suspicious_mushroom")
		.button("Back")
		.show(player).then(r => {
			if (r.selection === 6 || r.canceled) mainGuideScreen(player);
			if (r.selection === 0) auricCommunicator(player);
			if (r.selection === 1) auricStockBattery(player);
			if (r.selection === 2) combatDummy(player);
			if (r.selection === 3) flowChanneler(player);
			if (r.selection === 4) hellCharge(player);
			if (r.selection === 5) suspiciousMushroom(player);
		})
}

function auricCommunicator(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Auric Communicator"))
		.label("The Auric Communicator calls an Orbital Strike using your Auric Charges.")
		.label("It has 2 modes: Stab Shot for a direct strike, Nuke Shot for a spread strike.")
		.label("Interact to fire. Sneak-interact to switch modes.")
		.label("Drops from the Auric Automaton (Copper Mechanical Array).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function auricStockBattery(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Auric Stock Battery"))
		.label("The Auric Stock Battery recharges your Auric Charges in one click.")
		.label("2 uses. Each restores up to 100 Auric Charges.")
		.label("Interact to use it. When empty, recharge it at an Auric Battery Recharge Station.")
		.label("Craft it with Auric Stars or an Ancient Copper Core plus Copper Blocks. Those come from Trial Chambers. It also drops from the Auric Automaton.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function combatDummy(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Combat Dummy"))
		.label("The Combat Dummy tests your combat skills and max damage output.")
		.label("Place it down and hit it with your best weapon.")
		.label("To pick it up, interact with it while sneaking.")
		.label("This item can be crafted with 2 Planks, 2 Sticks, and 3 Smooth Stone Slabs.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function flowChanneler(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Flow Channeler"))
		.label("The Flow Channeler is Active Support. It dashes you forward, away from enemies.")
		.label("Interact to dash. Enchantable with Mending and Unbreaking.")
		.label("Drops from the Sealed Soul of Nature.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function hellCharge(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Hell Charge"))
		.label("Hell Charge is Active Support. It boosts your mobility.")
		.label("Interact for a mobility boost. Spam interact to fly or fall slowly. Tune your controls to get the most out of it.")
		.label("But it is fragile: long spam breaks it. Enchant with Mending and Unbreaking to make it last.")
		.label("Craft it with Magma Cream and 4 Blaze Powder.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function suspiciousMushroom(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Suspicious Mushroom"))
		.label("The Suspicious Mushroom is Active Support. It slightly boosts all your stats.")
		.label("Eat it for 10 minutes of boosted stats, no side effects.")
		.label("But remember, this item is hard to get, use wisely.")
		.label("Drops from Punicea, the Crimson Eye.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

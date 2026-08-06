import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";

export default function guideItems(player: Player) {
	const form = new ActionFormData()
		.title("Items")
		.label("This is the list of Usable Items, any items that doesn't show up here is an Items that only be used as a recipe")
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
		.title("Auric Communicator")
		.label("Auric Communicator is an item that used to call an Orbital Strike, this item uses your Auric Charges to cast the strike.")
		.label("This item has 2 modes that you can use, one is Stab Shot which can be used to cast a direct strike, the other is Nuke Shot which can be used to call a spread strike.")
		.label("Interact to use it, sneaking with Interact will change the mode of the item.")
		.label("This item can be obtained from Auric Automaton : Copper Mechanical Array.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function auricStockBattery(player: Player) {
	const form = new ActionFormData()
		.title("Auric Stock Battery")
		.label("Auric Stock Battery is an item that used to recharge your Auric Charges quickly by one click.")
		.label("This item can be used up to 2 times recharging your Auric Charges up to 100 per use.")
		.label("Interact to use it, if the charges ran out, put it at Auric Battery Recharge Station.")
		.label("This item can be obtained from Crafting with Auric Stars / Ancient Copper Core with Copper Block, obtained from Trial Chamber, and from Auric Automaton : Copper Mechanical Array.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function combatDummy(player: Player) {
	const form = new ActionFormData()
		.title("Combat Dummy")
		.label("Combat Dummy is an item that can be used to test your combat skills, and testing your maximum damage output.")
		.label("Place it on the ground and try to hit it with your best weapon to test your damage output.")
		.label("To pick it up, interact with it while sneaking.")
		.label("This item can be crafted with 2 Planks, 2 Sticks, and 3 Smooth Stone Slabs.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function flowChanneler(player: Player) {
	const form = new ActionFormData()
		.title("Flow Channeler")
		.label("Flow Channeler is an Active Support item that can be used to dash forward, and evading your enemies.")
		.label("Interact with this item to dash forward, and you can enchant your items with Mending and Unbreaking.")
		.label("This item can be obtained by killing Sealed Soul of Nature.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function hellCharge(player: Player) {
	const form = new ActionFormData()
		.title("Hell Charge")
		.label("Hell Charge is an Active Support item that boosts your mobility by giving you small boost into your movement.")
		.label("Interact with this item to boost your mobility, you can also Spam Interact with this item to make you flying or falling slowly. Use with best control set-up to maximize this item capabilities.")
		.label("But remember, this item is very fragile, long spammed use and your item gone. To prevent this happening, you can enchant your items with Mending and Unbreaking.")
		.label("This item can be crafted with Magma Cream, and 4 Blaze Powder.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

function suspiciousMushroom(player: Player) {
	const form = new ActionFormData()
		.title("Suspicious Mushroom")
		.label("Suspicious Mushroom is an Active Support item that boosts all of your stats minimally.")
		.label("Eat this item to improve your stats without any side effects, Stats will be increased temporarily for 10 minutes.")
		.label("But remember, this item is hard to get, use wisely.")
		.label("This item can be obtained from Punicea : A Crimson Eye.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideItems(player);
		})
}

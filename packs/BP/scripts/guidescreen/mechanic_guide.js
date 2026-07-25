import { ActionFormData } from "@minecraft/server-ui";
import { mainGuideScreen } from "./main_guide";
import { skillUnlock } from "../forms/skillUnlock";

export default function mechanicsList(player) {
	const form = new ActionFormData()
		.title("Mechanics")
		.body("There are the list of the mechanics in Phantasm, starting from the simple one to complex one.")
		.button("Skill Unlock")
		.button("Passive Dash")
		.button("Extra Health")
		.button("Wind Plunge")
		.button("Dynamic Light")
		.button("Legendary Items")
		.button("Upgrading Items")
		.button("Better Mending")
		.button("Accessories")
		.button("Auric Charges")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 10) mainGuideScreen(player);
			if (r.selection == 0) skillUnlockGuide(player);
			if (r.selection == 1) passiveDash(player);
			if (r.selection == 2) extraHealth(player);
			if (r.selection == 3) windPlunge(player);
			if (r.selection == 4) dynamicLighting(player);
			if (r.selection == 5) legendaryItems(player);
			if (r.selection == 6) upgradingItems(player);
			if (r.selection == 7) betterMending(player);
			if (r.selection == 8) accessories(player);
			if (r.selection == 9) auricCharges(player);
		})
}

function skillUnlockGuide(player) { 
	const form = new ActionFormData()
		.title("Unlock Skill")
		.header("Skill Unlocking")
		.divider()
		.label("Skill unlocking is an mechanics to upgrade yourself throughout the progress, you essentially need to upgrade your statistic by unlocking these skill listed in the /unlockskill command!")
		.label("There are 3 Skill / Passive that you need to unlock :\n- Passive Dash\n- Extra health\n- Wind Plunge\nEach of them require 30 Experience levels to upgrade, and they have their own maximum level in the unlocking UI.")
		.divider()
		.button("Unlock Skill")
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 1 || r.cancelled) mainGuideScreen(player);
			if(r.selection == 0) skillUnlock(player)
		})
}

function passiveDash(player) { 
	const form = new ActionFormData()
		.title("Passive Dash")
		.header("Passive Dash")
		.divider()
		.label("This skill able to make you dash forward without any dash item required, this skill is very useful at mobility and some combat style.")
		.label("To use this skill / passive, you need to press Jump while falling.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function extraHealth(player) { 
	const form = new ActionFormData()
		.title("Extra Health")
		.header("Extra Health")
		.divider()
		.label("This passive will grants you additional health, +16 at the first level, +12 at level 2, and higher, this passive is essential for tanking boss / attacks from other players.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function windPlunge(player) { 
	const form = new ActionFormData()
		.title("Wind Plunging")
		.header("Wind Plunge Attack")
		.divider()
		.label("This skill will grants you ability to plunge down quickly while you falling at long distance, significantly reduces the fall damage, and creates an explosion when landing to damages anything.")
		.label("To use this skill / passive, you need to press Sneak while falling over 10 blocks.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function dynamicLighting(player) { 
	const form = new ActionFormData()
		.title("Dynamic Light")
		.header("Phantasm Light System")
		.divider()
		.label("a Mechanic that already exists in some add-ons, but this one is slightly different because you don't need to hold the items to use it")
		.label("To use the mechanic, please put your Light Items into a Hotbar slot with + Sign (Accessories Slot).")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function legendaryItems(player) { 
	const form = new ActionFormData()
		.title("Legendary Items")
		.header("Legendary Mechanics")
		.divider()
		.label("Legendary Tier like Weapons, items, mechanic can be slightly complicated, so how do I use it?")
		.label("To perform an attack, just Left-Click (KBM), or Press Attack to the ground,\nTo use a skill Press Interact / Right Click,\nand for Changing a skill to use in the Legendary Item, just Press Sneak.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function upgradingItems(player) { 
	const form = new ActionFormData()
		.title("Item Upgrade")
		.header("Upgrading Item")
		.divider()
		.label("You can use some items to upgrade yourself such dash ability, health, or damage. You can upgrade yourself permanently or temporarily by using an items.")
		.label("Currently, there are only 3 Items that will upgrade yourself :\n- Auric Star (permanent)\n- Suspicious Mushroom (temporary)\n- Supercharged Copper Axe with Charge Skill (temporary)")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function betterMending(player) { 
	const form = new ActionFormData()
		.title("Better Mending")
		.header("Mending QoL")
		.divider()
		.label("Mending has its own mechanic, while they can repair themselves with exp orb, you can use your stored level to repair the items.")
		.label("To use the second mechanics of mending, you need to Sneak and Use the items, and they will start using your level to repair the items until full durability or you ran out of experience points. To cancel the repairing, just change to other items.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function accessories(player) { 
	const form = new ActionFormData()
		.title("Accessories")
		.header("Accessories")
		.divider()
		.label("This mechanic allow you to use an Accessory Type Items to make yourself stronger by a lot while sacrificing up tp 4 slots of your inventory, you can combine them to create such a perfect build that you'd like.")
		.label("To use an Accessory Item, put the Accessory slot in Offhand Slot, and Hotbar Slots with + Sign.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}

function auricCharges(player) { 
	const form = new ActionFormData()
		.title("Auric Charge")
		.header("Auric Charge")
		.divider()
		.label("This universal charges is used for an ammunition for some Items, collect Auric Charges using Charged Copper Axe, Auric Stock Battery, and Auric Proton to gain some charges.")
		.label("To use it, please use an Items that costs Auric Charge.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.cancelled) mainGuideScreen(player);
		})
}
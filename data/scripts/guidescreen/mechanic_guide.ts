import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";
import { skillUnlock } from "../forms/skillUnlock";
import { guideTitle } from "./guidebook_title";

export default function mechanicsList(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Mechanics"))
		.body("The mechanics in Phantasm, from simplest to most complex.")
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

function skillUnlockGuide(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Unlock Skill"))
		.header("Skill Unlocking")
		.divider()
		.label("Skill Unlock upgrades your stats as you progress. Unlock the skills listed in the /unlockskill command!")
		.label("3 skills to unlock :\n- Passive Dash\n- Extra Health\n- Wind Plunge\nEach costs 30 experience levels per upgrade, up to its own max level in the unlock UI.")
		.divider()
		.button("Unlock Skill")
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 1 || r.canceled) mechanicsList(player);
			if(r.selection == 0) skillUnlock(player)
		})
}

function passiveDash(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Passive Dash"))
		.header("Passive Dash")
		.divider()
		.label("This skill lets you dash forward with no dash item. Useful for mobility and some combat styles.")
		.label("Press Jump while falling to dash. Use /setting if you want a different control (double-tap Jump, Sprint + Jump, or Jump + Sneak).")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function extraHealth(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Extra Health"))
		.header("Extra Health")
		.divider()
		.label("This passive grants bonus health: +16 at level 1, +12 at level 2 and above. Essential for tanking bosses and other players.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function windPlunge(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Wind Plunging"))
		.header("Wind Plunge Attack")
		.divider()
		.label("This skill lets you plunge down fast when falling a long distance. It greatly reduces fall damage and explodes on landing, damaging everything nearby.")
		.label("Sneak while falling more than 10 blocks to plunge.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function dynamicLighting(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Dynamic Light"))
		.header("Phantasm Light System")
		.divider()
		.label("Other add-ons have this mechanic, but here you do not need to hold the light item.")
		.label("Put a light item in a hotbar slot with a + sign (accessory slot).")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function legendaryItems(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Legendary Items"))
		.header("Legendary Mechanics")
		.divider()
		.label("Legendary weapons and items can be complicated. Here is how to use them:")
		.label("Attack: left-click (or tap Attack).\nSkill: Interact / right-click.\nSwitch skill: Sneak.")
		.label("Use /setting to change how you switch skill: Sneak, Sneak + Attack, or Double Sneak.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function upgradingItems(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Item Upgrade"))
		.header("Upgrading Item")
		.divider()
		.label("Some items upgrade your dash, health, or damage, permanently or temporarily.")
		.label("Only 3 items do this :\n- Auric Star (permanent)\n- Suspicious Mushroom (temporary)\n- Supercharged Copper Axe Charge skill (temporary)")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function betterMending(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Better Mending"))
		.header("Mending QoL")
		.divider()
		.label("Mending still repairs with EXP orbs, but you can also spend your stored levels to repair items directly.")
		.label("Sneak and use the item to spend levels on repairs until it is full or you run out of EXP. Switch items to cancel.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function accessories(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Accessories"))
		.header("Accessories")
		.divider()
		.label("Accessories make you much stronger at the cost of up to 4 inventory slots. Combine them into whatever build you like.")
		.label("Put accessories in the offhand slot or hotbar slots with a + sign.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

function auricCharges(player: Player) { 
	const form = new ActionFormData()
		.title(guideTitle("Auric Charge"))
		.header("Auric Charge")
		.divider()
		.label("Auric Charges are universal ammo for some items. Collect them with the Charged Copper Axe, Auric Stock Battery, or Auric Proton.")
		.label("Spend them by using an item that costs Auric Charges.")
		.divider()
		.button("Back")
		.show(player).then(r => {
			if (r.selection == 0 || r.canceled) mechanicsList(player);
		})
}

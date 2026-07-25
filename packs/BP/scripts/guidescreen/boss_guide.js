import { ActionFormData } from "@minecraft/server-ui";
import { mainGuideScreen } from "./main_guide";

export default function guideBosses(player) {
	const form = new ActionFormData()
		.title("Bosses")
		.label("This is the list of Bosses that exist in the add-on, you will face each of these bosses through your progression.")
		.button("Ancient Copper Core")
		.button("Auric Battery Recharge Station")
		.button("Nature Soul Altar")
		.button("Suspicious Crimson Eye")
		.button("Back")
		.show(player).then(r => {
			if (r.selection === 4 || r.canceled) mainGuideScreen(player);
			if (r.selection === 0) soulOfNature(player);
			if (r.selection === 1) puniceaCrimsonEye(player);
			if (r.selection === 2) copperMechanicalArray(player);
		})
}

function soulOfNature(player) {
	const form = new ActionFormData()
		.title("Sealed Soul of Nature")
		.label("Sealed Soul of Nature is a boss that possesses the power of nature, and the prism. this have several deadly attacks that can deplete your oxgen level during fighting.")
		.label("This boss generally have 500 HP and 3 different attack patterns. when reached 70% HP, the boss will spawn more Nature and Prism Crystal assisting the bossfight to make the fight harder.")
		.label("You can summon this boss by interacting Nature Soul Altar in Prismarine Arena located underwater..")
		.label("Defeating this boss ensure that Phantasm journey have just started and you will get a Treasure bag...")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}

function puniceaCrimsonEye(player) {
	const form = new ActionFormData()
		.title("Punicea - A Crimson Eye")
		.label("Punicea is a boss that wield the power of crimson corruption. this have 6 different attacks and very tough Health.")
		.label("This boss generally have 3000 HP and 6 different attack patterns. Each attack patterns are well telegraphed, so the attack will deal more damages, and easier to dodge. Just be careful with your movement.")
		.label("You can summon this boss by interacting Suspicious Crimson Eye in Crimson Overgrowth.")
		.label("Defeating this boss ensure that you learned how to dodge very well, and you will get a Treasure bag...")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}

function copperMechanicalArray(player) {
	const form = new ActionFormData()
		.title("Auric Automaton - Copper Mechanical Array")
		.label("Auric Mechanical Array is a mechanical boss that wield the ultimate power of Auric. this boss have very complicated attack patterns, massive damage, combined with it's great mobility, this boss can obliterate anything easily. Ensure you have Ultimate Gear setup before you fight this abomination.")
		.label("This boss generally have less hp than other end game bosses, 1750 HP and 7 different attack patterns based of how you fight. Each attack patterns are very dangerous to tank, so be more mobile than it. to survive, and kill the boss.")
		.label("You can summon this boss by completing the ritual of Ancient Copper Core.")
		.label("Defeating this boss will drop a Treasure bag, completing the journey of Phantasm, for now... Stay tuned for the next Phantasm Update!")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideBosses(player);
		})
}
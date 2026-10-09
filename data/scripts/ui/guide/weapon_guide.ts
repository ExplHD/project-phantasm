import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide"
import { guideTitle } from "./guidebookTitle";

export default function guideWeapons(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Weapons"))
		.body("Weapons come in many variants, from Common up to Legendary.")
		.button("§3Prismatic Tools", "textures/items/prismatic_sword")
		.button("§5Charged Copper Axe", "textures/items/weapons/charged_copper_axe")
		.button("§5Cruxshaper", "textures/items/weapons/cruxshaper")
		.button("§5Nature Staff", "textures/items/weapons/nature_staff")
		.button("§5Peacemaker Oath", "textures/items/weapons/peacemaker_oath")
		.button("§5Seiketsu", "textures/items/weapons/seiketsu")
		.button("§5Spectric Bow", "textures/items/weapons/spectric_bow")
		.button("§5Thunder Gale", "textures/items/weapons/thunder_gale")
		.button("§pAnimitta", "textures/items/weapons/solaris_verdant")
		.button("§pAuric Photonizer", "textures/items/weapons/auric_photonizer")
		.button("§pPrism Weaver", "textures/items/weapons/prism_weaver")
		.button("§pSupercharged Copper Axe", "textures/items/weapons/supercharged_copper_axe")
		.button("§pThe Bleeding Spire", "textures/items/weapons/the_bleeding_spire")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 13) mainGuideScreen(player);
			if (r.selection == 0) prismaticTools(player);
			if (r.selection == 1) chargedCopperAxe(player);
			if (r.selection == 2) cruxshaper(player);
			if (r.selection == 3) natureStaff(player);
			if (r.selection == 4) peacemakerOath(player);
			if (r.selection == 5) seiketsu(player);
			if (r.selection == 6) spectricBow(player);
			if (r.selection == 7) thunderGale(player);
			if (r.selection == 8) animitta(player);
			if (r.selection == 9) auricPhotonizer(player);
			if (r.selection == 10) prismWeaver(player);
			if (r.selection == 11) superchargedCopperAxe(player);
			if (r.selection == 12) theBleedingSpire(player);
		})
}

function prismaticTools(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Prismatic Tools"))
		.label("Prismatic is a tier beyond Netherite: slightly faster, with twice the durability.")
		.label("The sword's special attack pierces through an area, but it cannot crit.")
		.label("The spear can dismount enemies with a sprint-jump charge attack.")
		.label("Craft Prismatic Tools with Prismatic Ingots and Netherite Tools.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function chargedCopperAxe(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Charged Copper Axe"))
		.label("This Epic axe hits opponents with Lightning attacks. Collect charges before combat.")
		.label("At full charge, hitting an enemy casts Lightning at them.")
		.label("Killing an enemy casts another Lightning strike and grants 4 Auric Charges.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function cruxshaper(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Cruxshaper"))
		.label("This mace works like a vanilla mace, plus skills.")
		.label("Look at the sky to use the skill. You jump high, then plunge down for up to 50 damage.")
		.label("Craft it like a mace, with a Blaze Rod added to the recipe.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function natureStaff(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Nature Staff"))
		.label("This staff casts the same magic attacks as the Soul of Nature boss.")
		.label("Interact to cast the first attack. Sneak-interact for the second attack, which has a slightly longer cooldown.")
		.label("Craft it with Prismatic Ingots, a Stick, and a Nautilus Shell.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function peacemakerOath(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Peacemaker Oath"))
		.label("A pistol that fires Auric Charges. High damage and high attack speed.")
		.label("It has no unique skill or passive because it is already strong, especially with the Auric Proton accessory.")
		.label("Find it in Trial Chambers, same as the Auric Proton.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function seiketsu(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Seiketsu"))
		.label("A katana with Legendary-style attack patterns. Easier to use than any Epic weapon.")
		.label("Its parry window is longer than a regular sword's.")
		.label("Craft it with a Prismatic Sword, a Blaze Rod, and a Netherite Sword.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function spectricBow(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Spectric Bow"))
		.label("A bow that beats every Epic weapon in damage and range. Arrow speed scales with charge stage, up to 70 damage.")
		.label("Works with normal arrows, but best with Spectral Arrows, crafted from 4 Glowstone Dust and 1 Arrow.")
		.label("Craft it with Iron Ingot, Whole Glowstone, and String.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function thunderGale(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Thunder Gale"))
		.label("A classic but powerful spear, and the strongest of its kind: 14 base damage, a 1.6x charge attack multiplier, and a very fast cooldown.")
		.label("It also grants bonus speed while equipped.")
		.label("Craft it with a Prismatic Spear, a Nether Star, and a Netherite Spear.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function animitta(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Animitta"))
		.label("One of the first Legendary weapons you can get, alongside the Prism Weaver. It fights at close, medium, and long range, with slightly lower damage than other Legendary weapons. It has 3 skills:")
		.label("Animirra :\nSummons 4 stars that attack nearby entities.")
		.label("Solaris Slash :\nFires 3 Solaris Slashes spreading outward.")
		.label("Natura Vulkan :\nSummons 8 special stars that explode on enemies with small but powerful blasts, alongside a Meteor Rain.")
		.label("Drops from the Soul of Nature at 50% chance, alternating with the Prism Weaver (50/50).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function prismWeaver(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Prism Weaver"))
		.label("One of the first Legendary weapons you can get, alongside the Animitta. It fights at long range with lower damage than other Legendary weapons. It has 3 skills:")
		.label("Bubble Barrage :\nFires a burst of bubble projectiles in one attack.")
		.label("Prism Wave Wall :\nCasts a Prism Wall that deals massive damage on touch.")
		.label("Vortex Prism :\nPulls targets in a large radius toward you, then repels them with massive damage.")
		.label("Drops from the Soul of Nature at 50% chance, alternating with the Animitta (50/50).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function theBleedingSpire(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("The Bleeding Spire"))
		.label("This Legendary spear fights polearm-style at close range. It is a support weapon, so it holds back on damage. It has 3 skills:")
		.label("Carnage :\nDash forward. Mobs you collide with take damage.")
		.label("Entanglement :\nLeash your target with Crimson Roots, stunning it for 5 seconds and restoring 12 health.")
		.label("Crimson Ray :\nLike Entanglement, but fires many Crimson Rays in scattered directions.")
		.label("Drops from Punicea.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function superchargedCopperAxe(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Supercharged Copper Axe"))
		.label("This Legendary axe, forged from high-grade Copper and Auric material, hits very hard but swings very slowly, with lightning bolts on a completed attack pattern. It has 4 skills:")
		.label("Charge :\nGrants 5 Charges for your other skills and briefly boosts your damage.")
		.label("Powered Leap :\nCreates an explosion that damages everything except you and leaps you toward your target. Grants 1 Charge.")
		.label("Discharge :\nSpends your charges to fire an Auric Laser forward. Direct hits deal heavy damage.")
		.label("Ultimate Discharge :\nA stronger Discharge, combined with medium-range lightning covering close and medium range.")
		.label("Drops from the Auric Automaton at 50% chance, alternating with the Auric Photonizer (50/50).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function auricPhotonizer(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Auric Photonizer"))
		.label("This Legendary sword, forged from high-grade Copper and Auric material, swings very fast. It has 4 skills:")
		.label("Stab :\nDash-stab forward. Mobs you collide with take heavy damage.")
		.label("Powered Leap :\nLeap backward to dodge, leaving an explosion after a short delay that deals heavy damage.")
		.label("Blade Barrage :\nSummons 5 Auric Double Blades that fly toward you, heavily damaging anything else in the way.")
		.label("Ethereal Blade :\nSummons 3 waves of Ethereal Swords stabbing in random directions for heavy damage. You can keep moving while it fires.")
		.label("Drops from the Auric Automaton at 50% chance, alternating with the Supercharged Copper Axe (50/50).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

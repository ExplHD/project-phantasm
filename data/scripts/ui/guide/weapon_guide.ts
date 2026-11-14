import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide"
import { guideTitle } from "./guidebookTitle";

export default function guideWeapons(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Weapons"))
		.body("Weapons come in many variants, from Common up to Legendary.")
		.button("§3Prismatic Tools", "textures/items/prismatic_sword")
		.button("§5Xeon Plasm Tools", "textures/items/xeon_plasm_sword")
		.button("§5Aethel Synapse")
		.button("§5Charged Copper Axe", "textures/items/weapons/charged_copper_axe")
		.button("§5Cruxshaper", "textures/items/weapons/cruxshaper")
		.button("§5Nature Staff", "textures/items/weapons/nature_staff")
		.button("§5Peacemaker Oath", "textures/items/weapons/peacemaker_oath")
		.button("§5Rupture Blade")
		.button("§5Seiketsu", "textures/items/weapons/seiketsu")
		.button("§5Spectric Bow", "textures/items/weapons/spectric_bow")
		.button("§5Thunder Gale", "textures/items/weapons/thunder_gale")
		.button("§pAnimitta", "textures/items/weapons/solaris_verdant")
		.button("§pAuric Photonizer", "textures/items/weapons/auric_photonizer")
		.button("§pInterpolaris")
		.button("§pInterstellaris")
		.button("§pPrism Weaver", "textures/items/weapons/prism_weaver")
		.button("§pSupercharged Copper Axe", "textures/items/weapons/supercharged_copper_axe")
		.button("§pThe Bleeding Spire", "textures/items/weapons/the_bleeding_spire")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 18) mainGuideScreen(player);
			if (r.selection == 0) prismaticTools(player);
			if (r.selection == 1) xeonPlasmTools(player);
			if (r.selection == 2) aethelSynapse(player);
			if (r.selection == 3) chargedCopperAxe(player);
			if (r.selection == 4) cruxshaper(player);
			if (r.selection == 5) natureStaff(player);
			if (r.selection == 6) peacemakerOath(player);
			if (r.selection == 7) ruptureBlade(player);
			if (r.selection == 8) seiketsu(player);
			if (r.selection == 9) spectricBow(player);
			if (r.selection == 10) thunderGale(player);
			if (r.selection == 11) animitta(player);
			if (r.selection == 12) auricPhotonizer(player);
			if (r.selection == 13) interpolaris(player);
			if (r.selection == 14) interstellaris(player);
			if (r.selection == 15) prismWeaver(player);
			if (r.selection == 16) superchargedCopperAxe(player);
			if (r.selection == 17) theBleedingSpire(player);
		})
}

function prismaticTools(player: Player): void {
	new ActionFormData()
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

function xeonPlasmTools(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Xeon Plasm Tools"))
		.label("Xeon Plasm is a tier beyond Prismatic: twice the damage, durability, and mining speed.")
		.label("The sword and spear work like their Prismatic versions.")
		.label("Repair them with Xeonnite Cubes or Plasmoid Scrap.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function aethelSynapse(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Aethel Synapse"))
		.label("Two floating blades held in place by an Auric core.")
		.label("Hold Interact to spin the blades in front of you like a propeller. It blocks hits from the front and never costs durability. Every 2 damage blocked costs 1 Auric Charge, and with too little charge the hit goes through.")
		.label("In the offhand the blades disappear and the core floats beside your left side. When you hit something, the core fires a laser at it half a second later for 6 damage and gives you 3 Auric Charge. The laser has a 3 second cooldown.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function chargedCopperAxe(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Charged Copper Axe"))
		.label("This Epic axe hits opponents with Lightning attacks. Collect charges before combat.")
		.label("At full charge, hitting an enemy casts Lightning at them.")
		.label("Killing an enemy casts another Lightning strike and grants 4 Auric Charges.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function cruxshaper(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Cruxshaper"))
		.label("This mace works like a vanilla mace, plus skills.")
		.label("Look at the sky to use the skill. You jump high, then plunge down for up to 50 damage.")
		.label("Craft it like a mace, with a Blaze Rod added to the recipe.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function natureStaff(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Nature Staff"))
		.label("This staff casts the same magic attacks as the Soul of Nature boss.")
		.label("Interact to cast the first attack. Sneak-interact for the second attack, which has a slightly longer cooldown.")
		.label("Mana :\n24 per shot, 60 for the sneak attack.")
		.label("Craft it with Prismatic Ingots, a Stick, and a Nautilus Shell.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function peacemakerOath(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Peacemaker Oath"))
		.label("A pistol that fires Auric Charges. High damage and high attack speed.")
		.label("It has no unique skill or passive because it is already strong, especially with the Auric Proton accessory.")
		.label("Find it in Trial Chambers, same as the Auric Proton.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function ruptureBlade(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Rupture Blade"))
		.label("A heavy sword that swings like the Supercharged Copper Axe. The 4th hit of the combo strikes the area two more times.")
		.label("Interact for a 700ms parry, or Sneak for the regular 400ms one. Each parry costs 1 durability.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function seiketsu(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Seiketsu"))
		.label("A katana with Legendary-style attack patterns. Easier to use than any Epic weapon.")
		.label("Its parry window is longer than a regular sword's.")
		.label("Craft it with a Prismatic Sword, a Blaze Rod, and a Netherite Sword.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function spectricBow(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Spectric Bow"))
		.label("A bow that beats every Epic weapon in damage and range. Arrow speed scales with charge stage, up to 70 damage.")
		.label("Works with normal arrows, but best with Spectral Arrows, crafted from 4 Glowstone Dust and 1 Arrow.")
		.label("Craft it with Iron Ingot, Whole Glowstone, and String.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function thunderGale(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Thunder Gale"))
		.label("A classic but powerful spear, and the strongest of its kind: 14 base damage, a 1.6x charge attack multiplier, and a very fast cooldown.")
		.label("It also grants bonus speed while equipped.")
		.label("Craft it with a Prismatic Spear, a Nether Star, and a Netherite Spear.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function animitta(player: Player): void {
	new ActionFormData()
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

function prismWeaver(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Prism Weaver"))
		.label("One of the first Legendary weapons you can get, alongside the Animitta. It fights at long range with lower damage than other Legendary weapons. Attacks fire prism bolts at your crosshair that curve slightly onto the target you aim at; every third attack fans out three piercing bolts. It has 3 skills:")
		.label("Bubble Barrage :\nFires a burst of bubble projectiles in one attack.")
		.label("Prism Wave Wall :\nCasts a Prism Wall that deals massive damage on touch.")
		.label("Vortex Prism :\nPulls targets in a large radius toward you, then repels them with massive damage.")
		.label("Mana :\nAbout 20 per attack. 60 for Bubble Barrage or Prism Wave Wall, 150 for Vortex Prism.")
		.label("Drops from the Soul of Nature at 50% chance, alternating with the Animitta (50/50).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function theBleedingSpire(player: Player): void {
	new ActionFormData()
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

function superchargedCopperAxe(player: Player): void {
	new ActionFormData()
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

function auricPhotonizer(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Auric Photonizer"))
		.label("This Legendary sword, forged from high-grade Copper and Auric material, swings very fast. It has 4 skills:")
		.label("Stab :\nDash-stab forward. Mobs you collide with take heavy damage.")
		.label("Powered Leap :\nLeap backward to dodge, leaving an explosion after a short delay that deals heavy damage.")
		.label("Blade Barrage :\nThrows 3 Auric Double Blades in a fan 12 blocks ahead, then calls them back. An enemy takes 40 damage on the way out and 40 more on the return, and the returning blades knock it toward you. 20 second cooldown.")
		.label("Ethereal Blade :\nLocks onto the enemy you are looking at, or the nearest one within 12 blocks. 3 rings of 8 Ethereal Swords appear around it, slow everything inside and stab inward 1 second later. The first two rings deal 35 damage in 6.5 blocks and the third deals 70. The rings follow the target and you can keep moving and attacking. 40 second cooldown.")
		.label("Drops from the Auric Automaton at 50% chance, alternating with the Supercharged Copper Axe (50/50).")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function interpolaris(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Interpolaris"))
		.label("This Legendary catalyst casts every 0.7 to 0.8 seconds. You do not aim. Each cast hits the enemy closest to your crosshair, or the nearest one if nobody is in front of you. Attacks 1 to 3 reach 12 blocks and deal 23 to 24 damage in a 2 block splash. Attack 4 reaches 20 blocks and drops a purple blade on the target for 30 damage in 4 blocks.")
		.label("Polar Noise :\nEvery enemy hit by attacks 1 to 4 is marked for 10 seconds. The mark deals no damage. The two skills below need it.")
		.label("Polaris Influence :\nEvery marked enemy takes 20 damage over 3 seconds and Slowness II. Marked players also get a flickering screen for those 3 seconds. Needs at least 1 marked enemy. 10 second cooldown.")
		.label("Shroud Step :\nYou teleport behind one marked enemy and its mark is removed. You and the enemy are frozen for 1 second. Half a second in, a laser hits it for 50 damage. Needs a marked enemy within 48 blocks. 3 second cooldown.")
		.label("Interpolarity :\nYou rise 5 blocks and hover in place. You cannot move, but you can still aim. For 5 seconds a laser fires where you look every 4 ticks, 25 in total, from six points around you. Each laser deals 35 damage. A laser locks onto an enemy within 15 degrees of your crosshair if one is in sight. Wherever a laser lands, on an enemy or a block, it explodes for 35 damage in 4 blocks. 60 second cooldown.")
		.label("Mana :\nAbout 20 per attack, 40 on attack 4. 50 for Polaris Influence, 40 for Shroud Step, 120 for Interpolarity.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

function interstellaris(player: Player): void {
	new ActionFormData()
		.title(guideTitle("Interstellaris"))
		.label("This Legendary longsword swings every 0.5 to 0.6 seconds for about 28 damage. Attacks 1 to 3 reach 5 blocks. On attack 4 the blade leaves the hilt, slides out to the edge of the slash and sweeps a full circle with a 10 block reach.")
		.label("Stellaris Core :\nEvery enemy hit by attacks 1 to 4 spawns a Stellaris Core at a random spot within 10 blocks of you. You can hold 7. A core older than 7 seconds explodes for 7 damage in 3 blocks, and so does the oldest core when an 8th appears. Cores that explode together stack their damage.")
		.label("Stellaris Forcefield :\nSpends 1 to 4 cores for a shield that absorbs 30 damage per core, up to 120, for 15 seconds. No cooldown, but you cannot recast it while the shield is up.")
		.label("Interstellar Vow :\nTurns every core into a homing Interstellar Missile. Each one explodes for 32 damage in 5 blocks. An enemy takes that damage once per cast, however many missiles reach it. 12 second cooldown.")
		.label("Stellar Voyager :\nNeeds at least 5 cores. You teleport to each core and slash for 20 damage, then plant the sword. The final blast covers 7 blocks and deals 30 damage for every core you spent. 30 second cooldown.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) guideWeapons(player);
		})
}

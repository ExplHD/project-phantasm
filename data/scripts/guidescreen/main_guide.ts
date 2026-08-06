import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { world, system } from "@minecraft/server";
import { unstuckPlayer } from "../main";

import guideWeapons from "./weapon_guide";
import mechanicsList from "./mechanic_guide";
import guideItems from "./item_guide";
import guideBlocks from "./block_guide";
import guideBosses from "./boss_guide";
import guideAccessories from "./accessories_guide";
import guideEnemies from "./enemies_guide";

export function mainGuideScreen(player: Player) {
	const form = new ActionFormData()
		.title("Guide")
		.header("Phantasm Guide")
		.divider()
		.label(
			"Phantasm is an add-on that adds a lot of content into your world: new weapons, mechanics, enemies, and bosses. This add-on is updated regularly, so stay tuned for the next content!",
		)
		.label("New to the add-on? Click Getting Started below to learn where to begin!")
		.divider()
		.button("Getting Started")
		.button("Mechanics", "textures/ui/speed_effect")
		.button("Weapons", "textures/items/diamond_sword")
		.button("Items", "textures/items/essence_of_crimson")
		.button("Blocks", "textures/blocks/stonebrick_carved")
		.button("Accessories", "textures/items/fire_bracelet")
		.button("Bosses", "textures/items/the_crimson_watcher")
		.button("Enemies", "textures/items/egg_zombie")
		.divider()
		.button("Changelogs")
		.button("Contact the Developer!")
		.divider()
		.label(
			"Are you stuck? You can press this button to unstuck yourself, or use /unstuck command. Sometimes, minecraft can be really bugged with inputpermission so I add these button and command for that reason.",
		)
		.button("Unstuck (reset some effects and tags)")
		.divider()
		.button("Exit")
		.show(player)
		.then((r) => {
			if (r.canceled) player.sendMessage("§eYou can use /guide to check the guide or list of features in Phantasm!");
			if (r.selection == 0) gettingStarted(player);
			if (r.selection == 1) mechanicsList(player);
			if (r.selection == 2) guideWeapons(player);
			if (r.selection == 3) guideItems(player);
			if (r.selection == 4) guideBlocks(player);
			if (r.selection == 5) guideAccessories(player);
			if (r.selection == 6) guideBosses(player);
			if (r.selection == 7) guideEnemies(player);
			if (r.selection == 8) Changelogs(player);
			if (r.selection == 9) developer(player);
			if (r.selection == 10) unstuckPlayer(player);
		});
}

export function gettingStarted(player: Player) {
	const form = new ActionFormData()
		.title("Getting Started")
		.header("Where to begin?")
		.divider()
		.header("Early Game — Mining")
		.label("- Mine ores to get a chance at the Rusted Fortune Coin and Item Magnet Ore (1% chance per ore).")
		.label("- Use /unlockskill to upgrade your passive abilities: Passive Dash, Extra Health, and Wind Plunge.")
		.divider()
		.header("Mid Game — Exploration")
		.label("- Explore Trial Chambers to find the Ancient Copper Core, Auric Proton, and the Peacemaker Oath.")
		.label("- Visit the Crimson Forest: fight Crimson Tentacles for Essence of Crimson, and locate the Crimson Overgrowth.")
		.divider()
		.header("Bosses — Your Progression")
		.label("1. Sealed Soul of Nature (Prismarine Arena, underwater) — your first boss, drops Prismatic Ingots and a treasure bag (Animitta / Prism Weaver).")
		.label("2. Punicea : A Crimson Eye (Crimson Overgrowth) — drops The Bleeding Spire and Suspicious Mushroom.")
		.label("3. Auric Automaton : Copper Mechanical Array (Ancient Copper Core ritual) — the final boss, drops Supercharged Copper Axe / Auric Photonizer.")
		.divider()
		.button("Back")
		.show(player)
		.then((r) => {
			if (r.selection == 0 || r.canceled) mainGuideScreen(player);
		});
}

export function Changelogs(player: Player) {
	const form = new ActionFormData()
		.title("Changelogs")
		.header("v1.5.0")
		.divider()
		.header("Removal")
		.label("- Removed the Glyph System, but you can still use the glyphs available in Phantasm - ExplerHD")
		.label("- Removed the mining functionality from Legendary Weapons, as they were never designed for that purpose - ExplerHD")
		.label("- Removed the Direct Hit feature from Legendary Weapons and Seiketsu - ExplerHD")
		.divider()
		.header("Changes")
		.label("= Refactored the Custom Mace system - ExplerHD")
		.label("= Reworked the Damage Indicator system to use Runtime Particles - ExplerHD")
		.label("= Changed Prism Boss Arena from fixed ground positions to locatable underwater structures - ExplerHD")
		.label("= Updated the Soul of Nature boss fight to follow the new structure generation (underwater boss fight) - ExplerHD")
		.label("= Adjusted the placement of the Crimson Overgrowth structure to make it more logical and visible - ExplerHD")
		.label("= Increased Seiketsu damage by +4 - ExplerHD")
		.label("= Slightly updated the visuals of The Bleeding Spire attack - ExplerHD")
		.label("= Rebalanced the damage of all Legendary Weapons so they can compete with enchanted Epic Weapons - ExplerHD")
		.label("= Made Soul of Nature, Punicea, and Auric Automaton have 500 HP, 3000 HP, and 1750 HP due to Recent Weapons changes. - ExplerHD")
		.label("= Added support for Fire Aspect, Knockback, and Weakness on Legendary Weapons - ExplerHD")
		.label("= Updated all Legendary Weapons so their attack patterns now loop continuously without an ending cooldown - ExplerHD")
		.label('= Fixed a bug where upgrading Dash to Level 2 would display "Insufficient Experience Level" instead of "Maximum level of Dash is reached." - ExplerHD',)
		.divider()
		.header("Addition")
		.label("+ Added the `damage_number` and `damage_icons` particles - ExplerHD")
		.label("+ Added the Better than Mending feature - ExplerHD")
		.label("+ Added a Combat Dummy - ExplerHD")
		.label("+ Added a Turtle Shell item to the Prismarine Boss Arena to make the boss fight in that arena easier - ExplerHD")
		.label("+ Added Rusted Fortune Coin, which doubles ore drops, and the Item Magnet Ore. Both can be obtained from a 1% chance when mining any ore - Passive Type - ExplerHD",)
		.label("+ Added Condensed Sea Nature, providing much longer underwater breathing and slightly faster health regeneration while underwater - Passive Type - ExplerHD",)
		.label("+ Added Guidescreen - ExplerHD & ZeroMaster178")
		.divider()
		.label("Stay tuned for the next content update!")
		.button("Back")
		.show(player)
		.then((r) => {
			if (r.selection == 0) mainGuideScreen(player);
		});
}

export function developer(player: Player) {
	const form = new ActionFormData()
		.title("Developer Contact")
		.header("Contact Us!")
		
		.divider()
		.label("ExplerHD\nGitHub : ExplHD\nDiscord : explerhd\nYoutube : ExplerHD (@ExplHD)\nMCPEDL : ExplerHD\nCurseforge : ExplerHD")
		.label("ZeroMaster178\nInstagram : zeromaster_178\nMCPEDL : Zeromaster 178\nCurseforge : Zeromaster178\nTiktok : Zeromaster_178\nYoutube : zeromaster178\nDiscord : zeromaster178")
		.divider()
		.button("Back")
		.show(player)
		.then((r) => {
			if (r.selection == 0) mainGuideScreen(player);
		});
}

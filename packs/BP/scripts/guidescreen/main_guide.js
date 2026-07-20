import { ActionFormData } from '@minecraft/server-ui'
import { world, system } from '@minecraft/server'

import { guideWeapons } from './weapon_guide';
import { mechanicsList } from './mechanic_guide';

export function mainGuideScreen(player) {
	const form = new ActionFormData()
		.title("Guide")
		.header("Phantasm 1.5 Guide")
		.divider()
		.label("Phantasm is an add-on that adds a lot of content into your world, currently this add-on is updated regularly, so stay tuned for the next content that I will add. In this add-on, there's new weapons, new mechanics, new enemies, boss, and everything.")
		.label("Click the button below to see the content of Phantasm!")
		.divider()
		// ========================================
		// Untuk Divider ini, please buat dia menuju file baru seperti yang ada di contoh!
		// ========================================
		.button("Mechanics", "textures/ui/speed") // Done
		.button("Weapons", "textures/items/diamond_sword") // Done
		.button("Items", "textures/items/essence_of_crimson") // OTW
		.button("Blocks", "textures/items/essence_of_crimson") // OTW
		.button("Accessories", "textures/items/fire_bracelet") // ZeroMaster178
		.button("Structures", "textures/blocks/chest") // ZeroMaster178
		.button("Bosses", "textures/items/the_crimson_watcher") // OTW
		.button("Enemies", "textures/items/zombie_spawn_egg") // ZeroMaster178
		.divider()
		.button("Changelogs") // Done
		.button("Contact the Developer!") // ZeroMaster178, create it at this file
		.button("Exit")
		.show(player).then(r => { 
			if (r.canceled) player.sendMessage("§eYou can use /guide to check the guide or list of features in Phantasm!");
			if (r.selection == 0) mechanicsList(player);
			if (r.selection == 1) guideWeapons(player);
			if (r.selection == 2) guideItems(player);
			if (r.selection == 3) guideBlocks(player);
			if (r.selection == 4) guideAccessories(player);
			if (r.selection == 5) guideStructures(player);
			if (r.selection == 6) guideBosses(player);
			if (r.selection == 7) guideEnemies(player);
			if (r.selection == 8) Changelogs(player);
			if (r.selection == 9) developer(player);
		})
}

export function Changelogs(player) {
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
		.label("= Made Soul of Nature, Punicea, and Auric Automaton have 650 HP, 3000 HP, and 1750 HP due to Recent Weapons changes. - ExplerHD")
		.label("= Added support for Fire Aspect, Knockback, and Weakness on Legendary Weapons - ExplerHD")
		.label("= Updated all Legendary Weapons so their attack patterns now loop continuously without an ending cooldown - ExplerHD")
		.label('= Fixed a bug where upgrading Dash to Level 2 would display "Insufficient Experience Level" instead of "Maximum level of Dash is reached." - ExplerHD')
		.divider()
		.header("Addition")
		.label("+ Added the `damage_number` and `damage_icons` particles - ExplerHD")
		.label("+ Added the Better than Mending feature - ExplerHD")
		.label("+ Added a Combat Dummy - ExplerHD")
		.label("+ Added a Turtle Shell item to the Prismarine Boss Arena to make the boss fight in that arena easier - ExplerHD")
		.label("+ Added Rusted Fortune Coin, which doubles ore drops, and the Item Magnet Ore. Both can be obtained from a 1% chance when mining any ore - Passive Type - ExplerHD")
		.label("+ Added Condensed Sea Nature, providing much longer underwater breathing and slightly faster health regeneration while underwater - Passive Type - ExplerHD")
		.label("+ Added Guidescreen - ExplerHD & ZeroMaster178")
		.divider()
		.label("Stay tuned for the next content update!")
		.button("Back")
		.show(player).then(r => {
			if(r.selection == 0) mainGuideScreen(player)
		})
}
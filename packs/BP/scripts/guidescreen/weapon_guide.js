import { ActionFormData } from "@minecraft/server-ui";
import { mainGuideScreen } from "./main_guide"

export default function guideWeapons(player) {
	const form = new ActionFormData()
		.title("Weapons")
		.body("There are many variations of the weapons, starting from Common ones, until Legendary one.")
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

function prismaticTools(player) {
	const form = new ActionFormData()
		.title("Prismatic Tools")
		.label("Prismatic Tools Tier is an Tier beyond Netherite, much better than Netherite Tier, slightly faster than Netherite tier, having 2 times the durability of Netherite Tier as their main perks of this Tier.")
		.label("The sword has their special unique attack that makes the weapons capable of doing area piercing attack, but it cannot crits.")
		.label("and The spear has it's own special perks that you can Dismount your enemies by just using charge attack with sprint jumping.")
		.label("Prismatic Tools can be crafted with Prismatic Ingot, and Netherite Tools.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function chargedCopperAxe(player) {
	const form = new ActionFormData()
		.title("Charged Copper Axe")
		.label("This axe weapons is an Epic Weapon, designed for striking your opponents with Lightning Attacks that you collect the charge before combat.")
		.label("The Charge passive is used when the charge is fully charged, when you hit enemies with full charge, you can cast a Lightning Attacks to their enemies.")
		.label("and when the enemies died, you will cast additional Lightning Attack, and adding 4 Auric Charges for you.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function cruxshaper(player) {
	const form = new ActionFormData()
		.title("Cruxshaper")
		.label("This mace weapon just function like mace, but it gets better with the skills.")
		.label("Look up to the skies to use the skill, you will jump really high, and then finally performs a plunge attack that deals up to 50 damage.")
		.label("You can get this weapon same as mace, but with additional of Blaze Rod to the recipe.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function natureStaff(player) {
	const form = new ActionFormData()
		.title("Nature Staff")
		.label("This staff can use magic attacks that is same as Soul of Nature boss")
		.label("You can interact to cast the first magic attack, while sneaking you can cast the second magic attack, with slightly longer cooldown")
		.label("This weapon crafted with Prismatic Ingot, Stick, and Nautilus Shell")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function peacemakerOath(player) {
	const form = new ActionFormData()
		.title("Peacemaker Oath")
		.label("a Pistol that uses Auric Charges as their main bullet, capable of doing high damage and high attack speed with this weapon.")
		.label("This weapon does not have a unique skill or passive because this weapon is already overpowered, with the Auric Proton Accessory.")
		.label("You can get this weapon at Trial Chamber, same as Auric Proton.")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function seiketsu(player) {
	const form = new ActionFormData()
		.title("Seiketsu")
		.label("a Katana that can performs an Attack Patterns like Legendary Tier, beating every epic weapons in the easier usage")
		.label("Also with this weapon, you can perform a parry with longer window, different than regular sword")
		.label("The katana crafted with Prismatic Sword, Blaze Rod, and Netherite Sword")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function spectricBow(player) {
	const form = new ActionFormData()
		.title("Seiketsu")
		.label("a Bow that beats every Epic weapons in terms of Damage, and Range, The projectile speed is very fast depends on Charging Stage and have ridicilous damage up to 70 damage")
		.label("You can use this bow normally, but best used with Spectral Arrow, crafted with 4 Glowstone Dust and 1 Arrow")
		.label("This bow crafted with Iron Ingot, Whole Glowstone, and String")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function thunderGale(player) {
	const form = new ActionFormData()
		.title("Seiketsu")
		.label("This Spear weapons is the classic, but powerful one, being the Strongest Spear, dealing over 1.6x multiplier on Charge Attack, 14 Base Damage, and very fast Spear Cooldown")
		.label("This weapon only provides you with speeds when equipping this weapon")
		.label("This Spear crafted with Prismatic Spear, Nether Star, and Netherite Spear")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function animitta(player) {
	const form = new ActionFormData()
		.title("Animitta")
		.label("This is the first legendary weapons you will obtain alongside the Prism Weaver, This weapon capable of doing close, medium, and long range attacks with slightly lower damage than other Legendary Weapons. This weapon have 3 skills :")
		.label("Animirra :\nCreates 4 Stars summon that will attacks other entities, this skill alone is powerful, but you never realized it.")
		.label("Solaris Slash :\nDoes an attack that creates 3 Solaris Slash, spreading in each direction.")
		.label("Natura Vulkan :\nSummons 8 Special Stars summons, that will explode at enemies with small distance explosion, but very powerful, alongside of casting a Meteor Rain.")
		.label("This weapon obtained from killing Soul of Nature with 50% change alongside with Prism Weaver, a 50/50 between those two weapons")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function prismWeaver(player) {
	const form = new ActionFormData()
		.title("Animitta")
		.label("This is the first legendary weapons you will obtain alongside the Animitta, This weapon capable of doing long range attacks with low damage than other Legendary Weapons. This weapon have 3 skills :")
		.label("Bubble Barrage :\nCasts a bursts of bubble projectiles in one attacks.")
		.label("Prism Wave Wall :\nCasts a Prism Wall that deals massive damage when someone touches it.")
		.label("Vortex Prism :\nPulls the target in large radius to you, and then repel them with massive damage.")
		.label("This weapon obtained from killing Soul of Nature with 50% change alongside with Animitta, a 50/50 between those two weapons")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function theBleedingSpire(player) {
	const form = new ActionFormData()
		.title("The Bleeding Spire")
		.label("This Legendary Spear does a polearm like attack with close distance, this weapon meant to be a support so that will not too powerful to destroy your target. This weapon have 3 skills :")
		.label("Carnage :\nDash forward with this weapons, any mob collided with you will deal some damage.")
		.label("Entanglement :\nLeash your target with Crimson Roots, making them stunned (literal stun) for 5 seconds, and giving you over 12 Health Points")
		.label("Crimson Ray :\nDoes the same thing as Entanglement, but, you will cast a lot of Crimson Ray, shot in scattered directions.")
		.label("This weapon obtained from killing Punicea")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function superchargedCopperAxe(player) {
	const form = new ActionFormData()
		.title("Supercharged Copper Axe")
		.label("This Legendary Axe, forged through the High-Grade Copper and Auric Material, is very powerful compared to other weapons, whis weapons have very slow attack speed but has lightning bolt attacks when completing the attack pattern. This weapon have 4 skills :")
		.label("Charge :\nGrants 5 Charges for your 2 skills, and Boost yourself temporarily, giving you a lot of extra damage when you attacking a mob.")
		.label("Powered Leap :\nCreates an explosion that deals high damage for others than you to make you leap forward to your target, also giving you 1 Charge for your other skills.")
		.label("Discharge :\nDischarge your collected charge, and cast a Auric Laser that moves in their direction, hitting a target will gives them a lot of damage.")
		.label("Ultimate Discharge :\nDoes the same thing with Discharge, but it's more powerful, and combined with medium-range lightning attacks that covers both close and medium range.")
		.label("This weapon obtained from killing Auric Automaton with 50% change alongside with Auric Photonizer, a 50/50 between those two weapons")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}

function auricPhotonizer(player) {
	const form = new ActionFormData()
		.title("Animitta")
		.label("This Legendary Sword, forged through the High-Grade Copper and Auric Material, is powerful compared to other weapons, whis weapons have very fast attack speed. This weapon have 4 skills :")
		.label("Stab :\nDash and Stab forward with this weapons, any mob collided with you will deal a lot damage.")
		.label("Powered Leap :\nLeaps backward to dodge your opponents, creates an explosion after short delay that deals a lot damage")
		.label("Blade Barrage :\nSummon 5 Auric Double Blade, moving towards you, anyone other than you will deals a lot of damage")
		.label("Ethereal Blade :\nSummon 3 sequence of a lot of Ethereal Sword stabbing in random direction dealing a lot of damage, you can still move while the skill is activated")
		.label("This weapon obtained from killing Auric Automaton with 50% change alongside with Auric Photonizer, a 50/50 between those two weapons")
		.button("Back")
		.show(player).then(r => {
			if (r.canceled || r.selection == 0) mainGuideScreen(player);
		})
}
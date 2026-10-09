import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";
import { guideTitle } from "./guidebook_title";

export default function guideAccessories(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Accessories"))
		.label("Every accessory explains its own effect in its item description, so hover over the item to read what it does!")
		.divider()
		.label("Accessories are items that support you in combat and beyond. Find them anywhere: mining, looting structures, even boss fights.")
		.divider()
		.label("Two types:")
		.label("Active accessories :\nThey have both a passive effect and an interact use. Keep them in a hotbar slot with a plus sign.")
		.label("Passive accessories :\nPassive effect only. Best in the offhand slot, but a plus-sign hotbar slot works too.")
		.divider()
		.label("Put an accessory in the offhand slot or a plus-sign hotbar slot. Its passive applies as soon as you equip it.")
		.button("Back")
		.show(player).then(r => {
			if (r.selection === 0 || r.canceled) mainGuideScreen(player);
		})
}

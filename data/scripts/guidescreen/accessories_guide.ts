import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";

export default function guideAccessories(player: Player) {
	const form = new ActionFormData()
		.title("Accessories")
		.label("Every accessory explains its own effect in its item description, so hover over the item to read what it does!")
		.divider()
		.label("Accessories are an Item Type that can be used as a combat support, or anything to enhance your experience. Accessories can be found anywhere, from doing mining, looting structures, until fighting a boss")
		.divider()
		.label("There are two types of accessories :")
		.label("Active Accessories :\nActive accessories are an accessory that have both passive, and interactability, this type of accessories are recommended to use it at the hotbar with plus sign.")
		.label("Passive Accessories :\nPassive accessories are an accessory that have only passive effect, this type of accessories are recommended to use it at offhand slot, but you can still use it at the hotbar with plus sign.")
		.divider()
		.label("To use accessory, put an accessories item type into Offhand Slot, or Hotbar with plus sign. The passive effect will automatically be applied as soon you equip it.")
		.button("Back")
		.show(player).then(r => {
			if (r.selection === 0 || r.canceled) mainGuideScreen(player);
		})
}

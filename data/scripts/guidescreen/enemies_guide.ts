import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";
import { guideTitle } from "./guidebook_title";

export default function guideEnemies(player: Player) {
	const form = new ActionFormData()
		.title(guideTitle("Enemies"))
		.divider()
		.label("Only one enemy type so far: Crimson Tentacles.")
		.label("They spawn naturally in the Crimson Forest and drop Essence of Crimson at 50% chance.")
		.divider()
		.button("Back")
		.show(player)
		.then((r) => {
			if (r.selection === 0 || r.canceled) mainGuideScreen(player);
		});
}

import { ActionFormData } from "@minecraft/server-ui";
import type { Player } from "@minecraft/server";
import { mainGuideScreen } from "./main_guide";

export default function guideEnemies(player: Player) {
	const form = new ActionFormData()
		.title("Enemies")
		.divider()
		.label("Currently we only have 1 type of enemies, Crimson Tentacles")
		.label("Crimson Tentacles spawn naturally in Crimson Forest, when defeated drop Essence of Crimson with chance of 50%%")
		.divider()
		.button("Back")
		.show(player)
		.then((r) => {
			if (r.selection === 0 || r.canceled) mainGuideScreen(player);
		});
}

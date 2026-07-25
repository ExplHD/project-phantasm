import { ActionFormData } from "@minecraft/server-ui";
import { mainGuideScreen } from "./main_guide";

export default function guideEnemies(player) {
  const form = new ActionFormData()
    .title("Enemies")
    .divider()
    .label("currently we only have 1 type of Enemies, crimson tentacles")
    .label("crimson tentacles spawn naturally in crimson biomes, when defeated drop essence of crimson, chance 50%%")
    .divider()
    .button("Back")
    .show(player)
    .then((r) => {
      if (r.selection === 0 || r.canceled) mainGuideScreen(player);
    });
}

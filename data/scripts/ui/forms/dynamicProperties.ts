import { ItemStack, Player } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { PLAYER_PROPERTIES, applyPropertyDefaults } from "../../core/playerProperties";
import type { PlayerPropertyValue } from "../../core/playerProperties";
import { clearControlState } from "../../systems/controls";
import { releaseBlessingCutscene } from "../../systems/xeonniteBlessing";

// ======================================== Property sync ========================================

/**
 * Applies what a property change means in game. Stored values alone aren't enough:
 * /setting reads a cached copy of the controls, Health level lives on as a Health Boost
 * effect, and the blessing cutscene holds the camera until it's released.
 */
export function syncPlayerProperty(player: Player, id: string): void {
	const value = player.getDynamicProperty(id);
	switch (id) {
		case "ph:dash_control":
		case "ph:skill_switch_control":
			clearControlState(player);
			break;
		case "ph:health_level": {
			player.removeEffect("health_boost");
			const level = Number(value ?? 0);
			if (level > 0) {
				player.runCommand(`effect @s health_boost infinite ${3 * level} true`);
				player.addEffect("instant_health", 20, { amplifier: 255, showParticles: false });
			}
			break;
		}
		case "ph:xeonnite_cutscene_active":
			if (value !== true) releaseBlessingCutscene(player);
			break;
	}
}

/**
 * Puts a player back to a fresh Phantasm state, as if joining for the first time:
 * every property wiped, everything derived from them undone, defaults written back
 * and the Guidebook handed out again.
 */
export function resetPlayerProperties(player: Player): void {
	releaseBlessingCutscene(player);
	const wasNerfed = player.getDynamicProperty("ph:forge_parry_nerf_until") !== undefined;

	player.clearDynamicProperties();
	applyPropertyDefaults(player);

	for (const def of PLAYER_PROPERTIES) syncPlayerProperty(player, def.id);
	if (wasNerfed) player.removeEffect("weakness");

	player.dimension.spawnItem(new ItemStack("ph:guidebook"), player.location);
}

// ======================================== Manager form ========================================

function formatValue(value: PlayerPropertyValue | undefined): string {
	return value === undefined ? "§8(unset)" : `§f${value}`;
}

// Main function to call the ui
export default function openDynamicPropertyMenu(player: Player): void {
	// Observable for dropdown property (index to PLAYER_PROPERTIES)
	const selectedIndex = new ObservableNumber(0, { clientWritable: true });

	// Observable for value input, depends of the property
	const toggleValue = new ObservableBoolean(false, { clientWritable: true });
	const textValue = new ObservableString("", { clientWritable: true });

	// Observable to show/hide controls based on property type
	const showToggle = new ObservableBoolean(false);
	const showText = new ObservableBoolean(false);

	// Confirmation before reset all.
	const confirmReset = new ObservableBoolean(false, { clientWritable: true });

	const currentLabel = new ObservableString("");
	const statusMessage = new ObservableString("");

	// The editor follows the declared type, so an unset property still gets the right input.
	function refreshForIndex(index: number): void {
		const def = PLAYER_PROPERTIES[index];
		const currentValue = player.getDynamicProperty(def.id) as PlayerPropertyValue | undefined;
		currentLabel.setData(`§7${def.id}\n§7Current: ${formatValue(currentValue)}`);

		const isBoolean = def.type === "boolean";
		showToggle.setData(isBoolean);
		showText.setData(!isBoolean);
		if (isBoolean) toggleValue.setData(currentValue === true);
		else textValue.setData(currentValue !== undefined ? currentValue.toString() : "");
	}

	// Set default view before form is opened
	refreshForIndex(selectedIndex.getData());

	// every time the dropdown is changed, update the form
	selectedIndex.subscribe((newIndex: number) => {
		refreshForIndex(newIndex);
		statusMessage.setData("");
	});

	const dropdownItems = PLAYER_PROPERTIES.map((def, i) => ({ label: `[${def.group}] ${def.label}`, value: i }));

	new CustomForm(player, "DynamicProperty Manager")
		.label("Choose DynamicProperty to change:")
		.dropdown("Property", selectedIndex, dropdownItems)
		.label(currentLabel)
		.divider()
		.toggle("Value (boolean)", toggleValue, { visible: showToggle })
		.textField("Value (number)", textValue, {
			description: "Leave empty to unset",
			visible: showText,
		})
		.spacer()
		.button("Save", () => {
			const def = PLAYER_PROPERTIES[selectedIndex.getData()];

			try {
				if (def.type === "boolean") {
					player.setDynamicProperty(def.id, toggleValue.getData());
				} else {
					const raw = textValue.getData().trim();
					const parsed = Number(raw);
					if (raw !== "" && Number.isNaN(parsed)) {
						statusMessage.setData("§cIncorrect Type, Expected Type : Number!");
						return;
					}
					player.setDynamicProperty(def.id, raw === "" ? undefined : parsed);
				}
				syncPlayerProperty(player, def.id);

				refreshForIndex(selectedIndex.getData());
				statusMessage.setData(`§aSuccessfully changed ${def.label}!`);
			} catch (e) {
				statusMessage.setData(`§cFailed to change property: ${e}`);
			}
		})
		.divider()
		.label("Reset every Phantasm property to a fresh start (same as /cleardynamicproperties):")
		.toggle("Turn on to confirm", confirmReset)
		.button("Reset All Properties", () => {
			if (!confirmReset.getData()) {
				statusMessage.setData("§eTurn on the toggle before resetting!");
				return;
			}

			resetPlayerProperties(player);

			confirmReset.setData(false);
			refreshForIndex(selectedIndex.getData());
			statusMessage.setData("§aAll DynamicProperties are successfully reset!");
		})
		.divider()
		.label(statusMessage)
		.closeButton()
		.show()
		.catch((e: unknown) => {
			console.error(e);
		});
}

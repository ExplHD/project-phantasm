import { world } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";

/**
 * Place the dynamic properties here mf
 */
const DYNAMIC_PROPERTY_IDS = ["ph:dash_level", "ph:health_level", "ph:plunge_unlock", "ph:guidebook_acquired"];

function getPropertyType(value) {
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "number") return "number";
	if (typeof value === "string") return "string";
	return "undefined";
}

// Main function to call the ui
export default function openDynamicPropertyMenu(player) {
	// Observable for dropdown property (index to DYNAMIC_PROPERTY_IDS)
	const selectedIndex = new ObservableNumber(0, { clientWritable: true });

	// Observable for value input, depends of the property
	const toggleValue = new ObservableBoolean(false, { clientWritable: true });
	const textValue = new ObservableString("", { clientWritable: true });

	// Observable to show/hide controls based on property type
	const showToggle = new ObservableBoolean(false);
	const showText = new ObservableBoolean(false);

	// Confirmation before reset all.
	const confirmReset = new ObservableBoolean(false, { clientWritable: true });

	const statusMessage = new ObservableString("");

	// real type of the property before being submitted
	let currentType = "undefined";

	function refreshForIndex(index) {
		const propertyId = DYNAMIC_PROPERTY_IDS[index];
		const currentValue = player.getDynamicProperty(propertyId);
		currentType = getPropertyType(currentValue);

		if (currentType === "boolean") {
			showToggle.setData(true);
			showText.setData(false);
			toggleValue.setData(currentValue);
		} else {
			// number, string, or undefined, so use text field
			showToggle.setData(false);
			showText.setData(true);
			textValue.setData(currentValue !== undefined ? currentValue.toString() : "");
		}
	}

	// Set default view before form is opened
	refreshForIndex(selectedIndex.getData());

	// every time the dropdown is changed, update the form
	selectedIndex.subscribe((newIndex) => {
		refreshForIndex(newIndex);
		statusMessage.setData("");
	});

	const dropdownItems = DYNAMIC_PROPERTY_IDS.map((id, i) => ({ label: id, value: i }));

	new CustomForm(player, "DynamicProperty Manager")
		.label("Choose DynamicProperty to change:")
		.dropdown("Property", selectedIndex, dropdownItems)
		.divider()
		.toggle("Value (boolean)", toggleValue, { visible: showToggle })
		.textField("Value (number/string)", textValue, {
			description: "Input text/string value",
			visible: showText,
		})
		.spacer()
		.button("Save", () => {
			const propertyId = DYNAMIC_PROPERTY_IDS[selectedIndex.getData()];

			try {
				if (currentType === "boolean") {
					player.setDynamicProperty(propertyId, toggleValue.getData());
				} else if (currentType === "number") {
					const parsed = Number(textValue.getData());
					if (Number.isNaN(parsed)) {
						statusMessage.setData("§cIncorrect Type, Expected Type : Number!");
						return;
					}
					if (propertyId === DYNAMIC_PROPERTY_IDS[1]) {
						player.removeEffect("health_boost");
						player.runCommand(`effect @s health_boost infinite ${3 * parsed} true`);
						player.addEffect("instant_health", 20, { amplifier: 255, showParticles: false });
					}
					player.setDynamicProperty(propertyId, parsed);
				} else {
					// property that not saved yet turns into a string
					player.setDynamicProperty(propertyId, textValue.getData());
				}

				statusMessage.setData(`§aSuccessfully changed ${propertyId}!`);
			} catch (e) {
				statusMessage.setData(`§cFailed to change property: ${e}`);
			}
		})
		.divider()
		.label("Reset all DynamicProperties in the list:")
		.toggle("Turn on to confirm", confirmReset)
		.button("Reset All Properties", () => {
			if (!confirmReset.getData()) {
				statusMessage.setData("§eTurn on the toggle before resetting!");
				return;
			}

			for (const id of DYNAMIC_PROPERTY_IDS) {
				player.setDynamicProperty(id, undefined);
			}

			confirmReset.setData(false);
			refreshForIndex(selectedIndex.getData());
			statusMessage.setData("§aAll DynamicProperties are successfully reset!");
		})
		.divider()
		.label(statusMessage)
		.closeButton()
		.show()
		.catch((e) => {
			console.error(e);
		});
}

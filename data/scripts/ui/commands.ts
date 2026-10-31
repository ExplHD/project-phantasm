import { system, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType, Player } from '@minecraft/server'
import { unstuckPlayer } from '../core/player'
import { skillUnlock, propertiesCheck } from './forms/skillUnlock'
import { openSettings } from './forms/settingsForm'
import { mainGuideScreen } from './guide/main_guide'
import openDynamicPropertyMenu, { resetPlayerProperties } from './forms/dynamicProperties'

// ======================================== Slash commands and the Guidebook ========================================
// Everything registered at startup that opens a form lives here, so features/ never has to
// import ui/. Subscribed to system.beforeEvents.startup in events/loader.ts.

export function registerUiCommands(initEvent: any): void {
    initEvent.itemComponentRegistry.registerCustomComponent("ph:guidebook", {
        onUse({ source }: any) {
            mainGuideScreen(source);
        }
    });

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:unlockskill",
		description: "Opens a skill unlock ui",
		cheatsRequired: false,
		permissionLevel: CommandPermissionLevel.Any
	}, openForm);

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:cleardynamicproperties",
		description: "Reset every Phantasm property (upgrades, blessing, controls) to a fresh start",
		cheatsRequired: true,
		permissionLevel: CommandPermissionLevel.GameDirectors,
		optionalParameters: [{ name: "target", type: CustomCommandParamType.PlayerSelector }]
	}, clearDynamicProperty);

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:dynamicproperties",
		description: "Check all of your dynamic properties",
		cheatsRequired: true,
		permissionLevel: CommandPermissionLevel.GameDirectors
	}, (origin: any) => {
		system.run(() => {
			openDynamicPropertyMenu(origin.sourceEntity);
		})
	});

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:guide",
		description: "Opens Guide Screen",
		cheatsRequired: false,
		permissionLevel: CommandPermissionLevel.Any
	}, (origin: any) => {
		system.run(() => {
			mainGuideScreen(origin.sourceEntity);
		})
	});

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:setting",
		description: "Opens the settings ui to configure your controls",
		cheatsRequired: false,
		permissionLevel: CommandPermissionLevel.Any
	}, (origin: any) => {
		const player = origin.sourceEntity;
		if (player?.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure };
		system.run(() => {
			openSettings(player);
		})
		return { status: CustomCommandStatus.Success };
	});

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:unstuck",
		description: "Unstuck yourself when you cannot move.",
		cheatsRequired: true,
		permissionLevel: CommandPermissionLevel.Any
	}, (origin: any) => { 
		unstuckPlayer(origin.sourceEntity);
		origin.sourceEntity.sendMessage("Successfully unstuck");
	});
}

function openForm({ sourceEntity: player }: any) {
    system.run(() => {
        skillUnlock(player);
    })
    return { status: CustomCommandStatus.Success };
}

// [UNUSED] openProperties - never passed to a registerCommand call, so this handler is
// unreachable. /dynamicproperties uses openDynamicPropertyMenu instead. This is the only
// caller of propertiesCheck in forms/skillUnlock.ts.
function openProperties({ sourceEntity: player }: any) {
    system.run(() => {
        propertiesCheck(player);
    })
    return { status: CustomCommandStatus.Success };
}

// Defaults to the player running it; the optional target also makes it usable from the console.
function clearDynamicProperty({ sourceEntity }: any, targets?: Player[]) {
    const players = targets ?? (sourceEntity?.typeId === "minecraft:player" ? [sourceEntity as Player] : []);
    if (players.length === 0) {
        return { status: CustomCommandStatus.Failure, message: "No player to reset. Run it as a player or pass a target." };
    }
    system.run(() => {
        for (const player of players) {
            if (!player.isValid) continue;
            resetPlayerProperties(player);
            player.sendMessage("§aYour Phantasm progress and settings were reset.");
        }
    })
    return { status: CustomCommandStatus.Success, message: `Reset ${players.length} player(s).` };
}

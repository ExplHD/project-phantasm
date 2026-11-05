import { system, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType, Player, type CustomCommandOrigin, type CustomCommandResult, type StartupEvent } from '@minecraft/server'
import { unstuckPlayer } from '../core/player'
import { skillUnlock } from './forms/skillUnlock'
import { openSettings } from './forms/settingsForm'
import { mainGuideScreen } from './guide/main_guide'
import openDynamicPropertyMenu, { resetPlayerProperties } from './forms/dynamicProperties'

function originPlayer(origin: CustomCommandOrigin): Player | undefined {
    return origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
}

export function registerUiCommands(initEvent: StartupEvent): void {
    initEvent.itemComponentRegistry.registerCustomComponent("ph:guidebook", {
        onUse({ source }): void {
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
	}, (origin: CustomCommandOrigin): CustomCommandResult => {
		const player = originPlayer(origin);
		if (!player) return { status: CustomCommandStatus.Failure };
		system.run(() => {
			openDynamicPropertyMenu(player);
		})
		return { status: CustomCommandStatus.Success };
	});

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:guide",
		description: "Opens Guide Screen",
		cheatsRequired: false,
		permissionLevel: CommandPermissionLevel.Any
	}, (origin: CustomCommandOrigin): CustomCommandResult => {
		const player = originPlayer(origin);
		if (!player) return { status: CustomCommandStatus.Failure };
		system.run(() => {
			mainGuideScreen(player);
		})
		return { status: CustomCommandStatus.Success };
	});

	initEvent.customCommandRegistry.registerCommand({
		name: "ph:setting",
		description: "Opens the settings ui to configure your controls",
		cheatsRequired: false,
		permissionLevel: CommandPermissionLevel.Any
	}, (origin: CustomCommandOrigin): CustomCommandResult => {
		const player = originPlayer(origin);
		if (!player) return { status: CustomCommandStatus.Failure };
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
	}, (origin: CustomCommandOrigin): CustomCommandResult => {
		const player = originPlayer(origin);
		if (!player) return { status: CustomCommandStatus.Failure };
		unstuckPlayer(player);
		player.sendMessage("Successfully unstuck");
		return { status: CustomCommandStatus.Success };
	});
}

function openForm(origin: CustomCommandOrigin): CustomCommandResult {
    const player = originPlayer(origin);
    if (!player) return { status: CustomCommandStatus.Failure };
    system.run(() => {
        skillUnlock(player);
    })
    return { status: CustomCommandStatus.Success };
}

function clearDynamicProperty(origin: CustomCommandOrigin, targets?: Player[]): CustomCommandResult {
    const source = originPlayer(origin);
    const players = targets ?? (source ? [source] : []);
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

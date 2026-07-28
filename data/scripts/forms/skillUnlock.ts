import { world, system } from '@minecraft/server'
import type { Player } from '@minecraft/server'
import { ActionFormData, MessageFormData } from '@minecraft/server-ui'

export function skillUnlock(player: Player) {
    let dashLevelStatus = player.getDynamicProperty("ph:dash_level") ?? 0;
    let healthLevelStatus = player.getDynamicProperty("ph:health_level") ?? 0;
    let plungeUnlockStatus = (player.getDynamicProperty("ph:plunge_unlock") == true) ? "§2UNLOCKED" : "§4LOCKED";

    const form = new ActionFormData()
        .title("Skill Unlocking")
        .body("Unlock your new potential by spending your 30 Experience level to one of the skill right here")
        .button(`Passive Dash\n§2Level : ${dashLevelStatus}`)
        .button(`Extra Health\n§2Level : ${healthLevelStatus}`)
        .button(`Wind Plunge\n${plungeUnlockStatus}`)
        .show(player).then(r => {
            if (r.cancelationReason == "UserBusy") system.run(() => skillUnlock(player))
            if (r.selection == 0) dashUnlock(player);
            if (r.selection == 1) healthUpgrade(player);
            if (r.selection == 2) plungeUnlock(player);
        })
}

function dashUnlock(player: Player) {
    const exp = player.level;
    let dashLevel = player.getDynamicProperty("ph:dash_level") ?? 0;
	const form = new MessageFormData()
		.title("Confirm Selection")
        .body(`Are you sure you want to unlock the passive dash? to use it press jump twice\n\nCurrent Level : ${exp}\nRequired Level : 30`)
        .button1("Confirm")
        .button2("Cancel")
        .show(player).then(r => {
            if (r.selection == 0) {
                if (exp >= 30 && dashLevel == 0) {
                    player.setDynamicProperty("ph:dash_level", 1);
                    player.playSound("random.levelup");
                    player.sendMessage("§aUnlocked the Passive Dash successfully");
                    player.addLevels(-30);
                } else {
                    player.playSound("note.bass");
					if (dashLevel == 0) player.sendMessage("§cInsufficient Experience Level!"); else player.sendMessage("§cMaximum level for dash is reached");
                }
            }
            if (r.selection == 1) {
                skillUnlock(player);
            }
        })
}

function healthUpgrade(player: Player) {
    const exp = player.level;
    const form = new MessageFormData()
        .title("Confirm Selection")
        .body(`Are you sure you want to upgrade your max health? adds 16 HP at level 1, +12 HP at other level\n\nCurrent Level : ${exp}\nRequired Level : 30`)
        .button1("Confirm")
        .button2("Cancel")
        .show(player).then(r => {
            if (r.selection == 0) {
                const healthLevel = player.getDynamicProperty("ph:health_level");
                if (exp < 30) {
                    player.playSound("note.bass");
                    player.sendMessage("§cInsufficient Experience Level!");
                    return;
                }
                if (!healthLevel || Number(healthLevel) < 3) {
                    player.setDynamicProperty("ph:health_level", Number(healthLevel) + 1);
                    player.runCommand(`effect @s health_boost infinite ${3 * Number(player.getDynamicProperty("ph:health_level"))}`)
                    player.addEffect("instant_health", 1, {
                        amplifier: 255,
                        showParticles: false
                    })
                    player.playSound("random.levelup");
                    player.sendMessage("§aUpgraded your health successfully");
                    player.addLevels(-30);
                } else {
                    player.playSound("note.bass");
                    player.sendMessage("§cMaximum Level Reached!");
                }
            }
            if (r.selection == 1) {
                skillUnlock(player);
            }
        })
}

function plungeUnlock(player: Player) {
    const exp = player.level;
    let plungeUnlock = player.getDynamicProperty("ph:plunge_unlock") ?? false;
    const form = new MessageFormData()
        .title("Confirm Selection")
        .body(`Are you sure you want to unlock the wind plunge passive? to use it press sneak while falling more than 10 blocks.\n\nCurrent Level : ${exp}\nRequired Level : 30`)
        .button1("Confirm")
        .button2("Cancel")
        .show(player).then(r => {
            if (r.selection == 0) {
                if (exp >= 30 && plungeUnlock == false) {
                    player.setDynamicProperty("ph:plunge_unlock", true);
                    player.playSound("random.levelup");
                    player.sendMessage("§aUnlocked the Wind Plunging Passive successfully");
                    player.addLevels(-30);
                } else {
                    player.playSound("note.bass");
                    player.sendMessage("§cInsufficient Experience Level!");
                }
            }
            if (r.selection == 1) {
                skillUnlock(player);
            }
        })
}

export function propertiesCheck(player: Player) {
    let dashLevelStatus = player.getDynamicProperty("ph:dash_level");
    let healthLevelStatus = player.getDynamicProperty("ph:health_level");
    let plungeUnlockStatus = player.getDynamicProperty("ph:plunge_unlock");

    const form = new ActionFormData()
        .title("Skill Unlocking")
        .body("Unlock your new potential by spending your 30 Experience level to one of the skill right here")
        .button(`Passive Dash\n§2Level : ${dashLevelStatus}`)
        .button(`Extra Health\n§2Level : ${healthLevelStatus}`)
        .button(`Wind Plunge\n${plungeUnlockStatus}`)
        .show(player).then(r => {
            if (r.cancelationReason == "UserBusy") system.run(() => skillUnlock(player))
        })
}

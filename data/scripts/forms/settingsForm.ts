import { system } from '@minecraft/server'
import type { Player } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'
import {
    DASH_CONTROL_NAMES,
    DASH_CONTROL_HINTS,
    SKILL_SWITCH_CONTROL_NAMES,
    SKILL_SWITCH_CONTROL_HINTS,
    getDashControl,
    setDashControl,
    getSkillSwitchControl,
    setSkillSwitchControl
} from '../controls'

export function openSettings(player: Player): void {
    const dashControl = getDashControl(player);
    const skillSwitchControl = getSkillSwitchControl(player);

    const form = new ActionFormData()
        .title("Phantasm Settings")
        .body("Pick the controls you want for Phantasm mechanics. Every setting is saved to you only.")
        .button(`Passive Dash\n§7Currently: §f${DASH_CONTROL_NAMES[dashControl]}`)
        .button(`Legendary Weapon Skills\n§7Currently: §f${SKILL_SWITCH_CONTROL_NAMES[skillSwitchControl]}`)
        .button("Reset To Defaults")
        .button("Close")
        .show(player).then(r => {
            if (r.cancelationReason == "UserBusy") system.run(() => openSettings(player));
            if (r.selection == 0) dashControlMenu(player);
            if (r.selection == 1) skillSwitchControlMenu(player);
            if (r.selection == 2) resetSettings(player);
        })
}

function dashControlMenu(player: Player): void {
    const current = getDashControl(player);
    const form = new ActionFormData()
        .title("Passive Dash Control")
        .body(DASH_CONTROL_HINTS.join("\n\n"));

    DASH_CONTROL_NAMES.forEach((name, index) => {
        form.button(index == current ? `§a${name}\n§7Currently selected` : name);
    });
    form.button("§cBack").show(player).then(r => {
        if (r.canceled) return openSettings(player);
        if (r.selection == DASH_CONTROL_NAMES.length) return openSettings(player);
        setDashControl(player, r.selection!);
        player.playSound("random.levelup");
        player.sendMessage(`§aPassive Dash control set to §f${DASH_CONTROL_NAMES[r.selection!]}`);
        openSettings(player);
    })
}

function skillSwitchControlMenu(player: Player): void {
    const current = getSkillSwitchControl(player);
    const form = new ActionFormData()
        .title("Skill Switch Control")
        .body(SKILL_SWITCH_CONTROL_HINTS.join("\n\n"));

    SKILL_SWITCH_CONTROL_NAMES.forEach((name, index) => {
        form.button(index == current ? `§a${name}\n§7Currently selected` : name);
    });
    form.button("§cBack").show(player).then(r => {
        if (r.canceled) return openSettings(player);
        if (r.selection == SKILL_SWITCH_CONTROL_NAMES.length) return openSettings(player);
        setSkillSwitchControl(player, r.selection!);
        player.playSound("random.levelup");
        player.sendMessage(`§aSkill switch control set to §f${SKILL_SWITCH_CONTROL_NAMES[r.selection!]}`);
        openSettings(player);
    })
}

function resetSettings(player: Player): void {
    setDashControl(player, 0);
    setSkillSwitchControl(player, 0);
    player.playSound("random.levelup");
    player.sendMessage("§aSettings reset to defaults: §fDouble-tap Jump§7 and §fSneak");
    openSettings(player);
}
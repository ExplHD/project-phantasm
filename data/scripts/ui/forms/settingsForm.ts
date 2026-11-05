import { system } from '@minecraft/server'
import type { Player } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'
import {
    DASH_CONTROL_NAMES,
    DASH_CONTROL_HINTS,
    SKILL_SWITCH_CONTROL_NAMES,
    SKILL_SWITCH_CONTROL_HINTS,
    PARRY_CONTROL_NAMES,
    PARRY_CONTROL_HINTS,
    PARRY_SOUND_NAMES,
    PARRY_SOUND_HINTS,
    getDashControl,
    setDashControl,
    getSkillSwitchControl,
    setSkillSwitchControl,
    getParryControl,
    setParryControl,
    getParrySound,
    setParrySound
} from '../../systems/controls'

export function openSettings(player: Player): void {
    const dashControl = getDashControl(player);
    const skillSwitchControl = getSkillSwitchControl(player);
    const parryControl = getParryControl(player);
    const parrySound = getParrySound(player);

    new ActionFormData()
        .title("Phantasm Settings")
        .body("Pick the controls you want for Phantasm mechanics. Every setting is saved to you only.")
        .button(`Passive Dash\n§7Currently: §f${DASH_CONTROL_NAMES[dashControl]}`)
        .button(`Legendary Weapon Skills\n§7Currently: §f${SKILL_SWITCH_CONTROL_NAMES[skillSwitchControl]}`)
        .button(`Weapon Parry\n§7Currently: §f${PARRY_CONTROL_NAMES[parryControl]}`)
        .button(`Parry Sound\n§7Currently: §f${PARRY_SOUND_NAMES[parrySound]}`)
        .button("Reset To Defaults")
        .button("Close")
        .show(player).then(r => {
            if (r.cancelationReason == "UserBusy") system.run(() => openSettings(player));
            if (r.selection == 0) dashControlMenu(player);
            if (r.selection == 1) skillSwitchControlMenu(player);
            if (r.selection == 2) parryControlMenu(player);
            if (r.selection == 3) parrySoundMenu(player);
            if (r.selection == 4) resetSettings(player);
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

function parryControlMenu(player: Player): void {
    const current = getParryControl(player);
    const form = new ActionFormData()
        .title("Weapon Parry Control")
        .body(PARRY_CONTROL_HINTS.join("\n\n") + "\n\n§7If this uses the same control as skill switching, a Legendary weapon parries and switches skill on the same press.");

    PARRY_CONTROL_NAMES.forEach((name, index) => {
        form.button(index == current ? `§a${name}\n§7Currently selected` : name);
    });
    form.button("§cBack").show(player).then(r => {
        if (r.canceled) return openSettings(player);
        if (r.selection == PARRY_CONTROL_NAMES.length) return openSettings(player);
        setParryControl(player, r.selection!);
        player.playSound("random.levelup");
        player.sendMessage(`§aWeapon parry control set to §f${PARRY_CONTROL_NAMES[r.selection!]}`);
        openSettings(player);
    })
}

function parrySoundMenu(player: Player): void {
    const current = getParrySound(player);
    const form = new ActionFormData()
        .title("Parry Sound")
        .body(PARRY_SOUND_HINTS.join("\n\n"));

    PARRY_SOUND_NAMES.forEach((name, index) => {
        form.button(index == current ? `§a${name}\n§7Currently selected` : name);
    });
    form.button("§cBack").show(player).then(r => {
        if (r.canceled) return openSettings(player);
        if (r.selection == PARRY_SOUND_NAMES.length) return openSettings(player);
        setParrySound(player, r.selection!);
        player.playSound(r.selection == 1 ? "weapon_slash.parry_success" : "weapon_slash.slash_clash");
        player.sendMessage(`§aParry sound set to §f${PARRY_SOUND_NAMES[r.selection!]}`);
        openSettings(player);
    })
}

function resetSettings(player: Player): void {
    setDashControl(player, 0);
    setSkillSwitchControl(player, 0);
    setParryControl(player, 0);
    setParrySound(player, 0);
    player.playSound("random.levelup");
    player.sendMessage("§aSettings reset. Dash: §fDouble-tap Jump§a, skill switch: §fSneak§a, parry: §fSneak§a, parry sound: §fPhantasm");
    openSettings(player);
}

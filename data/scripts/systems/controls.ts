import { Player } from '@minecraft/server'

export const DASH_CONTROL = {
    DOUBLE_TAP_JUMP: 0,
    SPRINT_JUMP: 1,
    JUMP_SNEAK: 2
} as const

export const SKILL_SWITCH_CONTROL = {
    SNEAK: 0,
    SNEAK_ATTACK: 1,
    DOUBLE_SNEAK: 2
} as const

export const PARRY_CONTROL = {
    SNEAK: 0,
    SNEAK_ATTACK: 1,
    DOUBLE_SNEAK: 2,
    DISABLED: 3
} as const

export const DASH_CONTROL_NAMES: string[] = [
    "Double-tap Jump",
    "Sprint + Jump",
    "Jump + Sneak"
]

export const SKILL_SWITCH_CONTROL_NAMES: string[] = [
    "Sneak",
    "Sneak + Attack",
    "Double Sneak"
]

export const DASH_CONTROL_HINTS: string[] = [
    "§aDouble-tap Jump §7- Press Jump twice quickly while falling.",
    "§aSprint + Jump §7- Press Jump while sprinting and falling.",
    "§aJump + Sneak §7- Press Jump, then Sneak while in midair."
]

export const SKILL_SWITCH_CONTROL_HINTS: string[] = [
    "§aSneak §7- Press Sneak while holding a Legendary weapon.",
    "§aSneak + Attack §7- Attack while sneaking (or right after tapping Sneak) with a Legendary weapon.",
    "§aDouble Sneak §7- Press Sneak twice quickly while holding a Legendary weapon."
]

export const PARRY_CONTROL_NAMES: string[] = [
    "Sneak",
    "Sneak + Attack",
    "Double Sneak",
    "Disabled"
]

export const PARRY_CONTROL_HINTS: string[] = [
    "§aSneak §7- Press Sneak while holding a sword, axe or spear.",
    "§aSneak + Attack §7- Attack while sneaking (or right after tapping Sneak) with a sword, axe or spear.",
    "§aDouble Sneak §7- Press Sneak twice quickly while holding a sword, axe or spear.",
    "§aDisabled §7- Swords, axes and spears never parry from Sneak."
]

export const PARRY_SOUND = {
    PHANTASM: 0,
    LUNA: 1
} as const

export const PARRY_SOUND_NAMES: string[] = [
    "Phantasm",
    "Luna"
]

export const PARRY_SOUND_HINTS: string[] = [
    "§aPhantasm §7- The Phantasm blade clash.",
    "§aLuna §7- The parry sound from Project Luna."
]

const DOUBLE_TAP_WINDOW = 300;
const COMBO_WINDOW = 500;

interface ControlState {
    dash: number;
    skill: number;
    parry: number;
    parrySound: number;
    jumpAt: number;
    sneakAt: number;
}

const states = new Map<string, ControlState>();

function elapsed(now: number, then: number): number {
    const gap = now - then;
    return gap < 0 ? Infinity : gap;
}

function getState(player: Player): ControlState {
    const existing = states.get(player.id);
    if (existing) return existing;
    const state: ControlState = {
        dash: readControl(player, "ph:dash_control", DASH_CONTROL_NAMES.length),
        skill: readControl(player, "ph:skill_switch_control", SKILL_SWITCH_CONTROL_NAMES.length, SKILL_SWITCH_CONTROL.DOUBLE_SNEAK),
        parry: readControl(player, "ph:parry_control", PARRY_CONTROL_NAMES.length),
        parrySound: readControl(player, "ph:parry_sound", PARRY_SOUND_NAMES.length),
        jumpAt: -Infinity,
        sneakAt: -Infinity
    };
    states.set(player.id, state);
    return state;
}

function readControl(player: Player, property: string, length: number, fallback: number = 0): number {
    const stored = player.getDynamicProperty(property);
    if (typeof stored !== "number") return fallback;
    return stored >= 0 && stored < length ? stored : fallback;
}

export function getDashControl(player: Player): number {
    return getState(player).dash;
}

export function setDashControl(player: Player, control: number): void {
    player.setDynamicProperty("ph:dash_control", control);
    getState(player).dash = control;
}

export function getSkillSwitchControl(player: Player): number {
    return getState(player).skill;
}

export function setSkillSwitchControl(player: Player, control: number): void {
    player.setDynamicProperty("ph:skill_switch_control", control);
    getState(player).skill = control;
}

export function getParryControl(player: Player): number {
    return getState(player).parry;
}

export function setParryControl(player: Player, control: number): void {
    player.setDynamicProperty("ph:parry_control", control);
    getState(player).parry = control;
}

export function getParrySound(player: Player): number {
    return getState(player).parrySound;
}

export function setParrySound(player: Player, sound: number): void {
    player.setDynamicProperty("ph:parry_sound", sound);
    getState(player).parrySound = sound;
}

export function clearControlState(player: Player): void {
    states.delete(player.id);
}

export type ControlAction = "dash" | "airDash" | "switchSkill" | "parry";

export function onControlButtonInput(player: Player, button: string): ControlAction[] {
    if (button != "Jump" && button != "Sneak") return [];

    const now = Date.now();
    const state = getState(player);

    if (button == "Jump") {
        const doubleTapped = elapsed(now, state.jumpAt) <= DOUBLE_TAP_WINDOW;
        state.jumpAt = now;

        if (state.dash == DASH_CONTROL.SPRINT_JUMP) {
            if (player.isSprinting) return ["dash"];
        } else if (state.dash == DASH_CONTROL.DOUBLE_TAP_JUMP && doubleTapped) {
            return ["dash"];
        }
        return [];
    }

    const doubleTapped = elapsed(now, state.sneakAt) <= DOUBLE_TAP_WINDOW;
    state.sneakAt = now;

    if (state.dash == DASH_CONTROL.JUMP_SNEAK && elapsed(now, state.jumpAt) <= COMBO_WINDOW) {
        state.jumpAt = -Infinity;

        return ["airDash"];
    }

    const actions: ControlAction[] = [];

    if (state.skill == SKILL_SWITCH_CONTROL.SNEAK) {
        if (player.isSneaking) actions.push("switchSkill");
    } else if (state.skill == SKILL_SWITCH_CONTROL.DOUBLE_SNEAK && doubleTapped) {
        actions.push("switchSkill");
    }

    if (state.parry == PARRY_CONTROL.SNEAK || (state.parry == PARRY_CONTROL.DOUBLE_SNEAK && doubleTapped)) {
        actions.push("parry");
    }

    const usedDoubleSneak = doubleTapped && (
        (state.skill == SKILL_SWITCH_CONTROL.DOUBLE_SNEAK && actions.includes("switchSkill")) ||
        (state.parry == PARRY_CONTROL.DOUBLE_SNEAK && actions.includes("parry"))
    );
    if (usedDoubleSneak) state.sneakAt = -Infinity;

    return actions;
}

export function onControlSwingInput(player: Player, swingSource: string): ControlAction[] {
    if (swingSource != "Mine" && swingSource != "Attack") return [];

    const state = getState(player);
    const actions: ControlAction[] = [];
    if (!player.isSneaking && elapsed(Date.now(), state.sneakAt) > COMBO_WINDOW) return actions;

    if (state.skill == SKILL_SWITCH_CONTROL.SNEAK_ATTACK) actions.push("switchSkill");
    if (state.parry == PARRY_CONTROL.SNEAK_ATTACK) actions.push("parry");
    if (actions.length) state.sneakAt = -Infinity;

    return actions;
}

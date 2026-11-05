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
    "§aSneak + Attack §7- Press Sneak, then Attack while holding a Legendary weapon.",
    "§aDouble Sneak §7- Press Sneak twice quickly while holding a Legendary weapon."
]

const DOUBLE_TAP_WINDOW = 300;
const COMBO_WINDOW = 500;

interface ControlState {
    dash: number;
    skill: number;
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
        skill: readControl(player, "ph:skill_switch_control", SKILL_SWITCH_CONTROL_NAMES.length),
        jumpAt: -Infinity,
        sneakAt: -Infinity
    };
    states.set(player.id, state);
    return state;
}

function readControl(player: Player, property: string, length: number): number {
    const stored = Number(player.getDynamicProperty(property));
    return stored >= 0 && stored < length ? stored : 0;
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

export function clearControlState(player: Player): void {
    states.delete(player.id);
}

export type ControlAction = "dash" | "airDash" | "switchSkill" | undefined;

export function onControlButtonInput(player: Player, button: string): ControlAction {
    if (button != "Jump" && button != "Sneak") return;

    const now = Date.now();
    const state = getState(player);

    if (button == "Jump") {
        const doubleTapped = elapsed(now, state.jumpAt) <= DOUBLE_TAP_WINDOW;
        state.jumpAt = now;

        if (state.dash == DASH_CONTROL.SPRINT_JUMP) {
            if (player.isSprinting) return "dash";
        } else if (state.dash == DASH_CONTROL.DOUBLE_TAP_JUMP && doubleTapped) {
            return "dash";
        }
        return;
    }

    const doubleTapped = elapsed(now, state.sneakAt) <= DOUBLE_TAP_WINDOW;
    state.sneakAt = now;

    if (state.dash == DASH_CONTROL.JUMP_SNEAK && elapsed(now, state.jumpAt) <= COMBO_WINDOW) {
        state.jumpAt = -Infinity;

        return "airDash";
    }

    if (state.skill == SKILL_SWITCH_CONTROL.SNEAK) {
        return player.isSneaking ? "switchSkill" : undefined;
    }

    if (state.skill == SKILL_SWITCH_CONTROL.DOUBLE_SNEAK && doubleTapped) {
        state.sneakAt = -Infinity;
        return "switchSkill";
    }
}

export function onControlSwingInput(player: Player, swingSource: string): ControlAction {
    if (swingSource != "Mine" && swingSource != "Attack") return;

    const state = getState(player);
    if (state.skill != SKILL_SWITCH_CONTROL.SNEAK_ATTACK) return;
    if (elapsed(Date.now(), state.sneakAt) > COMBO_WINDOW) return;

    state.sneakAt = -Infinity;
    return "switchSkill";
}

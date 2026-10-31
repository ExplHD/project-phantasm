import { Player } from '@minecraft/server'

// ======================================== Control Schemes ========================================
// Every scheme a player can bind to a Phantasm mechanic is listed here and can be
// picked per player in /setting. The index inside each object is the value stored
// in the player's dynamic property, so never reorder them, only append.

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

const DOUBLE_TAP_WINDOW = 300;  // ms between the two presses of a double tap
const COMBO_WINDOW = 500;        // ms allowed between the two keys of a combo

// One entry per player, so the input path does a single map lookup instead of one per
// scheme. Controls live here instead of being read from dynamic properties on every
// press; setDashControl/setSkillSwitchControl keep the two in sync.
interface ControlState {
    dash: number;
    skill: number;
    jumpAt: number;
    sneakAt: number;
}

const states = new Map<string, ControlState>();

/**
 * Date.now() is wall-clock and can step backwards if the system clock is corrected.
 * Treat a negative gap as "expired" so a clock jump cannot fake a combo.
 */
function elapsed(now: number, then: number): number {
    const gap = now - then;
    return gap < 0 ? Infinity : gap;
}

function getState(player: Player): ControlState {
    let state = states.get(player.id);
    if (!state) {
        state = {
            dash: readControl(player, "ph:dash_control", DASH_CONTROL_NAMES.length),
            skill: readControl(player, "ph:skill_switch_control", SKILL_SWITCH_CONTROL_NAMES.length),
            jumpAt: -Infinity,
            sneakAt: -Infinity
        };
        states.set(player.id, state);
    }
    return state;
}

function readControl(player: Player, property: string, length: number): number {
    const stored = Number(player.getDynamicProperty(property));
    return stored >= 0 && stored < length ? stored : 0;
}

// ======================================== Property Access ========================================

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

// ======================================== Input Runtime ========================================
// These only decide which mechanic an input triggers. events/index.ts runs it, because
// dashing lives in systems/movement.ts and skill switching in features/weapons, and this
// module can't import either.
//   "dash"        - dash, the player has to be falling
//   "airDash"     - dash, being airborne is enough
//   "switchSkill" - switch the held Legendary weapon's skill
export type ControlAction = "dash" | "airDash" | "switchSkill" | undefined;

/**
 * Routes Jump and Sneak presses to whichever control scheme the player bound in /setting.
 * Fires on every button press, so unrelated buttons bail out before any work happens.
 */
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

    // Jump + Sneak dash: the sneak press completes the combo.
    if (state.dash == DASH_CONTROL.JUMP_SNEAK && elapsed(now, state.jumpAt) <= COMBO_WINDOW) {
        state.jumpAt = -Infinity;
        // Airborne is enough here, the jump that started the combo is still going up.
        return "airDash";
    }

    // The plain Sneak scheme checks the sneak state itself. The combo schemes already
    // consumed a sneak press, so requiring it again would break a tap-then-attack input.
    if (state.skill == SKILL_SWITCH_CONTROL.SNEAK) {
        return player.isSneaking ? "switchSkill" : undefined;
    }

    if (state.skill == SKILL_SWITCH_CONTROL.DOUBLE_SNEAK && doubleTapped) {
        state.sneakAt = -Infinity;
        return "switchSkill";
    }
    // Sneak + Attack waits for the swing in onControlSwingInput.
}

/**
 * Completes the Sneak + Attack skill switch combo. The attack itself is left alone so the
 * weapon still swings, the player just changes skill while hitting.
 */
export function onControlSwingInput(player: Player, swingSource: string): ControlAction {
    if (swingSource != "Mine" && swingSource != "Attack") return;

    const state = getState(player);
    if (state.skill != SKILL_SWITCH_CONTROL.SNEAK_ATTACK) return;
    if (elapsed(Date.now(), state.sneakAt) > COMBO_WINDOW) return;

    state.sneakAt = -Infinity;
    return "switchSkill";
}

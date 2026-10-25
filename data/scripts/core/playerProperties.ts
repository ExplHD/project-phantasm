import type { Player } from '@minecraft/server'

/**
 * Every dynamic property Phantasm stores on a player, in one place. /dynamicproperties,
 * the join defaults and /cleardynamicproperties all read this list, so a new property
 * only has to be added here to show up everywhere.
 *
 * `default` is written when the property is missing (on join and after a reset).
 * Leave it out when "missing" has its own meaning, e.g. a timer that isn't running.
 */

export type PlayerPropertyValue = boolean | number | string;

export interface PlayerPropertyDef {
    id: string;
    label: string;
    type: "boolean" | "number";
    group: "Settings" | "Progress" | "Runtime";
    default?: PlayerPropertyValue;
}

export const PLAYER_PROPERTIES: PlayerPropertyDef[] = [
    // /setting controls (systems/controls.ts keeps an in-memory copy of these two).
    { id: "ph:dash_control", label: "Passive Dash control", type: "number", group: "Settings", default: 0 },
    { id: "ph:skill_switch_control", label: "Skill switch control", type: "number", group: "Settings", default: 0 },

    // Upgrades and milestones.
    { id: "ph:dash_level", label: "Dash level", type: "number", group: "Progress", default: 0 },
    { id: "ph:health_level", label: "Health level", type: "number", group: "Progress", default: 0 },
    { id: "ph:plunge_unlock", label: "Wind Plunge unlocked", type: "boolean", group: "Progress", default: false },
    { id: "ph:guidebook_acquired", label: "Guidebook received", type: "boolean", group: "Progress", default: true },
    { id: "ph:ever_obtained_xeonnite_cube", label: "Held a Xeonnite Cube", type: "boolean", group: "Progress", default: false },
    { id: "ph:ever_visited_titan_ridge", label: "Visited Titan Ridge", type: "boolean", group: "Progress", default: false },
    { id: "ph:xeonnite_blessing", label: "Xeonnite Blessing", type: "boolean", group: "Progress", default: false },
    // Missing means dash allowed; only an explicit 0 disables it (systems/movement.ts).
    { id: "ph:dash_unlock", label: "Dash unlock (0 disables dash)", type: "number", group: "Progress" },

    // Short-lived state; missing means inactive.
    { id: "ph:forge_parry_nerf_until", label: "Forge parry nerf ends (ms)", type: "number", group: "Runtime" },
    { id: "ph:xeonnite_cutscene_active", label: "Blessing cutscene running", type: "boolean", group: "Runtime" }
];

/** Writes the default of every property the player doesn't have yet. Existing values are kept. */
export function applyPropertyDefaults(player: Player): void {
    for (const def of PLAYER_PROPERTIES) {
        if (def.default === undefined) continue;
        if (player.getDynamicProperty(def.id) === undefined) player.setDynamicProperty(def.id, def.default);
    }
}

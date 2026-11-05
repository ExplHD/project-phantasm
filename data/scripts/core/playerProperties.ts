import type { Player } from '@minecraft/server'

export type PlayerPropertyValue = boolean | number | string;

export interface PlayerPropertyDef {
    readonly id: string;
    readonly label: string;
    readonly type: "boolean" | "number";
    readonly group: "Settings" | "Progress" | "Runtime";
    readonly default?: PlayerPropertyValue;
}

export const PLAYER_PROPERTIES: PlayerPropertyDef[] = [

    { id: "ph:dash_control", label: "Passive Dash control", type: "number", group: "Settings", default: 0 },
    { id: "ph:skill_switch_control", label: "Skill switch control", type: "number", group: "Settings", default: 0 },

    { id: "ph:dash_level", label: "Dash level", type: "number", group: "Progress", default: 0 },
    { id: "ph:health_level", label: "Health level", type: "number", group: "Progress", default: 0 },
    { id: "ph:plunge_unlock", label: "Wind Plunge unlocked", type: "boolean", group: "Progress", default: false },
    { id: "ph:guidebook_acquired", label: "Guidebook received", type: "boolean", group: "Progress", default: true },
    { id: "ph:ever_obtained_xeonnite_cube", label: "Held a Xeonnite Cube", type: "boolean", group: "Progress", default: false },
    { id: "ph:ever_visited_titan_ridge", label: "Visited Titan Ridge", type: "boolean", group: "Progress", default: false },
    { id: "ph:xeonnite_blessing", label: "Xeonnite Blessing", type: "boolean", group: "Progress", default: false },

    { id: "ph:dash_unlock", label: "Dash unlock (0 disables dash)", type: "number", group: "Progress" },

    { id: "ph:forge_parry_nerf_until", label: "Forge parry nerf ends (ms)", type: "number", group: "Runtime" },
    { id: "ph:xeonnite_cutscene_active", label: "Blessing cutscene running", type: "boolean", group: "Runtime" },
    { id: "ph:polaris_charging", label: "Polaris Power charging", type: "boolean", group: "Runtime" }
];

export function applyPropertyDefaults(player: Player): void {
    for (const def of PLAYER_PROPERTIES) {
        if (def.default === undefined) continue;
        if (player.getDynamicProperty(def.id) === undefined) player.setDynamicProperty(def.id, def.default);
    }
}

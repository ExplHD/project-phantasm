import type { CustomComponentParameters } from '@minecraft/server'

export interface ComponentParams {
    readonly [key: string]: unknown;
}

export function readParams(parameters: CustomComponentParameters): ComponentParams {
    const raw = parameters.params;
    return typeof raw === "object" && raw !== null ? raw as ComponentParams : {};
}

export function numParam(params: ComponentParams, key: string): number | undefined {
    const value = params[key];
    return typeof value === "number" ? value : undefined;
}

export function strParam(params: ComponentParams, key: string): string | undefined {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
}

export function boolParam(params: ComponentParams, key: string): boolean | undefined {
    const value = params[key];
    return typeof value === "boolean" ? value : undefined;
}

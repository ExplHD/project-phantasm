import { Entity } from '@minecraft/server'

export const SUMMONER_PROPERTY = "ph:summoner";

const SCAN_RADIUS = 64;

export function getOwnerId(entity: Entity): string | undefined {
    if (entity.typeId === "minecraft:player") return entity.id;
    if (!entity.isValid) return undefined;
    const owner = entity.getDynamicProperty(SUMMONER_PROPERTY);
    return typeof owner === "string" ? owner : undefined;
}

export function summonOwned(owner: Entity, command: string, source: Entity = owner): void {
    const ownerId = getOwnerId(owner);
    if (!source.isValid) return;
    if (!ownerId) {
        source.runCommand(command);
        return;
    }

    const rawTypeId = command.trim().split(/\s+/)[1];
    if (!rawTypeId) return;
    const typeId = rawTypeId.includes(":") ? rawTypeId : `minecraft:${rawTypeId}`;
    const query = { type: typeId, location: source.location, maxDistance: SCAN_RADIUS };
    const existing = new Set(source.dimension.getEntities(query).map(e => e.id));

    source.runCommand(command);

    for (const entity of source.dimension.getEntities(query)) {
        if (existing.has(entity.id)) continue;
        if (!entity.isValid) continue;
        entity.setDynamicProperty(SUMMONER_PROPERTY, ownerId);
    }
}

import { Entity } from '@minecraft/server'

/**
 * Summon ownership. Entities created by a player's summon command carry the player's id,
 * so damage dealt by summoned mobs, projectiles and lightning can be traced back to them.
 */
export const SUMMONER_PROPERTY = "ph:summoner";

const SCAN_RADIUS = 64;

/**
 * Player id behind an entity: the player itself, or the owner stamped on a summon.
 */
export function getOwnerId(entity: Entity): string | undefined {
    if (entity.typeId === "minecraft:player") return entity.id;
    try {
        const owner = entity.getDynamicProperty(SUMMONER_PROPERTY);
        return typeof owner === "string" ? owner : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Runs a `summon` command from `source` and stamps every entity it created with the owner
 * of `owner`. Ownership chains: a summon summoning more summons passes its owner on.
 * Without an owner (bosses, wild mobs) this is a plain runCommand.
 */
export function summonOwned(owner: Entity, command: string, source: Entity = owner): void {
    const ownerId = getOwnerId(owner);
    if (!ownerId) {
        source.runCommand(command);
        return;
    }

    let typeId = command.trim().split(/\s+/)[1];
    if (!typeId.includes(":")) typeId = `minecraft:${typeId}`;
    const query = { type: typeId, location: source.location, maxDistance: SCAN_RADIUS };
    const existing = new Set(source.dimension.getEntities(query).map(e => e.id));

    source.runCommand(command);

    for (const entity of source.dimension.getEntities(query)) {
        if (existing.has(entity.id)) continue;
        try {
            entity.setDynamicProperty(SUMMONER_PROPERTY, ownerId);
        } catch {
            // Some vanilla entities refuse dynamic properties; they stay unowned.
        }
    }
}

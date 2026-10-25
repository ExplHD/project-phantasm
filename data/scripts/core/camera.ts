import { Dimension, Player, type Vector3 } from '@minecraft/server'

/**
 * Cinematic camera helpers. Shots are built as offsets from an anchor (usually the
 * player's body centre) along the player's horizontal facing, so framing stays the
 * same whichever way the player looked when the shot started.
 */

export interface CameraBasis {
    anchor: Vector3;
    forward: Vector3;
    right: Vector3;
}

/** Anchor at body centre plus a flat forward/right basis from where the player is looking. */
export function playerCameraBasis(player: Player, anchorHeight: number = 1.1): CameraBasis {
    const { x, y, z } = player.location;
    const view = player.getViewDirection();
    const flat = Math.sqrt(view.x * view.x + view.z * view.z) || 1;
    const forward = { x: view.x / flat, y: 0, z: view.z / flat };
    return {
        anchor: { x, y: y + anchorHeight, z },
        forward,
        right: { x: -forward.z, y: 0, z: forward.x }
    };
}

/**
 * Camera point from the anchor. `distance` is along the facing (negative = behind),
 * `side` along the player's right, `height` above the anchor.
 */
export function shotLocation(basis: CameraBasis, distance: number, side: number, height: number): Vector3 {
    const { anchor, forward, right } = basis;
    return {
        x: anchor.x + forward.x * distance + right.x * side,
        y: anchor.y + height,
        z: anchor.z + forward.z * distance + right.z * side
    };
}

/**
 * Pulls a camera point in front of the first solid block between it and the anchor,
 * so shots near walls or hillsides don't end up inside terrain.
 */
export function clearShotLocation(dimension: Dimension, anchor: Vector3, desired: Vector3): Vector3 {
    const dx = desired.x - anchor.x;
    const dy = desired.y - anchor.y;
    const dz = desired.z - anchor.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length < 0.01) return desired;
    const direction = { x: dx / length, y: dy / length, z: dz / length };
    try {
        const hit = dimension.getBlockFromRay(anchor, direction, { maxDistance: length, includePassableBlocks: false });
        if (!hit) return desired;
        const { x, y, z } = hit.block.location;
        const hitDistance = Math.sqrt((x + hit.faceLocation.x - anchor.x) ** 2 + (y + hit.faceLocation.y - anchor.y) ** 2 + (z + hit.faceLocation.z - anchor.z) ** 2);
        const safe = Math.max(hitDistance - 0.35, 0.6);
        return { x: anchor.x + direction.x * safe, y: anchor.y + direction.y * safe, z: anchor.z + direction.z * safe };
    } catch {
        // Unloaded chunks along the ray: keep the authored point.
        return desired;
    }
}

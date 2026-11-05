import { Dimension, Player, type Vector3 } from '@minecraft/server'
import { isLoadedLocation } from './location'

export interface CameraBasis {
    readonly anchor: Vector3;
    readonly forward: Vector3;
    readonly right: Vector3;
}

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

export function shotLocation(basis: CameraBasis, distance: number, side: number, height: number): Vector3 {
    const { anchor, forward, right } = basis;
    return {
        x: anchor.x + forward.x * distance + right.x * side,
        y: anchor.y + height,
        z: anchor.z + forward.z * distance + right.z * side
    };
}

export function clearShotLocation(dimension: Dimension, anchor: Vector3, desired: Vector3): Vector3 {
    const dx = desired.x - anchor.x;
    const dy = desired.y - anchor.y;
    const dz = desired.z - anchor.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length < 0.01) return desired;
    const direction = { x: dx / length, y: dy / length, z: dz / length };
    if (!isLoadedLocation(dimension, anchor)) return desired;
    const hit = dimension.getBlockFromRay(anchor, direction, { maxDistance: length, includePassableBlocks: false });
    if (!hit) return desired;
    const { x, y, z } = hit.block.location;
    const hitDistance = Math.sqrt((x + hit.faceLocation.x - anchor.x) ** 2 + (y + hit.faceLocation.y - anchor.y) ** 2 + (z + hit.faceLocation.z - anchor.z) ** 2);
    const safe = Math.max(hitDistance - 0.35, 0.6);
    return { x: anchor.x + direction.x * safe, y: anchor.y + direction.y * safe, z: anchor.z + direction.z * safe };
}

import type { Dimension, Vector3 } from '@minecraft/server'

export function isLoadedLocation(dimension: Dimension, location: Vector3): boolean {
    const { min, max } = dimension.heightRange;
    if (location.y < min || location.y >= max) return false;
    return dimension.isChunkLoaded(location);
}

export function isOpenLocation(dimension: Dimension, location: Vector3): boolean {
    if (!isLoadedLocation(dimension, location)) return false;
    const block = dimension.getBlock(location);
    return block !== undefined && (block.isAir || block.isLiquid);
}

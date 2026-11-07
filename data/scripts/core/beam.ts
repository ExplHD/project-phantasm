import { type Dimension, type Vector3 } from "@minecraft/server";
import { isLoadedLocation } from "./location";

const CORE_STEP = 0.25;
const SPIRAL_STEP = 0.25;
const SPIRAL_START = 0.6;
const SPIRAL_RADIUS = 0.55;
const SPIRAL_TURN_LENGTH = 1.6;

function offset(origin: Vector3, dir: Vector3, scale: number): Vector3 {
	return { x: origin.x + dir.x * scale, y: origin.y + dir.y * scale, z: origin.z + dir.z * scale };
}

function cross(a: Vector3, b: Vector3): Vector3 {
	return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function unit(v: Vector3): Vector3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function spawn(dimension: Dimension, id: string, location: Vector3): void {
	if (!isLoadedLocation(dimension, location)) return;
	dimension.spawnParticle(id, location);
}

export function spawnPolarisBeam(dimension: Dimension, start: Vector3, dir: Vector3, length: number): void {
	const up = Math.abs(dir.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
	const u = unit(cross(dir, up));
	const v = cross(dir, u);

	for (let d = 0; d <= length; d += CORE_STEP) spawn(dimension, "ph:polaris_beam_core", offset(start, dir, d));

	for (let d = SPIRAL_START; d <= length; d += SPIRAL_STEP) {
		const angle = (d / SPIRAL_TURN_LENGTH) * Math.PI * 2;
		const center = offset(start, dir, d);
		for (const phase of [0, Math.PI]) {
			const cos = Math.cos(angle + phase) * SPIRAL_RADIUS;
			const sin = Math.sin(angle + phase) * SPIRAL_RADIUS;
			spawn(dimension, "ph:polaris_beam_spiral", offset(offset(center, u, cos), v, sin));
		}
	}
	spawn(dimension, "ph:polaris_impact", offset(start, dir, length));
}

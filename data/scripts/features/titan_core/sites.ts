import { world, Dimension, StructureRotation, type Vector3 } from "@minecraft/server";
import { inTitanRidge } from "../../systems/xeonniteBlessing";
import { isLoadedLocation } from "../../core/location";

const RIDGE_TAG = "ph:titan_ridge";
const PROPERTY_PREFIX = "ph:titan_ridge_site_";

const CORE_NAMES = ["mystructure:titan_ridge/tr_core", "titan_ridge:tr_core"];
const GATEWAY_NAMES = ["mystructure:titan_ridge/tr_gateway", "titan_ridge:tr_gateway"];
const CORE_SIZE = 9;
const GATEWAY_SIZE = 11;

const GROUND = new Set([
	"minecraft:cobbled_deepslate",
	"minecraft:tuff",
	"minecraft:stone",
	"minecraft:deepslate",
	"minecraft:gravel",
	"minecraft:dirt",
	"minecraft:coarse_dirt",
	"minecraft:granite",
	"minecraft:diorite",
	"minecraft:andesite"
]);
const FILL_BLOCK = "minecraft:cobbled_deepslate";

const MAX_SCAN_CELLS = 1024;
const MAX_STORED_CELLS = 2500;
const NEARBY_SITE = 256;
const MAX_STEP = 2;
const MIN_GAP = 32;
const PLAYER_CLEARANCE = 8;
const MAX_CANDIDATES = 48;

const ROTATIONS = [StructureRotation.None, StructureRotation.Rotate90, StructureRotation.Rotate180, StructureRotation.Rotate270];

interface RidgeData {
	readonly core: Vector3;
	readonly gateway: Vector3;
	cells: string[];
}

interface Ridge {
	readonly id: string;
	readonly data: RidgeData;
	readonly cells: Set<string>;
}

let ridges: Ridge[] | undefined;
let warnedMissing = false;
let lastScanCell = new Map<string, string>();

function loadRidges(): Ridge[] {
	if (ridges) return ridges;
	ridges = [];
	for (const id of world.getDynamicPropertyIds()) {
		if (!id.startsWith(PROPERTY_PREFIX)) continue;
		const raw = world.getDynamicProperty(id);
		if (typeof raw !== "string" || !raw.startsWith("{") || !raw.endsWith("}")) continue;
		const data = JSON.parse(raw) as Partial<RidgeData>;
		if (!data.core || !data.gateway || !Array.isArray(data.cells)) continue;
		ridges.push({ id, data: data as RidgeData, cells: new Set(data.cells) });
	}
	return ridges;
}

function saveRidge(ridge: Ridge): void {
	ridge.data.cells = [...ridge.cells];
	world.setDynamicProperty(ridge.id, JSON.stringify(ridge.data));
}

function cellKey(cx: number, cz: number): string {
	return `${cx},${cz}`;
}

function cellCenter(key: string): { x: number; z: number } {
	const [cx, cz] = key.split(",").map(Number);
	return { x: cx * 16 + 8, z: cz * 16 + 8 };
}

function scanRidge(dimension: Dimension, origin: Vector3): { cells: Set<string>; complete: boolean } {
	const start = cellKey(Math.floor(origin.x / 16), Math.floor(origin.z / 16));
	const cells = new Set<string>([start]);
	const seen = new Set<string>([start]);
	const queue = [start];
	let complete = true;

	while (queue.length > 0) {
		const key = queue.pop()!;
		const [cx, cz] = key.split(",").map(Number);
		if (key !== start) {
			const center = { x: cx * 16 + 8, y: origin.y, z: cz * 16 + 8 };
			if (!isLoadedLocation(dimension, center)) {
				complete = false;
				continue;
			}
			if (!dimension.getBiome(center).hasTags([RIDGE_TAG])) continue;
			cells.add(key);
			if (cells.size >= MAX_SCAN_CELLS) return { cells, complete: false };
		}
		for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const next = cellKey(cx + dx, cz + dz);
			if (seen.has(next)) continue;
			seen.add(next);
			queue.push(next);
		}
	}
	return { cells, complete };
}

function horizontalDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

function findSpot(dimension: Dimension, x: number, z: number, size: number, players: Vector3[]): Vector3 | undefined {
	const x0 = x - Math.floor(size / 2);
	const z0 = z - Math.floor(size / 2);
	const middle = { x: x0 + size / 2, z: z0 + size / 2 };
	if (players.some(p => horizontalDistance(p, middle) < size / 2 + PLAYER_CLEARANCE)) return undefined;

	const minY = dimension.heightRange.min;
	let highest = -Infinity;
	let lowest = Infinity;
	for (let bx = x0 - 1; bx <= x0 + size; bx++) {
		for (let bz = z0 - 1; bz <= z0 + size; bz++) {
			if (!dimension.isChunkLoaded({ x: bx, y: minY, z: bz })) return undefined;
			const block = dimension.getTopmostBlock({ x: bx, z: bz });
			if (!block || !GROUND.has(block.typeId)) return undefined;
			highest = Math.max(highest, block.location.y);
			lowest = Math.min(lowest, block.location.y);
			if (highest - lowest > MAX_STEP) return undefined;
		}
	}
	return { x: x0, y: highest + 1, z: z0 };
}

function fillUnder(dimension: Dimension, corner: Vector3, size: number): void {
	for (let x = corner.x; x < corner.x + size; x++) {
		for (let z = corner.z; z < corner.z + size; z++) {
			const top = dimension.getTopmostBlock({ x, z })?.location.y ?? corner.y - 1;
			for (let y = top + 1; y < corner.y; y++) {
				dimension.getBlock({ x, y, z })?.setType(FILL_BLOCK);
			}
		}
	}
}

function areaLoaded(dimension: Dimension, corner: Vector3, size: number): boolean {
	const far = { x: corner.x + size - 1, y: corner.y, z: corner.z + size - 1 };
	return isLoadedLocation(dimension, corner) && isLoadedLocation(dimension, far)
		&& dimension.isChunkLoaded({ x: far.x, y: corner.y, z: corner.z })
		&& dimension.isChunkLoaded({ x: corner.x, y: corner.y, z: far.z });
}

function placeStructure(names: string[], dimension: Dimension, corner: Vector3, size: number): boolean {
	const rotation = ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
	const name = names.find(candidate => world.structureManager.get(candidate) !== undefined);
	if (!name) {
		if (!warnedMissing) {
			warnedMissing = true;
			console.warn(`[Titan Ridge] could not place ${names[0]}`);
		}
		return false;
	}
	if (!areaLoaded(dimension, corner, size)) return false;

	fillUnder(dimension, corner, size);
	world.structureManager.place(name, dimension, corner, { rotation });
	return true;
}

function placePair(dimension: Dimension, cells: Set<string>): void {
	const centers = [...cells].map(cellCenter);
	const centroid = {
		x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
		z: centers.reduce((sum, c) => sum + c.z, 0) / centers.length
	};
	centers.sort((a, b) => horizontalDistance(a, centroid) - horizontalDistance(b, centroid));
	const players = dimension.getPlayers().map(p => p.location);

	let core: Vector3 | undefined;
	let gateway: Vector3 | undefined;
	for (const center of centers.slice(0, MAX_CANDIDATES)) {
		if (!core) {
			core = findSpot(dimension, center.x, center.z, CORE_SIZE, players);
			continue;
		}
		if (horizontalDistance(center, core) < MIN_GAP) continue;
		gateway = findSpot(dimension, center.x, center.z, GATEWAY_SIZE, players);
		if (gateway) break;
	}

	if (!core || !gateway) return;

	if (!placeStructure(CORE_NAMES, dimension, core, CORE_SIZE)) return;
	placeStructure(GATEWAY_NAMES, dimension, gateway, GATEWAY_SIZE);

	const all = loadRidges();
	const ridge: Ridge = { id: `${PROPERTY_PREFIX}${all.length}`, data: { core, gateway, cells: [] }, cells };
	all.push(ridge);
	saveRidge(ridge);
}

export function tickTitanRidgeSites(): void {
	const scanned = new Set<string>();
	const lastCells = new Map<string, string>();
	for (const player of world.getPlayers()) {
		if (!player.isValid) continue;
		const dimension = player.dimension;
		if (dimension.id !== "minecraft:overworld" || !inTitanRidge(player)) continue;

		const startKey = cellKey(Math.floor(player.location.x / 16), Math.floor(player.location.z / 16));
		lastCells.set(player.id, startKey);
		if (scanned.has(startKey) || lastScanCell.get(player.id) === startKey) continue;
		if (loadRidges().some(ridge => ridge.cells.has(startKey))) continue;
		const scan = scanRidge(dimension, player.location);
		scan.cells.forEach(cell => scanned.add(cell));

		const known = loadRidges().find(ridge => [...scan.cells].some(cell => ridge.cells.has(cell)));
		if (known) {
			const before = known.cells.size;
			for (const cell of scan.cells) {
				if (known.cells.size >= MAX_STORED_CELLS) break;
				known.cells.add(cell);
			}
			if (known.cells.size !== before) saveRidge(known);
			continue;
		}
		if (!scan.complete && loadRidges().some(ridge => horizontalDistance(ridge.data.core, player.location) < NEARBY_SITE)) continue;

		placePair(dimension, scan.cells);
	}
	lastScanCell = lastCells;
}

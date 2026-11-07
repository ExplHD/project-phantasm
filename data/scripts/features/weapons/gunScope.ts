import { EasingType, EquipmentSlot, type ItemStack, type Player } from "@minecraft/server";
import { GUN_SCOPES } from "./gunSpecs";

const SCOPE_EASE = 0.2;

const scoped = new Map<string, Player>();

function heldScope(player: Player): number | undefined {
	const id = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId;
	return id === undefined ? undefined : GUN_SCOPES.get(id);
}

function scopeIn(player: Player, fov: number): void {
	if (scoped.has(player.id) || !player.camera.isValid) return;
	scoped.set(player.id, player);
	player.camera.setFov({ fov, easeOptions: { easeTime: SCOPE_EASE, easeType: EasingType.OutQuad } });
}

function scopeOut(id: string): void {
	const player = scoped.get(id);
	if (!player) return;
	scoped.delete(id);
	if (!player.isValid) return;
	player.runCommand(`camera @s fov_clear ${SCOPE_EASE} out_quad`);
}

export function onGunScopeSneak(player: Player, pressed: boolean): void {
	if (!player.isValid) return;
	if (!pressed) {
		scopeOut(player.id);
		return;
	}
	const fov = heldScope(player);
	if (fov !== undefined) scopeIn(player, fov);
}

export function onGunScopeSlotChange(player: Player, itemStack: ItemStack | undefined): void {
	if (!player.isValid) return;
	const fov = itemStack ? GUN_SCOPES.get(itemStack.typeId) : undefined;
	if (fov !== undefined && player.isSneaking) {
		scopeOut(player.id);
		scopeIn(player, fov);
		return;
	}
	scopeOut(player.id);
}

export function clearGunScopeState(playerId: string): void {
	scoped.delete(playerId);
}

export function tickGunScopes(): void {
	if (scoped.size === 0) return;
	for (const [id, player] of scoped) {
		if (!player.isValid) {
			scoped.delete(id);
			continue;
		}
		if (!player.isSneaking || heldScope(player) === undefined) scopeOut(id);
	}
}

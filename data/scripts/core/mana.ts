import { system, type Player } from "@minecraft/server";
import { getScore, removeScore } from "./scoreboard";

export const MANA_OBJECTIVE = "mana";
export const MANA_MAX = 200;

const DENY_TICKS = 20;
const lastDenied = new Map<string, number>();

export function spendMana(player: Player, cost: number | undefined): boolean {
	if (!cost) return true;
	if (!player.isValid) return false;
	const mana = getScore(player, MANA_OBJECTIVE);
	if (mana >= cost) {
		removeScore(player, MANA_OBJECTIVE, cost);
		return true;
	}
	const now = system.currentTick;
	if (now - (lastDenied.get(player.id) ?? -DENY_TICKS) < DENY_TICKS) return false;
	lastDenied.set(player.id, now);
	player.playSound("note.bass");
	player.sendMessage(`§9Not enough mana. §7Needs ${cost}, you have ${mana}/${MANA_MAX}.`);
	return false;
}

export function forgetMana(playerId: string): void {
	lastDenied.delete(playerId);
}

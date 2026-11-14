import { type ItemStack, type Player } from "@minecraft/server";
import { type ProjectileConfig, fireProjectile } from "./projectile";
import { applyDurabilityDamage } from "../../core/items";
import { getScore, removeScore } from "../../core/scoreboard";
import { spendMana } from "../../core/mana";
import { summonOwned } from "../../core/summons";
import { isLoadedLocation } from "../../core/location";
import { SINGLE_GUNS } from "./gunSpecs";

export interface Shooter {
	readonly projectile: ProjectileConfig;
	readonly sound: string;
	readonly chargeCost?: number;
	readonly mana?: number;
	readonly sneakMana?: number;
	readonly animation?: string;
	readonly sneakAttack?: (player: Player, sound: string) => void;
}

const CHARGE_OBJECTIVE = "auric_charge";
const MUZZLE = { forward: 0.6, side: 0, up: 0 };

function oceanicAttack(player: Player, sound: string): void {
	player.startItemCooldown("nature_staff", 50);
	summonOwned(player, "summon ph:ocean_crystal_wave ~~~5 0 0");
	summonOwned(player, "summon ph:ocean_crystal_wave ~-5~~ 90 0");
	summonOwned(player, "summon ph:ocean_crystal_wave ~~~-5 180 0");
	summonOwned(player, "summon ph:ocean_crystal_wave ~5~~ 270 0");
	playShot(player, sound);
}

const SHOOTERS: Readonly<Record<string, Shooter>> = {
	...SINGLE_GUNS,
	"ph:nature_staff": {
		projectile: {
			trail: "ph:nature_staff_laser_trail",
			damage: 14,
			speed: 2,
			range: 100,
			pierce: Infinity,
			lockCone: 0,
			origin: MUZZLE
		},
		sound: "weapon_slash.magic_staff",
		mana: 24,
		sneakMana: 60,
		sneakAttack: oceanicAttack
	}
};

function playShot(player: Player, sound: string): void {
	if (!isLoadedLocation(player.dimension, player.location)) return;
	player.dimension.playSound(sound, player.location);
}

function payCharge(player: Player, cost: number | undefined): boolean {
	if (cost === undefined) return true;
	if (getScore(player, CHARGE_OBJECTIVE) < cost) {
		player.sendMessage("Insufficient Charges");
		return false;
	}
	removeScore(player, CHARGE_OBJECTIVE, cost);
	return true;
}

export function onShooterUse(player: Player, itemStack: ItemStack): void {
	const shooter = SHOOTERS[itemStack.typeId];
	if (!shooter || !player.isValid) return;

	if (player.isSneaking && shooter.sneakAttack) {
		if (!spendMana(player, shooter.sneakMana)) return;
		applyDurabilityDamage(player, { damage: 1 });
		shooter.sneakAttack(player, shooter.sound);
		return;
	}

	if (!payCharge(player, shooter.chargeCost)) return;
	if (!spendMana(player, shooter.mana)) return;
	applyDurabilityDamage(player, { damage: 1 });

	const cooldown = itemStack.getComponent("cooldown");
	if (cooldown?.cooldownCategory) player.startItemCooldown(cooldown.cooldownCategory, cooldown.cooldownTicks);
	if (shooter.animation) player.playAnimation(shooter.animation);

	fireProjectile(player, shooter.projectile);
	playShot(player, shooter.sound);
}

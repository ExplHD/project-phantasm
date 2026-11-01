import {
	system,
	world,
	ContainerSlot,
	EffectAddBeforeEvent,
	EntityDamageCause,
	EntityEquippableComponent,
	EntityHurtBeforeEvent,
	EntityOnFireComponent,
	EquipmentSlot,
	GameMode,
	ItemCooldownComponent,
	ItemDurabilityComponent,
	ItemEnchantableComponent,
	ItemStack,
	Player,
	StartupEvent
} from "@minecraft/server";

// ======================================== Custom Shields ========================================
// Port of the Alien-Edds shield template (github.com/Alien-Edds/Shield). Any item with the
// ph:shield component works as a shield from either hand: sneaking raises it, and a hit
// coming from in front of the player is cancelled and taken out of the shield's durability
// instead. Axes, Vindicators, Piglin Brutes and Warden melee put it on the item's
// minecraft:cooldown. The first `delay` seconds after raising it (or after swinging) don't block.
//
// Item params (all optional):
//   block          sound played on a blocked hit
//   delay          seconds before a raised shield starts blocking
//   command        command the player runs on a blocked hit
//   disable_sound  sound played when the shield gets disabled
//   knockback      { x: horizontal, y: vertical } pushed onto the melee attacker

const COMPONENT_ID = "ph:shield";

interface ShieldParams {
	block?: string;
	delay?: number;
	command?: string;
	disable_sound?: string;
	knockback?: { x?: number; y?: number };
}

interface HeldShield {
	item: ItemStack;
	slot: ContainerSlot;
	hand: "main_hand" | "off_hand";
}

// Per-shield extra behavior on a blocked hit, keyed by item id.
const onBlock: Record<string, (data: { item: ItemStack; slot: ContainerSlot; source: Player; event: EntityHurtBeforeEvent }) => void> = {};

const shielding = new Set<string>();
const usingItem = new Set<string>();
const heldShield = new Map<string, string>();
const animations = new Map<string, string>();
// Run ids of the raise delay; a player is not blocking while one is pending.
const delays = new Map<string, number>();
// Same delay, but only the visual one hides the blocking pose (sneaking again keeps the pose).
const visualDelays = new Map<string, number>();
// Players whose hurt was just blocked: the effects that hit would have applied are dropped.
const cancelledEffects = new Set<string>();

function getParams(item: ItemStack): ShieldParams {
	return (item.getComponent(COMPONENT_ID)?.customComponentParameters.params ?? {}) as ShieldParams;
}

function onCooldown(player: Player, item: ItemStack): boolean {
	return (item.getComponent(ItemCooldownComponent.componentId)?.getCooldownTicksRemaining(player) ?? 0) > 0;
}

function getHeldShield(player: Player, withCooldown = true): HeldShield | undefined {
	const isValid = (item: ItemStack | undefined): item is ItemStack =>
		!!item && item.hasComponent(COMPONENT_ID) && !(withCooldown && onCooldown(player, item));

	const equippable = player.getComponent(EntityEquippableComponent.componentId);
	if (!equippable) return undefined;
	const offhand = equippable.getEquipmentSlot(EquipmentSlot.Offhand);
	const offItem = offhand.getItem();
	if (isValid(offItem)) return { item: offItem, slot: offhand, hand: "off_hand" };
	const mainhand = equippable.getEquipmentSlot(EquipmentSlot.Mainhand);
	const mainItem = mainhand.getItem();
	if (isValid(mainItem)) return { item: mainItem, slot: mainhand, hand: "main_hand" };
	return undefined;
}

function clearRun(map: Map<string, number>, id: string): void {
	const run = map.get(id);
	if (run !== undefined) system.clearRun(run);
	map.delete(id);
}

function startDelay(player: Player, seconds: number, visual = true): void {
	const id = player.id;
	clearRun(delays, id);
	delays.set(id, system.runTimeout(() => delays.delete(id), seconds * 20));
	if (!visual) {
		visualDelays.delete(id);
		return;
	}
	clearRun(visualDelays, id);
	visualDelays.set(id, system.runTimeout(() => visualDelays.delete(id), seconds * 20));
}

function stopAnimation(player: Player, animation: string): void {
	player.playAnimation(animation, { blendOutTime: 0, stopExpression: "return true;" });
}

export function registerShieldComponent({ itemComponentRegistry }: StartupEvent): void {
	itemComponentRegistry.registerCustomComponent(COMPONENT_ID, {});
}

/** Every tick: tracks who is shielding and keeps the arm pose in sync. */
export function tickShields(): void {
	for (const player of world.getAllPlayers()) {
		const id = player.id;
		const shield = getHeldShield(player);
		const delay = shield ? getParams(shield.item).delay : undefined;

		if (shield?.item.typeId !== heldShield.get(id)) {
			if (!shield) clearRun(delays, id);
			if (delay !== undefined) startDelay(player, delay);
		}

		const idle = usingItem.has(id) || visualDelays.has(id) || !player.isSneaking || !shield;
		const current = animations.get(id);
		const anim = idle ? undefined : `animation.ph.player.shield_block_${shield.hand}`;
		if (anim !== current) {
			if (current) stopAnimation(player, current);
			if (anim) player.playAnimation(anim, { blendOutTime: 99999, stopExpression: "q.is_sneaking" });
		}
		if (anim) animations.set(id, anim);
		else animations.delete(id);

		if (shield) heldShield.set(id, shield.item.typeId);
		else heldShield.delete(id);

		if (shield && player.isSneaking) shielding.add(id);
		else shielding.delete(id);
	}
}

/** Sneak press restarts the raise delay; releasing it clears the delay. */
export function onShieldSneak(player: Player, pressed: boolean): void {
	if (!pressed) {
		clearRun(delays, player.id);
		return;
	}
	const shield = getHeldShield(player);
	const delay = shield ? getParams(shield.item).delay : undefined;
	if (delay !== undefined) startDelay(player, delay, false);
}

/** Swinging while sneaking lowers the shield for its delay. */
export function onShieldSwing(player: Player): void {
	if (!player.isSneaking) return;
	const shield = getHeldShield(player);
	const delay = shield ? getParams(shield.item).delay : undefined;
	if (delay !== undefined) startDelay(player, delay);
}

export function onShieldItemUse(player: Player, using: boolean): void {
	if (using) usingItem.add(player.id);
	else usingItem.delete(player.id);
}

export function onShieldHurt(data: EntityHurtBeforeEvent): void {
	if (!(data.hurtEntity instanceof Player)) return;
	const player = data.hurtEntity;
	const id = player.id;
	if (!shielding.has(id) || delays.has(id) || usingItem.has(id)) return;

	const source = data.damageSource;
	const damageLocation = source.damagingEntity?.location ?? source.damagingProjectile?.location;
	if (!damageLocation) return;

	// Only hits from the half the player faces are blocked.
	const playerLoc = player.location;
	const view = player.getViewDirection();
	const toDamage = { x: damageLocation.x - playerLoc.x, z: damageLocation.z - playerLoc.z };
	if (toDamage.x * view.x + toDamage.z * view.z < 0) return;

	// Undo armor and Protection so the shield wears from the raw hit, like vanilla.
	let rawDamage = data.damage;
	const equippable = player.getComponent(EntityEquippableComponent.componentId);
	if (equippable) {
		let protection = 0;
		for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
			const ench = equippable.getEquipment(slot)?.getComponent(ItemEnchantableComponent.componentId);
			protection += ench?.getEnchantment("protection")?.level ?? 0;
			if (source.cause === EntityDamageCause.projectile) protection += ench?.getEnchantment("projectile_protection")?.level ?? 0;
		}
		const armor = Math.min(equippable.totalArmor, 20);
		if (armor) rawDamage /= 1 - armor * 0.04;
		if (protection) rawDamage /= 1 - Math.min(protection, 20) * 0.04;
	}

	const attacker = source.damagingEntity;
	let disables = false;
	if (attacker) {
		disables =
			attacker.typeId === "minecraft:vindicator" ||
			attacker.typeId === "minecraft:piglin_brute" ||
			(attacker.typeId === "minecraft:warden" && source.cause === EntityDamageCause.entityAttack) ||
			!!attacker.getComponent(EntityEquippableComponent.componentId)?.getEquipment(EquipmentSlot.Mainhand)?.hasTag("minecraft:is_axe");
	}

	const hadFire = player.getComponent(EntityOnFireComponent.componentId) !== undefined;
	data.cancel = true;
	cancelledEffects.add(id);

	system.run(() => {
		cancelledEffects.delete(id);
		if (!player.isValid) return;
		const shield = getHeldShield(player);
		if (!shield) return;
		const params = getParams(shield.item);

		if (attacker?.isValid && attacker.typeId === "minecraft:ravager" && source.cause === EntityDamageCause.entityAttack) {
			attacker.triggerEvent("minecraft:become_stunned");
		}
		if (!hadFire && player.getComponent(EntityOnFireComponent.componentId)) player.extinguishFire();
		onBlock[shield.item.typeId]?.({ event: data, item: shield.item, source: player, slot: shield.slot });

		if (shield.item.hasComponent(ItemDurabilityComponent.componentId)) {
			shield.slot.setItem(wearShield(player, shield.item, Math.floor(rawDamage) + 1));
		}

		if (params.knockback && attacker?.isValid && !source.damagingProjectile) {
			const total = Math.abs(toDamage.x) + Math.abs(toDamage.z) || 1;
			const strength = params.knockback.x ?? 0;
			try {
				attacker.applyKnockback({ x: (toDamage.x / total) * strength, z: (toDamage.z / total) * strength }, params.knockback.y ?? 0.1);
			} catch {
				// Some entities (e.g. bosses with knockback_resistance setups) reject knockback.
			}
		}

		if (params.block) player.dimension.playSound(params.block, player.location);
		if (params.command) player.runCommand(params.command);
		const cooldown = shield.item.getComponent(ItemCooldownComponent.componentId);
		if (cooldown && disables) {
			cooldown.startCooldown(player);
			if (params.disable_sound) player.dimension.playSound(params.disable_sound, player.location);
		}
	});
}

export function onShieldEffectAdd(data: EffectAddBeforeEvent): void {
	if (cancelledEffects.has(data.entity.id)) data.cancel = true;
}

export function clearShieldState(playerId: string): void {
	shielding.delete(playerId);
	usingItem.delete(playerId);
	heldShield.delete(playerId);
	animations.delete(playerId);
	clearRun(delays, playerId);
	clearRun(visualDelays, playerId);
}

function wearShield(player: Player, item: ItemStack, damage: number): ItemStack | undefined {
	if (player.getGameMode() === GameMode.Creative) return item;
	const durability = item.getComponent(ItemDurabilityComponent.componentId);
	if (!durability) return item;
	const unbreaking = item.getComponent(ItemEnchantableComponent.componentId)?.getEnchantment("unbreaking");
	// Unbreaking N: each block only wears the shield with a 1 / (N + 1) chance.
	if (unbreaking && Math.random() >= 1 / (unbreaking.level + 1)) return item;
	if (durability.damage + damage > durability.maxDurability) {
		player.dimension.playSound("random.break", player.location);
		return undefined;
	}
	durability.damage += damage;
	return item;
}

import { world, system } from '@minecraft/server'

// ======================================== World Before Events ========================================

world.beforeEvents.effectAdd.subscribe((event) => {})

world.beforeEvents.entityHeal.subscribe((event) => {})

world.beforeEvents.entityHurt.subscribe((event) => {})

world.beforeEvents.entityItemPickup.subscribe((event) => {})

world.beforeEvents.entityRemove.subscribe((event) => {})

world.beforeEvents.explosion.subscribe((event) => {})

world.beforeEvents.itemUse.subscribe((event) => {})

world.beforeEvents.playerBreakBlock.subscribe((event) => {})

world.beforeEvents.playerGameModeChange.subscribe((event) => {})

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {})

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {})

world.beforeEvents.playerLeave.subscribe((event) => {})

world.beforeEvents.weatherChange.subscribe((event) => {})

// ======================================== World After Events ========================================

world.afterEvents.blockContainerClosed.subscribe((event) => {})

world.afterEvents.blockContainerOpened.subscribe((event) => {})

world.afterEvents.blockExplode.subscribe((event) => {})

world.afterEvents.buttonPush.subscribe((event) => {})

world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {})

world.afterEvents.effectAdd.subscribe((event) => {})

world.afterEvents.entityContainerClosed.subscribe((event) => {})

world.afterEvents.entityContainerOpened.subscribe((event) => {})

world.afterEvents.entityDie.subscribe((event) => {})

world.afterEvents.entityHeal.subscribe((event) => {})

world.afterEvents.entityHealthChanged.subscribe((event) => {})

world.afterEvents.entityHitBlock.subscribe((event) => {})

world.afterEvents.entityHitEntity.subscribe((event) => {})

world.afterEvents.entityHurt.subscribe((event) => {})

world.afterEvents.entityItemDrop.subscribe((event) => {})

world.afterEvents.entityItemPickup.subscribe((event) => {})

world.afterEvents.entityLoad.subscribe((event) => {})

world.afterEvents.entityRemove.subscribe((event) => {})

world.afterEvents.entitySpawn.subscribe((event) => {})

world.afterEvents.entityUpgrade.subscribe((event) => {})

world.afterEvents.explosion.subscribe((event) => {})

world.afterEvents.gameRuleChange.subscribe((event) => {})

world.afterEvents.itemCompleteUse.subscribe((event) => {})

world.afterEvents.itemReleaseUse.subscribe((event) => {})

world.afterEvents.itemStartUse.subscribe((event) => {})

world.afterEvents.itemStartUseOn.subscribe((event) => {})

world.afterEvents.itemStopUse.subscribe((event) => {})

world.afterEvents.itemStopUseOn.subscribe((event) => {})

world.afterEvents.itemUse.subscribe((event) => {})

world.afterEvents.leverAction.subscribe((event) => {})

world.afterEvents.pistonActivate.subscribe((event) => {})

world.afterEvents.playerBreakBlock.subscribe((event) => {})

world.afterEvents.playerButtonInput.subscribe((event) => {})

world.afterEvents.playerDimensionChange.subscribe((event) => {})

world.afterEvents.playerEmote.subscribe((event) => {})

world.afterEvents.playerGameModeChange.subscribe((event) => {})

world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {})

world.afterEvents.playerInputModeChange.subscribe((event) => {})

world.afterEvents.playerInputPermissionCategoryChange.subscribe((event) => {})

world.afterEvents.playerInteractWithBlock.subscribe((event) => {})

world.afterEvents.playerInteractWithEntity.subscribe((event) => {})

world.afterEvents.playerInventoryItemChange.subscribe((event) => {})

world.afterEvents.playerJoin.subscribe((event) => {})

world.afterEvents.playerLeave.subscribe((event) => {})

world.afterEvents.playerPlaceBlock.subscribe((event) => {})

world.afterEvents.playerSpawn.subscribe((event) => {})

world.afterEvents.playerSwingStart.subscribe((event) => {})

world.afterEvents.pressurePlatePop.subscribe((event) => {})

world.afterEvents.pressurePlatePush.subscribe((event) => {})

world.afterEvents.projectileHitBlock.subscribe((event) => {})

world.afterEvents.projectileHitEntity.subscribe((event) => {})

world.afterEvents.targetBlockHit.subscribe((event) => {})

world.afterEvents.tripWireTrip.subscribe((event) => {})

world.afterEvents.weatherChange.subscribe((event) => {})

world.afterEvents.worldLoad.subscribe((event) => {})

// ======================================== System Before Events ========================================

system.beforeEvents.shutdown.subscribe((event) => {})

system.beforeEvents.startup.subscribe((event) => {})

// ======================================== System After Events ========================================

system.afterEvents.scriptEventReceive.subscribe((event) => {})

// Entry point for the Phantasm behavior pack.
//
// This file is wiring only: every import below exists purely for its side effects (event
// subscriptions, component registration, startup timers). Shared helpers live in core/ so
// that nothing has to import this file to reach them.
//
// This path is resolved by the esbuild Regolith filter and by the BP manifest
// ("entry": "scripts/main.js"), so it must stay at data/scripts/main.ts.

import { } from './events/index'
import { } from './events/loader'
import { } from './features/blocks/customComponents'
import { } from './systems/accessories'
import { } from './systems/combatDummy'
import { } from './systems/damageIndicator'
import { } from './systems/lighting'
import { } from './systems/movement'
import { } from './ui/guide/main_guide'
import { } from './features/weapons/weapons'
// Credits to @biggamers4u for older mechanics, now ALL of the MECHANICS are remade by me.
import { } from './features/mace/detection'

console.warn("§a§lPhantasm 1.5.2 Activated!");
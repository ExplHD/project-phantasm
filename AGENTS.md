# AGENTS.md - Project Phantasm

Minecraft Bedrock addon built with Regolith. Behavior pack `packs/BP`, resource pack `packs/RP`, script source `data/scripts/`. Every custom id uses the `ph:` namespace.

## Commands

| Task | Command |
| --- | --- |
| Install deps | `bun install` (or `npm install`), then `rgl install` |
| Typecheck (run after every script change) | `npx tsc --noEmit -p data/scripts` |
| Build + export to the Minecraft dev folder | `rgl run` |
| Live rebuild | `rgl watch` |
| Write filter output back into `packs/` (before commit) | `rgl apply default` |
| Release `.mcaddon` (obfuscated) | `rgl run package-file` |
| Regenerate item rarity table by hand | `node filters/item_rarity/main.mjs` |

No package.json scripts, tests, linter or CI. The typecheck plus an in-game check is the whole verification loop. The typecheck must print nothing; `noUnusedLocals` and `noUnusedParameters` are on.

## Build pipeline

- `default` profile: `item_rarity` → `esbuild`. `package-file` adds `js_obfuscator` → `mcaddon`.
- `filters/item_rarity/main.mjs` reads `packs/BP/items/*.json` and writes `data/scripts/core/itemRarity.ts`. That file is generated: change item JSON or the filter, never the `.ts`.
- `esbuild` bundles `data/scripts/main.ts` into `packs/BP/scripts/main.js`. Never edit `main.js`.
- RP changes (models, animations, particles, textures, lang) need `/reload all` in-game; `/reload` alone only reloads BP.

## Versions

- `package.json`: `@minecraft/server ^2.11.0`, `@minecraft/server-ui ^2.3.0`, `typescript ^7`.
- `packs/BP/manifest.json`: `min_engine_version 1.26.0`, dependencies `@minecraft/server 2.11.0`, `@minecraft/server-ui 2.3.0`.
- When bumping a module, change both files together. Script API is checked against `node_modules/@minecraft/server/index.d.ts`; read it when unsure whether a method exists. Never guess an API.

## Script layout (`data/scripts/`)

Layers, top to bottom. A module imports only from layers above it, never sideways into a sibling layer's internals and never downward.

1. `core/` - helpers, constants, registries (`constants.ts`, `playerProperties.ts`, `summons.ts`, `location.ts`, `camera.ts`, `scoreboard.ts`, generated `itemRarity.ts`). Imports only `@minecraft/*` and other `core/` files.
2. `systems/` - world-reactive gameplay (accessories, movement, controls, lighting, damage indicator, combat dummy, loot beam, Xeonnite Blessing).
3. `features/` - content: `weapons/`, `blocks/`, `mace/`, `bosses/`, `shield/`, `titan_core/`, `ancient_sentinel/`, `forge_trooper/`, `polaris_power/`.
4. `ui/` - `forms/`, `guide/`, `commands.ts`.
5. `events/` - `index.ts` (all event subscriptions and global `system.run*` loops), `loader.ts` (load/spawn events, scoreboard objective list).
6. `main.ts` - side-effect imports only. Path is fixed (esbuild filter + manifest depend on it).

Path alias: `~/*` → `data/scripts/*`. `tsconfig` uses `verbatimModuleSyntax`, so type-only imports must be `import type`.

### Where things go

- `world.beforeEvents.*` / `world.afterEvents.*` subscriptions: only in `events/index.ts`, or `events/loader.ts` for load/spawn. Feature modules export handlers (`onTrooperHurt`, `tickShields`, ...) and `index.ts` wires them.
- Global `system.runInterval` / `system.runTimeout` / `system.run`: same two files. A `system.run` inside a handler to escape before-event read-only mode is fine where the handler lives.
- New scoreboard objective: add it to the `objectives` array in `events/loader.ts`.
- New player dynamic property: register it in `core/playerProperties.ts` so `/dynamicproperties`, join defaults and resets pick it up.
- Script-spawned summons that deal damage: go through `core/summons.ts` so ownership (Xeonnite Blessing checks) carries over.
- Legendary weapon list: `LEGENDARY_TIER` in `core/constants.ts`.

## TypeScript rules

- No `try`/`catch`. Use guard clauses (`if (!entity?.isValid) return;`).
- No `any`, including `as any` and `any[]`. Use real API types or `unknown` + narrowing.
- No comments or JSDoc in `.ts` files.
- Explicit return type on every function, including exported arrows.
- `const` over `let`, never `var`. `readonly` on fields that never change. `interface` for object shapes, `type` for unions.
- No unused symbols.
- Do not add new classes / function / files if there's already existing one.

### Script API guards

- Entities: check `isValid` before `triggerEvent`, `applyDamage`, `applyImpulse`, `playAnimation`, `setProperty`, `setDynamicProperty`, `runCommand`, component access.
- Locations: check `dimension.isChunkLoaded(loc)` (or `isLoadedLocation` from `core/location.ts`) before `getBlock`, `spawnParticle`, `spawnEntity`, `playSound`, `getEntities`.
- Components and scoreboard objectives can be `undefined`; check before use (`getObjective(...)`, `getScore(...) ?? 0`).
- Hot paths run every tick. Avoid per-tick allocations, full-world entity scans and repeated `/effect` or `fill` commands when the state hasn't changed.

## Content conventions

- Item and block descriptions are native lang keys in `packs/RP/texts/en_US.lang`, under the `## ITEM TOOLTIPS` section: `tile.<id>.tooltip=line one\nline two`. The `tile.` prefix applies to items and blocks. Vanilla ids drop the namespace (`tile.iron_sword.tooltip`). Lang comments start with `##`.
- Display names: `item.ph:<id>=Name` / `tile.ph:<id>.name=Name`.
- Bedrock locator and bone names used for particles must be lowercase snake_case. camelCase locators silently fail and spawn at model origin.
- 3D held weapons attach to `weapon_root`; `rightItem` has no effect on them.
- Items with `use_modifiers` ignore `minecraft:cooldown` for re-use. Gate re-use in `beforeEvents.itemUse`.
- Particle tint per variant: bake one particle file per variant and pick it from a controller or script. `q.variant` in `pre_effect_script` does not tint.
- Armor values above 20 are intentional (big-hit tanking); don't cap or "fix" them.
- Tick functions: `packs/BP/functions/tick.json` runs `game` and `weapons`.

## Changelog (`changes.txt`)

Log every user-visible change under the current version header (`Phantasm <version> :`), in the matching section:

```
# Removal :
- Removal - <what and why> - <author>
# Changes :
= Changes - <what and why> - <author>
# Addition :
+ Addition - <what and why> - <author>
```

Existing `Changes` lines often drop the literal `Changes -` and go straight into the description; either form is fine. Authors in use: `ExplerHD`, `zeromaster178`. Entries may be English or Indonesian; match the language the user is writing in. Name files, ids and numbers concretely.

## Skills (`.agents/skills/`)

Load the skill before doing the work it covers.

- Writing anything a person reads (lang strings, guide text in `ui/guide/`, `changes.txt`, README, commit messages, replies): `unslop`, then `clean-user-facing-text`, then `remove-ai-marks`. Not for code, ids or paths. `remove-ai-marks` needs its local service running (`~/watermarks-remover/server.py` on port 8765).
- Particles / VFX: `particle-jester` (pixel sprites: `pixelfx`).
- Player animations, first-person poses: `minecraft-player-animation`, `weight-driven-animation`.
- Models in Blockbench, attachables: `blockbench-workflow`, `attachable-uv-rotation`.
- Script cameras / cutscenes: `bedrock-camera`.
- Texturing: `pixelfx`.
- JSON UI (`packs/RP/ui/`): start at `mcbe-json-ui-master`; it routes to the specific `mcbe-json-ui-*` skill.

## Editor schema

`.zed/settings.json` maps `@minecraft/bedrock-schemas` to pack JSON. The entries are commented out for the user (they use their own schema), but agents should use those schema files under `node_modules/@minecraft/bedrock-schemas/schemas/` to validate BP/RP JSON. Don't uncomment or delete them.

## Repo notes

- `tes/` is a scratch area for previews and experiments (particle drafts, gifs). Not shipped.
- `packs/BP` and `packs/RP` are the real packs. After `rgl run`, confirm changes land there (`rgl apply default` when filter output must be committed).
- Commit only when asked. Branch is `main`.

## Done checklist

1. `npx tsc --noEmit -p data/scripts` prints nothing.
2. No `try`/`catch`, `any`, comments or unused symbols in touched `.ts` files.
3. Event subscriptions and global loops live in `events/`.
4. New ids use `ph:`; new items have a name and tooltip key in `en_US.lang`.
5. `changes.txt` has an entry.
6. Tell the user what to check in-game (`rgl run` / `rgl watch`, Content Log) and say plainly that you have not verified it in-game yourself.
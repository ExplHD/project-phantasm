# Gun spec format

One file per gun: `data/guns/<short id>.json`. `data/guns/auric_apex.json` is a complete example of a generated gun; copy it and change what differs.

## Top level

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | `ph:<snake_case>`. The short part names every generated file and Molang variable. |
| `name` | yes | Display name (lang `item.<id>` and `tile.<id>.name`). |
| `type` | yes | `single`, `auto` or `charge_beam`. Picks the runtime and the `mechanics` shape. |
| `assets` | yes | `true`: generate all pack files. `false`: the gun's pack files are hand-made, only `mechanics` + HUD are generated. |
| `mechanics` | yes | Runtime config, shape depends on `type` (below). Copied as-is into `gunSpecs.ts`, so `tsc` checks it. |
| `scope` | no | FOV while ADS (e.g. `30`, vanilla is ~70). Needs `pose.adsOn: "sneak"`. |
| `item` | assets | `rarity` (common/uncommon/rare/epic; legendary comes from gold `hover_text_color`, not supported here), `durability`, `movement` (speed multiplier while holding use, default 0.6, ignored for `single`), `enchantValue` (default 12), `cooldown` (`single` only, required: `{ "category": "ph:<id>_shot", "seconds": 0.4 }`). |
| `model` | assets | `geometry` (id inside the file), `file` (the `.geo.json` path), `texture` (path under `packs/RP`, no `.png`; a `.texture_set.json` next to it is picked up by the game), `iconScale` (optional; default fits the longest side into 28 px). |
| `twoHanded` | assets | `true` shows the left arm in first person. |
| `tooltip` | assets | Full lang value: lines joined with a literal `\n`, colour codes included, last line `§9Phantasm`. |
| `pose` | assets | See below. |
| `sounds` | no | `{ "<sound id>": { "file": "sounds/weapons/<name>", "volume": 1, "distance": 20, "subtitle": "subtitles.weapons.gunshot" } }`. The `.ogg` must exist. |

## pose

| Field | Meaning |
| --- | --- |
| `adsOn` | `"sneak"`: ADS pose while sneaking (and scope zoom if `scope` is set). `"use"`: ADS pose while holding use (MK.III style). |
| `kick` | Recoil. `category` = cooldown category the runtime starts on each shot (`single`: the item cooldown category; `auto`: `mechanics.shotCategory`; `charge_beam`: `mechanics.shotCategory`). `seconds` = how long the kick lasts (match the cooldown: `charge_beam` `recoilTicks / 20`, `auto` `interval / 20`, `single` `cooldown.seconds`). `push` = how far both FPP arms slide back. `pitch` = degrees the third-person right arm tips up. |
| `hold_fpp`, `ads_fpp` | First-person bones. Usually `rightArm` and `leftArm`, each `{ "rotation": [x, y, z], "position": [x, y, z] }`. |
| `hold`, `ads` | Third-person bones. `ads` overrides other animations; aim it with `q.target_x_rotation` / `q.target_y_rotation` (copy Apex). `weapon_root` can be rotated here too. |

Values may be numbers or Molang strings. The generator appends the kick to FPP arm position Z and third-person `rightArm` rotation X; don't add it yourself.

## mechanics by type

`single` (`Shooter` in `features/weapons/shooters.ts`; fired on `itemUse`):
`projectile` (`ProjectileConfig` in `projectile.ts`: `damage`, `speed`, `range`, `pierce`, `homing`, `lockCone`, `spread`, `origin` {forward, side, up}, `core`/`trail`/`impact` particles, `impactSound`, `knockback`, `blast`), `sound`, `chargeCost` (Auric Charge per shot, also adds the Auric Charge HUD line), `animation` (optional one-shot player animation).

`auto` (`AutoGun` in `features/weapons/autoGun.ts`; fires while use is held):
`shotCategory`, `raiseTicks` (delay before the first shot), `interval` (ticks between shots), `wear` (durability per shot), `muzzle`, `muzzleParticle`, `sound` {id, pitch, pitchJitter}, `projectile`, optional `heat` {objective, overheatObjective, max, perShot, coolDelay, coolRate, overheatCoolRate, steamInterval} (new scoreboard objectives are registered automatically through `GUN_OBJECTIVES`), optional `altFire` (sneak + hold, release to fire) {projectile, chargeTicks, chargeFxInterval, chargeParticle, interval, wear, sound, recoilAnimation, shake}.

`charge_beam` (`ChargeBeamGun` in `features/weapons/chargeBeamGun.ts`; hold to charge, release to fire):
`shotCategory`, `chargeTicks`, `minChargeTicks` (released earlier = misfire), `refireTicks`, `recoilTicks`, `chargeFxInterval`, `chargeSoundTicks` (length of the charge sound in ticks, used to cut it on early release), `damage` (at full charge), `minPower` (damage fraction at `minChargeTicks`), `range`, `maxTargets`, `pierceFalloff`, `pierceFloor`, `knockback`, `wear`, `auricCost` (0 = free), `muzzle`, `sounds` {charge, ready, fire}.

`muzzle` / `origin` are blocks from the eye: `forward` along the view, `side` to the right, `up` vertical. They only place particles and projectile starts; hit detection for `charge_beam` is from the eye.

## Model rules

Copy the skeleton of `packs/RP/models/entity/items/auric_apex.geo.json`: the full player bone chain (`root > waist > body > head/leftArm/rightArm`, legs under `root`, `cape`) with vanilla pivots, the gun under `weapon_root` (parent `rightArm`, pivot `[-6, 13, 0]`). The gun lies along -Y: grip near y 0-10, barrel toward negative Y, muzzle at the lowest Y. Extra bones under `weapon_root` (e.g. `mag`) are fine. Locator and bone names used for particles must be lowercase snake_case.

## What the generator owns

Per `assets` gun: `packs/BP/items/weapons/<short>.json`, `packs/BP/blocks/<short>.json`, `packs/RP/attachables/<short>.json`, `packs/RP/models/blocks/<short>.geo.json`, `packs/RP/animations/weapons/<short>.animation.json`, `packs/RP/animation_controllers/<short>.json`, its entries in `player.entity.json`, `weapons.render_controller.json`, `player.render_controllers.json`, `terrain_texture.json`, `en_US.lang`, `sound_definitions.json`.
Always: `data/scripts/features/weapons/gunSpecs.ts`, `packs/BP/functions/guns.mcfunction`, the `guns` entry in `tick.json`. It also re-runs `filters/item_rarity/main.mjs`.

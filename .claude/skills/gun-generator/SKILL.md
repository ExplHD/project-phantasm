---
name: gun-generator
description: Create a new gun (ranged weapon held in two hands or one) for Project Phantasm from a 3D model, asking the user for a first-person screenshot of how it should be held and translating it into the FPP animation. Covers the gun spec in data/guns/, the generator tools/gun_generator/main.mjs, firing types (single shot, automatic, charge beam), ADS/scope, sounds and in-game pose iteration. Use whenever the user asks for a new gun, blaster, rifle, sniper, railgun, pistol or similar, or wants to change an existing gun's pose, stats or firing.
---

# Gun generator

A gun is one JSON spec in `data/guns/<name>.json`. `node tools/gun_generator/main.mjs` turns every spec into the pack files and the mechanics config. You write the spec; the generator writes the files. Never hand-edit what the generator owns (listed in [spec.md](references/spec.md)); change the spec and re-run.

Reference guns, each a working spec in `data/guns/`:

| Gun | type | Feel | Spec |
| --- | --- | --- | --- |
| Peacemaker Oath | `single` | one projectile per click, item cooldown, costs Auric Charge | `peacemaker_oath.json` (hand-made assets, `"assets": false`) |
| Xeonnite Blaster MK.III | `auto` | hold to stream projectiles, heat/overheat, sneak + hold charges a homing missile | `xeonnite_blaster_mk3.json` (hand-made assets) |
| Auric Apex | `charge_beam` | hold to charge, release fires a piercing hitscan laser (Polaris beam), sneak = scoped ADS | `auric_apex.json` (fully generated, copy this one) |

## Workflow

1. **Collect the gun.** Ask only for what you can't find in the repo:
   - The model: path to the `.geo.json`, its geometry id, and the texture path. Check the model follows the [model rules](references/spec.md#model-rules) (bone `weapon_root` under `rightArm`, barrel along -Y). If it doesn't, tell the user what to fix in Blockbench; don't patch the geometry.
   - Name, rarity, durability, one or two hands.
   - Firing: which reference gun it should behave like, plus damage, range, fire rate / charge time, Auric Charge cost, scope zoom (FOV) or none.
   - What sneak does: ADS (`"adsOn": "sneak"`, the gun can zoom) or an alternate fire (`auto` only, then ADS is `"use"`).

2. **Ask for the FPP screenshots.** This is how the pose is decided. Ask the user for:
   - a screenshot (or a sketch, or a shot from another game) of how the gun should sit on screen when **just held**,
   - one for **ADS** (aiming down sights / scope).
   Say plainly that the first in-game result will be close, not exact, and that you'll tune it from an in-game screenshot.

3. **Translate the screenshots into the pose.** Read [fpp-poses.md](references/fpp-poses.md). Start from the reference gun whose screenshot looks closest, then move it with the axis table there. Describe what you read from the picture before writing numbers ("gun lower right, barrel angled ~15° toward the centre, left hand on the foregrip"), so the user can correct your reading.

4. **Sounds.** New sounds come from the `procedural-sfx` skill (AGENTS.md rules: venv Python, drafts in `tes/sfx/`, mono `.ogg` in `packs/RP/sounds/weapons/`). List them in the spec's `"sounds"`; the generator registers them in `sound_definitions.json`. Reusing an existing sound id is fine. The user must listen to every new sound in-game.

5. **Write the spec** in `data/guns/<name>.json` (format: [spec.md](references/spec.md)). The tooltip and name are user-facing text: run them through `unslop`, `clean-user-facing-text` and `remove-ai-marks` like any lang string.

6. **Generate and check.**
   ```bash
   node tools/gun_generator/main.mjs        # prints every file it changed; exits 1 with a list of spec problems
   npx tsc --noEmit -p data/scripts         # catches wrong/missing mechanics fields in the generated gunSpecs.ts
   ```
   Validate the new BP/RP JSON against `node_modules/@minecraft/bedrock-schemas` (AGENTS.md). Running the generator twice must print `nothing changed`.

7. **Changelog + hand-off.** Add a `changes.txt` entry. Tell the user to `/reload all` (RP changed) and send an in-game FPP screenshot, held and ADS. You have not seen it in-game; say so.

8. **Iterate the pose.** Compare their screenshot with the target, adjust `pose.*` in the spec, re-run the generator, ask for a new screenshot. Change one thing per round when the user is unsure. If the beam/projectile doesn't leave the barrel, adjust `mechanics.muzzle` (or the projectile's `origin`).

## Limits

- `charge_beam` always uses the Polaris beam and the gold Auric Apex charge/flash particles. A different beam colour needs new particles and a code change in `chargeBeamGun.ts`.
- `auto` heat is shown by `packs/BP/functions/guns.mcfunction` (generated). `charge_beam` shows its own charge bar, so it has no mcfunction HUD.
- Hand-made guns (`"assets": false`) keep their own animations; the generator only writes their mechanics and HUD.
- Recoil is a simple kick (arms pushed back in FPP, pitched up in third person) driven by the cooldown category in `pose.kick`. Anything fancier (moving bones like a bolt or slide) is a hand-written animation.

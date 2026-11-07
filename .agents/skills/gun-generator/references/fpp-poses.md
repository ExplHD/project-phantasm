# Reading an FPP screenshot into a pose

The first-person gun is posed by moving the player's arm bones; the gun follows `rightArm` through `weapon_root`. You can't see the game, so the loop is: read the user's target screenshot, start from the closest reference pose, adjust, generate, get an in-game screenshot, adjust again.

## Reference poses (all working in-game)

| Pose | rightArm rotation / position | leftArm rotation / position | Looks like |
| --- | --- | --- | --- |
| Two-handed hold (MK.III, Apex `hold_fpp`) | `[-5, 45, 65]` / `[0, 3, 0]` | `[-95, -160, 20]` / `[-1, -6, 17]` | Rifle low on the right, barrel pointing forward-left, left hand under the barrel |
| Two-handed ADS (MK.III `aim_fpp`) | `[-5, 45, 65]` / `[-9.5, 5.6, -8]` | `[-95, -160, 20]` / `[-10.5, -3.4, 9]` | Rifle centred, top of the gun near the crosshair |
| Two-handed scoped ADS (Apex `ads_fpp`, tuned in-game by the user) | `[-5, 45, 65]` / `[-9.5, 1.6, -8]` | `[-95, -160, 20]` / `[-10.5, -3.4, 9]` | As above, gun 4 px lower so the longer scope sits on the crosshair |
| One-handed pistol (Peacemaker, `animation.weapon.gun`) | `[0, 40, 75]` / `[5, 7, 0]` | none | Pistol on the right, arm extended |
| Melee weapon held (`animation.weapon.fpp_1`, for comparison) | `[30, 40, 75]` / `[5, 7, 0]` | none | Blade tipped forward |

Third-person poses: copy Apex `hold` (arms forward-down, `weapon_root` tipped -25) and `ads` (both arms follow `q.target_x_rotation - 90` and `q.target_y_rotation`, right `- 5`, left `+ 40`). One-handed: Peacemaker uses only `rightArm: [-90, 0, 0]` in both.

## What each FPP number does

Position is in pixels (16 = one block). Rotation is in degrees.

| Change | Effect on screen | Evidence |
| --- | --- | --- |
| Both arms position X more negative | Gun slides toward the screen centre (left) | MK.III hold to ADS: X -9.5 on both arms centres the rifle |
| Both arms position Y higher | Gun rises (sights toward the crosshair) | MK.III ADS raised Y by 2.6; the user lowered Apex's scope by setting right Y 5.6 to 1.6 |
| Both arms position Z more negative | Gun comes closer to the camera | MK.III ADS moves Z by -8 to bring the sights to the eye. Likely, confirm on the first screenshot |
| rightArm rotation | Turns the gun itself (barrel angle, tilt). Three angles interact in FPP, so change one axis at a time in 5 to 15 degree steps and ask for a screenshot | No clean single-axis evidence in the repo yet |

Rules that hold in practice:
- **Move the whole gun by moving both arms by the same delta.** MK.III hold to ADS adds exactly `(-9.5, +2.6, -8)` to both arms. Moving only one arm separates the left hand from the gun.
- **Keep the reference rotations unless the barrel angle is wrong.** Position fixes most "too low / too far right / too close" complaints.
- The Apex exception: the user lowered only the right arm (Y 5.6 to 1.6) and kept the left. On a long gun the left hand still looked fine; on a short gun check that the hand still touches it.
- Longer guns (Apex is about 49 px, MK.III about 25 px) reach further into the screen, so for ADS they usually need less forward push and a lower Y to put the sight, not the barrel, on the crosshair.

## Reading a target screenshot

1. Split the screen into thirds. Note where the grip, the barrel tip and the sight are.
2. Note the barrel angle relative to straight ahead, and whether the left hand is visible and where.
3. Pick the closest reference pose (two-handed rifle, scoped rifle, pistol).
4. Turn the differences into position deltas with the table: "grip is one third lower than MK.III hold" means lower both Y by about 2 to 4, "barrel more centred" means X a few px more negative.
5. Write the reading and the numbers back to the user in one or two sentences before generating, so they can correct the reading.

When the user sends the in-game result, compare it with the target the same way and change by small amounts (2 to 4 px, 5 to 10 degrees). Large jumps overshoot because the camera is close to the arms.

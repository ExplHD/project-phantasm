import { world, system, MolangVariableMap } from '@minecraft/server'
import { setScore, getScore, removeScore, addScore } from 'main'

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceBlock, sourceEntity }) => {
    const parseMessage = (message) => message.split(",").map(v => v.trim());
    switch (id) {
        case "ph:remove_target_lock":
            system.runTimeout(() => {
                sourceEntity.removeTag("locked")
            }, 5)
            break;
        case "ph:boss_summon_projectile":
            // Example Message : 3, 1.5, ph:solaris_slash, custom_sfx.animirra_summon
            const [amount, yOffset, typeId, sound] =
                parseMessage(message).map(v =>
                    isNaN(v) ? v : Number(v)
                );
            sourceEntity.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 1 0.3`)
            for (let i = 0; i < amount; i++) {
                const { x, y, z } = sourceEntity.location;
                const randXRot = Math.floor(Math.random() * 360)
                sourceEntity.runCommand(`summon ${typeId} ${x} ${y + yOffset} ${z} ${randXRot} 0`)
            }
            break;
        case "ph:boss_summon_projectile_with_y_facing":
            // Example Message : 3, 1.5, ph:solaris_slash, custom_sfx.animirra_summon
            sourceEntity.runCommand(`playsound ${sound} @a[r=32] ~~~ 1 1 0.3`)
            for (let i = 0; i < amount; i++) {
                const { x, y, z } = sourceEntity.location;
                const randXRot = Math.floor(Math.random() * 360);
                const randYRot = Math.floor(-90 + Math.random() * 180);
                sourceEntity.runCommand(`summon ${typeId} ${x} ${y + yOffset} ${z} ${randXRot} ${randYRot}`)
            }
            break;
        case "ph:boss_summon":
            // Example Message : 10, 20, 24, ph:animirra_meteor, custom_sfx.animirra_summon
            const [ number, yAxis, radius, id2, sound2, spawnEvent ] = 
                parseMessage(message).map(v =>
                    isNaN(v) ? v : Number(v)
                );

            // main sound
            sourceEntity.runCommand(`playsound ${sound2} @a[r=32] ~~~ 1 1 0.3`);

            for (let i = 0; i < number; i++) {
                const { x, y, z } = sourceEntity.location;

                const offsetX = (Math.random() * 2 - 1) * radius;
                const offsetZ = (Math.random() * 2 - 1) * radius;

                // spawn meteor
                if (spawnEvent) {
                    sourceEntity.runCommand(`summon ${id2} ${x + offsetX} ${y + yAxis} ${z + offsetZ} ${Math.floor(Math.random() * 360)} 0 ${spawnEvent}`);
                } else {
                    sourceEntity.runCommand(`summon ${id2} ${x + offsetX} ${y + yAxis} ${z + offsetZ} ${Math.floor(Math.random() * 360)} 0 `);
                }
            }
            break;
        case "ph:ram_dash":
            // Example Message : 8, 35, 2, custom_sfx.judgement_cut
            const direction = sourceEntity.getViewDirection();

            const ramDash = message.split(",");
            const force = Number(ramDash[0]);
            const damage = Number(ramDash[1]);
            const collisionRadius = Number(ramDash[2]);
            sourceEntity.applyImpulse({ x: direction.x * force, y: 0, z: direction.z * force });
            beginCollisionCheck(sourceEntity, 14, damage, collisionRadius);
            sourceEntity.runCommand(`playsound ${ramDash[3]} @a[r=32] ~~~ 1 1 0.3`);
            break;
        case "ph:laser_once":
            // Example Message : 30, 12, 1, custom_sfx.laser_shot
            const laserBeamOnce = message.split(",");
            const range = Number(laserBeamOnce[0]);
            const damage2 = Number(laserBeamOnce[1]);
            const width = Number(laserBeamOnce[2]);
            fireLaserOnce(sourceEntity, range, damage2, width);
            sourceEntity.runCommand(`playsound ${laserBeamOnce[3]} @a[r=32] ~~~ 1 1 0.3`);
            break;
        case "ph:boss_laser_beam":
            // Example Message : 40, 140, 50, 12, 1, custom_sfx.laser_shot
            const laserBeamHold = message.split(",");
            const charge = Number(laserBeamHold[0]);
            const duration = Number(laserBeamHold[1]);
            const range2 = Number(laserBeamHold[2]);
            const damagePerTick = Number(laserBeamHold[3]);
            const width2 = Number(laserBeamHold[4]);
            bossLaserBeam(sourceEntity, charge, duration, range2, damagePerTick, width2);
            sourceEntity.runCommand(`playsound ${laserBeamHold[5]} @a[r=32] ~~~ 1 0.8 0.3`);
            break;
        case "ph:cruxshaper_charge_particle":
            const particleAmount = getScore(sourceEntity, "cruxshaper_damage");
            const molang = new MolangVariableMap();

            molang.setFloat("variable.spawn_rate", Number(particleAmount));
            if (sourceEntity) {
                sourceEntity.dimension.spawnParticle("ph:cruxshaper_charge_arc", sourceEntity.location, molang);
            }
            break;
        case "ph:particle_custom":
            system.run(() => {
                const molang = new MolangVariableMap();

                molang.setFloat("variable.spawn_rate", Number(message));
                if (sourceBlock) {
                    sourceBlock.dimension.spawnParticle("ph:bounding_circle", sourceBlock.center(), molang);
                }
            })
            break;
        default: break;
    }
})

/**
 * @param { string } dasher - The target who's dashing
 * @param { number } duration - Duration of the dash
 * @param { number } damage - Damage of the dash
 * @param { number } collisionRadius - The size of the collision detection
 */
function beginCollisionCheck(dasher, duration, damage, collisionRadius) {
    // console.warn("collision started");
    let tick = 0;
    let prevPos = { ...dasher.location };

    const hitEntities = new Set();

    const interval = system.runInterval(() => {
        if (!dasher || !dasher.isValid) {
            system.clearRun(interval);
            return;
        }

        tick++;

        const currentPos = dasher.location;
        const dim = dasher.dimension;

        const entities = dim.getEntities({
            location: currentPos,
            maxDistance: collisionRadius + 50
        });

        for (const target of entities) {
            if (!target.isValid) continue;
            if (target.hasTag("parried")) continue;
            if (target.id === dasher.id) continue;
            if (hitEntities.has(target.id)) continue;

            const dist = distancePointToSegment(
                target.location,
                prevPos,
                currentPos
            );

            // DEBUG
            // console.warn(`dist to ${target.typeId}: ${dist}`);

            if (dist <= collisionRadius) {
                hitEntities.add(target.id);

                target.applyDamage(damage, {
                    cause: "entityAttack",
                    damagingEntity: dasher
                });

            }
        }

        prevPos = { ...currentPos };

        if (tick >= duration) {
            system.clearRun(interval);
        }
    });
}

function distancePointToSegment(point, start, end) {
    const px = point.x;
    const py = point.y;
    const pz = point.z;

    const sx = start.x;
    const sy = start.y;
    const sz = start.z;

    const ex = end.x;
    const ey = end.y;
    const ez = end.z;

    const dx = ex - sx;
    const dy = ey - sy;
    const dz = ez - sz;

    const lengthSquared = dx * dx + dy * dy + dz * dz;

    if (lengthSquared === 0) {
        // start == end
        return Math.sqrt(
            (px - sx) ** 2 +
            (py - sy) ** 2 +
            (pz - sz) ** 2
        );
    }

    // projection t (0 → 1)
    let t = (
        (px - sx) * dx +
        (py - sy) * dy +
        (pz - sz) * dz
    ) / lengthSquared;

    t = Math.max(0, Math.min(1, t));

    const closestX = sx + t * dx;
    const closestY = sy + t * dy;
    const closestZ = sz + t * dz;

    return Math.sqrt(
        (px - closestX) ** 2 +
        (py - closestY) ** 2 +
        (pz - closestZ) ** 2
    );
}

function fireLaserOnce(shooter, range, damage, width) {
    const start = shooter.location;
    const dir = shooter.getViewDirection();

    const end = {
        x: start.x + dir.x * range,
        y: start.y + dir.y * range,
        z: start.z + dir.z * range
    };

    const dim = shooter.dimension;

    const entities = dim.getEntities({
        location: start,
        maxDistance: range
    });

    for (const target of entities) {
        if (!target.isValid) continue;
        if (target.id === shooter.id) continue;

        const dist = distancePointToSegment(
            target.location,
            start,
            end
        );

        if (dist <= width) {
            target.applyDamage(damage, {
                cause: "magic",
                damagingEntity: shooter
            });
        }
    }
}

function bossLaserBeam(boss, charge, duration, range, damagePerTick, width, sound) {
    let tick = 0;
    let chargeTime = charge;

    const chargeInterval = system.runInterval(() => {
        if (!boss || !boss.isValid) {
            system.clearRun(chargeInterval);
            return;
        }

        const start = boss.location;
        const dir = boss.getViewDirection();
        for (let i = 0; i < range; i += 1.5) {
            const point = {
                x: start.x + dir.x * i,
                y: start.y + 1 + dir.y * i,
                z: start.z + dir.z * i
            };

            boss.dimension.spawnParticle("minecraft:basic_smoke_particle", point);
        }

        chargeTime--;

        if (chargeTime <= 0) {
            system.clearRun(chargeInterval);
            startLaser();
        }
    });

    function startLaser() {
        boss.dimension.playSound(`${sound}`, boss.location);
        const interval = system.runInterval(() => {
            if (!boss || !boss.isValid) {
                system.clearRun(interval);
                return;
            }

            tick++;

            const start = boss.location;
            const dir = boss.getViewDirection();

            const end = {
                x: start.x + dir.x * range,
                y: start.y + dir.y * range,
                z: start.z + dir.z * range
            };

            const dim = boss.dimension;

            const entities = dim.getEntities({
                location: start,
                maxDistance: range
            });

            // 🔥 VISUAL LASER
            for (let i = 0; i < range; i += 0.8) {
                const point = {
                    x: start.x + dir.x * i,
                    y: start.y + 1 + dir.y * i,
                    z: start.z + dir.z * i
                };

                dim.spawnParticle("minecraft:vilager_happy", point);
            }

            for (const target of entities) {
                if (!target.isValid) continue;
                if (target.id === boss.id) continue;
                if (target.hasTag("parried")) continue;

                const dist = distancePointToSegment(
                    target.location,
                    start,
                    end
                );

                if (dist <= width) {
                    target.applyDamage(damagePerTick, {
                        cause: "magic",
                        damagingEntity: boss
                    });
                }
            }

            if (tick >= duration) {
                system.clearRun(interval);
            }
        });
    }
}
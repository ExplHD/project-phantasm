import { MolangVariableMap, EntityHurtAfterEvent } from '@minecraft/server'

const VarSets: Record<string, { icon: Record<string, number>; color: { red: number; green: number; blue: number } }> = {
    physical: {
        icon: {
            "anvil": 3,
            "campfire": 2,
            "charging": 0,
            "contact": 4,
            "entityAttack": 0,
            "fall": 5,
            "fallingBlock": 3,
            "fire": 2,
            "fireTick": 2,
            "flyIntoWall": 4,
            "lava": 2,
            "magma": 2,
            "piston": 4,
            "projectile": 1,
            "ramAttack": 0,
            "soulCampfire": 2,
            "stalactite": 3,
            "stalagmite": 5
        },

        color: {
            red: 1, green: 1, blue: 1
        }
    },

    special: {
        icon: {
            "blockExplosion": 7,
            "drowning": 13,
            "entityExplosion": 7,
            "fireworks": 8,
            "maceSmash": 6,
            "thorns": 9
        },

        color: {
            red: 1, green: 1, blue: 0
        }
    },

    magic: {
        icon: {
            "lightning": 10,
            "magic": 10,
            "sonicBoom": 11,
            "wither": 12
        },

        color: {
            red: 1, green: 0.5, blue: 1
        }
    },

    fatal: {
        icon: {
            "freezing": 15,
            "none": 14,
            "override": 14,
            "selfDestruct": 14,
            "starve": 14,
            "suffocation": 13,
            "temperature": 15,
            "void": 14
        },

        color: {
            red: 1, green: 0, blue: 0
        }
    }
}

const DamageTypes: Record<string, { icon: number; color: { red: number; green: number; blue: number } }> = {};

for (const [, data] of Object.entries(VarSets)) {
    for (const [cause, icon] of Object.entries(data.icon)) {
        DamageTypes[cause] = {
            icon,
            color: data.color
        };
    }
}

export function onDamageIndicator({ hurtEntity, damageSource, damage }: EntityHurtAfterEvent): void {
    const damageValue = Math.floor(damage);
    const damageData = DamageTypes[damageSource.cause] ?? DamageTypes["none"];
    if (!hurtEntity || !hurtEntity.isValid) return;
    const { center, extent } = hurtEntity.getAABB();
    const dimension = hurtEntity.dimension;
    if (!dimension.isChunkLoaded(center)) return;

    const players = dimension.getPlayers({ location: center, maxDistance: 64 });
    if (players.length === 0) return;

    const radius = Math.hypot(extent.x, extent.z) + 0.3;
    const iconMolang = new MolangVariableMap();
    iconMolang.setFloat("variable.length", 1.5);
    iconMolang.setFloat("variable.icon_offset", damageData.icon ?? 14);
    iconMolang.setColorRGB("variable.damagecolor", damageData.color);

    const digits = `${Math.min(Math.abs(damageValue), 999999)}`;
    const digitMolangs = [...digits].map(digit => {
        const molang = new MolangVariableMap();
        molang.setFloat("variable.length", 1.5);
        molang.setFloat("variable.digit", Number(digit));
        molang.setColorRGB("variable.damagecolor", damageData.color);
        return molang;
    });

    for (const player of players) {
        if (!player.isValid) continue;
        let dx = player.location.x - center.x;
        let dz = player.location.z - center.z;
        let len = Math.hypot(dx, dz);
        if (len < 0.001) {
            const viewDir = player.getViewDirection();
            dx = -viewDir.x;
            dz = -viewDir.z;
            len = Math.hypot(dx, dz) || 1;
        }
        const loc = {
            x: center.x + (dx / len) * radius,
            y: center.y + extent.y * 0.5,
            z: center.z + (dz / len) * radius
        };
        const leftX = -dz / len;
        const leftZ = dx / len;
        digitMolangs.forEach((molang, i) => {
            const offset = ((digits.length - 1) / 2 - i) / 3;
            player.spawnParticle("ph:damage_number", { x: loc.x + leftX * offset, y: loc.y, z: loc.z + leftZ * offset }, molang);
        });
        player.spawnParticle("ph:damage_icons", { x: loc.x, y: loc.y + 0.6, z: loc.z }, iconMolang);
    }
}

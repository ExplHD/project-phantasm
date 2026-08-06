import { world, system, MolangVariableMap, EntityHurtAfterEvent, Player } from '@minecraft/server'

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

// ======================
// BUILD DAMAGE LOOKUP
// ======================

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
    const damageData = DamageTypes[damageSource.cause];
    if (!hurtEntity || !hurtEntity.isValid) return;
    const loc = hurtEntity.location;
    loc.y += 1;
	const players = hurtEntity.dimension.getEntities({ type: "minecraft:player", location: loc, maxDistance: 64 });
	// console.warn(`HURT FIRED: ${hurtEntity.typeId} dmg=${damageValue} cause=${damageSource.cause} tick=${system.currentTick}`);
	
    for (const ent of players) {
        const player = ent as Player;
        const viewDir = player.getViewDirection();
        loc.x += -viewDir.x;
        loc.z += -viewDir.z;
        const rot = player.getRotation();
		const molang = new MolangVariableMap();
		const iconMolang = new MolangVariableMap();
        let absDamage = Math.abs(damageValue);
        if (absDamage > 999999)
            absDamage = 999999;
		molang.setFloat("variable.length", 1.5);
        iconMolang.setFloat("variable.length", 1.5);
        iconMolang.setFloat("variable.icon_offset", damageData.icon ?? 14);
        molang.setFloat("variable.damage", damageValue);
        molang.setFloat("variable.roty", rot.y);
        molang.setFloat("variable.digits", `${absDamage}`.length);
        molang.setFloat("variable.floored", (absDamage % 10));
        molang.setFloat("variable.floored_tenths", (Math.floor(absDamage / 10) % 10));
        molang.setFloat("variable.floored_hundreths", (Math.floor(absDamage / 100) % 10));
        molang.setFloat("variable.floored_thousandths", (Math.floor(absDamage / 1000) % 10));
        molang.setFloat("variable.floored_ten_thousandths", (Math.floor(absDamage / 10000) % 10));
        molang.setFloat("variable.floored_hundred_thousandths", (Math.floor(absDamage / 100000) % 10));
		molang.setColorRGB("variable.damagecolor", damageData.color);
        try {
            player.spawnParticle("ph:damage_number", loc, molang);
            // player.spawnParticle("ph:damage_icons", loc, molang);
        }
        catch { }
        try {
            player.spawnParticle("ph:damage_icons", {x: loc.x, y: loc.y + 0.6, z:loc.z}, iconMolang);
        }
        catch { }
    }
}

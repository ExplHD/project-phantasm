import { world } from '@minecraft/server'

const NumberSets = {
    physical: {
        icon: {
            "anvil": "",
            "campfire": "",
            "charging": "",
            "contact": "",
            "entityAttack": "",
            "fall": "",
            "fallingBlock": "",
            "fire": "",
            "fireTick": "",
            "flyIntoWall": "",
            "lava": "",
            "magma": "",
            "piston": "",
            "projectile": "",
            "ramAttack": "",
            "soulCampfire": "",
            "stalactite": "",
            "stalagmite": ""
        },

        numbers: ["", "", "", "", "", "", "", "", "", "",]
    },

    special: {
        icon: {
            "blockExplosion": "",
            "drowning": "",
            "entityExplosion": "",
            "fireworks": "",
            "maceSmash": "",
            "thorns": ""
        },

        numbers: ["", "", "", "", "", "", "", "", "", ""]
    },

    magic: {
        icon: {
            "lightning": "",
            "magic": "",
            "sonicBoom": "",
            "wither": ""
        },

        numbers: ["", "", "", "", "", "", "", "", "", ""]
    },

    fatal: {
        icon: {
            "freezing": "",
            "none": "",
            "override": "",
            "selfDestruct": "",
            "starve": "",
            "suffocation": "",
            "temperature": "",
            "void": ""
        },

        numbers: ["", "", "", "", "", "", "", "", "", ""]
    }
}

// ======================
// BUILD DAMAGE LOOKUP
// ======================

const DamageTypes = {};

for (const [type, data] of Object.entries(NumberSets)) {
    for (const [cause, icon] of Object.entries(data.icon)) {
        DamageTypes[cause] = {
            icon,
            numbers: data.numbers
        };
    }
}

// ======================
// CONVERT NUMBER TO GLYPH
// ======================

function glyphNumber(number, glyphs) {
    let output = "";

    for (const char of Math.floor(number).toString()) {
        output += glyphs[char] ?? char;
    }

    return output;
}

// ======================
// DAMAGE INDICATOR
// ======================

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    const damageCause = damageSource.cause;
    const damageData = DamageTypes[damageCause];

    // fallback
    const icon = damageData?.icon ?? "";
    const numbers = damageData?.numbers ?? NumberSets.fatal.numbers;

    const hologramEntity = hurtEntity.dimension.spawnEntity(
        "ph:text_hologram",
        {
            x: hurtEntity.location.x,
            y: hurtEntity.location.y + 1,
            z: hurtEntity.location.z
        }
    );

    hologramEntity.applyImpulse({
        x: -0.12 + Number((Math.random() * 0.25).toFixed(2)),
        y: Number((Math.random() * 0.45).toFixed(2)),
        z: -0.12 + Number((Math.random() * 0.25).toFixed(2))
    })
    const finalDamage = damage < 1 ? 1 : Math.floor(damage);

    hologramEntity.nameTag =
        `${icon} ${glyphNumber(finalDamage, numbers)}`;
});
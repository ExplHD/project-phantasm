// Gun generator. Reads every spec in data/guns/*.json and writes the gun's files.
//   node tools/gun_generator/main.mjs
// Always writes: data/scripts/features/weapons/gunSpecs.ts (mechanics for all guns),
// packs/BP/functions/guns.mcfunction (actionbar HUD), the "guns" entry in tick.json.
// For specs with "assets": true it also writes the item, icon block, attachable, icon geometry,
// animations, controller, player.entity + render controller wiring, terrain texture, lang and sounds.
// Specs with "assets": false (hand-made guns like Xeonnite Blaster MK.III) only get mechanics + HUD.
// Re-running is safe: every write replaces the gun's own entries and leaves everything else alone.
// The spec format is documented in .agents/skills/gun-generator/SKILL.md.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const SPEC_DIR = "data/guns";
const BP = "packs/BP";
const RP = "packs/RP";
const TYPES = ["single", "auto", "charge_beam"];
const ICON_MAX_LENGTH = 28;

const errors = [];
const written = [];

function fail(spec, message) {
    errors.push(`${spec}: ${message}`);
}

function readJson(path) {
    return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function writeText(path, text) {
    const full = join(ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    const before = existsSync(full) ? readFileSync(full, "utf8") : undefined;
    if (before === text) return;
    writeFileSync(full, text);
    written.push(path);
}

// Keeps the file's own end-of-file newline. inlineArrays puts [x, y, z] style arrays on one line,
// the way the animation files are written by hand.
function writeJson(path, data, indent = "\t", inlineArrays = false) {
    const full = join(ROOT, path);
    const eol = existsSync(full) && !readFileSync(full, "utf8").endsWith("\n") ? "" : "\n";
    let text = JSON.stringify(data, null, indent);
    if (inlineArrays) text = text.replace(/\[\s*((?:-?[\d.]+|"[^"\n]*")(?:,\s*(?:-?[\d.]+|"[^"\n]*"))*)\s*\]/g, (_, body) => `[${body.replace(/,\n\s*/g, ", ")}]`);
    writeText(path, text + eol);
}

function shortId(id) {
    return id.split(":")[1];
}

function isNumberArray(value, length) {
    return Array.isArray(value) && value.length === length && value.every(v => typeof v === "number" || typeof v === "string");
}

function validate(file, spec) {
    const need = (cond, message) => { if (!cond) fail(file, message); };
    need(typeof spec.id === "string" && /^ph:[a-z0-9_]+$/.test(spec.id), `"id" must look like ph:snake_case_name`);
    need(typeof spec.name === "string" && spec.name.length > 0, `"name" is required`);
    need(TYPES.includes(spec.type), `"type" must be one of ${TYPES.join(", ")}`);
    need(typeof spec.mechanics === "object" && spec.mechanics !== null, `"mechanics" is required`);
    if (spec.scope !== undefined) need(typeof spec.scope === "number" && spec.scope > 0 && spec.scope < 110, `"scope" is a FOV number (e.g. 30)`);
    if (spec.scope !== undefined && spec.assets) need(spec.pose?.adsOn === "sneak", `"scope" zooms on sneak, so it needs "pose.adsOn": "sneak"`);
    if (spec.type === "auto" && spec.mechanics?.altFire) {
        need(spec.scope === undefined, `an auto gun with "altFire" uses sneak for the alt fire, so it can't have "scope"`);
        if (spec.assets) need(spec.pose?.adsOn !== "sneak", `an auto gun with "altFire" uses sneak for the alt fire, set "pose.adsOn": "use"`);
    }
    if (!spec.assets) return;

    const item = spec.item ?? {};
    need(["common", "uncommon", "rare", "epic"].includes(item.rarity), `"item.rarity" must be common/uncommon/rare/epic`);
    need(Number.isInteger(item.durability) && item.durability > 0, `"item.durability" must be a positive integer`);
    if (spec.type === "single") need(item.cooldown && typeof item.cooldown.category === "string" && item.cooldown.seconds > 0, `single guns need "item.cooldown": { "category", "seconds" }`);

    const model = spec.model ?? {};
    need(typeof model.geometry === "string", `"model.geometry" is required`);
    need(typeof model.file === "string" && existsSync(join(ROOT, model.file ?? "")), `"model.file" must point to an existing .geo.json`);
    need(typeof model.texture === "string" && existsSync(join(ROOT, RP, `${model.texture}.png`)), `"model.texture" must point to an existing png under packs/RP (without .png)`);
    if (model.file && existsSync(join(ROOT, model.file))) {
        const geo = readJson(model.file)["minecraft:geometry"]?.find(g => g.description?.identifier === model.geometry);
        need(geo, `${model.file} has no geometry "${model.geometry}"`);
        const root = geo?.bones?.find(b => b.name === "weapon_root");
        need(root, `the model needs a "weapon_root" bone (3D held weapons attach to it)`);
        if (root) need(root.parent === "rightArm", `"weapon_root" must be a child of "rightArm"`);
    }

    const pose = spec.pose ?? {};
    need(["sneak", "use"].includes(pose.adsOn), `"pose.adsOn" must be "sneak" or "use"`);
    need(pose.kick && typeof pose.kick.category === "string" && pose.kick.seconds > 0, `"pose.kick" needs "category" and "seconds"`);
    for (const name of ["hold_fpp", "hold", "ads_fpp", "ads"]) {
        need(typeof pose[name] === "object", `"pose.${name}" is required`);
        for (const [bone, channels] of Object.entries(pose[name] ?? {})) {
            for (const [channel, value] of Object.entries(channels)) {
                need(["rotation", "position"].includes(channel), `"pose.${name}.${bone}.${channel}" must be rotation or position`);
                need(isNumberArray(value, 3), `"pose.${name}.${bone}.${channel}" must be [x, y, z]`);
            }
        }
    }
    need(typeof spec.tooltip === "string", `"tooltip" is required (lang text, lines joined with \\n)`);
}

function kickExpr(base, variable, factor) {
    if (!factor) return base;
    if (base === 0) return `-${variable} * ${factor}`;
    return `${base} - ${variable} * ${factor}`;
}

function buildPose(bones, variable, kick, fpp) {
    const out = {};
    for (const [bone, channels] of Object.entries(bones)) {
        const copy = {};
        for (const [channel, value] of Object.entries(channels)) {
            const v = [...value];
            if (fpp && channel === "position" && (bone === "rightArm" || bone === "leftArm")) v[2] = kickExpr(v[2], variable, kick.push);
            if (!fpp && channel === "rotation" && bone === "rightArm") v[0] = kickExpr(v[0], variable, kick.pitch);
            copy[channel] = v;
        }
        out[bone] = copy;
    }
    return out;
}

function writeAnimations(spec, short) {
    const kickVar = `v.${short}_kick`;
    const { pose } = spec;
    writeJson(`${RP}/animations/weapons/${short}.animation.json`, {
        format_version: "1.8.0",
        animations: {
            [`animation.${short}.hold_fpp`]: { loop: true, bones: buildPose(pose.hold_fpp, kickVar, pose.kick, true) },
            [`animation.${short}.hold`]: { loop: true, bones: buildPose(pose.hold, kickVar, pose.kick, false) },
            [`animation.${short}.aim_fpp`]: { loop: true, bones: buildPose(pose.ads_fpp, kickVar, pose.kick, true) },
            [`animation.${short}.aim`]: { loop: true, override_previous_animation: true, bones: buildPose(pose.ads, kickVar, pose.kick, false) }
        }
    }, "\t", true);
    const enter = pose.adsOn === "sneak" ? "q.is_sneaking" : "q.is_using_item";
    writeJson(`${RP}/animation_controllers/${short}.json`, {
        format_version: "1.10.0",
        animation_controllers: {
            [`controller.animation.${short}`]: {
                initial_state: "hold",
                states: {
                    hold: {
                        animations: [{ [`${short}_hold_fpp`]: "v.is_first_person" }, { [`${short}_hold`]: "!v.is_first_person" }],
                        blend_transition: 0.15,
                        transitions: [{ aim: enter }]
                    },
                    aim: {
                        animations: [{ [`${short}_aim_fpp`]: "v.is_first_person" }, { [`${short}_aim`]: "!v.is_first_person" }],
                        blend_transition: 0.15,
                        transitions: [{ hold: `!${enter}` }]
                    }
                }
            }
        }
    });
}

function writeItem(spec, short) {
    const { item } = spec;
    const components = {};
    if (spec.type !== "single") components["minecraft:use_modifiers"] = { use_duration: 3600, movement_modifier: item.movement ?? 0.6 };
    if (spec.type === "single") components["minecraft:cooldown"] = { category: item.cooldown.category, duration: item.cooldown.seconds };
    Object.assign(components, {
        "minecraft:durability": { max_durability: item.durability },
        "minecraft:enchantable": { slot: "flintsteel", value: item.enchantValue ?? 12 },
        "minecraft:fire_resistant": { value: true },
        "minecraft:block_placer": { block: spec.id, replace_block_item: true },
        "minecraft:can_destroy_in_creative": false,
        "minecraft:max_stack_size": 1,
        "minecraft:rarity": item.rarity,
        "minecraft:tags": { tags: ["minecraft:is_tool"] }
    });
    writeJson(`${BP}/items/weapons/${short}.json`, {
        format_version: "1.21.130",
        "minecraft:item": {
            description: { identifier: spec.id, menu_category: { category: "equipment" } },
            components
        }
    });

    writeJson(`${BP}/blocks/${short}.json`, {
        format_version: "1.26.0",
        "minecraft:block": {
            description: { identifier: spec.id },
            components: {
                "minecraft:geometry": `geometry.ph.${short}_block`,
                "minecraft:material_instances": { "*": { texture: `ph_${short}_3d`, render_method: "alpha_test" } },
                "ph:icon_only": {},
                "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: ["air"] }] }
            }
        }
    });

    writeJson(`${RP}/attachables/${short}.json`, {
        format_version: "1.21.0",
        "minecraft:attachable": {
            description: {
                identifier: spec.id,
                materials: { default: "entity_alphatest", enchanted: "entity_alphatest_glint" },
                textures: { default: spec.model.texture, enchanted: "textures/misc/enchanted_item_glint" },
                geometry: { default: spec.model.geometry },
                render_controllers: ["controller.render.item_default"]
            }
        }
    });
}

function round(value) {
    const r = Math.round(value * 1e4) / 1e4;
    return Object.is(r, -0) ? 0 : r;
}

function writeIconGeometry(spec, short) {
    const source = readJson(spec.model.file)["minecraft:geometry"].find(g => g.description.identifier === spec.model.geometry);
    const geo = structuredClone(source);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const bone of geo.bones) {
        for (const cube of bone.cubes ?? []) {
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], cube.origin[i]);
                max[i] = Math.max(max[i], cube.origin[i] + cube.size[i]);
            }
        }
    }
    const center = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
    const longest = Math.max(...[0, 1, 2].map(i => max[i] - min[i]));
    const scale = spec.model.iconScale ?? Math.min(1, ICON_MAX_LENGTH / longest);
    const target = [0, 8, 0];
    const place = p => p.map((v, i) => round((v - center[i]) * scale + target[i]));
    for (const bone of geo.bones) {
        bone.pivot = place(bone.pivot ?? [0, 0, 0]);
        if (bone.parent === undefined) bone.parent = "icon_turn";
        for (const cube of bone.cubes ?? []) {
            cube.origin = place(cube.origin);
            cube.size = cube.size.map(v => round(v * scale));
            if (cube.pivot) cube.pivot = place(cube.pivot);
        }
    }
    geo.bones = [
        { name: "icon_tilt", pivot: [0, 8, 0], rotation: [0, 0, 90] },
        { name: "icon_turn", parent: "icon_tilt", pivot: [0, 8, 0], rotation: [0, 90, 0] },
        ...geo.bones
    ];
    geo.description = {
        identifier: `geometry.ph.${short}_block`,
        texture_width: source.description.texture_width,
        texture_height: source.description.texture_height,
        visible_bounds_width: 3,
        visible_bounds_height: 3,
        visible_bounds_offset: [0, 0.5, 0]
    };
    writeJson(`${RP}/models/blocks/${short}.geo.json`, { format_version: "1.21.0", "minecraft:geometry": [geo] });
}

function writeTerrainTexture(spec, short) {
    const path = `${RP}/textures/terrain_texture.json`;
    const data = readJson(path);
    data.texture_data[`ph_${short}_3d`] = { textures: spec.model.texture };
    writeJson(path, data);
}

function setOrAppend(list, matches, value) {
    const index = list.findIndex(matches);
    if (index >= 0) list[index] = value;
    else list.push(value);
}

function wirePlayer(spec, short) {
    const path = `${RP}/entity/player.entity.json`;
    const data = readJson(path);
    const description = data["minecraft:client_entity"].description;
    description.textures[short] = "textures/none";
    description.geometry[short] = spec.model.geometry;
    description.scripts.variables[`variable.${short}`] = "public";

    const pre = description.scripts.pre_animation;
    setOrAppend(pre, line => line.startsWith(`variable.${short} =`), `variable.${short} = query.get_equipped_item_name(0) == '${short}';`);
    setOrAppend(pre, line => line.startsWith(`variable.${short}_kick =`),
        `variable.${short}_kick = variable.${short} ? math.pow(math.clamp(query.cooldown_time_remaining('${spec.pose.kick.category}') / ${spec.pose.kick.seconds}, 0, 1), 2) * 2 : 0;`);

    const animate = description.scripts.animate;
    if (!animate.some(entry => typeof entry === "object" && short in entry)) {
        const tail = animate.indexOf("scimitar_dual_special_ctrl");
        animate.splice(tail >= 0 ? tail : animate.length, 0, { [short]: `variable.${short}` });
    }

    Object.assign(description.animations, {
        [short]: `controller.animation.${short}`,
        [`${short}_hold_fpp`]: `animation.${short}.hold_fpp`,
        [`${short}_hold`]: `animation.${short}.hold`,
        [`${short}_aim_fpp`]: `animation.${short}.aim_fpp`,
        [`${short}_aim`]: `animation.${short}.aim`
    });

    const renders = description.render_controllers;
    const key = `controller.render.${short}`;
    if (!renders.some(entry => typeof entry === "object" && key in entry)) renders.push({ [key]: `variable.${short}` });
    writeJson(path, data, 4);

    const weaponsPath = `${RP}/render_controllers/weapons.render_controller.json`;
    const weapons = readJson(weaponsPath);
    const controller = {
        textures: [`texture.${short}`],
        geometry: `geometry.${short}`,
        materials: [{ "*": "material.default" }]
    };
    if (key in weapons.render_controllers) {
        weapons.render_controllers[key] = controller;
    } else {
        const rebuilt = {};
        for (const [name, value] of Object.entries(weapons.render_controllers)) {
            if (name === "controller.render.item_outline") rebuilt[key] = controller;
            rebuilt[name] = value;
        }
        if (!(key in rebuilt)) rebuilt[key] = controller;
        weapons.render_controllers = rebuilt;
    }
    writeJson(weaponsPath, weapons, 4);

    const armsPath = `${RP}/render_controllers/player.render_controllers.json`;
    const arms = readJson(armsPath);
    const parts = spec.twoHanded ? ["rightArm", "rightSleeve", "leftArm", "leftSleeve"] : ["rightArm", "rightSleeve"];
    const marker = "query.get_equipped_item_name(0, 1) == 'filled_map'";
    const clause = `query.get_equipped_item_name(0, 1) == '${short}'`;
    for (const controllerData of Object.values(arms.render_controllers)) {
        for (const entry of controllerData.part_visibility ?? []) {
            for (const part of parts) {
                const value = entry[part];
                if (typeof value === "string" && value.includes(marker) && !value.includes(clause)) entry[part] = `${value} || ${clause}`;
            }
        }
    }
    writeJson(armsPath, arms, 4);
}

function setLangLine(lines, key, value, groupPattern) {
    const line = `${key}=${value}`;
    const existing = lines.findIndex(l => l.startsWith(`${key}=`));
    if (existing >= 0) {
        lines[existing] = line;
        return;
    }
    let last = -1;
    lines.forEach((l, i) => { if (groupPattern.test(l)) last = i; });
    lines.splice(last >= 0 ? last + 1 : lines.length, 0, line);
}

function writeLang(spec) {
    const path = `${RP}/texts/en_US.lang`;
    const lines = readFileSync(join(ROOT, path), "utf8").split("\n");
    setLangLine(lines, `item.${spec.id}`, spec.name, /^item\.ph:/);
    setLangLine(lines, `tile.${spec.id}.name`, spec.name, /^tile\.ph:[^=]+\.name=/);
    setLangLine(lines, `tile.${spec.id}.tooltip`, spec.tooltip, /^tile\.[^=]+\.tooltip=/);
    writeText(path, lines.join("\n"));
}

function writeSounds(spec) {
    if (!spec.sounds) return;
    const path = `${RP}/sounds/sound_definitions.json`;
    const data = readJson(path);
    for (const [id, sound] of Object.entries(spec.sounds)) {
        if (!existsSync(join(ROOT, RP, `${sound.file}.ogg`))) fail(spec.id, `sound file ${RP}/${sound.file}.ogg is missing`);
        data.sound_definitions[id] = {
            category: "player",
            max_distance: sound.distance ?? 20,
            sounds: [{ name: sound.file, volume: sound.volume ?? 1 }],
            subtitle: sound.subtitle ?? "subtitles.weapons.gunshot"
        };
    }
    writeJson(path, data);
}

function hudLines(spec) {
    const holding = `hasitem={item=${spec.id},location=slot.weapon.mainhand}`;
    const heat = spec.type === "auto" ? spec.mechanics.heat : undefined;
    if (heat) {
        const score = `{"score":{"name":"*","objective":"${heat.objective}"}}`;
        return [
            `titleraw @a[${holding},scores={${heat.overheatObjective}=!1}] actionbar {"rawtext":[{"text":"§bHeat : "},${score},{"text":"%"}]}`,
            `titleraw @a[${holding},scores={${heat.overheatObjective}=1}] actionbar {"rawtext":[{"text":"§cOVERHEAT "},${score},{"text":"%"}]}`
        ];
    }
    if (spec.type === "single" && (spec.mechanics.chargeCost ?? 0) > 0) {
        return [`titleraw @a[${holding}] actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}`];
    }
    return [];
}

function writeHud(specs) {
    const blocks = specs.map(spec => [spec, hudLines(spec)]).filter(([, lines]) => lines.length > 0)
        .map(([spec, lines]) => [`# ${spec.name} Runtime`, ...lines].join("\n"));
    writeText(`${BP}/functions/guns.mcfunction`, blocks.join("\n\n") + "\n");

    const tickPath = `${BP}/functions/tick.json`;
    const tick = readJson(tickPath);
    if (!tick.values.includes("guns")) {
        tick.values.push("guns");
        writeJson(tickPath, tick);
    }
}

function writeMechanics(specs) {
    const of = type => specs.filter(spec => spec.type === type);
    const list = type => JSON.stringify(of(type).map(spec => ({ id: spec.id, ...spec.mechanics })), null, "\t");
    const singles = JSON.stringify(Object.fromEntries(of("single").map(spec => [spec.id, spec.mechanics])), null, "\t");
    const scopes = JSON.stringify(specs.filter(spec => spec.scope !== undefined).map(spec => [spec.id, spec.scope]));
    const objectives = JSON.stringify(of("auto").flatMap(spec => spec.mechanics.heat ? [spec.mechanics.heat.objective, spec.mechanics.heat.overheatObjective] : []));
    writeText("data/scripts/features/weapons/gunSpecs.ts", [
        `import type { AutoGun } from "./autoGun";`,
        `import type { ChargeBeamGun } from "./chargeBeamGun";`,
        `import type { Shooter } from "./shooters";`,
        ``,
        `export const AUTO_GUNS: readonly AutoGun[] = ${list("auto")};`,
        ``,
        `export const CHARGE_BEAM_GUNS: readonly ChargeBeamGun[] = ${list("charge_beam")};`,
        ``,
        `export const SINGLE_GUNS: Readonly<Record<string, Shooter>> = ${singles};`,
        ``,
        `export const GUN_SCOPES: ReadonlyMap<string, number> = new Map<string, number>(${scopes});`,
        ``,
        `export const GUN_OBJECTIVES: readonly string[] = ${objectives};`,
        ``
    ].join("\n"));
}

const files = existsSync(join(ROOT, SPEC_DIR)) ? readdirSync(join(ROOT, SPEC_DIR)).filter(f => f.endsWith(".json")).sort() : [];
const specs = [];
for (const file of files) {
    let spec;
    try {
        spec = readJson(join(SPEC_DIR, file));
    } catch (error) {
        fail(file, `invalid JSON (${error.message})`);
        continue;
    }
    validate(file, spec);
    specs.push(spec);
}
const ids = specs.map(spec => spec.id);
for (const id of ids.filter((id, i) => ids.indexOf(id) !== i)) errors.push(`duplicate gun id ${id}`);

if (errors.length > 0) {
    console.error(`[gun_generator] ${errors.length} problem(s), nothing written:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
}

writeMechanics(specs);
writeHud(specs);
for (const spec of specs.filter(spec => spec.assets)) {
    const short = shortId(spec.id);
    writeItem(spec, short);
    writeIconGeometry(spec, short);
    writeAnimations(spec, short);
    writeTerrainTexture(spec, short);
    wirePlayer(spec, short);
    writeLang(spec);
    writeSounds(spec);
}

if (errors.length > 0) {
    console.error(`[gun_generator] finished with ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
}

if (specs.some(spec => spec.assets)) execFileSync("node", ["filters/item_rarity/main.mjs"], { cwd: ROOT, stdio: "inherit" });
console.log(`[gun_generator] ${specs.length} gun spec(s): ${specs.map(spec => `${spec.id} (${spec.type}${spec.assets ? ", assets" : ""})`).join(", ")}`);
console.log(written.length > 0 ? `[gun_generator] updated:\n  ${written.join("\n  ")}` : "[gun_generator] nothing changed");

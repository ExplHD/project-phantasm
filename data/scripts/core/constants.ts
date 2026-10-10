// [UNUSED] LEGENDARY_TIER — exported but never referenced. Weapons currently detect
// legendary status by hardcoded typeId lists instead of this list.
export const LEGENDARY_TIER = [
	"ph:solaris_verdant",
	"ph:prism_weaver",
	"ph:the_bleeding_spire",
	"ph:supercharged_copper_axe",
	"ph:auric_photonizer"
] as const

export const ORE_DROPS = new Map<string, string>([
    ["minecraft:coal_ore", "minecraft:coal"],
    ["minecraft:deepslate_coal_ore", "minecraft:coal"],

    ["minecraft:iron_ore", "minecraft:raw_iron"],
	["minecraft:deepslate_iron_ore", "minecraft:raw_iron"],

	["minecraft:copper_ore", "minecraft:raw_copper"],
	["minecraft:deepslate_copper_ore", "minecraft:raw_copper"],

	["minecraft:lapis_ore", "minecraft:lapis_lazuli"],
    ["minecraft:deepslate_lapis_ore", "minecraft:lapis_lazuli"],

	["minecraft:gold_ore", "minecraft:raw_gold"],
	["minecraft:deepslate_gold_ore", "minecraft:raw_gold"],

	["minecraft:redstone_ore", "minecraft:redstone"],
	["minecraft:deepslate_redstone_ore", "minecraft:redstone"],

	["minecraft:emerald_ore", "minecraft:emerald"],
    ["minecraft:deepslate_emerald_ore", "minecraft:emerald"],

	["minecraft:diamond_ore", "minecraft:diamond"],
	["minecraft:deepslate_diamond_ore", "minecraft:diamond"],

	["minecraft:nether_gold_ore", "minecraft:gold_ingot"],
	["minecraft:quartz_ore", "minecraft:quartz"],
	["minecraft:ancient_debris", "minecraft:ancient_debris"],
]);

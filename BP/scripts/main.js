import {
    world, system, CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus
} from '@minecraft/server'
import { } from 'weapons'
import { } from 'loader'
import { } from 'custom_components'
import { } from 'vanilla_block_manipulation'
import { } from 'specific_structure_position'
import { } from 'classes/bow'
import { } from 'data/boss_attack_sets'
import * as Phantasm from 'phantasmConstants'

export function addScore(target, objective, score) {
    try {
        world.scoreboard.getObjective(objective).addScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players add "${target.name}" ${objective} ${score}`)
    }
}

export function removeScore(target, objective, score) {
    try {
        world.scoreboard.getObjective(objective).addScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players remove "${target.name}" ${objective} ${score}`)
    }
}

export function setScore(target, objective, score) {
    try {
        world.scoreboard.getObjective(objective).setScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players set "${target.name}" ${objective} ${score}`)
    }
}

export function getScore(target, objective) {
    try {
        return world.scoreboard.getObjective(objective).getScore(target)
    } catch (error) {
        return 0;
    }
}
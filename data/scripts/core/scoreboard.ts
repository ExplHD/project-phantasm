import { world, Entity, Player } from '@minecraft/server'

/**
 * Scoreboard helpers. Lives in core/ so that no gameplay system has to import the
 * entry point (main.ts) to reach it, which is what the old flat layout forced.
 */
export function addScore(target: Entity, objective: string, score: number) {
    try {
        world.scoreboard.getObjective(objective)!.addScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players add "${(target as Player).name}" ${objective} ${score}`)
    }
}

export function removeScore(target: Entity, objective: string, score: number) {
    try {
        world.scoreboard.getObjective(objective)!.addScore(target, -score)
    } catch (e) {
        target.runCommand(`scoreboard players remove "${(target as Player).name}" ${objective} ${score}`)
    }
}

export function setScore(target: Entity, objective: string, score: number) {
    try {
        world.scoreboard.getObjective(objective)!.setScore(target, score)
    } catch (e) {
        target.runCommand(`scoreboard players set "${(target as Player).name}" ${objective} ${score}`)
    }
}

export function getScore(target: Entity, objective: string): number {
    try {
        return world.scoreboard.getObjective(objective)!.getScore(target) ?? 0
    } catch (error) {
        return 0;
    }
}
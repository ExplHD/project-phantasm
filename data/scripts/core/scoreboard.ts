import { world, Entity } from '@minecraft/server'

export function addScore(target: Entity, objective: string, score: number): void {
    if (!target.isValid) return;
    world.scoreboard.getObjective(objective)?.addScore(target, score);
}

export function removeScore(target: Entity, objective: string, score: number): void {
    if (!target.isValid) return;
    world.scoreboard.getObjective(objective)?.addScore(target, -score);
}

export function setScore(target: Entity, objective: string, score: number): void {
    if (!target.isValid) return;
    world.scoreboard.getObjective(objective)?.setScore(target, score);
}

export function getScore(target: Entity, objective: string): number {
    if (!target.isValid) return 0;
    return world.scoreboard.getObjective(objective)?.getScore(target) ?? 0;
}

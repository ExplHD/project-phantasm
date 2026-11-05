import { BlockPermutation, type Block } from '@minecraft/server'

export type BlockStateValue = boolean | number | string;

export function getCustomState(block: Block, name: string): BlockStateValue | undefined {
    return block.permutation.getAllStates()[name];
}

export function setCustomState(block: Block, name: string, value: BlockStateValue): void {
    const states: Record<string, BlockStateValue> = { ...block.permutation.getAllStates(), [name]: value };
    block.setPermutation(BlockPermutation.resolve(block.typeId, states));
}

export function crystallSupport(block: Block): Block | undefined {
    switch (block.permutation.getState("minecraft:block_face")) {
        case "up": return block.below();
        case "down": return block.above();
        case "north": return block.south();
        case "south": return block.north();
        case "east": return block.west();
        case "west": return block.east();
        default: return undefined;
    }
}

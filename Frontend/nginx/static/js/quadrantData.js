// hier sind die 4 Bretter mit jeweils zwei seiten gespeichert

// Wand-Definition (Bitmaske)
// N=1, E=2, S=4, W=8
export const WALLS = { N: 1, E: 2, S: 4, W: 8 };

export const chip_positions = {
    block1: {
        A: [{ x: 4, y: 2, color: 'red', symbol: 'circle' },
        { x: 2, y: 5, color: 'blue', symbol: 'star' },
        { x: 7, y: 4, color: 'green', symbol: 'cog' },
        { x: 5, y: 7, color: 'yellow', symbol: 'pentagon' }],

        B: [{ x: 5, y: 2, color: 'red', symbol: 'circle' },
        { x: 2, y: 4, color: 'blue', symbol: 'cog' },
        { x: 6, y: 6, color: 'green', symbol: 'pentagon' },
        { x: 4, y: 7, color: 'yellow', symbol: 'star' }]
    },
    block2: {
        A: [{ x: 5, y: 2, color: 'red', symbol: 'pentagon' },
        { x: 3, y: 3, color: 'blue', symbol: 'circle' },
        { x: 4, y: 6, color: 'green', symbol: 'star' },
        { x: 7, y: 7, color: 'yellow', symbol: 'cog' }],

        B: [{ x: 2, y: 2, color: 'red', symbol: 'star' },
        { x: 4, y: 4, color: 'blue', symbol: 'circle' },
        { x: 7, y: 6, color: 'green', symbol: 'cog' },
        { x: 3, y: 7, color: 'yellow', symbol: 'pentagon' }]
    },
    block3: {
        A: [{ x: 4, y: 3, color: 'red', symbol: 'cog' },
        { x: 6, y: 4, color: 'blue', symbol: 'pentagon' },
        { x: 3, y: 5, color: 'green', symbol: 'circle' },
        { x: 5, y: 6, color: 'yellow', symbol: 'star' }],

        B: [{ x: 2, y: 2, color: 'red', symbol: 'cog' },
        { x: 6, y: 2, color: 'blue', symbol: 'pentagon' },
        { x: 7, y: 5, color: 'green', symbol: 'star' },
        { x: 3, y: 7, color: 'yellow', symbol: 'circle' }]
    },
    block4: {
        A: [{ x: 1, y: 3, color: 'red', symbol: 'star' },
        { x: 6, y: 4, color: 'blue', symbol: 'cog' },
        { x: 2, y: 6, color: 'green', symbol: 'pentagon' },
        { x: 7, y: 7, color: 'yellow', symbol: 'circle' }],

        B: [{ x: 6, y: 2, color: 'red', symbol: 'circle' },
        { x: 2, y: 4, color: 'blue', symbol: 'cog' },
        { x: 7, y: 6, color: 'green', symbol: 'pentagon' },
        { x: 3, y: 7, color: 'yellow', symbol: 'star' }]
    }
}

export const QUADRANT_DATA = {
    // === BLOCK 1: Oben links ===
    block1: {
        A: [[0, 2, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 9, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 6, 0],
        [0, 12, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 3, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 9]],

        B: [[0, 0, 0, 2, 0, 0, 0, 0],
        [0, 12, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 6, 0, 0, 0, 0, 0],
        [4, 0, 0, 0, 0, 0, 0, 9],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 9]],
    },
    // === BLOCK 2: oben rechts  ===
    block2: {
        A: [[2, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 6, 0, 0, 0],
        [0, 0, 12, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 4],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 9, 0],
        [3, 0, 12, 0, 0, 0, 0, 0]],

        B: [[0, 0, 0, 2, 0, 0, 0, 0],
        [0, 6, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 4],
        [0, 0, 0, 12, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 9, 0],
        [0, 0, 3, 0, 0, 0, 0, 0],
        [3, 0, 0, 0, 0, 12, 0, 0]],
    },
    // === BLOCK 3: unten links ===
    block3: {
        A: [[0, 0, 0, 0, 0, 0, 0, 12],
        [0, 0, 0, 0, 12, 0, 0, 0],
        [0, 3, 0, 0, 0, 0, 0, 0],
        [4, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 9, 0],
        [0, 0, 6, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0]],

        B: [[0, 0, 0, 0, 0, 0, 0, 12],
        [0, 3, 0, 0, 0, 9, 0, 0],
        [4, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 6, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 12, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 2, 0, 0]],
    },
    // === BLOCK 4: unten rechts ===
    block4: {
        A: [[6, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 9, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 12, 0, 4],
        [0, 0, 3, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 6, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 2, 0, 0, 0, 0, 0, 0]],

        B: [[6, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 9, 0, 0, 4],
        [0, 0, 6, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 12, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 2, 0, 0]],
    }
};
// hier sind die 4 Bretter mit jeweils zwei seiten gespeichert

// Wand-Definition (Bitmaske)
// N=1, E=2, S=4, W=8
export const WALLS = { N: 1, E: 2, S: 4, W: 8 };

export const chip_positions = {
    block1: {
        A: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }],

        B: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }]
    },
    block2: {
        A: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }],

        B: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }]
    },
    block3: {
        A: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }],

        B: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }]
    },
    block4: {
        A: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }],

        B: [{ x: 1, y: 1, color: 'red', symbol: 'circle' },
        { x: 6, y: 3, color: 'blue', symbol: 'star' },
        { x: 1, y: 6, color: 'green', symbol: 'cog' },
        { x: 4, y: 6, color: 'yellow', symbol: 'pentagon' }]
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
        [0, 0, 0, 0, 0, 0, 0, 0]],

        B: [[0, 0, 0, 2, 0, 0, 0, 0],
        [0, 12, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 6, 0, 0, 0, 0, 0],
        [4, 0, 0, 0, 0, 0, 0, 9],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]],
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
        [0, 0, 12, 0, 0, 0, 0, 0]],

        B: [[0, 0, 0, 2, 0, 0, 0, 0],
        [0, 6, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 4],
        [0, 0, 0, 12, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 9, 0],
        [0, 0, 3, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 12, 0, 0]],
    },
    // === BLOCK 3: unten links ===
    block3: {
        A: [[0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 12, 0, 0, 0],
        [0, 3, 0, 0, 0, 0, 0, 0],
        [4, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 9, 0],
        [0, 0, 6, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0]],

        B: [[0, 0, 0, 0, 0, 0, 0, 0],
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
        A: [[0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 9, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 12, 0, 4],
        [0, 0, 3, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 6, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 2, 0, 0, 0, 0, 0, 0]],

        B: [[0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 9, 0, 0, 4],
        [0, 0, 6, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 12, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 2, 0, 0]],
    }
};
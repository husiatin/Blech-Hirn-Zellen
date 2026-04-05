import { Chip, Color, Symbol } from './state.js';
// hier sind die 4 Bretter mit jeweils zwei seiten gespeichert

// Wand-Definition (Bitmaske)
// N=1, E=2, S=4, W=8
export const WALLS = { N: 1, E: 2, S: 4, W: 8 };

export const CHIP_POSITIONS = {
    block1: {
        A: [new Chip(3, 1, Color.RED, Symbol.CIRCLE),
        new Chip(1, 4, Color.BLUE, Symbol.STAR),
        new Chip(6, 3, Color.GREEN, Symbol.COG),
        new Chip(4, 6, Color.YELLOW, Symbol.PENTAGON)],

        B: [new Chip(4, 1, Color.RED, Symbol.CIRCLE),
        new Chip(1, 3, Color.BLUE, Symbol.COG),
        new Chip(5, 5, Color.GREEN, Symbol.PENTAGON),
        new Chip(3, 6, Color.YELLOW, Symbol.STAR)]
    },
    block2: {
        A: [new Chip(4, 1, Color.RED, Symbol.PENTAGON),
        new Chip(2, 2, Color.BLUE, Symbol.CIRCLE),
        new Chip(3, 5, Color.GREEN, Symbol.STAR),
        new Chip(6, 6, Color.YELLOW, Symbol.COG)],

        B: [new Chip(1, 1, Color.RED, Symbol.STAR),
        new Chip(3, 3, Color.BLUE, Symbol.CIRCLE),
        new Chip(6, 5, Color.GREEN, Symbol.COG),
        new Chip(2, 6, Color.YELLOW, Symbol.PENTAGON)]
    },
    block3: {
        A: [new Chip(3, 2, Color.RED, Symbol.COG),
        new Chip(5, 3, Color.BLUE, Symbol.PENTAGON),
        new Chip(2, 4, Color.GREEN, Symbol.CIRCLE),
        new Chip(4, 5, Color.YELLOW, Symbol.STAR)],

        B: [new Chip(1, 1, Color.RED, Symbol.COG),
        new Chip(5, 1, Color.BLUE, Symbol.PENTAGON),
        new Chip(6, 4, Color.GREEN, Symbol.STAR),
        new Chip(2, 6, Color.YELLOW, Symbol.CIRCLE)]
    },
    block4: {
        A: [new Chip(0, 2, Color.RED, Symbol.STAR),
        new Chip(5, 3, Color.BLUE, Symbol.COG),
        new Chip(1, 5, Color.GREEN, Symbol.PENTAGON),
        new Chip(6, 6, Color.YELLOW, Symbol.CIRCLE)],

        B: [new Chip(5, 1, Color.RED, Symbol.CIRCLE),
        new Chip(1, 3, Color.BLUE, Symbol.COG),
        new Chip(6, 5, Color.GREEN, Symbol.PENTAGON),
        new Chip(2, 6, Color.YELLOW, Symbol.STAR)]
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
        [0, 0, 0, 0, 3, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 9]],

        B: [[0, 2, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 3, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 12, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [4, 0, 0, 0, 0, 9, 0, 0],
        [0, 0, 0, 6, 0, 0, 0, 0],
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
        [4, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 6, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 0],
        [0, 0, 12, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 9, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
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
        [6, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 9, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 12, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 2, 0, 0, 0, 0]],

        B: [[6, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 12, 0, 4],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 6, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 3, 0],
        [0, 0, 9, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0]],
    }
};
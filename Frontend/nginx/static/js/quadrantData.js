import { Chip } from './state.js';
// hier sind die 4 Bretter mit jeweils zwei seiten gespeichert

// Wand-Definition (Bitmaske)
// N=1, E=2, S=4, W=8
export const WALLS = { N: 1, E: 2, S: 4, W: 8 };

export const CHIP_POSITIONS = {
    block1: {
        A: [new Chip(3, 1, 'red', 'circle'),
        new Chip(1, 4, 'blue', 'star'),
        new Chip(6, 3, 'green', 'cog'),
        new Chip(4, 6, 'yellow', 'pentagon')],

        B: [new Chip(4, 1, 'red', 'circle'),
        new Chip(1, 3, 'blue', 'cog'),
        new Chip(5, 5, 'green', 'pentagon'),
        new Chip(3, 6, 'yellow', 'star')]
    },
    block2: {
        A: [new Chip(4, 1, 'red', 'pentagon'),
        new Chip(2, 2, 'blue', 'circle'),
        new Chip(3, 5, 'green', 'star'),
        new Chip(6, 6, 'yellow', 'cog')],

        B: [new Chip(1, 1, 'red', 'star'),
        new Chip(3, 3, 'blue', 'circle'),
        new Chip(6, 5, 'green', 'cog'),
        new Chip(2, 6, 'yellow', 'pentagon')]
    },
    block3: {
        A: [new Chip(3, 2, 'red', 'cog'),
        new Chip(5, 3, 'blue', 'pentagon'),
        new Chip(2, 4, 'green', 'circle'),
        new Chip(4, 5, 'yellow', 'star')],

        B: [new Chip(1, 1, 'red', 'cog'),
        new Chip(5, 1, 'blue', 'pentagon'),
        new Chip(6, 4, 'green', 'star'),
        new Chip(2, 6, 'yellow', 'circle')]
    },
    block4: {
        A: [new Chip(0, 2, 'red', 'star'),
        new Chip(5, 3, 'blue', 'cog'),
        new Chip(1, 5, 'green', 'pentagon'),
        new Chip(6, 6, 'yellow', 'circle')],

        B: [new Chip(5, 1, 'red', 'circle'),
        new Chip(1, 3, 'blue', 'cog'),
        new Chip(6, 5, 'green', 'pentagon'),
        new Chip(2, 6, 'yellow', 'star')]
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
        [6, 0, 0, 0, 0, 0, 0, 0],
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
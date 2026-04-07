// Shared constants used across frontend modules.
export const BOARD_SIZE = 16;
// Bit flags for walls in one cell value (binary mask).
// Example: E + S = 2 + 4 = 6.
export const WALLS = { N: 1, E: 2, S: 4, W: 8 };

// exported placeholder; main code will set this to the assembled board
export let finalBoardData = [];

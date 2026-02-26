import { BOARD_SIZE } from './constants.js';
import { QUADRANT_DATA, WALLS } from './quadrantData.js';

export function enforceSymmetry(boardData) {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if ((boardData[y][x] & WALLS.E) && x < BOARD_SIZE - 1) {
        boardData[y][x + 1] |= WALLS.W;
      }
      if ((boardData[y][x] & WALLS.S) && y < BOARD_SIZE - 1) {
        boardData[y + 1][x] |= WALLS.N;
      }
    }
  }
}

export function assembleBoard(choices) {
  const assembledData = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
  const quadrantConfigs = [
    { blockName: 'block1', offsetX: 0, offsetY: 0 }, { blockName: 'block2', offsetX: 8, offsetY: 0 },
    { blockName: 'block3', offsetX: 0, offsetY: 8 }, { blockName: 'block4', offsetX: 8, offsetY: 8 },
  ];
  for (const config of quadrantConfigs) {
    const chosenSide = choices[config.blockName];
    const sideData = QUADRANT_DATA[config.blockName][chosenSide];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        assembledData[y + config.offsetY][x + config.offsetX] = sideData[y][x];
      }
    }
  }
  enforceSymmetry(assembledData);
  for (let i = 0; i < BOARD_SIZE; i++) {
    assembledData[0][i] |= WALLS.N; assembledData[BOARD_SIZE - 1][i] |= WALLS.S;
    assembledData[i][0] |= WALLS.W; assembledData[i][BOARD_SIZE - 1] |= WALLS.E;
  }
  return assembledData;
}

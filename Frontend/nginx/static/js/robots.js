import { state } from './state.js';
import { WALLS } from './quadrantData.js';
import { renderRobots } from './ui.js';

export function isOccupied(x, y) {
  const activeId = state.game.activeRobotId;
  return state.game.robots.some(robot => robot.id !== activeId && robot.x === x && robot.y === y);
}

export function slide(dx, dy) {
  const activeRobot = state.game.robots.find(r => r.id === state.game.activeRobotId);
  if (!activeRobot) return;

  let moved = false;
  while (true) {
    const currentX = activeRobot.x;
    const currentY = activeRobot.y;
    const nextX = currentX + dx;
    const nextY = currentY + dy;

    if (nextX < 0 || nextY < 0 || nextX >= state.BOARD_SIZE || nextY >= state.BOARD_SIZE) break;

    const currentWalls = state.finalBoardData[currentY][currentX];
    const nextWalls = state.finalBoardData[nextY][nextX];

    let wallInTheWay = false;
    if (dx === 1 && (currentWalls & WALLS.E || nextWalls & WALLS.W)) wallInTheWay = true;
    else if (dx === -1 && (currentWalls & WALLS.W || nextWalls & WALLS.E)) wallInTheWay = true;
    else if (dy === 1 && (currentWalls & WALLS.S || nextWalls & WALLS.N)) wallInTheWay = true;
    else if (dy === -1 && (currentWalls & WALLS.N || nextWalls & WALLS.S)) wallInTheWay = true;

    if (wallInTheWay) break;

    if (isOccupied(nextX, nextY)) break;

    activeRobot.x = nextX;
    activeRobot.y = nextY;
    moved = true;
  }
  if (moved) renderRobots();
}

import { gameInfo } from './state.js';
import { WALLS } from './quadrantData.js';
import { renderRobots } from './ui.js';

export function isOccupied(x, y) {
  const activeId = gameInfo.activeRobotId;
  return gameInfo.robots.some(robot => robot.id !== activeId && robot.x === x && robot.y === y);
}

export function slide(dx, dy) {
  const activeRobot = gameInfo.robots.find(r => r.id === gameInfo.activeRobotId);
  if (!activeRobot) return;

  let moved = false;
  while (true) {
    const currentX = activeRobot.x;
    const currentY = activeRobot.y;
    const nextX = currentX + dx;
    const nextY = currentY + dy;

    if (nextX < 0 || nextY < 0 || nextX >= gameInfo.BOARD_SIZE || nextY >= gameInfo.BOARD_SIZE) break;

    const currentWalls = gameInfo.board[currentY][currentX];
    const nextWalls = gameInfo.board[nextY][nextX];

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

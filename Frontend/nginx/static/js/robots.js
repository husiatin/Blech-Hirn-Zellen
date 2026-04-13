import { state } from './state.js';
import { WALLS } from './constants.js';
import { isBoardInteractionLocked, renderRobots } from './ui.js';
import { sendSocketMessage } from './network.js';

// Check if another robot is already on a cell.
export function isOccupied(x, y) {
  const activeId = state.game.activeRobotId;
  return state.game.robots.some(robot => robot.id !== activeId && robot.x === x && robot.y === y);
}

// Ricochet-style movement: keep moving in a direction until blocked.
export function slide(dx, dy) {
  if (isBoardInteractionLocked()) return;
  const activeRobot = state.game.robots.find(r => r.id === state.game.activeRobotId);
  if (!activeRobot) return;
  const boardSize = state.finalBoardData.length;
  if (!boardSize) return;

  let moved = false;
  let startX = activeRobot.x;
  let startY = activeRobot.y;
  
  while (true) {
    const currentX = activeRobot.x;
    const currentY = activeRobot.y;
    const nextX = currentX + dx;
    const nextY = currentY + dy;

    if (nextX < 0 || nextY < 0 || nextX >= boardSize || nextY >= boardSize) break;

    const currentWalls = state.finalBoardData[currentY][currentX];
    const nextWalls = state.finalBoardData[nextY][nextX];

    // Walls can be encoded in current cell or neighboring cell.
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
  // Repaint only if anything changed.
  if (moved) {
    if (state.gameInfo && state.playerInfo && state.gameInfo.demonstrating_player_id === state.playerInfo.player_id) {
       sendSocketMessage("robot_moved", {
          robot_id: activeRobot.id,
          startX: startX,
          startY: startY,
          newX: activeRobot.x,
          newY: activeRobot.y
       });
    }
    renderRobots();
  }
}

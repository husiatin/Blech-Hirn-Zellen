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

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

export function setRobotsStartPostions(assembledData) {
  // No placement inside middle area
  // No placement on chips
  // No placement on other robots

  let possiblePositions = [];
  for (let y = 0; y < assembledData.length; y++) {
    for (let x = 0; x < assembledData[y].length; x++) {
      if (assembledData[y][x] !== 3 && assembledData[y][x] !== 6 && assembledData[y][x] !== 9 && assembledData[y][x] !== 12) {
        possiblePositions.push({ x, y });
      }
    }
  }

  gameInfo.robots.forEach(robot => {
    const randomPosition = possiblePositions[getRandomInt(0, possiblePositions.length)];
    robot.x = randomPosition.x;
    robot.y = randomPosition.y;
    possiblePositions = possiblePositions.filter(pos => pos.x !== randomPosition.x || pos.y !== randomPosition.y);
  });
}

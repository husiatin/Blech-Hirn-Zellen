// Annahme: quadrantData.js ist geladen.

const BOARD_SIZE = 16;
let finalBoardData = [];

let game = {
  timerSeconds: 60,
  playerName: '',
  robots: [
    { id: 'red',    color: '#d44', x: 1, y: 1 },
    { id: 'blue',   color: '#44d', x: 14, y: 2 },
    { id: 'green',  color: '#4d4', x: 6, y: 13 },
    { id: 'yellow', color: '#dd4', x: 13, y: 14 },
  ],
  activeRobotId: 'red',
  target: { color: 'Rot', x: 12, y: 3 },
};

const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const boardEl = document.getElementById('board');
const timerLabel = document.getElementById('timer-label');
const targetLabel = document.getElementById('target-label');
const boardName = document.getElementById('board-name');
let roundEndAt = null;

function show(view) {
  lobbyView.hidden = (view !== 'lobby');
  gameView.hidden = (view !== 'game');
  location.hash = '#' + view;
}
window.addEventListener('hashchange', () => show(location.hash.replace('#', '') || 'lobby'));

function enforceSymmetry(boardData) {
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

function assembleBoard(choices) {
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

document.getElementById('board-config-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const choices = {
    block1: formData.get('block1_side'), block2: formData.get('block2_side'),
    block3: formData.get('block3_side'), block4: formData.get('block4_side'),
  };
  game.timerSeconds = Number(formData.get('timer'));
  game.playerName = String(formData.get('playerName') || 'Spieler 1');
  finalBoardData = assembleBoard(choices);
  startRound();
  show('game');
});

function startRound() {
  boardName.textContent = 'Individuelles Brett';
  targetLabel.textContent = game.target.color;
  roundEndAt = Date.now() + game.timerSeconds * 1000;
  
  renderBoard(finalBoardData);
  renderRobots();
}

function renderBoard(boardData) {
  boardEl.innerHTML = '';
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x); cell.dataset.y = String(y);
      const wallValue = boardData[y][x];
      if (wallValue & WALLS.N) cell.classList.add('wall-north');
      if (wallValue & WALLS.E) cell.classList.add('wall-east');
      if (wallValue & WALLS.S) cell.classList.add('wall-south');
      if (wallValue & WALLS.W) cell.classList.add('wall-west');
      boardEl.appendChild(cell);
    }
  }
}

function renderRobots() {
  document.querySelectorAll('[class*="robot-"], .selected').forEach(c => {
    c.className = c.className.replace(/robot-\w+/g, '').replace('selected', '').trim();
  });
  for (const robot of game.robots) {
    const selector = `.cell[data-x="${robot.x}"][data-y="${robot.y}"]`;
    const cell = document.querySelector(selector);
    if (cell) {
      cell.classList.add(`robot-${robot.id}`);
      if (robot.id === game.activeRobotId) {
        cell.classList.add('selected');
      }
    }
  }
}

function isOccupied(x, y) {
  // Wichtig: Prüft, ob ein ANDERER Roboter die Zelle besetzt.
  const activeId = game.activeRobotId;
  return game.robots.some(robot => robot.id !== activeId && robot.x === x && robot.y === y);
}

// HIER IST DIE KORRIGIERTE FUNKTION
function slide(dx, dy) {
  const activeRobot = game.robots.find(r => r.id === game.activeRobotId);
  if (!activeRobot) return;

  let moved = false;
  while (true) {
    const currentX = activeRobot.x;
    const currentY = activeRobot.y;
    
    const nextX = currentX + dx;
    const nextY = currentY + dy;

    if (nextX < 0 || nextY < 0 || nextX >= BOARD_SIZE || nextY >= BOARD_SIZE) break;

    const currentWalls = finalBoardData[currentY][currentX];
    const nextWalls = finalBoardData[nextY][nextX];

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

boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const x = parseInt(cell.dataset.x, 10);
  const y = parseInt(cell.dataset.y, 10);
  const clickedRobot = game.robots.find(r => r.x === x && r.y === y);
  if (clickedRobot) {
    game.activeRobotId = clickedRobot.id;
    renderRobots();
  }
});

window.addEventListener('keydown', (e) => {
  if (location.hash !== '#game') return;
  const robotIds = ['red', 'blue', 'green', 'yellow'];
  const keyIndex = parseInt(e.key, 10) - 1;
  if (keyIndex >= 0 && keyIndex < robotIds.length) {
    game.activeRobotId = robotIds[keyIndex];
    renderRobots();
    return;
  }
  e.preventDefault();
  switch (e.key) {
    case 'ArrowUp': slide(0, -1); break;
    case 'ArrowRight': slide(1, 0); break;
    case 'ArrowDown': slide(0, 1); break;
    case 'ArrowLeft': slide(-1, 0); break;
  }
});

setInterval(() => {
  if (!roundEndAt || location.hash !== '#game') {
    timerLabel.textContent = '–';
    return;
  }
  const remaining = Math.max(0, roundEndAt - Date.now());
  timerLabel.textContent = `${Math.ceil(remaining / 1000)}s`;
}, 200);

show(location.hash.replace('#', '') || 'lobby');
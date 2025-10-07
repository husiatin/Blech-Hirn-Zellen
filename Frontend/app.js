const BOARD_SIZE = 16;
let game = {
  boardId: 'standard-16',
  timerSeconds: 60,
  playerName: '',
  target: { color: 'Rot', x: 12, y: 3 }, // Platzhalter
  robot: { x: 4, y: 4 }                  // ein Roboter für den Start
};

const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const boardEl = document.getElementById('board');
const timerLabel = document.getElementById('timer-label');
const targetLabel = document.getElementById('target-label');
const boardName = document.getElementById('board-name');
let roundEndAt = null;

// Einfacher Router: Lobby vs. Spiel
function show(view) {
  if (view === 'lobby') {
    lobbyView.hidden = false;
    gameView.hidden = true;
    location.hash = '#lobby';
  } else {
    lobbyView.hidden = true;
    gameView.hidden = false;
    location.hash = '#game';
  }
}
window.addEventListener('hashchange', () => {
  const h = location.hash.replace('#', '');
  show(h === 'game' ? 'game' : 'lobby');
});

// Lobby-Formular
document.getElementById('config-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  game.boardId = data.get('board');
  game.timerSeconds = Number(data.get('timer'));
  game.playerName = String(data.get('playerName') || '');
  startRound();
  show('game');
});

// Runde starten (Mock)
function startRound() {
  boardName.textContent = 'Standard 16×16';
  targetLabel.textContent = game.target.color;
  const now = Date.now();
  roundEndAt = now + game.timerSeconds * 1000;
  renderBoard();
  renderRobot();
}

// Board erzeugen
function renderBoard() {
  boardEl.innerHTML = '';
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      boardEl.appendChild(cell);
    }
  }
}

// Roboter anzeigen
function renderRobot() {
  document.querySelectorAll('.cell.robot').forEach(c => c.classList.remove('robot'));
  const selector = `.cell[data-x="${game.robot.x}"][data-y="${game.robot.y}"]`;
  const cell = document.querySelector(selector);
  if (cell) cell.classList.add('robot');
}

// Bewegung: rutschen bis zum Rand (Wände kommen später)
function slide(dx, dy) {
  let moved = false;
  while (true) {
    const nx = game.robot.x + dx;
    const ny = game.robot.y + dy;
    if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) break;
    game.robot.x = nx; game.robot.y = ny;
    moved = true;
  }
  if (moved) renderRobot();
}

// Tastatur
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); slide(0, -1); break;
    case 'ArrowRight': e.preventDefault(); slide(1, 0);  break;
    case 'ArrowDown':  e.preventDefault(); slide(0, 1);  break;
    case 'ArrowLeft':  e.preventDefault(); slide(-1, 0); break;
  }
});

// Timeranzeige
setInterval(() => {
  if (!roundEndAt) { timerLabel.textContent = '–'; return; }
  const remaining = Math.max(0, roundEndAt - Date.now());
  const s = Math.ceil(remaining / 1000);
  timerLabel.textContent = `${s}s`;
}, 200);

// Initial
show(location.hash === '#game' ? 'game' : 'lobby');
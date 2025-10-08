// Wir gehen davon aus, dass `quadrantData.js` bereits geladen wurde und
// uns die globalen Konstanten `WALLS` und `QUADRANT_DATA` zur Verfügung stellt.

const BOARD_SIZE = 16;
let finalBoardData = []; // NEU: Hier speichern wir das generierte 16x16 Brett

// GEÄNDERT: Das `game`-Objekt ist jetzt schlanker, da das Brett dynamisch wird.
let game = {
  timerSeconds: 60,
  playerName: '',
  target: { color: 'Rot', x: 12, y: 3 }, // Platzhalter
  robot: { x: 4, y: 4 }                  // Nur ein Roboter für den Start
};

// Die Referenzen auf die HTML-Elemente bleiben gleich
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const boardEl = document.getElementById('board');
const timerLabel = document.getElementById('timer-label');
const targetLabel = document.getElementById('target-label');
const boardName = document.getElementById('board-name');
let roundEndAt = null;

// Der Router bleibt unverändert
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

// --- NEUE FUNKTIONEN ZUM BRETT-BAU ---

// NEU: Stellt sicher, dass jede Wand von beiden Seiten existiert.
// Das macht das Erstellen der Quadranten-Daten viel einfacher.
function enforceSymmetry(boardData) {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      // Prüfe Ost-Wand -> füge West-Wand beim Nachbarn hinzu
      if ((boardData[y][x] & WALLS.E) && x < BOARD_SIZE - 1) {
        boardData[y][x + 1] |= WALLS.W;
      }
      // Prüfe Süd-Wand -> füge Nord-Wand beim Nachbarn hinzu
      if ((boardData[y][x] & WALLS.S) && y < BOARD_SIZE - 1) {
        boardData[y + 1][x] |= WALLS.N;
      }
    }
  }
}

// NEU: Baut das 16x16 Brett aus den gewählten Quadranten-Seiten zusammen.
function assembleBoard(choices) {
  const assembledData = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));

  const quadrantConfigs = [
    { blockName: 'block1', offsetX: 0, offsetY: 0 },
    { blockName: 'block2', offsetX: 8, offsetY: 0 },
    { blockName: 'block3', offsetX: 0, offsetY: 8 },
    { blockName: 'block4', offsetX: 8, offsetY: 8 },
  ];

  for (const config of quadrantConfigs) {
    const chosenSide = choices[config.blockName];
    const sideData = QUADRANT_DATA[config.blockName][chosenSide];

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const globalX = x + config.offsetX;
        const globalY = y + config.offsetY;
        assembledData[globalY][globalX] = sideData[y][x];
      }
    }
  }

  enforceSymmetry(assembledData);

  for (let i = 0; i < BOARD_SIZE; i++) {
    assembledData[0][i] |= WALLS.N;
    assembledData[BOARD_SIZE - 1][i] |= WALLS.S;
    assembledData[i][0] |= WALLS.W;
    assembledData[i][BOARD_SIZE - 1] |= WALLS.E;
  }

  return assembledData;
}


// --- GEÄNDERTE FUNKTIONEN ---

// GEÄNDERT: Der Event Listener lauscht jetzt auf das neue Formular.
document.getElementById('board-config-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  // Lese die Auswahl für jeden Block aus
  const choices = {
    block1: formData.get('block1_side'),
    block2: formData.get('block2_side'),
    block3: formData.get('block3_side'),
    block4: formData.get('block4_side'),
  };

  // Lese die Spiel-Einstellungen
  game.timerSeconds = Number(formData.get('timer'));
  game.playerName = String(formData.get('playerName') || 'Spieler 1');

  // Baue und speichere das Brett
  finalBoardData = assembleBoard(choices);
  
  // Starte die Runde und wechsle die Ansicht
  startRound();
  show('game');
});

// GEÄNDERT: `startRound` nutzt jetzt die neuen Daten.
function startRound() {
  boardName.textContent = 'Individuelles Brett'; // Angepasster Text
  targetLabel.textContent = game.target.color;
  const now = Date.now();
  roundEndAt = now + game.timerSeconds * 1000;
  
  // WICHTIG: Rufe renderBoard jetzt mit den neuen Brett-Daten auf.
  renderBoard(finalBoardData);
  renderRobot();
}

// GEÄNDERT: `renderBoard` zeichnet jetzt die Wände.
function renderBoard(boardData) {
  boardEl.innerHTML = '';
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      // Lese die Wand-Informationen und füge CSS-Klassen hinzu
      const wallValue = boardData[y][x];
      if (wallValue & WALLS.N) cell.classList.add('wall-north');
      if (wallValue & WALLS.E) cell.classList.add('wall-east');
      if (wallValue & WALLS.S) cell.classList.add('wall-south');
      if (wallValue & WALLS.W) cell.classList.add('wall-west');

      boardEl.appendChild(cell);
    }
  }
}

// Die `renderRobot`-Funktion bleibt unverändert.
function renderRobot() {
  document.querySelectorAll('.cell.robot').forEach(c => c.classList.remove('robot'));
  const selector = `.cell[data-x="${game.robot.x}"][data-y="${game.robot.y}"]`;
  const cell = document.querySelector(selector);
  if (cell) cell.classList.add('robot');
}

// Bewegung der Roboter
// Korrigierte, robuste `slide`-Funktion
function slide(dx, dy) {
  let moved = false;
  while (true) {
    const currentX = game.robot.x;
    const currentY = game.robot.y;
    const currentWalls = finalBoardData[currentY][currentX];

    // Potenzielle nächste Position berechnen
    const nextX = currentX + dx;
    const nextY = currentY + dy;

    // 1. Prüfung: Verlassen wir das Brett?
    if (nextX < 0 || nextY < 0 || nextX >= BOARD_SIZE || nextY >= BOARD_SIZE) {
      break; // Ja, also anhalten.
    }

    // 2. Prüfung: Ist eine Wand im Weg?
    // Wir müssen die Wand der aktuellen Zelle UND der nächsten Zelle prüfen.
    let wallInTheWay = false;
    const nextWalls = finalBoardData[nextY][nextX];

    if (dx === 1 && ((currentWalls & WALLS.E) || (nextWalls & WALLS.W))) {
      wallInTheWay = true; // Wand nach rechts (Ost) oder von links (West) in der nächsten Zelle
    } else if (dx === -1 && ((currentWalls & WALLS.W) || (nextWalls & WALLS.E))) {
      wallInTheWay = true; // Wand nach links (West)
    } else if (dy === 1 && ((currentWalls & WALLS.S) || (nextWalls & WALLS.N))) {
      wallInTheWay = true; // Wand nach unten (Süd)
    } else if (dy === -1 && ((currentWalls & WALLS.N) || (nextWalls & WALLS.S))) {
      wallInTheWay = true; // Wand nach oben (Nord)
    }
    
    if (wallInTheWay) {
      break; // Ja, also anhalten.
    }

    // Keine Hindernisse, bewege den Roboter
    game.robot.x = nextX;
    game.robot.y = nextY;
    moved = true;
  }
  
  // Rendere nur neu, wenn sich der Roboter tatsächlich bewegt hat
  if (moved) {
    renderRobot();
  }
}

//  Tastatur- und Timer-Logik 
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); slide(0, -1); break;
    case 'ArrowRight': e.preventDefault(); slide(1, 0);  break;
    case 'ArrowDown':  e.preventDefault(); slide(0, 1);  break;
    case 'ArrowLeft':  e.preventDefault(); slide(-1, 0); break;
  }
});

setInterval(() => {
  if (!roundEndAt) { timerLabel.textContent = '–'; return; }
  const remaining = Math.max(0, roundEndAt - Date.now());
  const s = Math.ceil(remaining / 1000);
  timerLabel.textContent = `${s}s`;
}, 200);

// Initialer Aufruf bleibt gleich
show(location.hash === '#game' ? 'game' : 'lobby');
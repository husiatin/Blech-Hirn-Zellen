import { boardEl, playerListContainer, playerListUl, playerListGameId, playerNameDisplay, boardName, targetLabel, guideModal, guideButton, guideSpan, roundTimerLabel, hourglassLabel } from './dom.js';
import { WALLS } from './constants.js';
import { state } from './state.js';
import { lobby, game } from './dom.js';
import { sendSocketMessage } from './network.js';

let roundTimerInterval = null;
let hourglassInterval = null;
export const finishDemonstrationButton = document.createElement('button');
finishDemonstrationButton.id = 'finish-demonstration-button';
finishDemonstrationButton.textContent = 'Finish Demonstration';
finishDemonstrationButton.hidden = true;
if (game) game.appendChild(finishDemonstrationButton);

finishDemonstrationButton.addEventListener('click', () => {
  sendSocketMessage("finish_demonstration", {});
  finishDemonstrationButton.hidden = true;
});

window.addEventListener('demonstration_started_event', () => {
  if (state.gameInfo.demonstrating_player_id === state.playerInfo.player_id) {
    finishDemonstrationButton.hidden = false;
    alert("It's your turn to demonstrate your solution!");
  } else {
    finishDemonstrationButton.hidden = true;
    demonstratingPlayerName = state.game.player_list.find(p => p.player_id === state.gameInfo.demonstrating_player_id).player_name;
    alert(`${demonstratingPlayerName} is demonstrating.`);
  }
});

// Render/update the list of players in the lobby.
export function renderPlayerList(gameInfo) {
  if (!gameInfo) {
    if (playerListContainer) playerListContainer.hidden = true;
    return;
  }

  if (playerListGameId) playerListGameId.textContent = gameInfo.game_id;
  if (playerListContainer) playerListContainer.hidden = false;

  if (!playerListUl) return;
  playerListUl.innerHTML = '';
  const players = gameInfo.player_list || [];
  for (const p of players) {
    const li = document.createElement('li');
    const name = p.player_name || p.name || p.player_id;

    const nameNode = document.createElement('span');
    nameNode.textContent = name;
    li.appendChild(nameNode);

    if (p.player_id === gameInfo.game_master_id) {
      li.classList.add('gm');
      const badge = document.createElement('span');
      badge.className = 'gm-badge';
      badge.textContent = '- Spielleiter';
      li.appendChild(badge);
    }

    playerListUl.appendChild(li);
  }
}

// Show current local player name in the header.
export function renderPlayerName() {
  if (!playerNameDisplay) return;
  if (!state.playerInfo || !state.playerInfo.player_name) {
    playerNameDisplay.hidden = true;
    return;
  }
  playerNameDisplay.textContent = `Dein Name: ${state.playerInfo.player_name}`;
  playerNameDisplay.hidden = false;
}

// Draw a full board grid from backend wall data.
export function renderBoard(boardData) {
  if (!Array.isArray(boardData) || !boardData.length) return;
  const boardSize = boardData.length;
  boardEl.style.setProperty('--cells', String(boardSize));
  boardEl.innerHTML = '';
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x); cell.dataset.y = String(y);
      const wallValue = boardData[y][x];
      // Add directional wall classes from the bitmask.
      if (wallValue & WALLS.N) cell.classList.add('wall-north');
      if (wallValue & WALLS.E) cell.classList.add('wall-east');
      if (wallValue & WALLS.S) cell.classList.add('wall-south');
      if (wallValue & WALLS.W) cell.classList.add('wall-west');
      boardEl.appendChild(cell);
    }
  }
}

// Paint all robots on top of board cells.
export function renderRobots() {
  document.querySelectorAll('[class*="robot-"], .selected').forEach(c => {
    c.className = c.className.replace(/robot-\w+/g, '').replace('selected', '').trim();
  });
  for (const robot of state.game.robots) {
    const selector = `.cell[data-x="${robot.x}"][data-y="${robot.y}"]`;
    const cell = document.querySelector(selector);
    if (cell) {
      cell.classList.add(`robot-${robot.id}`);
      if (robot.id === state.game.activeRobotId) {
        cell.classList.add('selected');
      }
    }
  }
}

// Draw chip symbols (target icons) on matching cells.
export function renderChips() {
  document.querySelectorAll('.chip').forEach((chip) => chip.remove());
  const chips = Array.isArray(state.game.chips) ? state.game.chips : [];
  if (!chips.length) return;

  const symbolToChar = (symbol) => {
    switch (String(symbol || '').toLowerCase()) {
      case 'circle': return '●';
      case 'star': return '★';
      case 'cog': return '⚙';
      case 'pentagon': return '⬟';
      default: return '';
    }
  };

  for (const chip of chips) {
    const x = Number(chip.x);
    const y = Number(chip.y);
    const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
    if (!cell) continue;

    const chipEl = document.createElement('div');
    chipEl.className = `chip chip-${String(chip.color || '').toLowerCase()}`;
    chipEl.textContent = symbolToChar(chip.symbol);
    chipEl.title = `${chip.color || 'chip'} ${chip.symbol || ''}`.trim();
    cell.appendChild(chipEl);
  }
}

export function renderGoalChipLabel() {
  if (!targetLabel) return;
  if (!state || !state.game || !state.game.target) {
    targetLabel.textContent = '–';
    targetLabel.className = '';
    targetLabel.title = '';
    return;
  }

  let target = state.game.target;
  let chip = state.game.chips ? state.game.chips.find(c => Number(c.x) === target.x && Number(c.y) === target.y) : null;

  if (!chip) {
    targetLabel.textContent = target.color || '–';
    targetLabel.className = '';
    targetLabel.title = '';
    return;
  }

  targetLabel.className = `chip-${String(chip.color || '').toLowerCase()}`;

  let char = '';
  let symbol = chip.symbol;
  if (String(symbol || '').toLowerCase() === 'circle') char = '●';
  else if (String(symbol || '').toLowerCase() === 'star') char = '★';
  else if (String(symbol || '').toLowerCase() === 'cog') char = '⚙';
  else if (String(symbol || '').toLowerCase() === 'pentagon') char = '⬟';
  else char = '?';

  targetLabel.textContent = char;
  targetLabel.style.fontSize = '20px';
  targetLabel.style.fontWeight = 'bold';
  targetLabel.title = `Ziel: ${symbol} mit Farbe ${target.color}`;
}

// Start round UI: title, target label, timer, board + entities.
export function startRound() {
  boardName.textContent = 'Individuelles Brett';
  renderGoalChipLabel();
  renderBoard(state.finalBoardData);
  renderChips();
  renderRobots();
}

// Simple hash-based view switch between lobby and game.
export function show(view) {
  // view is 'lobby' or 'game' or others

  if (lobby) lobby.hidden = (view !== 'lobby');
  if (game) game.hidden = (view !== 'game');
}

// Render all submitted bids for the current game.
export function renderBidList(gameInfo) {
  const ul = document.getElementById('bids-list');
  if (!ul) return;
  ul.innerHTML = '';
  const bids = gameInfo?.bids ?? [];
  for (const bid of bids) {
    const player = (gameInfo?.player_list ?? []).find(p => p.player_id === bid.player_id);
    const name = player ? player.player_name : bid.player_id;
    const label = bid.number_of_moves;
    const li = document.createElement('li');
    li.textContent = `${name}: ${label} moves`;
    ul.appendChild(li);
  }
}

// Guide modal open/close handlers.
// When the user clicks the button, open the modal 
if (guideButton && guideModal) {
  guideButton.onclick = function () {
    guideModal.style.display = 'block';
  };
}

// When the user clicks on <span> (x), close the modal
if (guideSpan && guideModal) {
  guideSpan.onclick = function () {
    guideModal.style.display = 'none';
  };
}

// When the user clicks anywhere outside of the modal, close it
window.addEventListener('click', (event) => {
  if (guideModal && event.target === guideModal) {
    guideModal.style.display = 'none';
  }
});

function formatSeconds(seconds, label) {
  if (!label) return;
  if (seconds <= 0) {
    label.textContent = '0s';
    return;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    label.textContent = `${minutes} min ${seconds % 60}s`;
  } else {
    label.textContent = `${seconds % 60}s`;
  }
}

function createCountdown(durationSeconds, label, onExpired) {
  let remaining = durationSeconds;
  formatSeconds(remaining, label);

  const id = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(id);
      formatSeconds(0, label);
      if (typeof onExpired === 'function') onExpired();
    } else {
      formatSeconds(remaining, label);
    }
  }, 1000);

  return id;
}

export function startRoundTimer(durationSeconds) {
  stopRoundTimer(); // Clear any previous interval first
  if (!roundTimerLabel) return;

  roundTimerInterval = createCountdown(durationSeconds, roundTimerLabel, () => {
    // The backend will send round_failed if needed; nothing to do on the
    // frontend when the countdown hits zero other than show 0.
  });
}

export function stopRoundTimer() {
  if (roundTimerInterval !== null) {
    clearInterval(roundTimerInterval);
    roundTimerInterval = null;
  }
  if (roundTimerLabel) roundTimerLabel.textContent = '–';
}

export function startHourglassTimer(durationSeconds) {
  stopHourglassTimer(); // Clear any previous interval first
  if (!hourglassLabel) return;

  hourglassInterval = createCountdown(durationSeconds, hourglassLabel, () => {
    // The backend drives the actual end show 0 until hourglass_ended
    // arrives and calls stopHourglassTimer().
  });
}

export function stopHourglassTimer() {
  if (hourglassInterval !== null) {
    clearInterval(hourglassInterval);
    hourglassInterval = null;
  }
  if (hourglassLabel) hourglassLabel.textContent = '–';
}
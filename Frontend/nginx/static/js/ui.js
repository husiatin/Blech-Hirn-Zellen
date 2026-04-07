import { boardEl, playerListContainer, playerListUl, playerListGameId, playerNameDisplay, boardName, targetLabel, guideModal, guideButton, guideSpan, lobby, game, roundTimerLabel, hourglassLabel } from './dom.js';
import { WALLS } from './quadrantData.js';
import { gameInfo, playerInfo } from './state.js';
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
  if (gameInfo.demonstrating_player_id === playerInfo.player_id) {
    finishDemonstrationButton.hidden = false;
    alert("It's your turn to demonstrate your solution!");
  } else {
    finishDemonstrationButton.hidden = true;
  }
});
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
      badge.textContent = 'Spielleiter';
      li.appendChild(badge);
    }

    playerListUl.appendChild(li);
  }
}

export function renderPlayerName() {
  if (!playerNameDisplay) return;
  if (!playerInfo || !playerInfo.player_name) {
    playerNameDisplay.hidden = true;
    return;
  }
  playerNameDisplay.textContent = `Dein Name: ${playerInfo.player_name}`;
  playerNameDisplay.hidden = false;
}

export function renderBoard(board) {
  boardEl.innerHTML = '';
  for (let y = 0; y < board.board_size; y++) {
    for (let x = 0; x < board.board_size; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x); cell.dataset.y = String(y);
      const wallValue = board.board_data[y][x];
      if (wallValue & WALLS.N) cell.classList.add('wall-north');
      if (wallValue & WALLS.E) cell.classList.add('wall-east');
      if (wallValue & WALLS.S) cell.classList.add('wall-south');
      if (wallValue & WALLS.W) cell.classList.add('wall-west');
      boardEl.appendChild(cell);
    }
  }
}

export function renderRobots() {
  document.querySelectorAll('[class*="robot-"], .selected').forEach(c => {
    c.className = c.className.replace(/robot-\w+/g, '').replace('selected', '').trim();
  });
  for (const robot of gameInfo.robots) {
    const selector = `.cell[data-x="${robot.x}"][data-y="${robot.y}"]`;
    const cell = document.querySelector(selector);
    if (cell) {
      const robotId = robot.id || robot.color;
      cell.classList.add(`robot-${robotId}`);
      if (robotId === gameInfo.active_robot_id) {
        cell.classList.add('selected');
      }
    }
  }
}

export function renderChips() {
  document.querySelectorAll('.chip').forEach(c => c.remove());
  if (!gameInfo.chips) return;
  for (const chip of gameInfo.chips) {
    const selector = `.cell[data-x="${chip.x}"][data-y="${chip.y}"]`;
    const cell = document.querySelector(selector);
    if (cell) {
      const chipEl = document.createElement('div');
      chipEl.className = `chip chip-${chip.color}`;
      let char = '';
      if (chip.symbol === 'circle') char = '●';
      else if (chip.symbol === 'star') char = '★';
      else if (chip.symbol === 'cog') char = '⚙';
      else if (chip.symbol === 'pentagon') char = '⬟';
      chipEl.textContent = char;
      cell.appendChild(chipEl);
    }
  }
}

export function renderGoalChipLabel() {
  if (!targetLabel) return;
  if (!gameInfo.goal_chip) {
    targetLabel.textContent = '';
    return;
  }
  targetLabel.className = `tooltip chip-${gameInfo.goal_chip.color}`;
  const tooltipText = document.createElement('span');
  tooltipText.className = 'tooltiptext';
  let char = '';
  if (gameInfo.goal_chip.symbol === 'circle') char = '●';
  else if (gameInfo.goal_chip.symbol === 'star') char = '★';
  else if (gameInfo.goal_chip.symbol === 'cog') char = '⚙';
  else if (gameInfo.goal_chip.symbol === 'pentagon') char = '⬟';
  targetLabel.textContent = char;
  tooltipText.textContent = `Ziel: ${gameInfo.goal_chip.symbol} mit Farbe ${gameInfo.goal_chip.color}`;
  targetLabel.appendChild(tooltipText);
}

export function startRound() {
  boardName.textContent = 'Individuelles Brett';
  renderGoalChipLabel();
  renderBoard(gameInfo.board);
  renderChips();
  renderRobots();
}

export function show(view) {
  // view is 'lobby' or 'game' or others

  if (lobby) lobby.hidden = (view !== 'lobby');
  if (game) game.hidden = (view !== 'game');
}

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

// When the user clicks the button, open the modal 
guideButton.onclick = function () {
  guideModal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
guideSpan.onclick = function () {
  guideModal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == guideModal) {
    guideModal.style.display = "none";
  }
}

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

import { boardEl, playerListContainer, playerListUl, playerListGameId, playerNameDisplay, boardName, targetLabel, guideModal, guideButton, guideSpan } from './dom.js';
import { WALLS } from './quadrantData.js';
import { gameInfo } from './state.js';
import { lobby, game, roundTimerLabel, hourglassLabel } from './dom.js';

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

export function renderPlayerName() {
  if (!playerNameDisplay) return;
  if (!gameInfo.playerInfo || !gameInfo.playerInfo.player_name) {
    playerNameDisplay.hidden = true;
    return;
  }
  playerNameDisplay.textContent = `Dein Name: ${gameInfo.playerInfo.player_name}`;
  playerNameDisplay.hidden = false;
}

export function renderBoard(boardData) {
  boardEl.innerHTML = '';
  for (let y = 0; y < gameInfo.BOARD_SIZE; y++) {
    for (let x = 0; x < gameInfo.BOARD_SIZE; x++) {
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

export function renderRobots() {
  document.querySelectorAll('[class*="robot-"], .selected').forEach(c => {
    c.className = c.className.replace(/robot-\w+/g, '').replace('selected', '').trim();
  });
  for (const robot of gameInfo.robots) {
    const selector = `.cell[data-x="${robot.x}"][data-y="${robot.y}"]`;
    const cell = document.querySelector(selector);
    if (cell) {
      cell.classList.add(`robot-${robot.id}`);
      if (robot.id === gameInfo.activeRobotId) {
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

export function startRound() {
  boardName.textContent = 'Individuelles Brett';
  targetLabel.textContent = gameInfo.goal_chip.color;
  roundTimer();
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

// timer after bid is made and backend has responded
export function hourglassTimer() {
  var hourglassSec = gameInfo.timer_duration;
  timer(hourglassSec, hourglassLabel);
}

//timer for max round duration -> if players take too long to find a solution the round ends
export function roundTimer() {
  var roundSec = gameInfo.timer_duration * 60;
  timer(roundSec, roundTimerLabel);
}

function timer(durationInSeconds, label) {
  var timer = setInterval(() => {
    if (!durationInSeconds || location.hash !== '#game') {
      if (label) label.textContent = '–';
      return;
    }

    if (label) {
      var minutes = Math.floor(durationInSeconds / 60);
      if (minutes > 0) {
        label.textContent = `${minutes} min ${durationInSeconds % 60}s`;
      }
      else {
        label.textContent = `${durationInSeconds % 60}s`;
      }
    }

    durationInSeconds--;
    if (durationInSeconds < 0) {
      clearTimeout(timer);
      // TODO trigger end of round in UI and backend or ends move and send that to backend
    }
  }, 1000); //1000ms = 1s
}

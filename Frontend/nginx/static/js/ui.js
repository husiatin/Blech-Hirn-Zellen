import { boardEl, playerListContainer, playerListUl, playerListGameId, playerNameDisplay, boardName, targetLabel, guideModal, guideButton, guideSpan } from './dom.js';
import { WALLS } from './quadrantData.js';
import { gameInfo } from './state.js';
import { lobby, game } from './dom.js';

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

}

export function startRound() {
  boardName.textContent = 'Individuelles Brett';
  targetLabel.textContent = gameInfo.goal_chip.color;
  gameInfo.roundEndAt = Date.now() + gameInfo.timer_duration * 1000;
  renderBoard(gameInfo.board);
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

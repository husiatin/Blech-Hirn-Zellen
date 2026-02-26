import { boardEl, playerListContainer, playerListUl, playerListGameId, playerNameDisplay, boardName, targetLabel } from './dom.js';
import { WALLS } from './quadrantData.js';
import { state } from './state.js';
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
  if (!state.playerInfo || !state.playerInfo.player_name) {
    playerNameDisplay.hidden = true;
    return;
  }
  playerNameDisplay.textContent = `Dein Name: ${state.playerInfo.player_name}`;
  playerNameDisplay.hidden = false;
}

export function renderBoard(boardData) {
  boardEl.innerHTML = '';
  for (let y = 0; y < state.BOARD_SIZE; y++) {
    for (let x = 0; x < state.BOARD_SIZE; x++) {
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

export function renderChips() {
    
}

export function startRound() {
  boardName.textContent = 'Individuelles Brett';
  targetLabel.textContent = state.game.target.color;
  state.roundEndAt = Date.now() + state.game.timerSeconds * 1000;
  renderBoard(state.finalBoardData);
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

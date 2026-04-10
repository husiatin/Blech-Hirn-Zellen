import {
  boardEl,
  boardContainerEl,
  arrowCanvasEl,
  playerListContainer,
  playerListUl,
  playerListGameId,
  playerNameDisplay,
  boardName,
  targetLabel,
  guideModal,
  guideButton,
  guideSpan,
  roundTimerLabel,
  hourglassLabel,
  gameEventModal,
  gameEventTitle,
  gameEventMessage,
  gameEventConfirm,
  solutionLoadingModal,
  solutionLoadingTitle,
  solutionLoadingMessage,
  lobby,
  game,
  gameOver,
  gameOverMessage,
  gameOverTimer,
  gameOverPlayerList,
  playAgainButton,
  leaveAfterGameButton
} from './dom.js';
import { WALLS } from './constants.js';
import { state } from './state.js';
import { sendSocketMessage } from './network.js';

let roundTimerInterval = null;
let hourglassInterval = null;
let endGameCountdownInterval = null;

const MOVE_STEP_DELAY_MS = 1000;
const SOLUTION_ARROW_COLORS = {
  red: '#c73a3a',
  yellow: '#b89a2d',
  green: '#3caa54',
  blue: '#3c58c7'
};

function cloneRobots(robots) {
  return Array.isArray(robots)
    ? robots.map((robot) => ({
      ...robot,
      id: String(robot.id),
      x: Number(robot.x),
      y: Number(robot.y)
    }))
    : [];
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getBoardSize() {
  return state.finalBoardData.length || state.BOARD_SIZE;
}

function symbolToChar(symbol) {
  switch (String(symbol || '').toLowerCase()) {
    case 'circle': return '●';
    case 'star': return '★';
    case 'cog': return '⚙';
    case 'pentagon': return '⬟';
    default: return '';
  }
}

export function rememberRoundStartRobots(robots = state.game.robots) {
  state.game.roundStartRobots = cloneRobots(robots);
}

export function restoreRoundStartRobots() {
  state.game.robots = cloneRobots(state.game.roundStartRobots);
  if (state.game.robots.length && !state.game.robots.some((robot) => robot.id === state.game.activeRobotId)) {
    state.game.activeRobotId = state.game.robots[0].id;
  }
  renderRobots();
}

export function clearSolutionOverlay() {
  if (!arrowCanvasEl) return;
  arrowCanvasEl.querySelectorAll('[data-solution-arrow="true"]').forEach((node) => node.remove());
}

export function syncArrowCanvasSize() {
  if (!boardEl || !arrowCanvasEl || !boardContainerEl) return;
  const width = boardEl.clientWidth || boardContainerEl.clientWidth;
  const height = boardEl.clientHeight || boardContainerEl.clientHeight;
  if (!width || !height) return;
  arrowCanvasEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
}

function appendSolutionArrow(move) {
  if (!arrowCanvasEl || !boardEl) return;
  syncArrowCanvasSize();
  const boardSize = getBoardSize();
  const cellWidth = boardEl.clientWidth / boardSize;
  const cellHeight = boardEl.clientHeight / boardSize;
  const startX = (Number(move.startX) + 0.5) * cellWidth;
  const startY = (Number(move.startY) + 0.5) * cellHeight;
  const endX = (Number(move.newX) + 0.5) * cellWidth;
  const endY = (Number(move.newY) + 0.5) * cellHeight;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(startX));
  line.setAttribute('y1', String(startY));
  line.setAttribute('x2', String(endX));
  line.setAttribute('y2', String(endY));
  line.setAttribute('stroke', SOLUTION_ARROW_COLORS[String(move.robot_id).toLowerCase()] || '#1f2937');
  line.setAttribute('stroke-width', '4');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('marker-end', 'url(#arrowhead)');
  line.setAttribute('data-solution-arrow', 'true');
  arrowCanvasEl.appendChild(line);
}

export function showGameModal(message, title = 'Rundenhinweis', autoCloseMs = null) {
  if (!gameEventModal || !gameEventMessage || !gameEventConfirm) {
    return Promise.resolve();
  }

  if (gameEventTitle) gameEventTitle.textContent = title;
  gameEventMessage.textContent = message;
  gameEventModal.style.display = 'block';

  return new Promise((resolve) => {
    let timeoutId = null;
    const handleConfirm = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      gameEventModal.style.display = 'none';
      gameEventConfirm.removeEventListener('click', handleConfirm);
      resolve();
    };

    gameEventConfirm.addEventListener('click', handleConfirm);
    if (typeof autoCloseMs === 'number' && autoCloseMs > 0) {
      timeoutId = window.setTimeout(handleConfirm, autoCloseMs);
    }
  });
}

export function showSolutionLoading(message = 'Die beste Loesung wird gerade berechnet.', title = 'Backend arbeitet') {
  if (!solutionLoadingModal) return;
  if (solutionLoadingTitle) solutionLoadingTitle.textContent = title;
  if (solutionLoadingMessage) solutionLoadingMessage.textContent = message;
  solutionLoadingModal.style.display = 'block';
}

export function hideSolutionLoading() {
  if (!solutionLoadingModal) return;
  solutionLoadingModal.style.display = 'none';
}

export const finishDemonstrationButton = document.createElement('button');
finishDemonstrationButton.id = 'finish-demonstration-button';
finishDemonstrationButton.textContent = 'Finish Demonstration';
finishDemonstrationButton.hidden = true;
if (game) game.appendChild(finishDemonstrationButton);

finishDemonstrationButton.addEventListener('click', () => {
  sendSocketMessage('finish_demonstration', {});
  finishDemonstrationButton.hidden = true;
  showSolutionLoading('Die Demonstration wird geprueft und die beste Loesung wird berechnet.', 'Runde wird ausgewertet');
});

window.addEventListener('demonstration_started_event', () => {
  if (state.gameInfo.demonstrating_player_id === state.playerInfo.player_id) {
    finishDemonstrationButton.hidden = false;
    void showGameModal("It's your turn to demonstrate your solution!", 'Demonstration');
  } else {
    finishDemonstrationButton.hidden = true;
    const demonstratingPlayerName = state.gameInfo?.player_list?.find((player) => player.player_id === state.gameInfo.demonstrating_player_id)?.player_name || 'Another player';
    void showGameModal(`${demonstratingPlayerName} is demonstrating.`, 'Demonstration');
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
      badge.textContent = '- Spielleiter';
      li.appendChild(badge);
    }

    playerListUl.appendChild(li);
  }
}

function renderWonChips(chips = []) {
  const chipRow = document.createElement('div');
  chipRow.className = 'results-chip-row';

  if (!chips.length) {
    const empty = document.createElement('span');
    empty.className = 'results-chip-empty';
    empty.textContent = 'Keine Spielchips';
    chipRow.appendChild(empty);
    return chipRow;
  }

  for (const chip of chips) {
    const chipEl = document.createElement('span');
    chipEl.className = `results-chip chip-${String(chip.color || '').toLowerCase()}`;
    chipEl.textContent = symbolToChar(chip.symbol);
    chipEl.title = `${chip.color || 'chip'} ${chip.symbol || ''}`.trim();
    chipRow.appendChild(chipEl);
  }

  return chipRow;
}

export function renderEndGameStandings(standings = [], replayVotes = {}) {
  if (!gameOverPlayerList) return;
  gameOverPlayerList.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'results-list';

  for (const player of standings) {
    const item = document.createElement('article');
    item.className = 'results-player';
    if (player.is_winner) item.classList.add('winner');

    const header = document.createElement('div');
    header.className = 'results-player-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'results-player-title';

    const name = document.createElement('strong');
    name.textContent = player.player_name || player.player_id;
    titleWrap.appendChild(name);

    if (player.is_game_master) {
      const gmBadge = document.createElement('span');
      gmBadge.className = 'gm-badge';
      gmBadge.textContent = 'Spielleiter';
      titleWrap.appendChild(gmBadge);
    }

    if (player.is_winner) {
      const winnerBadge = document.createElement('span');
      winnerBadge.className = 'winner-badge';
      winnerBadge.textContent = 'Gewinner';
      titleWrap.appendChild(winnerBadge);
    }

    const count = document.createElement('span');
    count.className = 'results-chip-count';
    count.textContent = `${player.won_chip_count} Spielchips`;

    header.appendChild(titleWrap);
    header.appendChild(count);

    const vote = document.createElement('div');
    vote.className = 'results-vote';
    const choice = replayVotes[player.player_id];
    vote.textContent =
      choice === 'play_again'
        ? 'Spielt weiter'
        : choice === 'leave'
          ? 'Verlaesst das Spiel'
          : 'Noch keine Auswahl';

    item.appendChild(header);
    item.appendChild(renderWonChips(player.won_chips));
    item.appendChild(vote);
    list.appendChild(item);
  }

  gameOverPlayerList.appendChild(list);
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
  if (!Array.isArray(boardData) || !boardData.length) return;
  const boardSize = boardData.length;
  boardEl.style.setProperty('--cells', String(boardSize));
  boardEl.innerHTML = '';
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      const wallValue = boardData[y][x];
      if (wallValue & WALLS.N) cell.classList.add('wall-north');
      if (wallValue & WALLS.E) cell.classList.add('wall-east');
      if (wallValue & WALLS.S) cell.classList.add('wall-south');
      if (wallValue & WALLS.W) cell.classList.add('wall-west');
      boardEl.appendChild(cell);
    }
  }
  syncArrowCanvasSize();
}

export function renderRobots() {
  document.querySelectorAll('[class*="robot-"], .selected').forEach((cell) => {
    cell.className = cell.className.replace(/robot-\w+/g, '').replace('selected', '').trim();
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
  document.querySelectorAll('.chip').forEach((chip) => chip.remove());
  const chips = Array.isArray(state.game.chips) ? state.game.chips : [];
  if (!chips.length) return;

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

  const target = state.game.target;
  const chip = state.game.chips ? state.game.chips.find((item) => Number(item.x) === target.x && Number(item.y) === target.y) : null;

  if (!chip) {
    targetLabel.textContent = target.color || '–';
    targetLabel.className = '';
    targetLabel.title = '';
    return;
  }

  targetLabel.className = `chip-${String(chip.color || '').toLowerCase()}`;
  targetLabel.textContent = symbolToChar(chip.symbol) || '?';
  targetLabel.style.fontSize = '20px';
  targetLabel.style.fontWeight = 'bold';
  targetLabel.title = `Ziel: ${chip.symbol} mit Farbe ${target.color}`;
}

export function startRound() {
  boardName.textContent = 'Individuelles Brett';
  renderGoalChipLabel();
  renderBoard(state.finalBoardData);
  renderChips();
  clearSolutionOverlay();
  renderRobots();
}

export function show(view) {
  if (lobby) lobby.hidden = (view !== 'lobby');
  if (game) game.hidden = (view !== 'game');
  if (gameOver) gameOver.hidden = (view !== 'game-over');
}

export function renderBidList(gameInfo) {
  const ul = document.getElementById('bids-list');
  if (!ul) return;
  ul.innerHTML = '';
  const bids = gameInfo?.bids ?? [];
  for (const bid of bids) {
    const player = (gameInfo?.player_list ?? []).find((p) => p.player_id === bid.player_id);
    const name = player ? player.player_name : bid.player_id;
    const label = bid.number_of_moves;
    const li = document.createElement('li');
    li.textContent = `${name}: ${label} moves`;
    ul.appendChild(li);
  }
}

if (guideButton && guideModal) {
  guideButton.onclick = function () {
    guideModal.style.display = 'block';
  };
}

if (guideSpan && guideModal) {
  guideSpan.onclick = function () {
    guideModal.style.display = 'none';
  };
}

window.addEventListener('click', (event) => {
  if (guideModal && event.target === guideModal) {
    guideModal.style.display = 'none';
  }
});

window.addEventListener('resize', syncArrowCanvasSize);

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
  stopRoundTimer();
  if (!roundTimerLabel) return;

  roundTimerInterval = createCountdown(durationSeconds, roundTimerLabel, () => {
    showSolutionLoading(
      'Die Rundenzeit ist abgelaufen. Der Backend-Server berechnet jetzt die beste Loesung.',
      'Bitte warten'
    );
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
  stopHourglassTimer();
  if (!hourglassLabel) return;

  hourglassInterval = createCountdown(durationSeconds, hourglassLabel, () => {
    // Backend sends the actual transition event.
  });
}

export function stopHourglassTimer() {
  if (hourglassInterval !== null) {
    clearInterval(hourglassInterval);
    hourglassInterval = null;
  }
  if (hourglassLabel) hourglassLabel.textContent = '–';
}

export function updateReplayChoiceButtons(choice) {
  if (playAgainButton) {
    playAgainButton.classList.toggle('selected-action', choice === 'play_again');
  }
  if (leaveAfterGameButton) {
    leaveAfterGameButton.classList.toggle('selected-action', choice === 'leave');
  }
}

export function stopEndGameCountdown() {
  if (endGameCountdownInterval !== null) {
    clearInterval(endGameCountdownInterval);
    endGameCountdownInterval = null;
  }
}

export function startEndGameCountdown(durationSeconds) {
  stopEndGameCountdown();
  if (!gameOverTimer) return;

  let remaining = Number(durationSeconds) || 0;
  gameOverTimer.textContent = `Neue Runde in ${remaining}s. Ohne Auswahl wirst du aus dem Spiel entfernt.`;

  endGameCountdownInterval = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      stopEndGameCountdown();
      gameOverTimer.textContent = 'Neue Runde wird vorbereitet...';
      return;
    }
    gameOverTimer.textContent = `Neue Runde in ${remaining}s. Ohne Auswahl wirst du aus dem Spiel entfernt.`;
  }, 1000);
}

export function renderEndGameScreen({ standings = [], replayVotes = {}, replayDurationSeconds = 0, winnerNames = [] } = {}) {
  if (gameOverMessage) {
    if (!standings.length) {
      gameOverMessage.textContent = 'Alle Spielchips wurden vergeben. Es gibt keinen Gewinner.';
    } else if (winnerNames.length === 1) {
      gameOverMessage.textContent = `${winnerNames[0]} gewinnt mit den meisten Spielchips.`;
    } else {
      gameOverMessage.textContent = `${winnerNames.join(', ')} gewinnen mit gleich vielen Spielchips.`;
    }
  }

  renderEndGameStandings(standings, replayVotes);
  updateReplayChoiceButtons(state.game.endGame.userChoice);
  startEndGameCountdown(replayDurationSeconds);
}

export async function playOptimalSolution(solutionArray) {
  if (!Array.isArray(solutionArray) || !solutionArray.length || !state.game.roundStartRobots.length) {
    return;
  }

  state.game.isSolutionPlaybackActive = true;
  try {
    clearSolutionOverlay();
    restoreRoundStartRobots();
    await delay(MOVE_STEP_DELAY_MS);

    for (const move of solutionArray) {
      const robot = state.game.robots.find((item) => item.id === String(move.robot_id));
      if (!robot) continue;
      state.game.activeRobotId = robot.id;
      appendSolutionArrow(move);
      robot.x = Number(move.newX);
      robot.y = Number(move.newY);
      renderRobots();
      await delay(MOVE_STEP_DELAY_MS);
    }
  } finally {
    state.game.isSolutionPlaybackActive = false;
  }
}

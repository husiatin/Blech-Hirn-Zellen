import { boardConfigForm, createGame, joinGame, joinGameIdInput, lobbyModeSelect, showCreateFlow, showJoinFlow, createFlow, joinFlow, makeBet } from './dom.js';
import { state, Player, GameInfo } from './state.js';
import { renderPlayerList, renderPlayerName, startRound, show, renderBidList } from './ui.js';
import { slide } from './robots.js';
import { createGameRequest, fetchPlayableBoardRequest, joinGameRequest, connectNotificationWebsocket, handleNotificationMessage, sendBidRequest } from './network.js';

// Boot flag used by index.html fallback script.
window.__bhzMainBooted = true;

// Shared lobby status label (we write progress/errors here).
const lobbyMsgEl = document.getElementById('lobby-msg');

// Convert robot IDs from backend into user-facing German labels.
function robotIdToLabel(robotId) {
  switch (robotId) {
    case 'red': return 'Rot';
    case 'blue': return 'Blau';
    case 'green': return 'Gruen';
    case 'yellow': return 'Gelb';
    default: return robotId || 'Ziel';
  }
}

// Map backend board payload into our mutable frontend state.
function applyPlayableBoardPayload(payload) {
  if (!payload || !Array.isArray(payload.board_data) || !payload.board_data.length) {
    throw new Error('Playable board payload is invalid');
  }
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  state.finalBoardData = payload.board_data;

  // Keep robots normalized as numbers/strings to avoid render bugs.
  // Important: if robots are not part of this payload, keep current robot state.
  if (Array.isArray(payload.robots)) {
    state.game.robots = payload.robots.map((robot) => ({
      id: String(robot.id),
      x: Number(robot.x),
      y: Number(robot.y),
    }));
    state.game.activeRobotId = state.game.robots.length ? state.game.robots[0].id : null;
  } else if (hasOwn('robots')) {
    state.game.robots = [];
    state.game.activeRobotId = null;
  }

  // Keep existing chips when this payload does not provide chips.
  if (Array.isArray(payload.chips)) {
    state.game.chips = payload.chips;
  } else if (hasOwn('chips')) {
    state.game.chips = [];
  }

  // Keep full target list (for board visuals) and one active target (for status).
  // If targets are not included, preserve previous target state.
  if (Array.isArray(payload.targets)) {
    state.game.targets = payload.targets.map((target) => ({
      id: target.id,
      robot_id: target.robot_id,
      x: Number(target.x),
      y: Number(target.y),
    }));
  } else if (hasOwn('targets')) {
    state.game.targets = [];
  }

  if (payload.target) {
    state.game.target = {
      color: robotIdToLabel(payload.target.robot_id),
      robotId: payload.target.robot_id,
      x: Number(payload.target.x),
      y: Number(payload.target.y),
    };
    return;
  }

  if (Array.isArray(payload.targets) && payload.targets.length) {
    const fallback = payload.targets[0];
    state.game.target = {
      color: robotIdToLabel(fallback.robot_id),
      robotId: fallback.robot_id,
      x: Number(fallback.x),
      y: Number(fallback.y),
    };
    return;
  }

  if (hasOwn('target') || hasOwn('targets')) {
    state.game.target = null;
  }
}

// Read selected side (A/B) for each quadrant from the form.
function getQuadrantSidesFromForm() {
  const formData = boardConfigForm ? new FormData(boardConfigForm) : null;
  const readSide = (name) => {
    const raw = String(formData?.get(name) || 'A').toUpperCase();
    return raw === 'B' ? 'B' : 'A';
  };
  return {
    block1: readSide('block1_side'),
    block2: readSide('block2_side'),
    block3: readSide('block3_side'),
    block4: readSide('block4_side'),
  };
}

// Fetch + apply board preset; optionally jump to game view.
async function loadPlayablePreset(presetName = 'default', { startRoundAfterLoad = false, quadrantSides = null } = {}) {
  const payload = await fetchPlayableBoardRequest(presetName, quadrantSides || undefined);
  applyPlayableBoardPayload(payload);
  if (startRoundAfterLoad) {
    startRound();
    location.hash = '#game';
  }
}

// Create local player identity via backend.
async function init() {
  try {
    const response = await fetch("/api/players", { method: "POST" });
    const data = await response.json();
    state.playerInfo = new Player(data.player_id, data.player_name, data.moves);
    console.log(`Your Player Id is ${state.playerInfo.player_id} and your Player Name is ${state.playerInfo.player_name}!`);
    renderPlayerName();
  } catch (err) {
    console.error('Failed to init player', err);
  }
}

// Initial app bootstrap.
window.addEventListener('load', init);
window.addEventListener('load', () => {
  if (createGame) {
    createGame.disabled = false;
    createGame.classList.remove('disabled');
  }
  if (lobbyMsgEl && !lobbyMsgEl.textContent.trim()) {
    lobbyMsgEl.textContent = 'Frontend bereit.';
  }
});

function setLobbyMode(mode) {
  if (!lobbyModeSelect || !createFlow || !joinFlow) return;
  if (mode === 'create') {
    lobbyModeSelect.hidden = true;
    createFlow.hidden = false;
    joinFlow.hidden = true;
    return;
  }
  if (mode === 'join') {
    lobbyModeSelect.hidden = true;
    createFlow.hidden = true;
    joinFlow.hidden = false;
    return;
  }
  lobbyModeSelect.hidden = false;
  createFlow.hidden = true;
  joinFlow.hidden = true;
}

setLobbyMode('select');
if (showCreateFlow) {
  showCreateFlow.addEventListener('click', () => {
    setLobbyMode('create');
    if (lobbyMsgEl) lobbyMsgEl.textContent = 'Create setup geöffnet.';
  });
}
if (showJoinFlow) {
  showJoinFlow.addEventListener('click', () => {
    setLobbyMode('join');
    if (lobbyMsgEl) lobbyMsgEl.textContent = 'Join setup geöffnet.';
  });
}

// Defensive: prevent browser default GET submit from this form.
if (boardConfigForm) {
  boardConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
  });
}

// Create game flow:
// 1) make sure player exists
// 2) load board preset from backend
// 3) create game in backend
// 4) render and switch to game view
if (createGame) {
createGame.dataset.bound = 'yes';
createGame.addEventListener('click', async (e) => {
  const lobbyMsg = document.getElementById('lobby-msg');
  createGame.disabled = true;
  try {
    if (lobbyMsg) lobbyMsg.textContent = '1/3 Spieler wird geladen...';
    if (!state.playerInfo || !state.playerInfo.player_id) {
      await init();
    }
    if (!state.playerInfo || !state.playerInfo.player_id) {
      if (lobbyMsg) lobbyMsg.textContent = 'Spieler konnte nicht geladen werden. Bitte Seite neu laden.';
      createGame.disabled = false;
      return;
    }
    if (boardConfigForm) {
      const formData = new FormData(boardConfigForm);
      state.game.timerSeconds = Number(formData.get('timer'));
      state.game.playerName = String(formData.get('playerName') || 'Spieler 1');
      if (state.playerInfo) state.playerInfo.player_name = state.game.playerName;
      renderPlayerName();
    }
    if (lobbyMsg) lobbyMsg.textContent = '2/3 Board wird geladen...';
    const selectedSides = getQuadrantSidesFromForm();
    await loadPlayablePreset('default', { quadrantSides: selectedSides });
    const playablePayloadForGame = {
      board_data: state.finalBoardData,
      robots: state.game.robots,
      chips: state.game.chips,
      targets: state.game.targets,
    };
    if (lobbyMsg) lobbyMsg.textContent = '3/3 Spiel wird erstellt...';
    const data = await createGameRequest(state.playerInfo, state.finalBoardData, playablePayloadForGame);
    state.gameInfo = new GameInfo(
      data.game_id,
      data.player_count,
      data.game_master_id,
      data.player_list,
      data.board,
      data.game_status,
      data.bids,
      data.is_timer_running,
      data.timer_duration
    );
    renderPlayerList(state.gameInfo);
    startRound();
    location.hash = '#game';
    if (state.playerInfo && state.gameInfo && state.playerInfo.player_id === state.gameInfo.game_master_id) {
      createGame.disabled = true;
      createGame.classList.add('disabled');
    }
    if (data && data.game_id) connectNotificationWebsocket(data.game_id);
    if (lobbyMsg) lobbyMsg.textContent = `Spiel erstellt. Spiel-ID: ${data.game_id}`;
  } catch (err) {
    if (lobbyMsg) lobbyMsg.textContent = `Spiel erstellen fehlgeschlagen: ${err.message || err}`;
    console.error(err.message || err);
    createGame.disabled = false;
  }
});
} else {
  console.warn('create-game element not found; click handler not attached');
}

// Join game flow (existing game ID from input field).
if (joinGame) {
joinGame.addEventListener('click', async (e) => {
  const lobbyMsg = document.getElementById('lobby-msg');
  try {
    const enteredGameId = String(joinGameIdInput?.value || '').trim();
    if (!enteredGameId) return console.warn('No game id provided');
    const data = await joinGameRequest(enteredGameId, state.playerInfo);
    if (data && data.game_id) {
      state.gameInfo = new GameInfo(
        data.game_id,
        data.player_count,
        data.game_master_id,
        data.player_list,
        data.board,
        data.game_status,
        data.bids,
        data.is_timer_running,
        data.timer_duration
      );
      renderPlayerList(state.gameInfo);

      // Joiner-side board sync:
      // Use same mapper as create-flow so all available server data is applied consistently.
      // If join response currently only has board_data, mapper keeps existing entity state.
      const boardPayload = data.board?.playable_payload || data.board;
      if (boardPayload && Array.isArray(boardPayload.board_data) && boardPayload.board_data.length) {
        applyPlayableBoardPayload(boardPayload);
        startRound();
        location.hash = '#game';
        if (lobbyMsg) lobbyMsg.textContent = `Beigetreten: ${data.game_id}`;
      } else if (lobbyMsg) {
        lobbyMsg.textContent = 'Spiel beigetreten, aber kein Board im Join-Response gefunden.';
      }
    }
    const gameId = data && data.game_id ? data.game_id : enteredGameId;
    connectNotificationWebsocket(gameId);
  } catch (err) {
    if (lobbyMsg) lobbyMsg.textContent = `Join fehlgeschlagen: ${err.message || err}`;
    console.error(err.message || err);
  }
});
} else {
  console.warn('join-game element not found; click handler not attached');
}

// Submit bid from game view input.
if (makeBet) {
makeBet.addEventListener('click', async (e) => {
    try {
        await sendBidRequest(
            state.gameInfo.game_id, 
            state.playerInfo.player_id, 
            Number(document.querySelector('input[name="move-count"]').value)
        );
        renderBidList(state.gameInfo);
    } catch (err) {
        console.error(err.message || err);
    }

});
} else {
  console.warn('make-bet element not found; click handler not attached');
}

// Board click = select robot if you clicked on one.
document.getElementById('board').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const x = parseInt(cell.dataset.x, 10);
  const y = parseInt(cell.dataset.y, 10);
  const clickedRobot = state.game.robots.find(r => r.x === x && r.y === y);
  if (clickedRobot) {
    state.game.activeRobotId = clickedRobot.id;
    // Trigger repaint through a lightweight custom event.
    const evt = new Event('renderRobots');
    window.dispatchEvent(evt);
  }
});

// Keyboard controls:
// - 1..4 switch active robot
// - arrow keys slide active robot
window.addEventListener('keydown', (e) => {
  if (location.hash !== '#game') return;
  const robotIds = ['red', 'blue', 'green', 'yellow'];
  const keyIndex = parseInt(e.key, 10) - 1;
  if (keyIndex >= 0 && keyIndex < robotIds.length) {
    state.game.activeRobotId = robotIds[keyIndex];
    window.dispatchEvent(new Event('renderRobots'));
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

// Dedicated listener used by mouse/keyboard events.
window.addEventListener('renderRobots', () => {
  import('./ui.js').then(mod => mod.renderRobots()).catch(() => {});
});

// Small UI timer loop that updates every 200ms.
setInterval(() => {
  const label = document.getElementById('timer-label');
  if (!state.roundEndAt || location.hash !== '#game') {
    if (label) label.textContent = '–';
    return;
  }
  const remaining = Math.max(0, state.roundEndAt - Date.now());
  if (label) label.textContent = `${Math.ceil(remaining / 1000)}s`;
}, 200);

// Keep hash-based navigation consistent.
if (!location.hash) location.hash = '#lobby';
function syncViewFromHash() {
  const view = location.hash.replace('#', '') || 'lobby';
  if (view === 'game' && !state.gameInfo) {
    const lobbyMsg = document.getElementById('lobby-msg');
    if (lobbyMsg) lobbyMsg.textContent = 'Bitte zuerst "Spiel erstellen" klicken, damit ein Spielbrett erzeugt wird.';
    location.hash = '#lobby';
    show('lobby');
    return;
  }
  show(view);
}

syncViewFromHash();
window.addEventListener('hashchange', syncViewFromHash);

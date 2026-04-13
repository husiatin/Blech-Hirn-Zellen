import { boardConfigForm, createGame, startGame, joinGame, makeBet, playAgainButton, leaveAfterGameButton, joinGameIdInput, lobbyModeSelect, showCreateFlow, showJoinFlow, createFlow, joinFlow } from './dom.js';
import { state, Player, GameInfo } from './state.js';
import { renderPlayerList, renderPlayerName, startRound, show, renderBidList, updateReplayChoiceButtons, rememberRoundStartRobots, isBoardInteractionLocked } from './ui.js';
import { slide } from './robots.js';
import { createGameRequest, fetchPlayableBoardRequest, joinGameRequest, connectNotificationWebsocket, sendStartGameToBackend, sendBidRequest, sendReplayChoice } from './network.js';

// Shared lobby status label (we write progress/errors here).
const lobbyMsgEl = document.getElementById('lobby-msg');
let initPromise = null;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, options = {}, { attempts = 5, delayMs = 500 } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, options);
      const rawBody = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${rawBody.slice(0, 160)}`);
      }

      try {
        return JSON.parse(rawBody);
      } catch {
        throw new Error(`Expected JSON but received: ${rawBody.slice(0, 160)}`);
      }
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await delay(delayMs);
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed');
}

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

export function updateLobbyActionButtons() {
  const hasGame = Boolean(state.gameInfo && state.gameInfo.game_id);
  const isGameMaster = Boolean(
    hasGame &&
    state.playerInfo &&
    state.playerInfo.player_id === state.gameInfo.game_master_id
  );
  const canStart =
    hasGame &&
    isGameMaster &&
    state.gameInfo.game_status === 0;

  if (createGame) {
    createGame.disabled = hasGame;
    createGame.classList.toggle('disabled', hasGame);
  }

  if (startGame) {
    startGame.disabled = !canStart;
    startGame.classList.toggle('disabled', !canStart);
  }
  if (joinGame) {
    joinGame.disabled = hasGame;
    joinGame.classList.toggle('disabled', hasGame);
  }
  if (joinGameIdInput) {
    joinGameIdInput.disabled = hasGame;
  }
  if (showCreateFlow) {
    showCreateFlow.disabled = hasGame;
    showCreateFlow.classList.toggle('disabled', hasGame);
  }
  if (showJoinFlow) {
    showJoinFlow.disabled = hasGame;
    showJoinFlow.classList.toggle('disabled', hasGame);
  }
}

// Map backend board payload into our mutable frontend state.
function applyPlayableBoardPayload(payload) {
  if (!payload || !Array.isArray(payload.board_data) || !payload.board_data.length) {
    throw new Error('Playable board payload is invalid');
  }
  state.finalBoardData = payload.board_data;

  // Keep robots normalized as numbers/strings to avoid render bugs.
  if (Array.isArray(payload.robots) && payload.robots.length) {
    state.game.robots = payload.robots.map((robot) => ({
      id: String(robot.id),
      x: Number(robot.x),
      y: Number(robot.y),
    }));
    state.game.activeRobotId = state.game.robots[0].id;
  } else {
    state.game.robots = [];
    state.game.activeRobotId = null;
  }

  if (Array.isArray(payload.chips)) {
    state.game.chips = payload.chips;
  }

  // Keep full target list (for board visuals) and one active target (for status).
  if (Array.isArray(payload.targets)) {
    state.game.targets = payload.targets.map((target) => ({
      id: target.id,
      robot_id: target.robot_id,
      x: Number(target.x),
      y: Number(target.y),
    }));
  } else {
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

  state.game.target = null;
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
  if (state.playerInfo?.player_id) {
    return state.playerInfo;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
  try {
    const data = await fetchJsonWithRetry("/api/players", { method: "POST" });
    state.playerInfo = new Player(data.player_id, data.player_name, data.moves);
    console.log(`Your Player Id is ${state.playerInfo.player_id} and your Player Name is ${state.playerInfo.player_name}!`);
    renderPlayerName();
    return state.playerInfo;
  } catch (err) {
    console.error('Failed to init player', err);
    if (lobbyMsgEl) {
      lobbyMsgEl.textContent = `Spieler konnte nicht geladen werden: ${err.message || err}`;
    }
    throw err;
  } finally {
    initPromise = null;
  }
  })();

  return initPromise;
}

// Initial app bootstrap.
window.addEventListener('load', init);
window.addEventListener('load', () => {
  updateLobbyActionButtons();
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
    if (state.gameInfo?.game_id) return;
    setLobbyMode('create');
    if (lobbyMsgEl) lobbyMsgEl.textContent = 'Create setup geöffnet.';
  });
}
if (showJoinFlow) {
  showJoinFlow.addEventListener('click', () => {
    if (state.gameInfo?.game_id) return;
    setLobbyMode('join');
    if (lobbyMsgEl) lobbyMsgEl.textContent = 'Join setup geöffnet.';
  });
}

// Board config form: currently used to start the already created game.
if (boardConfigForm) {
  boardConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    state.game.playerName = String(formData.get('playerName') || 'Spieler 1');
    if (state.playerInfo) state.playerInfo.player_name = state.game.playerName;
    renderPlayerName();
    if (!state.gameInfo) {
      const lobbyMsg = document.getElementById('lobby-msg');
      if (lobbyMsg) lobbyMsg.textContent = 'Bitte zuerst mit "Create game" ein Spielbrett erstellen.';
      return;
    }
    if (!state.playerInfo || state.playerInfo.player_id !== state.gameInfo.game_master_id) {
      const lobbyMsg = document.getElementById('lobby-msg');
      if (lobbyMsg) lobbyMsg.textContent = 'Nur der Spielleiter kann das Spiel starten.';
      return;
    }
    await sendStartGameToBackend();
  });
} else {
  console.warn('board-config-form element not found; submit handler not attached');
}

// Create game flow:
// 1) make sure player exists
// 2) load board preset from backend
// 3) create game in backend
// 4) render and switch to game view
if (createGame) {
  createGame.addEventListener('click', async (e) => {
    const lobbyMsg = document.getElementById('lobby-msg');
    try {
      if (state.gameInfo?.game_id) {
        if (lobbyMsg) lobbyMsg.textContent = 'Du bist bereits in einem Spiel und kannst kein weiteres erstellen.';
        return;
      }
      if (lobbyMsg) lobbyMsg.textContent = 'Erstelle Spiel...';
      if (!state.playerInfo || !state.playerInfo.player_id) {
        await init();
      }
      if (!state.playerInfo || !state.playerInfo.player_id) {
        if (lobbyMsg) lobbyMsg.textContent = 'Spieler konnte nicht geladen werden. Bitte Seite neu laden.';
        return;
      }
      let gameInfo = new GameInfo();
      if (boardConfigForm) {
        const formData = new FormData(boardConfigForm);
        gameInfo.round_timer_duration = Number(formData.get('timer'));
        gameInfo.hourglass_duration = Number(formData.get('hourglass'));
        state.game.playerName = String(formData.get('playerName') || 'Spieler 1');
        if (state.playerInfo) state.playerInfo.player_name = state.game.playerName;
        renderPlayerName();
      }
      const selectedSides = getQuadrantSidesFromForm();
      await loadPlayablePreset('default', { quadrantSides: selectedSides });
      const data = await createGameRequest(state.playerInfo, state.finalBoardData, gameInfo.hourglass_duration, gameInfo.round_timer_duration);
      Object.assign(gameInfo, data);
      state.gameInfo = gameInfo;
      renderPlayerList(state.gameInfo);
      updateLobbyActionButtons();
      if (data && data.game_id) connectNotificationWebsocket(data.game_id);
      if (lobbyMsg) lobbyMsg.textContent = `Spiel erstellt. Spiel-ID: ${data.game_id}. Der Spielleiter kann das Spiel jetzt starten.`;
    } catch (err) {
      if (lobbyMsg) lobbyMsg.textContent = `Create game fehlgeschlagen: ${err.message || err}`;
      console.error(err.message || err);
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
      if (state.gameInfo?.game_id) {
        if (lobbyMsg) lobbyMsg.textContent = 'Du bist bereits in einem Spiel und kannst keinem weiteren beitreten.';
        return;
      }
      const enteredGameId = String(joinGameIdInput?.value || '').trim();
      if (!enteredGameId) {
        if (lobbyMsg) lobbyMsg.textContent = 'Bitte gib eine Spiel-ID ein.';
        return;
      }
      if (!state.playerInfo || !state.playerInfo.player_id) {
        await init();
      }
      const data = await joinGameRequest(enteredGameId, state.playerInfo);
      if (data && data.game_id) {
        state.gameInfo = Object.assign(new GameInfo(), data);
        state.finalBoardData = data.board?.board_data || state.finalBoardData;
        state.game.robots = Array.isArray(data.robots)
          ? data.robots.map((robot) => ({
            id: String(robot.id),
            x: Number(robot.x),
            y: Number(robot.y)
          }))
          : [];
        if (!state.game.robots.some((robot) => robot.id === state.game.activeRobotId)) {
          state.game.activeRobotId = state.game.robots[0]?.id || null;
        }
        state.game.chips = Array.isArray(data.chips) ? data.chips : [];
        state.game.target = data.goal_chip || null;
        rememberRoundStartRobots(Array.isArray(data.original_robots) && data.original_robots.length ? data.original_robots : state.game.robots);
        renderPlayerList(state.gameInfo);
        updateLobbyActionButtons();
        if (data.game_status === 1) {
          startRound();
          show('game');
          location.hash = '#game';
        } else if (lobbyMsgEl) {
          lobbyMsgEl.textContent = `Spiel beigetreten. Warte auf den Spielstart durch den Spielleiter.`;
        }
        connectNotificationWebsocket(data.game_id);
      }
    } catch (err) {
      if (lobbyMsg) lobbyMsg.textContent = err.message || String(err);
      console.error(err.message || err);
    }
  });
} else {
  console.warn('join-game element not found; click handler not attached');
}

if (joinGameIdInput) {
  joinGameIdInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (joinGame && !joinGame.disabled) {
      joinGame.click();
    }
  });
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
  if (isBoardInteractionLocked()) return;
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
  if (isBoardInteractionLocked()) return;
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

if (playAgainButton) {
  playAgainButton.addEventListener('click', () => {
    state.game.endGame.userChoice = 'play_again';
    updateReplayChoiceButtons('play_again');
    sendReplayChoice('play_again');
  });
}

if (leaveAfterGameButton) {
  leaveAfterGameButton.addEventListener('click', () => {
    state.game.endGame.userChoice = 'leave';
    updateReplayChoiceButtons('leave');
    sendReplayChoice('leave');
  });
}

// Dedicated listener used by mouse/keyboard events.
window.addEventListener('renderRobots', () => {
  import('./ui.js').then(mod => mod.renderRobots()).catch(() => { });
});

// Keep hash-based navigation consistent.
if (!location.hash) location.hash = '#lobby';
function syncViewFromHash() {
  const view = location.hash.replace('#', '') || 'lobby';
  if (view === 'game' && !state.gameInfo) {
    const lobbyMsg = document.getElementById('lobby-msg');
    if (lobbyMsg) lobbyMsg.textContent = 'Bitte zuerst "Create game" klicken, damit ein Spielbrett erzeugt wird.';
    location.hash = '#lobby';
    show('lobby');
    return;
  }
  if (view === 'game-over' && !state.game.endGame.standings.length) {
    location.hash = state.gameInfo ? '#game' : '#lobby';
    return;
  }
  show(view);
}

syncViewFromHash();
window.addEventListener('hashchange', syncViewFromHash);

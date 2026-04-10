import { boardConfigForm, createGame, joinGame, makeBet } from './dom.js';
import { state, Player, GameInfo } from './state.js';
import { renderPlayerList, renderPlayerName, startRound, show, renderBidList } from './ui.js';
import { slide } from './robots.js';
import { createGameRequest, fetchPlayableBoardRequest, joinGameRequest, connectNotificationWebsocket, sendStartGameToBackend, handleNotificationMessage, sendBidRequest } from './network.js';

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

// Board config form: currently used to start the already created game.
if (boardConfigForm) {
  boardConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let gameInfo = new GameInfo();
    const formData = new FormData(e.target);
    gameInfo.round_timer_duration = Number(formData.get('timer'));
    gameInfo.hourglass_duration = Number(formData.get('hourglass'));
    state.game.playerName = String(formData.get('playerName') || 'Spieler 1');
    if (state.playerInfo) state.playerInfo.player_name = state.game.playerName;
    renderPlayerName();
    if (!state.gameInfo) {
      const lobbyMsg = document.getElementById('lobby-msg');
      if (lobbyMsg) lobbyMsg.textContent = 'Bitte zuerst mit "Create game" ein Spielbrett erstellen.';
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
      //Object.assign(gameInfo, data);
      gameInfo.game_id = data.game_id;
      gameInfo.player_count = data.player_count;
      gameInfo.game_master_id = data.game_master_id;
      gameInfo.player_list = data.player_list;
      gameInfo.board = data.board;
      gameInfo.game_status = data.game_status;
      gameInfo.bids = data.bids;
      gameInfo.is_hourglass_running = data.is_hourglass_running;
      gameInfo.hourglass_duration = data.hourglass_duration;
      gameInfo.is_round_timer_running = data.is_round_timer_running;
      gameInfo.round_timer_duration = data.round_timer_duration;
      gameInfo.demonstrating_player_id = data.demonstrating_player_id;
      gameInfo.demonstration_moves = data.demonstration_moves;
      gameInfo.original_robots = data.original_robots;
      gameInfo.robots = data.robots;
      gameInfo.chips = data.chips;
      gameInfo.goal_chip = data.goal_chip;
      state.gameInfo = gameInfo;
      renderPlayerList(state.gameInfo);
      location.hash = '#game';
      if (state.playerInfo && state.gameInfo && state.playerInfo.player_id === state.gameInfo.game_master_id) {
        createGame.disabled = true;
        createGame.classList.add('disabled');
      }
      if (data && data.game_id) connectNotificationWebsocket(data.game_id);
      if (lobbyMsg) lobbyMsg.textContent = `Spiel erstellt. Spiel-ID: ${data.game_id}`;
      startRound();
      await sendStartGameToBackend();
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
    try {
      const enteredGameId = document.querySelector('input[name="join-via-game-id"]').value.trim();
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
          data.is_hourglass_running,
          data.hourglass_duration,
          data.is_round_timer_running,
          data.round_timer_duration,
          data.demonstrating_player_id,
          data.demonstration_moves,
          data.original_robots,
          data.robots,
          data.chips,
          data.goal_chip
        );
        renderPlayerList(state.gameInfo);
      }
      const gameId = data && data.game_id ? data.game_id : enteredGameId;
      connectNotificationWebsocket(gameId);
    } catch (err) {
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
  show(view);
}

syncViewFromHash();
window.addEventListener('hashchange', syncViewFromHash);

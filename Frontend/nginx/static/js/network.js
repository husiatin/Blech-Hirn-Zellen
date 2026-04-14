import { state } from './state.js';
import { updateLobbyActionButtons } from './main.js';
import {
  renderPlayerList,
  renderPlayerName,
  startRound,
  renderBidList,
  startHourglassTimer,
  startRoundTimer,
  stopHourglassTimer,
  stopRoundTimer,
  stopEndGameCountdown,
  show,
  renderRobots,
  showGameModal,
  playOptimalSolution,
  rememberRoundStartRobots,
  showSolutionLoading,
  hideSolutionLoading,
  renderEndGameScreen,
  renderEndGameStandings,
  disableBidButton,
  enableBidButton
} from './ui.js';

let ws = null;

function remainingSecondsFromEndsAt(endsAt, fallbackSeconds = 0) {
  const endTimestamp = Number(endsAt);
  if (!Number.isFinite(endTimestamp) || endTimestamp <= 0) {
    return Math.max(0, Number(fallbackSeconds) || 0);
  }
  return Math.max(0, Math.ceil(endTimestamp - (Date.now() / 1000)));
}

function normalizeRobots(robots) {
  return Array.isArray(robots)
    ? robots.map((robot) => ({
      ...robot,
      id: String(robot.id),
      x: Number(robot.x),
      y: Number(robot.y)
    }))
    : [];
}

function resetEndGameState() {
  state.game.endGame = {
    standings: [],
    replayVotes: {},
    replayDurationSeconds: 0,
    userChoice: null
  };
}

function applyGameSnapshot(game) {
  state.gameInfo = game;
  state.finalBoardData = game.board.board_data;
  const snapshotRobots = normalizeRobots(game.robots?.length ? game.robots : game.original_robots);
  if (snapshotRobots.length) {
    state.game.robots = snapshotRobots;
    rememberRoundStartRobots(game.original_robots?.length ? game.original_robots : state.game.robots);
  }
  state.game.chips = Array.isArray(game.chips) ? game.chips : [];
  state.game.target = game.goal_chip || null;
  if (!state.game.robots.some((robot) => robot.id === state.game.activeRobotId)) {
    state.game.activeRobotId = state.game.robots[0]?.id || null;
  }
  updateLobbyActionButtons();
}

function syncActiveTimers(game) {
  stopRoundTimer();
  stopHourglassTimer();

  if (!game || game.game_status !== 1) {
    return;
  }

  if (game.is_hourglass_running) {
    startHourglassTimer(remainingSecondsFromEndsAt(game.hourglass_ends_at, game.hourglass_duration));
    return;
  }

  if (game.is_round_timer_running) {
    startRoundTimer(remainingSecondsFromEndsAt(game.round_timer_ends_at, Number(game.round_timer_duration) * 60));
  }
}

function applyAndRenderGameSnapshot(game, { forceShowGame = false } = {}) {
  if (!game) return;
  applyGameSnapshot(game);
  syncActiveTimers(game);

  renderPlayerName();
  renderPlayerList(state.gameInfo);

  if (game.game_status === 1) {
    startRound();
    if (forceShowGame) {
      show('game');
      location.hash = '#game';
    }
  }
}

async function playRoundSolution(solution) {
  if (Array.isArray(solution) && solution.length) {
    await playOptimalSolution(solution);
  }
}

export function sendSocketMessage(type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  } else {
    console.warn('Cannot send WS message: websocket not open', type);
  }
}

export function sendReplayChoice(choice) {
  state.game.endGame.userChoice = choice;
  sendSocketMessage('replay_choice', { choice });
}

export async function handleNotificationMessage(message) {
  console.log('Received notification:', message);
  switch (message.type) {
    case 'game_state_sync':
      hideSolutionLoading();
      stopEndGameCountdown();
      if (message.payload) {
        applyAndRenderGameSnapshot(message.payload, { forceShowGame: message.payload.game_status === 1 });
      }
      break;
    case 'player_joined':
      if (message.payload && message.payload.player) {
        if (state.gameInfo && state.gameInfo.player_list) {
          state.gameInfo.player_list.push(message.payload.player);
          renderPlayerList(state.gameInfo);
        }
      }
      break;
    case 'player_left':
      if (state.gameInfo?.player_list) {
        state.gameInfo.player_list = state.gameInfo.player_list.filter((player) => player.player_id !== message.payload?.player_id);
        if (message.payload?.game_master_id) {
          state.gameInfo.game_master_id = message.payload.game_master_id;
        }
        state.gameInfo.player_count = state.gameInfo.player_list.length;
        updateLobbyActionButtons();
        renderPlayerList(state.gameInfo);
      }
      break;
    case 'game_started':
      enableBidButton();
      hideSolutionLoading();
      stopEndGameCountdown();
      resetEndGameState();
      if (message.payload) {
        applyAndRenderGameSnapshot(message.payload, { forceShowGame: true });
      }
      break;
    case 'bid_made':
      if (message.payload) {
        const game = message.payload;
        state.gameInfo = game;
        renderBidList(state.gameInfo);
      }
      break;
    case 'hourglass_started':
      if (message.payload) {
        stopRoundTimer();
        startHourglassTimer(remainingSecondsFromEndsAt(message.payload.ends_at, message.payload.duration_seconds));
      }
      break;
    case 'hourglass_ended':
      stopHourglassTimer();
      showSolutionLoading('Der Backend-Server prueft den Rundenausgang und berechnet bei Bedarf die beste Loesung.', 'Bitte warten');
      break;
    case 'demonstration_started':
      disableBidButton();
      hideSolutionLoading();
      state.gameInfo.demonstrating_player_id = message.payload.player_id;
      if (message.payload.robots) {
        state.game.robots = normalizeRobots(message.payload.robots);
        rememberRoundStartRobots(state.game.robots);
        renderRobots();
      }
      window.dispatchEvent(new Event('demonstration_started_event'));
      break;
    case 'robot_moved': {
      const move = message.payload;
      if (state.playerInfo.player_id !== state.gameInfo.demonstrating_player_id) {
        const robot = state.game.robots.find((r) => r.id === move.robot_id || r.color === move.robot_id);
        if (robot) {
          robot.x = Number(move.newX);
          robot.y = Number(move.newY);
          renderRobots();
        }
      }
      break;
    }
    case 'demonstration_success':
      hideSolutionLoading();
      if (message.payload) {
        const payload = message.payload;
        Object.assign(state.gameInfo, payload.game);
        state.game.robots = normalizeRobots(payload.robots);
        state.game.chips = payload.targets;

        let msg = `Demonstration succesful. Chip awarded to ${payload.winner_name}.`;
        if (payload.solution && typeof payload.solution === 'string') {
          msg += `\nBackend calculated solution: ${payload.solution}`;
        } else if (Array.isArray(payload.solution)) {
          msg += `\nFun Fact: The backend found an optimal solution in ${payload.solution.length} moves.`;
        }

        void showGameModal(msg, 'Round Result', 2200);
        await playRoundSolution(payload.solution);
      }
      break;
    case 'demonstration_failed':
      hideSolutionLoading();
      if (message.payload.robots) {
        state.game.robots = normalizeRobots(message.payload.robots);
        rememberRoundStartRobots(state.game.robots);
        renderRobots();
      }

      {
        let failMsg = `Demonstration failed. ${message.payload.message || 'Next player...'}`;
        if (message.payload.solution && typeof message.payload.solution === 'string') {
          failMsg += `\nBackend solution: ${message.payload.solution}`;
        } else if (Array.isArray(message.payload.solution)) {
          failMsg += `\nThe optimal solution actually takes ${message.payload.solution.length} moves.`;
        }

        void showGameModal(failMsg, 'Round Result', 2200);
        await playRoundSolution(message.payload.solution);
      }
      break;
    case 'round_timer_started':
      if (message.payload) {
        startRoundTimer(remainingSecondsFromEndsAt(message.payload.ends_at, message.payload.duration_seconds));
      }
      break;
    case 'round_failed':
      disableBidButton();
      hideSolutionLoading();
      if (message.payload) {
        const game = message.payload;
        applyGameSnapshot(game);
        stopRoundTimer();
        stopHourglassTimer();

        let emptyMsg = 'No bids were made in time.';
        if (game.solution && typeof game.solution === 'string') {
          emptyMsg += `\nBackend solution: ${game.solution}`;
        } else if (Array.isArray(game.solution)) {
          emptyMsg += `\nBy the way, the optimal solution was ${game.solution.length} moves.`;
        }

        void showGameModal(emptyMsg, 'Round Result', 2200);
        await playRoundSolution(game.solution);
      }
      break;
    case 'end_game':
      hideSolutionLoading();
      stopRoundTimer();
      stopHourglassTimer();
      if (message.payload) {
        state.game.endGame.standings = Array.isArray(message.payload.standings) ? message.payload.standings : [];
        state.game.endGame.replayVotes = message.payload.replay_votes || {};
        state.game.endGame.replayDurationSeconds = Number(message.payload.replay_duration_seconds) || 0;
        state.game.endGame.userChoice = null;
        renderEndGameScreen({
          standings: state.game.endGame.standings,
          replayVotes: state.game.endGame.replayVotes,
          replayDurationSeconds: state.game.endGame.replayDurationSeconds,
          winnerNames: Array.isArray(message.payload.winner_names) ? message.payload.winner_names : []
        });
        show('game-over');
        location.hash = '#game-over';
      }
      break;
    case 'replay_vote_updated':
      if (message.payload) {
        state.game.endGame.replayVotes = message.payload.replay_votes || {};
        renderEndGameStandings(state.game.endGame.standings, state.game.endGame.replayVotes);
      }
      break;
    case 'replay_vote_result':
      if (message.payload && state.gameInfo) {
        state.gameInfo.game_master_id = message.payload.game_master_id;
        updateLobbyActionButtons();
      }
      break;
    case 'removed_from_game':
      stopEndGameCountdown();
      resetEndGameState();
      state.gameInfo = null;
      updateLobbyActionButtons();
      show('lobby');
      location.hash = '#lobby';
      break;
    default:
      break;
  }
}

export async function sendStartGameToBackend(original_robots = state.game.robots) {
  try {
    if (!state.gameInfo || !state.gameInfo.game_id || !state.playerInfo || !state.playerInfo.player_id) {
      console.warn('Cannot start game: missing gameInfo or playerInfo');
      return;
    }
    if (state.playerInfo.player_id !== state.gameInfo.game_master_id) {
      console.warn('Only the game master can start the game');
      return;
    }
    const startRobots = Array.isArray(original_robots) && original_robots.length
      ? original_robots
      : state.game.roundStartRobots;
    const response = await fetch(`/api/games/${encodeURIComponent(state.gameInfo.game_id)}/start?player_id=${encodeURIComponent(state.playerInfo.player_id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_robots: startRobots,
        target: state.game.target
      })
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Start game failed', response.status, text);
      return;
    }
  } catch (err) {
    console.error('Start game request failed', err);
  }
}

export function connectNotificationWebsocket(gameId) {
  if (!state.playerInfo || !state.playerInfo.player_id) {
    console.warn('Cannot open websocket: missing playerInfo');
    return;
  }
  if (ws) {
    try { ws.close(); } catch (e) { }
    ws = null;
  }
  const wsProtocol = (location.protocol === 'https:') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${location.host}/api/ws/games/${gameId}/${state.playerInfo.player_id}`;
  ws = new WebSocket(wsUrl);
  ws.addEventListener('open', () => { console.log('WebSocket connection established', wsUrl); });
  ws.addEventListener('message', async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.warn('Received non-JSON websocket message', event.data);
      return;
    }
    try {
      await handleNotificationMessage(message);
    } catch (err) {
      console.error('Error handling websocket message:', err);
    }
  });
  ws.addEventListener('close', () => { console.log('WebSocket closed'); });
  ws.addEventListener('error', (err) => { console.error('WebSocket error', err); });
}

export async function createGameRequest(playerInfo, finalBoardData, hourglassDuration, roundTimerDuration) {
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_info: playerInfo, board_configuration: { board_size: state.BOARD_SIZE, board_data: finalBoardData }, hourglass_duration: hourglassDuration, round_timer_duration: roundTimerDuration, chips: state.game.chips || [] })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create game failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function fetchPlayableBoardRequest(presetName = 'default', quadrantSides = {}) {
  const params = new URLSearchParams();
  if (quadrantSides.block1) params.set('block1_side', String(quadrantSides.block1));
  if (quadrantSides.block2) params.set('block2_side', String(quadrantSides.block2));
  if (quadrantSides.block3) params.set('block3_side', String(quadrantSides.block3));
  if (quadrantSides.block4) params.set('block4_side', String(quadrantSides.block4));
  const query = params.toString();
  const url = `/api/boards/${encodeURIComponent(presetName)}/playable${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Load board failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function joinGameRequest(enteredGameId, playerInfo) {
  const response = await fetch(`/api/games/${enteredGameId}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playerInfo)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Join game failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (data?.Wrong === 'game_id') {
    throw new Error('Kein Spiel mit dieser Spiel-ID gefunden.');
  }
  if (data?.Player === 'Already in Game') {
    throw new Error('Du bist bereits in diesem Spiel.');
  }
  if (!data?.game_id) {
    throw new Error('Spiel konnte nicht beigetreten werden.');
  }
  return data;
}

export async function sendBidRequest(gameId, playerId, bid, robots) {
  const response = await fetch(`/api/games/${gameId}/bids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, number_of_moves: bid, robots: robots })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bid request failed: ${response.status} ${text}`);
  }
}

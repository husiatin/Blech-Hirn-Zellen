import { state } from './state.js';
import {
  renderPlayerList,
  renderPlayerName,
  startRound,
  renderBidList,
  startHourglassTimer,
  startRoundTimer,
  stopHourglassTimer,
  stopRoundTimer,
  show,
  renderRobots
} from './ui.js';

// Single websocket instance for game notifications.
let ws = null;

export function sendSocketMessage(type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  } else {
    console.warn('Cannot send WS message: websocket not open', type);
  }
}

// Handle server events and sync local UI/state.
export function handleNotificationMessage(message) {
  console.log('Received notification:', message);
  switch (message.type) {
    case 'player_joined':
      if (message.payload && message.payload.player) {
        console.log(`Player joined: ${message.payload.player.player_name}`);
        if (state.gameInfo && state.gameInfo.player_list) {
          state.gameInfo.player_list.push(message.payload.player);
          renderPlayerList(state.gameInfo);
        }
      }
      break;
    case 'game_started':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.game_status}`);
        state.gameInfo = game;
        state.finalBoardData = game.board.board_data;
        if (game.goal_chip) {
          state.game.target = game.goal_chip;
        }

        if (game.game_status === 1) {
          renderPlayerName();
          startRound();
          show('game');
          location.hash = '#game';
        }
      }
      break;
    case 'bid_made':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.bid}`);
        // TODO start local timer and show bid info in UI
        state.gameInfo = game;
        startHourglassTimer();
        renderBidList(state.gameInfo);
      }
      break;
    case 'hourglass_started':
      if (message.payload) {
        stopRoundTimer();
        startHourglassTimer(message.payload.duration_seconds);
      }
      break;
    case 'hourglass_ended':
      stopHourglassTimer();
      break;
    case 'demonstration_started':
      console.log('Demonstration started', message.payload);
      state.gameInfo.demonstrating_player_id = message.payload.player_id;
      if (message.payload.robots) {
        state.game.robots = message.payload.robots;
        renderRobots();
      }
      window.dispatchEvent(new Event('demonstration_started_event'));
      break;
    case 'robot_moved':
      const move = message.payload;
      if (state.playerInfo.player_id !== state.gameInfo.demonstrating_player_id) {
        const robot = state.game.robots.find(r => r.id === move.robot_id || r.color === move.robot_id);
        if (robot) {
          robot.x = move.newX;
          robot.y = move.newY;
          renderRobots();
        }
      }
      break;
    case 'demonstration_success':
      if (message.payload) {
        const payload = message.payload;
        console.log('Demonstration success', payload);
        Object.assign(state.gameInfo, payload.game);
        state.game.robots = payload.robots;
        state.game.chips = payload.targets;
        alert(`Demonstration succesful! Chip awarded to ${payload.winner_name}. The game master will start the next round by clicking on okay.`);
        if (state.playerInfo.player_id === state.gameInfo.game_master_id) {
          sendStartGameToBackend();
        }
      }
      break;
    case 'demonstration_failed':
      console.log('Demonstration failed', message.payload);
      if (message.payload.robots) {
        state.game.robots = message.payload.robots;
        renderRobots();
      }
      alert('Demonstration failed! ' + (message.payload.message || 'Next player...'));
      if (state.playerInfo.player_id === state.gameInfo.game_master_id) {
        sendStartGameToBackend();
      }
      break;
    case 'round_timer_started':
      if (message.payload) {
        startRoundTimer(message.payload.duration_seconds);
      }
      break;
    case 'round_failed':
      if (message.payload) {
        const game = message.payload;
        console.log('Round failed', message.payload);
        state.gameInfo = game;
        state.game.robots = game.original_robots;
        stopRoundTimer();
        stopHourglassTimer();
        alert("No bids were made in time! The game master will start the next round by clicking okay.");
        if (state.playerInfo.player_id === state.gameInfo.game_master_id) {
          sendStartGameToBackend();
        }
      }
      break;
    case 'end_game':
      if (message.payload) {
        const winners = message.payload;
        console.log(winners);
        stopRoundTimer();
        stopHourglassTimer();
        // TODO when winners is empty -> show no winners screen
        // TODO when winners contains one player -> show one winner screen
        // TODO when winners containes multiple players -> list players screen
      }
      break;
    default:
      break;
  }
}

// Start game request (only game master should trigger this).
export async function sendStartGameToBackend() {
  try {
    if (!state.gameInfo || !state.gameInfo.game_id || !state.playerInfo || !state.playerInfo.player_id) {
      console.warn('Cannot start game: missing gameInfo or playerInfo');
      return;
    }
    if (state.playerInfo.player_id !== state.gameInfo.game_master_id) {
      console.warn('Only the game master can start the game');
      return;
    }
    const response = await fetch(`/api/games/${encodeURIComponent(state.gameInfo.game_id)}/start?player_id=${encodeURIComponent(state.playerInfo.player_id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        original_robots: state.game.robots,
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

// Open/replace websocket connection for one game ID.
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
  ws.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.warn('Received non-JSON websocket message', event.data);
      return;
    }
    try {
      handleNotificationMessage(message);
    } catch (err) {
      console.error('Error handling websocket message:', err);
    }
  });
  ws.addEventListener('close', () => { console.log('WebSocket closed'); });
  ws.addEventListener('error', (err) => { console.error('WebSocket error', err); });
}

// Create a game using current player and generated board.
export async function createGameRequest(playerInfo, finalBoardData, hourglassDuration, roundTimerDuration) {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_info: playerInfo, board_configuration: { board_size: state.BOARD_SIZE, board_data: finalBoardData }, hourglass_duration: hourglassDuration, round_timer_duration: roundTimerDuration, chips: state.game.chips || [] })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create game failed: ${response.status} ${text}`);
  }
  return response.json();
}

// Load a backend-generated playable board based on selected quadrant sides.
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

// Join an existing game by ID.
export async function joinGameRequest(enteredGameId, playerInfo) {
  const response = await fetch(`/api/games/${enteredGameId}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(playerInfo)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Join game failed: ${response.status} ${text}`);
  }
  return response.json();
}

// Submit a bid (number of moves) for the active game.
export async function sendBidRequest(gameId, playerId, bid, robots) {
  const response = await fetch(`/api/games/${gameId}/bids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_id: playerId, number_of_moves: bid, robots: robots })
  });
  //TODO handle response and errors properly, maybe show some UI feedback
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bid request failed: ${response.status} ${text}`);
  }
}

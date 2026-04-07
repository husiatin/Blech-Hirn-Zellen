import { gameInfo, playerInfo } from './state.js';
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

let ws = null;

export function sendSocketMessage(type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  } else {
    console.warn('Cannot send WS message: websocket not open', type);
  }
}

export function handleNotificationMessage(message) {
  console.log('Received notification:', message);
  switch (message.type) {
    case 'player_joined':
      if (message.payload && message.payload.player) {
        console.log(`Player joined: ${message.payload.player.player_name}`);
        if (gameInfo.player_list) {
          gameInfo.player_list.push(message.payload.player);
          renderPlayerList(gameInfo);
        }
      }
      break;
    case 'game_started':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.game_status}`);
        Object.assign(gameInfo, game);
        if (game.game_status === 1) {
          renderPlayerName();
          startRound();
          show('game');
          location.hash = '#game';
        }
      }
      break;
    case 'round_timer_started':
      if (message.payload) {
        startRoundTimer(message.payload.duration_seconds);
      }
      break;
    case 'bid_made':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.bids}`);
        Object.assign(gameInfo, game);
        renderBidList(gameInfo);
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
    case 'bidding_ended':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.bids}`);
        Object.assign(gameInfo, game);
        hourglassTimer();
        renderBidList(gameInfo);
      }
      break;
    case 'round_failed':
      if (message.payload) {
        const game = message.payload;
        console.log('Round failed', message.payload);
        Object.assign(gameInfo, game);
        stopRoundTimer();
        stopHourglassTimer();
        alert("No bids were made in time! The game master will start the next round by clicking okay.");
        if (playerInfo.player_id === gameInfo.game_master_id) {
          sendStartGameToBackend();
        }
      }
      break;
    case 'demonstration_started':
      console.log('Demonstration started', message.payload);
      gameInfo.demonstrating_player_id = message.payload.player_id;
      if (message.payload.robots) {
        gameInfo.robots = message.payload.robots;
        renderRobots();
      }
      window.dispatchEvent(new Event('demonstration_started_event'));
      break;
    case 'robot_moved':
      const move = message.payload;
      if (playerInfo.player_id !== gameInfo.demonstrating_player_id) {
        const robot = gameInfo.robots.find(r => r.id === move.robot_id || r.color === move.robot_id);
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
        Object.assign(gameInfo, payload.game);
        alert(`Demonstration succesful! Chip awarded to ${payload.winner_name}. The game master will start the next round by clicking on okay.`);
        if (playerInfo.player_id === gameInfo.game_master_id) {
          sendStartGameToBackend();
        }
      }
      break;
    case 'demonstration_failed':
      console.log('Demonstration failed', message.payload);
      if (message.payload.robots) {
        gameInfo.robots = message.payload.robots;
        renderRobots();
      }
      alert('Demonstration failed! ' + (message.payload.message || 'Next player...'));
      if (playerInfo.player_id === gameInfo.game_master_id) {
          sendStartGameToBackend();
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

export async function sendStartGameToBackend() {
  try {
    if (!gameInfo.game_id || !playerInfo || !playerInfo.player_id) {
      console.warn('Cannot start game: missing gameInfo or playerInfo');
      return;
    }
    if (playerInfo.player_id !== gameInfo.game_master_id) {
      console.warn('Only the game master can start the game');
      return;
    }
    const response = await fetch(`http://localhost/api/games/${encodeURIComponent(gameInfo.game_id)}/start`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gameInfo)
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
  if (!playerInfo || !playerInfo.player_id) {
    console.warn('Cannot open websocket: missing playerInfo');
    return;
  }
  if (ws) {
    try { ws.close(); } catch (e) { }
    ws = null;
  }
  const wsProtocol = (location.protocol === 'https:') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${location.host}/api/ws/games/${gameId}/${playerInfo.player_id}`;
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

export async function createGameRequest(playerInfo) {
  const response = await fetch("http://localhost/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(playerInfo)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create game failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function joinGameRequest(enteredGameId, playerInfo) {
  const response = await fetch(`http://localhost/api/games/${enteredGameId}/players`, {
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

export async function sendBidRequest(gameId, playerId, bid) {
  const response = await fetch(`http://localhost/api/games/${gameId}/bids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_id: playerId, number_of_moves: bid })
  });
  //TODO handle response and errors properly, maybe show some UI feedback
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bid request failed: ${response.status} ${text}`);
  }
}

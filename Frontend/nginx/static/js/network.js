import { gameInfo, playerInfo } from './state.js';
import { renderPlayerList, renderPlayerName, startRound, renderBidList, hourglassTimer, show, renderRobots } from './ui.js';

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
    case 'bid_made':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.bids}`);
        // TODO start local timer and show bid info in UI
        Object.assign(gameInfo, game);
        hourglassTimer();
        renderBidList(gameInfo);
      }
      break;
    case 'bidding_ended':
      if (message.payload) {
        const game = message.payload;
        console.log(`Game update: ${game.bids}`);
        // TODO start local timer and show bid info in UI
        Object.assign(gameInfo, game);
        hourglassTimer();
        renderBidList(gameInfo);
      }
      break;
    case 'timer_ended':
      console.log('Timer ended update');
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
      console.log('Demonstration success', message.payload);
      alert('Demonstration succesful! Chip awarded.');
      break;
    case 'demonstration_failed':
      console.log('Demonstration failed', message.payload);
      alert('Demonstration failed! ' + (message.payload.message || 'Next player...'));
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

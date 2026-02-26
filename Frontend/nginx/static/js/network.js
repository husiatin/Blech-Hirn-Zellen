import { state, Player, GameInfo } from './state.js';
import { renderPlayerList, renderPlayerName, startRound, renderBidList } from './ui.js';
import { show } from './ui.js';

let ws = null;

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
        state.roundEndAt = Date.now() + (game.timer_duration || 60) * 1000;
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
        renderBidList(state.gameInfo);
      }
      break;
    default:
      break;
  }
}

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
    const response = await fetch(`http://localhost/api/games/${encodeURIComponent(state.gameInfo.game_id)}/start?game_master_id=${encodeURIComponent(state.playerInfo.player_id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" }
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
    try { ws.close(); } catch (e) {}
    ws = null;
  }
  const wsProtocol = (location.protocol === 'https:') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${location.host}/api/ws/games/${gameId}/${state.playerInfo.player_id}`;
  ws = new WebSocket(wsUrl);
  ws.addEventListener('open', () => { console.log('WebSocket connection established', wsUrl); });
  ws.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      handleNotificationMessage(message);
    } catch (err) {
      console.warn('Received non-JSON websocket message', event.data);
    }
  });
  ws.addEventListener('close', () => { console.log('WebSocket closed'); });
  ws.addEventListener('error', (err) => { console.error('WebSocket error', err); });
}

export async function createGameRequest(playerInfo, finalBoardData) {
  const response = await fetch("http://localhost/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_info: playerInfo, board_configuration: { board_size: state.BOARD_SIZE, board_data: finalBoardData } })
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

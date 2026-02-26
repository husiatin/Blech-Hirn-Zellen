import './quadrantData.js';
import { boardConfigForm, createGame, joinGame, makeBet } from './dom.js';
import { state, Player, GameInfo } from './state.js';
import { assembleBoard } from './board.js';
import { renderPlayerList, renderPlayerName, startRound, show, renderBidList } from './ui.js';
import { slide } from './robots.js';
import { createGameRequest, joinGameRequest, connectNotificationWebsocket, sendStartGameToBackend, handleNotificationMessage, sendBidRequest } from './network.js';

async function init(){
  try {
    const response = await fetch("http://localhost/api/players", { method: "POST" });
    const data = await response.json();
    state.playerInfo = new Player(data.player_id, data.player_name, data.moves);
    console.log(`Your Player Id is ${state.playerInfo.player_id} and your Player Name is ${state.playerInfo.player_name}!`);
    renderPlayerName();
  } catch (err) {
    console.error('Failed to init player', err);
  }
}

window.addEventListener('load', init);

// board config form handling
if (boardConfigForm) {
  boardConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const choices = {
      block1: formData.get('block1_side'), block2: formData.get('block2_side'),
      block3: formData.get('block3_side'), block4: formData.get('block4_side'),
    };
    state.game.timerSeconds = Number(formData.get('timer'));
    state.game.playerName = String(formData.get('playerName') || 'Spieler 1');
    if (state.playerInfo) state.playerInfo.player_name = state.game.playerName;
    renderPlayerName();
    state.finalBoardData = assembleBoard(choices);
    startRound();
    await sendStartGameToBackend();
    location.hash = '#game';
  });
} else {
  console.warn('board-config-form element not found; submit handler not attached');
}

// create game
createGame.addEventListener('click', async (e) => {
  try {
    // Ensure finalBoardData is set based on current form choices if the board is empty
    const isBoardEmpty = state.finalBoardData.every(row => row.every(cell => cell === 0));
    if (isBoardEmpty) {
      const form = document.getElementById('board-config-form');
      const choices = {
        block1: (form && form.querySelector('input[name="block1_side"]:checked') || { value: 'A' }).value,
        block2: (form && form.querySelector('input[name="block2_side"]:checked') || { value: 'A' }).value,
        block3: (form && form.querySelector('input[name="block3_side"]:checked') || { value: 'A' }).value,
        block4: (form && form.querySelector('input[name="block4_side"]:checked') || { value: 'A' }).value,
      };
      state.finalBoardData = assembleBoard(choices);
    }
    const data = await createGameRequest(state.playerInfo, state.finalBoardData);
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
    if (state.playerInfo && state.gameInfo && state.playerInfo.player_id === state.gameInfo.game_master_id) {
      createGame.disabled = true;
      createGame.classList.add('disabled');
    }
    if (data && data.game_id) connectNotificationWebsocket(data.game_id);
  } catch (err) {
    console.error(err.message || err);
  }
});

// join game
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
        data.is_timer_running,
        data.timer_duration
      );
      renderPlayerList(state.gameInfo);
    }
    const gameId = data && data.game_id ? data.game_id : enteredGameId;
    connectNotificationWebsocket(gameId);
  } catch (err) {
    console.error(err.message || err);
  }
});

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

// board click: select robot
document.getElementById('board').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const x = parseInt(cell.dataset.x, 10);
  const y = parseInt(cell.dataset.y, 10);
  const clickedRobot = state.game.robots.find(r => r.x === x && r.y === y);
  if (clickedRobot) {
    state.game.activeRobotId = clickedRobot.id;
    // trigger re-render via setting robot render in UI module
    const evt = new Event('renderRobots');
    window.dispatchEvent(evt);
  }
});

// keyboard controls
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

// listen for UI renderRobots trigger
window.addEventListener('renderRobots', () => {
  import('./ui.js').then(mod => mod.renderRobots()).catch(() => {});
});

// timer update
setInterval(() => {
  const label = document.getElementById('timer-label');
  if (!state.roundEndAt || location.hash !== '#game') {
    if (label) label.textContent = '–';
    return;
  }
  const remaining = Math.max(0, state.roundEndAt - Date.now());
  if (label) label.textContent = `${Math.ceil(remaining / 1000)}s`;
}, 200);

// initial view
if (!location.hash) location.hash = '#lobby';
// show correct view for the current hash and react to changes
show(location.hash.replace('#', '') || 'lobby');
window.addEventListener('hashchange', () => show(location.hash.replace('#', '') || 'lobby'));

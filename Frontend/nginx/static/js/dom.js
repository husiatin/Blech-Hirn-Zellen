// Centralized DOM element references.
// Keeping these in one file avoids repeated querySelector/getElementById calls.
export const lobbyView = document.getElementById('lobby-view');
export const gameView = document.getElementById('game-view');
export const boardEl = document.getElementById('board');
export const timerLabel = document.getElementById('timer-label');
export const targetLabel = document.getElementById('target-label');
export const boardName = document.getElementById('board-name');
export const createGame = document.getElementById('create-game');
export const joinGame = document.getElementById('join-game');
export const joinGameIdInput = document.getElementById('join-game-id-input');
export const lobbyModeSelect = document.getElementById('lobby-mode-select');
export const showCreateFlow = document.getElementById('show-create-flow');
export const showJoinFlow = document.getElementById('show-join-flow');
export const createFlow = document.getElementById('create-flow');
export const joinFlow = document.getElementById('join-flow');
export const playerListContainer = document.getElementById('player-list');
export const playerListUl = document.getElementById('player-list-ul');
export const playerListGameId = document.getElementById('player-list-game-id');
export const playerNameDisplay = document.getElementById('player-name-display');
export const boardConfigForm = document.getElementById('board-config-form');
export const lobby = document.getElementById('lobby-view');
export const game = document.getElementById('game-view');
export const makeBet = document.getElementById('make-bet');
// Guide modal controls (optional UI).
export const guideModal = document.getElementById('guide-modal');
export const guideButton = document.getElementById('guide-btn');
export const guideSpan = document.getElementsByClassName('close')[0];
// Separate label for hourglass countdown in the game status area.
export const hourglassLabel = document.getElementById('hourglass-label');

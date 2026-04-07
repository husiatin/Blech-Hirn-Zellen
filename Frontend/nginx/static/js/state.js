import { BOARD_SIZE } from './constants.js';

// Basic game metadata mirrored from backend responses.
export class GameInfo {
  constructor (game_id, player_count, game_master_id, player_list, board, game_status, bids, is_timer_running, timer_duration) {
    this.game_id = game_id;
    this.player_count = player_count;
    this.game_master_id = game_master_id;
    this.player_list = player_list;
    this.board = board;
    this.game_status = game_status;
    this.bids = bids;
    this.is_timer_running = is_timer_running;
    this.timer_duration = timer_duration;
  }
}

// Local player identity/state.
export class Player {
  constructor(player_id, player_name, moves) {
    this.player_id = player_id;
    this.player_name = player_name;
    this.moves = moves;
  }
}

// Chip model used for target visualization.
export class Chip {
    constructor(color, symbol, x, y) {
        this.color = color;
        this.symbol = symbol;
        this.x = x;
        this.y = y;
    }
}

// Kept as a class to match earlier project style.
export class Color {
    RED = '#d44';
    BLUE = '#44d';
    GREEN = '#4d4';
    YELLOW = '#dd4';
}

// Global mutable state object shared between modules
export const state = {
  BOARD_SIZE,
  game: {
    // Round/UI settings.
    timerSeconds: 60,
    playerName: '',
    // Dynamic entities loaded from backend board preset.
    robots: [],
    activeRobotId: null,
    target: null,
    targets: [],
    chips: [],
  },
  // Board encoded with wall bit masks.
  finalBoardData: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
  // Lobby + identity + timer runtime data.
  gameInfo: null,
  playerInfo: null,
  roundEndAt: null,
};

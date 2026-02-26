import { BOARD_SIZE } from './constants.js';

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

export class Player {
  constructor(player_id, player_name, moves) {
    this.player_id = player_id;
    this.player_name = player_name;
    this.moves = moves;
  }
}

export class Chip {
    constructor(color, symbol, x, y) {
        this.color = color;
        this.symbol = symbol;
        this.x = x;
        this.y = y;
    }
}

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
    timerSeconds: 60,
    playerName: '',
    robots: [
      { id: 'red',    color: Color.RED, x: 1, y: 1 },
      { id: 'blue',   color: Color.BLUE, x: 14, y: 2 },
      { id: 'green',  color: Color.GREEN, x: 6, y: 13 },
      { id: 'yellow', color: Color.YELLOW, x: 13, y: 14 },
    ],
    activeRobotId: 'red',
    target: { color: 'Rot', x: 12, y: 3 },
    chips: [],
  },
  finalBoardData: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
  gameInfo: null,
  playerInfo: null,
  roundEndAt: null,
};

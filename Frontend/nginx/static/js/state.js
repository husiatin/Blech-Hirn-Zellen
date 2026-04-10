import { BOARD_SIZE } from './constants.js';

// Basic game metadata mirrored from backend responses.
export class GameInfo {
  constructor(
    game_id,
    player_count,
    game_master_id,
    player_list,
    board,
    game_status,
    bids,
    is_hourglass_running,
    hourglass_duration,
    is_round_timer_running,
    round_timer_duration,
    demonstrating_player_id,
    demonstration_moves,
    original_robots,
    robots,
    chips,
    goal_chip
  ) {
    this.game_id = game_id;
    this.player_count = player_count;
    this.game_master_id = game_master_id;
    this.player_list = player_list;
    this.board = board;
    this.game_status = game_status;
    this.bids = bids;
    this.is_hourglass_running = is_hourglass_running;
    this.hourglass_duration = hourglass_duration; //in seconds
    this.is_round_timer_running = is_round_timer_running;
    this.round_timer_duration = round_timer_duration; //in Minutes
    this.demonstrating_player_id = demonstrating_player_id;
    this.demonstration_moves = demonstration_moves;
    this.original_robots = original_robots;
    this.robots = robots;
    this.chips = chips;
    this.goal_chip = goal_chip;
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

// Global mutable state object shared between modules
export const state = {
  BOARD_SIZE,
  game: {
    // Round/UI settings.
    timerSeconds: 60,
    playerName: '',
    // Dynamic entities loaded from backend board preset.
    robots: [],
    roundStartRobots: [],
    isSolutionPlaybackActive: false,
    activeRobotId: null,
    target: null,
    targets: [],
    chips: [], //pretty much the same as targets 
  },
  // Board encoded with wall bit masks.
  finalBoardData: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
  // Lobby + identity + timer runtime data.
  gameInfo: null,
  playerInfo: null
};

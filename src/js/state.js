import { WILDCARD_TYPES, AVATAR_COLORS, AVATAR_EMOJIS } from './constants.js';

// ---------- GAME STATE OBJECT ----------
export const state = {
  participants: [],      // {id, name, avatar, active, lives}
  activePool: [],        // ids not yet eliminated
  turnQueue: [],         // fixed player order, based on creation sequence
  currentPlayer: null,

  questionPool: [],      // flattened list of question objects
  usedQuestions: [],
  currentQuestion: null,

  timerInterval: null,
  timeLeft: 90,
  BASE_TIME_LIMIT: 90,
  currentTimeLimit: 90,
  completedRoundCount: 0,
  playersWhoAnsweredThisRound: new Set(),

  gameStartTime: null,
  gameTimerInterval: null,

  stats: { answered: 0, eliminated: 0 },

  pendingBlocks: [],
  activeBlock: null,
  completedBlocks: [],
  railBlockSeq: 1,
  railRoundCounter: 1,

  playerWildcardUsed: {}, // { playerId: { wildcardId: boolean } }
  wildcardShownThisRound: false,
  wildcardCountdownInterval: null
};

// ---------- AVATAR GENERATION ----------
export function generateAvatar(index) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const emoji = AVATAR_EMOJIS[index % AVATAR_EMOJIS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <circle cx="50" cy="50" r="50" fill="${color}"/>
    <text x="50%" y="55%" font-size="50" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// ---------- STATE HELPERS & ACTIONS ----------

export function initPlayerWildcards(playerId) {
  state.playerWildcardUsed[playerId] = {};
  Object.keys(WILDCARD_TYPES).forEach(key => {
    state.playerWildcardUsed[playerId][key] = false;
  });
}

export function hasWildcardAvailable(playerId, wildcardId) {
  return state.playerWildcardUsed[playerId] &&
         state.playerWildcardUsed[playerId][wildcardId] === false;
}

export function markWildcardUsed(playerId, wildcardId) {
  if (state.playerWildcardUsed[playerId]) {
    state.playerWildcardUsed[playerId][wildcardId] = true;
  }
}

export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getNextQuestion() {
  if (state.questionPool.length === 0) {
    return null;
  }
  const q = state.questionPool.pop();
  state.usedQuestions.push(q);
  return q;
}

export function resetQuestionPool() {
  state.questionPool = [...state.usedQuestions, ...state.questionPool];
  shuffleArray(state.questionPool);
  state.usedQuestions = [];
}

export function rebuildTurnQueue() {
  const orderedActiveIds = state.participants
    .filter(player => player.active && state.activePool.includes(player.id))
    .map(player => player.id);

  // getNextPlayer consumes with pop(), so store the fixed order reversed.
  state.turnQueue = orderedActiveIds.reverse();
}

export function getNextPlayer() {
  if (state.turnQueue.length === 0) {
    rebuildTurnQueue();
  }
  const id = state.turnQueue.pop();
  return state.participants.find(p => p.id === id);
}

export function createTurnBlock(player, status = 'pending') {
  return {
    id: `block-${player.id}-${state.railRoundCounter}-${state.railBlockSeq++}`,
    playerId: player.id,
    playerName: player.name,
    avatar: player.avatar,
    livesAtStart: player.lives !== undefined ? player.lives : 3,
    livesAfter: null,
    status,
    answerResult: null,
    round: state.railRoundCounter,
    createdAt: Date.now(),
    completedAt: null
  };
}

export function initializeTurnChain() {
  state.completedBlocks = [];
  state.activeBlock = null;
  state.railBlockSeq = 1;
  state.railRoundCounter = 1;

  const initialQueueIds = state.turnQueue.length ? state.turnQueue.slice().reverse() : state.activePool.slice();
  state.pendingBlocks = initialQueueIds
    .map(id => state.participants.find(p => p.id === id))
    .filter(Boolean)
    .map(player => createTurnBlock(player, 'pending'));
}

export function activateNextBlock() {
  while (state.pendingBlocks.length > 0) {
    const block = state.pendingBlocks.shift();
    const player = state.participants.find(p => p.id === block.playerId);
    if (player && player.active && state.activePool.includes(player.id) && player.lives > 0) {
      block.status = 'active';
      block.livesAtStart = player.lives;
      state.activeBlock = block;
      state.currentPlayer = player;
      return player;
    }
  }

  state.activeBlock = null;
  state.currentPlayer = null;
  return null;
}

export function queueNextPendingBlock(player) {
  if (!player || !player.active || player.lives <= 0) return;
  state.railRoundCounter++;
  state.pendingBlocks.push(createTurnBlock(player, 'pending'));
}

export function completeActiveBlock(isCorrect, player, statusOverride = null) {
  if (!state.activeBlock || !player) return;

  state.activeBlock.status = statusOverride || (isCorrect ? 'completed-correct' : 'completed-wrong');
  state.activeBlock.answerResult = isCorrect ? 'correct' : 'wrong';
  state.activeBlock.livesAfter = player.lives;
  state.activeBlock.completedAt = Date.now();
  state.completedBlocks.unshift({ ...state.activeBlock });
  state.activeBlock = null;
}

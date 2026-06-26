import { 
  state, 
  generateAvatar, 
  initPlayerWildcards, 
  resetQuestionPool, 
  rebuildTurnQueue 
} from './state.js';
import * as ui from './ui.js';
import { 
  startGame, 
  nextRound, 
  openWildcardModal, 
  closeWildcardModal, 
  stopConfetti 
} from './game.js';
import { AVATAR_COLORS } from './constants.js';

// Setup screen local variables
let selectedAvatarIndex = 0;
let nextId = 1;

// Generate all avatar SVGs for setup
function getAvatarList() {
  const list = [];
  for (let i = 0; i < AVATAR_COLORS.length; i++) {
    list.push(generateAvatar(i));
  }
  return list;
}

// ---------- SETUP LOGIC ----------

function initSetupScreen() {
  selectedAvatarIndex = 0;
  
  // Render avatar picker
  ui.buildAvatarPicker(selectedAvatarIndex, getAvatarList(), (index) => {
    selectedAvatarIndex = index;
    ui.buildAvatarPicker(selectedAvatarIndex, getAvatarList(), onAvatarSelect);
  });

  // Render initial empty participants list
  renderSetupParticipants();
}

function onAvatarSelect(index) {
  selectedAvatarIndex = index;
}

function handleAddParticipant() {
  const name = ui.elements.inputName.value.trim();
  if (!name) {
    ui.flashWarning('Please enter a name.');
    return;
  }
  
  const newPlayer = {
    id: nextId++,
    name: name,
    avatar: generateAvatar(selectedAvatarIndex),
    active: true,
    lives: 3
  };

  state.participants.push(newPlayer);
  initPlayerWildcards(newPlayer.id);

  ui.elements.inputName.value = '';
  // cycle to next avatar for variety
  selectedAvatarIndex = (selectedAvatarIndex + 1) % AVATAR_COLORS.length;
  
  ui.buildAvatarPicker(selectedAvatarIndex, getAvatarList(), onAvatarSelect);
  renderSetupParticipants();
}

function handleRemoveParticipant(playerId) {
  state.participants = state.participants.filter(x => x.id !== playerId);
  renderSetupParticipants();
}

function renderSetupParticipants() {
  ui.renderParticipants(state.participants, handleRemoveParticipant);
}

// ---------- EVENT LISTENERS ----------

// Setup Screen events
ui.elements.btnAddParticipant.addEventListener('click', handleAddParticipant);

ui.elements.inputName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAddParticipant();
});

ui.elements.btnStart.addEventListener('click', () => {
  if (state.participants.length < 2) {
    ui.flashWarning('You need at least 2 players to start.');
    return;
  }
  startGame();
});

// Game Screen events
ui.elements.btnContinueGame.addEventListener('click', () => {
  ui.elements.continueBtnContainer.classList.add('hidden');
  nextRound();
});

ui.elements.btnContinueElim.addEventListener('click', () => {
  ui.showScreen('game');
  ui.renderSidebar(state.participants, state.pendingBlocks, state.activeBlock, state.completedBlocks);
  nextRound();
});

ui.elements.btnWildcard.addEventListener('click', openWildcardModal);
ui.elements.btnCloseWildcard.addEventListener('click', closeWildcardModal);

ui.elements.btnResetPool.addEventListener('click', () => {
  resetQuestionPool();
  ui.elements.overlayPoolEmpty.classList.add('hidden');
  nextRound();
});

// Winner Screen events
ui.elements.btnRestart.addEventListener('click', () => {
  stopConfetti();
  
  // reset state for new game
  state.participants.forEach(p => {
    p.active = true;
    p.lives = 3;
    initPlayerWildcards(p.id);
  });
  state.activePool = [];
  state.turnQueue = [];
  state.currentPlayer = null;
  state.currentQuestion = null;
  state.pendingBlocks = [];
  state.activeBlock = null;
  state.completedBlocks = [];
  state.railBlockSeq = 1;
  state.railRoundCounter = 1;
  state.questionPool = [];
  state.usedQuestions = [];
  state.stats = { answered: 0, eliminated: 0 };
  state.currentTimeLimit = state.BASE_TIME_LIMIT;
  state.completedRoundCount = 0;
  state.playersWhoAnsweredThisRound = new Set();

  ui.elements.statAnswered.textContent = '0';
  ui.elements.statEliminated.textContent = '0';
  ui.elements.statTime.textContent = '00:00';
  
  renderSetupParticipants();
  ui.showScreen('setup');
});

// Resize confetti canvas
window.addEventListener('resize', () => {
  const canvas = ui.elements.confettiCanvas;
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// ---------- INITIALIZATION ----------
initSetupScreen();

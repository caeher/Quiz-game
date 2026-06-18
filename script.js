/* ============================================
   THE SOVEREIGNTY CHALLENGE - APP LOGIC
   ============================================ */

// ---------- STATE ----------
let participants = [];      // {id, name, avatar, active}
let activePool = [];        // ids not yet eliminated
let turnQueue = [];         // fixed player order, based on creation sequence
let currentPlayer = null;

let questionPool = [];      // flattened list of question objects
let usedQuestions = [];
let currentQuestion = null;

let timerInterval = null;
let timeLeft = 90;
const TIME_LIMIT = 90;

let gameStartTime = null;
let gameTimerInterval = null;

let stats = { answered: 0, eliminated: 0 };

let pendingBlocks = [];
let activeBlock = null;
let completedBlocks = [];
let railBlockSeq = 1;
let railRoundCounter = 1;

// ---------- WILDCARD SYSTEM ----------
// Easily extensible: add more wildcard types here in the future
const WILDCARD_TYPES = {
  question_context: {
    id: 'question_context',
    label: 'Comodín',
    icon: '🃏',
    description: 'Muestra el texto completo de la pregunta'
  }
  // Future wildcards can be added here:
  // fifty_fifty: { id: 'fifty_fifty', label: '50/50', icon: '✂️', description: 'Elimina dos respuestas incorrectas' },
};

// Per-player wildcard usage state: { playerId: { wildcardId: boolean } }
let playerWildcardUsed = {};

function initPlayerWildcards(playerId) {
  playerWildcardUsed[playerId] = {};
  Object.keys(WILDCARD_TYPES).forEach(key => {
    playerWildcardUsed[playerId][key] = false;
  });
}

function hasWildcardAvailable(playerId, wildcardId) {
  return playerWildcardUsed[playerId] &&
         playerWildcardUsed[playerId][wildcardId] === false;
}

function markWildcardUsed(playerId, wildcardId) {
  if (playerWildcardUsed[playerId]) {
    playerWildcardUsed[playerId][wildcardId] = true;
  }
}

// Track if the current question's wildcard modal was already shown this round
let wildcardShownThisRound = false;

// Generated avatar set (SVG data URIs, bitcoin-themed colors)
const AVATAR_COLORS = ['#F7931A','#2DB7F5','#9B59B6','#2ecc71','#e74c3c','#f1c40f','#1abc9c','#e67e22','#3498db','#fd79a8'];
const AVATAR_EMOJIS = ['🧑','👩','👨','🧔','👱','👩‍🦰','👨‍🦱','🧑‍🦳','👩‍🦳','🧓'];

function generateAvatar(index) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const emoji = AVATAR_EMOJIS[index % AVATAR_EMOJIS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <circle cx="50" cy="50" r="50" fill="${color}"/>
    <text x="50%" y="55%" font-size="50" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// ---------- DOM REFS ----------
const screens = {
  setup: document.getElementById('screen-setup'),
  game: document.getElementById('screen-game'),
  elimination: document.getElementById('screen-elimination'),
  winner: document.getElementById('screen-winner'),
};

const btnContinueGame = document.getElementById('btn-continue-game');
const continueBtnContainer = document.getElementById('continue-btn-container');
const btnContinueElim = document.getElementById('btn-continue-elim');

// Setup Continue button event listeners
btnContinueGame.addEventListener('click', () => {
  continueBtnContainer.classList.add('hidden');
  nextRound();
});

btnContinueElim.addEventListener('click', () => {
  showScreen('game');
  renderSidebar();
  nextRound();
});

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---------- SOUND HELPER ----------
function playSound(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    el.play().catch(() => {}); // ignore if file missing / autoplay blocked
  } catch (e) {}
}

// ============================================
// SETUP SCREEN
// ============================================

const inputName = document.getElementById('input-name');
const avatarPicker = document.getElementById('avatar-picker');
const btnAddParticipant = document.getElementById('btn-add-participant');
const participantsList = document.getElementById('participants-list');
const playerCountBadge = document.getElementById('player-count-badge');
const btnStart = document.getElementById('btn-start');
const setupWarning = document.getElementById('setup-warning');

let selectedAvatarIndex = 0;

// Build avatar picker options
function buildAvatarPicker() {
  avatarPicker.innerHTML = '';
  for (let i = 0; i < AVATAR_COLORS.length; i++) {
    const img = document.createElement('img');
    img.className = 'avatar-option' + (i === selectedAvatarIndex ? ' selected' : '');
    img.src = generateAvatar(i);
    img.dataset.index = i;
    img.addEventListener('click', () => {
      selectedAvatarIndex = i;
      buildAvatarPicker();
    });
    avatarPicker.appendChild(img);
  }
}
buildAvatarPicker();

let nextId = 1;

btnAddParticipant.addEventListener('click', () => {
  const name = inputName.value.trim();
  if (!name) {
    flashWarning('Please enter a name.');
    return;
  }
  participants.push({
    id: nextId++,
    name: name,
    avatar: generateAvatar(selectedAvatarIndex),
    active: true,
    lives: 3
  });
  const newId = participants[participants.length - 1].id;
  initPlayerWildcards(newId);
  inputName.value = '';
  // cycle to next avatar for variety
  selectedAvatarIndex = (selectedAvatarIndex + 1) % AVATAR_COLORS.length;
  buildAvatarPicker();
  renderParticipants();
});

inputName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnAddParticipant.click();
});

function flashWarning(msg) {
  setupWarning.textContent = msg;
  setTimeout(() => { if (setupWarning.textContent === msg) setupWarning.textContent = ''; }, 2500);
}

function renderParticipants() {
  participantsList.innerHTML = '';
  participants.forEach(p => {
    const row = document.createElement('div');
    row.className = 'participant-row';

    const img = document.createElement('img');
    img.src = p.avatar;
    row.appendChild(img);

    const name = document.createElement('div');
    name.className = 'p-name';
    name.textContent = p.name;
    row.appendChild(name);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      participants = participants.filter(x => x.id !== p.id);
      renderParticipants();
    });
    row.appendChild(removeBtn);

    participantsList.appendChild(row);
  });

  playerCountBadge.textContent = participants.length;
  btnStart.disabled = participants.length < 2;
}

renderParticipants(); // initial empty render

btnStart.addEventListener('click', () => {
  if (participants.length < 2) {
    flashWarning('You need at least 2 players to start.');
    return;
  }
  startGame();
});

// ============================================
// QUESTIONS LOADING & POOL MANAGEMENT
// ============================================

async function loadQuestions() {
  try {
    const res = await fetch('questions.json');
    const data = await res.json();
    questionPool = [];

    // Walk through categories -> questions
    Object.values(data).forEach(category => {
      const categoryTitle = category.title || 'General';
      Object.values(category.questions || {}).forEach(q => {
        questionPool.push({
          category: categoryTitle,
          title: q.title,
          text: q.text,
          question: q.question,
          answers: q.answers,
          feedback: q.feedback
        });
      });
    });

    shuffleArray(questionPool);
    usedQuestions = [];
    updateStatPool();
  } catch (err) {
    console.error('Error loading questions.json', err);
    alert('Could not load questions.json. Make sure it exists in the project root.');
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getNextQuestion() {
  if (questionPool.length === 0) {
    showPoolEmptyOverlay();
    return null;
  }
  const q = questionPool.pop();
  usedQuestions.push(q);
  updateStatPool();
  return q;
}

function resetQuestionPool() {
  questionPool = [...usedQuestions, ...questionPool];
  shuffleArray(questionPool);
  usedQuestions = [];
  hidePoolEmptyOverlay();
  updateStatPool();
}

function updateStatPool() {
  document.getElementById('stat-pool').textContent = questionPool.length;
}

// ============================================
// FIXED PLAYER SELECTION (creation order, no repeat within round)
// ============================================

function rebuildTurnQueue() {
  const orderedActiveIds = participants
    .filter(player => player.active && activePool.includes(player.id))
    .map(player => player.id);

  // getNextPlayer consumes with pop(), so store the fixed order reversed.
  turnQueue = orderedActiveIds.reverse();
}

function getNextPlayer() {
  if (turnQueue.length === 0) {
    rebuildTurnQueue();
  }
  const id = turnQueue.pop();
  return participants.find(p => p.id === id);
}

function createTurnBlock(player, status = 'pending') {
  return {
    id: `block-${player.id}-${railRoundCounter}-${railBlockSeq++}`,
    playerId: player.id,
    playerName: player.name,
    avatar: player.avatar,
    livesAtStart: player.lives !== undefined ? player.lives : 3,
    livesAfter: null,
    status,
    answerResult: null,
    round: railRoundCounter,
    createdAt: Date.now(),
    completedAt: null
  };
}

function initializeTurnChain() {
  completedBlocks = [];
  activeBlock = null;
  railBlockSeq = 1;
  railRoundCounter = 1;

  const initialQueueIds = turnQueue.length ? turnQueue.slice().reverse() : activePool.slice();
  pendingBlocks = initialQueueIds
    .map(id => participants.find(p => p.id === id))
    .filter(Boolean)
    .map(player => createTurnBlock(player, 'pending'));
}

function activateNextBlock() {
  while (pendingBlocks.length > 0) {
    const block = pendingBlocks.shift();
    const player = participants.find(p => p.id === block.playerId);
    if (player && player.active && activePool.includes(player.id) && player.lives > 0) {
      block.status = 'active';
      block.livesAtStart = player.lives;
      activeBlock = block;
      currentPlayer = player;
      return player;
    }
  }

  activeBlock = null;
  currentPlayer = null;
  return null;
}

function queueNextPendingBlock(player) {
  if (!player || !player.active || player.lives <= 0) return;
  railRoundCounter++;
  pendingBlocks.push(createTurnBlock(player, 'pending'));
}

function completeActiveBlock(isCorrect, player, statusOverride = null) {
  if (!activeBlock || !player) return;

  activeBlock.status = statusOverride || (isCorrect ? 'completed-correct' : 'completed-wrong');
  activeBlock.answerResult = isCorrect ? 'correct' : 'wrong';
  activeBlock.livesAfter = player.lives;
  activeBlock.completedAt = Date.now();
  completedBlocks.unshift({ ...activeBlock });
  activeBlock = null;
}

// ============================================
// GAME FLOW
// ============================================

function startGame() {
  // initialize active pool with all participants
  activePool = participants.map(p => p.id);
  participants.forEach(p => {
    p.active = true;
    p.lives = 3;
    initPlayerWildcards(p.id); // reset wildcards for each player
  });
  rebuildTurnQueue();
  initializeTurnChain();

  stats = { answered: 0, eliminated: 0 };
  gameStartTime = Date.now();
  startGameTimer();

  loadQuestions().then(() => {
    showScreen('game');
    renderSidebar();
    nextRound();
  });
}

function startGameTimer() {
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  gameTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.getElementById('stat-time').textContent = `${mins}:${secs}`;
  }, 1000);
}

function nextRound() {
  continueBtnContainer.classList.add('hidden');
  // Check win condition
  if (activePool.length === 1) {
    endGame();
    return;
  }
  if (activePool.length === 0) {
    // edge case: shouldn't happen, but guard
    endGame();
    return;
  }

  if (questionPool.length === 0) {
    showPoolEmptyOverlay();
    return;
  }

  if (!activeBlock || activeBlock.status !== 'active') {
    activateNextBlock();
  }
  if (!currentPlayer) {
    endGame();
    return;
  }

  currentQuestion = getNextQuestion();
  if (!currentQuestion) return; // double check guard

  wildcardShownThisRound = false; // reset for new round
  renderSpotlight();
  renderQuestion();
  renderSidebar();
  updateWildcardButton();
  startTimer();
}

function getHeartSVG(isActive, isJustLost = false) {
  const className = `heart-icon ${isActive ? 'active' : 'lost'} ${isJustLost ? 'just-lost' : ''}`;
  return `<svg class="${className}" viewBox="0 0 24 24" width="24" height="24">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>`;
}

function renderLives(player, container, animateJustLost = false) {
  container.innerHTML = '';
  const maxLives = 3;
  const currentLives = player.active ? (player.lives !== undefined ? player.lives : 3) : 0;
  const justLostIndex = animateJustLost ? currentLives : -1;

  for (let i = 0; i < maxLives; i++) {
    const isActive = i < currentLives;
    const isJustLost = i === justLostIndex;
    const heartHtml = getHeartSVG(isActive, isJustLost);
    container.insertAdjacentHTML('beforeend', heartHtml);
  }
}

// ---------- SPOTLIGHT ----------
function renderSpotlight(justLostLife = false) {
  document.getElementById('spotlight-avatar').src = currentPlayer.avatar;
  document.getElementById('spotlight-name').textContent = currentPlayer.name;
  renderLives(currentPlayer, document.getElementById('spotlight-lives'), justLostLife);
}

// ---------- QUESTION RENDERING ----------
const answersGrid = document.getElementById('answers-grid');
const LETTERS = ['A', 'B', 'C', 'D'];

function renderQuestion() {
  document.getElementById('question-category').textContent = currentQuestion.category;
  document.getElementById('question-title').textContent = currentQuestion.question || currentQuestion.title;
  //document.getElementById('question-text').textContent = currentQuestion.text || '';

  // Build shuffled answer order, but keep mapping to original index
  // (original index 0 is always the correct answer per data convention)
  const order = currentQuestion.answers.map((_, i) => i);
  shuffleArray(order);

  answersGrid.innerHTML = '';
  let feedbackEl = document.querySelector('.feedback-text');
  if (feedbackEl) feedbackEl.remove();

  order.forEach((originalIndex, displayIndex) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.dataset.originalIndex = originalIndex;

    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = LETTERS[displayIndex];
    btn.appendChild(letter);

    const text = document.createElement('span');
    text.textContent = currentQuestion.answers[originalIndex];
    btn.appendChild(text);

    btn.addEventListener('click', () => handleAnswer(originalIndex, btn));
    answersGrid.appendChild(btn);
  });

  // progress label
  const total = usedQuestions.length + questionPool.length;
  document.getElementById('progress-label').textContent =
    `Question ${usedQuestions.length} of ${total} — ${activePool.length} players remaining`;
  document.getElementById('progress-bar').style.width =
    total > 0 ? `${(usedQuestions.length / total) * 100}%` : '0%';
}

// ---------- WILDCARD LOGIC ----------

function updateWildcardButton() {
  const btn = document.getElementById('btn-wildcard');
  if (!btn || !currentPlayer) return;

  const available = hasWildcardAvailable(currentPlayer.id, 'question_context') &&
                    !wildcardShownThisRound;

  btn.disabled = !available;
  btn.title = available
    ? 'Usar comodín: ver el texto completo de la pregunta'
    : 'Comodín ya utilizado';
}

function openWildcardModal() {
  if (!currentPlayer || !currentQuestion) return;
  if (!hasWildcardAvailable(currentPlayer.id, 'question_context')) return;
  if (wildcardShownThisRound) return;

  // Mark wildcard as used
  markWildcardUsed(currentPlayer.id, 'question_context');
  wildcardShownThisRound = true;

  // Pause the timer
  clearInterval(timerInterval);

  // Populate modal content
  const questionText = currentQuestion.text || '';
  document.getElementById('wildcard-question-text').textContent = questionText;

  // Show modal
  document.getElementById('overlay-wildcard').classList.remove('hidden');

  // Disable wildcard button immediately
  updateWildcardButton();
}

function closeWildcardModal() {
  document.getElementById('overlay-wildcard').classList.add('hidden');

  // Resume timer from where it left off
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 5 && timeLeft > 0) playSound('snd-tick');
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      onTimeUp();
    }
  }, 1000);
}

// Wildcard button click
document.getElementById('btn-wildcard').addEventListener('click', openWildcardModal);

// Close wildcard modal
document.getElementById('btn-close-wildcard').addEventListener('click', closeWildcardModal);

// ---------- TIMER ----------
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');

function startTimer() {
  clearInterval(timerInterval);
  timeLeft = TIME_LIMIT;
  updateTimerUI();
  enableAnswerButtons(true);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 5 && timeLeft > 0) playSound('snd-tick');
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      onTimeUp();
    }
  }, 1000);
}

function updateTimerUI() {
  const pct = (timeLeft / TIME_LIMIT) * 100;
  timerBar.style.width = pct + '%';
  timerText.textContent = timeLeft;
}

function onTimeUp() {
  enableAnswerButtons(false);
  //playSound('snd-incorrect');

  // Highlight correct answer
  document.querySelectorAll('.answer-btn').forEach(b => {
    if (parseInt(b.dataset.originalIndex) === 0) b.classList.add('correct-flash');
  });

  // Display feedback text
  const fb = document.createElement('div');
  fb.className = 'feedback-text incorrect';
  fb.textContent = '⏰ ¡Tiempo agotado! La respuesta se cuenta como incorrecta.';
  document.querySelector('.question-card').appendChild(fb);

  setTimeout(() => resolveAnswer(false, null), 1400);
}

function enableAnswerButtons(enabled) {
  document.querySelectorAll('.answer-btn').forEach(b => b.disabled = !enabled);
}

// ---------- ANSWER HANDLING ----------
function handleAnswer(originalIndex, btnEl) {
  clearInterval(timerInterval);
  enableAnswerButtons(false);

  const isCorrect = originalIndex === 0; // index 0 is always correct per data convention
  const feedback = currentQuestion.feedback[originalIndex];

  // Visual flash
  btnEl.classList.add(isCorrect ? 'correct-flash' : 'incorrect-flash');

  // Show feedback text
  const fb = document.createElement('div');
  fb.className = 'feedback-text ' + (isCorrect ? 'correct' : 'incorrect');
  fb.textContent = feedback;
  document.querySelector('.question-card').appendChild(fb);

  // If incorrect, play sound immediately and highlight the correct answer
  if (!isCorrect) {
    playSound('snd-incorrect');
    document.querySelectorAll('.answer-btn').forEach(b => {
      if (parseInt(b.dataset.originalIndex) === 0) b.classList.add('correct-flash');
    });
  }

  setTimeout(() => resolveAnswer(isCorrect, originalIndex), 1400);
}

function resolveAnswer(isCorrect, originalIndex) {
  stats.answered++;
  document.getElementById('stat-answered').textContent = stats.answered;

  if (isCorrect) {
    completeActiveBlock(true, currentPlayer);
    queueNextPendingBlock(currentPlayer);
    activateNextBlock();
    renderSidebar();
    playSound('snd-correct');
    continueBtnContainer.classList.remove('hidden');
  } else {
    const answeredPlayer = currentPlayer;
    currentPlayer.lives--;
    
    // Animate the lost life in the spotlight
    renderSpotlight(true);

    if (answeredPlayer.lives <= 0) {
      completeActiveBlock(false, answeredPlayer, 'eliminated');
      activateNextBlock();
      renderSidebar();
      setTimeout(() => {
        eliminatePlayer(answeredPlayer);
      }, 1000); // Allow time for the heart burst animation
    } else {
      completeActiveBlock(false, answeredPlayer);
      queueNextPendingBlock(answeredPlayer);
      activateNextBlock();
      renderSidebar();
      // Show continue button after the heart animation plays
      setTimeout(() => {
        continueBtnContainer.classList.remove('hidden');
      }, 1000);
    }
  }
}

// ---------- ELIMINATION ----------
function eliminatePlayer(player) {
  player.active = false;
  activePool = activePool.filter(id => id !== player.id);
  turnQueue = turnQueue.filter(id => id !== player.id);
  stats.eliminated++;
  document.getElementById('stat-eliminated').textContent = stats.eliminated;

  playSound('snd-elim');

  // Show dramatic elimination screen
  document.getElementById('elim-avatar').src = player.avatar;
  document.getElementById('elim-name').textContent = player.name;
  showScreen('elimination');
}

// ---------- SIDEBAR ----------
function animateRailDisplacement(container, previousRects) {
  if (!previousRects || previousRects.size === 0) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const blocks = Array.from(container.querySelectorAll('.sidebar-player'));
  blocks.forEach(block => {
    if (typeof block.animate !== 'function') return;

    const currentRect = block.getBoundingClientRect();
    const previousRect = previousRects.get(block.dataset.blockId);
    let deltaX = 0;
    let deltaY = 0;

    if (previousRect) {
      deltaX = previousRect.left - currentRect.left;
      deltaY = previousRect.top - currentRect.top;
    } else if (block.classList.contains('block-pending')) {
      return;
    } else if (block.classList.contains('block-completed-correct') ||
               block.classList.contains('block-completed-wrong') ||
               block.classList.contains('block-eliminated')) {
      deltaX = 86;
    }

    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

    const baseLift = block.classList.contains('current') ? -8 : 0;
    block.animate([
      {
        opacity: previousRect ? 1 : 0,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) translateY(${baseLift}px) scale(0.92) rotateZ(${deltaX > 0 ? -1.8 : 1.8}deg)`
      },
      {
        opacity: 1,
        offset: 0.72,
        transform: `translate3d(${-deltaX * 0.04}px, ${-deltaY * 0.04}px, 0) translateY(${baseLift}px) scale(1.035) rotateZ(${deltaX > 0 ? 0.45 : -0.45}deg)`
      },
      {
        opacity: 1,
        transform: `translate3d(0, 0, 0) translateY(${baseLift}px) scale(1) rotateZ(0deg)`
      }
    ], {
      duration: 920,
      easing: 'ease-in-out'
    });
  });
}

function renderSidebar() {
  const activeContainer = document.getElementById('sidebar-active');
  const elimContainer = document.getElementById('sidebar-eliminated');
  const previousRects = new Map(
    Array.from(activeContainer.querySelectorAll('.sidebar-player')).map(block => [
      block.dataset.blockId,
      block.getBoundingClientRect()
    ])
  );

  activeContainer.innerHTML = '';
  elimContainer.innerHTML = '';
  activeContainer.classList.add('rail-chain');

  const blockWidth = window.innerWidth <= 900 ? 184 : 232;
  const blockGap = window.innerWidth <= 900 ? 26 : 36;
  const activeIndex = pendingBlocks.length;
  const centerOffset = -((activeIndex * (blockWidth + blockGap)) + (blockWidth / 2));
  activeContainer.style.setProperty('transform', `translateX(${centerOffset}px)`, 'important');

  // The FIFO head is rendered closest to the active block/divider.
  // The DOM runs left-to-right, so reverse only the visual presentation.
  const orderedPendingBlocks = pendingBlocks.slice().reverse();

  const railBlocks = [
    ...orderedPendingBlocks,
    ...(activeBlock ? [activeBlock] : []),
    ...completedBlocks
  ];

  function renderBlock(block) {
    const player = participants.find(p => p.id === block.playerId);
    const row = document.createElement('div');
    row.className = `sidebar-player block-${block.status}`;
    row.dataset.blockId = block.id;
    row.dataset.playerId = block.playerId;

    if (block.status === 'active') row.classList.add('current');
    if (block.status === 'eliminated') row.classList.add('eliminated-item');

    const img = document.createElement('img');
    img.src = block.avatar;
    img.alt = '';
    row.appendChild(img);

    const infoContainer = document.createElement('div');
    infoContainer.className = 'player-info';

    const name = document.createElement('span');
    name.className = 'player-name-text';
    name.textContent = block.playerName;
    name.title = block.playerName;
    infoContainer.appendChild(name);

    const livesDiv = document.createElement('div');
    livesDiv.className = 'sidebar-lives-container';
    const livesSnapshot = {
      ...(player || {}),
      active: block.status !== 'eliminated',
      lives: block.livesAfter !== null ? block.livesAfter : block.livesAtStart
    };
    renderLives(livesSnapshot, livesDiv, false);
    infoContainer.appendChild(livesDiv);

    row.appendChild(infoContainer);

    const statusIcon = document.createElement('span');
    statusIcon.className = 'rail-status-icon';
    row.appendChild(statusIcon);

    return row;
  }

  railBlocks.forEach(block => {
    activeContainer.appendChild(renderBlock(block));
  });
  animateRailDisplacement(activeContainer, previousRects);

  participants.forEach(p => {
    if (!p.active) {
      const row = document.createElement('div');
      row.className = 'sidebar-player block-eliminated eliminated-item';
      row.classList.add('eliminated-item');
      row.dataset.playerId = p.id;

      const img = document.createElement('img');
      img.src = p.avatar;
      img.alt = '';
      row.appendChild(img);

      const infoContainer = document.createElement('div');
      infoContainer.className = 'player-info';

      const name = document.createElement('span');
      name.className = 'player-name-text';
      name.textContent = p.name;
      name.title = p.name;
      infoContainer.appendChild(name);

      const livesDiv = document.createElement('div');
      livesDiv.className = 'sidebar-lives-container';
      renderLives({ ...p, active: false, lives: 0 }, livesDiv, false);
      infoContainer.appendChild(livesDiv);

      row.appendChild(infoContainer);
      elimContainer.appendChild(row);
    }
  });
}

// ---------- POOL EMPTY OVERLAY ----------
function showPoolEmptyOverlay() {
  document.getElementById('overlay-poolempty').classList.remove('hidden');
}
function hidePoolEmptyOverlay() {
  document.getElementById('overlay-poolempty').classList.add('hidden');
}
document.getElementById('btn-reset-pool').addEventListener('click', () => {
  resetQuestionPool();
  nextRound();
});

// ============================================
// GAME END / WINNER SCREEN
// ============================================

function endGame() {
  clearInterval(timerInterval);
  clearInterval(gameTimerInterval);

  const winner = participants.find(p => p.id === activePool[0]);

  document.getElementById('winner-avatar').src = winner.avatar;
  document.getElementById('winner-name').textContent = winner.name;

  showScreen('winner');
  playSound('snd-winner');
  launchConfetti();
}

document.getElementById('btn-restart').addEventListener('click', () => {
  // reset everything for a new game
  participants.forEach(p => {
    p.active = true;
    p.lives = 3;
    initPlayerWildcards(p.id);
  });
  activePool = [];
  turnQueue = [];
  currentPlayer = null;
  currentQuestion = null;
  pendingBlocks = [];
  activeBlock = null;
  completedBlocks = [];
  railBlockSeq = 1;
  railRoundCounter = 1;
  questionPool = [];
  usedQuestions = [];
  stats = { answered: 0, eliminated: 0 };
  document.getElementById('stat-answered').textContent = '0';
  document.getElementById('stat-eliminated').textContent = '0';
  document.getElementById('stat-time').textContent = '00:00';
  renderParticipants();
  showScreen('setup');
});

// ============================================
// CONFETTI ANIMATION (canvas)
// ============================================

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#F7931A', '#2DB7F5', '#FFFFFF', '#2ecc71', '#e74c3c', '#f1c40f'];
  const pieces = [];
  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 3 + 2,
      speedX: Math.random() * 2 - 1,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5
    });
  }

  let running = true;

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;
      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  draw();

  // stop confetti when leaving winner screen (restart click)
  document.getElementById('btn-restart').addEventListener('click', () => {
    running = false;
  }, { once: true });
}

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

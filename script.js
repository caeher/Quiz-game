/* ============================================
   THE SOVEREIGNTY CHALLENGE - APP LOGIC
   ============================================ */

// ---------- STATE ----------
let participants = [];      // {id, name, avatar, active}
let activePool = [];        // ids not yet eliminated
let turnQueue = [];         // shuffled queue for fair selection
let currentPlayer = null;

let questionPool = [];      // flattened list of question objects
let usedQuestions = [];
let currentQuestion = null;

let timerInterval = null;
let timeLeft = 50;
const TIME_LIMIT = 50;

let gameStartTime = null;
let gameTimerInterval = null;

let stats = { answered: 0, eliminated: 0 };

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
    active: true
  });
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
// FAIR PLAYER SELECTION (no repeat within round)
// ============================================

function rebuildTurnQueue() {
  // shuffled list of currently active player ids
  turnQueue = shuffleArray(activePool.slice());
}

function getNextPlayer() {
  if (turnQueue.length === 0) {
    rebuildTurnQueue();
  }
  const id = turnQueue.pop();
  return participants.find(p => p.id === id);
}

// ============================================
// GAME FLOW
// ============================================

function startGame() {
  // initialize active pool with all participants
  activePool = participants.map(p => p.id);
  participants.forEach(p => p.active = true);
  rebuildTurnQueue();

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

  currentPlayer = getNextPlayer();
  if (!currentPlayer) { rebuildTurnQueue(); currentPlayer = getNextPlayer(); }

  currentQuestion = getNextQuestion();
  if (!currentQuestion) return; // overlay shown, wait for reset

  renderSpotlight();
  renderQuestion();
  renderSidebar();
  startTimer();
}

// ---------- SPOTLIGHT ----------
function renderSpotlight() {
  document.getElementById('spotlight-avatar').src = currentPlayer.avatar;
  document.getElementById('spotlight-name').textContent = currentPlayer.name;
}

// ---------- QUESTION RENDERING ----------
const answersGrid = document.getElementById('answers-grid');
const LETTERS = ['A', 'B', 'C', 'D'];

function renderQuestion() {
  document.getElementById('question-category').textContent = currentQuestion.category;
  document.getElementById('question-title').textContent = currentQuestion.title || currentQuestion.question;
  document.getElementById('question-text').textContent = currentQuestion.text || '';

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
  document.getElementById('overlay-timeup').classList.remove('hidden');
}

document.getElementById('btn-timeup-correct').addEventListener('click', () => {
  document.getElementById('overlay-timeup').classList.add('hidden');
  resolveAnswer(true, null);
});
document.getElementById('btn-timeup-incorrect').addEventListener('click', () => {
  document.getElementById('overlay-timeup').classList.add('hidden');
  resolveAnswer(false, null);
});

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

  // If incorrect, also highlight the correct answer
  if (!isCorrect) {
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
    playSound('snd-correct');
    rebuildTurnQueueRemoveCurrent(false);
    nextRound();
  } else {
    playSound('snd-incorrect');
    eliminatePlayer(currentPlayer);
  }
}

// remove current player's id from the queue (used after a correct answer so they
// aren't picked again until the queue cycles, maintaining "no repeat in round" fairness)
function rebuildTurnQueueRemoveCurrent(eliminate) {
  turnQueue = turnQueue.filter(id => id !== currentPlayer.id);
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

  setTimeout(() => {
    showScreen('game');
    renderSidebar();
    nextRound();
  }, 2600);
}

// ---------- SIDEBAR ----------
function renderSidebar() {
  const activeContainer = document.getElementById('sidebar-active');
  const elimContainer = document.getElementById('sidebar-eliminated');

  activeContainer.innerHTML = '';
  elimContainer.innerHTML = '';

  participants.forEach(p => {
    const row = document.createElement('div');
    row.className = 'sidebar-player';
    if (currentPlayer && p.id === currentPlayer.id && p.active) {
      row.classList.add('current');
    }

    const img = document.createElement('img');
    img.src = p.avatar;
    row.appendChild(img);

    const name = document.createElement('span');
    name.textContent = p.name;
    row.appendChild(name);

    if (p.active) {
      activeContainer.appendChild(row);
    } else {
      row.classList.add('eliminated-item');
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
  // try again to start next round
  currentQuestion = getNextQuestion();
  if (currentQuestion) {
    renderQuestion();
    startTimer();
  }
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
  participants.forEach(p => p.active = true);
  activePool = [];
  turnQueue = [];
  currentPlayer = null;
  currentQuestion = null;
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

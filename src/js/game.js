import { 
  state, 
  initPlayerWildcards, 
  hasWildcardAvailable, 
  markWildcardUsed, 
  shuffleArray, 
  getNextQuestion, 
  resetQuestionPool, 
  rebuildTurnQueue, 
  initializeTurnChain, 
  activateNextBlock, 
  queueNextPendingBlock, 
  completeActiveBlock 
} from './state.js';
import * as ui from './ui.js';
import { playSound } from './audio.js';
import { WILDCARD_MAX_SECONDS } from './constants.js';

// ---------- QUESTIONS LOADING ----------
export async function loadQuestions() {
  try {
    const res = await fetch('questions.json');
    const data = await res.json();
    state.questionPool = [];

    // Walk through categories -> questions
    Object.values(data).forEach(category => {
      const categoryTitle = category.title || 'General';
      Object.values(category.questions || {}).forEach(q => {
        state.questionPool.push({
          category: categoryTitle,
          title: q.title,
          text: q.text,
          question: q.question,
          answers: q.answers,
          feedback: q.feedback
        });
      });
    });

    shuffleArray(state.questionPool);
    state.usedQuestions = [];
    updateStatPool();
  } catch (err) {
    console.error('Error loading questions.json', err);
    alert('Could not load questions.json. Make sure it exists in the project root.');
  }
}

function updateStatPool() {
  ui.elements.statPool.textContent = state.questionPool.length;
}

// ---------- GAME FLOW ----------
export function startGame() {
  // Read time limit from setup screen
  const parsedTime = parseInt(ui.elements.inputTimeLimit ? ui.elements.inputTimeLimit.value : '90', 10);
  state.BASE_TIME_LIMIT = (isNaN(parsedTime) || parsedTime < 10) ? 90 : parsedTime;
  state.currentTimeLimit = state.BASE_TIME_LIMIT;
  state.completedRoundCount = 0;
  state.playersWhoAnsweredThisRound = new Set();

  // initialize active pool with all participants
  state.activePool = state.participants.map(p => p.id);
  state.participants.forEach(p => {
    p.active = true;
    p.lives = 3;
    initPlayerWildcards(p.id); // reset wildcards for each player
  });
  rebuildTurnQueue();
  initializeTurnChain();

  state.stats = { answered: 0, eliminated: 0 };
  state.gameStartTime = Date.now();
  startGameTimer();

  loadQuestions().then(() => {
    ui.showScreen('game');
    ui.renderSidebar(state.participants, state.pendingBlocks, state.activeBlock, state.completedBlocks);
    nextRound();
  });
}

export function startGameTimer() {
  if (state.gameTimerInterval) clearInterval(state.gameTimerInterval);
  state.gameTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    ui.elements.statTime.textContent = `${mins}:${secs}`;
  }, 1000);
}

export function nextRound() {
  ui.elements.continueBtnContainer.classList.add('hidden');
  
  // Check win condition
  if (state.activePool.length === 1) {
    endGame();
    return;
  }
  if (state.activePool.length === 0) {
    endGame();
    return;
  }

  if (state.questionPool.length === 0) {
    ui.elements.overlayPoolEmpty.classList.remove('hidden');
    return;
  }

  if (!state.activeBlock || state.activeBlock.status !== 'active') {
    activateNextBlock();
  }
  if (!state.currentPlayer) {
    endGame();
    return;
  }

  state.currentQuestion = getNextQuestion();
  if (!state.currentQuestion) return; // double check guard

  state.wildcardShownThisRound = false; // reset for new round
  ui.renderSpotlight(state.currentPlayer);
  ui.renderQuestion(
    state.currentQuestion, 
    state.usedQuestions.length, 
    state.usedQuestions.length + state.questionPool.length, 
    state.activePool.length, 
    handleAnswer
  );
  ui.renderSidebar(state.participants, state.pendingBlocks, state.activeBlock, state.completedBlocks);
  updateWildcardButton();
  startTimer();
}

// ---------- TIMER ----------
export function startTimer() {
  clearInterval(state.timerInterval);
  state.timeLeft = state.currentTimeLimit;
  ui.updateTimerUI(state.timeLeft, state.currentTimeLimit);
  ui.enableAnswerButtons(true);

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    ui.updateTimerUI(state.timeLeft, state.currentTimeLimit);
    if (state.timeLeft <= 5 && state.timeLeft > 0) playSound('snd-tick');
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      onTimeUp();
    }
  }, 1000);
}

export function onTimeUp() {
  ui.enableAnswerButtons(false);

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

// ---------- ANSWER HANDLING ----------
export function handleAnswer(originalIndex, btnEl) {
  clearInterval(state.timerInterval);
  ui.enableAnswerButtons(false);

  const isCorrect = originalIndex === 0; // index 0 is always correct
  const feedback = state.currentQuestion.feedback[originalIndex];

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

export function resolveAnswer(isCorrect, originalIndex) {
  state.stats.answered++;
  ui.elements.statAnswered.textContent = state.stats.answered;

  // Track round completion for time reduction
  if (state.currentPlayer) {
    state.playersWhoAnsweredThisRound.add(state.currentPlayer.id);
    const activePlayers = state.activePool.length;
    if (activePlayers > 0 && state.playersWhoAnsweredThisRound.size >= activePlayers) {
      // Everyone has answered: full round complete
      state.completedRoundCount++;
      state.playersWhoAnsweredThisRound = new Set();
      state.currentTimeLimit = Math.max(10, Math.round(state.BASE_TIME_LIMIT * Math.pow(0.85, state.completedRoundCount)));
      ui.showRoundTimerBadge(state.completedRoundCount, state.currentTimeLimit);
    }
  }

  if (isCorrect) {
    completeActiveBlock(true, state.currentPlayer);
    queueNextPendingBlock(state.currentPlayer);
    activateNextBlock();
    ui.renderSidebar(state.participants, state.pendingBlocks, state.activeBlock, state.completedBlocks);
    playSound('snd-correct');
    ui.elements.continueBtnContainer.classList.remove('hidden');
  } else {
    const answeredPlayer = state.currentPlayer;
    state.currentPlayer.lives--;
    
    // Animate the lost life in the spotlight
    ui.renderSpotlight(state.currentPlayer, true);

    if (answeredPlayer.lives <= 0) {
      completeActiveBlock(false, answeredPlayer, 'eliminated');
      activateNextBlock();
      ui.renderSidebar(state.participants, state.pendingBlocks, state.activeBlock, state.completedBlocks);
      setTimeout(() => {
        eliminatePlayer(answeredPlayer);
      }, 1000); // Allow time for the heart burst animation
    } else {
      completeActiveBlock(false, answeredPlayer);
      queueNextPendingBlock(answeredPlayer);
      activateNextBlock();
      ui.renderSidebar(state.participants, state.pendingBlocks, state.activeBlock, state.completedBlocks);
      // Show continue button after the heart animation plays
      setTimeout(() => {
        ui.elements.continueBtnContainer.classList.remove('hidden');
      }, 1000);
    }
  }
}

// ---------- ELIMINATION ----------
export function eliminatePlayer(player) {
  player.active = false;
  state.activePool = state.activePool.filter(id => id !== player.id);
  state.turnQueue = state.turnQueue.filter(id => id !== player.id);
  state.stats.eliminated++;
  ui.elements.statEliminated.textContent = state.stats.eliminated;

  playSound('snd-elim');

  // Show dramatic elimination screen
  ui.elements.elimAvatar.src = player.avatar;
  ui.elements.elimName.textContent = player.name;
  ui.showScreen('elimination');
}

// ---------- WILDCARD LOGIC ----------
export function updateWildcardButton() {
  if (!state.currentPlayer) return;

  const available = hasWildcardAvailable(state.currentPlayer.id, 'question_context') &&
                    !state.wildcardShownThisRound;

  ui.updateWildcardButton(available);
}

export function openWildcardModal() {
  if (!state.currentPlayer || !state.currentQuestion) return;
  if (!hasWildcardAvailable(state.currentPlayer.id, 'question_context')) return;
  if (state.wildcardShownThisRound) return;

  // Mark wildcard as used
  markWildcardUsed(state.currentPlayer.id, 'question_context');
  state.wildcardShownThisRound = true;

  // Pause the main question timer
  clearInterval(state.timerInterval);

  // Populate modal content
  const questionText = state.currentQuestion.text || '';
  ui.elements.wildcardQuestionText.textContent = questionText;

  // Show modal
  ui.elements.overlayWildcard.classList.remove('hidden');

  // Disable wildcard button immediately
  updateWildcardButton();

  // Start wildcard auto-close countdown
  startWildcardCountdown();
}

export function startWildcardCountdown() {
  clearInterval(state.wildcardCountdownInterval);

  let secondsLeft = WILDCARD_MAX_SECONDS;
  const circumference = 2 * Math.PI * 18; // r=18
  const ring = ui.elements.wildcardRingProgress;
  const txt = ui.elements.wildcardCountdownText;

  function updateWildcardCountdownUI() {
    if (!ring || !txt) return;
    const pct = secondsLeft / WILDCARD_MAX_SECONDS;
    ring.style.strokeDashoffset = circumference * (1 - pct);
    txt.textContent = secondsLeft;
    if (secondsLeft > 30) {
      ring.style.stroke = '#2ecc71';
      txt.style.color = '#2ecc71';
    } else if (secondsLeft > 10) {
      ring.style.stroke = '#f1c40f';
      txt.style.color = '#f1c40f';
    } else {
      ring.style.stroke = '#e74c3c';
      txt.style.color = '#e74c3c';
    }
  }

  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = 0;
  }
  updateWildcardCountdownUI();

  state.wildcardCountdownInterval = setInterval(() => {
    secondsLeft--;
    updateWildcardCountdownUI();
    if (secondsLeft <= 0) {
      clearInterval(state.wildcardCountdownInterval);
      closeWildcardModal();
    }
  }, 1000);
}

export function closeWildcardModal() {
  clearInterval(state.wildcardCountdownInterval);
  ui.elements.overlayWildcard.classList.add('hidden');

  // Reset ring visuals for next time
  const circumference = 2 * Math.PI * 18;
  const ring = ui.elements.wildcardRingProgress;
  const txt = ui.elements.wildcardCountdownText;
  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = 0;
    ring.style.stroke = '#2ecc71';
  }
  if (txt) {
    txt.textContent = WILDCARD_MAX_SECONDS;
    txt.style.color = '#2ecc71';
  }

  // Resume question timer from where it left off
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    ui.updateTimerUI(state.timeLeft, state.currentTimeLimit);
    if (state.timeLeft <= 5 && state.timeLeft > 0) playSound('snd-tick');
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      onTimeUp();
    }
  }, 1000);
}

// ---------- GAME END / WINNER SCREEN ----------
export function endGame() {
  clearInterval(state.timerInterval);
  clearInterval(state.gameTimerInterval);

  const winner = state.participants.find(p => p.id === state.activePool[0]);

  ui.elements.winnerAvatar.src = winner.avatar;
  ui.elements.winnerName.textContent = winner.name;

  ui.showScreen('winner');
  playSound('snd-winner');
  launchConfetti();
}

// ---------- CONFETTI ANIMATION ----------
let confettiRunning = false;
export function launchConfetti() {
  const canvas = ui.elements.confettiCanvas;
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

  confettiRunning = true;

  function draw() {
    if (!confettiRunning) return;
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
}

export function stopConfetti() {
  confettiRunning = false;
}

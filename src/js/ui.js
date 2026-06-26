import { LETTERS } from './constants.js';

// ---------- DOM ELEMENTS ----------
export const elements = {
  screens: {
    setup: document.getElementById('screen-setup'),
    game: document.getElementById('screen-game'),
    elimination: document.getElementById('screen-elimination'),
    winner: document.getElementById('screen-winner'),
  },
  btnContinueGame: document.getElementById('btn-continue-game'),
  continueBtnContainer: document.getElementById('continue-btn-container'),
  btnContinueElim: document.getElementById('btn-continue-elim'),
  
  // Setup elements
  inputName: document.getElementById('input-name'),
  avatarPicker: document.getElementById('avatar-picker'),
  btnAddParticipant: document.getElementById('btn-add-participant'),
  participantsList: document.getElementById('participants-list'),
  playerCountBadge: document.getElementById('player-count-badge'),
  btnStart: document.getElementById('btn-start'),
  setupWarning: document.getElementById('setup-warning'),
  inputTimeLimit: document.getElementById('input-time-limit'),

  // Game elements
  sidebarActive: document.getElementById('sidebar-active'),
  sidebarEliminated: document.getElementById('sidebar-eliminated'),
  statAnswered: document.getElementById('stat-answered'),
  statEliminated: document.getElementById('stat-eliminated'),
  statPool: document.getElementById('stat-pool'),
  statTime: document.getElementById('stat-time'),
  spotlightAvatar: document.getElementById('spotlight-avatar'),
  spotlightName: document.getElementById('spotlight-name'),
  spotlightLives: document.getElementById('spotlight-lives'),
  btnWildcard: document.getElementById('btn-wildcard'),
  timerBar: document.getElementById('timer-bar'),
  timerText: document.getElementById('timer-text'),
  questionCategory: document.getElementById('question-category'),
  questionTitle: document.getElementById('question-title'),
  answersGrid: document.getElementById('answers-grid'),
  progressBar: document.getElementById('progress-bar'),
  progressLabel: document.getElementById('progress-label'),

  // Modals & Overlays
  overlayWildcard: document.getElementById('overlay-wildcard'),
  wildcardQuestionText: document.getElementById('wildcard-question-text'),
  wildcardRingProgress: document.getElementById('wildcard-ring-progress'),
  wildcardCountdownText: document.getElementById('wildcard-countdown-text'),
  btnCloseWildcard: document.getElementById('btn-close-wildcard'),
  overlayPoolEmpty: document.getElementById('overlay-poolempty'),
  btnResetPool: document.getElementById('btn-reset-pool'),

  // Elimination elements
  elimAvatar: document.getElementById('elim-avatar'),
  elimName: document.getElementById('elim-name'),

  // Winner elements
  winnerAvatar: document.getElementById('winner-avatar'),
  winnerName: document.getElementById('winner-name'),
  btnRestart: document.getElementById('btn-restart'),
  confettiCanvas: document.getElementById('confetti-canvas'),
};

// ---------- UI HELPERS ----------

export function showScreen(name) {
  Object.keys(elements.screens).forEach(sName => {
    if (sName === name) {
      elements.screens[sName].classList.add('active');
    } else {
      elements.screens[sName].classList.remove('active');
    }
  });
}

export function flashWarning(msg) {
  elements.setupWarning.textContent = msg;
  setTimeout(() => {
    if (elements.setupWarning.textContent === msg) {
      elements.setupWarning.textContent = '';
    }
  }, 2500);
}

// ---------- RENDER FUNCTIONS ----------

export function buildAvatarPicker(selectedAvatarIndex, avatarList, onSelect) {
  elements.avatarPicker.innerHTML = '';
  avatarList.forEach((avatarSrc, i) => {
    const img = document.createElement('img');
    img.className = 'avatar-option' + (i === selectedAvatarIndex ? ' selected' : '');
    img.src = avatarSrc;
    img.dataset.index = i;
    img.addEventListener('click', () => onSelect(i));
    elements.avatarPicker.appendChild(img);
  });
}

export function renderParticipants(participants, onRemove) {
  elements.participantsList.innerHTML = '';
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
    removeBtn.addEventListener('click', () => onRemove(p.id));
    row.appendChild(removeBtn);

    elements.participantsList.appendChild(row);
  });

  elements.playerCountBadge.textContent = participants.length;
  elements.btnStart.disabled = participants.length < 2;
}

export function getHeartSVG(isActive, isJustLost = false) {
  const className = `heart-icon ${isActive ? 'active' : 'lost'} ${isJustLost ? 'just-lost' : ''}`;
  return `<svg class="${className}" viewBox="0 0 24 24" width="24" height="24">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>`;
}

export function renderLives(player, container, animateJustLost = false) {
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

export function renderSpotlight(player, justLostLife = false) {
  elements.spotlightAvatar.src = player.avatar;
  elements.spotlightName.textContent = player.name;
  renderLives(player, elements.spotlightLives, justLostLife);
}

export function renderQuestion(question, usedCount, totalCount, activePlayersCount, onAnswer) {
  elements.questionCategory.textContent = question.category;
  elements.questionTitle.textContent = question.question || question.title;

  // Build shuffled answer order, but keep mapping to original index
  // (original index 0 is always correct)
  const order = question.answers.map((_, i) => i);
  // Shuffle order (in-place)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  elements.answersGrid.innerHTML = '';
  
  const existingFeedback = document.querySelector('.feedback-text');
  if (existingFeedback) existingFeedback.remove();

  order.forEach((originalIndex, displayIndex) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.dataset.originalIndex = originalIndex;

    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = LETTERS[displayIndex];
    btn.appendChild(letter);

    const text = document.createElement('span');
    text.textContent = question.answers[originalIndex];
    btn.appendChild(text);

    btn.addEventListener('click', () => onAnswer(originalIndex, btn));
    elements.answersGrid.appendChild(btn);
  });

  // Progress UI
  elements.progressLabel.textContent =
    `Question ${usedCount} of ${totalCount} — ${activePlayersCount} players remaining`;
  elements.progressBar.style.width =
    totalCount > 0 ? `${(usedCount / totalCount) * 100}%` : '0%';
}

export function updateWildcardButton(available) {
  elements.btnWildcard.disabled = !available;
  elements.btnWildcard.title = available
    ? 'Usar comodín: ver el texto completo de la pregunta'
    : 'Comodín ya utilizado';
}

export function enableAnswerButtons(enabled) {
  document.querySelectorAll('.answer-btn').forEach(b => b.disabled = !enabled);
}

export function updateTimerUI(timeLeft, totalLimit) {
  const pct = (timeLeft / totalLimit) * 100;
  elements.timerBar.style.width = pct + '%';
  elements.timerText.textContent = timeLeft;
}

export function showRoundTimerBadge(roundNum, newTime) {
  let badge = document.getElementById('round-timer-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'round-timer-badge';
    badge.className = 'round-timer-badge';
    document.querySelector('.play-area').appendChild(badge);
  }
  badge.innerHTML = `⏱ Ronda ${roundNum} completada &mdash; nuevo l&iacute;mite: <strong>${newTime}s</strong>`;
  badge.classList.remove('hidden', 'fade-out');
  badge.classList.add('visible');
  clearTimeout(badge._hideTimeout);
  badge._hideTimeout = setTimeout(() => {
    badge.classList.add('fade-out');
    setTimeout(() => badge.classList.add('hidden'), 700);
  }, 3000);
}

export function animateRailDisplacement(container, previousRects) {
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

export function renderSidebar(participants, pendingBlocks, activeBlock, completedBlocks) {
  const activeContainer = elements.sidebarActive;
  const elimContainer = elements.sidebarEliminated;
  
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

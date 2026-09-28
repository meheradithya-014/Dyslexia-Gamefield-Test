/* ================================================================
   Buddy's Word Quest — Dyslexia Game Field Test
   Vanilla JS SPA. No backend — localStorage simulates auth + data.
   ================================================================ */

/* ----------------------------------------------------------------
   0. STORAGE KEYS & SMALL HELPERS
   ---------------------------------------------------------------- */
const LS_USERS       = 'dgft_users';        // { email: {password, name, age} }
const LS_RESULTS     = 'dgft_results';       // { email: { rounds: [...], hasPlayed } }
const LS_SESSION      = 'dgft_session';       // { role:'patient', email }
const VALID_APP_IDS   = ['APP-1234', 'RESEARCH-001']; // demo-only whitelist

const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('Storage read failed for', key, e);
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed for', key, e);
  }
}

/* ----------------------------------------------------------------
   1. IN-MEMORY APP STATE (rehydrated from localStorage on load)
   ---------------------------------------------------------------- */
const state = {
  role: null,            // 'patient' | 'staff'
  currentPatientEmail: null,
  isStaffViewingReport: false,
  // Active game session
  activeGame: null,      // 'jumbled' | 'audio' | 'visual' | 'rhyme' | 'matching'
  activeLevel: null,     // 'Easy' | 'Medium' | 'Hard'
  roundIndex: 0,         // 0-4
  totalRounds: 5,
  sessionHits: 0,
  sessionMisses: 0,
  currentRoundData: null // holds per-round generated content
};

/* ----------------------------------------------------------------
   2. VIEW ROUTING
   ---------------------------------------------------------------- */
function showView(viewId) {
  qsa('.view').forEach(v => v.classList.remove('active'));
  qs('#' + viewId).classList.add('active');
}

/* ----------------------------------------------------------------
   3. MASCOT SPEECH (small delight, not a full feature)
   ---------------------------------------------------------------- */
function mascotSay(text) {
  const bubble = qs('#mascot-speech');
  if (bubble) bubble.textContent = text;
}

/* ----------------------------------------------------------------
   4. AUTH FLOW
   ---------------------------------------------------------------- */
function initAuth() {
  const session = loadJSON(LS_SESSION, null);
  if (session && session.role === 'patient' && session.email) {
    // Returning patient device — bypass login automatically.
    state.role = 'patient';
    state.currentPatientEmail = session.email;
    routeAfterPatientLogin();
  } else {
    showView('view-login');
  }
}

/* -- Role toggle (Patient vs Staff) -- */
qs('#role-patient-btn').addEventListener('click', () => setRoleTab('patient'));
qs('#role-staff-btn').addEventListener('click', () => setRoleTab('staff'));

function setRoleTab(role) {
  qs('#role-patient-btn').classList.toggle('active', role === 'patient');
  qs('#role-staff-btn').classList.toggle('active', role === 'staff');
  qs('#role-patient-btn').setAttribute('aria-selected', role === 'patient');
  qs('#role-staff-btn').setAttribute('aria-selected', role === 'staff');

  qs('#patient-login-form').classList.toggle('hidden', role !== 'patient');
  qs('#staff-appid-form').classList.toggle('hidden', role !== 'staff');
  qs('#staff-patient-login-form').classList.add('hidden'); // always reset step 2
  hideLoginError();
}

function showLoginError(msg) {
  const el = qs('#login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideLoginError() {
  qs('#login-error').classList.add('hidden');
}

/* -- Patient login/sign-up (mocked: first login creates the account) -- */
qs('#patient-login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  hideLoginError();
  const email = qs('#patient-email').value.trim().toLowerCase();
  const password = qs('#patient-password').value;

  const users = loadJSON(LS_USERS, {});
  if (users[email]) {
    if (users[email].password !== password) {
      showLoginError('That password doesn\'t match our records. Try again!');
      return;
    }
  } else {
    // First time we see this email — simulate account creation.
    users[email] = { password, name: '', age: '' };
    saveJSON(LS_USERS, users);
  }

  state.role = 'patient';
  state.currentPatientEmail = email;
  saveJSON(LS_SESSION, { role: 'patient', email }); // auto-bypass next visit
  routeAfterPatientLogin();
});

function routeAfterPatientLogin() {
  const users = loadJSON(LS_USERS, {});
  const profile = users[state.currentPatientEmail];
  if (profile && profile.name && profile.age) {
    enterHub();
  } else {
    showView('view-details');
  }
}

/* -- Staff step 1: verify Application ID -- */
qs('#staff-appid-form').addEventListener('submit', (e) => {
  e.preventDefault();
  hideLoginError();
  const id = qs('#app-id').value.trim().toUpperCase();
  if (VALID_APP_IDS.includes(id)) {
    qs('#staff-appid-form').classList.add('hidden');
    qs('#staff-patient-login-form').classList.remove('hidden');
    mascotSay('Great, that ID checks out! Now log in as the patient you want to review.');
  } else {
    showLoginError('That Application ID was not recognized. Please double-check and try again.');
  }
});

/* -- Staff step 2: patient credentials -> straight to report -- */
qs('#staff-patient-login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  hideLoginError();
  const email = qs('#staff-patient-email').value.trim().toLowerCase();
  const password = qs('#staff-patient-password').value;
  const users = loadJSON(LS_USERS, {});

  if (!users[email] || users[email].password !== password) {
    showLoginError('We couldn\'t find a matching patient account with that email & password.');
    return;
  }

  state.role = 'staff';
  state.isStaffViewingReport = true;
  state.currentPatientEmail = email;
  renderReport();
  showView('view-report');
});

/* ----------------------------------------------------------------
   5. PATIENT DETAILS FORM
   ---------------------------------------------------------------- */
qs('#details-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = qs('#patient-name').value.trim();
  const age = qs('#patient-age').value.trim();

  const users = loadJSON(LS_USERS, {});
  users[state.currentPatientEmail] = {
    ...users[state.currentPatientEmail],
    name, age
  };
  saveJSON(LS_USERS, users);
  enterHub();
});

/* ----------------------------------------------------------------
   6. GAME HUB
   ---------------------------------------------------------------- */
function enterHub() {
  const users = loadJSON(LS_USERS, {});
  const profile = users[state.currentPatientEmail] || {};
  qs('#hub-player-name').textContent = profile.name || 'Friend';
  mascotSay(`Nice to see you, ${profile.name || 'friend'}! Pick a game below.`);
  refreshHubProgress();
  refreshSubmitButton();
  showView('view-hub');
}

function getResultsRecord() {
  const all = loadJSON(LS_RESULTS, {});
  if (!all[state.currentPatientEmail]) {
    all[state.currentPatientEmail] = { rounds: [], hasPlayed: false };
  }
  return all[state.currentPatientEmail];
}
function saveResultsRecord(record) {
  const all = loadJSON(LS_RESULTS, {});
  all[state.currentPatientEmail] = record;
  saveJSON(LS_RESULTS, all);
}

function refreshHubProgress() {
  const record = getResultsRecord();
  const gameKeys = ['jumbled', 'audio', 'visual', 'rhyme', 'matching'];
  gameKeys.forEach(key => {
    const el = qs(`[data-progress-for="${key}"]`);
    const playedLevels = [...new Set(
      record.rounds.filter(r => r.game === key).map(r => r.level)
    )];
    el.textContent = playedLevels.length
      ? `✓ Played: ${playedLevels.join(', ')}`
      : '';
  });
}

function refreshSubmitButton() {
  const record = getResultsRecord();
  qs('#submit-report-btn').disabled = !record.hasPlayed;
}

/* -- Logout -- */
function logout() {
  localStorage.removeItem(LS_SESSION);
  state.role = null;
  state.currentPatientEmail = null;
  state.isStaffViewingReport = false;
  qs('#patient-login-form').reset();
  qs('#staff-appid-form').reset();
  qs('#staff-patient-login-form').reset();
  setRoleTab('patient');
  showView('view-login');
}
qs('#logout-btn').addEventListener('click', logout);
qs('#report-logout-btn').addEventListener('click', logout);
qs('#new-login-btn').addEventListener('click', logout);

/* -- Game card click -> open difficulty modal -- */
qsa('.game-card').forEach(card => {
  card.addEventListener('click', () => openDifficultyModal(card.dataset.game, card.querySelector('.game-title').textContent));
});

const GAME_LABELS = {
  jumbled: 'Jumbled Word',
  audio: 'Audio Word',
  visual: 'Visual Image',
  rhyme: 'Rhyme Word',
  matching: 'Matching Word'
};

function openDifficultyModal(gameKey, label) {
  state.activeGame = gameKey;
  qs('#modal-game-title').textContent = `${label} — choose a level`;
  qs('#difficulty-modal').classList.remove('hidden');
}
qs('.modal-close').addEventListener('click', () => qs('#difficulty-modal').classList.add('hidden'));

qsa('.level-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeLevel = btn.dataset.level;
    qs('#difficulty-modal').classList.add('hidden');
    startLevel();
  });
});

/* -- Submit -> Report -- */
qs('#submit-report-btn').addEventListener('click', () => {
  renderReport();
  showView('view-report');
});
qs('#play-more-btn').addEventListener('click', () => showView('view-hub'));

/* -- Exit game mid-play -- */
qs('#game-exit-btn').addEventListener('click', () => {
  refreshHubProgress();
  refreshSubmitButton();
  showView('view-hub');
});
qs('#back-to-hub-btn').addEventListener('click', () => {
  qs('#level-complete').classList.add('hidden');
  refreshHubProgress();
  refreshSubmitButton();
  showView('view-hub');
});

/* ----------------------------------------------------------------
   7. WORD / DATA BANKS
   ---------------------------------------------------------------- */
// Each entry: word + a representative emoji "image" + rhyme partner.
const WORD_BANK = {
  Easy: [
    { word: 'cat',  emoji: '🐱', rhyme: 'hat',  rhymeEmoji: '🎩' },
    { word: 'dog',  emoji: '🐶', rhyme: 'log',  rhymeEmoji: '🪵' },
    { word: 'sun',  emoji: '☀️', rhyme: 'bun',  rhymeEmoji: '🥐' },
    { word: 'ball', emoji: '⚽', rhyme: 'wall', rhymeEmoji: '🧱' },
    { word: 'fish', emoji: '🐟', rhyme: 'dish', rhymeEmoji: '🍽️' },
    { word: 'star', emoji: '⭐', rhyme: 'car',  rhymeEmoji: '🚗' },
  ],
  Medium: [
    { word: 'apple',  emoji: '🍎', rhyme: 'grapple', rhymeEmoji: '🤼' },
    { word: 'banana', emoji: '🍌', rhyme: 'cabana',  rhymeEmoji: '🏖️' },
    { word: 'rabbit', emoji: '🐰', rhyme: 'habit',   rhymeEmoji: '🔁' },
    { word: 'castle', emoji: '🏰', rhyme: 'tassel',  rhymeEmoji: '🎓' },
    { word: 'pencil', emoji: '✏️', rhyme: 'stencil', rhymeEmoji: '🖍️' },
    { word: 'turtle', emoji: '🐢', rhyme: 'hurdle',  rhymeEmoji: '🏃' },
  ],
  Hard: [
    { word: 'elephant',   emoji: '🐘', rhyme: 'relevant', rhymeEmoji: '📌' },
    { word: 'umbrella',   emoji: '☂️', rhyme: 'cinderella', rhymeEmoji: '👠' },
    { word: 'dinosaur',   emoji: '🦕', rhyme: 'indoor',   rhymeEmoji: '🏠' },
    { word: 'butterfly',  emoji: '🦋', rhyme: 'firefly',  rhymeEmoji: '✨' },
    { word: 'helicopter', emoji: '🚁', rhyme: 'proper',   rhymeEmoji: '🎩' },
    { word: 'octopus',    emoji: '🐙', rhyme: 'campus',   rhymeEmoji: '🏫' },
  ]
};

const DISTRACTOR_POOL = [
  { word: 'kite',  emoji: '🪁' }, { word: 'moon',  emoji: '🌙' },
  { word: 'tree',  emoji: '🌳' }, { word: 'shoe',  emoji: '👟' },
  { word: 'cloud', emoji: '☁️' }, { word: 'book',  emoji: '📖' },
  { word: 'lamp',  emoji: '💡' }, { word: 'cup',   emoji: '☕' },
  { word: 'flower',emoji: '🌸' }, { word: 'boat',  emoji: '⛵' },
];

/* ----------------------------------------------------------------
   8. GENERIC HELPERS
   ---------------------------------------------------------------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickRandom(arr, n) { return shuffle(arr).slice(0, n); }

function scrambleWord(word) {
  let letters = word.split('');
  let attempt = word;
  let tries = 0;
  while (attempt.toLowerCase() === word.toLowerCase() && tries < 10) {
    attempt = shuffle(letters).join('');
    tries++;
  }
  return attempt;
}

/* ----------------------------------------------------------------
   9. LEVEL / ROUND CONTROLLER
   ---------------------------------------------------------------- */
function startLevel() {
  state.roundIndex = 0;
  state.sessionHits = 0;
  state.sessionMisses = 0;
  qs('#game-play-title').textContent = `${GAME_LABELS[state.activeGame]} — ${state.activeLevel}`;
  updateScoreStrip();
  showView('view-game');
  loadRound();
}

function updateScoreStrip() {
  qs('#live-hits').textContent = state.sessionHits;
  qs('#live-misses').textContent = state.sessionMisses;
  qs('#round-num').textContent = state.roundIndex + 1;
}

function loadRound() {
  qs('#round-feedback').classList.add('hidden');
  updateScoreStrip();
  const stage = qs('#game-stage');
  stage.innerHTML = '';

  switch (state.activeGame) {
    case 'jumbled':  renderJumbledRound(stage); break;
    case 'audio':    renderAudioRound(stage); break;
    case 'visual':   renderVisualRound(stage); break;
    case 'rhyme':    renderRhymeRound(stage); break;
    case 'matching': renderMatchingRound(stage); break;
  }
}

// Called by each game once the round has been answered.
function recordRoundResult(correct) {
  if (correct) state.sessionHits++; else state.sessionMisses++;

  const record = getResultsRecord();
  record.rounds.push({
    game: state.activeGame,
    level: state.activeLevel,
    round: state.roundIndex + 1,
    correct,
    timestamp: Date.now()
  });
  record.hasPlayed = true;
  saveResultsRecord(record);

  showRoundFeedback(correct);

  // Auto-advance after a short pause so the player sees the feedback.
  setTimeout(() => {
    state.roundIndex++;
    if (state.roundIndex >= state.totalRounds) {
      finishLevel();
    } else {
      loadRound();
    }
  }, 900);
}

function showRoundFeedback(correct) {
  const el = qs('#round-feedback');
  el.classList.remove('hidden', 'correct', 'wrong');
  el.classList.add(correct ? 'correct' : 'wrong');
  el.textContent = correct ? '✅ Nice job! That\'s correct!' : '❌ Not quite — let\'s try the next one!';
  updateScoreStrip();
}

function finishLevel() {
  qs('#level-summary').textContent =
    `You got ${state.sessionHits} out of ${state.totalRounds} correct in ${state.activeLevel} mode. Keep it up!`;
  qs('#level-complete').classList.remove('hidden');
}

/* ----------------------------------------------------------------
   10. GAME 1 — JUMBLED WORD
   ---------------------------------------------------------------- */
function renderJumbledRound(stage) {
  const bank = WORD_BANK[state.activeLevel];
  const target = pickRandom(bank, 1)[0];
  const distractors = pickRandom(
    DISTRACTOR_POOL.filter(d => d.word !== target.word), 3
  );
  const options = shuffle([target.word, ...distractors.map(d => d.word)]);

  stage.innerHTML = `
    <p class="prompt-label">Unscramble the letters:</p>
    <div class="prompt-word">${scrambleWord(target.word).toUpperCase()}</div>
    <div class="options-grid" id="jumbled-options"></div>
  `;
  const grid = qs('#jumbled-options', stage);
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      qsa('.option-btn', grid).forEach(b => b.disabled = true);
      const correct = opt === target.word;
      btn.classList.add(correct ? 'correct' : 'wrong');
      recordRoundResult(correct);
    });
    grid.appendChild(btn);
  });
}

/* ----------------------------------------------------------------
   11. GAME 2 — AUDIO WORD
   ---------------------------------------------------------------- */
function renderAudioRound(stage) {
  const bank = WORD_BANK[state.activeLevel];
  const target = pickRandom(bank, 1)[0];

  stage.innerHTML = `
    <p class="prompt-label">Listen carefully, then type what you hear:</p>
    <div class="audio-controls">
      <button type="button" class="play-audio-btn" id="play-audio-btn">🔊 Play Audio</button>
      <div class="audio-input-row">
        <input type="text" id="audio-answer-input" placeholder="Type the word..." autocomplete="off">
        <button type="button" class="mic-btn" id="mic-sim-btn" title="Simulate microphone">🎤</button>
      </div>
      <button type="button" class="btn btn-primary btn-lg" id="audio-submit-btn">Check Answer</button>
    </div>
  `;

  const speak = () => {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(target.word);
      utter.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  };
  qs('#play-audio-btn', stage).addEventListener('click', speak);
  speak(); // auto-play once when the round loads

  // Mic-simulation: since there's no real speech-to-text backend yet,
  // this simulates a spoken response by pre-filling the recognized text.
  qs('#mic-sim-btn', stage).addEventListener('click', () => {
    qs('#audio-answer-input', stage).value = target.word;
    qs('#audio-answer-input', stage).focus();
  });

  const submit = () => {
    const val = qs('#audio-answer-input', stage).value.trim().toLowerCase();
    const correct = val === target.word.toLowerCase();
    qs('#audio-submit-btn', stage).disabled = true;
    qs('#audio-answer-input', stage).disabled = true;
    recordRoundResult(correct);
  };
  qs('#audio-submit-btn', stage).addEventListener('click', submit);
  qs('#audio-answer-input', stage).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

/* ----------------------------------------------------------------
   12. GAME 3 — VISUAL IMAGE
   ---------------------------------------------------------------- */
function renderVisualRound(stage) {
  const bank = WORD_BANK[state.activeLevel];
  const target = pickRandom(bank, 1)[0];
  const distractorCount = 4; // total 5 options
  const distractors = pickRandom(
    DISTRACTOR_POOL.filter(d => d.word !== target.word), distractorCount
  );
  const options = shuffle([target, ...distractors]);

  stage.innerHTML = `
    <p class="prompt-label">Find the picture for: <strong>${target.word}</strong></p>
    <div class="options-grid" id="visual-options"></div>
  `;
  const grid = qs('#visual-options', stage);
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="emoji">${opt.emoji}</span>${opt.word}`;
    btn.addEventListener('click', () => {
      qsa('.option-btn', grid).forEach(b => b.disabled = true);
      const correct = opt.word === target.word;
      btn.classList.add(correct ? 'correct' : 'wrong');
      recordRoundResult(correct);
    });
    grid.appendChild(btn);
  });
}

/* ----------------------------------------------------------------
   13. GAME 4 — RHYME WORD
   ---------------------------------------------------------------- */
function renderRhymeRound(stage) {
  const bank = WORD_BANK[state.activeLevel];
  const target = pickRandom(bank, 1)[0];
  const distractors = pickRandom(
    DISTRACTOR_POOL.filter(d => d.word !== target.rhyme), 3
  );
  const options = shuffle([
    { word: target.rhyme, emoji: target.rhymeEmoji },
    ...distractors
  ]);

  stage.innerHTML = `
    <p class="prompt-label">Which picture <strong>rhymes</strong> with:</p>
    <div class="prompt-word">${target.word.toUpperCase()}</div>
    <div class="options-grid" id="rhyme-options"></div>
  `;
  const grid = qs('#rhyme-options', stage);
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="emoji">${opt.emoji}</span>${opt.word}`;
    btn.addEventListener('click', () => {
      qsa('.option-btn', grid).forEach(b => b.disabled = true);
      const correct = opt.word === target.rhyme;
      btn.classList.add(correct ? 'correct' : 'wrong');
      recordRoundResult(correct);
    });
    grid.appendChild(btn);
  });
}

/* ----------------------------------------------------------------
   14. GAME 5 — MATCHING WORD (5x2 grid, click word then image)
   ---------------------------------------------------------------- */
function renderMatchingRound(stage) {
  const bank = WORD_BANK[state.activeLevel];
  const pairs = pickRandom(bank, 5);
  const words = pairs; // column 1 order
  const images = shuffle(pairs); // column 2, jumbled order

  stage.innerHTML = `
    <p class="prompt-label">Tap a word, then tap its matching picture:</p>
    <div class="matching-grid" id="matching-grid"></div>
  `;
  const grid = qs('#matching-grid', stage);

  let selectedWordBtn = null;
  let matchedCount = 0;
  let roundHadError = false;

  words.forEach(pair => {
    const wBtn = document.createElement('button');
    wBtn.className = 'match-word-btn';
    wBtn.textContent = pair.word;
    wBtn.dataset.word = pair.word;
    wBtn.addEventListener('click', () => {
      if (wBtn.classList.contains('matched')) return;
      qsa('.match-word-btn', grid).forEach(b => b.classList.remove('selected'));
      wBtn.classList.add('selected');
      selectedWordBtn = wBtn;
    });
    grid.appendChild(wBtn);
  });

  images.forEach(pair => {
    const iBtn = document.createElement('button');
    iBtn.className = 'match-image-btn';
    iBtn.textContent = pair.emoji;
    iBtn.dataset.word = pair.word;
    iBtn.addEventListener('click', () => {
      if (iBtn.classList.contains('matched') || !selectedWordBtn) return;

      const isCorrect = selectedWordBtn.dataset.word === iBtn.dataset.word;
      if (isCorrect) {
        selectedWordBtn.classList.remove('selected');
        selectedWordBtn.classList.add('matched');
        iBtn.classList.add('matched');
        matchedCount++;
        selectedWordBtn = null;
        if (matchedCount === 5) {
          recordRoundResult(!roundHadError);
        }
      } else {
        // Wrong connection — mark this round as an error immediately.
        roundHadError = true;
        iBtn.classList.add('wrong-flash');
        selectedWordBtn.classList.add('wrong-flash');
        setTimeout(() => {
          iBtn.classList.remove('wrong-flash');
          if (selectedWordBtn) selectedWordBtn.classList.remove('wrong-flash', 'selected');
        }, 350);
      }
    });
    grid.appendChild(iBtn);
  });
}

/* ----------------------------------------------------------------
   15. REPORT VIEW
   ---------------------------------------------------------------- */
function renderReport() {
  const users = loadJSON(LS_USERS, {});
  const profile = users[state.currentPatientEmail] || {};
  const record = getResultsRecord();

  qs('#report-patient-line').textContent =
    `For ${profile.name || 'Unknown'}${profile.age ? ' · Age ' + profile.age : ''} (${state.currentPatientEmail})`;

  const hits = record.rounds.filter(r => r.correct).length;
  const misses = record.rounds.filter(r => !r.correct).length;
  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;

  qs('#stat-hits').textContent = hits;
  qs('#stat-misses').textContent = misses;
  qs('#stat-accuracy').textContent = `${accuracy}%`;
  // Placeholder only — real value will come from the ML model once trained.
  qs('#stat-risk').textContent = 'Awaiting Dataset Integration';

  // Per game + level breakdown
  const tbody = qs('#breakdown-tbody');
  tbody.innerHTML = '';
  const groups = {};
  record.rounds.forEach(r => {
    const key = `${r.game}|${r.level}`;
    if (!groups[key]) groups[key] = { game: r.game, level: r.level, correct: 0, errors: 0, played: 0 };
    groups[key].played++;
    if (r.correct) groups[key].correct++; else groups[key].errors++;
  });

  const rows = Object.values(groups);
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No games played yet.</td></tr>';
  } else {
    rows.forEach(g => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${GAME_LABELS[g.game] || g.game}</td>
        <td>${g.level}</td>
        <td>${g.played}</td>
        <td>${g.correct}</td>
        <td>${g.errors}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Patients can keep playing; staff view is read-only.
  qs('#play-more-btn').classList.toggle('hidden', state.role !== 'patient');
}

/* ----------------------------------------------------------------
   16. INIT
   ---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', initAuth);

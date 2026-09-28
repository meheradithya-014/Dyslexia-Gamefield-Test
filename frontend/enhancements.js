/* ================================================================
   enhancements.js — additive layer (load AFTER script.js)
   Does NOT edit script.js. It hooks in via DOM events,
   MutationObservers and one wrapper around pickRandom().
   Modules: 1 unique questions · 2 pop engine · 3 backgrounds & cards
            4 instruction box · 5 confetti · 6 celebrations · 7 report
   ================================================================ */
(function () {
  'use strict';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const COLORS = ['#FF9F5A', '#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#8E6CEF', '#FF7EB6'];

  /* ---------- 1. QUESTION UNIQUENESS ---------------------------------
     Extra words (word|emoji|rhyme|rhymeEmoji) bring every level to 25
     entries: 5 rounds x 5 matching pairs = 25, so no repeats in a play. */
  const EXTRA = {
    Easy: 'bee|🐝|knee|🦵;pig|🐷|wig|💇;hen|🐔|pen|🖊️;bat|🦇|rat|🐀;duck|🦆|truck|🚚;frog|🐸|fog|🌫️;bear|🐻|chair|🪑;cow|🐮|owl|🦉;cake|🎂|snake|🐍;key|🔑|sea|🌊;bed|🛏️|red|🟥;hand|✋|sand|🏜️;rain|🌧️|train|🚂;milk|🥛|silk|🧵;nose|👃|rose|🌹;bell|🔔|shell|🐚;goat|🐐|coat|🧥;corn|🌽|horn|📯;ring|💍|king|🤴',
    Medium: 'honey|🍯|bunny|🐇;candle|🕯️|handle|🚪;spider|🕷️|glider|🪂;winter|❄️|printer|🖨️;rocket|🚀|pocket|👖;mitten|🧤|kitten|🐈;dragon|🐉|wagon|🛒;button|🔘|mutton|🍖;carrot|🥕|parrot|🦜;zipper|🤐|slipper|🩴;butter|🧈|flutter|🪶;muffin|🧁|puffin|🐧;wizard|🧙|lizard|🦎;cherry|🍒|berry|🫐;ocean|🌊|motion|🎬;yellow|💛|mellow|😌;river|🏞️|shiver|🥶;garden|🌷|pardon|🙏;thunder|⛈️|wonder|🤔',
    Hard: 'crocodile|🐊|reptile|🦎;kangaroo|🦘|shampoo|🧴;strawberry|🍓|blackberry|🍇;pineapple|🍍|chapel|⛪;telescope|🔭|microscope|🔬;volcano|🌋|tornado|🌪️;spaghetti|🍝|confetti|🎊;motorcycle|🏍️|bicycle|🚲;trumpet|🎺|crumpet|🥞;scooter|🛴|computer|💻;lantern|🏮|pattern|🔷;treasure|💰|measure|📏;fountain|⛲|mountain|🏔️;tomato|🍅|potato|🥔;flamingo|🦩|bingo|🎯;cabbage|🥬|baggage|🧳;pumpkin|🎃|bumpkin|🤠;window|🪟|widow|👵;bubble|🫧|double|✌️'
  };
  Object.keys(EXTRA).forEach(level => {
    EXTRA[level].split(';').forEach(row => {
      const [word, emoji, rhyme, rhymeEmoji] = row.split('|');
      if (!WORD_BANK[level].some(e => e.word === word)) WORD_BANK[level].push({ word, emoji, rhyme, rhymeEmoji });
    });
  });

  // Wrap pickRandom: when a WORD_BANK level is sampled, only unseen words are returned.
  // Seen-words are remembered per player, per game+level, and only reset once exhausted.
  const originalPick = window.pickRandom;
  window.pickRandom = function (arr, n) {
    if (!state.activeGame || !state.activeLevel || arr !== WORD_BANK[state.activeLevel]) return originalPick(arr, n);
    const key = 'dgft_seen_' + (state.currentPatientEmail || 'guest');
    const seen = loadJSON(key, {});
    const k = state.activeGame + '|' + state.activeLevel;
    let used = seen[k] || [];
    let pool = arr.filter(e => !used.includes(e.word));
    if (pool.length < n) { used = []; pool = arr.slice(); }   // whole bank used — start a fresh cycle
    const picked = shuffle(pool).slice(0, n);
    seen[k] = used.concat(picked.map(e => e.word));
    saveJSON(key, seen);
    return picked;
  };

  /* ---------- 2. CURSOR POP ENGINE ---------------------------------- */
  const HOT = '.card,.game-card,.stat-card,.btn,.btn-icon,.option-btn,.match-word-btn,.match-image-btn,' +
    '.role-btn,.fab,.round-tracker,.score-pill,.prompt-word,.speech-bubble,.play-audio-btn,.mic-btn,' +
    '.auth-form input,.auth-form label,.audio-input-row input,.modal-close,.mascot,h1,h2';
  let hotEl = null, ticking = false, lastEvt = null;

  function setHot(el) {
    if (hotEl && hotEl !== el) { hotEl.removeAttribute('data-hot'); hotEl.style.removeProperty('--px'); hotEl.style.removeProperty('--py'); }
    hotEl = el;
  }
  function frame() {
    ticking = false;
    const e = lastEvt; if (!e) return;
    const t = e.target.closest ? e.target.closest(HOT) : null;
    if (!t || t.disabled) return setHot(null);
    const r = t.getBoundingClientRect();
    t.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(2));
    t.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(2));
    t.setAttribute('data-hot', '');
    setHot(t);
  }
  if (!REDUCED) {
    document.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      lastEvt = e;
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => setHot(null));
    window.addEventListener('blur', () => setHot(null));
  }

  // Click "pop" sparkles (works for touch too)
  document.addEventListener('pointerdown', e => {
    if (REDUCED || !e.target.closest('button, .game-card, input, label')) return;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('span');
      s.className = 'fx-pop'; s.textContent = ['✦', '★', '●'][i % 3];
      s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
      s.style.color = COLORS[i % COLORS.length];
      document.body.appendChild(s);
      const a = (Math.PI * 2 * i) / 7, d = rand(28, 52);
      s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                 { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
                { duration: 550, easing: 'ease-out' }).onfinish = () => s.remove();
    }
  });

  /* ---------- 3. BACKGROUNDS & GAME CARDS ---------------------------- */
  const bg = document.querySelector('.bg-blobs');
  if (bg && !REDUCED) {
    const glyphs = ['●', '★', '✦', '◆', '○', '♥'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.className = 'fx-shape'; s.textContent = glyphs[i % glyphs.length];
      s.style.left = rand(2, 96) + '%';
      s.style.fontSize = rand(14, 38) + 'px';
      s.style.color = COLORS[i % COLORS.length];
      s.style.animationDuration = rand(16, 32) + 's';
      s.style.animationDelay = -rand(0, 30) + 's';
      bg.appendChild(s);
    }
  }
  document.querySelectorAll('.game-card').forEach(card => {
    if (REDUCED) return;
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('span');
      const size = rand(10, 26);
      b.className = 'fx-bubble'; b.setAttribute('aria-hidden', 'true');
      b.style.cssText = `width:${size}px;height:${size}px;left:${rand(4, 88)}%;` +
        `animation-duration:${rand(4, 8)}s;animation-delay:${-rand(0, 8)}s`;
      card.appendChild(b);
    }
  });

  /* ---------- 4. INSTRUCTION BOX ------------------------------------- */
  const HOWTO = {
    jumbled:  { e: '🔤', steps: ['Look at the mixed-up letters on the screen.', 'Think of the real word they can make.', 'Tap the correct word from the choices.'], tip: 'Say the letters out loud, slowly. It really helps!' },
    audio:    { e: '🎧', steps: ['Press “Play Audio” to hear a word (turn your sound on).', 'Listen carefully. You can play it again!', 'Type the word you heard, then press “Check Answer”.'], tip: 'Sound the word out one little part at a time.' },
    visual:   { e: '🖼️', steps: ['Read the word at the top of the screen.', 'Look closely at all the pictures.', 'Tap the picture that matches the word.'], tip: 'Not sure? Say the word, then say each picture’s name.' },
    rhyme:    { e: '🎵', steps: ['Read the word you see.', 'Say it out loud, then say each choice.', 'Tap the one that ends with the same sound (like cat and hat).'], tip: 'Rhymes sound alike at the END of the word.' },
    matching: { e: '🔗', steps: ['Tap a word on the left side.', 'Then tap the picture that matches it.', 'Match all 5 pairs. A wrong tap counts as a mistake for that round.'], tip: 'Start with the words you already know!' }
  };
  function renderHowTo(game) {
    const data = HOWTO[game]; if (!data) return;
    const card = document.querySelector('#difficulty-modal .modal-card');
    let box = card.querySelector('.how-to');
    if (box) box.remove();                       // remove + recreate => entrance animation replays
    box = document.createElement('div');
    box.className = 'how-to'; box.setAttribute('aria-live', 'polite');
    box.innerHTML = `<div class="how-to-head"><span class="how-to-emoji" aria-hidden="true">${data.e}</span><h3>How to play</h3></div>` +
      `<ol>${data.steps.map(s => `<li>${s}</li>`).join('')}</ol><p class="how-to-tip">💡 ${data.tip}</p>`;
    card.insertBefore(box, card.querySelector('.difficulty-options'));
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    card.querySelectorAll('.level-btn').forEach(b => { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; });
  }
  document.querySelectorAll('.game-card').forEach(c => c.addEventListener('click', () => renderHowTo(c.dataset.game)));

  /* ---------- 5. CONFETTI ENGINE -------------------------------------- */
  const cv = document.createElement('canvas');
  cv.id = 'fx-canvas'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let parts = [], running = false;
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
  fit(); window.addEventListener('resize', fit);

  function burst(x, y, n, o = {}) {
    if (REDUCED) return;
    const { spread = Math.PI * 2, angle = -Math.PI / 2, speed = 10, gravity = 0.28, decay = 0.008 } = o;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread, s = rand(speed * 0.4, speed);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: gravity, d: decay, life: 1,
        w: rand(6, 12), h: rand(4, 8), c: COLORS[(Math.random() * COLORS.length) | 0],
        r: rand(0, 6), vr: rand(-0.3, 0.3), star: Math.random() < 0.2 });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0 && p.y < cv.height + 30);
    parts.forEach(p => {
      p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.d;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.star) { ctx.font = '18px sans-serif'; ctx.fillText('★', -8, 6); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
  const firework = (x, y) => burst(x, y, 60, { speed: 8, gravity: 0.12, decay: 0.014 });

  /* ---------- 6. CELEBRATIONS ---------------------------------------- */
  // 6a. Level complete — observe the existing modal instead of editing finishLevel()
  const lc = document.getElementById('level-complete');
  let lcWasHidden = true;
  new MutationObserver(() => {
    const hidden = lc.classList.contains('hidden');
    if (lcWasHidden && !hidden) celebrateLevel();
    lcWasHidden = hidden;
  }).observe(lc, { attributes: true, attributeFilter: ['class'] });

  function celebrateLevel() {
    const card = lc.querySelector('.modal-card');
    let badge = card.querySelector('.reward-badge');
    if (!badge) { badge = document.createElement('div'); badge.className = 'reward-badge'; card.insertBefore(badge, card.querySelector('h2')); }
    const h = state.sessionHits;
    const [emoji, text] = h >= 5 ? ['🏆', 'Perfect Score!'] : h >= 4 ? ['🥇', 'Super Star!'] : h >= 2 ? ['🥈', 'Great Effort!'] : ['🌱', 'Keep Growing!'];
    badge.innerHTML = `<span class="badge-emoji">${emoji}</span><span class="badge-text">${text}</span>`;
    badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = '';
    let stars = card.querySelector('.float-stars');
    if (!stars) {
      stars = document.createElement('div'); stars.className = 'float-stars'; stars.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 10; i++) {
        const s = document.createElement('span'); s.textContent = i % 2 ? '⭐' : '✨';
        s.style.left = rand(4, 92) + '%'; s.style.fontSize = rand(16, 28) + 'px';
        s.style.animationDelay = -rand(0, 3) + 's'; stars.appendChild(s);
      }
      card.prepend(stars);
    }
    burst(innerWidth / 2, innerHeight * 0.35, 130, { speed: 13 });
    burst(0, innerHeight, 70, { angle: -Math.PI / 3, spread: 0.7, speed: 18 });
    burst(innerWidth, innerHeight, 70, { angle: (-2 * Math.PI) / 3, spread: 0.7, speed: 18 });
  }

  // 6b. Final submission — listener registers after script.js's, so the report is already rendered
  document.getElementById('submit-report-btn').addEventListener('click', () => {
    const name = (document.getElementById('hub-player-name') || {}).textContent || 'Friend';
    const f = document.createElement('div');
    f.className = 'finale'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Assessment complete');
    f.innerHTML = `<div class="finale-card"><div class="finale-trophy">🏆</div>
      <h2>Amazing job, ${name.replace(/[<>&]/g, '')}!</h2>
      <p>You finished your whole Word Quest!</p>
      <div class="finale-stars" aria-hidden="true"><span>⭐</span><span>⭐</span><span>⭐</span></div>
      <button type="button" class="btn btn-primary btn-lg">See my report 📊</button></div>`;
    document.body.appendChild(f);
    const close = () => { f.remove(); clearInterval(timer); clearTimeout(auto); };
    f.querySelector('button').addEventListener('click', close);
    const w = innerWidth, h = innerHeight;
    burst(w / 2, h * 0.4, 180, { speed: 16 });
    burst(0, h, 100, { angle: -Math.PI / 3, spread: 0.6, speed: 22 });
    burst(w, h, 100, { angle: (-2 * Math.PI) / 3, spread: 0.6, speed: 22 });
    let n = 0;
    const timer = setInterval(() => {
      firework(rand(w * 0.15, w * 0.85), rand(h * 0.12, h * 0.5));
      if (++n % 3 === 0) burst(rand(0, w), -10, 60, { angle: Math.PI / 2, spread: 1.4, speed: 4, gravity: 0.12, decay: 0.004 });
      if (n >= 10) clearInterval(timer);
    }, 450);
    const auto = setTimeout(close, 9000);
  });

  /* ---------- 7. REPORT DASHBOARD ------------------------------------ */
  // If the ML model later writes a percentage into #stat-risk, show it big.
  const risk = document.getElementById('stat-risk');
  const tagRisk = () => risk.classList.toggle('is-percent', /^\s*\d+(\.\d+)?\s*%\s*$/.test(risk.textContent));
  new MutationObserver(tagRisk).observe(risk, { childList: true, characterData: true, subtree: true });
  tagRisk();
})();

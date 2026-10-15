/* EGG - single-file game script.  Repo: elaprogect-rgb/ch  (root)  */
(() => {
'use strict';

/* =====================================================================
   CONFIG / ASSETS  (every filename below was checked in the repo root)
   ===================================================================== */
const CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
const A = {
  logo: 'EGG_Logo.webp', bg: 'Bg_minigolf2_0.webp',
  idle: 'EGG_CharlesIdle.png', run: 'EGG_CharlesRun.png',
  musicMenu: 'Incubating.mp3', musicGame: 'Cracked-AllInstruments.mp3', musicLose: 'Scrambled.mp3',
  musicPit: 'The_Pit.mp3.mpeg', pitBg: 'OIP (7).webp',
  pitIntro: 'HESNOTHEREBUTiAM.png', modeScreen: 'DECAY_ROT_screen.png',
  mime: 'MimeHand.gif', ireAppear: 'Ire_appear.gif', ireAttack: 'Ire_attack.gif',
  ireActive: 'Ire_active.gif', ireFrown: 'Ire_Frown_Animated.gif'
};
const url = p => CDN + encodeURI(p);

// GIFs can't report when they finish, so these durations (seconds) are how long each state lasts.
// Tweak them to match your actual GIF lengths.
const CFG = {
  IRE_APPEAR_S: 1.6,   // Ire_appear.gif
  IRE_ATTACK_S: 2.0,   // Ire_attack.gif (semi mad)
  IRE_FROWN_S: 1.2,    // Ire_Frown_Animated.gif
  IRE_STILL_S: 0.25,   // must stay still this long after mad begins
  IRE_KILL_DELAY_S: 1.0,
  IRE_WAKEUP_WINDOW_S: 0.5,
  IRE_SCALE: { spawn: 1, semi: 0.4, mad: 0.15, frown: 0.3 }, // egg/spawn time scale per state
  TICK_S: 0.07, STEP_PX: 7, RUN_ANIM_S: 0.4, COUNTDOWN_S: 3
};

// stage is a virtual 240 x 320 box scaled to the window
const W = 240, H = 320, LANE_X = [40, 120, 200];
const PLAYER_TOP = 270, GROUND = 314;

const BADGES = [
  { id: 'hardstuck', name: 'Hardstuck', img: 'Hardstuck_Badge.png', bio: 'You do nothing but cheat! Cheat i say!', sub: 'Make it to round 50.' },
  { id: 'winner', name: 'Winner Winner Chicken Dinner!', img: 'Winner_Badge.png', bio: 'Winner Winner Chicken Dinner!', sub: 'Beat 3 rounds for the first time.' },
  { id: 'winnerwinner', name: 'Winner Winner', img: 'Winner_Winner_Badge.png', bio: "You're a loser who sits and crys!", sub: 'Beat 3 rounds without losing a single heart.' },
  { id: 'battler', name: 'Battler', img: 'Battler_Badge.png', bio: 'You cheated. No other words.', sub: 'Survive 20 rounds without losing 1 heart.' },
  { id: 'handsoff', name: 'HANDSOFF', img: 'HANDSOFF_Badge.png', bio: 'IT JUST MAKES YOU HAPPY!', sub: 'Survive mime for the first time.' },
  { id: 'wakeup', name: 'WAKEUPCALL', img: 'WAKEUPCALL_Badge.png', bio: 'YOU JUST LIVE ON AND ON.', sub: 'Survive ire with less then 0.5 seconds before they enter their attacking state.' },
  { id: 'allequal', name: 'All equal', img: 'All_equal_Badge.png', bio: 'WONDERFUL!', sub: 'Survive ire for the first time.' },
  { id: 'decorrupt', name: 'DECORRUPT**(Y-N)', img: 'DECORRUPT__(Y-N)_Badge.png', bio: 'YOU_ARE_JUST_GETTING_STARTED.', sub: 'Enter the pit for the first time.' }
];

const ENT = {
  mime: { name: 'Mime', img: 'mime', bio: 'A silent hand that mirrors where you have been.', hint: 'Retracing your steps is a bad idea.' },
  ire: { name: 'Ire', img: 'ireActive', bio: 'It watches from above and wakes up angry.', hint: 'When it glares, hold perfectly still. Everything slows down.' }
};

/* =====================================================================
   HELPERS, SAVE DATA
   ===================================================================== */
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const failed = new Set();

function setImg(el, key) {
  const path = A[key] || key;
  el.classList.remove('missing');
  el.onerror = () => {
    el.classList.add('missing'); el.alt = path;
    failed.add(path); console.warn('EGG: asset failed to load:', url(path));
    const box = $('#assetErrors'); box.hidden = false; box.textContent = 'Missing assets: ' + [...failed].join(', ');
  };
  el.src = url(path);
}
const blobs = {};   // preloaded GIF blobs, so each use gets a fresh URL and restarts from frame 0
function freshImg(parent, key) {
  const img = document.createElement('img'); img.alt = '';
  if (parent._bu) { URL.revokeObjectURL(parent._bu); parent._bu = null; }
  if (blobs[key]) { parent._bu = URL.createObjectURL(blobs[key]); img.src = parent._bu; }
  else setImg(img, key);
  parent.replaceChildren(img); return img;
}

const SAVE_KEY = 'egg_save_v1';
let save = { badges: {}, pitUnlocked: false, pitEntered: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { console.warn('EGG: save load failed', e); }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { console.warn('EGG: save failed', e); } }

let toastTimer = null;
function award(id) {
  if (save.badges[id]) return;                       // never award duplicates
  save.badges[id] = Date.now(); persist();
  const b = BADGES.find(x => x.id === id), t = $('#toast');
  t.textContent = 'Badge unlocked: ' + b.name; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* =====================================================================
   AUDIO
   ===================================================================== */
const Snd = {
  els: {}, want: null, suspended: false,
  el(k) {
    if (!this.els[k]) {
      const a = new Audio(url(A[k])); a.preload = 'auto';
      a.addEventListener('error', () => { failed.add(A[k]); console.warn('EGG: audio failed:', A[k]); });
      this.els[k] = a;
    }
    return this.els[k];
  },
  stopAll() { for (const a of Object.values(this.els)) { a.pause(); a.currentTime = 0; a.onended = null; } this.want = null; },
  play(k, loop = true) {
    const a = this.el(k);
    if (this.want === k && !a.paused && loop) return a;   // don't restart/duplicate the same track
    this.stopAll(); a.loop = loop; this.want = k; this._try(); return a;
  },
  _try() { if (!this.want || this.suspended) return; const p = this.el(this.want).play(); if (p && p.catch) p.catch(() => {}); },
  suspend() { this.suspended = true; if (this.want) this.el(this.want).pause(); },
  resume() { this.suspended = false; this._try(); }
};
// autoplay-blocked music starts on the first interaction
['keydown', 'pointerdown'].forEach(ev => addEventListener(ev, () => {
  if (Snd.want && !Snd.suspended && Snd.el(Snd.want).paused && !Snd.el(Snd.want).ended) Snd._try();
}, true));

/* =====================================================================
   SCREENS + KEYBOARD/BUTTON NAVIGATION
   ===================================================================== */
const S = { screen: 'menu', lastMode: 'main', paused: false, cd: 0, pitForced: false, timers: [] };
let G = null; // current run

const SECTIONS = ['loading', 'sound', 'menu', 'badges', 'pitIntro', 'mode', 'game', 'inter', 'end'];
function show(name) {
  S.screen = name;
  const gameVisible = ['game', 'inter', 'end'].includes(name);
  SECTIONS.forEach(n => { $('#' + n).hidden = n === 'game' ? !gameVisible : n !== name; });
  const pit = G && G.mode !== 'main' && gameVisible || ['pitIntro', 'mode'].includes(name);
  $('#app').style.backgroundImage = ['loading', 'sound'].includes(name) ? 'none' : `url("${url(pit ? A.pitBg : A.bg)}")`;
}

const nav = { btns: [], i: 0 };
function setNav(btns, i = 0) {
  nav.btns = btns; nav.i = Math.max(0, Math.min(i, btns.length - 1));
  btns.forEach((b, k) => b.classList.toggle('sel', k === nav.i));
}
function navMove(d) {
  if (!nav.btns.length) return;
  nav.i = (nav.i + d + nav.btns.length) % nav.btns.length;
  nav.btns.forEach((b, k) => b.classList.toggle('sel', k === nav.i));
}
document.addEventListener('mouseover', e => {
  const b = e.target.closest('.btn, .card, .hot'); const k = nav.btns.indexOf(b);
  if (k >= 0 && k !== nav.i) { nav.i = k; nav.btns.forEach((x, j) => x.classList.toggle('sel', j === k)); }
});

const pitAvailable = () => save.pitUnlocked || S.pitForced;

function toMenu() {
  cleanup(); G = null;
  Snd.play('musicMenu');
  $('#pitBtn').hidden = !pitAvailable();
  show('menu');
  setNav([...$('#menuBtns').children].filter(b => !b.hidden), nav.btns.length && S.screen === 'menu' ? nav.i : 0);
}

function showBadges() {
  const grid = $('#badgeGrid'); grid.replaceChildren();
  for (const b of BADGES) {
    const got = !!save.badges[b.id];
    const d = document.createElement('div'); d.className = 'badge' + (got ? '' : ' locked');
    const img = document.createElement('img'); img.alt = b.name; setImg(img, b.img);
    d.append(img);
    for (const [cls, txt] of [['nm', b.name], ['bio', '"' + b.bio + '"'], ['sub', b.sub], ['st', got ? 'UNLOCKED' : 'LOCKED']]) {
      const p = document.createElement('div'); p.className = cls; p.textContent = txt; d.append(p);
    }
    grid.append(d);
  }
  show('badges'); setNav([$('#badges .btn')]);
}

/* ---------- PIT intro ---------- */
function enterPit() {
  cleanup();
  save.pitUnlocked = true; save.pitEntered = true; persist();
  award('decorrupt');
  Snd.play('musicPit');
  setImg($('#pitIntroImg'), 'pitIntro'); setImg($('#modeImg'), 'modeScreen');
  show('pitIntro'); setNav([]);
  S.timers.push(setTimeout(() => {
    if (S.screen !== 'pitIntro') return;
    show('mode'); setNav([$('#hotDecay'), $('#hotRot')], 0);
  }, 400));
}

/* =====================================================================
   RUN SETUP
   ===================================================================== */
const stage = $('#stage'), eggsLayer = $('#eggs'), playerEl = $('#player'),
      mimeEl = $('#mime'), ireEl = $('#ire'), bannerEl = $('#banner'), overlay = $('#overlay');

function cleanup() {
  S.timers.forEach(clearTimeout); S.timers = [];
  eggsLayer.replaceChildren(); mimeEl.hidden = true; ireEl.hidden = true; ireEl.replaceChildren(); bannerEl.hidden = true;
  S.paused = false; S.cd = 0; overlay.hidden = true;
  if (G) G.running = false;
}

const rollTarget = r => r <= 3 ? rndInt(5, 10) : rndInt(15, 25);

function startRun(mode) {
  cleanup();
  S.lastMode = mode;
  Snd.play(mode === 'main' ? 'musicGame' : 'musicPit');
  G = {
    mode, round: 1, hearts: 3, over: 0, score: 0, t: 0, lane: 1, runT: 0, lastMoveT: -99,
    eggs: [], tickAcc: 0, spawnT: -1.2, spawned: 0, resolved: 0, target: rollTarget(1),
    entity: null, mime: null, ire: null, ireCd: 0, ts: 1, dmg: false,
    state: 'play', running: true, bannerT: 0
  };
  show('game');
  setImg(playerEl, 'idle'); placePlayer();
  setBanner('ROUND 1'); hud();
  setNav([]);
}

function setBanner(txt) { bannerEl.textContent = txt; bannerEl.hidden = false; G.bannerT = 1.2; }
function placePlayer() { playerEl.style.left = (LANE_X[G.lane] - 24) + 'px'; }
function placeMime() { mimeEl.style.left = (LANE_X[G.mime.lane] - 22) + 'px'; }

function hud() {
  const hs = $('#hearts'); hs.replaceChildren();
  for (let i = 0; i < 3; i++) { const s = document.createElement('span'); s.className = 'h ' + (i < G.hearts ? 'on' : 'off'); s.textContent = '\u2665'; hs.append(s); }
  for (let i = 0; i < G.over; i++) { const s = document.createElement('span'); s.className = 'oh'; s.textContent = '\u2665'; hs.append(s); }
  $('#score').textContent = 'R' + G.round + '  ' + G.score;
}

/* ---------- difficulty ---------- */
function diff() { const cap = G.mode === 'decay' ? 15 : G.mode === 'rot' ? 30 : 10; return Math.min(G.round, cap) - 1; }
function speedMul() { const d = diff(); return G.mode === 'rot' ? 1.3 + 0.09 * d : G.mode === 'decay' ? 1 + 0.045 * d : 1 + 0.05 * d; }
function spawnInterval() { const d = diff(); return G.mode === 'rot' ? Math.max(0.3, 0.9 - 0.02 * d) : G.mode === 'decay' ? Math.max(0.7, 1.4 - 0.05 * d) : Math.max(0.7, 1.5 - 0.08 * d); }
function rotChance() { const d = diff(); return G.mode === 'rot' ? Math.min(0.66, 0.3 + 0.012 * d * 1.0 + 0.1) : G.mode === 'decay' ? 0.2 + 0.015 * d : 0.15 + 0.03 * d; }

/* =====================================================================
   GAME LOOP
   ===================================================================== */
let last = performance.now();
function frame(t) {
  const dt = Math.min((t - last) / 1000, 0.1); last = t;
  if (S.paused) {
    if (S.cd > 0 && !document.hidden) {
      S.cd -= dt;
      if (S.cd <= 0) { S.paused = false; overlay.hidden = true; Snd.resume(); }
      else overlay.textContent = Math.ceil(S.cd);
    }
  } else if (G && G.running && G.state === 'play') update(dt);
  requestAnimationFrame(frame);
}

function update(dt) {
  G.t += dt;
  if (G.bannerT > 0) { G.bannerT -= dt; if (G.bannerT <= 0) bannerEl.hidden = true; }
  if (G.runT > 0) { G.runT -= dt; if (G.runT <= 0) setImg(playerEl, 'idle'); }

  updateIre(dt);
  const ts = G.ts;

  G.tickAcc += dt * ts * speedMul();
  while (G.tickAcc >= CFG.TICK_S && G.state === 'play') { G.tickAcc -= CFG.TICK_S; stepEggs(); }

  if (G.state !== 'play') return;
  G.spawnT += dt * ts;
  if (G.spawned < G.target && G.spawnT >= spawnInterval()) {
    G.spawnT = 0;
    const n = (G.mode === 'rot' && Math.random() < 0.4) ? 2 : 1; // roT: bursts
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n && G.spawned < G.target; i++) spawnEgg(lanes[i]);
  }
}

function spawnEgg(lane) {
  const rotten = G.round >= 2 && Math.random() < rotChance();
  const el = document.createElement('div'); el.className = 'egg' + (rotten ? ' rotten' : '');
  eggsLayer.append(el);
  const e = { lane, y: -4, rotten, el }; placeEgg(e);
  G.eggs.push(e); G.spawned++;
}
function placeEgg(e) { e.el.style.transform = `translate(${LANE_X[e.lane] - 2}px,${e.y}px)`; }

function stepEggs() {
  for (const e of G.eggs.slice()) {
    if (G.state !== 'play') return;
    e.y += CFG.STEP_PX;
    const bottom = e.y + 4;
    if (bottom >= PLAYER_TOP && e.lane === G.lane) land(e, true);
    else if (bottom >= GROUND) land(e, false);
    else placeEgg(e);
  }
}
function checkCatch() {
  for (const e of G.eggs.slice()) {
    if (G.state !== 'play') return;
    const bottom = e.y + 4;
    if (bottom >= PLAYER_TOP && bottom < GROUND && e.lane === G.lane) land(e, true);
  }
}

function land(e, caught) {
  G.eggs.splice(G.eggs.indexOf(e), 1); e.el.remove();
  if (caught) { if (e.rotten) { G.score -= 2000; damage(); } else G.score += 1000; }
  else { if (e.rotten) G.score += 1000; else { G.score -= 2000; damage(); } }
  hud();
  if (G.state === 'play') resolve();
}

function damage() {
  G.dmg = true;
  if (G.over > 0) G.over--; else G.hearts--;
  stage.classList.remove('hit'); void stage.offsetWidth; stage.classList.add('hit');
  if (G.hearts <= 0) lose();
}

function resolve() { G.resolved++; if (G.resolved >= G.target) endRound(); }

function endRound() {
  const done = G.round;
  if (done === 3) { if (G.mode === 'main') award('winner'); if (!G.dmg) award('winnerwinner'); }

  if (G.mode === 'main' && done >= 10) return win();

  // advance
  G.round++;
  if (G.mode === 'main') { if (G.hearts < 3) G.hearts++; else if (G.over < 6) G.over++; } // PIT: no heal, no overheal
  if (G.mode !== 'main') {
    if (G.round >= 50) award('hardstuck');
    if (G.round >= 20 && !G.dmg) award('battler');
  }
  G.target = rollTarget(G.round); G.spawned = 0; G.resolved = 0; G.spawnT = -1.2; G.tickAcc = 0;
  hud();

  if (G.mode === 'rot' && G.round >= 5 && G.round % 5 === 0) return intermission();
  setBanner('ROUND ' + G.round);
}

/* =====================================================================
   INPUT
   ===================================================================== */
function movePlayer(dir) {
  if (!G || !G.running || G.state !== 'play' || S.paused) return;
  const old = G.lane, nl = (old + dir + 3) % 3;

  if (G.mime && nl === G.mime.lane) { G.lane = nl; placePlayer(); return lose(); } // Mime: instant death
  if (G.mime) { G.mime.lane = old; placeMime(); }                                   // Mime follows one step behind

  G.lane = nl; G.lastMoveT = G.t; G.runT = CFG.RUN_ANIM_S;
  setImg(playerEl, 'run'); placePlayer();

  const ire = G.ire;
  if (ire && ire.state === 'mad' && !ire.resolved && !ire.attacking && ire.stillT < CFG.IRE_STILL_S) {
    ire.attacking = true; ire.killT = CFG.IRE_KILL_DELAY_S;
  }
  checkCatch();
}

addEventListener('keydown', e => {
  const k = e.key;
  if (S.screen === 'sound') { e.preventDefault(); enableSound(); return; }
  if (S.screen === 'loading') return;
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    e.preventDefault();
    if (S.screen === 'game') { if (!e.repeat) movePlayer(k === 'ArrowLeft' ? -1 : 1); }
    else navMove(k === 'ArrowLeft' ? -1 : 1);
  } else if (k === 'Enter') {
    if (S.screen !== 'game' && S.screen !== 'pitIntro' && nav.btns[nav.i]) { e.preventDefault(); nav.btns[nav.i].click(); }
  } else if (k === 'Escape') {
    if (['badges', 'mode', 'end'].includes(S.screen)) toMenu();
  } else if ((k === 'p' || k === 'P') && S.screen === 'menu') {
    S.pitForced = true; $('#pitBtn').hidden = false;                 // testing shortcut (session only)
    setNav([...$('#menuBtns').children].filter(b => !b.hidden), nav.i);
  }
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  switch (b.dataset.act) {
    case 'play': startRun('main'); break;
    case 'badges': showBadges(); break;
    case 'pit': enterPit(); break;
    case 'back': case 'menu': toMenu(); break;
    case 'decay': startRun('decay'); break;
    case 'rot': startRun('rot'); break;
    case 'retry': startRun(S.lastMode); break;
    case 'ent': pickEntity(b.dataset.ent); break;
  }
});

/* =====================================================================
   ENTITIES: intermission, Mime, Ire
   ===================================================================== */
function intermission() {
  // previous entity's period is over
  if (G.entity === 'mime') award('handsoff');
  G.mime = null; G.ire = null; G.entity = null; G.ts = 1;
  mimeEl.hidden = true; ireEl.hidden = true; ireEl.replaceChildren();
  G.state = 'inter';

  const cards = $('#cards'); cards.replaceChildren(); const btns = [];
  for (const id of Object.keys(ENT)) {
    const en = ENT[id];
    const c = document.createElement('button'); c.className = 'card'; c.dataset.act = 'ent'; c.dataset.ent = id;
    const img = document.createElement('img'); img.alt = en.name; setImg(img, en.img);
    c.append(img);
    for (const [cls, txt] of [['nm', en.name], ['bio', en.bio], ['hint', 'Hint: ' + en.hint]]) {
      const d = document.createElement('div'); d.className = cls; d.textContent = txt; c.append(d);
    }
    cards.append(c); btns.push(c);
  }
  show('inter'); setNav(btns, 0);
}

function pickEntity(id) {
  if (!G || G.state !== 'inter') return;
  G.entity = id; G.state = 'play';
  if (id === 'mime') {
    G.mime = { lane: (G.lane + 1) % 3 };
    setImg(mimeEl, 'mime'); mimeEl.hidden = false; placeMime();
  } else if (id === 'ire') {
    G.ireCd = rnd(5, 9);
  }
  show('game'); setNav([]);
  setBanner('ROUND ' + G.round);
}

function setIreState(st) {
  const ire = G.ire; ire.state = st; ire.t = 0;
  const key = { spawn: 'ireAppear', semi: 'ireAttack', mad: 'ireActive', frown: 'ireFrown' }[st];
  freshImg(ireEl, key);
  G.ts = CFG.IRE_SCALE[st];
}

function updateIre(dt) {
  if (G.entity !== 'ire') { G.ts = 1; return; }
  let ire = G.ire;
  if (!ire) {
    G.ts = 1; G.ireCd -= dt;
    if (G.ireCd <= 0) {
      ire = G.ire = { state: 'spawn', t: 0, stillT: 0, attacking: false, killT: 0, resolved: false, close: false };
      ireEl.hidden = false; setIreState('spawn');
    }
    return;
  }
  ire.t += dt;
  switch (ire.state) {
    case 'spawn': if (ire.t >= CFG.IRE_APPEAR_S) setIreState('semi'); break;
    case 'semi': if (ire.t >= CFG.IRE_ATTACK_S) {
      ire.close = (G.t - G.lastMoveT) < CFG.IRE_WAKEUP_WINDOW_S;   // moved <0.5s before the attacking state began
      setIreState('mad'); ire.stillT = 0;
    } break;
    case 'mad':
      if (ire.resolved) break;
      if (ire.attacking) {
        ire.killT -= dt;
        if (ire.killT <= 0) { ire.resolved = true; lose(); }
      } else {
        ire.stillT += dt;                                          // stillness check starts when mad begins
        if (ire.stillT >= CFG.IRE_STILL_S) {
          ire.resolved = true; setIreState('frown');
          award('allequal'); if (ire.close) award('wakeup');
        }
      }
      break;
    case 'frown':
      if (ire.t >= CFG.IRE_FROWN_S) {
        G.ire = null; ireEl.hidden = true; ireEl.replaceChildren(); G.ts = 1; G.ireCd = rnd(8, 14);
      }
      break;
  }
}

/* =====================================================================
   END STATES
   ===================================================================== */
function lose() {
  if (!G || G.state === 'dead' || G.state === 'won') return;
  G.state = 'dead'; G.running = false; G.ts = 1;
  const g = G;
  let shown = false;
  const showEnd = () => {
    if (shown || G !== g) return; shown = true;
    $('#endTitle').textContent = 'SCRAMBLED';
    $('#endStats').innerHTML = 'Score: ' + g.score + '<br>Rounds reached: ' + g.round;
    show('end'); setNav([...$('#end .btn')]);
  };
  const a = Snd.play('musicLose', false);
  a.onended = showEnd; a.onerror = showEnd;
  S.timers.push(setTimeout(() => { if (a.paused && !S.paused && !Snd.suspended) showEnd(); }, 3000)); // audio blocked/failed
}

function win() {
  G.state = 'won'; G.running = false;
  save.pitUnlocked = true; persist();
  Snd.play('musicMenu');
  $('#endTitle').textContent = 'YOU BEAT THE GAME';
  $('#endStats').innerHTML = 'Score: ' + G.score + '<br>Rounds completed: 10<br>The PIT is now open.';
  show('end'); setNav([...$('#end .btn')]);
}

/* =====================================================================
   TAB SWITCH: pause + 3 second countdown
   ===================================================================== */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Snd.suspend();
    if (G && G.running && S.screen === 'game') { S.paused = true; S.cd = 0; overlay.textContent = 'PAUSED'; overlay.hidden = false; }
  } else if (S.paused) {
    S.cd = CFG.COUNTDOWN_S; overlay.textContent = CFG.COUNTDOWN_S; overlay.hidden = false; // audio resumes when countdown ends
  } else {
    Snd.resume();
  }
});

/* =====================================================================
   RESIZE + BOOT
   ===================================================================== */
function resize() { stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H) * 0.98})`; }
addEventListener('resize', resize); resize();

/* =====================================================================
   PRELOADER + CLICK-TO-ENABLE-SOUND
   ===================================================================== */
const keepAlive = [];
function preload(onProgress) {
  const items = [];
  for (const [k, p] of Object.entries(A)) items.push({ k, p, kind: k.startsWith('music') ? 'audio' : /\.gif$/i.test(p) ? 'gif' : 'img' });
  for (const b of BADGES) items.push({ k: 'badge:' + b.id, p: b.img, kind: 'img' });
  let done = 0; const bad = [];
  return Promise.all(items.map(it => new Promise(resolve => {
    let ended = false;
    const end = ok => {
      if (ended) return; ended = true;
      if (!ok) { bad.push(it.p); failed.add(it.p); console.warn('EGG: asset failed to preload:', url(it.p)); }
      done++; onProgress(done, items.length, it.p); resolve();
    };
    const viaImage = () => { const im = new Image(); keepAlive.push(im); im.onload = () => end(true); im.onerror = () => end(false); im.src = url(it.p); };
    if (it.kind === 'audio') {
      const a = Snd.el(it.k);
      if (a.readyState >= 3) return end(true);
      a.addEventListener('canplaythrough', () => end(true), { once: true });
      a.addEventListener('error', () => end(false), { once: true });
      setTimeout(() => end(a.readyState >= 2), 25000);       // don't hang forever on a slow track
    } else if (it.kind === 'gif') {
      fetch(url(it.p)).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(b => { blobs[it.k] = b; end(true); }).catch(viaImage);
    } else viaImage();
  }))).then(() => bad);
}

function enableSound() {
  if (S.soundOn) return; S.soundOn = true;
  toMenu();                        // user gesture happened, so menu music may start now
}
$('#sound').addEventListener('click', enableSound);

setImg($('#logo'), 'logo');
show('loading');
preload((n, total, file) => {
  const pct = Math.round(n / total * 100);
  $('#loadFill').style.width = pct + '%';
  $('#loadText').textContent = 'Loading... ' + pct + '%';
  $('#loadFile').textContent = file;
}).then(bad => {
  if (bad.length) {
    const w = $('#soundWarn'); w.hidden = false;
    w.textContent = 'Could not load: ' + bad.join(', ');
    const box = $('#assetErrors'); box.hidden = false; box.textContent = 'Missing assets: ' + bad.join(', ');
  }
  show('sound');
});
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
})();

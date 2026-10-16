/* =========================================================================
   EGG — weird old-school arcade game.
   One canvas (320x200 logical px, 16:10) + two DOM <img> overlays for GIFs.
   Every asset is loaded from the jsDelivr CDN. Nothing is embedded.

   DESIGN CALLS (spec was ambiguous, so these are documented choices):
   - A heart is lost when you MISS a normal egg or COLLECT a rotten egg
     (the two -2000 events). Score penalties always apply; invulnerability
     (1.5 s) only blocks the heart loss.
   - Blue overheal hearts soak damage before red hearts.
   - Eggs are 4x4 logical px. A 1px outline is drawn purely so they stay
     visible on any background; the collision box is still 4x4.
   - Mime "occupies" the lane it is currently closest to while tweening.
   - Ire: spawn (2 s, harmless) -> semi-mad (2.6 s, harmless, eggs x3 slower)
     -> mad (eggs x5 slower). Any move in mad => death 1 s later.
     Still for 0.25 s in mad => frown + despawn (survived).
   - WAKEUPCALL: you moved within 0.5 s before mad began, then survived.
   - Entities picked at roT intermissions are permanent for the run.
     Picking one you already have levels it up (Mime tweens faster,
     Ire shows up more often).
   - Beating the main game unlocks the PIT tab (saved). P also shows it.
   ========================================================================= */
(() => {
'use strict';

/* ------------------------------------------------------------------ config */
const CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
const url = f => CDN + encodeURI(f);          // encodes spaces; keeps case
const W = 320, H = 200;                        // logical resolution
const STEP = 1 / 60;                           // fixed logic timestep
const EGG_PX = 7, EGG_SIZE = 4;                // eggs fall 7px per tick-interval
const BASE_INTERVAL = 0.07;                    // seconds per 7px step
const INVULN = 1.5;
const FONT = '"Press Start 2P", "Courier New", monospace';
const laneX = i => W * (2 * i + 1) / 6;
const PLAYER_H = 44, PLAYER_BOTTOM = H - 6;

const IMAGES = {
  logo:      'EGG_Logo.webp',
  menuBg:    'Bg_minigolf2_0.webp',
  idle:      'EGG_CharlesIdle.png',
  run:       'EGG_CharlesRun.png',
  pitBg:     'OIP (7).webp',
  hesnt:     'HESNOTHEREBUTiAM.png',
  decayRot:  'DECAY_ROT_screen.png',
  mime:      'MimeHand.gif',
  ireAppear: 'Ire_appear.gif',
  ireAttack: 'Ire_attack.gif',
  ireActive: 'Ire_active.gif',
  ireFrown:  'Ire_Frown_Animated.gif',
  b_hardstuck:    'Hardstuck_Badge.png',
  b_winner:       'Winner_Badge.png',
  b_winnerwinner: 'Winner_Winner_Badge.png',
  b_battler:      'Battler_Badge.png',
  b_handsoff:     'HANDSOFF_Badge.png',
  b_wakeup:       'WAKEUPCALL_Badge.png',
  b_allequal:     'All_equal_Badge.png',
  b_decorrupt:    'DECORRUPT__(Y-N)_Badge.png'
};
const SOUNDS = {
  menu: 'Incubating.mp3',
  game: 'Cracked-AllInstruments.mp3',
  over: 'Scrambled.mp3',
  pit:  'The_Pit.mp3.mpeg'
};

const BADGES = [
  { id: 'hardstuck',    name: 'Hardstuck',                      bio: 'You do nothing but cheat! Cheat i say!',   unlock: 'Reach round 50 in the PIT' },
  { id: 'winner',       name: 'Winner Winner Chicken Dinner!',  bio: 'Winner Winner Chicken Dinner!',            unlock: 'Beat 3 rounds for the first time' },
  { id: 'winnerwinner', name: 'Winner Winner',                  bio: "You're a loser who sits and crys!",        unlock: 'Beat 3 rounds without losing a single heart' },
  { id: 'battler',      name: 'Battler',                        bio: 'You cheated. No other words.',             unlock: 'Survive 20 rounds without losing a heart (PIT)' },
  { id: 'handsoff',     name: 'HANDSOFF',                       bio: 'IT JUST MAKES YOU HAPPY!',                 unlock: 'Survive Mime for the first time' },
  { id: 'wakeup',       name: 'WAKEUPCALL',                     bio: 'YOU JUST LIVE ON AND ON.',                 unlock: 'Survive Ire with < 0.5 s left before mad state' },
  { id: 'allequal',     name: 'All equal',                      bio: 'WONDERFUL!',                               unlock: 'Survive Ire for the first time' },
  { id: 'decorrupt',    name: 'DECORRUPT (Y-N)',                bio: 'YOU_ARE_JUST_GETTING_STARTED.',            unlock: 'Enter the PIT for the first time' }
];

/* ----------------------------------------------------------------- helpers */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const stage = $('stage');
const canvas = $('game');
const ctx = canvas.getContext('2d');
const mimeEl = $('fx-mime');
const ireEl = $('fx-ire');

/* -------------------------------------------------------------------- save */
const SAVE_KEY = 'egg_save_v2';
const save = { badges: {}, pitEntered: false, pitAvailable: false };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  if (s && typeof s === 'object') {
    if (s.badges && typeof s.badges === 'object') save.badges = s.badges;
    save.pitEntered = !!s.pitEntered;
    save.pitAvailable = !!s.pitAvailable;
  }
} catch (e) { console.warn('[EGG] could not read save:', e); }
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
  catch (e) { console.warn('[EGG] could not write save:', e); }
}
let pitForced = false; // P key, this session only
const pitVisible = () => save.pitEntered || save.pitAvailable || pitForced;

/* ------------------------------------------------------------------ toasts */
const toasts = [];
function toast(text, imgKey) { toasts.push({ text, imgKey, t: 3.2 }); }
function award(id) {
  if (save.badges[id]) return;                 // never duplicate
  save.badges[id] = Date.now();
  persist();
  const b = BADGES.find(x => x.id === id);
  toast('BADGE: ' + b.name, 'b_' + id);
}

/* ------------------------------------------------------------------ assets */
const img = {};            // key -> HTMLImageElement
const aud = {};            // key -> HTMLAudioElement
const failed = [];         // {key, file, msg}
let loadTotal = 0, loadDone = 0;

function markFail(key, file, msg) {
  failed.push({ key, file, msg });
  console.error(`[EGG] ASSET FAILED: ${file} (${key}) — ${msg}\n  URL: ${url(file)}`);
}

function loadImage(key, file) {
  return new Promise(resolve => {
    const im = new Image();
    let done = false;
    const finish = (ok, msg) => {
      if (done) return; done = true;
      clearTimeout(to);
      if (ok) img[key] = im; else markFail(key, file, msg);
      loadDone++; resolve(ok);
    };
    const to = setTimeout(() => finish(false, 'timed out after 30s'), 30000);
    im.onload = () => finish(true);
    im.onerror = () => finish(false, 'image failed to load (404 or wrong case?)');
    im.src = url(file);
  });
}

function loadAudio(key, file) {
  return new Promise(resolve => {
    let done = false;
    const finish = (ok, msg, el) => {
      if (done) return; done = true;
      clearTimeout(to);
      if (ok) aud[key] = el; else markFail(key, file, msg);
      loadDone++; resolve(ok);
    };
    const attach = (el, isFallback) => {
      el.preload = 'auto';
      el.addEventListener('canplaythrough', () => finish(true, '', el), { once: true });
      el.addEventListener('loadeddata', () => { if (el.readyState >= 3) finish(true, '', el); }, { once: true });
      el.addEventListener('error', () => {
        if (!isFallback) tryBlob(); else finish(false, 'audio could not be decoded', el);
      }, { once: true });
    };
    // Fallback: some hosts serve odd extensions (.mpeg) with a MIME the <audio>
    // tag refuses. Fetch the bytes and re-type them as audio/mpeg.
    const tryBlob = async () => {
      try {
        const r = await fetch(url(file));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = await r.arrayBuffer();
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        const el2 = new Audio();
        attach(el2, true);
        el2.src = URL.createObjectURL(blob);
        el2.load();
      } catch (e) { finish(false, 'fetch failed: ' + e.message); }
    };
    const to = setTimeout(() => {
      // mobile browsers may never fire canplaythrough without a gesture
      if (el.readyState >= 1) finish(true, '', el);
      else finish(false, 'timed out after 25s');
    }, 25000);
    const el = new Audio();
    attach(el, false);
    el.src = url(SOUNDS[key]);
    el.load();
  });
}

async function preloadAll() {
  const jobs = [];
  for (const [k, f] of Object.entries(IMAGES)) jobs.push(() => loadImage(k, f));
  for (const [k, f] of Object.entries(SOUNDS)) jobs.push(() => loadAudio(k, f));
  loadTotal = jobs.length; loadDone = 0;
  await Promise.all(jobs.map(j => j()));
}

/* ------------------------------------------------------------------- audio */
const Sound = {
  unlocked: false,
  current: null,
  savedPaused: null,
  play(key, loop = true) {
    if (!this.unlocked) return;
    if (this.current === key && aud[key] && !aud[key].paused) return;
    this.stopAll();
    const a = aud[key];
    if (!a) { console.warn('[EGG] no audio loaded for', key); return; }
    try {
      a.loop = loop; a.currentTime = 0; a.volume = 0.8;
      const p = a.play();
      if (p && p.catch) p.catch(e => console.warn('[EGG] audio play blocked:', e.message));
      this.current = key;
    } catch (e) { console.warn('[EGG] audio error:', e); }
  },
  stopAll() {
    for (const a of Object.values(aud)) { try { a.pause(); a.currentTime = 0; } catch (e) {} }
    this.current = null; this.savedPaused = null;
  },
  pauseAll() {
    if (this.savedPaused) return;              // already paused: don't clobber the list
    this.savedPaused = [];
    for (const a of Object.values(aud)) {
      if (!a.paused) { this.savedPaused.push(a); try { a.pause(); } catch (e) {} }
    }
  },
  resumeAll() {
    if (!this.savedPaused) return;
    for (const a of this.savedPaused) {
      try { const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
    this.savedPaused = null;
  }
};

/* ------------------------------------------------------------ canvas/layout */
let scale = 2;
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  let w = vw, h = vw / 1.6;
  if (h > vh) { h = vh; w = vh * 1.6; }
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = canvas.width / W;
}
window.addEventListener('resize', resize);
resize();

function text(str, x, y, o = {}) {
  const size = o.size || 8;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'top';
  if (o.shadow !== false) { ctx.fillStyle = o.shadowColor || '#000'; ctx.fillText(str, x + 1, y + 1); }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(str, x, y);
}
function wrap(str, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = String(str).split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function missing(key, x, y, w, h) {
  // loud placeholder: missing assets are never silently replaced
  ctx.save();
  ctx.fillStyle = 'rgba(255,0,255,0.35)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f0f'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.restore();
  text('MISSING', x + w / 2, y + h / 2 - 6, { size: 6, align: 'center' });
  const f = IMAGES[key] || key;
  text(f.length > 22 ? f.slice(0, 21) + '…' : f, x + w / 2, y + h / 2 + 2, { size: 4, align: 'center' });
}
function drawImg(key, x, y, w, h) {
  const im = img[key];
  if (im) ctx.drawImage(im, x, y, w, h); else missing(key, x, y, w, h);
}
function drawCover(key, alpha = 1) {
  const im = img[key];
  if (!im) { ctx.fillStyle = '#301030'; ctx.fillRect(0, 0, W, H); missing(key, 40, 40, W - 80, H - 80); return; }
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}
function drawContain(key) {
  const im = img[key];
  if (!im) { missing(key, 40, 40, W - 80, H - 80); return; }
  const s = Math.min(W / im.naturalWidth, H / im.naturalHeight);
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
}

/* ------------------------------------------------------------- hotspots/ui */
let hotspots = [];
function hot(x, y, w, h, onClick, onHover) { hotspots.push({ x, y, w, h, onClick, onHover }); }
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function hitTest(p) {
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const h = hotspots[i];
    if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h;
  }
  return null;
}

/* ------------------------------------------------------------------- state */
let scene = 'loading';   // loading | sound | menu | badges | pitEntry | pitSelect | game | gameover | victory
let sceneT = 0;
let uptime = 0;
let run = null;          // the active run (main OR pit) — separate objects per run
let menuSel = 0, badgeSel = 0, modeSel = 0, endSel = 0;
let result = null;
let loadingFinishedAt = 0;

/* pause system */
let pauseState = 0;      // 0 running, 1 paused (tab hidden), 2 countdown
let countdown = 0;
let resetClock = false;

function setScene(s) { scene = s; sceneT = 0; }

/* ============================================================ RUN / ROUNDS */
function newRun(mode) {
  return {
    mode,                       // 'main' | 'decay' | 'rot'
    score: 0, hp: 3, over: 0,   // over = blue overheal hearts (main only)
    round: 0,
    eggs: [], spawnLeft: 0, spawnTimer: 0, stepTimer: 0,
    p: null,
    lane: 1, prevLane: 1, runT: 0,
    invul: 0, flash: 0,
    heartsLost: 0, hurtEarly: false,
    phase: 'banner', phaseT: 0, sel: 0,
    time: 0,
    popups: [],
    ent: { mime: 0, ire: 0 },
    mime: { x: laneX(1) },
    ire: { state: 'idle', t: 0, killT: null, spawnAt: 0, madAt: 0, lastMove: -99 }
  };
}

function difficulty(g) {
  if (g.mode === 'main') return clamp((g.round - 1) / 9, 0, 1);
  if (g.mode === 'decay') return clamp(g.round / 15, 0, 1);   // stops rising at 15
  return clamp(g.round / 30, 0, 1);                             // roT caps at 30
}
function paramsFor(g) {
  const d = difficulty(g);
  if (g.mode === 'main') return {
    interval: lerp(0.07, 0.05, d), gap: lerp(1.5, 0.7, d),
    rotP: g.round < 2 ? 0 : lerp(0.15, 0.4, d), multi: 0
  };
  if (g.mode === 'decay') return {
    interval: lerp(0.07, 0.042, d), gap: lerp(1.2, 0.45, d),
    rotP: lerp(0.2, 0.5, d), multi: lerp(0, 0.25, d)
  };
  return { // roT: intentionally unfair
    interval: lerp(0.06, 0.026, d), gap: lerp(0.8, 0.16, d),
    rotP: lerp(0.35, 0.65, d), multi: lerp(0.2, 0.7, d)
  };
}

function startRun(mode) {
  run = newRun(mode);
  setScene('game');
  pauseState = 0;
  if (mode === 'main') Sound.play('game'); else Sound.play('pit');
  startRound();
}

function startRound() {
  const g = run;
  g.round++;
  if (g.mode === 'main') {
    g.spawnLeft = g.round <= 3 ? randInt(5, 10) : randInt(15, 25);
    if (g.round > 1) {                      // restore a heart, else overheal
      if (g.hp < 3) g.hp++;
      else if (g.over < 6) g.over++;
    }
  } else {
    g.spawnLeft = randInt(15, 25);          // PIT: no heal, no overheal
    if (g.mode !== 'main' && g.round >= 50) award('hardstuck');
  }
  g.p = paramsFor(g);
  g.eggs = [];
  g.spawnTimer = 0.8;
  g.stepTimer = 0;
  g.phase = 'banner';
  g.phaseT = 1.6;
}

function roundComplete() {
  const g = run;
  if (g.mode === 'main') {
    if (g.round === 3) { award('winner'); if (!g.hurtEarly) award('winnerwinner'); }
  } else if (g.round === 20 && g.heartsLost === 0) award('battler');

  if (g.ent.mime > 0) award('handsoff');    // made it through a round with Mime on you

  if (g.mode === 'main' && g.round >= 10) { victory(); return; }
  if (g.mode === 'rot' && g.round % 5 === 0) { g.phase = 'intermission'; g.sel = 0; return; }
  startRound();
}

function chooseEntity(which) {
  const g = run;
  g.ent[which]++;
  if (which === 'mime' && g.ent.mime === 1) g.mime.x = laneX(g.lane);
  if (which === 'ire' && g.ent.ire === 1) {
    g.ire.state = 'idle'; g.ire.t = rand(3, 5); g.ire.killT = null;
  }
  startRound();
}

/* -------------------------------------------------------------- eggs/combat */
function playerMetrics() {
  const im = img.idle;
  const s = im ? PLAYER_H / im.naturalHeight : 1;
  const dw = im ? im.naturalWidth * s : 30;
  return { dw, dh: PLAYER_H, top: PLAYER_BOTTOM - PLAYER_H };
}
function basketRect(g) {
  const m = playerMetrics();
  const cx = laneX(g.lane);
  return { x: cx - m.dw * 0.35, y: m.top + m.dh * 0.03, w: m.dw * 0.7, h: m.dh * 0.28 }; // basket only
}
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function eggRect(e) { return { x: laneX(e.lane) - EGG_SIZE / 2, y: e.y, w: EGG_SIZE, h: EGG_SIZE }; }

function popup(g, str, color) {
  g.popups.push({ str, color, x: laneX(g.lane), y: PLAYER_BOTTOM - PLAYER_H - 4, t: 0.9 });
}

function hurt(g) {
  if (g.invul > 0) return;
  g.invul = INVULN; g.flash = 0.25;
  g.heartsLost++;
  if (g.mode === 'main' && g.round <= 3) g.hurtEarly = true;
  if (g.over > 0) g.over--; else g.hp--;
  if (g.hp <= 0) gameOver('Out of hearts');
}
function collect(g, e) {
  if (e.rotten) { g.score -= 2000; popup(g, '-2000', '#ff6a6a'); hurt(g); }
  else { g.score += 1000; popup(g, '+1000', '#fff27a'); }
}
function missEgg(g, e) {
  if (e.rotten) { g.score += 1000; popup(g, '+1000', '#9dffb0'); }
  else { g.score -= 2000; popup(g, '-2000', '#ff6a6a'); hurt(g); }
}

function spawnOne(g, avoidLane) {
  let lane = randInt(0, 2);
  if (lane === avoidLane) lane = (lane + randInt(1, 2)) % 3;
  g.eggs.push({ lane, y: -EGG_SIZE - 2, rotten: Math.random() < g.p.rotP });
  g.spawnLeft--;
  return lane;
}
function spawnEggs(g) {
  const first = spawnOne(g, -1);
  if (g.spawnLeft > 0 && Math.random() < g.p.multi) spawnOne(g, first);
}

function stepEggs(g) {
  for (const e of g.eggs) e.y += EGG_PX;
  const b = basketRect(g);
  const keep = [];
  for (const e of g.eggs) {
    if (g.phase !== 'play') break;
    if (overlap(eggRect(e), b)) { collect(g, e); continue; }
    if (e.y >= H) { missEgg(g, e); continue; }
    keep.push(e);
  }
  if (g.phase === 'play') g.eggs = keep;
}
function checkCatchNow(g) {
  const b = basketRect(g);
  g.eggs = g.eggs.filter(e => {
    if (g.phase === 'play' && overlap(eggRect(e), b)) { collect(g, e); return false; }
    return true;
  });
}

/* ----------------------------------------------------------------- entities */
const nearestLane = x => {
  let best = 0, bd = 1e9;
  for (let i = 0; i < 3; i++) { const d = Math.abs(laneX(i) - x); if (d < bd) { bd = d; best = i; } }
  return best;
};
function ireSlow(g) {
  if (g.ent.ire <= 0) return 1;
  const s = g.ire.state;
  if (s === 'semi') return 3;
  if (s === 'mad') return 5;
  return 1;
}
function nextIreWait(g) { return Math.max(3, rand(8, 13) / (1 + 0.35 * (g.ent.ire - 1))); }

function updateMime(g, dt) {
  if (g.ent.mime <= 0) return;
  const target = laneX(g.mimeLane === undefined ? g.lane : g.mimeLane);
  const speed = 6 + 3 * g.ent.mime;             // smooth tween, not teleport
  g.mime.x += (target - g.mime.x) * Math.min(1, dt * speed);
}
function updateIre(g, dt) {
  if (g.ent.ire <= 0) return;
  const I = g.ire;
  switch (I.state) {
    case 'idle':
      I.t -= dt;
      if (I.t <= 0) { I.state = 'spawn'; I.t = 0.5; I.spawnAt = g.time; I.killT = null; }
      break;
    case 'spawn':
      I.t -= dt;
      if (I.t <= 0) { I.state = 'semi'; I.t = 0.63; }
      break;
    case 'semi':
      I.t -= dt;
      if (I.t <= 0) { I.state = 'mad'; I.t = 0; I.killT = null; I.madAt = g.time; }
      break;
    case 'mad':
      I.t += dt;
      if (I.killT !== null) {
        I.killT += dt;
        if (I.killT >= 1.0) { gameOver('Ire caught you moving'); return; }
      } else if (I.t >= 0.25) {                 // stood still long enough
        I.state = 'frown'; I.t = 1.2;
        award('allequal');
        if (I.lastMove > I.spawnAt && I.madAt - I.lastMove < 0.5) award('wakeup');
      }
      break;
    case 'frown':
      I.t -= dt;
      if (I.t <= 0) { I.state = 'idle'; I.t = nextIreWait(g); }
      break;
  }
}

/* ------------------------------------------------------------------ player */
function movePlayer(dir) {
  const g = run;
  if (!g || scene !== 'game' || pauseState !== 0) return;
  if (g.phase !== 'play' && g.phase !== 'banner') return;
  const newLane = (g.lane + dir + 3) % 3;
  const old = g.lane;

  // Mime: moving INTO the lane Mime currently occupies = instant death
  if (g.ent.mime > 0 && g.phase === 'play' && newLane === nearestLane(g.mime.x)) {
    g.lane = newLane; gameOver('Mime got you'); return;
  }
  g.prevLane = old;
  g.lane = newLane;
  g.runT = 0.4;
  if (g.ent.mime > 0) g.mimeLane = old;         // Mime trails one lane behind
  if (g.ent.ire > 0) {
    const I = g.ire;
    I.lastMove = g.time;
    if (I.state === 'mad' && I.killT === null) I.killT = 0; // 1 s until it kills
  }
  checkCatchNow(g);
}

/* ------------------------------------------------------------- game update */
function updateGame(dt) {
  const g = run;
  if (!g) return;
  g.time += dt;
  if (g.invul > 0) g.invul = Math.max(0, g.invul - dt);
  if (g.runT > 0) g.runT -= dt;
  if (g.flash > 0) g.flash -= dt;
  for (const p of g.popups) { p.t -= dt; p.y -= 14 * dt; }
  g.popups = g.popups.filter(p => p.t > 0);

  updateMime(g, dt);
  if (g.phase === 'banner') {
    g.phaseT -= dt;
    if (g.phaseT <= 0) g.phase = 'play';
    return;
  }
  if (g.phase !== 'play') return;

  updateIre(g, dt);
  if (g.phase !== 'play') return;

  const slow = ireSlow(g);
  if (g.spawnLeft > 0) {
    g.spawnTimer -= dt / slow;
    if (g.spawnTimer <= 0) { spawnEggs(g); g.spawnTimer = g.p.gap * rand(0.7, 1.3); }
  }
  g.stepTimer += dt;
  const interval = g.p.interval * slow;
  let guard = 0;
  while (g.stepTimer >= interval && guard++ < 10) {
    g.stepTimer -= interval;
    stepEggs(g);
    if (g.phase !== 'play') return;
  }
  if (g.spawnLeft === 0 && g.eggs.length === 0) roundComplete();
}

/* --------------------------------------------------------------- end states */
function gameOver(reason) {
  const g = run;
  g.phase = 'dead';
  result = { kind: 'over', mode: g.mode, score: g.score, round: g.round, reason };
  hideFx();
  Sound.stopAll();
  Sound.play('over', false);
  endSel = 0;
  setScene('gameover');
}
function victory() {
  const g = run;
  g.phase = 'won';
  result = { kind: 'win', mode: g.mode, score: g.score, round: g.round, reason: '' };
  save.pitAvailable = true; persist();
  hideFx();
  Sound.play('menu');
  endSel = 0;
  setScene('victory');
}
function toMenu() {
  run = null; hideFx();
  setScene('menu');
  Sound.play('menu');
}

/* -------------------------------------------------------------- PIT entry */
function enterPit() {
  Sound.play('pit');
  if (!save.pitEntered) {
    save.pitEntered = true; persist();
    award('decorrupt');
  }
  setScene('pitEntry');
  sceneT = 0.4;
  modeSel = 0;
}

/* ------------------------------------------------------------------- input */
function menuItems() {
  const items = [{ id: 'play', label: 'PLAY' }, { id: 'badges', label: 'BADGES' }];
  if (pitVisible()) items.push({ id: 'pit', label: 'PIT' });
  return items;
}
function activateMenu(id) {
  if (id === 'play') startRun('main');
  else if (id === 'badges') { badgeSel = 0; setScene('badges'); }
  else if (id === 'pit') enterPit();
}
function unlockSound() {
  if (scene !== 'sound') return;
  Sound.unlocked = true;
  setScene('menu');
  Sound.play('menu');
}

function onKey(e) {
  const c = e.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter'].includes(c)) e.preventDefault();

  if (scene === 'sound') { unlockSound(); return; }

  if (scene === 'menu') {
    const items = menuItems();
    if (c === 'ArrowLeft') menuSel = (menuSel + items.length - 1) % items.length;
    else if (c === 'ArrowRight') menuSel = (menuSel + 1) % items.length;
    else if (c === 'Enter') activateMenu(items[menuSel].id);
    else if (c === 'KeyP') { pitForced = true; toast('PIT FORCE-UNLOCKED (TEST)'); }
    return;
  }
  if (scene === 'badges') {
    if (c === 'ArrowLeft') badgeSel = (badgeSel + 7) % 8;
    else if (c === 'ArrowRight') badgeSel = (badgeSel + 1) % 8;
    else if (c === 'ArrowUp') badgeSel = (badgeSel + 4) % 8;
    else if (c === 'ArrowDown') badgeSel = (badgeSel + 4) % 8;
    else if (c === 'Escape' || c === 'Backspace' || c === 'Enter') setScene('menu');
    return;
  }
  if (scene === 'pitSelect') {
    if (c === 'ArrowLeft' || c === 'ArrowRight') modeSel = 1 - modeSel;
    else if (c === 'Enter') startRun(modeSel === 0 ? 'decay' : 'rot');
    else if (c === 'Escape') toMenu();
    return;
  }
  if (scene === 'game') {
    if (pauseState !== 0) return;
    const g = run;
    if (g.phase === 'intermission') {
      if (c === 'ArrowLeft' || c === 'ArrowRight') g.sel = 1 - g.sel;
      else if (c === 'Enter') chooseEntity(g.sel === 0 ? 'mime' : 'ire');
      return;
    }
    if (e.repeat) return;
    if (c === 'ArrowLeft') movePlayer(-1);
    else if (c === 'ArrowRight') movePlayer(1);
    return;
  }
  if (scene === 'gameover') {
    if (c === 'Enter' || c === 'Space') toMenu();
    return;
  }
  if (scene === 'victory') {
    const opts = ['pit', 'menu'];
    if (c === 'ArrowLeft' || c === 'ArrowRight') endSel = 1 - endSel;
    else if (c === 'Enter') { if (opts[endSel] === 'pit') enterPit(); else toMenu(); }
  }
}

function onPointerDown(e) {
  if (scene === 'sound') { unlockSound(); return; }
  const h = hitTest(toLogical(e));
  if (h && h.onClick) h.onClick();
}
function onPointerMove(e) {
  const h = hitTest(toLogical(e));
  canvas.style.cursor = h && h.onClick ? 'pointer' : 'default';
  if (h && h.onHover) h.onHover();
}

/* ---------------------------------------------------------- pause / resume */
function onHidden() {
  Sound.pauseAll();
  if (scene === 'game') { pauseState = 1; countdown = 0; hideFx(); }
}
function onVisible() {
  resetClock = true;
  if (scene === 'game' && pauseState === 1) { pauseState = 2; countdown = 3; }
  else if (pauseState === 0) Sound.resumeAll();
}

/* ------------------------------------------------------------------ update */
function tick(dt) {
  uptime += dt;
  for (const t of toasts) t.t -= dt;
  while (toasts.length && toasts[0].t <= 0) toasts.shift();

  switch (scene) {
    case 'loading':
      if (loadTotal > 0 && loadDone >= loadTotal) {
        loadingFinishedAt += dt;
        if (loadingFinishedAt > 0.5) setScene('sound');
      }
      break;
    case 'pitEntry':
      sceneT -= dt;
      if (sceneT <= 0) setScene('pitSelect');
      break;
    case 'game':
      if (pauseState === 1) return;
      if (pauseState === 2) {
        countdown -= dt;
        if (countdown <= 0) { pauseState = 0; Sound.resumeAll(); }
        return;
      }
      updateGame(dt);
      break;
    default:
      sceneT += dt;
  }
}

/* -------------------------------------------------------------------- draw */
function sway(t, ax, ay, sp = 1) {
  return { x: Math.sin(uptime * 1.3 * sp + t) * ax, y: Math.sin(uptime * 1.9 * sp + t * 2) * ay };
}

function drawLoading() {
  ctx.fillStyle = '#120a1a'; ctx.fillRect(0, 0, W, H);
  text('EGG', W / 2, 40, { size: 28, align: 'center', color: '#ffe9a8' });
  const pct = loadTotal ? loadDone / loadTotal : 0;
  ctx.fillStyle = '#2a1a3a'; ctx.fillRect(50, 110, 220, 12);
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(52, 112, 216 * pct, 8);
  text(`LOADING ${loadDone}/${loadTotal}  (${Math.round(pct * 100)}%)`, W / 2, 130, { size: 7, align: 'center' });
  if (failed.length) text(`${failed.length} FAILED`, W / 2, 146, { size: 7, align: 'center', color: '#ff6a6a' });
}
function drawFailedList(y0) {
  if (!failed.length) return;
  text(`${failed.length} ASSET(S) FAILED TO LOAD:`, W / 2, y0, { size: 6, align: 'center', color: '#ff6a6a' });
  failed.slice(0, 5).forEach((f, i) => {
    const s = f.file.length > 30 ? f.file.slice(0, 29) + '…' : f.file;
    text(`${s} - ${f.msg}`.slice(0, 48), W / 2, y0 + 10 + i * 8, { size: 5, align: 'center', color: '#ffb0b0' });
  });
  if (failed.length > 5) text(`+${failed.length - 5} more (see console)`, W / 2, y0 + 52, { size: 5, align: 'center', color: '#ffb0b0' });
}
function drawSound() {
  ctx.fillStyle = '#120a1a'; ctx.fillRect(0, 0, W, H);
  text('EGG', W / 2, 34, { size: 28, align: 'center', color: '#ffe9a8' });
  const on = Math.floor(uptime * 2) % 2 === 0;
  if (on) text('CLICK / PRESS ANY KEY', W / 2, 92, { size: 8, align: 'center' });
  if (on) text('TO ENABLE SOUND', W / 2, 106, { size: 8, align: 'center' });
  drawFailedList(132);
}

function drawMenu() {
  drawCover('menuBg');
  const im = img.logo;
  const s = sway(0, 5, 3);
  if (im) {
    const lw = 190, lh = lw * im.naturalHeight / im.naturalWidth;
    ctx.drawImage(im, (W - lw) / 2 + s.x, 20 + s.y, lw, lh);
  } else missing('logo', 60, 20, 200, 70);

  const items = menuItems();
  menuSel = clamp(menuSel, 0, items.length - 1);
  const bw = 72, gap = 10, total = items.length * bw + (items.length - 1) * gap;
  items.forEach((it, i) => {
    const x = (W - total) / 2 + i * (bw + gap), y = 140;
    const sel = i === menuSel;
    const sw = sel ? sway(i, 2, 2, 1.6) : { x: 0, y: 0 };
    ctx.fillStyle = sel ? 'rgba(255,233,168,0.92)' : 'rgba(10,5,20,0.7)';
    ctx.fillRect(x + sw.x, y + sw.y, bw, 22);
    ctx.strokeStyle = sel ? '#fff' : '#ffe9a8'; ctx.lineWidth = 1;
    ctx.strokeRect(x + sw.x + .5, y + sw.y + .5, bw - 1, 21);
    text(it.label, x + bw / 2 + sw.x, y + 7 + sw.y, { size: 8, align: 'center', color: sel ? '#2a1a3a' : '#fff', shadow: !sel });
    hot(x, y, bw, 22, () => { menuSel = i; activateMenu(it.id); }, () => { menuSel = i; });
  });
  text('LEFT/RIGHT  ENTER', W / 2, 188, { size: 5, align: 'center', color: '#ffe9a8' });
  if (failed.length) text(`${failed.length} ASSET(S) FAILED - SEE CONSOLE`, 4, 4, { size: 5, color: '#ff6a6a' });
}

function drawBadges() {
  ctx.fillStyle = '#120a1a'; ctx.fillRect(0, 0, W, H);
  const n = Object.keys(save.badges).length;
  text('BADGES', W / 2, 8, { size: 10, align: 'center', color: '#ffe9a8' });
  text(`${n}/${BADGES.length}`, W - 6, 10, { size: 6, align: 'right' });
  const cw = 64, x0 = (W - cw * 4) / 2;
  BADGES.forEach((b, i) => {
    const cx = x0 + (i % 4) * cw, cy = 26 + Math.floor(i / 4) * 54;
    const have = !!save.badges[b.id], sel = i === badgeSel;
    if (sel) { ctx.fillStyle = 'rgba(255,233,168,0.18)'; ctx.fillRect(cx + 2, cy, cw - 4, 50); ctx.strokeStyle = '#ffe9a8'; ctx.strokeRect(cx + 2.5, cy + .5, cw - 5, 49); }
    ctx.save();
    ctx.globalAlpha = have ? 1 : 0.28;
    drawImg('b_' + b.id, cx + (cw - 38) / 2, cy + 5, 38, 38);
    ctx.restore();
    hot(cx, cy, cw, 50, () => { badgeSel = i; }, () => { badgeSel = i; });
  });
  const b = BADGES[badgeSel], have = !!save.badges[b.id];
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(10, 134, W - 20, 58);
  text(have ? b.name : '???', 16, 139, { size: 7, color: '#ffe9a8' });
  const bio = have ? '"' + b.bio + '"' : '???';
  wrap(bio, W - 32, 6).slice(0, 2).forEach((l, i) => text(l, 16, 151 + i * 9, { size: 6 }));
  wrap('UNLOCK: ' + b.unlock, W - 32, 5).slice(0, 2).forEach((l, i) => text(l, 16, 173 + i * 8, { size: 5, color: '#b8a8d8' }));
  text('ESC / ENTER: BACK', W - 6, 192, { size: 5, align: 'right', color: '#ffe9a8' });
  hot(0, 0, 60, 20, () => setScene('menu'));
  text('< BACK', 6, 10, { size: 6, color: '#ffe9a8' });
}

function drawPitEntry() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawContain('hesnt');
}
const REG = {
  decay: { x: 0.12 * W, y: 0.30 * H, w: 0.34 * W, h: 0.48 * H },
  rot:   { x: 0.54 * W, y: 0.30 * H, w: 0.34 * W, h: 0.48 * H }
};
function drawPitSelect() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const im = img.decayRot;
  if (im) ctx.drawImage(im, 0, 0, W, H); else missing('decayRot', 20, 20, W - 40, H - 40);
  [['decay', 0], ['rot', 1]].forEach(([k, i]) => {
    const r = REG[k];
    if (modeSel === i) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.strokeRect(r.x + .5, r.y + .5, r.w, r.h); }
    hot(r.x, r.y, r.w, r.h, () => startRun(k), () => { modeSel = i; });
  });
}

/* ---- gameplay draw ---- */
function drawHeart(x, y, s, fill, outline) {
  const map = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  for (let r = 0; r < map.length; r++) for (let c = 0; c < 7; c++) {
    if (map[r][c] === 'X') { ctx.fillStyle = fill; ctx.fillRect(x + c * s, y + r * s, s, s); }
  }
  if (outline) {
    ctx.strokeStyle = outline; ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, 7 * s, 6 * s);
  }
}
function drawHud(g) {
  text('SCORE ' + g.score, 5, 4, { size: 6 });
  const label = g.mode === 'main' ? `ROUND ${g.round}/10` : `${g.mode === 'rot' ? 'roT' : 'DECAY'} ${g.round}`;
  text(label, W - 5, 4, { size: 6, align: 'right' });
  for (let i = 0; i < 3; i++) {
    if (i < g.hp) drawHeart(5 + i * 12, 15, 1.4, '#ff4a5a');
    else drawHeart(5 + i * 12, 15, 1.4, '#2a1218', '#7a2a35');
  }
  for (let i = 0; i < g.over; i++) drawHeart(44 + i * 8, 17, 0.9, '#4aa8ff');
}
function drawPlayer(g) {
  if (g.invul > 0 && Math.floor(g.invul * 12) % 2 === 0) return; // blink
  const key = g.runT > 0 ? 'run' : 'idle';
  const im = img[key];
  const x = laneX(g.lane);
  if (!im) { missing(key, x - 15, PLAYER_BOTTOM - PLAYER_H, 30, PLAYER_H); return; }
  const s = PLAYER_H / im.naturalHeight;
  const w = im.naturalWidth * s;
  ctx.drawImage(im, x - w / 2, PLAYER_BOTTOM - PLAYER_H, w, PLAYER_H);
}
function drawEggs(g) {
  for (const e of g.eggs) {
    const x = laneX(e.lane) - EGG_SIZE / 2, y = e.y;
    ctx.fillStyle = e.rotten ? '#e8e8e8' : '#161616';       // outline (cosmetic only)
    ctx.fillRect(x - 1, y - 1, EGG_SIZE + 2, EGG_SIZE + 2);
    ctx.fillStyle = e.rotten ? '#0a0a0a' : '#ffffff';       // the real 4x4 egg
    ctx.fillRect(x, y, EGG_SIZE, EGG_SIZE);
  }
}
function drawGame() {
  const g = run;
  if (g.mode === 'main') {
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#5f8a62'); gr.addColorStop(1, '#3f6a4d');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  } else {
    drawCover('pitBg');
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(i * W / 3, 0, W / 3, H);
  }
  // scanline-ish floor
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, PLAYER_BOTTOM + 1, W, H - PLAYER_BOTTOM);

  drawEggs(g);
  drawPlayer(g);

  // entity placeholders for failed GIFs (never silently swapped)
  if (g.ent.mime > 0 && !img.mime) missing('mime', g.mime.x - 15, PLAYER_BOTTOM - 40, 30, 40);
  if (g.ent.ire > 0 && g.ire.state !== 'idle' && !img.ireAppear) missing('ireAppear', W / 2 - 40, 4, 80, 60);

  if (g.ent.ire > 0 && g.ire.state === 'mad') {
    ctx.fillStyle = `rgba(200,0,0,${0.12 + 0.06 * Math.sin(uptime * 20)})`; ctx.fillRect(0, 0, W, H);
  }
  for (const p of g.popups) text(p.str, p.x, p.y, { size: 6, align: 'center', color: p.color });
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,0,0,${g.flash * 1.2})`; ctx.fillRect(0, 0, W, H); }
  drawHud(g);

  if (g.phase === 'banner') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 70, W, 44);
    const t = g.mode === 'main' ? `ROUND ${g.round}` : `ROUND ${g.round}`;
    text(t, W / 2, 86, { size: 14, align: 'center', color: '#ffe9a8' });
  }
  if (g.phase === 'intermission') drawIntermission(g);
}
function drawIntermission(g) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
  text('INTERMISSION', W / 2, 24, { size: 12, align: 'center', color: '#ff6a6a' });
  text('PICK AN ENTITY', W / 2, 46, { size: 7, align: 'center' });
  [['mime', 'MIME'], ['ire', 'IRE']].forEach(([k, label], i) => {
    const x = 40 + i * 130, y = 70, w = 110, h = 64, sel = g.sel === i;
    ctx.fillStyle = sel ? 'rgba(255,233,168,0.92)' : 'rgba(30,10,30,0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = sel ? '#fff' : '#a85'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    text(label, x + w / 2, y + 14, { size: 11, align: 'center', color: sel ? '#2a1a3a' : '#fff', shadow: !sel });
    text(g.ent[k] > 0 ? `LEVEL ${g.ent[k]} > ${g.ent[k] + 1}` : 'NEW', x + w / 2, y + 40, { size: 6, align: 'center', color: sel ? '#2a1a3a' : '#ffe9a8', shadow: !sel });
    hot(x, y, w, h, () => chooseEntity(k), () => { g.sel = i; });
  });
  text('LEFT/RIGHT  ENTER', W / 2, 160, { size: 6, align: 'center', color: '#b8a8d8' });
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  if (pauseState === 1) {
    text('PAUSED', W / 2, 84, { size: 14, align: 'center' });
  } else {
    text('GET READY', W / 2, 62, { size: 9, align: 'center', color: '#ffe9a8' });
    text(String(Math.max(1, Math.ceil(countdown))), W / 2, 86, { size: 28, align: 'center' });
  }
}

function drawEnd() {
  const win = result.kind === 'win';
  ctx.fillStyle = win ? '#16301f' : '#2a0a0a'; ctx.fillRect(0, 0, W, H);
  text(win ? 'YOU WIN' : 'GAME OVER', W / 2, 24, { size: 16, align: 'center', color: win ? '#9dffb0' : '#ff6a6a' });
  const modeName = result.mode === 'main' ? 'MAIN GAME' : result.mode === 'rot' ? 'PIT - roT' : 'PIT - DECAY';
  text(modeName, W / 2, 52, { size: 6, align: 'center', color: '#b8a8d8' });
  text('FINAL SCORE', W / 2, 74, { size: 7, align: 'center' });
  text(String(result.score), W / 2, 88, { size: 14, align: 'center', color: '#ffe9a8' });
  text(win ? 'ALL 10 ROUNDS CLEARED' : `ROUNDS REACHED: ${result.round}`, W / 2, 114, { size: 7, align: 'center' });
  if (!win && result.reason) text(result.reason.toUpperCase(), W / 2, 130, { size: 5, align: 'center', color: '#ffb0b0' });
  if (!win) {
    text('PRESS ENTER', W / 2, 168, { size: 7, align: 'center', color: '#ffe9a8' });
    hot(0, 0, W, H, () => toMenu());
  } else {
    [['ENTER THE PIT', 'pit'], ['MENU', 'menu']].forEach(([label, k], i) => {
      const x = 40 + i * 130, y = 150, w = 110, h = 24, sel = endSel === i;
      ctx.fillStyle = sel ? 'rgba(255,233,168,0.92)' : 'rgba(10,5,20,0.7)'; ctx.fillRect(x, y, w, h);
      text(label, x + w / 2, y + 8, { size: 6, align: 'center', color: sel ? '#2a1a3a' : '#fff', shadow: !sel });
      hot(x, y, w, h, () => { if (k === 'pit') enterPit(); else toMenu(); }, () => { endSel = i; });
    });
  }
}

function drawToasts() {
  toasts.slice(0, 2).forEach((t, i) => {
    const y = 4 + i * 22, a = clamp(t.t, 0, 0.4) / 0.4;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(W / 2 - 100, y, 200, 20);
    ctx.strokeStyle = '#ffe9a8'; ctx.strokeRect(W / 2 - 99.5, y + .5, 199, 19);
    if (t.imgKey) { const im = img[t.imgKey]; if (im) ctx.drawImage(im, W / 2 - 96, y + 2, 16, 16); }
    text(t.text.length > 28 ? t.text.slice(0, 27) + '…' : t.text, W / 2 - (t.imgKey ? 76 : 0), y + 7, { size: 6, align: t.imgKey ? 'left' : 'center', color: '#ffe9a8' });
    ctx.globalAlpha = 1;
  });
}

/* DOM overlays (GIFs) */
function hideFx() { mimeEl.style.display = 'none'; ireEl.style.display = 'none'; }
function setSrc(el, key) {
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  if (img[key]) el.src = img[key].src; else el.removeAttribute('src');
}
function syncFx() {
  const g = run;
  const live = scene === 'game' && g && pauseState !== 1 && g.phase !== 'dead';
  if (!live) { hideFx(); return; }

  if (g.ent.mime > 0 && img.mime) {
    setSrc(mimeEl, 'mime');
    mimeEl.style.display = 'block';
    mimeEl.style.left = (g.mime.x / W * 100) + '%';
  } else mimeEl.style.display = 'none';

  if (g.ent.ire > 0 && g.ire.state !== 'idle') {
    const key = { spawn: 'ireAppear', semi: 'ireAttack', mad: 'ireActive', frown: 'ireFrown' }[g.ire.state];
    if (img[key]) { setSrc(ireEl, key); ireEl.style.display = 'block'; }
    else ireEl.style.display = 'none';
  } else { ireEl.style.display = 'none'; ireEl.dataset.k = ''; }
}

function draw() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  hotspots = [];

  switch (scene) {
    case 'loading': drawLoading(); break;
    case 'sound': drawSound(); break;
    case 'menu': drawMenu(); break;
    case 'badges': drawBadges(); break;
    case 'pitEntry': drawPitEntry(); break;
    case 'pitSelect': drawPitSelect(); break;
    case 'game': drawGame(); if (pauseState !== 0) drawPauseOverlay(); break;
    case 'gameover':
    case 'victory': drawEnd(); break;
  }
  drawToasts();
  syncFx();
}

/* -------------------------------------------------------------------- loop */
let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000;
  let dt = t - last; last = t;
  if (resetClock) { dt = 0; resetClock = false; }
  dt = clamp(dt, 0, 0.25);
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }
  draw();
}

/* -------------------------------------------------------------------- init */
function init() {
  // Listeners are attached exactly once. Restarting a run never re-adds them.
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  document.addEventListener('visibilitychange', () => { document.hidden ? onHidden() : onVisible(); });
  window.addEventListener('blur', onHidden);
  window.addEventListener('focus', () => { if (!document.hidden) onVisible(); });
  window.addEventListener('error', e => console.error('[EGG] uncaught:', e.message));

  preloadAll().catch(e => console.error('[EGG] preload crashed:', e));
  requestAnimationFrame(frame);
}
init();

})();

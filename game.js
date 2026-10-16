/* ===========================================================
   EGG — weird old-school arcade game
   Assets: https://github.com/elaprogect-rgb/ch  (via jsDelivr)
   Design notes / assumptions are marked with  // NOTE:
   =========================================================== */
(() => {
'use strict';

/* ---------------------------------------------------------- *
 * 1. CONFIG & ASSET MANIFEST  (fix file names HERE if needed)
 * ---------------------------------------------------------- */
const CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';

const FILES = {
  img: {
    logo: 'EGG_Logo.webp', bg: 'Bg_minigolf2_0.webp', pitBg: 'OIP (7).webp',
    idle: 'EGG_CharlesIdle.png', run: 'EGG_CharlesRun.png',
    hesNotHere: 'HESNOTHEREBUTiAM.png', decayRot: 'DECAY_ROT_screen.png',
    mime: 'MimeHand.gif',
    ireAppear: 'Ire_appear.gif', ireAttack: 'Ire_attack.gif',
    ireActive: 'Ire_active.gif', ireFrown: 'Ire_Frown_Animated.gif',
    badge_hardstuck: 'Hardstuck_Badge.png', badge_winner: 'Winner_Badge.png',
    badge_winnerwinner: 'Winner_Winner_Badge.png', badge_battler: 'Battler_Badge.png',
    badge_handsoff: 'HANDSOFF_Badge.png', badge_wakeupcall: 'WAKEUPCALL_Badge.png',
    badge_allequal: 'All_equal_Badge.png', badge_decorrupt: 'DECORRUPT__(Y-N)_Badge.png',
  },
  aud: {
    menu: 'Incubating.mp3', game: 'Cracked-AllInstruments.mp3',
    over: 'Scrambled.mp3', pit: 'The_Pit.mp3.mpeg',
  },
};

const BADGES = [
  { id: 'hardstuck',  name: 'Hardstuck',  bio: 'You do nothing but cheat! Cheat i say!', unlock: 'Reach round 50 in the PIT' },
  { id: 'winner',     name: 'Winner Winner Chicken Dinner!', bio: 'Winner Winner Chicken Dinner!', unlock: 'Beat 3 rounds for the first time' },
  { id: 'winnerwinner', name: 'Winner Winner', bio: "You're a loser who sits and crys!", unlock: 'Beat 3 rounds without losing a single heart' },
  { id: 'battler',    name: 'Battler',    bio: 'You cheated. No other words.', unlock: 'Survive 20 rounds without losing a heart (PIT)' },
  { id: 'handsoff',   name: 'HANDSOFF',   bio: 'IT JUST MAKES YOU HAPPY!', unlock: 'Survive Mime for the first time' },
  { id: 'wakeupcall', name: 'WAKEUPCALL', bio: 'YOU JUST LIVE ON AND ON.', unlock: 'Survive Ire with < 0.5 s left before attack state' },
  { id: 'allequal',   name: 'All equal',  bio: 'WONDERFUL!', unlock: 'Survive Ire for the first time' },
  { id: 'decorrupt',  name: 'DECORRUPT (Y-N)', bio: 'YOU_ARE_JUST_GETTING_STARTED.', unlock: 'Enter the PIT for the first time' },
];

const STAGE_W = 180, STAGE_H = 270;
const LANES = [30, 90, 150];            // lane centre x
const EGG_SIZE = 4, EGG_STEP = 7, EGG_TICK = 0.07; // 7px every 0.07s (fixed timestep)
const INVULN = 1.5, RUN_TIME = 0.4, PLAYER_W = 40;
const SAVE_KEY = 'egg_save_v1';

/* ---------------------------------------------------------- *
 * 2. SMALL HELPERS
 * ---------------------------------------------------------- */
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const url = f => CDN + encodeURIComponent(f);
const fmt = n => n.toLocaleString('en-US');

/* ---------------------------------------------------------- *
 * 3. SAVE DATA
 * ---------------------------------------------------------- */
let save = { badges: {}, pitUnlocked: false, pitEntered: false, bestMain: 0, bestPit: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { console.warn('[EGG] save load failed', e); }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { console.warn('[EGG] save failed', e); } }

function awardBadge(id) {
  if (save.badges[id]) return;                  // never duplicate
  save.badges[id] = Date.now(); persist();
  const b = BADGES.find(x => x.id === id);
  const d = document.createElement('div'); d.className = 'toast';
  d.append(imgEl('badge_' + id));
  const t = document.createElement('div');
  const n = document.createElement('b'); n.textContent = 'BADGE: ' + b.name;
  const i = document.createElement('i'); i.textContent = '"' + b.bio + '"';
  t.append(n, document.createElement('br'), i); d.append(t);
  d.addEventListener('animationend', () => d.remove());
  $('toasts').append(d);
}

/* ---------------------------------------------------------- *
 * 4. ASSETS: PRELOAD + ELEMENT FACTORIES
 * ---------------------------------------------------------- */
const A = { img: {}, aud: {}, failed: new Map(), file: {}, kind: {} };

function preloadAll(onProgress) {
  const jobs = [];
  for (const [k, f] of Object.entries(FILES.img)) jobs.push({ k, f, kind: 'img' });
  for (const [k, f] of Object.entries(FILES.aud)) jobs.push({ k, f, kind: 'aud' });
  let done = 0;
  return Promise.all(jobs.map(({ k, f, kind }) => new Promise(resolve => {
    A.file[k] = f; A.kind[k] = kind;
    let finished = false;
    const finish = (ok, why) => {
      if (finished) return; finished = true; done++;
      if (!ok) { A.failed.set(k, why); console.error(`[EGG] asset "${f}" (${url(f)}) ${why}`); }
      onProgress(done, jobs.length, f, ok, why); resolve();
    };
    if (kind === 'img') {
      const im = new Image(); A.img[k] = im;
      im.onload = () => finish(true); im.onerror = () => finish(false, 'failed to load');
      im.src = url(f);
    } else {
      const a = new Audio(); A.aud[k] = a; a.preload = 'auto';
      a.addEventListener('canplaythrough', () => finish(true), { once: true });
      a.addEventListener('loadeddata', () => finish(true), { once: true });
      a.addEventListener('error', () => finish(false, 'failed to load'), { once: true });
      setTimeout(() => finish(false, 'timed out (may still work)'), 20000);
      a.src = url(f); a.load();
    }
  })));
}

// Never silently swap in a fake asset: failed images become a loud magenta box with the file name.
function imgEl(key, cls = '') {
  if (A.failed.has(key) && A.kind[key] === 'img') {
    const d = document.createElement('div'); d.className = 'missing ' + cls;
    d.textContent = 'MISSING\n' + A.file[key]; return d;
  }
  const i = document.createElement('img'); i.className = cls; i.alt = ''; i.draggable = false; i.src = url(A.file[key]); return i;
}
function setBg(el, key) {
  if (A.failed.has(key)) { el.style.backgroundImage = 'repeating-linear-gradient(45deg,#f0f,#f0f 12px,#000 12px,#000 24px)'; return; }
  el.style.backgroundImage = `url("${url(A.file[key])}")`;
}

/* ---------------------------------------------------------- *
 * 5. AUDIO
 * ---------------------------------------------------------- */
const Snd = { enabled: false, current: null, warned: false };
function stopMusic() {
  for (const a of Object.values(A.aud)) { try { a.pause(); a.currentTime = 0; } catch (e) {} }
  Snd.current = null;
}
function playMusic(key, loop) {
  stopMusic();
  const a = A.aud[key]; Snd.current = key;
  if (!a || A.failed.has(key) || !Snd.enabled) return;
  a.loop = loop; a.currentTime = 0;
  const p = a.play();
  if (p && p.catch) p.catch(e => { if (!Snd.warned) { Snd.warned = true; console.warn('[EGG] audio play blocked/failed', e); } });
}
function pauseAudio() { for (const a of Object.values(A.aud)) { try { a.pause(); } catch (e) {} } }
function resumeAudio() {
  if (!Snd.enabled || !Snd.current) return;
  const a = A.aud[Snd.current]; if (!a || A.failed.has(Snd.current) || a.ended) return;
  const p = a.play(); if (p && p.catch) p.catch(() => {});
}

/* ---------------------------------------------------------- *
 * 6. SCREENS
 * ---------------------------------------------------------- */
const FULL = ['loading', 'soundgate', 'menu', 'badges', 'hesnothere', 'decayrot'];
let screen = 'loading';
const stage = $('stage'), field = $('field');

function setScreen(name) {
  screen = name;
  for (const id of FULL) $(id).classList.toggle('hidden', id !== name);
  stage.classList.toggle('hidden', name !== 'game');
  if (name !== 'game') { $('pick').classList.add('hidden'); $('endScreen').classList.add('hidden'); }
  $('countdown').classList.add('hidden');
}
function resize() {
  const s = Math.min(innerWidth / (STAGE_W + 16), innerHeight / (STAGE_H + 16));
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
}
addEventListener('resize', resize);

/* ---------------------------------------------------------- *
 * 7. GAME-TIME SCHEDULER (freezes while paused; cleared on reset)
 * ---------------------------------------------------------- */
let timers = [];
const after = (sec, fn) => timers.push({ t: sec, fn });
const clearTimers = () => { timers = []; };
function tickTimers(dt) {
  for (const T of timers) T.t -= dt;
  const due = timers.filter(T => T.t <= 0);
  timers = timers.filter(T => T.t > 0);
  due.forEach(T => T.fn());
}

/* ---------------------------------------------------------- *
 * 8. MENU / BADGES
 * ---------------------------------------------------------- */
let menuIndex = 0;
const menuActs = () => ['play', 'badges'].concat(save.pitEntered || save.pitUnlocked ? ['pit'] : []);
function renderMenu() {
  const acts = menuActs(); if (menuIndex >= acts.length) menuIndex = 0;
  const box = $('menuItems'); box.innerHTML = '';
  acts.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = 'menuItem' + (i === menuIndex ? ' sel' : '');
    b.dataset.act = a; b.dataset.i = i; b.textContent = a === 'pit' ? 'PIT' : a;
    box.append(b);
  });
}
function markMenuSel() { [...$('menuItems').children].forEach((b, i) => b.classList.toggle('sel', i === menuIndex)); }
$('menuItems').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) { menuIndex = +b.dataset.i; confirmMenu(); } });
$('menuItems').addEventListener('mouseover', e => { const b = e.target.closest('[data-act]'); if (b && +b.dataset.i !== menuIndex) { menuIndex = +b.dataset.i; markMenuSel(); } });

function confirmMenu() {
  const a = menuActs()[menuIndex];
  if (a === 'play') startRun('main', null);
  else if (a === 'badges') openBadges();
  else if (a === 'pit') enterPit();
}
function showMenu() {
  cleanupRun(); clearTimers();
  setScreen('menu'); renderMenu();
  if (Snd.current !== 'menu') playMusic('menu', true);
}
function openBadges() {
  const g = $('badgeGrid'); g.innerHTML = '';
  for (const b of BADGES) {
    const got = !!save.badges[b.id];
    const d = document.createElement('div'); d.className = 'badge ' + (got ? 'got' : 'locked');
    d.append(imgEl('badge_' + b.id));
    const t = document.createElement('div');
    const n = document.createElement('b'); n.textContent = got ? b.name : '???';
    const i = document.createElement('i'); i.textContent = got ? '"' + b.bio + '"' : '';
    const s = document.createElement('small'); s.textContent = b.unlock;
    t.append(n, i, s); d.append(t); g.append(d);
  }
  setScreen('badges');
}
$('badgeBack').addEventListener('click', showMenu);

/* ---------------------------------------------------------- *
 * 9. RUN STATE  (main game and PIT use separate run objects)
 * ---------------------------------------------------------- */
let run = null;

function newRun(mode, variant) {
  return {
    mode, variant,                    // 'main' | 'pit' ; null | 'decay' | 'rot'
    score: 0, round: 0, hearts: 3, overheal: 0, heartsLost: 0,
    lane: 1, prevLane: 1, runT: 0, invuln: 0, lastMoveAt: -99, time: 0,
    eggs: [], total: 0, spawned: 0, spawnT: 0, tickAcc: 0,
    phase: 'intro', phaseT: 0, deadT: 0,
    entity: null, mime: null, ire: null,
    el: {}, pTop: 0, pH: 48,
  };
}

function cleanupRun() {
  run = null; field.innerHTML = ''; $('banner').textContent = '';
  $('pick').classList.add('hidden'); $('endScreen').classList.add('hidden');
  clearTimers();
}

function startRun(mode, variant) {
  cleanupRun();
  run = newRun(mode, variant);
  setBg(stage, mode === 'pit' ? 'pitBg' : 'bg');
  // player
  const nat = A.img.idle;
  run.pH = nat && nat.naturalWidth ? PLAYER_W * nat.naturalHeight / nat.naturalWidth : 48;
  run.pTop = STAGE_H - run.pH - 4;
  const p = document.createElement('div'); p.className = 'player';
  p.style.top = run.pTop + 'px';
  run.el.idle = imgEl('idle'); run.el.run = imgEl('run'); run.el.run.style.display = 'none';
  p.append(run.el.idle, run.el.run); field.append(p); run.el.player = p;
  placePlayer();
  setScreen('game'); resize();
  playMusic(mode === 'pit' ? 'pit' : 'game', true);
  beginRound();
}

function placePlayer() { run.el.player.style.left = (LANES[run.lane] - PLAYER_W / 2) + 'px'; }

function hudUpdate() {
  const r = run; if (!r) return;
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += `<span class="h${i < r.hearts ? '' : ' off'}">&#9829;</span>`;
  for (let i = 0; i < r.overheal; i++) hearts += '<span class="h oh">&#9829;</span>';
  const tag = r.mode === 'pit' ? `PIT:${r.variant === 'rot' ? 'roT' : 'Decay'}` : 'EGG';
  $('hud').innerHTML =
    `<div class="hudRow"><span>${tag}</span><span>ROUND ${r.round}${r.mode === 'main' ? '/10' : ''}</span></div>` +
    `<div class="hudRow"><span>${fmt(r.score)}</span><span>${hearts}</span></div>`;
}

/* ---------- difficulty ---------- */
function diff(r) { return r.mode === 'main' ? r.round : Math.min(r.round, r.variant === 'decay' ? 15 : 30); }
function speedMult(r) { const d = diff(r); let m = 1 + 0.07 * (d - 1); if (r.variant === 'rot') m *= 1.25; return m; }
function spawnGap(r) {
  const d = diff(r); let g = Math.max(0.28, 1.15 - 0.055 * (d - 1));
  if (r.variant === 'rot') g = Math.max(0.2, g * 0.6); return g;
}
function rottenChance(r) {
  if (r.round < 2) return 0;                          // rotten eggs begin in round 2, no tutorial
  const d = diff(r);
  if (r.mode === 'main') return Math.min(0.4, 0.15 + 0.025 * (d - 1));
  return r.variant === 'rot' ? Math.min(0.7, 0.3 + 0.02 * d) : Math.min(0.5, 0.2 + 0.02 * d);
}

/* ---------- rounds ---------- */
function beginRound() {
  const r = run; r.round++;
  if (r.mode === 'pit' && r.round >= 50) awardBadge('hardstuck');
  if (r.mode === 'main' && r.round > 1) {            // restore a heart / grant overheal (main only)
    if (r.hearts < 3) r.hearts++; else if (r.overheal < 6) r.overheal++;
  }
  r.total = (r.mode === 'main' && r.round <= 3) ? rnd(5, 10) : rnd(15, 25);
  r.spawned = 0; r.spawnT = 0.6; r.tickAcc = 0;
  r.eggs.forEach(e => e.el.remove()); r.eggs = [];
  if (r.ire) ireSet('wait', 3 + Math.random() * 3);
  hudUpdate();
  if (r.mode === 'pit' && r.variant === 'rot' && r.round % 5 === 0) {   // roT intermission
    r.phase = 'pick'; pickIdx = 0; markPick(); $('pick').classList.remove('hidden'); return;
  }
  r.phase = 'intro'; r.phaseT = 1.2; $('banner').textContent = 'ROUND ' + r.round;
}

function endRound() {
  const r = run;
  if (r.mode === 'main') {
    if (r.round === 3) { awardBadge('winner'); if (r.heartsLost === 0) awardBadge('winnerwinner'); }
  } else if (r.round === 20 && r.heartsLost === 0) awardBadge('battler');
  if (r.entity === 'mime') awardBadge('handsoff');   // NOTE: "survive Mime" = clear a round with Mime active
  if (r.mode === 'main' && r.round >= 10) return victory();
  r.phase = 'between'; r.phaseT = 0.9; $('banner').textContent = 'CLEAR!';
}

function hit() {
  const r = run; if (r.invuln > 0) return;
  r.invuln = INVULN; r.heartsLost++;
  if (r.overheal > 0) r.overheal--; else r.hearts--;
  hudUpdate();
  if (r.hearts <= 0) die('health');
}

function die() {
  const r = run; if (!r || r.phase === 'dead' || r.phase === 'won') return;
  r.phase = 'dead'; r.deadT = 0; $('banner').textContent = '';
  stopMusic(); playMusic('over', false);               // stop everything, play Scrambled
  if (r.mode === 'main') save.bestMain = Math.max(save.bestMain, r.score); else save.bestPit = Math.max(save.bestPit, r.round);
  persist();
  showEnd('GAME OVER', `Final score: ${fmt(r.score)}\nRounds reached: ${r.round}${r.mode === 'main' ? ' / 10' : ''}`);
}
function victory() {
  const r = run; r.phase = 'won'; r.deadT = 0;
  save.pitUnlocked = true; save.bestMain = Math.max(save.bestMain, r.score); persist();
  stopMusic(); playMusic('menu', true);
  showEnd('YOU WIN', `Final score: ${fmt(r.score)}\nRounds: 10 / 10\nSomething opened below...`);
}
function showEnd(title, lines) {
  $('endTitle').textContent = title; $('endLines').style.whiteSpace = 'pre-line'; $('endLines').textContent = lines;
  $('endScreen').classList.remove('hidden');
}
$('endScreen').addEventListener('click', () => { if (run && (run.phase === 'dead' || run.phase === 'won') && run.deadT > 0.8) showMenu(); });

/* ---------- eggs ---------- */
function spawnEgg() {
  const r = run, rotten = Math.random() < rottenChance(r);
  const lane = rnd(0, 2);
  const el = document.createElement('div'); el.className = 'egg' + (rotten ? ' rotten' : '');
  const e = { lane, x: LANES[lane], y: -8, rotten, el };   // spawns above the visible area
  el.style.transform = `translate(${e.x - EGG_SIZE / 2}px,${e.y}px)`;
  field.append(el); r.eggs.push(e); r.spawned++;
}
function hitbox() {                                     // basket only: top 30% of sprite, 68% of its width
  const x = LANES[run.lane];
  return { l: x - PLAYER_W * 0.34, r: x + PLAYER_W * 0.34, t: run.pTop, b: run.pTop + run.pH * 0.30 };
}
function stepEggs() {
  const r = run, hb = hitbox();
  for (const e of r.eggs) {
    e.y += EGG_STEP;
    const l = e.x - EGG_SIZE / 2, rr = l + EGG_SIZE, t = e.y, b = e.y + EGG_SIZE;
    if (rr > hb.l && l < hb.r && b > hb.t && t < hb.b) {      // caught
      e.gone = true;
      if (e.rotten) { r.score -= 2000; hit(); } else r.score += 1000;
    } else if (e.y >= STAGE_H) {                              // missed
      e.gone = true;
      if (e.rotten) r.score += 1000; else { r.score -= 2000; hit(); }
    } else e.el.style.transform = `translate(${l}px,${e.y}px)`;
    if (!run || run.phase === 'dead') return;
  }
  r.eggs = r.eggs.filter(e => { if (e.gone) e.el.remove(); return !e.gone; });
  hudUpdate();
}

/* ---------- movement ---------- */
function movePlayer(dir) {
  const r = run; if (!r || (r.phase !== 'playing' && r.phase !== 'intro')) return;
  const nl = (r.lane + dir + 3) % 3, playing = r.phase === 'playing';
  if (playing && r.entity === 'mime' && nl === mimeOcc()) return die('mime');   // instant death
  r.prevLane = r.lane; r.lane = nl; r.runT = RUN_TIME; r.lastMoveAt = r.time;
  if (playing && r.entity === 'mime') r.mime.target = r.prevLane;
  if (playing && r.ire && r.ire.state === 'mad' && !r.ire.doomed) { r.ire.doomed = true; r.ire.killT = 1; }
  placePlayer();
}

/* ---------- entities ---------- */
function setEntity(name) {
  const r = run;
  if (r.mime) { r.mime.el.remove(); r.mime = null; }
  if (r.ire) { r.ire.el.remove(); r.ire = null; }
  r.entity = name;
  if (name === 'mime') {
    let l = rnd(0, 2); if (l === r.lane) l = (l + 1) % 3;
    const el = imgEl('mime', 'mime'); el.className += ' mime';
    el.style.top = (r.pTop + r.pH * 0.15) + 'px';
    r.mime = { el, x: LANES[l], target: l };
    el.style.left = (r.mime.x - 22) + 'px'; field.append(el);
  } else if (name === 'ire') {
    const el = document.createElement('div'); el.className = 'ire'; field.append(el);
    r.ire = { el, state: 'wait', t: 3 + Math.random() * 3, stillT: 0, doomed: false, killT: 0, madAt: 0 };
    ireSet('wait', r.ire.t);
  }
}
function mimeOcc() {                                     // lane the Mime currently occupies
  const x = run.mime.x; let best = 0;
  LANES.forEach((lx, i) => { if (Math.abs(lx - x) < Math.abs(LANES[best] - x)) best = i; });
  return best;
}
const IRE_IMG = { appear: 'ireAppear', semi: 'ireAttack', mad: 'ireActive', frown: 'ireFrown' };
function ireSet(state, t) {
  const ire = run.ire; ire.state = state; ire.t = t;
  ire.el.replaceChildren();                              // fresh <img> so the GIF restarts
  if (state === 'wait') { ire.el.style.display = 'none'; return; }
  ire.el.style.display = 'block'; ire.el.append(imgEl(IRE_IMG[state]));
}
function ireSlow() { const s = run.ire && run.ire.state; return s === 'semi' ? 0.35 : s === 'mad' ? 0.15 : 1; }
const ireBusy = () => run.ire && ['appear', 'semi', 'mad'].includes(run.ire.state);
function updateIre(dt) {
  const r = run, ire = r.ire;
  switch (ire.state) {
    case 'wait':   ire.t -= dt; if (ire.t <= 0) ireSet('appear', 1.8); break;       // cannot kill
    case 'appear': ire.t -= dt; if (ire.t <= 0) ireSet('semi', 3 + Math.random() * 2); break; // slows eggs, cannot kill
    case 'semi':   ire.t -= dt; if (ire.t <= 0) { ireSet('mad', 0); ire.stillT = 0; ire.doomed = false; ire.madAt = r.time; } break;
    case 'mad':
      if (ire.doomed) { ire.killT -= dt; if (ire.killT <= 0) die('ire'); }          // moved -> dead after 1s
      else { ire.stillT += dt; if (ire.stillT >= 0.25) ireSurvive(); }
      break;
    case 'frown':  ire.t -= dt; if (ire.t <= 0) ireSet('wait', 3 + Math.random() * 3); break;
  }
}
function ireSurvive() {
  const r = run, ire = r.ire;
  awardBadge('allequal');
  // NOTE: "< 0.5s left before attack state": the player's last move happened less than 0.5s before mad began.
  if (ire.madAt - r.lastMoveAt < 0.5) awardBadge('wakeupcall');
  ireSet('frown', 1.2);
}

/* ---------- pick (roT intermission) ---------- */
let pickIdx = 0;
const PICKS = ['mime', 'ire'];
function markPick() { [...$('pickItems').children].forEach((b, i) => b.classList.toggle('sel', i === pickIdx)); }
function confirmPick() {
  if (!run || run.phase !== 'pick') return;
  setEntity(PICKS[pickIdx]); $('pick').classList.add('hidden');
  run.phase = 'intro'; run.phaseT = 1.2; $('banner').textContent = 'ROUND ' + run.round;
}
$('pickItems').addEventListener('click', e => { const b = e.target.closest('[data-ent]'); if (b) { pickIdx = PICKS.indexOf(b.dataset.ent); markPick(); confirmPick(); } });
$('pickItems').addEventListener('mouseover', e => { const b = e.target.closest('[data-ent]'); if (b) { pickIdx = PICKS.indexOf(b.dataset.ent); markPick(); } });

/* ---------- PIT entry ---------- */
function enterPit() {
  stopMusic(); clearTimers();
  save.pitEntered = true; save.pitUnlocked = true; persist();
  awardBadge('decorrupt');
  const h = $('hesnothere'); h.innerHTML = ''; h.append(imgEl('hesNotHere'));
  setScreen('hesnothere');
  after(0.4, () => {
    const box = $('drImg'); box.innerHTML = ''; box.append(imgEl('decayRot'));
    setScreen('decayrot');
  });
}
$('pickDecay').addEventListener('click', () => { if (screen === 'decayrot') startRun('pit', 'decay'); });
$('pickRot').addEventListener('click', () => { if (screen === 'decayrot') startRun('pit', 'rot'); });

/* ---------------------------------------------------------- *
 * 10. UPDATE LOOP
 * ---------------------------------------------------------- */
function updateRun(dt) {
  const r = run; r.time += dt;
  if (r.runT > 0) r.runT -= dt;
  r.el.idle.style.display = r.runT > 0 ? 'none' : '';
  r.el.run.style.display = r.runT > 0 ? '' : 'none';
  if (r.invuln > 0) r.invuln -= dt;
  r.el.player.classList.toggle('blinking', r.invuln > 0);
  if (r.mime) { r.mime.x += (LANES[r.mime.target] - r.mime.x) * Math.min(1, dt * 6); r.mime.el.style.left = (r.mime.x - 22) + 'px'; }
  const hb = hitbox(), hx = $('hitbox');
  hx.style.left = hb.l + 'px'; hx.style.top = hb.t + 'px'; hx.style.width = (hb.r - hb.l) + 'px'; hx.style.height = (hb.b - hb.t) + 'px';

  switch (r.phase) {
    case 'intro':   r.phaseT -= dt; if (r.phaseT <= 0) { r.phase = 'playing'; $('banner').textContent = ''; } break;
    case 'between': r.phaseT -= dt; if (r.phaseT <= 0) { $('banner').textContent = ''; beginRound(); } break;
    case 'dead': case 'won': r.deadT += dt; break;
    case 'playing': {
      if (r.ire) updateIre(dt);
      if (!run || r.phase !== 'playing') return;
      const wdt = dt * (r.ire ? ireSlow() : 1);          // Ire slows egg time (movement + spawns)
      r.spawnT -= wdt;
      if (r.spawnT <= 0 && r.spawned < r.total) {
        spawnEgg();
        if (r.variant === 'rot' && Math.random() < 0.25 && r.spawned < r.total) spawnEgg(); // roT: unfair double drops
        r.spawnT = spawnGap(r) * (0.7 + Math.random() * 0.6);
      }
      r.tickAcc += wdt;
      const tick = EGG_TICK / speedMult(r);
      while (r.tickAcc >= tick && run && r.phase === 'playing') { r.tickAcc -= tick; stepEggs(); }
      if (run && r.phase === 'playing' && r.spawned >= r.total && r.eggs.length === 0 && !(r.ire && ireBusy())) {
        if (r.ire && r.ire.state === 'frown') ireSet('wait', 3);
        endRound();
      }
    }
  }
}

/* ---------- pause / focus ---------- */
const P = { paused: false, countdown: 0 };
const inGame = () => screen === 'game' && run && run.phase !== 'dead' && run.phase !== 'won';
function pauseGame() {
  if (P.paused) return; P.paused = true; P.countdown = 0; pauseAudio();
  if (inGame()) { $('cdNum').textContent = 'PAUSED'; $('cdNum').className = 'paused'; $('countdown').classList.remove('hidden'); }
}
function tryResume() {
  if (!P.paused || P.countdown > 0 || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  if (inGame()) { P.countdown = 3; $('cdNum').className = ''; $('cdNum').textContent = '3'; $('countdown').classList.remove('hidden'); }
  else finishResume();
}
function finishResume() { P.paused = false; P.countdown = 0; $('countdown').classList.add('hidden'); resumeAudio(); }
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' ? pauseGame() : tryResume());
addEventListener('blur', pauseGame);
addEventListener('focus', tryResume);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (P.paused) {
    if (P.countdown > 0) {
      P.countdown -= dt; $('cdNum').textContent = Math.max(1, Math.ceil(P.countdown));
      if (P.countdown <= 0) finishResume();
    }
  } else {
    tickTimers(dt);
    if (run) updateRun(dt);
  }
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------- *
 * 11. INPUT (one listener, registered once)
 * ---------------------------------------------------------- */
function enableSound() { Snd.enabled = true; showMenu(); }
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (P.paused) return;
  if (screen === 'soundgate') { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(k)) enableSound(); return; }
  if (e.repeat && k === 'Enter') return;
  if (screen === 'menu') {
    const n = menuActs().length;
    if (k === 'ArrowLeft') { menuIndex = (menuIndex + n - 1) % n; markMenuSel(); }
    else if (k === 'ArrowRight') { menuIndex = (menuIndex + 1) % n; markMenuSel(); }
    else if (k === 'Enter') confirmMenu();
    else if (k === 'p' || k === 'P') { save.pitUnlocked = true; persist(); renderMenu(); }   // testing unlock
  } else if (screen === 'badges') {
    if (k === 'Escape' || k === 'Enter' || k === 'Backspace') showMenu();
  } else if (screen === 'game' && run) {
    if (k === 'h' || k === 'H') stage.classList.toggle('debug');
    if (k === 'Escape') return showMenu();
    if (run.phase === 'pick') {
      if (k === 'ArrowLeft' || k === 'ArrowRight') { pickIdx = (pickIdx + 1) % 2; markPick(); }
      else if (k === 'Enter') confirmPick();
    } else if (run.phase === 'dead' || run.phase === 'won') {
      if (k === 'Enter' && run.deadT > 0.8) showMenu();
    } else if (!e.repeat) {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') movePlayer(-1);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') movePlayer(1);
    }
  }
});
$('soundgate').addEventListener('click', () => { if (screen === 'soundgate') enableSound(); });

/* ---------------------------------------------------------- *
 * 12. BOOT
 * ---------------------------------------------------------- */
(function boot() {
  resize(); setScreen('loading');
  const logo = $('menuLogo');
  preloadAll((done, total, file, ok, why) => {
    $('loadFill').style.width = (done / total * 100) + '%';
    $('loadText').textContent = `${done} / ${total}  ${file}`;
    if (!ok) { const li = document.createElement('li'); li.textContent = `FAILED: ${file} — ${why}`; $('loadFails').append(li); }
  }).then(() => {
    logo.append(imgEl('logo'));
    document.getElementById('menu').style.setProperty('--bg', A.failed.has('bg') ? 'none' : `url("${url(FILES.img.bg)}")`);
    document.getElementById('badges').style.setProperty('--bg', A.failed.has('bg') ? 'none' : `url("${url(FILES.img.bg)}")`);
    for (const [k, why] of A.failed) {
      const li = document.createElement('li'); li.textContent = `FAILED: ${A.file[k]} — ${why}`; $('gateFails').append(li);
    }
    setScreen('soundgate');
  });
  requestAnimationFrame(frame);
})();

})();

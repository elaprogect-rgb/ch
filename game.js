/* EGG — game.js
   Hosted in https://github.com/elaprogect-rgb/ch (main) and loaded by index.html via jsDelivr.
   Creates its own canvas + styles. All assets come from the CDN. */
(() => {
'use strict';

/* ------------------------------------------------------------------ CONFIG */
const CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
const W = 1000, H = 491;               // internal resolution = background size
const GROUND = H - 14;                 // y of the player's feet / where eggs "hit the ground"
const PLAYER_H = 170;                  // drawn height of the player sprite
// Basket hitbox as fractions of the player sprite (x, y, w, h)
const HITBOX = { x: 0.26, y: 0.12, w: 0.44, h: 0.30 };
const LANES = [W * 0.2, W * 0.5, W * 0.8];
const EGG_SIZE = 4;
const FALL_PX = 7, FALL_STEP = 0.07;   // 7px every 0.07s
const RUN_TIME = 0.4;
const HEAD_START = 3;
const MAX_HEARTS = 6, BASE_HEARTS = 3;
const DIFFICULTY_CAP_ROUND = 10;
const MAIN_ROUNDS = 3;

const IMG_FILES = {
  bg: 'Bg_minigolf2_0.webp',
  idle: 'EGG_CharlesIdle.png',
  run: 'EGG_CharlesRun.png',
  logo: 'EGG_Logo.webp',
  hardstuck: 'Hardstuck_Badge.png',
  winner: 'Winner_Badge.png',
  winnerwinner: 'Winner_Winner_Badge.png',
  battler: 'Battler_Badge.png',
};
const SND_FILES = {
  menu: 'Incubating.mp3',
  game: 'Cracked-AllInstruments.mp3',
  over: 'Scrambled.mp3',
};
const BADGES = [
  { id: 'hardstuck', name: 'Hardstuck', bio: 'You do nothing but cheat! Cheat i say!', sub: 'Reach round 50.' },
  { id: 'winner', name: 'Winner', bio: 'Winner Chicken Dinner!', sub: 'Complete the first 3 rounds for the first time.' },
  { id: 'winnerwinner', name: 'Winner Winner', bio: 'You\u2019re a loser who sits and cries!', sub: 'Complete the first 3 rounds without losing a single heart.' },
  { id: 'battler', name: 'Battler', bio: 'You cheated. No other words.', sub: 'Survive 20 rounds without losing a heart.' },
];

/* ------------------------------------------------------------------- SETUP */
const css = document.createElement('style');
css.textContent = 'html,body{margin:0;height:100%;background:#0e1a10;overflow:hidden}' +
  'body{display:flex;align-items:center;justify-content:center}' +
  'canvas{display:block;touch-action:none;outline:none}';
document.head.appendChild(css);

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H; canvas.tabIndex = 0;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', fit); fit();

/* ------------------------------------------------------------------ ASSETS */
const imgs = {};
function loadImages() {
  return Promise.all(Object.entries(IMG_FILES).map(([k, f]) => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => res();
    im.src = CDN + f;
    imgs[k] = im;
  })));
}
const ok = im => im && im.complete && im.naturalWidth > 0;

const snd = {};
for (const [k, f] of Object.entries(SND_FILES)) {
  const a = new Audio(CDN + f);
  a.preload = 'auto';
  a.loop = k !== 'over';
  snd[k] = a;
}
let currentMusic = null;
let focusLost = false;
function stopAllAudio() {
  for (const a of Object.values(snd)) { a.pause(); try { a.currentTime = 0; } catch (e) {} }
  currentMusic = null;
}
function tryPlay(a) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
function playMusic(name) {            // stops everything else first
  stopAllAudio();
  currentMusic = name;
  if (name && !focusLost) tryPlay(snd[name]);
}
function unlockAudio() {              // browsers block autoplay until a gesture
  if (currentMusic && !focusLost && snd[currentMusic].paused) tryPlay(snd[currentMusic]);
}

/* ----------------------------------------------------------------- STORAGE */
const SAVE_KEY = 'egg_save_v1';
let save = { badges: {}, best: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.badges) save = s; } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const toasts = [];
function unlock(id) {
  if (save.badges[id]) return;
  save.badges[id] = true; persist();
  toasts.push({ text: 'Badge unlocked: ' + BADGES.find(b => b.id === id).name, t: 3.5 });
}

/* ------------------------------------------------------------------- STATE */
let scene = 'loading';                // loading | menu | badges | play | over
let menuSel = 0;                      // 0 = Play, 1 = Badges
let time = 0;
let play = null;
let showHitbox = false;
let overInfo = null;

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;

/* --------------------------------------------------------------------- GAME */
function newRoundTarget(round) { return round <= MAIN_ROUNDS ? randInt(5, 10) : randInt(15, 25); }
function difficulty(round) { return (Math.min(round, DIFFICULTY_CAP_ROUND) - 1) / (DIFFICULTY_CAP_ROUND - 1); }

function startGame() {
  play = {
    lane: 1, runTimer: 0,
    eggs: [], popups: [],
    score: 0, red: BASE_HEARTS, blue: 0,
    round: 1, target: newRoundTarget(1), spawned: 0, resolved: 0,
    fallAcc: 0, spawnTimer: 1.2, spawnPause: 0,
    headStart: 0, banner: { text: 'Round 1', t: 1.5 },
    lostThisRound: false, lostInFirst3: false, cleanRounds: 0,
    rottenStart: randInt(2, 3),
  };
  scene = 'play';
  playMusic('game');
}

function spawnEgg(lane) {
  const p = play, d = difficulty(p.round);
  const rotten = p.round >= p.rottenStart && Math.random() < lerp(0.15, 0.4, d);
  p.eggs.push({ lane, x: LANES[lane], y: -EGG_SIZE, rotten });
  p.spawned++;
}
function spawnWave() {
  const p = play, d = difficulty(p.round);
  const lane = randInt(0, 2);
  spawnEgg(lane);
  if (p.spawned < p.target && p.round >= 4 && Math.random() < lerp(0.05, 0.35, d)) {
    spawnEgg((lane + randInt(1, 2)) % 3);
  }
}
function nextGap() { return lerp(1.6, 0.55, difficulty(play.round)) * rand(0.8, 1.25); }

function popup(x, y, text, color) { play.popups.push({ x, y, text, color, t: 1 }); }

function damage() {
  const p = play;
  if (p.blue > 0) p.blue--; else p.red--;
  p.lostThisRound = true; p.cleanRounds = 0;
  if (p.round <= MAIN_ROUNDS) p.lostInFirst3 = true;
  if (p.red + p.blue <= 0) gameOver();
}
function good(e) { play.score += 1000; popup(e.x, GROUND - PLAYER_H, '+1000', '#b6ff7a'); }
function bad(e)  { play.score -= 2000; popup(e.x, GROUND - PLAYER_H, '-2000', '#ff6b6b'); damage(); }

function caught(e)  { play.resolved++; e.rotten ? bad(e) : good(e); }
function grounded(e) { play.resolved++; e.rotten ? (play.score += 1000, popup(e.x, GROUND - 40, '+1000', '#b6ff7a')) : bad(e); }

function completeRound() {
  const p = play;
  if (p.round === MAIN_ROUNDS) {
    unlock('winner');
    if (!p.lostInFirst3) unlock('winnerwinner');
  }
  if (!p.lostThisRound) { p.cleanRounds++; if (p.cleanRounds >= 20) unlock('battler'); }
  else p.cleanRounds = 0;
  // heal / overheal
  if (p.red < BASE_HEARTS) p.red++;
  else if (p.red + p.blue < MAX_HEARTS) p.blue++;
  p.round++;
  if (p.round >= 50) unlock('hardstuck');
  p.target = newRoundTarget(p.round);
  p.spawned = 0; p.resolved = 0; p.lostThisRound = false;
  p.spawnTimer = 1.2; p.spawnPause = 1.2;
  p.banner = { text: 'Round ' + p.round, t: 1.5 };
}

function gameOver() {
  overInfo = { score: play.score, round: play.round };
  if (play.round > save.best) { save.best = play.round; persist(); }
  scene = 'over';
  playMusic('over');                  // stops all other audio immediately
}

function stepEggs() {
  const p = play, hb = hitboxRect();
  const keep = [];
  for (const e of p.eggs) {
    e.y += FALL_PX;
    const l = e.x - EGG_SIZE / 2, r = l + EGG_SIZE, t = e.y, b = e.y + EGG_SIZE;
    if (r > hb.x && l < hb.x + hb.w && b > hb.y && t < hb.y + hb.h) { caught(e); }
    else if (b >= GROUND) { grounded(e); }
    else keep.push(e);
    if (scene !== 'play') return;
  }
  p.eggs = keep;
  if (p.resolved >= p.target && p.eggs.length === 0) completeRound();
}

function updatePlay(dt) {
  const p = play;
  if (p.runTimer > 0) p.runTimer -= dt;
  if (focusLost) return;
  for (const o of p.popups) { o.t -= dt; o.y -= 30 * dt; }
  p.popups = p.popups.filter(o => o.t > 0);
  if (p.banner.t > 0) p.banner.t -= dt;
  if (p.headStart > 0) { p.headStart -= dt; return; }

  if (p.spawnPause > 0) p.spawnPause -= dt;
  else if (p.spawned < p.target) {
    p.spawnTimer -= dt;
    if (p.spawnTimer <= 0) { spawnWave(); p.spawnTimer = nextGap(); }
  }
  p.fallAcc += dt;
  while (p.fallAcc >= FALL_STEP) {
    p.fallAcc -= FALL_STEP;
    stepEggs();
    if (scene !== 'play') return;
  }
}

function moveLane(dir) {
  if (!play) return;
  play.lane = (play.lane + dir + LANES.length) % LANES.length;   // wraps both ways
  play.runTimer = RUN_TIME;
}

/* ------------------------------------------------------------------ PLAYER */
function playerRect() {
  const idle = imgs.idle;
  const aspect = ok(idle) ? idle.naturalWidth / idle.naturalHeight : 0.6;
  const w = PLAYER_H * aspect;
  return { x: LANES[play.lane] - w / 2, y: GROUND - PLAYER_H, w, h: PLAYER_H };
}
function hitboxRect() {
  const r = playerRect();
  return { x: r.x + r.w * HITBOX.x, y: r.y + r.h * HITBOX.y, w: r.w * HITBOX.w, h: r.h * HITBOX.h };
}

/* ----------------------------------------------------------------- DRAWING */
const FONT = '"Courier New", monospace';
function text(str, x, y, size, { align = 'center', color = '#fff', stroke = '#1b3a1f', weight = 'bold', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.restore();
}
function drawBg() {
  ctx.imageSmoothingEnabled = true;
  if (ok(imgs.bg)) ctx.drawImage(imgs.bg, 0, 0, W, H);
  else { ctx.fillStyle = '#8ec9d4'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#67b858'; ctx.fillRect(0, 240, W, H); }
}
function heart(x, y, s, fill, line) {
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y + s);
  ctx.bezierCurveTo(x - s * 0.35, y + s * 0.45, x + s * 0.05, y - s * 0.25, x + s / 2, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.95, y - s * 0.25, x + s * 1.35, y + s * 0.45, x + s / 2, y + s);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = 2.5; ctx.strokeStyle = line; ctx.stroke();
}
function sway(phase = 0) {
  return { dx: Math.sin(time * 1.6 + phase) * 9, dy: Math.sin(time * 2.4 + phase) * 6 };
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* menu */
const MENU_ITEMS = ['Play', 'Badges'];
const MENU_Y = [345, 410];
function drawMenu() {
  drawBg();
  const a = sway(0);
  if (ok(imgs.logo)) {
    const lw = imgs.logo.naturalWidth, lh = imgs.logo.naturalHeight;
    const s = Math.min(460 / lw, 210 / lh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(imgs.logo, W / 2 - lw * s / 2 + a.dx, 140 - lh * s / 2 + a.dy, lw * s, lh * s);
  } else text('EGG', W / 2 + a.dx, 140 + a.dy, 96);
  MENU_ITEMS.forEach((label, i) => {
    const sel = i === menuSel, m = sel ? sway(0.7) : { dx: 0, dy: 0 };
    text((sel ? '> ' : '') + label + (sel ? ' <' : ''), W / 2 + m.dx, MENU_Y[i] + m.dy, sel ? 44 : 36,
      { color: sel ? '#fff7a8' : '#ffffff', alpha: sel ? 1 : 0.8 });
  });
  text('\u2191 \u2193 choose    Enter confirm', W / 2, H - 22, 16, { color: '#e8f5e0' });
}

/* badges */
function drawBadges() {
  drawBg();
  text('Badges', W / 2, 38, 40);
  BADGES.forEach((b, i) => {
    const y0 = 72 + i * 100, got = !!save.badges[b.id];
    ctx.fillStyle = 'rgba(14,40,18,0.62)'; roundRect(40, y0, W - 80, 90, 10); ctx.fill();
    const im = imgs[b.id];
    ctx.save();
    if (!got) { ctx.globalAlpha = 0.4; try { ctx.filter = 'grayscale(1)'; } catch (e) {} }
    if (ok(im)) {
      const s = 74 / im.naturalHeight;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, 60, y0 + 8, im.naturalWidth * s, 74);
    } else { ctx.fillStyle = '#ccc'; ctx.fillRect(60, y0 + 8, 74, 74); }
    ctx.restore();
    text(b.name, 160, y0 + 24, 26, { align: 'left', color: got ? '#ffe66b' : '#d0d6cc', stroke: null });
    text(b.bio, 160, y0 + 52, 19, { align: 'left', stroke: null, weight: 'normal' });
    text(b.sub, 160, y0 + 75, 16, { align: 'left', color: '#b9d8b0', stroke: null, weight: 'normal' });
    if (got) text('Unlocked', W - 62, y0 + 24, 16, { align: 'right', color: '#b6ff7a', stroke: null });
  });
  text('Esc  back', W - 20, H - 12, 15, { align: 'right', stroke: null });
}

/* gameplay */
function drawEggs() {
  for (const e of play.eggs) {
    const x = Math.round(e.x - EGG_SIZE / 2), y = Math.round(e.y);
    ctx.fillStyle = e.rotten ? '#5b5b66' : '#2b3a2e';           // thin outline so it reads on any backdrop
    ctx.fillRect(x - 1, y - 1, EGG_SIZE + 2, EGG_SIZE + 2);
    ctx.fillStyle = e.rotten ? '#0a0a0a' : '#ffffff';
    ctx.fillRect(x, y, EGG_SIZE, EGG_SIZE);
  }
}
function drawPlayer() {
  const r = playerRect();
  const running = play.runTimer > 0 && ok(imgs.run);
  const im = running ? imgs.run : imgs.idle;
  ctx.imageSmoothingEnabled = false;
  if (ok(im)) ctx.drawImage(im, r.x, r.y, r.w, r.h);
  else { ctx.fillStyle = '#2f9a4c'; ctx.fillRect(r.x, r.y, r.w, r.h); }
  if (showHitbox) {
    const h = hitboxRect();
    ctx.strokeStyle = 'rgba(255,0,0,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(h.x, h.y, h.w, h.h);
  }
}
function drawHud() {
  const p = play;
  ctx.fillStyle = 'rgba(14,40,18,0.45)'; roundRect(8, 8, 3 * 34 + 10 + Math.max(0, p.blue) * 34 + 10, 40, 8); ctx.fill();
  for (let i = 0; i < BASE_HEARTS; i++) heart(18 + i * 34, 15, 24, i < p.red ? '#e5303c' : null, i < p.red ? '#6e0c14' : '#4a2a2c');
  for (let i = 0; i < p.blue; i++) heart(18 + (BASE_HEARTS + i) * 34, 15, 24, '#3d8cff', '#0c2f77');
  text('Score ' + p.score, W - 16, 26, 28, { align: 'right' });
  text('Round ' + p.round, W / 2, 24, 26);
  text('Eggs ' + p.resolved + '/' + p.target, W / 2, 50, 16, { color: '#e8f5e0' });
}
function drawPlay() {
  drawBg();
  drawEggs();
  drawPlayer();
  for (const o of play.popups) text(o.text, o.x, o.y, 24, { color: o.color, alpha: Math.min(1, o.t * 2) });
  drawHud();
  if (play.banner.t > 0) text(play.banner.text, W / 2, 150, 64, { alpha: Math.min(1, play.banner.t * 2) });
  if (focusLost) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    text('Paused', W / 2, H / 2, 60);
  } else if (play.headStart > 0) {
    text('Get ready', W / 2, H / 2 - 40, 30);
    text(String(Math.ceil(play.headStart)), W / 2, H / 2 + 20, 90);
  }
}
function drawOver() {
  drawBg();
  ctx.fillStyle = 'rgba(8,20,10,0.72)'; ctx.fillRect(0, 0, W, H);
  text('Game over', W / 2, 120, 72, { color: '#ff7b7b' });
  text('Final score  ' + overInfo.score, W / 2, 230, 36);
  text('Highest round  ' + overInfo.round, W / 2, 285, 36);
  text('Best ever  ' + save.best, W / 2, 330, 20, { color: '#c8e8c0' });
  const a = sway(0);
  text('Press Enter for menu', W / 2 + a.dx * 0.5, 410 + a.dy * 0.5, 26, { color: '#fff7a8' });
}
function drawToasts() {
  toasts.forEach((t, i) => {
    const y = 84 + i * 36;
    ctx.fillStyle = 'rgba(14,40,18,0.8)'; roundRect(W / 2 - 200, y - 17, 400, 34, 8); ctx.fill();
    text(t.text, W / 2, y, 20, { color: '#ffe66b', stroke: null, alpha: Math.min(1, t.t) });
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (scene === 'loading') {
    ctx.fillStyle = '#0e1a10'; ctx.fillRect(0, 0, W, H);
    text('Loading...', W / 2, H / 2, 36);
  } else if (scene === 'menu') drawMenu();
  else if (scene === 'badges') drawBadges();
  else if (scene === 'play') drawPlay();
  else if (scene === 'over') drawOver();
  drawToasts();
  if (focusLost && scene !== 'play' && scene !== 'loading') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
  }
}

/* -------------------------------------------------------------------- LOOP */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; time = now / 1000;
  if (scene === 'play') updatePlay(dt);
  for (const t of toasts) t.t -= dt;
  for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].t <= 0) toasts.splice(i, 1);
  draw();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------- INPUT */
function toMenu() { scene = 'menu'; playMusic('menu'); }
function menuActivate() { menuSel === 0 ? startGame() : (scene = 'badges'); }

addEventListener('keydown', e => {
  unlockAudio();
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'h' || k === 'H') showHitbox = !showHitbox;       // debug: toggle hitbox outline
  if (scene === 'menu') {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) menuSel = 1 - menuSel;
    else if (k === 'Enter' || k === ' ') menuActivate();
  } else if (scene === 'badges') {
    if (k === 'Escape' || k === 'Backspace' || k === 'Enter') scene = 'menu';
  } else if (scene === 'play') {
    if (e.repeat) return;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') moveLane(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') moveLane(1);
  } else if (scene === 'over') {
    if (k === 'Enter' || k === ' ') toMenu();
  }
});

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function menuHit(p) {
  for (let i = 0; i < MENU_ITEMS.length; i++) if (Math.abs(p.y - MENU_Y[i]) < 28 && Math.abs(p.x - W / 2) < 170) return i;
  return -1;
}
canvas.addEventListener('pointermove', e => {
  if (scene !== 'menu') return;
  const i = menuHit(pointerPos(e)); if (i >= 0) menuSel = i;
});
canvas.addEventListener('pointerdown', e => {
  unlockAudio(); canvas.focus();
  const p = pointerPos(e);
  if (scene === 'menu') { const i = menuHit(p); if (i >= 0) { menuSel = i; menuActivate(); } }
  else if (scene === 'badges') scene = 'menu';
  else if (scene === 'play') moveLane(p.x < W / 2 ? -1 : 1);
  else if (scene === 'over') toMenu();
});

/* ---------------------------------------------- TAB OUT = PAUSE + HEAD START */
function leave() {
  if (focusLost) return;
  focusLost = true;
  if (currentMusic) snd[currentMusic].pause();
}
function back() {
  if (!focusLost) return;
  focusLost = false;
  if (scene === 'play' && play) play.headStart = HEAD_START;   // 3s before eggs resume
  if (currentMusic) tryPlay(snd[currentMusic]);
}
addEventListener('blur', leave);
addEventListener('focus', back);
document.addEventListener('visibilitychange', () => document.hidden ? leave() : back());

/* ------------------------------------------------------------------- START */
requestAnimationFrame(frame);
loadImages().then(() => { toMenu(); canvas.focus(); });
})();

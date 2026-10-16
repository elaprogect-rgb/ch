/* EGG — single-file game script. Assets come from jsDelivr (repo: elaprogect-rgb/ch). */
(() => {
'use strict';

/* ------------------------------------------------------------------ config */
const CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
const u = f => CDN + encodeURI(f);              // encodes spaces etc., case preserved
const W = 320, H = 200, LANES = [80, 160, 240]; // logical canvas, 3 lanes
const PW = 40, PH = 44;                          // player sprite size
const BK = { x: 8, y: 2, w: 24, h: 15 };         // basket hitbox (relative to sprite) — the basket IS the hitbox
const EGG = 4, GROUND = H - 2;
const BASE_SPEED = 100;                          // px/s  (= 7px every 0.07s)
const INVULN_MS = 1500;                          // no heart loss after losing a heart
const MIME_SURVIVE_ROUNDS = 5;                   // rounds with Mime active to count as "survived"

const FILES = {
  logo: 'EGG_Logo.webp', bgMain: 'Bg_minigolf2_0.webp', bgPit: 'OIP (7).webp',
  idle: 'EGG_CharlesIdle.png', run: 'EGG_CharlesRun.png',
  pitIntro: 'HESNOTHEREBUTiAM.png', modeScreen: 'DECAY_ROT_screen.png',
  b_hardstuck: 'Hardstuck_Badge.png', b_winner: 'Winner_Badge.png', b_winnerwinner: 'Winner_Winner_Badge.png',
  b_battler: 'Battler_Badge.png', b_handsoff: 'HANDSOFF_Badge.png', b_wakeup: 'WAKEUPCALL_Badge.png',
  b_allequal: 'All_equal_Badge.png', b_decorrupt: 'DECORRUPT__(Y-N)_Badge.png'
};
const GIFFILES = { mime: 'MimeHand.gif', ireAppear: 'Ire_appear.gif', ireAttack: 'Ire_attack.gif',
                   ireActive: 'Ire_active.gif', ireFrown: 'Ire_Frown_Animated.gif' };
const SNDFILES = { menu: 'Incubating.mp3', game: 'Cracked-AllInstruments.mp3', lose: 'Scrambled.mp3', pit: 'The_Pit.mp3.mpeg' };

/* ----------------------------------------------------------------- helpers */
const $ = s => document.querySelector(s);
const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fit = () => { stage.style.fontSize = (stage.clientWidth / 100) + 'px'; };
window.addEventListener('resize', fit); fit();

/* -------------------------------------------------------------------- save */
const SAVE_KEY = 'egg_save_v1';
let save = { badges: {}, pitUnlocked: false, pitEntered: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
let sessionPit = false;                           // P-key test unlock (session only)
const pitAvailable = () => save.pitUnlocked || sessionPit;

const BADGES = [
  { id: 'hardstuck', name: 'Hardstuck', bio: 'You do nothing but cheat! Cheat i say!', sub: 'Make it to round 50.' },
  { id: 'winner', name: 'Winner Winner Chicken Dinner!', bio: 'Winner Winner Chicken Dinner!', sub: 'Beat 3 rounds for the first time.' },
  { id: 'winnerwinner', name: 'Winner Winner', bio: "You're a loser who sits and crys!", sub: 'Beat 3 rounds without losing a single heart.' },
  { id: 'battler', name: 'Battler', bio: 'You cheated. No other words.', sub: 'Survive 20 rounds without losing 1 heart.' },
  { id: 'handsoff', name: 'HANDSOFF', bio: 'IT JUST MAKES YOU HAPPY!', sub: 'Survive mime for the first time.' },
  { id: 'wakeup', name: 'WAKEUPCALL', bio: 'YOU JUST LIVE ON AND ON.', sub: 'Survive ire with less then 0.5 seconds before they enter their attacking state.' },
  { id: 'allequal', name: 'All equal', bio: 'WONDERFUL!', sub: 'Survive ire for the first time.' },
  { id: 'decorrupt', name: 'DECORRUPT**(Y-N)', bio: 'YOU_ARE_JUST_GETTING_STARTED.', sub: 'Enter the pit for the first time.' }
];
let toastTimer = 0;
function award(id) {
  if (save.badges[id]) return;
  save.badges[id] = true; persist();
  const b = BADGES.find(x => x.id === id), t = $('#toast');
  t.innerHTML = `<img src="${u(FILES['b_' + id])}" alt=""><span>BADGE: ${b.name}</span>`;
  t.classList.add('on'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
}

/* ------------------------------------------------------------------ preload */
const imgs = {}, gifs = {}, snds = {}, failed = [];
let loaded = 0, total = 0;
function tick() {
  loaded++;
  const p = Math.round(loaded / total * 100);
  $('#barFill').style.width = p + '%';
  $('#loadTxt').textContent = `LOADING ASSETS... ${p}%  (${loaded}/${total})`;
}
const loadImage = (k, f) => new Promise(res => {
  const i = new Image();
  i.onload = () => { imgs[k] = i; tick(); res(); };
  i.onerror = () => { failed.push(f); tick(); res(); };
  i.src = u(f);
});
function gifDuration(b) {                          // sum of frame delays from the GIF bytes
  let t = 0;
  for (let i = 0; i < b.length - 6; i++) {
    if (b[i] === 0x21 && b[i + 1] === 0xF9 && b[i + 2] === 4) {
      const d = b[i + 4] | (b[i + 5] << 8); t += d <= 1 ? 100 : d * 10; i += 7;
    }
  }
  return t;
}
async function loadGif(k, f) {
  try {
    const r = await fetch(u(f)); if (!r.ok) throw new Error(r.status);
    const buf = await r.arrayBuffer();
    gifs[k] = { src: URL.createObjectURL(new Blob([buf], { type: 'image/gif' })), dur: gifDuration(new Uint8Array(buf)) };
  } catch (e) {                                    // fall back to a plain <img> probe
    await new Promise(res => {
      const i = new Image();
      i.onload = () => { gifs[k] = { src: u(f), dur: 0 }; res(); };
      i.onerror = () => { failed.push(f); res(); };
      i.src = u(f);
    });
  }
  tick();
}
const loadSound = (k, f) => new Promise(res => {
  const a = new Audio(); a.preload = 'auto';
  let done = false;
  const fin = ok => { if (done) return; done = true; if (ok) snds[k] = a; else failed.push(f); tick(); res(); };
  a.addEventListener('canplay', () => fin(true), { once: true });
  a.addEventListener('error', () => fin(false), { once: true });
  setTimeout(() => fin(true), 9000);               // slow / iOS: keep going, element keeps loading
  a.src = u(f); a.load();
});
async function preload() {
  const jobs = [];
  Object.entries(FILES).forEach(([k, f]) => jobs.push(() => loadImage(k, f)));
  Object.entries(GIFFILES).forEach(([k, f]) => jobs.push(() => loadGif(k, f)));
  Object.entries(SNDFILES).forEach(([k, f]) => jobs.push(() => loadSound(k, f)));
  total = jobs.length;
  await Promise.all(jobs.map(j => j()));
  if (failed.length) {
    console.error('EGG: assets failed to load:', failed.map(u));
    $('#missing').textContent = 'MISSING ASSETS: ' + failed.join(', ');
  }
  go('sound');
}
const durOf = (k, def) => (gifs[k] && gifs[k].dur) || def;
function setGif(el, k) {                           // new <img> each time => animation restarts at frame 0
  const im = new Image(); im.draggable = false;
  if (gifs[k]) im.src = gifs[k].src; else console.error('EGG: missing GIF', GIFFILES[k]);
  el.replaceChildren(im);
}

/* -------------------------------------------------------------------- audio */
let curAudio = null, curKey = null, muted = false, fallbackT = 0;
const Snd = {
  stopAll() {
    clearTimeout(fallbackT);
    Object.values(snds).forEach(a => { a.pause(); a.onended = null; try { a.currentTime = 0; } catch (e) {} });
    curAudio = null; curKey = null;
  },
  play(k, { loop = true, onend = null } = {}) {
    this.stopAll();
    let fired = false;
    const end = () => { if (fired) return; fired = true; clearTimeout(fallbackT); onend && onend(); };
    const a = snds[k];
    if (!a) { if (onend) fallbackT = setTimeout(end, 3000); return; }
    a.loop = loop; a.muted = muted; a.onended = onend ? end : null;
    curAudio = a; curKey = k;
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (onend) fallbackT = setTimeout(end, 3000); });
  },
  ensure(k) { if (curKey !== k || !curAudio || curAudio.paused && !document.hidden) this.play(k); },
  pause() { curAudio && curAudio.pause(); },
  resume() { curAudio && curAudio.play().catch(() => {}); },
  mute(m) { muted = m; Object.values(snds).forEach(a => a.muted = m); }
};

/* ------------------------------------------------------------------ screens */
let scene = 'load';
function setBg(k) { $('#bg').style.backgroundImage = `url("${u(FILES[k])}")`; }
function go(name) {
  scene = name; stage.dataset.scene = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
}
function banner(t) { const b = $('#banner'); b.textContent = t; b.style.display = t ? 'block' : 'none'; }

/* --------------------------------------------------------------------- menu */
let menuIdx = 0;
const menuItems = () => {
  const m = [{ id: 'play', label: 'PLAY' }, { id: 'badges', label: 'BADGES' }];
  if (pitAvailable()) m.push({ id: 'pit', label: 'PIT' });
  return m;
};
function showMenu() {
  cleanupRun(); G = null;
  setBg('bgMain'); $('#logo').src = u(FILES.logo);
  go('menu'); renderMenu(); Snd.ensure('menu');
}
function renderMenu() {
  const items = menuItems(); menuIdx = Math.min(menuIdx, items.length - 1);
  const box = $('#menuBtns'); box.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'btn' + (i === menuIdx ? ' sel' : ''); b.textContent = it.label;
    b.onclick = () => { menuIdx = i; activateMenu(); };
    b.onmouseenter = () => { menuIdx = i; [...box.children].forEach((c, j) => c.classList.toggle('sel', j === i)); };
    box.appendChild(b);
  });
}
function activateMenu() {
  const id = menuItems()[menuIdx].id;
  if (id === 'play') startMain(); else if (id === 'badges') showBadges(); else enterPit();
}
function showBadges() {
  setBg('bgMain');
  $('#badgeGrid').innerHTML = BADGES.map(b => {
    const ok = !!save.badges[b.id];
    return `<div class="card ${ok ? '' : 'locked'}"><img src="${u(FILES['b_' + b.id])}" alt=""><h3>${b.name}</h3>
      <div class="bio">"${b.bio}"</div><div class="sub">${b.sub}</div><div class="st">${ok ? 'UNLOCKED' : 'LOCKED'}</div></div>`;
  }).join('');
  go('badges');
}

/* ---------------------------------------------------------------------- PIT */
let modeIdx = 0, introTimer = 0;
function enterPit() {
  if (!save.pitEntered) { save.pitEntered = true; save.pitUnlocked = true; persist(); award('decorrupt'); }
  setBg('bgPit'); Snd.play('pit');
  $('#imgPitIntro').src = u(FILES.pitIntro); $('#imgMode').src = u(FILES.modeScreen);
  go('pitintro');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { if (scene === 'pitintro') { modeIdx = 0; selMode(0); go('mode'); } }, 400);
}
function selMode(i) { modeIdx = i; $('#hitDecay').classList.toggle('sel', i === 0); $('#hitRot').classList.toggle('sel', i === 1); }
$('#hitDecay').onclick = () => startPit('decay');
$('#hitRot').onclick = () => startPit('rot');
$('#hitDecay').onmouseenter = () => selMode(0);
$('#hitRot').onmouseenter = () => selMode(1);

/* --------------------------------------------------------------- run state */
let G = null;
const later = (ms, fn) => G.tasks.push({ at: G.t + ms, fn });

function newRun(kind, mode) {
  cleanupRun();
  G = { kind, mode, round: 1, score: 0, hearts: 3, over: 0, lane: 1, px: LANES[1], moveAt: -1e9, lastMove: -1e9,
        invuln: 0, tookDamage: false, roundLen: 0, spawned: 0, resolved: 0, spawnT: 0, eggs: [], t: 0, tasks: [],
        state: 'banner', paused: false, entity: null, entityRounds: 0, mime: null, ire: null, ireNext: 0, speedF: 1 };
}
function cleanupRun() {
  clearInterval(cdTimer); $('#pauseO').classList.remove('on');
  $('#entities').innerHTML = ''; banner(''); stage.classList.remove('shake');
}
function startMain() {
  Snd.play('game'); setBg('bgMain'); newRun('main', null);
  go('game'); updateHUD(); startRound();
}
function startPit(mode) {
  Snd.ensure('pit'); setBg('bgPit'); newRun('pit', mode);
  go('game'); updateHUD(); startRound();
}
function startRound() {
  const g = G;
  g.roundLen = g.round <= 3 ? rnd(5, 10) : rnd(15, 25);
  g.spawned = 0; g.resolved = 0; g.spawnT = 0; g.state = 'banner';
  banner('ROUND ' + g.round); updateHUD();
  later(1400, () => { banner(''); g.state = 'play'; });
}
function diff() {
  const r = G.round;
  if (G.kind === 'main') return { speed: 1 + .08 * (r - 1), gap: Math.max(550, 1250 - 70 * (r - 1)), rot: r < 2 ? 0 : Math.min(.15 + .03 * (r - 2), .4) };
  if (G.mode === 'decay') { const d = Math.min(r, 15);  // difficulty cap at round 15
    return { speed: 1 + .06 * (d - 1), gap: Math.max(550, 1200 - 45 * (d - 1)), rot: r < 2 ? 0 : Math.min(.15 + .02 * (d - 1), .35) }; }
  const d = Math.min(r, 30);                           // roT: deliberately brutal, cap at round 30
  return { speed: 1.3 + .1 * (d - 1), gap: Math.max(260, 800 - 20 * (d - 1)), rot: r < 2 ? 0 : Math.min(.2 + .015 * (d - 1), .5) };
}
function spawnEgg(d, avoidLane) {
  let lane = rnd(0, 2); if (lane === avoidLane) lane = (lane + 1 + rnd(0, 1)) % 3;
  G.eggs.push({ lane, y: -EGG - 2, rotten: G.round >= 2 && Math.random() < d.rot });
  G.spawned++;
  if (avoidLane === undefined && G.kind === 'pit' && G.mode === 'rot' && G.round >= 5 &&
      G.spawned < G.roundLen && Math.random() < .15) spawnEgg(d, lane);   // roT: occasional double drops
}

/* ------------------------------------------------------------- game update */
function step(dt) {
  const g = G; g.t += dt;
  if (g.invuln > 0) g.invuln = Math.max(0, g.invuln - dt);
  if (g.tasks.length) {                             // game-time scheduler (frozen while paused)
    const due = g.tasks.filter(t => t.at <= g.t); g.tasks = g.tasks.filter(t => t.at > g.t);
    due.sort((a, b) => a.at - b.at).forEach(t => { if (G === g && g.state !== 'dead') t.fn(); });
  }
  if (g.state !== 'play') return;
  const d = diff();
  if (g.entity === 'ire' && !g.ire && g.t >= g.ireNext) startIre();
  if (g.spawned < g.roundLen) { g.spawnT += dt * g.speedF; if (g.spawnT >= d.gap) { g.spawnT = 0; spawnEgg(d); } }
  const v = BASE_SPEED * d.speed * g.speedF * dt / 1000;
  for (let i = g.eggs.length - 1; i >= 0; i--) {
    if (g.state === 'dead') break;
    const e = g.eggs[i]; e.y += v;
    const bTop = H - PH - 2 + BK.y;
    if (e.lane === g.lane && e.y + EGG >= bTop && e.y <= bTop + BK.h) { g.eggs.splice(i, 1); resolveEgg(e, true); }
    else if (e.y + EGG >= GROUND) { g.eggs.splice(i, 1); resolveEgg(e, false); }
  }
  if (g.state === 'play' && g.spawned >= g.roundLen && !g.eggs.length && !g.ire) { g.state = 'between'; finishRound(); }
}
function resolveEgg(e, caught) {
  G.resolved++;
  if (!e.rotten) { if (caught) G.score += 1000; else { G.score -= 2000; damage(); } }
  else { if (caught) { G.score -= 2000; damage(); } else G.score += 1000; }
  updateHUD();
}
function damage() {
  if (G.invuln > 0) return;                         // 1.5s grace: no heart loss (score still applies)
  G.tookDamage = true;
  if (G.over > 0) G.over--; else G.hearts--;
  G.invuln = INVULN_MS;
  updateHUD();
  if (G.hearts <= 0) die('hearts');
}
function die(reason) {
  const g = G; if (!g || g.state === 'dead') return;
  g.state = 'dead'; g.deathReason = reason; g.speedF = 1;
  stage.classList.remove('shake'); banner('');
  Snd.play('lose', { loop: false, onend: () => { if (G === g) showOver(false); } });
}
function heal() { if (G.hearts < 3) G.hearts++; else G.over = Math.min(6, G.over + 1); }

function finishRound() {
  const g = G, done = g.round;
  if (g.entity) g.entityRounds++;
  if (g.kind === 'main') {
    if (done === 3) { award('winner'); if (!g.tookDamage) award('winnerwinner'); }
    if (done >= 10) return victory();
    g.round++; heal();
  } else {                                           // PIT: endless, no overheal, no heal
    g.round++;
    if (g.round >= 20 && !g.tookDamage) award('battler');
    if (g.round >= 50) award('hardstuck');
  }
  updateHUD();
  if (g.kind === 'pit' && g.mode === 'rot' && g.round >= 5 && g.round % 5 === 0) intermission(); else startRound();
}
function victory() {
  save.pitUnlocked = true; persist();
  Snd.play('menu'); showOver(true);
}
function showOver(won) {
  const g = G;
  $('#overTitle').textContent = won ? 'YOU BEAT EGG!' : 'GAME OVER';
  $('#overStats').innerHTML = `SCORE: ${g.score.toLocaleString()}<br>ROUNDS REACHED: ${won ? 10 : g.round}`;
  $('#overNote').textContent = won ? 'THE PIT HAS OPENED.' : '';
  setBg(g.kind === 'pit' ? 'bgPit' : 'bgMain');
  cleanupRun(); go('over'); selOver(0);
}
let overIdx = 0;
function selOver(i) { overIdx = i; $('#overRetry').classList.toggle('sel', i === 0); $('#overMenu').classList.toggle('sel', i === 1); }
function overRetry() { if (G.kind === 'main') startMain(); else startPit(G.mode); }
$('#overRetry').onclick = () => overRetry();
$('#overMenu').onclick = () => { Snd.play('menu'); showMenu(); };
$('#badgeBack').onclick = () => showMenu();

/* ---------------------------------------------------------- roT intermission */
const ENTITIES = [
  { id: 'mime', name: 'MIME', gif: 'mime', bio: 'It watches where you have been.', hint: "Never step back to where you just were." },
  { id: 'ire', name: 'IRE', gif: 'ireActive', bio: 'It cannot stand to be disturbed.', hint: 'When it wakes up, hold still.' }
];
let entIdx = 0;
function intermission() {
  const g = G;
  if (g.entity === 'mime' && g.entityRounds >= MIME_SURVIVE_ROUNDS) award('handsoff');
  removeMime(); g.entity = null;
  $('#entGrid').innerHTML = ENTITIES.map((e, i) => `<div class="card" data-i="${i}"><img src="${gifs[e.gif] ? gifs[e.gif].src : ''}" alt="">
     <h3>${e.name}</h3><div class="bio">${e.bio}</div><div class="sub">${e.hint}</div></div>`).join('');
  document.querySelectorAll('#entGrid .card').forEach(c => {
    c.onclick = () => { entIdx = +c.dataset.i; chooseEntity(); };
    c.onmouseenter = () => selEnt(+c.dataset.i);
  });
  selEnt(0); go('inter');
}
function selEnt(i) { entIdx = i; document.querySelectorAll('#entGrid .card').forEach((c, j) => c.classList.toggle('sel', j === i)); }
function chooseEntity() {
  const g = G, e = ENTITIES[entIdx];
  g.entity = e.id; g.entityRounds = 0;
  if (e.id === 'mime') spawnMime(); else g.ireNext = g.t + rnd(6000, 10000);
  go('game'); startRound();
}

/* --------------------------------------------------------------------- Mime */
function mimeX(l) { return (LANES[l] / W * 100) + '%'; }
function spawnMime() {
  const el = document.createElement('div'); el.className = 'ent mime'; setGif(el, 'mime');
  const lane = (G.lane + rnd(1, 2)) % 3;              // never starts on the player's lane
  el.style.left = mimeX(lane); $('#entities').appendChild(el);
  G.mime = { lane, el };
}
function removeMime() { if (G && G.mime) { G.mime.el.remove(); G.mime = null; } }

/* ---------------------------------------------------------------------- Ire */
function startIre() {
  const g = G, ire = { state: 'appear', triggered: false, survived: false, closeCall: false };
  g.ire = ire;
  const el = document.createElement('div'); el.className = 'ent ire'; $('#entities').appendChild(el); ire.el = el;
  setGif(el, 'ireAppear');                              // 1) spawning — harmless
  later(durOf('ireAppear', 1500), () => {
    ire.state = 'semi'; g.speedF = .5; setGif(el, 'ireAttack');       // 2) semi mad — eggs slow, harmless
    later(durOf('ireAttack', 1500), () => {
      ire.state = 'mad'; g.speedF = .2; setGif(el, 'ireActive');      // 3) mad — don't move
      ire.closeCall = (g.t - g.lastMove) < 500;
      later(250, () => {                                 // stillness check starts when MAD begins
        if (ire.triggered || g.ire !== ire) return;
        ire.survived = true; ire.state = 'frown'; g.speedF = 1;
        setGif(el, 'ireFrown'); award('allequal'); if (ire.closeCall) award('wakeup');
        later(durOf('ireFrown', 1200), () => { el.remove(); g.ire = null; g.ireNext = g.t + rnd(7000, 13000); });
      });
    });
  });
}

/* ------------------------------------------------------------------- input */
function movePlayer(dir) {
  const g = G; if (!g || g.paused || g.state === 'dead' || g.state === 'between') return;
  const old = g.lane, nl = (old + dir + 3) % 3;          // wraps around
  g.lane = nl; g.moveAt = g.t; g.lastMove = g.t;
  if (g.mime) {
    if (nl === g.mime.lane) return die('mime');         // stepped back into Mime: instant death
    g.mime.lane = old; g.mime.el.style.left = mimeX(old);
  }
  const ire = g.ire;
  if (ire && ire.state === 'mad' && !ire.triggered && !ire.survived) {
    ire.triggered = true; stage.classList.add('shake');
    later(1000, () => { if (!ire.survived) die('ire'); });
  }
}
document.addEventListener('keydown', e => {
  const k = e.key, L = k === 'ArrowLeft', R = k === 'ArrowRight';
  if (L || R || k === 'Enter' || k === ' ') e.preventDefault();
  if (k === 'm' || k === 'M') { Snd.mute(!muted); return; }
  if (k === 'h' || k === 'H') { debug = !debug; return; }
  switch (scene) {
    case 'sound': if (k === 'Enter' || k === ' ') showMenu(); break;
    case 'menu': {
      const n = menuItems().length;
      if (L) menuIdx = (menuIdx + n - 1) % n; else if (R) menuIdx = (menuIdx + 1) % n;
      else if (k === 'Enter') return activateMenu();
      else if (k === 'p' || k === 'P') { sessionPit = true; }   // test shortcut (session only)
      else return;
      renderMenu(); break; }
    case 'badges': if (k === 'Enter' || k === 'Escape' || k === 'Backspace') showMenu(); break;
    case 'pitintro': break;
    case 'mode': if (L) selMode(0); else if (R) selMode(1); else if (k === 'Enter') startPit(modeIdx ? 'rot' : 'decay'); break;
    case 'inter': if (L) selEnt(0); else if (R) selEnt(1); else if (k === 'Enter') chooseEntity(); break;
    case 'game': if (!e.repeat) { if (L) movePlayer(-1); else if (R) movePlayer(1); } break;
    case 'over':
      if (L || R) selOver(overIdx ^ 1);
      else if (k === 'r' || k === 'R') overRetry();
      else if (k === 'Enter') { if (overIdx === 0) overRetry(); else { Snd.play('menu'); showMenu(); } }
      break;
  }
});
stage.addEventListener('pointerdown', e => {            // touch / mouse steering during play
  if (scene === 'sound') return showMenu();
  if (scene !== 'game') return;
  const r = stage.getBoundingClientRect(); movePlayer(e.clientX - r.left < r.width / 2 ? -1 : 1);
});

/* ---------------------------------------------------- tab pause + countdown */
let cdTimer = 0;
function showPause(txt, small) { $('#pauseO').classList.add('on'); const t = $('#pauseTxt'); t.textContent = txt; t.className = small ? 't' : ''; }
function startCountdown() {
  let n = 3; showPause(String(n)); clearInterval(cdTimer);
  cdTimer = setInterval(() => {
    n--;
    if (n > 0) return showPause(String(n));
    clearInterval(cdTimer); $('#pauseO').classList.remove('on');
    if (G) G.paused = false; Snd.resume();
  }, 1000);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Snd.pause(); clearInterval(cdTimer);
    if (scene === 'game' && G && G.state !== 'dead') { G.paused = true; showPause('PAUSED', true); }
  } else if (scene === 'game' && G && G.paused) startCountdown();
  else Snd.resume();
});

/* ---------------------------------------------------------------- HUD/render */
function updateHUD() {
  if (!G) return;
  let h = '';
  for (let i = 0; i < 3; i++) h += `<span class="h ${i < G.hearts ? '' : 'lost'}">&hearts;</span>`;
  for (let i = 0; i < G.over; i++) h += `<span class="oh">&hearts;</span>`;
  $('#hudHearts').innerHTML = h;
  $('#hudRound').innerHTML = `ROUND ${G.round}` + (G.kind === 'pit' ? `<small>${G.mode === 'rot' ? 'roT' : 'DECAY'}</small>` : '');
  $('#hudScore').textContent = G.score.toLocaleString();
}
let debug = false, lastR = performance.now();
function render(dt) {
  ctx.clearRect(0, 0, W, H);
  if (!G || (scene !== 'game' && scene !== 'inter')) return;
  G.px += (LANES[G.lane] - G.px) * (1 - Math.exp(-dt / 35));
  const py = H - PH - 2, px = Math.round(G.px - PW / 2);
  const running = G.t - G.moveAt < 400, img = imgs[running ? 'run' : 'idle'];
  ctx.save();
  if (G.invuln > 0 && Math.floor(G.t / 100) % 2) ctx.globalAlpha = .35;
  if (img) ctx.drawImage(img, px, py, PW, PH);
  else { ctx.fillStyle = '#f0f'; ctx.fillRect(px, py, PW, PH); }   // visible placeholder: sprite failed to load
  ctx.restore();
  G.eggs.forEach(e => {
    const x = LANES[e.lane] - EGG / 2, y = Math.round(e.y);
    if (e.rotten) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, EGG + 2, EGG + 2); ctx.fillStyle = '#000'; ctx.fillRect(x, y, EGG, EGG); }
    else { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, EGG, EGG); }
  });
  if (debug) { ctx.strokeStyle = '#0f0'; ctx.strokeRect(LANES[G.lane] - PW / 2 + BK.x + .5, py + BK.y + .5, BK.w, BK.h); }
}
function frame(now) {
  const dt = Math.min(now - lastR, 50); lastR = now;
  if (scene === 'game' && G && !G.paused && G.state !== 'dead') {
    let r = dt;
    while (r > 0 && scene === 'game' && G && G.state !== 'dead') { const s = Math.min(r, 8); step(s); r -= s; }
  }
  render(dt);
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------------- boot */
$('#scr-sound').addEventListener('click', () => showMenu());   // click = user gesture -> audio allowed
go('load'); setBg('bgMain'); preload();
requestAnimationFrame(frame);
})();

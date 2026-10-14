// EGG - game state, loop, spawning, collisions, rounds, Mime, Ire, pause.
(function (E) {
  'use strict';
  const C = E.C, B = E.badges, A = E.audio;
  const G = E.game = { state: 'idle' };
  let raf = 0, last = 0, runId = 0;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const CAPS = { main: 10, decay: 15, rot: 30 }; // difficulty stops scaling here (main game ends at 10)

  // ---- difficulty ----------------------------------------------------------
  function diff() {
    const l = Math.min(G.round, CAPS[G.mode]);
    if (G.mode === 'main') return { speed: 1 + 0.10 * (l - 1), spawn: Math.max(0.55, 1.25 - 0.07 * (l - 1)), rotten: l < 2 ? 0 : Math.min(0.35, 0.12 + 0.025 * l), burst: 0 };
    if (G.mode === 'decay') return { speed: 1 + 0.08 * (l - 1), spawn: Math.max(0.5, 1.1 - 0.04 * l), rotten: l < 2 ? 0 : Math.min(0.4, 0.15 + 0.02 * l), burst: Math.min(0.25, l * 0.012) };
    // roT: deliberately unfair. Up to 5.6x fall speed, rapid bursts, lots of rotten eggs.
    return { speed: 1.4 + 0.14 * l, spawn: Math.max(0.16, 0.8 - 0.025 * l), rotten: l < 2 ? 0 : Math.min(0.55, 0.2 + 0.015 * l), burst: Math.min(0.7, 0.1 + l * 0.02) };
  }
  const rollTarget = (round) => (round <= 3 ? rnd(5, 10) : rnd(15, 25));

  function slow() {
    const I = G.ire; if (!I) return 1;
    if (I.phase === 'semi') return 0.4;
    if (I.phase === 'mad' || I.phase === 'frown') return 0.15;
    return 1;
  }

  // ---- lifecycle -----------------------------------------------------------
  G.start = function (mode) {
    cancelAnimationFrame(raf); runId++;
    E.ui.clearEntities();
    Object.assign(G, {
      mode, state: 'playing', score: 0, hp: 3, overheal: 0, round: 1, resolved: 0, spawned: 0,
      target: rollTarget(1), eggs: [], fx: [], lane: 1, visX: C.LANES[1], runT: 0, facing: 1,
      spawnT: 1.0, eggAcc: 0, time: 0, lastMoveT: -99, heartLost: false, entity: null, mime: null, ire: null
    });
    A.play(mode === 'main' ? 'game' : 'pit');
    E.ui.showGame(mode); E.ui.hud(); E.ui.banner('ROUND 1');
    last = performance.now(); raf = requestAnimationFrame(loop);
  };
  G.quit = function () { cancelAnimationFrame(raf); runId++; G.state = 'idle'; E.ui.clearEntities(); };

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (G.state === 'playing') update(dt);
    else if (G.state === 'countdown') {
      G.cd -= dt; E.ui.countdown(Math.max(1, Math.ceil(G.cd)));
      if (G.cd <= 0) { G.state = 'playing'; E.ui.countdown(null); A.resume(); }
    }
    draw();
  }

  // ---- update --------------------------------------------------------------
  function update(dt) {
    G.time += dt;
    if (G.runT > 0) G.runT -= dt;
    G.visX += (C.LANES[G.lane] - G.visX) * Math.min(1, dt * 25);
    for (const f of G.fx) f.t -= dt; G.fx = G.fx.filter((f) => f.t > 0);
    if (G.mime) { G.mime.x += (C.LANES[G.mime.lane] - G.mime.x) * Math.min(1, dt * 8); E.ui.placeMime(G.mime.x); }
    updateIre(dt); if (G.state !== 'playing') return;

    const d = diff(), s = slow();
    if (G.spawned < G.target) {
      G.spawnT -= dt * s;
      if (G.spawnT <= 0) { spawn(d); G.spawnT = d.spawn * (0.75 + Math.random() * 0.5); }
    }
    G.eggAcc += dt * d.speed * s;
    while (G.eggAcc >= C.STEP_SEC) { G.eggAcc -= C.STEP_SEC; stepEggs(); if (G.state !== 'playing') return; }
    if (G.resolved >= G.target && G.eggs.length === 0) endRound();
  }

  function spawn(d) {
    let n = 1 + (Math.random() < d.burst ? 1 : 0) + (Math.random() < d.burst / 2 ? 1 : 0);
    const used = [];
    while (n-- > 0 && G.spawned < G.target) {
      const free = [0, 1, 2].filter((l) => !used.includes(l));
      const lane = free[rnd(0, free.length - 1)]; used.push(lane);
      G.eggs.push({ lane, y: -C.EGG, rotten: G.round >= 2 && Math.random() < d.rotten });
      G.spawned++;
    }
  }

  function stepEggs() {
    for (let i = G.eggs.length - 1; i >= 0; i--) {
      const e = G.eggs[i]; e.y += C.STEP_PX;
      if (e.lane === G.lane && e.y + C.EGG >= C.CATCH_TOP && e.y <= C.CATCH_BOTTOM) { G.eggs.splice(i, 1); resolve(e, true); }
      else if (e.y >= C.GROUND_Y) { G.eggs.splice(i, 1); resolve(e, false); }
      if (G.state !== 'playing') return;
    }
  }

  function resolve(e, caught) {
    G.resolved++;
    const good = e.rotten ? !caught : caught; // rotten: must hit the ground
    const x = C.LANES[e.lane];
    if (good) { G.score += 1000; G.fx.push({ x, y: 340, txt: '+1000', col: '#8f8', t: 0.7 }); }
    else { G.score -= 2000; G.fx.push({ x, y: 340, txt: '-2000', col: '#f66', t: 0.7 }); damage(); }
    E.ui.hud();
  }

  function damage() {
    E.ui.flash();
    if (G.overheal > 0) { G.overheal--; return; } // overheal absorbs first and does not count as losing a heart
    G.hp--; G.heartLost = true;
    if (G.hp <= 0) gameOver('hearts');
  }

  // ---- input ---------------------------------------------------------------
  G.move = function (dir) {
    if (G.state !== 'playing') return;
    const old = G.lane, nl = (old + dir + 3) % 3; // wraps
    G.lane = nl; G.runT = 0.4; G.facing = dir; G.lastMoveT = G.time;
    if (G.mime) {
      if (nl === G.mime.lane) return gameOver('mime'); // stepping back into Mime's lane = instant death
      G.mime.lane = old;                                // Mime follows to where the player just was
    }
    const I = G.ire;
    if (I && I.phase === 'mad' && !I.done && !I.attack) { I.attack = true; I.attackT = 1; }
  };

  // ---- rounds --------------------------------------------------------------
  function endRound() {
    const done = G.round;
    if (G.entity === 'mime') B.award('handsoff'); // lived through a whole round with Mime
    if (G.mode === 'main') {
      if (done === 3) { B.award('winner'); if (!G.heartLost) B.award('winnerwinner'); }
      if (done >= 10) return victory();
      G.round++;
      if (G.hp < 3) G.hp++; else if (G.overheal < 6) G.overheal++;
    } else {
      G.round++;                                  // PIT: endless, no heal, no overheal
      if (G.round >= 20 && !G.heartLost) B.award('battler');
      if (G.round >= 50) B.award('hardstuck');
    }
    G.resolved = 0; G.spawned = 0; G.target = rollTarget(G.round); G.spawnT = 1.2; G.eggAcc = 0;
    E.ui.hud();
    if (G.mode === 'rot' && G.round >= 5 && G.round % 5 === 0) return intermission();
    E.ui.banner('ROUND ' + G.round);
  }

  function intermission() {
    G.state = 'intermission';
    G.ire = null; E.ui.setIre(null);
    E.ui.showIntermission((id) => {
      G.entity = id;
      G.mime = null; G.ire = null; E.ui.clearEntities();
      if (id === 'mime') { const l = (G.lane + 1) % 3; G.mime = { lane: l, x: C.LANES[l] }; E.ui.setMime(true); E.ui.placeMime(G.mime.x); }
      if (id === 'ire') G.ire = { phase: 'wait', t: 4 };
      G.state = 'playing'; E.ui.hideIntermission(); E.ui.banner('ROUND ' + G.round);
    });
  }

  // ---- Ire -----------------------------------------------------------------
  const IRE_GIF = { appear: 'ireAppear', semi: 'ireAttack', frown: 'ireFrown' };
  function irePhase(name) {
    const I = G.ire; I.phase = name;
    I.t = (E.gifMs[IRE_GIF[name]] || 1500) / 1000;
    if (name === 'mad') {
      I.attack = false; I.done = false; I.still = 0;
      I.closeCall = (G.time - G.lastMoveT) < 0.5; // moved <0.5s before attacking state began
    }
    E.ui.setIre(name);
  }
  function updateIre(dt) {
    const I = G.ire; if (!I) return;
    if (I.phase === 'mad') {
      if (I.done) return;
      if (I.attack) { I.attackT -= dt; if (I.attackT <= 0) { I.done = true; gameOver('ire'); } }
      else { I.still += dt; if (I.still >= 0.25) { I.done = true; irePhase('frown'); } } // survived -> frown anim, then despawn
      return;
    }
    I.t -= dt; if (I.t > 0) return;
    if (I.phase === 'wait') irePhase('appear');
    else if (I.phase === 'appear') irePhase('semi');
    else if (I.phase === 'semi') irePhase('mad');
    else if (I.phase === 'frown') {
      B.award('allequal'); if (I.closeCall) B.award('wakeup');
      E.ui.setIre(null); I.phase = 'wait'; I.t = 8 + Math.random() * 6;
    }
  }

  // ---- end states ----------------------------------------------------------
  function gameOver(cause) {
    if (G.state === 'dying' || G.state === 'over') return;
    G.state = 'dying'; const id = runId;
    E.ui.clearEntities();
    A.play('lose', { loop: false, onend: () => {
      if (id !== runId || G.state !== 'dying') return;
      G.state = 'over'; E.ui.showGameOver({ cause, score: G.score, round: G.round, mode: G.mode });
    } });
  }
  function victory() {
    G.state = 'won'; E.ui.clearEntities(); A.stopAll();
    E.save.pitUnlocked = true; E.persist();
    E.ui.showVictory({ score: G.score, round: 10 });
  }

  // ---- tab visibility: pause, then 3s countdown on return -------------------
  document.addEventListener('visibilitychange', () => {
    const inRun = ['playing', 'countdown', 'paused', 'intermission'].includes(G.state);
    if (document.hidden) {
      if (!inRun) return;
      if (G.state === 'playing' || G.state === 'countdown') { G.state = 'paused'; E.ui.countdown(null); }
      A.suspend();
    } else {
      if (G.state === 'paused') { G.state = 'countdown'; G.cd = 3; E.ui.countdown(3); }
      else if (G.state === 'intermission') A.resume();
    }
  });

  // ---- drawing -------------------------------------------------------------
  function draw() {
    const ctx = E.ui.ctx(); if (!ctx) return;
    ctx.clearRect(0, 0, C.W, C.H);
    ctx.fillStyle = '#ffffff22'; ctx.fillRect(0, C.PLAYER_Y + C.PLAYER_SIZE, C.W, 2);
    for (const e of G.eggs) {
      const x = C.LANES[e.lane] - C.EGG / 2;
      if (e.rotten) { ctx.fillStyle = '#888'; ctx.fillRect(x - 1, e.y - 1, 6, 6); ctx.fillStyle = '#000'; }
      else ctx.fillStyle = '#fff';
      ctx.fillRect(x, e.y, C.EGG, C.EGG);
    }
    const im = E.img[G.runT > 0 ? 'run' : 'idle'], s = C.PLAYER_SIZE;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (G.state === 'dying' || G.state === 'over') ctx.globalAlpha = 0.4;
    if (im) {
      ctx.translate(G.visX, 0); if (G.runT > 0 && G.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(im, -s / 2, C.PLAYER_Y, s, s);
    } else { ctx.fillStyle = '#f0f'; ctx.fillRect(G.visX - s / 2, C.PLAYER_Y, s, s); }
    ctx.restore();
    ctx.font = '8px monospace'; ctx.textAlign = 'center';
    for (const f of G.fx) { ctx.globalAlpha = Math.min(1, f.t * 2); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y - (0.7 - f.t) * 30); }
    ctx.globalAlpha = 1;
  }
})(window.EGG);

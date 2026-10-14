// EGG - all DOM/screens/input. Builds the page inside #app, then boots the game.
(function (E) {
  'use strict';
  const C = E.C, G = E.game, A = E.audio;
  const app = document.getElementById('app');
  const im = (k, cls, id) => `<img ${id ? `id="${id}"` : ''} class="${cls || ''}" src="${E.url(E.IMAGES[k])}" data-path="${E.IMAGES[k]}" alt="${k}">`;
  let scr = 'loading', menuSel = 0, modeSel = 0, interSel = 0, overSel = 0, introTimer = 0, interCb = null, pf, cv, cx, hudEl, banEl, cdEl, entEl, over = null;

  app.innerHTML = `
    <section id="loading" class="screen on"><div class="big">LOADING EGG...</div></section>
    <section id="menu" class="screen"><div class="logoWrap">${im('logo', '', 'logo')}</div><div id="menuBtns"></div><div class="hint">LEFT / RIGHT + ENTER</div></section>
    <section id="badges" class="screen"><h1>BADGES</h1><div id="badgeGrid"></div><div id="badgeBack" style="margin-top:2vh"><button class="btn sel" id="bb">BACK</button></div></section>
    <section id="pitIntro" class="screen"><div class="frame">${im('pitIntro')}</div></section>
    <section id="pitModes" class="screen"><div class="frame">${im('pitModes')}
      <div class="hit" id="mDecay" style="left:15%;top:33%;width:28%;height:40%"></div>
      <div class="hit" id="mRot" style="left:57%;top:35%;width:28%;height:41%"></div></div></section>
    <section id="game" class="screen"><div id="playfield"><canvas id="cv" width="${C.W}" height="${C.H}"></canvas>
      <div id="ents"></div><div id="hud"></div><div id="banner"></div><div id="cd"></div></div></section>
    <section id="inter" class="screen"><div class="big">CHOOSE AN ENTITY</div><div class="cards" id="interCards"></div><div class="hint">LEFT / RIGHT + ENTER</div></section>
    <section id="over" class="screen"><div class="big" id="overText"></div><div id="overBtns" style="display:flex;gap:3vmin"></div></section>
    <div id="toasts"></div><div id="warn"></div>`;
  app.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') E.assetFail(e.target.dataset.path); }, true);

  pf = document.getElementById('playfield'); cv = document.getElementById('cv'); cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
  hudEl = document.getElementById('hud'); banEl = document.getElementById('banner'); cdEl = document.getElementById('cd'); entEl = document.getElementById('ents');

  function show(name, bg) {
    scr = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === name));
    if (bg !== undefined) app.style.backgroundImage = bg ? `url("${E.url(E.IMAGES[bg])}")` : 'none';
  }
  function resize() {
    const w = innerWidth, h = innerHeight, ph = Math.min(h * 0.96, w * 0.96 * C.H / C.W), pw = ph * C.W / C.H;
    pf.style.width = pw + 'px'; pf.style.height = ph + 'px';
    document.documentElement.style.setProperty('--u', pw / C.W + 'px');
  }
  addEventListener('resize', resize); resize();

  // ---- API used by game.js ---------------------------------------------------
  E.ui = {
    ctx: () => (scr === 'game' || scr === 'inter' || scr === 'over' ? cx : null),
    showGame(mode) { show('game', mode === 'main' ? 'menuBg' : 'pitBg'); resize(); },
    hud() {
      let h = ''; for (let i = 0; i < 3; i++) h += `<b class="h ${i < G.hp ? '' : 'e'}">♥</b>`;
      for (let i = 0; i < G.overheal; i++) h += '<b class="oh">♥</b>';
      hudEl.innerHTML = `<div>${h}</div><div class="row"><span>${G.mode === 'main' ? 'R' + G.round + '/10' : 'ROUND ' + G.round}</span><span>${G.score}</span></div>`;
    },
    banner(t) { banEl.textContent = t; banEl.classList.remove('show'); void banEl.offsetWidth; banEl.classList.add('show'); },
    countdown(n) { cdEl.classList.toggle('on', n != null); if (n != null) cdEl.textContent = n; },
    flash() { pf.classList.remove('hit'); void pf.offsetWidth; pf.classList.add('hit'); },
    setMime(on) {
      const o = entEl.querySelector('.mime'); if (o) o.remove();
      if (on) entEl.insertAdjacentHTML('beforeend', im('mime', 'mime'));
    },
    placeMime(x) { const m = entEl.querySelector('.mime'); if (m) m.style.left = (x / C.W * 100) + '%'; },
    setIre(phase) {
      const o = entEl.querySelector('.ire'); if (o) o.remove();
      const k = { appear: 'ireAppear', semi: 'ireAttack', mad: 'ireActive', frown: 'ireFrown' }[phase];
      if (k) entEl.insertAdjacentHTML('beforeend', im(k, 'ire')); // new element => GIF restarts at frame 0
    },
    clearEntities() { entEl.innerHTML = ''; },
    showIntermission(cb) {
      interCb = cb; interSel = 0; show('inter', undefined); renderInter();
    },
    hideIntermission() { show('game'); interCb = null; },
    showGameOver(info) {
      over = info; overSel = 0; show('over');
      document.getElementById('overText').innerHTML = `GAME OVER<br>${{ mime: 'MIME GOT YOU', ire: 'IRE GOT YOU', hearts: 'OUT OF HEARTS' }[info.cause] || ''}<br><br>SCORE: ${info.score}<br>ROUNDS REACHED: ${info.round}`;
      renderOver(['RETRY', 'MENU']);
    },
    showVictory(info) {
      over = Object.assign({ win: true, mode: 'main' }, info); overSel = 0; show('over'); A.play('menu');
      document.getElementById('overText').innerHTML = `YOU BEAT THE GAME!<br><br>SCORE: ${info.score}<br>ROUNDS: 10/10<br><br>THE PIT IS NOW OPEN`;
      renderOver(['REPLAY', 'MENU']);
    },
    toast(def) {
      const t = document.createElement('div'); t.className = 'toast';
      t.innerHTML = `${im(def.img)}<div>BADGE UNLOCKED<br>${def.name}</div>`;
      document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 3600);
    }
  };

  // ---- menu ------------------------------------------------------------------
  const menuItems = () => [{ id: 'play', l: 'PLAY' }, { id: 'badges', l: 'BADGES' }].concat(E.save.pitUnlocked ? [{ id: 'pit', l: 'PIT' }] : []);
  function renderMenu() {
    const it = menuItems(); menuSel = Math.min(menuSel, it.length - 1);
    const el = document.getElementById('menuBtns');
    el.innerHTML = it.map((x, i) => `<button class="btn ${i === menuSel ? 'sel' : ''}" data-i="${i}">${x.l}</button>`).join('');
  }
  function showMenu() { G.quit(); show('menu', 'menuBg'); renderMenu(); A.play('menu'); }
  function menuGo(id) {
    if (id === 'play') G.start('main');
    else if (id === 'badges') showBadges();
    else if (id === 'pit') enterPit();
  }
  document.getElementById('menuBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; A.unlock(); menuSel = +b.dataset.i; menuGo(menuItems()[menuSel].id);
  });

  // ---- badges ----------------------------------------------------------------
  function showBadges() {
    show('badges', 'menuBg');
    document.getElementById('badgeGrid').innerHTML = E.BADGE_DEFS.map((b) => {
      const got = E.badges.has(b.id);
      return `<div class="badge ${got ? '' : 'locked'}">${im(b.img)}<div><b>${b.name}</b>${b.bio}<i>${b.sub}</i><u>${got ? 'UNLOCKED' : 'LOCKED'}</u></div></div>`;
    }).join('');
  }
  document.getElementById('bb').addEventListener('click', showMenu);

  // ---- PIT -------------------------------------------------------------------
  function enterPit() {
    if (!E.save.pitEntered) { E.save.pitEntered = true; E.persist(); E.badges.award('pit'); }
    A.play('pit'); show('pitIntro', '');
    clearTimeout(introTimer);
    introTimer = setTimeout(() => { if (scr === 'pitIntro') { modeSel = 0; show('pitModes', ''); renderModes(); } }, 400);
  }
  function renderModes() {
    document.getElementById('mDecay').classList.toggle('sel', modeSel === 0);
    document.getElementById('mRot').classList.toggle('sel', modeSel === 1);
  }
  document.getElementById('mDecay').addEventListener('click', () => G.start('decay'));
  document.getElementById('mRot').addEventListener('click', () => G.start('rot'));

  // ---- intermission ----------------------------------------------------------
  function renderInter() {
    const el = document.getElementById('interCards');
    el.innerHTML = E.ENTITIES.map((en, i) => `<div class="card ${i === interSel ? 'sel' : ''}" data-i="${i}">${im(en.img)}<b>${en.name}</b>${en.bio}<i>HINT: ${en.hint}</i></div>`).join('');
  }
  document.getElementById('interCards').addEventListener('click', (e) => {
    const c = e.target.closest('.card'); if (!c || scr !== 'inter') return; A.unlock(); interSel = +c.dataset.i; interCb(E.ENTITIES[interSel].id);
  });

  // ---- game over / victory ---------------------------------------------------
  function renderOver(labels) {
    document.getElementById('overBtns').innerHTML = labels.map((l, i) => `<button class="btn ${i === overSel ? 'sel' : ''}" data-i="${i}">${l}</button>`).join('');
  }
  function overGo(i) { if (i === 0) G.start(over.mode); else showMenu(); }
  document.getElementById('overBtns').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { A.unlock(); overGo(+b.dataset.i); } });

  // ---- keyboard ----------------------------------------------------------------
  addEventListener('keydown', (e) => {
    A.unlock();
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k)) e.preventDefault();
    const dir = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
    switch (scr) {
      case 'menu':
        if (dir) { const n = menuItems().length; menuSel = (menuSel + dir + n) % n; renderMenu(); }
        else if (k === 'Enter') menuGo(menuItems()[menuSel].id);
        else if (k === 'p' || k === 'P') { E.save.pitUnlocked = true; E.persist(); renderMenu(); } // testing shortcut
        break;
      case 'badges': if (k === 'Enter' || k === 'Escape') showMenu(); break;
      case 'pitModes':
        if (dir) { modeSel = modeSel ? 0 : 1; renderModes(); }
        else if (k === 'Enter') G.start(modeSel ? 'rot' : 'decay');
        else if (k === 'Escape') showMenu();
        break;
      case 'game':
        if (dir && !e.repeat) G.move(dir);
        else if (k === 'Escape' && G.state === 'playing') showMenu();
        break;
      case 'inter':
        if (dir) { interSel = (interSel + dir + E.ENTITIES.length) % E.ENTITIES.length; renderInter(); }
        else if (k === 'Enter') interCb(E.ENTITIES[interSel].id);
        break;
      case 'over':
        if (dir) { overSel = overSel ? 0 : 1; renderOver(over.win ? ['REPLAY', 'MENU'] : ['RETRY', 'MENU']); }
        else if (k === 'Enter') overGo(overSel);
        break;
    }
  });
  addEventListener('pointerdown', () => A.unlock());

  // ---- boot ----------------------------------------------------------------
  E.preload().then(showMenu);
})(window.EGG);

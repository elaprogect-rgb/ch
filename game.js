// Game engine: one instance per run. destroy() cancels loop + listeners so restarts never stack.
(function(){
const C = EGG.C, A = EGG.A, u = EGG.url;
const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const LX = l => l*C.LANE_W + C.LANE_W/2;
const rl = r => r <= 3 ? ri(5,10) : ri(15,25);

EGG.Game = function(mode){
  const g = this, pit = mode !== 'main';
  let round=1, score=0, hearts=3, over=0, lost=false, resolved=0, spawned=0, target=rl(1);
  let lane=1, runT=0, time=0, lastMove=-99, spawnT=1, eggs=[], entity=null, mime=null, ire=null, irT=6;
  let state='play', paused=false, count=0, raf=0, last=0;

  // ---- DOM ----
  EGG.app.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className='screen'; wrap.style.background='#000';
  const st = document.createElement('div'); st.className='stage';
  st.style.backgroundImage = `url("${u(pit ? A.pitBg : A.bg)}")`;
  st.innerHTML = '<div class="hud"></div><div class="eggs"></div>';
  const hud = st.querySelector('.hud'), layer = st.querySelector('.eggs');
  const mk = (cls, src) => { const i = document.createElement('img'); i.className = cls; if(src) i.src = u(src); i.onerror = () => console.warn('Asset failed:', i.src); st.appendChild(i); return i; };
  const pl = mk('pl', A.idle), mimeEl = mk('mime', A.mime), ireEl = mk('ire');
  mimeEl.style.display = 'none';
  const ov = document.createElement('div'); ov.className='ov'; st.appendChild(ov);
  wrap.appendChild(st); EGG.app.appendChild(wrap);
  const place = () => { pl.style.left = (LX(lane)-16)+'px'; };
  const drawHud = () => {
    hud.innerHTML = `<span><span class="hp">${'♥'.repeat(hearts)}${'♡'.repeat(3-hearts)}</span><span class="oh">${'♥'.repeat(over)}</span></span><span>R${round}</span><span>${score}</span>`;
  };
  place(); drawHud();

  // ---- difficulty ----
  function diff(){
    if (mode==='main'){ const l=round; return {int:Math.max(.7,1.5-.07*l), spd:1+.05*l, rot:round<2?0:Math.min(.4,.15+.03*l), dbl:0}; }
    if (mode==='decay'){ const l=Math.min(round,15); return {int:Math.max(.6,1.3-.05*l), spd:1+.04*l, rot:round<2?0:Math.min(.4,.2+.015*l), dbl:0}; }
    const l=Math.min(round,30); // roT: deliberately unfair
    return {int:Math.max(.18,.9-.03*l), spd:1.3+.08*l, rot:round<2?0:.5, dbl:Math.min(.7,.2+.02*l)};
  }

  // ---- events ----
  function hurt(){ lost = true; if (over>0) over--; else hearts--; if (hearts<=0) die(); }
  function resolve(e, caught){
    e.el.remove(); eggs.splice(eggs.indexOf(e),1); resolved++;
    if (caught) { if (e.rot){ score-=2000; hurt(); } else score+=1000; }
    else        { if (e.rot) score+=1000; else { score-=2000; hurt(); } }
    drawHud();
  }
  function die(){
    if (state==='dead') return; state='dead';
    EGG.audio.play('lose', {onend: () => EGG.ui.gameOver({mode, score, round})});
  }
  function spawn(d){
    const mkEgg = ln => {
      const el = document.createElement('div'); const rot = Math.random() < d.rot;
      el.className = 'egg' + (rot ? ' rot' : ''); layer.appendChild(el);
      eggs.push({y:-6, lane:ln, rot, el}); spawned++;
    };
    const ln = ri(0,2); mkEgg(ln);
    if (d.dbl && spawned < target && Math.random() < d.dbl) mkEgg((ln + ri(1,2)) % 3);
  }
  function endRound(){
    const done = round;
    if (done===3 && mode==='main') EGG.save.award('winner');
    if (done>=3 && !lost) EGG.save.award('winnerwinner');
    if (entity==='mime') EGG.save.award('handsoff');
    if (pit){
      if (done+1>=20 && !lost) EGG.save.award('battler');
      if (done+1>=50) EGG.save.award('hardstuck');
    }
    if (mode==='main' && done>=10){
      state='won'; EGG.audio.stopAll(); EGG.save.unlockPit();
      EGG.ui.victory({score}); return;
    }
    round++; resolved=0; spawned=0; target=rl(round);
    if (!pit){ if (hearts<3) hearts++; else over=Math.min(6,over+1); }   // no heal/overheal in PIT
    drawHud();
    if (mode==='rot' && round>=5 && round%5===0){
      state='inter';
      EGG.ui.pickEntity(id => { setEntity(id); state='play'; EGG.onKey = g.key; spawnT=1.5; });
    }
  }
  function setEntity(id){
    entity=id; mime=null; ire=null; mimeEl.style.display='none'; ireEl.style.display='none';
    if (id==='mime'){ mime={lane:(lane+1)%3}; mimeEl.style.left=(LX(mime.lane)-22)+'px'; mimeEl.style.display='block'; }
    if (id==='ire') irT = 4 + Math.random()*4;
  }

  // ---- Ire state machine: appear -> attack -> mad -> (still 0.25s: frown -> survived) | (moved: kill after 1s) ----
  function ireGo(s){
    ire.s = s;
    const src = {appear:A.ireAppear, attack:A.ireAttack, mad:A.ireActive, kill:A.ireActive, frown:A.ireFrown}[s];
    ireEl.src = u(src) + '?r=' + Date.now();      // cache-bust query restarts the GIF
    if (s==='appear') ire.t = C.IRE.appear; else if (s==='attack') ire.t = C.IRE.attack;
    else if (s==='frown') ire.t = C.IRE.frown;
    else if (s==='mad'){ ire.still = 0; ire.late = (time - lastMove) < 0.5; }
    else if (s==='kill') ire.t = C.IRE_KILL_DELAY;
  }
  function ireUpdate(dt){
    if (!ire){ irT -= dt; if (irT<=0){ ire={}; ireEl.style.display='block'; ireGo('appear'); } return; }
    if (ire.s==='appear'){ ire.t-=dt; if(ire.t<=0) ireGo('attack'); }
    else if (ire.s==='attack'){ ire.t-=dt; if(ire.t<=0) ireGo('mad'); }
    else if (ire.s==='mad'){ ire.still+=dt; if(ire.still>=C.IRE_STILL) ireGo('frown'); }
    else if (ire.s==='kill'){ ire.t-=dt; if(ire.t<=0){ ire=null; die(); } }
    else if (ire.s==='frown'){ ire.t-=dt; if(ire.t<=0){
      EGG.save.award('allequal'); if (ire.late) EGG.save.award('wakeup');
      ire=null; ireEl.style.display='none'; irT=ri(6,12);
    } }
  }

  // ---- input ----
  function move(dir){
    if (state!=='play' || paused || count>0) return;
    const old = lane, nl = (lane+dir+3)%3;
    if (mime && nl===mime.lane){ lane=nl; place(); die(); return; }   // moving into Mime = instant death
    lane = nl; lastMove = time; place();
    if (mime){ mime.lane = old; mimeEl.style.left=(LX(old)-22)+'px'; }
    pl.src = u(A.run); runT = C.RUN_TIME;
    if (ire && ire.s==='mad'){ ireGo('kill'); }
  }
  g.key = e => { if (e.repeat) return; if (e.key==='ArrowLeft') move(-1); else if (e.key==='ArrowRight') move(1); };
  st.addEventListener('pointerdown', e => { const r = st.getBoundingClientRect(); move(e.clientX < r.left + r.width/2 ? -1 : 1); });
  EGG.onKey = g.key;

  // ---- pause on tab switch ----
  const vis = () => {
    if (document.hidden){ paused=true; EGG.audio.pause(); }
    else { paused=false; if (state==='play'){ count=3; ov.style.display='flex'; ov.textContent='3'; } else EGG.audio.resume(); }
  };
  document.addEventListener('visibilitychange', vis);

  // ---- loop ----
  function update(dt){
    time += dt;
    if (runT>0){ runT-=dt; if(runT<=0) pl.src=u(A.idle); }
    const d = diff();
    let mul = 1;
    if (ire){ mul = ire.s==='attack' ? .35 : (ire.s==='mad'||ire.s==='kill') ? .12 : ire.s==='frown' ? .5 : 1; }
    spawnT -= dt*mul;
    if (spawnT<=0 && spawned<target){ spawn(d); spawnT = d.int*(.8+Math.random()*.4); }
    for (let i=eggs.length-1;i>=0;i--){
      const e = eggs[i]; e.y += C.SPEED*d.spd*mul*dt;
      e.el.style.transform = `translate(${LX(e.lane)-2}px,${e.y}px)`;
      if (e.lane===lane && e.y+C.EGG >= C.PLAYER_TOP+4) resolve(e,true);
      else if (e.y >= C.GROUND) resolve(e,false);
      if (state!=='play') return;
    }
    if (entity==='ire') ireUpdate(dt);
    if (state==='play' && resolved>=target) endRound();
  }
  function frame(t){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1,(t-last)/1000); last = t;
    if (paused) return;
    if (count>0){
      count -= dt; ov.textContent = Math.max(1,Math.ceil(count));
      if (count<=0){ count=0; ov.style.display='none'; EGG.audio.resume(); }
      return;
    }
    if (state==='play') update(dt);
  }
  raf = requestAnimationFrame(t => { last=t; frame(t); });

  g.destroy = () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); state='dead'; EGG.onKey=null; };
};
})();

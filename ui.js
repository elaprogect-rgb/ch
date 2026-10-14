// Screens: menu, badges, PIT intro/mode select, entity picker, game over, victory.
(function(){
const A = EGG.A, u = EGG.url, app = document.getElementById('app'), U = EGG.ui = {};
EGG.app = app; let tm = 0;
const clr = () => { clearTimeout(tm); if (EGG.cur){ EGG.cur.destroy(); EGG.cur=null; } EGG.onKey=null; };
function screen(bg, html){
  clr(); app.innerHTML = '<div class="screen" id="scr">'+html+'</div>';
  const s = document.getElementById('scr'); if (bg) s.style.backgroundImage = `url("${u(bg)}")`; return s;
}
function nav(n, get, set, act, back){
  return e => {
    if (e.key==='ArrowLeft') set((get()+n()-1)%n());
    else if (e.key==='ArrowRight') set((get()+1)%n());
    else if (e.key==='Enter') act(get());
    else if (back && e.key==='Escape') back();
  };
}

U.menu = () => {
  const s = screen(A.bg, `<img class="logo" src="${u(A.logo)}" alt="EGG"><div class="row" id="items"></div><p class="hint">← → select · Enter confirm</p>`);
  EGG.audio.play('menu', {loop:true});
  let sel = 0;
  const items = () => { const l=[['PLAY',()=>U.startGame('main')],['BADGES',U.badges]]; if (EGG.save.get().pit) l.push(['PIT',U.pitIntro]); return l; };
  const draw = () => {
    const l = items(); sel = Math.min(sel,l.length-1); const box = s.querySelector('#items'); box.innerHTML='';
    l.forEach(([n,f],i) => { const b=document.createElement('button'); b.className='btn'+(i===sel?' sel':''); b.textContent=n; b.onclick=()=>{sel=i;f();}; box.appendChild(b); });
  };
  draw();
  EGG.onKey = e => {
    if (e.key.toLowerCase()==='p'){ EGG.save.unlockPit(); draw(); return; }   // testing shortcut
    nav(()=>items().length, ()=>sel, v=>{sel=v;draw();}, i=>items()[i][1]())(e);
  };
};

U.badges = () => {
  const cards = EGG.BADGES.map(b => { const ok = EGG.save.has(b.id);
    return `<div class="badge ${ok?'':'locked'}"><img src="${u(b.img)}" alt=""><b>${b.name}</b>${b.bio}<small>${b.sub}</small><small>${ok?'UNLOCKED':'LOCKED'}</small></div>`; }).join('');
  screen(A.bg, `<h1>BADGES</h1><div class="badges">${cards}</div><button class="btn sel" id="back">BACK</button>`);
  document.getElementById('back').onclick = U.menu;
  EGG.onKey = e => { if (e.key==='Enter' || e.key==='Escape') U.menu(); };
};

U.pitIntro = () => {
  EGG.save.unlockPit(); EGG.save.award('pit');
  EGG.audio.play('pit', {loop:true});
  const s = screen(null, `<img class="full" src="${u(A.pitIntro)}">`); s.style.background='#000';
  tm = setTimeout(U.modeSelect, 400);
};

U.modeSelect = () => {
  const s = screen(null, `<div class="modebox"><button class="hit" id="decay" style="left:16%;top:34%;width:26%;height:38%"></button><button class="hit" id="rot" style="left:57.5%;top:35%;width:27%;height:40%"></button></div>`);
  s.style.background = '#600';
  s.querySelector('.modebox').style.backgroundImage = `url("${u(A.pitSelect)}")`;
  let sel = 0; const modes = ['decay','rot'];
  const draw = () => modes.forEach((m,i) => s.querySelector('#'+m).classList.toggle('sel', i===sel));
  modes.forEach((m,i) => s.querySelector('#'+m).onclick = () => U.startGame(m));
  draw();
  EGG.onKey = nav(()=>2, ()=>sel, v=>{sel=v;draw();}, i=>U.startGame(modes[i]), U.menu);
};

U.startGame = mode => {
  clr();
  EGG.audio.play(mode==='main' ? 'game' : 'pit', {loop:true});
  EGG.cur = new EGG.Game(mode);
};

U.pickEntity = cb => {
  const o = document.createElement('div'); o.className = 'screen overlay'; o.style.zIndex = 20;
  o.innerHTML = '<h1>CHOOSE AN ENTITY</h1><div class="cards"></div>';
  const box = o.querySelector('.cards'); let sel = 0;
  EGG.ENT.forEach((en,i) => { const c=document.createElement('div'); c.className='card';
    c.innerHTML = `<img src="${u(en.img)}" alt=""><h2>${en.name}</h2><p>${en.bio}</p><p class="hint">Hint: ${en.hint}</p>`;
    c.onclick = () => pick(i); box.appendChild(c); });
  const draw = () => [...box.children].forEach((c,i) => c.classList.toggle('sel', i===sel));
  const pick = i => { o.remove(); cb(EGG.ENT[i].id); };
  app.appendChild(o); draw();
  EGG.onKey = nav(()=>EGG.ENT.length, ()=>sel, v=>{sel=v;draw();}, pick);
};

function endScreen(title, lines, retry){
  const s = screen(A.bg, `<h1>${title}</h1><p>${lines}</p><div class="row"><button class="btn sel" id="a">${retry?'RETRY':'CONTINUE'}</button>${retry?'<button class="btn" id="b">MENU</button>':''}</div>`);
  const a = document.getElementById('a'), b = document.getElementById('b');
  a.onclick = () => retry ? retry() : U.menu(); if (b) b.onclick = U.menu;
  EGG.onKey = e => { if (e.key==='Enter') a.click(); else if (e.key==='Escape') U.menu(); };
}
U.gameOver = r => endScreen('GAME OVER', `Score: ${r.score}<br>Rounds reached: ${r.round}`, () => U.startGame(r.mode));
U.victory = r => { endScreen('YOU BEAT EGG', `Score: ${r.score}<br>The PIT has opened.`); EGG.audio.play('menu',{loop:true}); };
})();

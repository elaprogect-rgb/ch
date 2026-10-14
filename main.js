(()=>{
const C=EGG.cfg,B=EGG.badges,A=EGG.audio,g=EGG.game,$=id=>document.getElementById(id);
const screens=['menu','badges','pitintro','modes','stage','inter','over'];
let cur='menu',sel=0,items=[],interCb=null,entSel=0,modeSel=0,started=false;
document.body.style.backgroundImage=`url("${C.url(C.A.menuBg)}")`;
$('logo').src=C.url(C.A.logo);$('logo').onerror=()=>console.error('Asset failed:',C.A.logo);
function show(n){cur=n;screens.forEach(s=>{$(s).hidden=s!==n});
 if(n==='inter')$('stage').hidden=false;}
function buildMenu(){items=[['PLAY',playMain],['BADGES',showBadges]];if(B.pitUnlocked())items.push(['PIT',enterPit]);
 sel=Math.min(sel,items.length-1);const m=$('menuItems');m.innerHTML='';
 items.forEach((it,i)=>{const b=document.createElement('button');b.className='btn'+(i===sel?' sel':'');b.textContent=it[0];
  b.onclick=()=>{sel=i;it[1]()};m.appendChild(b)})}
function menu(){g.stop();show('menu');buildMenu();if(started)A.play('mMenu')}
function playMain(){show('stage');A.play('mGame');g.start('main')}
function showBadges(){show('badges');const gr=$('badgeGrid');gr.innerHTML='';
 C.badges.forEach(b=>{const u=B.has(b.id),d=document.createElement('div');d.className='card'+(u?'':' locked');
  d.innerHTML=`<img src="${C.url(b.img)}" alt=""><b>${b.name}</b><small>"${b.bio}"</small><small>${b.sub}</small><small>${u?'UNLOCKED':'LOCKED'}</small>`;gr.appendChild(d)})}
function enterPit(){B.unlockPit();B.award('pit');A.stopAll();show('pitintro');
 $('pitintro').style.backgroundImage=`url("${C.url(C.A.pitIntro)}")`;
 setTimeout(()=>{if(cur==='pitintro'){$('modes').style.backgroundImage=`url("${C.url(C.A.modes)}")`;show('modes')}},400)}
function startPit(mode){show('stage');A.play('mPit');g.start(mode)}
$('mDecay').onclick=()=>startPit('decay');$('mRot').onclick=()=>startPit('rot');
EGG.ui={
 over(win,score,round,pit){show('over');$('overTitle').textContent=win?'YOU WIN!':'GAME OVER';
  $('overText').textContent=`Score: ${score} — Rounds reached: ${round}`;if(win)A.play('mMenu')},
 inter(cb){interCb=cb;entSel=0;A.pause();show('inter');const c=$('entCards');c.innerHTML='';
  C.ents.forEach((e,i)=>{const d=document.createElement('div');d.className='card'+(i===entSel?' sel':'');
   d.innerHTML=`<img src="${C.url(e.gif)}" alt=""><b>${e.name}</b><small>${e.bio}</small><small>Hint: ${e.hint}</small>`;
   d.onclick=()=>{entSel=i;pick()};c.appendChild(d)})}};
function pick(){g.addEntity(C.ents[entSel].id);A.resume();show('stage');interCb&&interCb();interCb=null}
function markEnts(){[...$('entCards').children].forEach((d,i)=>d.classList.toggle('sel',i===entSel))}
addEventListener('keydown',e=>{
 if(!started&&cur==='menu'){started=true;A.play('mMenu')}
 const k=e.key;
 if(cur==='stage'){if(k==='ArrowLeft'){g.move(-1);e.preventDefault()}if(k==='ArrowRight'){g.move(1);e.preventDefault()}}
 else if(cur==='menu'){if(k==='ArrowLeft')sel=(sel+items.length-1)%items.length;
  else if(k==='ArrowRight')sel=(sel+1)%items.length;
  else if(k==='Enter')items[sel][1]();
  else if(k==='p'||k==='P')B.unlockPit();
  buildMenu()}
 else if(cur==='badges'){if(k==='Enter'||k==='Escape')menu()}
 else if(cur==='modes'){if(k==='ArrowLeft'||k==='ArrowRight')modeSel=1-modeSel;if(k==='Enter')startPit(modeSel?'rot':'decay')}
 else if(cur==='inter'){if(k==='ArrowLeft'||k==='ArrowRight'){entSel=(entSel+1)%C.ents.length;markEnts()}if(k==='Enter')pick()}
 else if(cur==='over'){if(k==='Enter')menu()}});
addEventListener('click',()=>{if(!started){started=true;if(cur==='menu')A.play('mMenu')}},{once:false});
buildMenu();
})();

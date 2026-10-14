(()=>{
const C=EGG.cfg,B=EGG.badges,AU=EGG.audio,$=id=>document.getElementById(id);
const W=240,H=320,LX=[40,120,200],GROUND=292,PTOP=252,TICK=.07,STEP=7;
const cv=$('cv'),ctx=cv.getContext('2d');cv.width=W;cv.height=H;ctx.imageSmoothingEnabled=false;
const im={};for(const k of['idle','run','pitBg','menuBg']){const i=new Image();i.onerror=()=>console.error('Asset failed:',C.A[k]);i.src=C.url(C.A[k]);im[k]=i}
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const roundLen=r=>r<=3?rnd(5,10):rnd(15,25);
const mimeEl=$('mime'),ireEl=$('ire');
let s=null;
const g=EGG.game={get s(){return s}};
const setX=(el,l)=>el.style.left=(LX[l]/W*100)+'%';
const gif=(el,k)=>{el.src=C.url(C.A[k])+'?'+Date.now();el.hidden=false};

g.start=mode=>{
 s={mode,pit:mode!=='main',round:1,len:roundLen(1),spawned:0,resolved:0,hp:3,oh:0,score:0,lane:1,runT:0,eggs:[],acc:0,sp:0,
 lostEver:false,noLoss:0,ents:{},mime:null,ire:null,ireDone:false,ireAt:0,ticks:0,paused:false,count:0,inter:false,dead:false};
 s.ireAt=rnd(15,50);
 mimeEl.hidden=true;ireEl.hidden=true;$('count').hidden=true;};
g.stop=()=>{s=null;mimeEl.hidden=true;ireEl.hidden=true};
g.addEntity=id=>{s.ents[id]=true;if(id==='mime'){s.mime={lane:(s.lane+1)%3};setX(mimeEl,s.mime.lane);gif(mimeEl,'mime')}};

const diff=()=>Math.min(s.round,s.mode==='decay'?15:s.mode==='rot'?30:10);
function spawnEgg(lane){const d=diff(),pr=s.mode==='rot'?Math.min(.7,.3+d*.02):Math.min(.45,.12+d*.03);
 s.eggs.push({lane,y:-8,rotten:s.round>=2&&Math.random()<pr});s.spawned++;}
function damage(){s.lostEver=true;if(s.oh>0)s.oh--;else s.hp--;if(s.hp<=0)die();}
function die(){if(s.dead)return;s.dead=true;mimeEl.hidden=true;ireEl.hidden=true;$('count').hidden=true;
 AU.play('mLose',false,()=>EGG.ui.over(false,s.score,s.round,s.pit));}
function resolve(e,caught){
 if(e.rotten){if(caught){s.score-=2000;damage()}else s.score+=1000}
 else{if(caught)s.score+=1000;else{s.score-=2000;damage()}}
 s.resolved++;if(!s.dead&&s.resolved>=s.len)endRound();}
function endRound(){
 const r=s.round;
 if(!s.pit){if(r===3){B.award('winner');if(!s.lostEver)B.award('winnerwinner')}}
 if(s.ents.mime)B.award('handsoff');
 if(!s.pit&&r>=10){s.dead=true;AU.stopAll();mimeEl.hidden=true;ireEl.hidden=true;B.unlockPit();EGG.ui.over(true,s.score,10,false);return}
 s.round++;s.len=roundLen(s.round);s.spawned=s.resolved=0;s.sp=0;s.ticks=0;s.ireDone=false;s.ireAt=rnd(15,50);
 if(s.pit){if(s.round>=20&&!s.lostEver)B.award('battler');if(s.round>=50)B.award('hardstuck')}
 else if(s.hp<3)s.hp++;else if(s.oh<6)s.oh++;
 if(s.mode==='rot'&&s.round>=5&&s.round%5===0){s.inter=true;EGG.ui.inter(()=>{s.inter=false})}}
function step(){
 const d=diff(),mul=s.mode==='rot'?1.2+d*.08:1+d*.03;
 for(const e of s.eggs){if(e.done)continue;e.y+=STEP*mul;
  if(e.lane===s.lane&&e.y+4>=PTOP){e.done=1;resolve(e,true)}else if(e.y>=GROUND){e.done=1;resolve(e,false)}
  if(s.dead)return}
 s.eggs=s.eggs.filter(e=>!e.done);
 s.ticks++;s.sp++;
 const iv=s.mode==='rot'?Math.max(2,8-d*.25):Math.max(5,16-d*.7);
 if(s.sp>=iv&&s.spawned<s.len){s.sp=0;const l=rnd(0,2);spawnEgg(l);
  if(s.mode==='rot'&&d>=6&&s.spawned<s.len)spawnEgg((l+rnd(1,2))%3)}
 if(s.ents.ire&&!s.ire&&!s.ireDone&&s.ticks>=s.ireAt){s.ire={st:'spawn',t:0,madT:0,kill:null,wake:false};gif(ireEl,'ireAppear')}}
function updIre(dt){const q=s.ire;if(!q)return;q.t+=dt;
 if(q.st==='spawn'&&q.t>=C.ire.appear){q.st='semi';q.t=0;gif(ireEl,'ireAttack')}
 else if(q.st==='semi'&&q.t>=C.ire.attack){q.st='mad';q.t=0;q.madT=0;gif(ireEl,'ireActive')}
 else if(q.st==='mad'){q.madT+=dt;
  if(q.kill!==null){q.kill-=dt;if(q.kill<=0){q.st='dead';die()}}
  else if(q.madT>=.25){q.st='frown';q.t=0;gif(ireEl,'ireFrown')}}
 else if(q.st==='frown'&&q.t>=C.ire.frown){ireEl.hidden=true;s.ire=null;s.ireDone=true;
  B.award('allequal');if(q.wake)B.award('wakeup')}}
const ireMul=()=>!s.ire?1:s.ire.st==='semi'?.4:s.ire.st==='mad'?.15:1;

g.move=dir=>{
 if(!s||s.dead||s.paused||s.count>0||s.inter)return;
 const old=s.lane;s.lane=(s.lane+dir+3)%3;s.runT=.4;
 if(s.mime){if(s.lane===s.mime.lane){die();return}s.mime.lane=old;setX(mimeEl,old)}
 const q=s.ire;if(q){if(q.st==='semi'&&C.ire.attack-q.t<.5)q.wake=true;
  if(q.st==='mad'&&q.kill===null)q.kill=1}};

g.pause=()=>{if(s&&!s.dead&&!s.inter&&!s.paused){s.paused=true;AU.pause()}};
g.resume=()=>{if(s&&s.paused){s.paused=false;s.count=3}};
document.addEventListener('visibilitychange',()=>document.hidden?g.pause():g.resume());
window.addEventListener('blur',g.pause);

let last=performance.now();
function loop(t){const dt=Math.min(.1,(t-last)/1000);last=t;
 if(s&&!s.dead&&!s.paused&&!s.inter){
  if(s.count>0){s.count-=dt;if(s.count<=0){s.count=0;AU.resume()}}
  else{s.runT=Math.max(0,s.runT-dt);updIre(dt);if(!s.dead){s.acc+=dt*ireMul();while(s.acc>=TICK&&!s.dead){s.acc-=TICK;step()}}}}
 draw();requestAnimationFrame(loop)}
function draw(){if(!s)return;
 const bg=s.pit?im.pitBg:im.menuBg;
 ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);if(bg.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,W,H);
 for(const e of s.eggs){ctx.fillStyle=e.rotten?'#000':'#fff';ctx.fillRect(LX[e.lane]-2,e.y,4,4);
  if(e.rotten){ctx.strokeStyle='#f33';ctx.strokeRect(LX[e.lane]-2.5,e.y-.5,5,5)}}
 const pi=s.runT>0?im.run:im.idle;if(pi.complete&&pi.naturalWidth)ctx.drawImage(pi,LX[s.lane]-16,GROUND-40,32,40);
 ctx.fillStyle='#f33';ctx.font='12px monospace';ctx.textAlign='left';ctx.fillText('♥'.repeat(Math.max(0,s.hp)),4,14);
 ctx.fillStyle='#4af';ctx.font='8px monospace';ctx.fillText('♥'.repeat(s.oh),4,24);
 ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.textAlign='right';ctx.fillText('SCORE '+s.score,W-4,12);ctx.fillText('ROUND '+s.round,W-4,24);
 const c=$('count');c.hidden=!(s.count>0||s.paused);c.textContent=s.paused?'II':Math.ceil(s.count);}
requestAnimationFrame(loop);
})();

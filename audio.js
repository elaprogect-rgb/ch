EGG.audio=(()=>{
const C=EGG.cfg,els={};let cur=null;
const get=k=>els[k]||(els[k]=Object.assign(new Audio(C.url(C.A[k])),{preload:'auto'}));
function stopAll(){for(const k in els){els[k].pause();els[k].currentTime=0;els[k].onended=null}cur=null}
return{stopAll,
play(k,loop=true,onend){stopAll();const a=get(k);a.loop=loop;a.onended=onend||null;cur=a;
 a.play().catch(e=>console.warn('Audio blocked/failed:',k,e));},
pause(){if(cur)cur.pause()},resume(){if(cur)cur.play().catch(()=>{})}};})();

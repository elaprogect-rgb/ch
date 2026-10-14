// One shared set of Audio objects; only one plays at a time.
EGG.audio = (() => {
  const m = {}; let cur = null, pending = null;
  const get = k => m[k] || (m[k] = new Audio(EGG.url(EGG.A[k])));
  function stopAll(){ Object.values(m).forEach(a => { a.pause(); try{a.currentTime=0}catch(e){} a.onended=null; a.onerror=null; }); cur=null; pending=null; }
  function play(k, o = {}){
    const a = get(k);
    if (cur === a && !a.paused && !o.onend) return;   // already playing, no duplicate
    stopAll();
    a.loop = !!o.loop; a.onended = o.onend || null; a.onerror = () => { console.warn('Audio failed:', EGG.A[k]); o.onend && o.onend(); };
    cur = a;
    const p = a.play();
    if (p && p.catch) p.catch(() => { pending = () => { if (cur === a) a.play().catch(()=>{}); }; });
  }
  return {
    play, stopAll,
    pause(){ cur && cur.pause(); },
    resume(){ cur && !cur.ended && cur.play().catch(()=>{}); },
    unlock(){ if (pending){ const f = pending; pending = null; f(); } }
  };
})();

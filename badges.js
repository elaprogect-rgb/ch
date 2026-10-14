// Persistence: badges + PIT unlock in localStorage.
EGG.save = (() => {
  let d = { badges:{}, pit:false };
  try { Object.assign(d, JSON.parse(localStorage.getItem('egg_save')) || {}); } catch(e){}
  const w = () => { try { localStorage.setItem('egg_save', JSON.stringify(d)); } catch(e){} };
  return {
    get: () => d,
    unlockPit(){ if(!d.pit){ d.pit = true; w(); } },
    has: id => !!d.badges[id],
    award(id){
      if (d.badges[id]) return false;
      d.badges[id] = Date.now(); w();
      const b = EGG.BADGES.find(x => x.id === id);
      const t = document.createElement('div'); t.className='toast'; t.textContent = 'BADGE: ' + (b ? b.name : id);
      document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
      return true;
    }
  };
})();

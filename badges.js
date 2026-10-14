EGG.badges=(()=>{
const K='egg_save_v1';let d={b:{},pit:false};
try{d=Object.assign(d,JSON.parse(localStorage.getItem(K)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}};
return{has:id=>!!d.b[id],pitUnlocked:()=>d.pit,
unlockPit(){d.pit=true;save()},
award(id){if(d.b[id])return false;d.b[id]=1;save();
 const b=EGG.cfg.badges.find(x=>x.id===id),t=document.getElementById('toast');
 if(b&&t){t.textContent='BADGE: '+b.name;t.style.display='block';setTimeout(()=>t.style.display='none',3000)}return true}};})();

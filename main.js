// Boot: one global key dispatcher, resize scaling, audio unlock.
(function(){
  const fit = () => document.documentElement.style.setProperty('--s', Math.min(innerWidth/EGG.C.W, innerHeight/EGG.C.H));
  addEventListener('resize', fit); fit();
  document.addEventListener('keydown', e => {
    EGG.audio.unlock();
    if (!EGG.onKey) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)) e.preventDefault();
    EGG.onKey(e);
  });
  document.addEventListener('pointerdown', () => EGG.audio.unlock());
  EGG.ui.menu();
})();

// EGG - audio manager. One Audio element per track, only one plays at a time.
(function (E) {
  const tracks = {}; let current = null, suspended = false;

  function get(name) {
    if (!tracks[name]) {
      const a = new Audio(E.url(E.AUDIO[name]));
      a.preload = 'auto';
      tracks[name] = a;
    }
    return tracks[name];
  }
  function stopAll() {
    for (const k in tracks) { const a = tracks[k]; a.onended = null; a.onerror = null; a.pause(); try { a.currentTime = 0; } catch (e) {} }
    current = null; suspended = false;
  }

  E.audio = {
    stopAll,
    play(name, opts) {
      opts = opts || {};
      const a = get(name);
      if (current === name && !a.paused && !opts.onend) return; // already playing, don't restart
      stopAll();
      current = name;
      a.loop = opts.loop !== false;
      a.onended = opts.onend ? () => { a.onended = null; opts.onend(); } : null;
      a.onerror = () => { E.assetFail(E.AUDIO[name]); if (opts.onend) { a.onerror = null; opts.onend(); } };
      const p = a.play();
      if (p && p.catch) p.catch((err) => {
        // Autoplay blocked: unlock() retries on first key/click. Other errors: don't hang the game-over flow.
        if (err && err.name !== 'NotAllowedError' && opts.onend) { a.onended = null; opts.onend(); }
      });
    },
    unlock() { // call from user gestures
      if (current && !suspended) { const a = get(current); if (a.paused) a.play().catch(() => {}); }
    },
    suspend() { if (current) { get(current).pause(); suspended = true; } },
    resume() { suspended = false; if (current) get(current).play().catch(() => {}); }
  };
})(window.EGG);

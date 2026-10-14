// EGG - image preloading, missing-asset tracking, GIF duration reader.
(function (E) {
  E.img = {};        // loaded Image objects by key
  E.gifMs = {};      // measured one-loop duration (ms) of GIFs
  E.missing = [];

  E.assetFail = function (path) {
    if (!path || E.missing.includes(path)) return;
    E.missing.push(path);
    console.error('EGG: asset failed to load ->', E.url(path));
    const w = document.getElementById('warn');
    if (w) { w.style.display = 'block'; w.textContent = 'MISSING ASSETS: ' + E.missing.join(' | '); }
  };

  function gifDuration(buf) {
    const b = new Uint8Array(buf); let p = 13, total = 0;
    if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1));
    const skip = () => { while (p < b.length && b[p] !== 0) p += b[p] + 1; p++; };
    while (p < b.length) {
      const t = b[p++];
      if (t === 0x21) {
        const label = b[p++];
        if (label === 0xF9) { const d = b[p + 2] | (b[p + 3] << 8); total += (d <= 1 ? 10 : d) * 10; }
        skip();
      } else if (t === 0x2C) {
        const f = b[p + 8]; p += 9;
        if (f & 0x80) p += 3 * (1 << ((f & 7) + 1));
        p++; skip();
      } else break;
    }
    return total;
  }

  E.preload = async function () {
    await Promise.all(Object.entries(E.IMAGES).map(([k, path]) => new Promise((res) => {
      const i = new Image();
      i.onload = () => { E.img[k] = i; res(); };
      i.onerror = () => { E.assetFail(path); res(); };
      i.src = E.url(path);
    })));
    await Promise.all(E.GIFS.map(async (k) => {
      try {
        const r = await fetch(E.url(E.IMAGES[k]));
        E.gifMs[k] = gifDuration(await r.arrayBuffer()) || 1500;
      } catch (e) { console.warn('EGG: could not measure GIF', k, e); E.gifMs[k] = 1500; }
    }));
  };
})(window.EGG);

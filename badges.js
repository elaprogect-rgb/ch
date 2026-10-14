// EGG - persistent save data + badge awarding.
(function (E) {
  const KEY = 'egg_save_v1';
  let save = { badges: {}, pitUnlocked: false, pitEntered: false };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) save = Object.assign(save, s); } catch (e) {}

  E.save = save;
  E.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
  E.badges = {
    has: (id) => !!save.badges[id],
    award(id) {
      if (save.badges[id]) return false; // never duplicate
      save.badges[id] = Date.now(); E.persist();
      const def = E.BADGE_DEFS.find((b) => b.id === id);
      if (def && E.ui && E.ui.toast) E.ui.toast(def);
      return true;
    }
  };
})(window.EGG);

// EGG - configuration: CDN, asset paths, constants, entity + badge data.
window.EGG = window.EGG || {};
(function (E) {
  E.CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
  // Encode each path segment (spaces, etc.) but keep slashes. Case is preserved.
  E.url = (p) => E.CDN + p.split('/').map(encodeURIComponent).join('/');

  // Paths are relative to the repository root, exactly as specified.
  E.IMAGES = {
    logo: 'EGG_Logo.webp',
    menuBg: 'Bg_minigolf2_0.webp',
    idle: 'EGG_CharlesIdle.png',
    run: 'EGG_CharlesRun.png',
    pitBg: 'OIP (7).webp',
    pitIntro: 'main/HESNOTHEREBUTiAM.png',
    pitModes: 'main/DECAY_ROT_screen.png',
    mime: 'main/MimeHand.gif',
    ireAppear: 'Ire_appear.gif',
    ireAttack: 'Ire_attack.gif',
    ireActive: 'main/Ire_active.gif',
    ireFrown: 'main/Ire_Frown_Animated.gif',
    b_hardstuck: 'main/Hardstuck_Badge.png',
    b_winner: 'Winner_Badge.png',
    b_winnerwinner: 'Winner_Winner_Badge.png',
    b_battler: 'Battler_Badge.png',
    b_handsoff: 'main/HANDSOFF_Badge.png',
    b_wakeup: 'WAKEUPCALL_Badge.png',
    b_allequal: 'All_equal_Badge.png',
    b_pit: 'DECORRUPT**(Y-N)_Badge.png'
  };
  E.GIFS = ['ireAppear', 'ireAttack', 'ireFrown']; // durations are measured from the files

  E.AUDIO = {
    menu: 'Incubating.mp3',
    game: 'Cracked-AllInstruments.mp3',
    lose: 'Scrambled.mp3',
    pit: 'main/The_Pit.mp3.mpeg'
  };

  // Logical playfield size (scaled with CSS). 3 lanes.
  E.C = {
    W: 240, H: 400,
    LANES: [40, 120, 200],
    PLAYER_Y: 346, PLAYER_SIZE: 38,
    CATCH_TOP: 350,     // egg bottom must pass this (bucket height)
    CATCH_BOTTOM: 378,  // ...but not be below this
    GROUND_Y: 380,
    EGG: 4, STEP_PX: 7, STEP_SEC: 0.07
  };

  // NOTE: bios/hints for entities are not in the spec; written in the spirit of it. Edit freely.
  E.ENTITIES = [
    { id: 'mime', name: 'MIME', img: 'mime',
      bio: 'It only ever copies you. One step late.',
      hint: 'Never retrace your steps.' },
    { id: 'ire', name: 'IRE', img: 'ireAppear',
      bio: 'Something up there is losing its patience.',
      hint: 'When it glares, hold still.' }
  ];

  E.BADGE_DEFS = [
    { id: 'hardstuck', img: 'b_hardstuck', name: 'Hardstuck', bio: 'You do nothing but cheat! Cheat i say!', sub: 'Make it to round 50.' },
    { id: 'winner', img: 'b_winner', name: 'Winner Winner Chicken Dinner!', bio: 'Winner Winner Chicken Dinner!', sub: 'Beat 3 rounds for the first time.' },
    { id: 'winnerwinner', img: 'b_winnerwinner', name: 'Winner Winner', bio: "You're a loser who sits and crys!", sub: 'Beat 3 rounds without losing a single heart.' },
    { id: 'battler', img: 'b_battler', name: 'Battler', bio: 'You cheated. No other words.', sub: 'Survive 20 rounds without losing 1 heart.' },
    { id: 'handsoff', img: 'b_handsoff', name: 'HANDSOFF', bio: 'IT JUST MAKES YOU HAPPY!', sub: 'Survive mime for the first time.' },
    { id: 'wakeup', img: 'b_wakeup', name: 'WAKEUPCALL', bio: 'YOU JUST LIVE ON AND ON.', sub: 'Survive ire with less then 0.5 seconds before they enter their attacking state.' },
    { id: 'allequal', img: 'b_allequal', name: 'All equal', bio: 'WONDERFUL!', sub: 'Survive ire for the first time.' },
    { id: 'pit', img: 'b_pit', name: 'DECORRUPT**(Y-N)', bio: 'YOU_ARE_JUST_GETTING_STARTED.', sub: 'Enter the pit for the first time.' }
  ];
})(window.EGG);

// EGG config: CDN, asset paths (relative to repo root), constants.
window.EGG = {};
EGG.CDN = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
EGG.url = p => EGG.CDN + encodeURI(p);
EGG.A = {
  logo:'EGG_Logo.webp', bg:'Bg_minigolf2_0.webp',
  idle:'EGG_CharlesIdle.png', run:'EGG_CharlesRun.png',
  menu:'Incubating.mp3', game:'Cracked-AllInstruments.mp3', lose:'Scrambled.mp3',
  pit:'main/The_Pit.mp3.mpeg', pitBg:'OIP (7).webp',
  pitIntro:'main/HESNOTHEREBUTiAM.png', pitSelect:'main/DECAY_ROT_screen.png',
  mime:'main/MimeHand.gif',
  ireAppear:'Ire_appear.gif', ireAttack:'Ire_attack.gif', ireActive:'main/Ire_active.gif', ireFrown:'main/Ire_Frown_Animated.gif'
};
EGG.C = {
  W:240, H:320, LANE_W:80, EGG:4,
  SPEED:100,            // 7px per 0.07s = 100 px/s (dt-based so it's framerate independent)
  PLAYER_TOP:288, GROUND:316, RUN_TIME:0.4,
  // GIFs can't report "finished", so set these to the real GIF lengths (seconds):
  IRE:{ appear:1.2, attack:2.0, frown:1.2 },
  IRE_STILL:0.25, IRE_KILL_DELAY:1.0
};
EGG.ENT = [
  {id:'mime',name:'MIME',img:'main/MimeHand.gif',bio:'IT JUST MAKES YOU HAPPY!',hint:'It follows where you have been. Never go back.'},
  {id:'ire',name:'IRE',img:'Ire_appear.gif',bio:'Something is watching from above.',hint:'When the eggs slow down, so should you.'}
];
EGG.BADGES = [
  {id:'hardstuck',name:'Hardstuck',img:'main/Hardstuck_Badge.png',bio:'You do nothing but cheat! Cheat i say!',sub:'Make it to round 50.'},
  {id:'winner',name:'Winner Winner Chicken Dinner!',img:'Winner_Badge.png',bio:'Winner Winner Chicken Dinner!',sub:'Beat 3 rounds for the first time.'},
  {id:'winnerwinner',name:'Winner Winner',img:'Winner_Winner_Badge.png',bio:"You're a loser who sits and crys!",sub:'Beat 3 rounds without losing a single heart.'},
  {id:'battler',name:'Battler',img:'Battler_Badge.png',bio:'You cheated. No other words.',sub:'Survive 20 rounds without losing 1 heart.'},
  {id:'handsoff',name:'HANDSOFF',img:'main/HANDSOFF_Badge.png',bio:'IT JUST MAKES YOU HAPPY!',sub:'Survive mime for the first time.'},
  {id:'wakeup',name:'WAKEUPCALL',img:'WAKEUPCALL_Badge.png',bio:'YOU JUST LIVE ON AND ON.',sub:'Survive ire with less then 0.5 seconds before they enter their attacking state.'},
  {id:'allequal',name:'All equal',img:'All_equal_Badge.png',bio:'WONDERFUL!',sub:'Survive ire for the first time.'},
  {id:'pit',name:'DECORRUPT',img:'DECORRUPT**(Y-N)_Badge.png',bio:'YOU_ARE_JUST_GETTING_STARTED.',sub:'Enter the pit for the first time.'}
];

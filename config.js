window.EGG={};
EGG.cfg=(()=>{
const CDN='https://cdn.jsdelivr.net/gh/elaprogect-rgb/ch@main/';
const url=p=>CDN+p.split('/').map(encodeURIComponent).join('/');
// ASSET PATHS: edit here if a file lives somewhere else in your repo.
const A={logo:'EGG_Logo.webp',menuBg:'Bg_minigolf2_0.webp',idle:'EGG_CharlesIdle.png',run:'EGG_CharlesRun.png',
pitBg:'OIP (7).webp',pitIntro:'main/HESNOTHEREBUTiAM.png',modes:'main/DECAY_ROT_screen.png',
mMenu:'Incubating.mp3',mGame:'Cracked-AllInstruments.mp3',mLose:'Scrambled.mp3',mPit:'main/The_Pit.mp3.mpeg',
mime:'main/MimeHand.gif',ireAppear:'Ire_appear.gif',ireAttack:'Ire_attack.gif',ireActive:'main/Ire_active.gif',ireFrown:'main/Ire_Frown_Animated.gif'};
const badges=[
{id:'hardstuck',img:'main/Hardstuck_Badge.png',name:'Hardstuck',bio:'You do nothing but cheat! Cheat i say!',sub:'Make it to round 50.'},
{id:'winner',img:'Winner_Badge.png',name:'Winner Winner Chicken Dinner!',bio:'Winner Winner Chicken Dinner!',sub:'Beat 3 rounds for the first time.'},
{id:'winnerwinner',img:'Winner_Winner_Badge.png',name:'Winner Winner',bio:"You're a loser who sits and crys!",sub:'Beat 3 rounds without losing a single heart.'},
{id:'battler',img:'Battler_Badge.png',name:'Battler',bio:'You cheated. No other words.',sub:'Survive 20 rounds without losing 1 heart.'},
{id:'handsoff',img:'main/HANDSOFF_Badge.png',name:'HANDSOFF',bio:'IT JUST MAKES YOU HAPPY!',sub:'Survive mime for the first time.'},
{id:'wakeup',img:'WAKEUPCALL_Badge.png',name:'WAKEUPCALL',bio:'YOU JUST LIVE ON AND ON.',sub:'Survive ire with less then 0.5 seconds before they enter their attacking state.'},
{id:'allequal',img:'All_equal_Badge.png',name:'All equal',bio:'WONDERFUL!',sub:'Survive ire for the first time.'},
{id:'pit',img:'DECORRUPT**(Y-N)_Badge.png',name:'DECORRUPT**(Y-N)',bio:'YOU_ARE_JUST_GETTING_STARTED.',sub:'Enter the pit for the first time.'}];
const ents=[
{id:'mime',name:'MIME',gif:A.mime,bio:'A silent hand that mirrors your steps.',hint:'It follows where you were. Never step back into it.'},
{id:'ire',name:'IRE',gif:A.ireAppear,bio:'It watches from above and it gets angry.',hint:'When it is truly mad, stillness is mercy.'}];
// GIF durations are not readable from the file, so set them to match your GIFs (seconds).
const ire={appear:1.5,attack:2.0,frown:1.2};
return{CDN,url,A,badges,ents,ire};})();

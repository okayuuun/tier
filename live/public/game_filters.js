'use strict';
/* Actual multiplayer limits enforced by the corresponding server game modules.
   Room-wide limit: 12, some game modes set smaller maxima. */
const GAME_PLAYERS={
 tier:[2,12],value:[2,12],either:[2,12],quiz:[2,12],
 ito:[2,10],propose:[2,12],soup:[2,12],akaito:[2,10],
 unique:[2,12],wolf:[3,12],unanimous:[2,12],insider:[4,12],
 secret_rank:[3,12],describe:[3,12],drawfake:[5,12],mysterymail:[2,12],
 senryu:[2,12],tanka:[2,12],booktitle:[3,12],
 artguide:[3,12],drawrelay:[3,12],artcontest:[2,12],artforbid:[2,12],
 drawbluff:[3,10],artmix:[3,12],artcollab:[2,12],
 reverseart:[2,12],invent:[2,12],chardesign:[2,12],episode:[3,12]
};
const GAME_FAVORITES=['episode','wolf','secret_rank','propose','unanimous','booktitle','drawrelay','quiz','unique','tier','either','value','tanka','artmix','artcontest'];
let gamesFor='all',gamesSort='recommended';
function playerRange(game){const [min,max]=GAME_PLAYERS[game]||[2,12];return '👥 '+min+'〜'+max+'人'}
function gameFilterBar(){
 const counts=[['all','全人数'],['2','2人'],['3','3人'],['4','4人'],['5','5人'],['6','6人']];
 const sorts=[['recommended','3〜5人向けおすすめ'],['minimum','必要人数が少ない順'],['maximum','上限人数が少ない順'],['name','ゲーム名順']];
 const select=(choices,selected,handler)=>'<select onchange="'+handler+'">'+choices.map(([id,label])=>'<option value="'+id+'" '+(id===selected?'selected':'')+'>'+label+'</option>').join('')+'</select>';
 return '<div class="nk-game-filterbar"><div class="nk-game-filterhead"><strong>🎲 何人で遊ぶ？</strong><small>3〜5人におすすめの順番で表示。2〜6人から指定できます。</small></div>'+
 '<label>参加人数'+select(counts,gamesFor,'setGamesFor(this.value)')+'</label>'+
 '<label>並べ替え'+select(sorts,gamesSort,'setGamesSort(this.value)')+'</label><span id="nk-games-count" aria-live="polite"></span></div>'
}
function setGamesFor(value){gamesFor=['all','2','3','4','5','6'].includes(value)?value:'all';applyGameFilters()}
function setGamesSort(value){gamesSort=['recommended','minimum','maximum','name'].includes(value)?value:'recommended';applyGameFilters()}
function applyGameFilters(){
 const grid=document.querySelector('[data-games-grid]');if(!grid)return;
 const nodes=[...grid.querySelectorAll('.game-option[data-game-key]')];
 const priority=k=>{const i=GAME_FAVORITES.indexOf(k);return i<0?100:i};
 const original=new Map(Object.keys(GAMES).map((key,i)=>[key,i]));
 nodes.sort((a,b)=>{
  const aKey=a.dataset.gameKey,bKey=b.dataset.gameKey,ar=GAME_PLAYERS[aKey],br=GAME_PLAYERS[bKey];
  if(gamesSort==='minimum')return ar[0]-br[0]||priority(aKey)-priority(bKey)||original.get(aKey)-original.get(bKey);
  if(gamesSort==='maximum')return ar[1]-br[1]||ar[0]-br[0]||original.get(aKey)-original.get(bKey);
  if(gamesSort==='name')return GAMES[aKey].title.localeCompare(GAMES[bKey].title,'ja');
  const aFit=ar[0]<=3&&ar[1]>=5?0:ar[0]<=4&&ar[1]>=5?1:2;
  const bFit=br[0]<=3&&br[1]>=5?0:br[0]<=4&&br[1]>=5?1:2;
  return aFit-bFit||priority(aKey)-priority(bKey)||original.get(aKey)-original.get(bKey)
 });
 let count=0;
 for(const el of nodes){
  const key=el.dataset.gameKey,[min,max]=GAME_PLAYERS[key],n=Number(gamesFor);
  const visible=(!PUBLIC_GAMES||PUBLIC_GAMES.includes(key))&&(gamesFor==='all'||min<=n&&n<=max);
  el.style.display=visible?'':'none';if(visible)count++;
  grid.appendChild(el)
 }
 const status=document.getElementById('nk-games-count');if(status)status.textContent=count+'種類'
}
function recentEchaLink(){
 let code='';try{code=localStorage.getItem('nk_echa_recent_room')||''}catch(_){}
 if(!/^[A-Z2-9]{6}$/.test(code))return '';
 return '<div class="nk-echa-recent"><div><strong>🎨 前回の絵チャ：'+code+'</strong><small>別のゲームに移ってもこのURLで戻れます。サーバー再起動後は消える場合があります。</small></div><a href="/echa?room='+code+'">この絵チャへ戻る</a></div>'
}

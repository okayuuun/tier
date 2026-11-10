'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/public/board_plus_ui.js','utf8');
const games={royalletter:'密書の駆け引き',cipherrelay:'ひみつの暗号便',skyfire:'みんなの花火',
 scoutline:'スカウト・ライン',aiuebattle:'ひらがな文字バトル'};
const players=Array.from({length:4},(_,i)=>({id:'p'+i,name:'参加者'+i,score:0,emoji:'🌷'}));
const app={innerHTML:''};
const context={app,me:'p0',GAMES:Object.fromEntries(Object.entries(games).map(([id,title])=>[id,{title,desc:'テスト'}])),
 room:null,console,Math,JSON,Set,
 panel:(a,b,c)=>a+b+c,roomBar:()=>'ROOM BAR',
 action:(name,fn)=>'<button>'+name+'</button>',
 esc:s=>String(s??''),send(){},error(){},
 document:{getElementById(){return {value:'1'}}}};
vm.createContext(context);vm.runInContext(src,context);
function show(game,phase,p){
 context.room={game,phase,boardplus:p,players,owner:'p0',active:players.map(x=>x.id)};
 vm.runInContext('renderBoardPlus()',context);
 assert(app.innerHTML.includes(games[game]),game+' title missing');
 assert(app.innerHTML.includes('ROOM BAR'),game+' room header missing');
 assert(app.innerHTML.length>200,game+' '+phase+' too little content');
}
const base={round:0,roundLimit:3,history:[],last:null};
show('royalletter','bp_royal',{...base,turn:'p0',hand:2,drawn:5,deckCount:10,gone:[],safe:[],discards:[]});
show('royalletter','bp_royal_reveal',{...base,round:0,turn:'p0',hand:2,drawn:null,deckCount:0,gone:[],
 discards:[],last:{winnerNames:['参加者0'],hands:{p0:4,p1:3}}});
const cipher={...base,roundLimit:6,team:'red',teams:{p0:'red',p1:'blue',p2:'red',p3:'blue'},
 teamScores:{red:1,blue:2},words:['りんご','風船','海','城'],side:'red',
 clueGiver:'p0',guesser:'p2',interceptor:'p1',code:[1,2,4],clues:['赤い','飛ぶ','深い'],
 submitted:{own:false,intercept:false}};
show('cipherrelay','bp_cipher_clue',cipher);
show('cipherrelay','bp_cipher_guess',{...cipher,code:null});
show('cipherrelay','bp_cipher_reveal',{...cipher,last:{code:[1,2,4],clues:['赤い','飛ぶ','深い'],ownCorrect:true,interceptCorrect:false}});
const hand=[{c:null,n:null},{c:null,n:null},{c:null,n:null},{c:null,n:null}];
const visible=[{c:'紅',n:1},{c:'蒼',n:2},{c:'翠',n:3}];
const progress={'紅':0,'蒼':1,'翠':1};
show('skyfire','bp_fire',{...base,turn:'p0',progress,lives:3,hints:6,deckCount:12,
 hands:{p0:hand,p1:visible,p2:visible,p3:visible},played:[],turns:0});
const scout={...base,turn:'p0',myHand:[1,2,3,4,5,6,7],field:[3,4],scouted:{p0:1},turns:2};
show('scoutline','bp_scout',scout);
show('scoutline','bp_scout_reveal',{...scout,last:{winnerName:'参加者0'}});
const ai={...base,theme:'食べもの',turn:'p0',mine:'かさ',submitted:['p0','p1','p2','p3'],
 called:['か'],out:[],attacks:[],boards:{
 p0:{letters:['か','さ']},p1:{letters:[null,'か',null]},p2:{letters:[null,null]},
 p3:{letters:[null,'か',null]}
}};
show('aiuebattle','bp_ai_write',{...ai,submitted:[],boards:{}});
show('aiuebattle','bp_ai_attack',ai);
show('aiuebattle','bp_ai_reveal',{...ai,last:{winnerName:'参加者1',words:{p0:'かさ',p1:'さかな',p2:'ねこ',p3:'みかん'}}});
for(const game of Object.keys(games)){
 show(game,'final',{...base,round:3,roundLimit:3,history:[],last:null,teamScores:{red:2,blue:1},
  progress,stars:{p0:1}});
}
console.log('PASS: five additional card/word game UI modes, reveal states and final pages');

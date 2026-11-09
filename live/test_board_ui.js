'use strict';
/* Smoke test every board UI phase without a browser dependency. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync(__dirname+'/public/board_ui.js','utf8');
const players=Array.from({length:4},(_,i)=>({id:'p'+i,name:'プレイヤー'+i,score:i,ws:true,emoji:'🌸'}));
const titles={
 oneword:'ひとこと一致',spectrum:'感覚メーター',quiet:'無言の数字',
 bluff:'花かドクロか',wordagents:'暗号ワード対決'
};
const GAMES=Object.fromEntries(Object.entries(titles).map(([k,title])=>[k,{title,desc:'説明'}]));
const app={innerHTML:''};
const ctx={app,GAMES,me:'p0',console,Math,JSON,
 document:{getElementById(){return {value:'テスト'}}},
 error:m=>{throw Error(m)},send:()=>{},panel:(x,y,z)=>x+y+z,roomBar:()=>'ROOM',
 action:(name,handler)=>'<button>'+name+'</button>',
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
 room:null
};
vm.createContext(ctx);vm.runInContext(js,ctx);
function render(game,phase,board){
 ctx.room={game,phase,board,code:'ABCDEF',owner:'p0',players,active:players.map(x=>x.id)};
 vm.runInContext('renderBoard()',ctx);
 assert(app.innerHTML.length>100,game+' '+phase+' produced empty UI');
 assert(app.innerHTML.includes('ROOM'),game+' '+phase+' lost room bar');
 assert(app.innerHTML.includes(titles[game]),game+' '+phase+' lost game title');
}
const names=players.map(x=>x.id);
const base={round:0,roundLimit:5,history:[],last:null};
render('oneword','bg_hint',{...base,roundLimit:6,guesser:'p1',word:'星',count:0,mine:false,clues:[]});
render('oneword','bg_guess',{...base,roundLimit:6,guesser:'p0',word:null,count:3,mine:false,clues:[{text:'夜',duplicate:false}]});
render('oneword','bg_reveal',{...base,roundLimit:6,guesser:'p0',last:{correct:true,word:'星',answer:'星',clues:[{text:'夜',duplicate:false}]}});
render('spectrum','sp_clue',{...base,guide:'p0',axis:['安い','高い'],target:73,clue:'',guessCount:0});
render('spectrum','sp_guess',{...base,guide:'p1',axis:['安い','高い'],target:null,clue:'おにぎり',guessCount:1,guessed:false});
render('spectrum','sp_reveal',{...base,guide:'p1',axis:['安い','高い'],last:{target:73,clue:'おにぎり',guesses:[{name:'プレイヤー0',guess:70,distance:3,points:3}]}});
render('quiet','qt_play',{...base,stage:1,roundLimit:3,lives:3,myHand:[30,65],remaining:4,misses:[],played:[]});
render('quiet','qt_reveal',{...base,stage:1,roundLimit:3,lives:3,myHand:[],remaining:0,misses:[],played:[]});
render('bluff','bl_place',{...base,stars:{p0:0},wounds:{p0:0},planted:[],placedCount:0,myCard:null,bid:0,passed:[],flipped:[]});
render('bluff','bl_bid',{...base,stars:{p0:0},wounds:{p0:0},planted:names,placedCount:4,bid:1,bidder:'p1',passed:[],flipped:[]});
render('bluff','bl_flip',{...base,stars:{p0:0},wounds:{p0:0},planted:names,placedCount:4,bid:2,bidder:'p0',passed:['p1','p2','p3'],flipped:[]});
render('bluff','bl_reveal',{...base,stars:{p0:1},wounds:{p0:0},planted:names,placedCount:4,bid:2,bidder:'p0',passed:[],
 flipped:[{by:'p0',name:'プレイヤー0',card:'safe'}],
 last:{success:true,bid:2,bidder:'p0',cards:[{name:'プレイヤー1',card:'safe'}]}});
const words=Array.from({length:16},(_,i)=>'単語'+i);
const agents={...base,words,teams:{p0:'red',p1:'blue',p2:'red',p3:'blue'},captains:{red:'p0',blue:'p1'},turn:'red',
 step:'clue',owners:Array.from({length:16},()=> 'red'),visibleOwners:{},revealed:[],counts:{red:6,blue:6},left:0,clue:'',number:0};
render('wordagents','wa_play',agents);
render('wordagents','wa_play',{...agents,step:'guess',left:2,number:2,clue:'動物'});
for(const game of Object.keys(titles)){
 render(game,'final',{
  ...base,round:6,roundLimit:6,history:[],last:null,stage:3,lives:1,
  stars:{p0:1},winner:'red'
 });
}
console.log('PASS: five board game client interfaces render all phases and final states');

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const util=fs.readFileSync(__dirname+'/public/recent_rooms.js','utf8');
const main=fs.readFileSync(__dirname+'/public/main.js','utf8');
const html=fs.readFileSync(__dirname+'/public/index.html','utf8');
const store=new Map();
const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),
 removeItem:k=>store.delete(k)};
const context={window:{},localStorage,Date,JSON,Number,String,Math,Set};
vm.createContext(context);vm.runInContext(util,context);
const API=context.window.NKRecent;
const code='ABC234',sid='session_12345678901234567890';
const entry={code,sid,name:'おかゆ',game:'tier',title:'みんなでティア表',retentionHours:72};
assert.equal(API.list().length,0);
assert.equal(API.remember(entry),true);
assert.equal(API.get(code).sid,sid);
assert.equal(API.get(code).name,'おかゆ');
assert.equal(API.list().length,1);
API.remember({...entry,title:'変更後のタイトル'});
assert.equal(API.get(code).title,'変更後のタイトル');
// Invalid codes and credentials never reach the recent-room list.
assert.equal(API.remember({...entry,code:'"<img>'}),false);
assert.equal(API.remember({...entry,sid:'short'}),false);
for(const c of ['BCD345','CDE456','DEF567','EFG678','FGH789']){
 assert.equal(API.remember({...entry,code:c}),true);
}
assert.equal(API.list().length,4);
assert.equal(API.get(code),null);
assert.equal(API.forget('FGH789'),true);
assert.equal(API.get('FGH789'),null);
const old=JSON.parse(store.get('nk_recent_game_sessions_v1'));
old.push({...entry,code:'JKL234',expiresAt:Date.now()-100});
store.set('nk_recent_game_sessions_v1',JSON.stringify(old));
assert.equal(API.get('JKL234'),null,'expired entries should not be offered');
assert.equal(API.clear(),true);
assert.equal(API.list().length,0);
// Storage failures are safe: the multiplayer game still works without a list.
const originalSet=localStorage.setItem;
localStorage.setItem=()=>{throw Error('Private mode blocks storage')};
assert.equal(API.remember(entry),false);
localStorage.setItem=originalSet;
const start=main.indexOf('function recentGameSection(){');
const end=main.indexOf('function landing(){',start);
assert(start>=0&&end>start,'recent room UI functions missing');
const app={innerHTML:''};
const st=new Map(),sessionStorage={
 getItem:k=>st.get(k)||null,setItem:(k,v)=>st.set(k,String(v))};
let opened=0,reported='';
const c2={window:{NKRecent:API},sessionStorage,Date,Math,JSON,
 GAMES:{tier:{title:'みんなでティア表'}},
 action:(label,cmd)=>'<button data-action="'+cmd+'">'+label+'</button>',
 esc:s=>String(s??'').replaceAll('<','&lt;'),
 playerName:'',connectCode:'',pendingAction:'',retryAttempt:1,retryTimer:null,
 clearTimeout(){},openSocket(){opened++},landing(){},error(msg){reported=msg}};
vm.createContext(c2);
vm.runInContext(main.slice(start,end),c2);
assert.equal(vm.runInContext('recentGameSection()',c2),'');
API.remember(entry);
assert.match(vm.runInContext('recentGameSection()',c2),/最近参加したルーム/);
vm.runInContext("continueRecentRoom('ABC234')",c2);
assert.equal(opened,1);
assert.equal(c2.connectCode,code);
assert.equal(c2.pendingAction,'join');
assert.equal(c2.playerName,'おかゆ');
assert.equal(st.get('nakami_sid_'+code),sid);
vm.runInContext("forgetRecentRoom('ABC234')",c2);
assert.equal(API.list().length,0);
assert(html.includes('/recent_rooms.js?v=1'));
assert(/main\.js\?v=\d+/.test(html));
assert(html.indexOf('/recent_rooms.js')>=0);
assert(html.indexOf('/recent_rooms.js')<html.indexOf('/main.js'),
       'recent-room storage must load before main.js');

// When a user resumes in another tab, the displaced tab must stop retrying.
const artSource=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const gameStart=main.indexOf('socket.onclose=ev=>{');
const gameEnd=main.indexOf('socket.onerror=()=>',gameStart);
assert(gameStart>=0&&gameEnd>gameStart);
let gameRetries=0,gameMessage='';
const gameWs={};
const gameCtx={ws:gameWs,room:{code:'ABC234'},connectCode:'ABC234',
 pendingAction:'join',replacedByAnotherTab:false,retryAttempt:0,
 retryTimer:null,pingTimer:null,connecting:false,
 clearHandshake(){},clearInterval(){},clearTimeout(){},
 sessionStorage:{setItem(){}},Date,Math,JSON,
 status(t){gameMessage=t},error(){},setTimeout(){gameRetries++}};
vm.createContext(gameCtx);
vm.runInContext('const socket=ws;\n'+main.slice(gameStart,gameEnd),gameCtx);
gameWs.onclose({code:1000,reason:'replaced by reconnection'});
assert.equal(gameRetries,0);
assert.equal(gameCtx.replacedByAnotherTab,true);
assert.match(gameMessage,/別のタブ/);
const artStart=artSource.indexOf('socket.onclose=ev=>{');
const artEnd=artSource.indexOf('socket.onerror=()=>',artStart);
assert(artStart>=0&&artEnd>artStart);
let artRetries=0,artMessage='';
const artWs={};
const artCtx={ws:artWs,pingTimer:null,handshakeTimer:null,cloudSaveInFlight:false,
 activePointer:null,pending:new Map(),myId:'artist',
 handedOffToOtherTab:false,retryWanted:true,Date,
 clearTimeout(){},clearInterval(){},stopNetworkTimers(){},
 sessionStorage:{setItem(){}},scheduleReconnect(){artRetries++},
 networkHelp(){},alertUI(t){artMessage=t}};
vm.createContext(artCtx);
vm.runInContext('const socket=ws;\n'+artSource.slice(artStart,artEnd),artCtx);
artWs.onclose({code:1000,reason:'replaced'});
assert.equal(artRetries,0);
assert.equal(artCtx.handedOffToOtherTab,true);
assert.equal(artCtx.retryWanted,false);
assert.match(artMessage,/別のタブ/);
assert(artSource.includes('!ev.persisted||!code||handedOffToOtherTab'));
console.log('PASS recent sessions, privacy and no competing-tab reconnection loops');

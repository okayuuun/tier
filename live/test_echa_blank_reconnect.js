'use strict';
// A reconnect to an unexpectedly reset server must not blank the drawing
// already in the browser. Back up the artwork before any further editing.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const a=src.indexOf('function onMessage(d){');
const b=src.indexOf('function renderMembers(){',a);
assert(a>=0&&b>a);
const elems=new Map();
const $=id=>{
 if(!elems.has(id))elems.set(id,{hidden:false,disabled:false,textContent:''});
 return elems.get(id);
};
const original={id:'preserve-original',points:[[.1,.2],[.3,.4]]};
let redrawn=0,alerts=[];
const state={
 code:'RVSQXT',drawnRoomCode:'RVSQXT',lastConnected:true,
 strokes:[original],preserveLocalArt:false,
 ownerKey:'',myId:'same-user',maxLayers:8,cloudSaveInFlight:false,
 reconnectAttempt:0,retryWanted:true,lastPongAt:0,lastPacketAt:0,
 ws:{readyState:1,send(){}},
 WebSocket:{OPEN:1},
 Date,Number,Math,JSON,
 codeRoom:'RVSQXT',pending:new Map(),waitingLocal:new Map(),
 members:[],messages:[],layers:[{id:'base',visible:true,opacity:1}],
 drawProblem:'',lastError:'',renderChat(){},renderMembers(){},
 stopNetworkTimers(){},networkHelp(){},normalizeLayers(){},
 resetPaintCache(){},redraw(){redrawn++},schedulePending(){},
 fit(){},transform(){},alertUI(msg){alerts.push(msg)},$,
 setInterval(){return 1},
 localStorage:{setItem(){}},sessionStorage:{setItem(){}},
 history:{replaceState(){}},location:{pathname:'/echa'},
};
vm.createContext(state);
vm.runInContext(src.slice(a,b),state);
vm.runInContext(`onMessage({type:'snapshot',code:'RVSQXT',me:'same-user',owner:true,
 resumeToken:'abc',persistence:'postgres',version:0,
 strokes:[],drawing:[],layers:[{id:'base',visible:true,opacity:1}],
 members:[],messages:[],retentionHours:720})`,state);
assert.equal(state.strokes.length,1,'local artwork must not be replaced by blank server state');
assert.equal(state.strokes[0].id,'preserve-original');
assert.equal(state.preserveLocalArt,true);
assert.equal($('ec-save-cloud').disabled,true,'cloud overwrite must be blocked');
assert.equal($('ec-recovery').hidden,false);
assert.match($('ec-draw-warning').textContent,/PNG保存/);
assert(alerts.some(msg=>msg.includes('PNG')));
assert.equal(redrawn,0,'preserved canvas must never be cleared');
state.drawnRoomCode='ANOTHER';
vm.runInContext(`onMessage({type:'snapshot',code:'NEW123',me:'new-user',owner:true,
 resumeToken:'xyz',persistence:'postgres',version:0,
 strokes:[],drawing:[],layers:[{id:'base',visible:true,opacity:1}],
 members:[],messages:[],retentionHours:720})`,state);
assert.equal(state.preserveLocalArt,false,'creating a different room must start clean');
assert.equal(state.strokes.length,0);
assert.equal(redrawn,1);
console.log('PASS: blank reconnect preserves visible artwork without overwriting the cloud');

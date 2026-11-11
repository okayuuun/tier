'use strict';
// A new local stroke may start before the prior line's WebSocket "end"
// acknowledgement arrives. Old ACKs must never delete the new preview.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const a=src.indexOf('function onMessage(d){');
const b=src.indexOf('function renderMembers(){',a);
assert(a>=0&&b>a);
const redraws=[];
const state={
 myId:'me',pending:new Map([['me',{by:'me',clientSerial:22,points:[[.4,.4]]}]]),
 waitingLocal:new Map([[21,{by:'me',clientSerial:21,points:[[.1,.1]]}]]),
 strokes:[],drawProblem:'',redraw(){redraws.push(true)},
 schedulePending(){},updateCount(){},resetPaintCache(){},
};
vm.createContext(state);
vm.runInContext(src.slice(a,b),state);
vm.runInContext("onMessage({type:'end',stroke:{id:'old',by:'me',clientSerial:21,points:[[.1,.1]]}})",state);
assert.equal(state.strokes.length,1);
assert.equal(state.waitingLocal.has(21),false,'old acknowledged preview is removed');
assert.equal(state.pending.get('me').clientSerial,22,
 'the next pen stroke stays visible while the previous stroke is saved');
vm.runInContext("onMessage({type:'end',stroke:{id:'new',by:'me',clientSerial:22,points:[[.4,.4]]}})",state);
assert.equal(state.strokes.length,2);
assert.equal(state.pending.has('me'),false);
assert.equal(redraws.length,2);
console.log('PASS: delayed old stroke acknowledgement leaves next preview intact');

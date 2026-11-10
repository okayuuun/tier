'use strict';
/* Client must discard a rejected, optimistic stroke instead of displaying
   a false mark that vanishes as soon as the next gesture starts. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'public','echa.js'),'utf8');
function excerpt(start,end) {
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert(a>=0&&b>a, 'Missing drawing recovery block');
 return src.slice(a,b);
}
const code=excerpt('function onMessage(d){','function renderMembers(){')+
 '\n'+excerpt('function discardPendingStroke(){','function bufferPoint(pt){');
const warning={hidden:true,textContent:''},join={hidden:true};
const sent=[],alerts=[],released=[],ctx={
 pending:new Map([['self',{points:[[.1,.1]]}]]),
 myId:'self',activePointer:{mode:'draw',id:8},moveTimer:12,
 sendQueue:[[.2,.3]],drawProblem:'',ws:{},
 overlay:{releasePointerCapture:id=>released.push(id)},
 $:id=>id==='ec-draw-warning'?warning:join,
 clearTimeout:()=>{},send:d=>{sent.push(d);return true},
 connected:()=>true,schedulePending:()=>{},alertUI:x=>alerts.push(x),
 console
};

};
vm.createContext(ctx);
vm.runInContext(code,ctx);
vm.runInContext("onMessage({type:'error',action:'begin',message:'線の保存上限に達しました'})",ctx);
assert.equal(ctx.pending.has('self'),false);
assert.equal(ctx.sendQueue.length,0);
assert.equal(ctx.activePointer,null);
assert.deepEqual(released,[8]);
assert.equal(warning.hidden,false);
assert.match(warning.textContent,/保存できません/);
assert.match(ctx.drawProblem,/上限/);
assert.deepEqual(sent.map(x=>x.type),['sync']);
assert(alerts[0].includes('上限'));

// Non-drawing errors must not remove an unrelated in-progress line.
ctx.pending.set('self',{points:[[.3,.4]]});
ctx.activePointer={mode:'draw',id:9};
ctx.sendQueue.push([.4,.5]);
vm.runInContext("onMessage({type:'error',action:'chat',message:'チャットの文字数が多すぎます'})",ctx);
assert.equal(ctx.pending.has('self'),true);
assert.equal(ctx.activePointer.id,9);
assert.equal(ctx.sendQueue.length,1);
assert.equal(sent.length,1);
console.log('PASS: rejected strokes never remain as phantom ink');

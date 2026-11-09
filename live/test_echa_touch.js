'use strict';
/* Exercise the real echa two-finger handlers, including undo vs pinch. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'public','echa.js'),'utf8');
const begin=src.indexOf('const touchPoints=new Map();');
const end=src.indexOf("window.addEventListener('keydown'",begin);
assert(begin>=0&&end>begin);
const listeners={};
const workspace={
 addEventListener(type,cb){(listeners[type]??=[]).push(cb)},
 setPointerCapture(){},
 getBoundingClientRect(){return {left:0,top:0}}
};
const view={zoom:1,x:0,y:0};
const sent=[],pending=new Map(),queue=[];
let active=null,moves=0,alerts=[];
const context={workspace,view,send:s=>sent.push(s),
 schedulePending(){},connected(){return true},alertUI:x=>alerts.push(x),
 transform(){moves++},pending,sendQueue:queue,
 Date:{now:()=>1000},
 clearTimeout(){},moveTimer:null,activePointer:active};
vm.createContext(context);vm.runInContext(src.slice(begin,end),context);
function fire(type,id,x,y){
 const event={type,pointerType:'touch',pointerId:id,clientX:x,clientY:y,
  preventDefault(){this.prevented=true}};
 for(const cb of listeners[type]||[])cb(event);
 return event
}
fire('pointerdown',1,20,20);
fire('pointerdown',2,80,20);
fire('pointerup',1,20,20);
fire('pointerup',2,80,20);
assert.equal(sent.filter(s=>s.type==='undo').length,1,'2 finger tap undoes once');
assert(alerts.some(a=>a.includes('2本指')));
sent.length=0;
fire('pointerdown',3,20,20);
fire('pointerdown',4,80,20);
fire('pointermove',4,180,20);
fire('pointerup',3,20,20);
fire('pointerup',4,180,20);
assert.equal(sent.filter(s=>s.type==='undo').length,0,'pinch does not undo');
assert(view.zoom>1,'pinch zooms');
sent.length=0;
fire('pointerdown',5,20,20);
fire('pointerup',5,20,20);
assert.equal(sent.length,0,'one finger does not undo');
console.log('PASS: echa 2-finger tap undo, pinch zoom, one-finger draw isolation');

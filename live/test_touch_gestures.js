'use strict';
/* Simulate multi-touch on the shared canvas wrapper without browser deps. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=__dirname+'/public/';
const source=fs.readFileSync(root+'nk_brush.js','utf8');
class Element {
 constructor(name='div'){this.name=name;this.handlers={};this.children=[];this.style={};this.parentNode=null}
 appendChild(child){child.parentNode=this;this.children.push(child);return child}
 append(...items){items.forEach(item=>this.appendChild(item))}
 insertBefore(child){return this.appendChild(child)}
 insertAdjacentElement(_,child){return this.parentNode?this.parentNode.appendChild(child):this.appendChild(child)}
 addEventListener(name,callback){(this.handlers[name]??=[]).push(callback)}
 setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:720,height:440}}
 emit(type,values){const ev={pointerType:'touch',pointerId:1,clientX:0,clientY:0,
  preventDefault(){this.prevented=true},
  stopImmediatePropagation(){this.stopped=true},...values};
  for(const callback of this.handlers[type]||[])callback(ev);
  return ev}
}
const document={createElement:name=>new Element(name)};
const sandbox={document,localStorage:{getItem:()=>null},console};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const brush=vm.runInContext('NKMBrush',sandbox);
const parent=new Element('parent'),canvas=new Element('canvas');
canvas.parentNode=parent;
const savedStroke={p:[[.1,.1]],c:'#123456',w:6};
let cancelCount=0,repaints=0;
const art={strokes:[savedStroke],repaint(){repaints++}};
brush.bindPinch(canvas,art,()=>{cancelCount++});
const vp=parent.children[0];
assert(vp&&vp.name==='div');
vp.emit('pointerdown',{pointerId:1,clientX:100,clientY:100});
art.strokes[0].p.push([.2,.2]);
const second=vp.emit('pointerdown',{pointerId:2,clientX:200,clientY:100});
assert(second.prevented&&second.stopped,'second touch must not draw');
assert.equal(cancelCount,1,'previous brush stroke cancelled once');
assert.equal(repaints,1,'canvas repainted after cancellation');
assert.equal(art.strokes[0].p.length,1,'stray points rolled back');
const move=vp.emit('pointermove',{pointerId:2,clientX:300,clientY:100});
assert(move.prevented&&move.stopped,'pinching cannot draw');
assert.match(canvas.style.transform,/scale\(2\)/,'two-finger spread zooms 2x');
vp.emit('pointerup',{pointerId:2});
vp.emit('pointerup',{pointerId:1});
vp.emit('pointerdown',{pointerId:3,clientX:100,clientY:100});
assert.equal(cancelCount,1,'next single touch returns to drawing');
assert(vp.emit('dblclick',{}).prevented,'double-click text selection blocked');
assert(vp.emit('selectstart',{}).prevented,'text selection blocked');
const bar=vp.parentNode.children.find(el=>el.name==='div'&&el!==vp);
assert(bar&&bar.children.some(el=>el.name==='button'),'reset view button available');
console.log('PASS: one-finger drawing, pinch zoom, 2-finger cancellation and no text selection');

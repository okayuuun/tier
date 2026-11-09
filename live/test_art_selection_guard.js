'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'public','art_selection_guard.js'),'utf8');
const events={},document={
 activeElement:null,
 addEventListener(name,fn){(events[name]??=[]).push(fn)}
};
let clearing=0;
const selection={isCollapsed:false,removeAllRanges(){clearing++;this.isCollapsed=true}};
const window={getSelection(){return selection}};
vm.runInNewContext(src,{document,window,Date});
const surface={name:'canvas'};
const root={name:'ec-workspace'};
const canvas={closest(query){
 if(query.includes('input,textarea'))return null;
 return root
}};
const chat={closest(query){return query.includes('input,textarea')?this:null}};
function emit(name,target){
 const ev={target,prevented:false,preventDefault(){this.prevented=true}};
 (events[name]||[]).forEach(fn=>fn(ev));return ev
}
assert(emit('contextmenu',canvas).prevented,'long press context menu disabled on art');
assert(emit('selectstart',canvas).prevented,'native selection start disabled');
assert(emit('dblclick',canvas).prevented,'double-tap selection disabled');
assert(!emit('contextmenu',chat).prevented,'chat keeps its menu');
assert(!emit('selectstart',chat).prevented,'chat remains selectable');
emit('touchstart',canvas);
emit('selectionchange',document);
assert.equal(clearing,1,'async iOS selection immediately cleared');
selection.isCollapsed=false;document.activeElement=chat;
emit('selectionchange',document);
assert.equal(clearing,1,'chat text selection not removed');
console.log('PASS: iOS long press, context menu and async selection guarded only on art surfaces');

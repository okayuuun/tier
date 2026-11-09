'use strict';
// Test the shared drawing module without a browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const values=new Map();
let rendered=0;
const sandbox={
 localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
 render:()=>{rendered++},alert:()=>{},confirm:()=>true,
};
const code=fs.readFileSync(__dirname+'/public/nk_brush.js','utf8');
const brush=vm.runInNewContext(code+';NKMBrush',sandbox);
const d={
 color:'#abcdef',size:7,brushOpacity:.35,layerIndex:0,tool:'pen',
 layers:[{name:'bottom',opacity:1,visible:true},{name:'top',opacity:.7,visible:true}],
 strokes:[
  {c:'#abcdef',w:7,p:[[.1,.1],[.2,.2]],layer:0,a:.35},
  {c:'#999999',w:5,p:[[.8,.8]],layer:1,a:1},
 ]
};
assert.match(brush.panel(d,'test'),/PNG保存/);
brush.up('test');
assert.equal(d.layerIndex,1);
assert.equal(d.layers[1].name,'bottom');
assert.equal(d.strokes[0].layer,1);
assert.equal(d.strokes[1].layer,0);
assert.equal(brush.ordered(d.strokes,d)[0].c,'#999999');
assert.equal(brush.eraseAt(d,[.2,.2]),true);
assert.equal(d.strokes.length,1);
assert.equal(brush.eraseAt(d,[.2,.2]),false);
brush.saveFavorite('test');
assert.deepEqual(JSON.parse(values.get('nakami_favorite_colors_v1')),['#abcdef']);
brush.color('test','#345678');
brush.saveFavorite('test');
assert.deepEqual(JSON.parse(values.get('nakami_favorite_colors_v1')),['#abcdef','#345678']);
brush.removeFavorite('test');
assert.deepEqual(JSON.parse(values.get('nakami_favorite_colors_v1')),['#abcdef']);
brush.setTool('test','eraser');
assert.equal(d.tool,'eraser');
brush.brushSize('test',17);
assert.equal(brush.newStroke(d,[.3,.4]).w,17);
brush.down('test');
assert.equal(d.layerIndex,0);
assert(rendered>=4);
console.log('PASS: reorder preserves stroke order, stroke eraser, favorites, brush tools and width');

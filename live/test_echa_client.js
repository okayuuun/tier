'use strict';
/* Verify layer composition operations without installing a browser canvas package. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'public','echa.js'),'utf8');
const start=source.indexOf('function stroke(ctx2,s){');
const end=source.indexOf('function redraw(){',start);
assert(start>0&&end>start);
const renderSource=source.slice(start,end);
let nextId=0,canvases=[];
function fakeCanvas(width=100,height=100){
 const canvas={id:'c'+(++nextId),width,height};
 const ctx={
  canvas,globalAlpha:1,globalCompositeOperation:'source-over',lineWidth:1,
  stack:[],drawn:[],ink:[],
  save(){this.stack.push({alpha:this.globalAlpha,composite:this.globalCompositeOperation})},
  restore(){const s=this.stack.pop();if(s){this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite}},
  setTransform(){},clearRect(){},fillRect(){},
  beginPath(){},moveTo(){},lineTo(){},arc(){},
  stroke(){this.ink.push(this.globalCompositeOperation)},
  fill(){this.ink.push(this.globalCompositeOperation)},
  drawImage(src){this.drawn.push({id:src.id,alpha:this.globalAlpha})}
 };
 canvas.getContext=()=>ctx;canvas.ctx=ctx;canvases.push(canvas);return canvas
}
const pen=(layer,tool='pen')=>({layer,tool,color:'#4488aa',width:8,opacity:1,points:[[.2,.3],[.5,.6]]});
const main=fakeCanvas(3072,2048),timeline=fakeCanvas(960,640);
const ctx={console,WIDTH:3072,HEIGHT:2048,document:{createElement(){return fakeCanvas()}},
  layers:[{id:'base',visible:true,opacity:1},{id:'layer_2',visible:true,opacity:.55}],
  strokes:[pen('base'),pen('layer_2'),pen('layer_2','eraser')],
  pending:new Map(),paintScratch:new Map(),layerPaintCache:new Map()};
vm.createContext(ctx);
vm.runInContext(renderSource,ctx);
vm.runInContext('composite',ctx)(main.ctx,3,false);
assert.equal(main.ctx.drawn.length,2,'both visible layers should be composited');
assert.equal(main.ctx.drawn[0].alpha,1);
assert.equal(main.ctx.drawn[1].alpha,.55,'opacity applied to layer composition');
const map=vm.runInContext('layerPaintCache',ctx).get('3072x2048').images;
assert.equal(map.get('base').ctx.ink.length,1,'base has only its own pen stroke');
assert.deepEqual(map.get('layer_2').ctx.ink,['source-over','destination-out'],'eraser clears only its own layer');
main.ctx.drawn=[];
vm.runInContext('composite',ctx)(main.ctx,3,false);
assert.equal(map.get('base').ctx.ink.length,1,'cache avoids re-rasterizing old ink');
ctx.pending.set('artist',pen('base','eraser'));main.ctx.drawn=[];
vm.runInContext('composite',ctx)(main.ctx,3,true);
assert.equal(map.get('base').ctx.ink.length,1,'pending eraser does not mutate completed base cache');
const scratch=vm.runInContext('paintScratch',ctx).get('3072x2048');
assert(scratch.ctx.ink.includes('destination-out'),'pending eraser uses layer-only scratch');
ctx.pending.clear();
ctx.layers[1].visible=false;main.ctx.drawn=[];
vm.runInContext('composite',ctx)(main.ctx,3,false);
assert.equal(main.ctx.drawn.length,1,'hidden layer is absent from drawing');
ctx.layers[1].visible=true;timeline.ctx.drawn=[];
vm.runInContext('composite',ctx)(timeline.ctx,1,false);
assert.equal(timeline.ctx.drawn.length,1,'partial timelapse renders only early visible ink');
console.log('PASS: independent layer erase, transparency, cache, hidden layers, pending strokes and timelapse');

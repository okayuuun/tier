'use strict';
// The live pen should render only to the input overlay, not recompose
// a large multi-megapixel canvas after each movement.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const first=src.indexOf('let previewOnMain=false;');
const last=src.indexOf('function transform(){',first);
assert(first>0&&last>first,'Cannot find preview renderer');
const full=[],pens=[],queued=[],clears=[],transforms=[];
const overlay={width:3072,height:2048};
const octx={
 save(){},restore(){},setTransform(...args){transforms.push(args)},clearRect(...args){clears.push(args)},
};
const stroke=(target,item)=>pens.push({target,opacity:item.opacity,tool:item.tool});
const composite=(target,count,live)=>full.push({target,count,live});
const stats={textContent:''},warn={hidden:true,textContent:''};
const state={
 octx,ctx:{},overlay,stroke,composite,WIDTH:3072,HEIGHT:2048,
 strokes:[{id:'prior'}],drawProblem:'',drawingScheduled:false,
 layers:[{id:'base',visible:true,opacity:0.5}],
 waitingLocal:new Map(),
 pending:new Map([['alice',{by:'alice',layer:'base',tool:'pen',opacity:.8,points:[[.1,.1]]}]]),
 requestAnimationFrame:fn=>queued.push(fn),
 $:id=>id==='ec-strokes'?stats:warn,
};
vm.createContext(state);
vm.runInContext(src.slice(first,last),state);
vm.runInContext('schedulePending()',state);
assert.equal(queued.length,1);
queued.shift()(100);
assert.equal(full.length,0,'pen preview must not recompose the large finished canvas');
assert.equal(pens.length,1);
assert(Math.abs(pens[0].opacity-.4)<.001,'live pen respects layer opacity');
assert(clears.length>0,'overlay is cleared before preview');
assert(transforms.some(t=>t[0]===1&&t[3]===1),
 'default high-quality overlay renders strokes at their original resolution');
vm.runInContext('schedulePending()',state);
queued.shift()(145);
assert.equal(full.length,0,'repeated pen movement stays overlay-only');
vm.runInContext('redraw()',state);
assert.equal(full.length,1,'committed stroke draws the main scene once');
assert.equal(full[0].live,false);
assert.match(stats.textContent,/1本/);

// Erasers must be rendered against the actual target layer, not drawn
// as transparent marks that have no effect.
state.pending.set('alice',{by:'alice',layer:'base',tool:'eraser',opacity:1,points:[[.3,.3]]});
vm.runInContext('schedulePending()',state);queued.shift()(190);
assert.equal(full.at(-1).live,true,'active eraser uses the full layer compositor');
state.pending.clear();
vm.runInContext('schedulePending()',state);queued.shift()(235);
assert.equal(full.at(-1).live,false,'cancelling eraser restores all completed ink');

// Multiple visible layers use accurate preview compositing as well.
state.layers.push({id:'front',visible:true,opacity:1});
state.pending.set('alice',{by:'alice',layer:'base',tool:'pen',opacity:1,points:[[.3,.3]]});
vm.runInContext('schedulePending()',state);queued.shift()(280);
assert.equal(full.at(-1).live,true,'multi-layer preview must preserve stacking');
console.log('PASS: lightweight preview, layer opacity, eraser recovery, multi-layer correctness');

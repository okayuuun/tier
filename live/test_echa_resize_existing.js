'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const start=js.indexOf('function onMessage(d){');
const stop=js.indexOf('function renderMembers(){',start);
assert(start>=0&&stop>start);
const first={id:'a',tool:'pen',width:8,points:[[.1,.2],[.9,.8]]};
const eraser={id:'b',tool:'eraser',width:30,points:[[.2,.4],[.5,.6]]};
const bucket={id:'c',tool:'fill',point:[.3,.2]};
const layers=[{id:'base',visible:true,opacity:1},{id:'layer2',visible:true,opacity:1}];
let dims=[],renderCount=0,status='';
const button={hidden:false};
const ctx={
 strokes:[first,eraser,bucket],pending:new Map(),waitingLocal:new Map(),
 sendQueue:[[.2,.4]],layers,maxLayers:8,
 configureRoomSize:(w,h)=>dims.push([w,h]),
 renderLayers(){renderCount++},redraw(){renderCount++},fit(){},
 alertUI:x=>status=x,$:()=>button,
};
vm.createContext(ctx);
vm.runInContext(js.slice(start,stop),ctx);
vm.runInContext("onMessage({type:'resize',width:1920,height:1280,maxLayers:4,widthFactor:.625})",ctx);
assert.deepEqual(dims,[[1920,1280]]);
assert.equal(first.width,5);
assert.equal(eraser.width,19);
assert.equal(bucket.point[0],.3);
assert.deepEqual(first.points,[[.1,.2],[.9,.8]]);
assert.equal(ctx.strokes.length,3,'never remove existing artwork');
assert.equal(ctx.layers.length,2,'never delete old layers');
assert.equal(ctx.maxLayers,4);
assert.equal(button.hidden,true);
assert.equal(ctx.sendQueue.length,0);
assert(renderCount>=2);
assert(status.includes('縮小しました'));
assert(js.includes("if(!confirm('先に「全体をPNG保存」"));
console.log('PASS: opt-in resize preserves all vector geometry and backup warning');

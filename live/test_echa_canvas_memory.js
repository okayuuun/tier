'use strict';
// Full-quality display must be the default; lighter modes are opt-in.
// Saved strokes and PNG output stay at 3072x2048 regardless of view setting.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const start=src.indexOf('const RENDER_SCALES=');
const end=src.indexOf('const board=',start);
assert(start>0&&end>start);
const main={width:3072,height:2048,getContext(){return {canvas:this}}};
const overlay={width:3072,height:2048,getContext(){return {canvas:this}}};
const context={WIDTH:3072,HEIGHT:2048,$:id=>id==='ec-canvas'?main:overlay};
vm.createContext(context);
vm.runInContext(src.slice(start,end),context);
assert.equal(main.width,3072,'high resolution must remain the default');
assert.equal(main.height,2048);
assert.equal(overlay.width,3072);
assert.equal(overlay.height,2048);
assert.equal(vm.runInContext('renderQuality',context),'high');
let redraws=0,cacheReleases=0;
context.resetPaintCache=()=>cacheReleases++;
context.redraw=()=>redraws++;
const setterStart=src.indexOf('function setRenderQuality(next){');
const setterEnd=src.indexOf('function paintBucket(',setterStart);
assert(setterStart>0&&setterEnd>setterStart);
vm.runInContext(src.slice(setterStart,setterEnd),context);
vm.runInContext("setRenderQuality('light')",context);
assert.equal(main.width,1536);
assert.equal(main.height,1024);
assert.equal(overlay.width,1536);
assert.equal(overlay.height,1024);
assert.equal(main.width*main.height,3072*2048/4,'opt-in light mode saves 75% of pixels');
vm.runInContext("setRenderQuality('balanced')",context);
assert.equal(main.width,2304);
assert.equal(main.height,1536);
vm.runInContext("setRenderQuality('high')",context);
assert.equal(main.width,3072,'switching back restores full-resolution display');
assert.equal(main.height,2048);
assert.equal(overlay.width,3072);
assert.equal(overlay.height,2048);
assert.equal(redraws,3);
assert.equal(cacheReleases,3);
assert.equal(vm.runInContext("setRenderQuality('invalid')",context),false);
assert.equal(main.width,3072);
assert(src.includes('target.width=WIDTH;target.height=HEIGHT'),
 'PNG export must stay 3072x2048 in all modes');
assert(src.includes('releasePaintCache(key)'),
 'Full-resolution temporary buffers must be freed after export');

// Browsers can discard 2D canvas contexts under pressure; they rebuild
// from full-quality stroke data without requiring a destructive reload.
const events={},notices=[];
for(const canvas of [main,overlay]){
 canvas.addEventListener=(type,fn)=>{(events[type]??=[]).push(fn)};
}
context.alertUI=msg=>notices.push(msg);
vm.runInContext(src.slice(end,src.indexOf('function normalizeLayers(data){',end)),context);
assert.equal(events.contextlost.length,2);
assert.equal(events.contextrestored.length,2);
let prevented=false;
events.contextlost[0]({preventDefault(){prevented=true}});
events.contextrestored[0]({});
assert(prevented);
assert.equal(redraws,4);
assert(notices.some(x=>x.includes('復元')));
console.log('PASS: full-quality default, selectable lighter modes, PNG and context recovery');

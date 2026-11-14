'use strict';
// Live canvas memory is reduced, while PNG exports use the original resolution.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const start=src.indexOf('const LIVE_SCALE=.5;');
const end=src.indexOf('const board=',start);
assert(start>0&&end>start);
const main={width:3072,height:2048,getContext(){return {canvas:this}}};
const overlay={width:3072,height:2048,getContext(){return {canvas:this}}};
const context={WIDTH:3072,HEIGHT:2048,$:id=>id==='ec-canvas'?main:overlay};
vm.createContext(context);
vm.runInContext(src.slice(start,end),context);
assert.equal(main.width,1536);
assert.equal(main.height,1024);
assert.equal(overlay.width,1536);
assert.equal(overlay.height,1024);
assert.equal(main.width*main.height,3072*2048/4);
assert(src.includes('target.width=WIDTH;target.height=HEIGHT'),
 'PNG export must keep the full 3072x2048 image');
assert(src.includes('releasePaintCache(key)'),
 'Full-resolution temporary buffers must be freed after export');
console.log('PASS: 75% less backing-pixel memory with full-resolution PNG output');

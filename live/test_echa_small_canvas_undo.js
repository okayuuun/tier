'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const dimensionStart=src.indexOf('function configureRoomSize(width,height){');
const dimensionEnd=src.indexOf('/* Cache finished strokes',dimensionStart);
assert(dimensionStart>0&&dimensionEnd>dimensionStart);
const main={width:3072,height:2048},overlay={width:3072,height:2048};
const board={style:{}},sizeLabel={textContent:''};
let cleared=0;
const context={
 WIDTH:3072,HEIGHT:2048,main,overlay,board,
 renderQuality:'high',RENDER_SCALES:{high:1,balanced:.75,light:.5},
 resetPaintCache(){cleared++},$:id=>sizeLabel,
};
vm.createContext(context);
vm.runInContext(src.slice(dimensionStart,dimensionEnd),context);
vm.runInContext('configureRoomSize(2048,1365)',context);
assert.equal(context.WIDTH,2048);
assert.equal(main.width,2048);
assert.equal(overlay.height,1365);
assert.equal(board.style.width,'2048px');
assert.match(sizeLabel.textContent,/2048/);
assert.equal(cleared,1);
vm.runInContext('configureRoomSize(3072,2048)',context);
assert.equal(main.width,3072,'legacy rooms remain 3072x2048');
assert.equal(overlay.height,2048);

const undoStart=src.indexOf('function undoCachedInk(removed){');
const undoEnd=src.indexOf('function composite(',undoStart);
assert(undoStart>0&&undoEnd>undoStart);
const changed=[],untouched=[],resets=[];
function fakeCanvas(){
 const obj={width:2048,height:1365};
 const context={save(){},restore(){},setTransform(){}};
 obj.getContext=()=>context;
 context.canvas=obj;
 return obj
}
const base=fakeCanvas(),front=fakeCanvas();
const entry={count:3,images:new Map([['base',base],['front',front]])};
const room={WIDTH:2048,HEIGHT:1365,
 strokes:[{id:'a',tool:'pen',layer:'base'},{id:'b',tool:'pen',layer:'front'}],
 layerPaintCache:new Map([['2048x1365',entry]]),
 stroke(ctx,s){changed.push(s.layer)},
 resetPaintCache(){resets.push('reset')},releasePaintCache(){}};
vm.createContext(room);
vm.runInContext(src.slice(undoStart,undoEnd),room);
vm.runInContext("undoCachedInk({id:'c',tool:'pen',layer:'base'})",room);
assert.deepEqual(changed,['base'],'pure pen undo replays only changed layer');
assert.equal(entry.images.get('front'),front,'unaffected layer is retained');
assert.equal(entry.count,2);
assert.equal(resets.length,0);
room.strokes.push({id:'fill',tool:'fill',layer:'base'});
vm.runInContext("undoCachedInk({id:'d',tool:'pen',layer:'base'})",room);
assert.equal(resets.length,1,'complex fill undo safely rebuilds all layers');
console.log('PASS: legacy/new canvas dimensions and isolated undo redraw');

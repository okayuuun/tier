'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'public','echa_fill.js'),'utf8');
const scope={Uint8Array,Uint8ClampedArray,Uint32Array,Math,Error};
vm.createContext(scope);vm.runInContext(source,scope);
const bucket=vm.runInContext('ECFill.fill',scope);
function bitmap(w,h,color=[255,255,255,255]){
 const data=new Uint8ClampedArray(w*h*4);
 for(let n=0;n<w*h;n++)data.set(color,n*4);
 return {width:w,height:h,data};
}
function rgba(img,x,y){return Array.from(img.data.slice((y*img.width+x)*4,(y*img.width+x)*4+4))}
function set(img,x,y,color){img.data.set(color,(y*img.width+x)*4)}
// A closed ink outline on the upper layer is used to fill a separate,
// initially transparent lower layer. The outline must remain unchanged.
const reference=bitmap(9,9);
for(let x=2;x<=6;x++){set(reference,x,2,[0,0,0,255]);set(reference,x,6,[0,0,0,255])}
for(let y=2;y<=6;y++){set(reference,2,y,[0,0,0,255]);set(reference,6,y,[0,0,0,255])}
const outlines=reference.data.slice();
const colorLayer=bitmap(9,9,[0,0,0,0]);
const changed=bucket(reference,colorLayer,4,4,'#ff5500',1,0);
assert.equal(changed,9,'only interior 3x3 area is filled');
assert.deepEqual(rgba(colorLayer,4,4),[255,85,0,255]);
assert.deepEqual(rgba(colorLayer,2,4),[0,0,0,0],'outline remains untouched in lower layer');
assert.deepEqual(rgba(colorLayer,0,0),[0,0,0,0],'no leakage outside border');
assert.deepEqual(reference.data,outlines,'reference line art never changes');
// Current layer reference mode uses the target layer as its own boundary;
// a transparent layer without lines has no boundary, so the whole canvas fills.
const transparentSource=bitmap(4,3,[0,0,0,0]);
const full=bitmap(4,3,[0,0,0,0]);
assert.equal(bucket(transparentSource,full,1,1,'#2288ee',1,0),12);
assert.deepEqual(rgba(full,0,0),[34,136,238,255]);
// Tolerance 0 only permits exact seed RGB; higher tolerance includes near matches.
const soft=bitmap(3,1,[100,100,100,255]);set(soft,1,0,[110,100,100,255]);set(soft,2,0,[200,200,200,255]);
const out=bitmap(3,1,[0,0,0,0]);
assert.equal(bucket(soft,out,0,0,'#ffffff',1,0),1);
const out2=bitmap(3,1,[0,0,0,0]);
assert.equal(bucket(soft,out2,0,0,'#ffffff',1,10),2);
assert.deepEqual(rgba(out2,2,0),[0,0,0,0]);
// Partially opaque paint is correctly composited over existing layer pixels.
const one=bitmap(1,1,[255,0,0,255]),base=bitmap(1,1,[0,0,255,255]);
assert.equal(bucket(one,base,0,0,'#ff0000',.5,0),1);
assert.deepEqual(rgba(base,0,0),[128,0,128,255]);
// Transparent target must preserve semi-transparency.
const empty=bitmap(1,1,[0,0,0,0]);
bucket(one,empty,0,0,'#00ff00',.5,0);
assert.deepEqual(rgba(empty,0,0),[0,255,0,128]);
assert.equal(bucket(one,empty,-1,-1,'#00ff00',1,0),0);
assert.throws(()=>bucket(one,bitmap(2,2),0,0,'#000000'),/サイズ/);
assert.throws(()=>bucket(one,base,0,0,'red'),/色が不正/);
console.log('PASS: closed outline fill, all-layer reference, layer-only fill, tolerance, alpha compositing, boundary checks');

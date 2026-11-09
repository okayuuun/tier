'use strict';
/* Integration test: the art-chat compositor must apply a fill to the selected
   layer while consulting the upper line-art layer as a boundary. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync(require('node:path').join(__dirname,'public','echa.js'),'utf8');
const flood=fs.readFileSync(require('node:path').join(__dirname,'public','echa_fill.js'),'utf8');
const from=js.indexOf('function sceneScratch(w,h){');
const to=js.indexOf('function renderedLayers(w,h,count){',from);
assert(from>0&&to>from,'bucket compositor should be defined before raster replay');
const W=9,H=9;
function makeCanvas(w=W,h=H){
 const canvas={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};
 const ctx={
  canvas,globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'#ffffff',states:[],
  save(){this.states.push({alpha:this.globalAlpha,mode:this.globalCompositeOperation,fillStyle:this.fillStyle})},
  restore(){let x=this.states.pop();this.globalAlpha=x.alpha;this.globalCompositeOperation=x.mode;this.fillStyle=x.fillStyle},
  setTransform(){},
  clearRect(){canvas.data.fill(0)},
  fillRect(){for(let i=0;i<w*h;i++)canvas.data.set([255,255,255,255],i*4)},
  drawImage(source){for(let i=0;i<w*h;i++){
   const k=i*4,src=source.data,sourceOpacity=src[k+3]/255*this.globalAlpha;
   const existingOpacity=canvas.data[k+3]/255;
   const out=sourceOpacity+existingOpacity*(1-sourceOpacity);
   if(!out)continue;
   for(let channel=0;channel<3;channel++){
    canvas.data[k+channel]=Math.round(
     (src[k+channel]*sourceOpacity+
     canvas.data[k+channel]*existingOpacity*(1-sourceOpacity))/out)
   }
   canvas.data[k+3]=Math.round(out*255)
  }},
  getImageData(){return {width:w,height:h,data:canvas.data.slice()}},
  putImageData(image){canvas.data.set(image.data)}
 };
 canvas.getContext=()=>ctx;return canvas
}
function get(canvas,x,y){return Array.from(canvas.data.slice((y*W+x)*4,(y*W+x)*4+4))}
function put(canvas,x,y,color){canvas.data.set(color,(y*W+x)*4)}
const upper=makeCanvas(),lower=makeCanvas();
for(let x=2;x<=6;x++){put(upper,x,2,[0,0,0,255]);put(upper,x,6,[0,0,0,255])}
for(let y=2;y<=6;y++){put(upper,2,y,[0,0,0,255]);put(upper,6,y,[0,0,0,255])}
const topBefore=upper.data.slice(),context={
 document:{createElement(tag){assert.equal(tag,'canvas');return makeCanvas()}},
 WIDTH:W,HEIGHT:H,paintScratch:new Map(),layerPaintCache:new Map(),
 layers:[{id:'base',visible:true,opacity:1},{id:'line',visible:true,opacity:1}]
};
vm.createContext(context);
vm.runInContext(flood+'\n'+js.slice(from,to),context);
const paint=vm.runInContext('paintBucket',context);
const entry={images:new Map([['base',lower],['line',upper]])};
const op={tool:'fill',reference:'all',layer:'base',point:[4/9,4/9],tolerance:0,color:'#4488ff',opacity:1};
paint(entry,lower,op,W,H);
assert.deepEqual(get(lower,4,4),[68,136,255,255],'interior of outline fills');
assert.deepEqual(get(lower,0,0),[0,0,0,0],'background does not leak');
assert.deepEqual(get(lower,2,4),[0,0,0,0],'black border remains unpainted on color layer');
assert.deepEqual(upper.data,topBefore,'source line art remains untouched');
// When only the selected layer is referenced, the upper outline no longer
// blocks the flood, so the transparent base fills edge-to-edge.
const all=makeCanvas();
const entry2={images:new Map([['base',all],['line',upper]])};
paint(entry2,all,{...op,reference:'layer'},W,H);
assert.deepEqual(get(all,0,0),[68,136,255,255]);
// A hidden line art layer cannot form a boundary.
const noLines=makeCanvas();
context.layers[1].visible=false;
paint({images:new Map([['base',noLines],['line',upper]])},noLines,op,W,H);
assert.deepEqual(get(noLines,0,0),[68,136,255,255]);
console.log('PASS: bucket compositor honors visible upper lineart and fills only chosen layer');

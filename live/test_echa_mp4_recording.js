'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const start=src.indexOf('function supportedRecordingTypes(){');
const end=src.indexOf("window.addEventListener('resize'",start);
assert(start>0&&end>start);
async function caseRun(supported, expectedExt){
 const events={},downloads=[],messages=[];
 const button={disabled:false,textContent:'🎥 動画を保存（MP4優先）'};
 const stream={getTracks(){return [{stop(){}}]}};
 class FakeRecorder{
  constructor(s,opts){
   if(!supported.includes(opts.mimeType))throw Error('unsupported');
   this.mimeType=opts.mimeType;this.state='inactive';
  }
  start(){this.state='recording';this.ondataavailable({data:new Blob(['clip'])})}
  stop(){this.state='inactive';this.onstop()}
  static isTypeSupported(t){return supported.includes(t)}
 }
 const context={
  MediaRecorder:FakeRecorder,
  tlCanvas:{captureStream:()=>stream},recorder:null,recordChunks:[],
  stopPlayback(){},playbackReset(){},playbackDraw(){},play(){},
  code:'RVSQXT',Blob,alertUI:x=>messages.push(x),
  download:(blob,filename)=>downloads.push({blob,filename}),
  $:id=>id==='ec-record'?button:null,
 };
 vm.createContext(context);
 vm.runInContext(src.slice(start,end),context);
 if(!supported.length)return;
 events.click=button.click;
 // The click handler is registered by the extracted event listener.
}
function run(supported,expectedExt){
 const messages=[],downloads=[],callbacks={},button={disabled:false,textContent:'録画'};
 const stream={getTracks(){return[{stop(){}}]}};
 class FakeRecorder{
  constructor(s,opts){this.mimeType=opts.mimeType;if(!supported.includes(opts.mimeType))throw Error('unsupported');this.state='inactive'}
  start(){this.state='recording';this.ondataavailable({data:new Blob(['clip'])})}
  stop(){this.state='inactive';this.onstop()}
  static isTypeSupported(type){return supported.includes(type)}
 }
 const context={
  MediaRecorder:FakeRecorder,tlCanvas:{captureStream:()=>stream},
  recorder:null,recordChunks:[],code:'RVSQXT',Blob,
  stopPlayback(){},playbackReset(){},playbackDraw(){},play(){},
  alertUI:msg=>messages.push(msg),
  download:(blob,filename)=>downloads.push(filename),
  $:()=>button,
 };
 button.addEventListener=(type,fn)=>callbacks[type]=fn;
 vm.createContext(context);
 vm.runInContext(src.slice(start,end),context);
 callbacks.click();
 assert(context.recorder,'Recording should start');
 context.recorder.stop();
 assert.equal(downloads.length,1);
 assert(downloads[0].endsWith('.'+expectedExt),downloads[0]);
 assert.equal(button.disabled,false);
 assert(messages.some(m=>m.includes(expectedExt==='mp4'?'MP4':'WebM')));
}
run(['video/mp4;codecs=avc1.42E01E','video/webm'],'mp4');
run(['video/webm;codecs=vp8','video/webm'],'webm');
console.log('PASS: MP4 only for genuine MP4 recording support; WebM fallback is explicit');

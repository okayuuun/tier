'use strict';
// Test the actual UI helper functions without a browser or database credentials.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const main=fs.readFileSync(__dirname+'/public/main.js','utf8');
const echa=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const gameHtml=fs.readFileSync(__dirname+'/public/index.html','utf8');
const artHtml=fs.readFileSync(__dirname+'/public/echa.html','utf8');
assert(gameHtml.includes('id="connection-guide"'));
assert(artHtml.includes('id="ec-connection-help"'));
assert(artHtml.includes('id="ec-restored-note"'));
assert(artHtml.includes('id="ec-save-hint"'));
const statusEl={innerHTML:''},guideEl={hidden:true,textContent:''};
const context={room:{code:'AB12CD',owner:'p1',phase:'lobby',game:'tier',
 retentionHours:72,restoredAt:1731240000,persistence:'postgres'},me:'p1',
 retryAttempt:0,connectCode:'AB12CD',pendingAction:'join',
 cloudSaveNotice:'',cloudSavePending:false,
 navigator:{onLine:false},document:{getElementById(id){
 return id==='status'?statusEl:id==='connection-guide'?guideEl:null}},
 esc(value){return String(value??'')},action(title){return '<button>'+title+'</button>'}};
vm.createContext(context);
function part(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,'missing UI function '+start);return source.slice(a,b)}
vm.runInContext(part(main,'function status(text,isOn){','function clearHandshake()'),context);
vm.runInContext(part(main,'function roomBar(){','function endGame()'),context);
vm.runInContext("status('切断',false)",context);
assert.equal(guideEl.hidden,false);
assert.match(guideEl.textContent,/インターネット/);
context.navigator.onLine=true;context.retryAttempt=4;
vm.runInContext("status('再接続',false)",context);
assert.match(guideEl.textContent,/再接続/);
vm.runInContext("status('接続中',true)",context);
assert.equal(guideEl.hidden,true);
let banner=vm.runInContext('roomBar()',context);
assert.match(banner,/復元しました/);
assert.match(banner,/3日/);
assert.match(banner,/今すぐ保存/);
assert.match(banner,/nk-cloud-save-status/);
context.room.persistence='degraded';
banner=vm.runInContext('roomBar()',context);
assert.match(banner,/保存先との通信に問題/);
context.room.restoredAt=null;context.room.persistence='memory';
banner=vm.runInContext('roomBar()',context);
assert(!banner.includes('復元しました'));
assert.match(banner,/一時保存/);
const help={hidden:true,textContent:''};
const artCtx={reconnectAttempt:0,$(id){return id==='ec-connection-help'?help:null}};
vm.createContext(artCtx);
vm.runInContext(part(echa,'function networkHelp(state){','function connected()'),artCtx);
vm.runInContext("networkHelp('offline')",artCtx);
assert.equal(help.hidden,false);
assert.match(help.textContent,/Wi-Fi/);
artCtx.reconnectAttempt=4;
vm.runInContext("networkHelp('retry')",artCtx);
assert.match(help.textContent,/再接続/);
vm.runInContext("networkHelp('lost')",artCtx);
assert.match(help.textContent,/保存期限切れ/);
vm.runInContext("networkHelp('ok')",artCtx);
assert.equal(help.hidden,true);
assert(echa.includes('restored.hidden=!d.restoredAt'));
assert(echa.includes('d.retentionHours'));
console.log('PASS recovered banners, retention display and actionable disconnect guidance');

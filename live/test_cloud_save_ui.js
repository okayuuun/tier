'use strict';
/* Verify browser manual-save UI without requiring an actual DOM or Neon. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const main=fs.readFileSync(__dirname+'/public/main.js','utf8');
const art=fs.readFileSync(__dirname+'/public/echa.js','utf8');
const index=fs.readFileSync(__dirname+'/public/index.html','utf8');
const artHtml=fs.readFileSync(__dirname+'/public/echa.html','utf8');
function section(s,a,b) {
 const i=s.indexOf(a),j=s.indexOf(b,i);
 assert(i>=0&&j>i,'missing section '+a);return s.slice(i,j);
}
assert(index.includes('nk-cloud-save-result'));
assert(main.includes("if(!room||room.code!==obj.room.code){cloudSaveNotice='';cloudSavePending=false}"),
 'new rooms must not inherit the previous room\'s save confirmation');
assert(artHtml.includes('id="ec-save-cloud"'));
assert(artHtml.includes('id="ec-save-result"'));
const gameMsg={textContent:''};
let sentGame=[];
const g={room:{persistence:'postgres'},cloudSavePending:false,cloudSaveNotice:'',
 ws:{readyState:1},WebSocket:{OPEN:1},send:msg=>sentGame.push(msg),
 document:{getElementById(id){return id==='nk-cloud-save-status'?gameMsg:null}}};
vm.createContext(g);
vm.runInContext(section(main,'function showCloudSaveNotice(){','// Only an explicit Continue action'),g);
vm.runInContext('saveGameNow()',g);
assert.equal(sentGame.length,1);
assert.equal(sentGame[0].type,'save_now');
assert.equal(g.cloudSavePending,true);
assert.match(gameMsg.textContent,/確認/);
vm.runInContext('saveGameNow()',g);
assert.equal(sentGame.length,1,'second click must not send duplicate requests');
const gameAck=section(main,"if(obj.type==='save_status'){","if(obj.type==='example'){");
vm.runInContext('function gameAck(obj){'+gameAck+'}',g);
vm.runInContext("gameAck({type:'save_status',ok:true,at:1730000000})",g);
assert.equal(g.cloudSavePending,false);
assert.match(gameMsg.textContent,/保存を確認/);
vm.runInContext("gameAck({type:'save_status',ok:false,message:'Neonでエラー'})",g);
assert.match(gameMsg.textContent,/Neonでエラー/);
assert(!gameMsg.textContent.includes('✅'));
g.ws=null;
vm.runInContext('saveGameNow()',g);
assert.equal(sentGame.length,1);
assert.match(gameMsg.textContent,/未接続/);
g.ws={readyState:1};
g.room.persistence='memory';
vm.runInContext('saveGameNow()',g);
assert.equal(sentGame.length,1);
assert.match(gameMsg.textContent,/未設定/);

const elements=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,
   textContent:'',addEventListener(type,fn){this['on'+type]=fn}});
 return elements.get(id);
}
let artSent=[],online=true;
const a={$:el,send:msg=>artSent.push(msg),connected:()=>online};
vm.createContext(a);
vm.runInContext(section(art,'let cloudSaveInFlight=false;',"$('ec-rejoin').addEventListener"),a);
el('ec-save-cloud').onclick();
assert.equal(artSent.length,1);
assert.equal(artSent[0].type,'save_now');
assert(el('ec-save-cloud').disabled);
el('ec-save-cloud').onclick();
assert.equal(artSent.length,1);
const artAck=section(art,"if(d.type==='save_status'){","if(d.type==='error'){");
vm.runInContext('function artAck(d){'+artAck+'}',a);
vm.runInContext("artAck({type:'save_status',ok:true,at:1730000000})",a);
assert(!el('ec-save-cloud').disabled);
assert.match(el('ec-save-result').textContent,/保存完了を確認/);
vm.runInContext("artAck({type:'save_status',ok:false,message:'DB一時停止'})",a);
assert.match(el('ec-save-result').textContent,/DB一時停止/);
assert(!el('ec-save-result').textContent.includes('✅'));
online=false;
el('ec-save-cloud').onclick();
assert.equal(artSent.length,1);
assert.match(el('ec-save-result').textContent,/未接続/);
console.log('PASS cloud save UI: pending, successful commit, failure, offline and duplicate-click guard');

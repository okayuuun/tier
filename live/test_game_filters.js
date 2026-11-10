'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const file=fs.readFileSync(require('node:path').join(__dirname,'public','game_filters.js'),'utf8');
const sandbox={console,localStorage:{getItem(key){return key==='nk_echa_recent_room'?'TEST23':null}},PUBLIC_GAMES:null,document:{}};
vm.createContext(sandbox);vm.runInContext(file,sandbox);
const limits=vm.runInContext('GAME_PLAYERS',sandbox);
const keys=Object.keys(limits);
assert(keys.length>=30,'all registered games should have a range');
for(const [key,[min,max]] of Object.entries(limits)){
 assert(Number.isInteger(min)&&Number.isInteger(max)&&2<=min&&max<=12&&min<=max,key);
}
assert.deepEqual([...limits.episode],[3,12]);
assert.deepEqual([...limits.drawfake],[5,12]);
assert.deepEqual([...limits.insider],[4,12]);
assert.deepEqual([...limits.ito],[2,10]);
assert.deepEqual([...limits.drawbluff],[3,10]);
assert.deepEqual([...limits.oneword],[3,12]);
assert.deepEqual([...limits.spectrum],[3,12]);
assert.deepEqual([...limits.quiet],[2,10]);
assert.deepEqual([...limits.bluff],[2,8]);
assert.deepEqual([...limits.wordagents],[4,12]);
assert.deepEqual([...limits.royalletter],[2,6]);
assert.deepEqual([...limits.cipherrelay],[4,12]);
assert.deepEqual([...limits.skyfire],[2,5]);
assert.deepEqual([...limits.scoutline],[2,6]);
assert.deepEqual([...limits.aiuebattle],[2,5]);
assert.match(vm.runInContext('gameFilterBar()',sandbox),/3〜5人向けおすすめ/);
assert.match(vm.runInContext('recentEchaLink()',sandbox),/echa\?room=TEST23/);
const order=keys.map(k=>({dataset:{gameKey:k},style:{}}));
const grid={
 querySelectorAll(){return order.slice()},
 appendChild(item){const i=order.indexOf(item);order.splice(i,1);order.push(item)}
};
const status={textContent:''};
sandbox.GAMES=Object.fromEntries(keys.map(k=>[k,{title:k}]));
sandbox.document={
 querySelector(id){return id==='[data-games-grid]'?grid:null},
 getElementById(id){return id==='nk-games-count'?status:null}
};
const visible=()=>order.filter(x=>x.style.display!=='none').map(x=>x.dataset.gameKey);
vm.runInContext("setGamesFor('3')",sandbox);
assert(visible().includes('episode') && visible().includes('wolf') && visible().includes('oneword'));
assert(!visible().includes('drawfake') && !visible().includes('insider') && !visible().includes('wordagents'));
assert(visible().includes('quiet') && visible().includes('bluff'));

vm.runInContext("setGamesFor('4')",sandbox);
assert(visible().includes('insider') && !visible().includes('drawfake') && visible().includes('wordagents'));
vm.runInContext("setGamesFor('5')",sandbox);
assert(visible().includes('drawfake'));
vm.runInContext("setGamesFor('2')",sandbox);
assert(!visible().includes('episode') && visible().includes('tier'));
vm.runInContext("setGamesFor('6');setGamesSort('maximum')",sandbox);
assert.equal(order[0].dataset.gameKey,'skyfire');
vm.runInContext("setGamesFor('all');setGamesSort('recommended')",sandbox);
assert.equal(order[0].dataset.gameKey,'oneword');
assert.equal(status.textContent,keys.length+'種類');
sandbox.PUBLIC_GAMES=['episode','tier'];
vm.runInContext('applyGameFilters()',sandbox);
assert.deepEqual(visible().sort(),['episode','tier']);
console.log('PASS: all game player limits, 2-6 filters, 3-5 ranking, visibility and echa return link');

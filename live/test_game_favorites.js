'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(__dirname+'/public/main.js','utf8');
const start=s.indexOf('const FAVORITES_STORAGE_KEY=');
const end=s.indexOf('function landing(){',start);
assert(start>0&&end>start);
const storage=new Map(),sent=[],buttons=[];
const GAMES={tier:{},wolf:{},quiz:{},soup:{}};
const room={players:[
 {id:'owner',name:'あお',favorites:['wolf','tier']},
 {id:'friend',name:'みどり',favorites:['wolf']},
 {id:'evil',name:'<script>',favorites:['tier']}
]};
const me='owner';
const context={
 GAMES,room,me,
 ws:{readyState:1},WebSocket:{OPEN:1},send:msg=>sent.push(msg),
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 document:{querySelectorAll:()=>buttons},
 esc:x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;')};
vm.createContext(context);
vm.runInContext(s.slice(start,end),context);
assert.match(vm.runInContext("favoritePeople('wolf')",context),/あお・みどり/);
assert.match(vm.runInContext("favoritePeople('tier')",context),/&lt;script&gt;/);
assert(!vm.runInContext("favoritePeople('tier')",context).includes('<script>'));
assert.match(vm.runInContext("favoritePeople('quiz')",context),/登録者はいません/);
buttons.push({classList:{toggle(){}},setAttribute(){},textContent:''});
vm.runInContext("toggleFavorite('wolf')",context);
assert.equal(JSON.parse(storage.get('nk_favorite_games_v1'))[0],'wolf');
assert.equal(sent.at(-1).type,'favorites');
assert.deepEqual(Array.from(sent.at(-1).games),['wolf']);
assert.match(vm.runInContext("favoriteButton('wolf')",context),/お気に入り済み/);
vm.runInContext("toggleFavorite('wolf')",context);
assert.deepEqual(JSON.parse(storage.get('nk_favorite_games_v1')),[]);
assert.match(vm.runInContext("favoriteButton('wolf')",context),/お気に入りに登録/);
vm.runInContext("toggleFavorite('nonexistent')",context);
assert.equal(sent.length,2);
assert(s.includes('favorites:favoriteGames()'),'initial join must share preference list');
console.log('PASS: game favorites persist locally, sync to room, and show escaped voter names');

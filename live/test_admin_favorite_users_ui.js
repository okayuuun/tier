'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const main=fs.readFileSync(__dirname+'/public/main.js','utf8');
const admin=fs.readFileSync(__dirname+'/public/master.js','utf8');

// The ID is stable for the same browser but is not sent in public room state.
const idStart=main.indexOf("const FAVORITES_STORAGE_KEY=");
const idEnd=main.indexOf("function favoriteGames(){",idStart);
assert(idStart>0&&idEnd>idStart);
const store=new Map();
let generated=0;
const context={
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 iid:()=>{generated++;return 'cafebabe'.repeat(5)}
};
vm.createContext(context);
vm.runInContext(main.slice(idStart,idEnd),context);
const id=vm.runInContext('favoriteProfileId()',context);
assert.equal(id.length,32);
assert.match(id,/^[a-f0-9]{32}$/);
assert.equal(vm.runInContext('favoriteProfileId()',context),id);
assert.equal(generated,1);
assert(main.includes('profileId:favoriteProfileId()'));
assert(!main.includes('localStorage.setItem(\'nakami_sid_\'+code,FAVORITE_PROFILE_KEY)'));

// Admin presentation must HTML-escape nicknames and show each game preference.
const start=admin.indexOf('async function fetchFavoriteUsers(){');
const end=admin.indexOf('async function fetchHistory(){',start);
assert(start>0&&end>start);
const list={innerHTML:''};
const field={value:''};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const a={
 document:{getElementById:id=>id==='favorite-users-list'?list:id==='favorite-filter'?field:null},
 esc,tJst:s=>s,labelGame:g=>({wolf:'ワードウルフ',tier:'ティア表'}[g]||g)
};
vm.createContext(a);
vm.runInContext('let favoriteRows=[];\n'+admin.slice(start,end),a);
vm.runInContext(`favoriteRows=[{name:'<script>alert(1)</script>',personKey:'ab1234',
 firstSeen:'2026-11-16',lastSeen:'2026-11-16',
 lastRoom:'ABC123',online:false,favorites:['wolf','tier']}]; renderFavoriteUsers()`,a);
assert(list.innerHTML.includes('&lt;script&gt;'));
assert(!list.innerHTML.includes('<script>'));
assert(list.innerHTML.includes('ワードウルフ'));
assert(list.innerHTML.includes('ティア表'));
assert(list.innerHTML.includes('ab1234'));
field.value='存在しない名前';
vm.runInContext('renderFavoriteUsers()',a);
assert(list.innerHTML.includes('該当する参加者の記録がありません'));
assert(admin.includes("['favorites','👥 参加者・お気に入り']"));
console.log('PASS: anonymous per-browser identity and safe private favorites list');

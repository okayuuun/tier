'use strict';
// ワードウルフのブラウザUIを軽量な偽DOMで検証する。
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'public','party_ui.js'),'utf8');

const events=[], confirmations=[];
const room={
 game:'wolf',phase:'wolf_talk',matchNo:1,code:'WOLF01',owner:'p0',
 active:['p0','p1','p2','p3'],
 players:['p0','p1','p2','p3'].map(id=>({id,name:id})),
 party:{round:0,roundLimit:5,myWord:'りんご',myVote:'p1',
  votedCount:2,votedPlayers:['p0','p2']}
};
const sandbox={
 console,room,me:'p0',app:{innerHTML:''},
 GAMES:{wolf:{icon:'🐺',title:'ワードウルフ'}},
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 roomBar:()=>'',panel:(_k,_t,body)=>body,
 action:(name)=>'<button>'+name+'</button>',
 send:o=>events.push(o),
 confirm:txt=>{confirmations.push(txt);return true;},
 document:{getElementById:()=>null}
};
vm.createContext(sandbox);
vm.runInContext(src,sandbox);
vm.runInContext('renderWolf()',sandbox);
assert.match(sandbox.app.innerHTML,/投票を変更する/);
assert.match(sandbox.app.innerHTML,/現在の投票先/);
assert.match(sandbox.app.innerHTML,/disabled/);
assert.match(sandbox.app.innerHTML,/aria-valuenow="2"/);
assert.match(sandbox.app.innerHTML,/aria-valuemax="4"/);
assert.match(sandbox.app.innerHTML,/✅ p2さん/);
assert.match(sandbox.app.innerHTML,/⏳ p3さん/);
assert.doesNotMatch(sandbox.app.innerHTML,/p2さん.*に投票しています/);
vm.runInContext("voteWolf('p1')",sandbox);
assert.equal(events.length,0,'今の投票先は選び直せない');
vm.runInContext("voteWolf('p2')",sandbox);
assert.equal(events.length,1);
assert.equal(events[0].type,'wolf_vote');
assert.equal(events[0].target,'p2');
assert.match(confirmations[0],/変更しますか/);
vm.runInContext('forceWolfVote()',sandbox);
assert.equal(events[1].type,'wolf_force');
assert.match(confirmations[1],/まだ投票していない人/);
room.party.myVote=null;room.party.votedCount=0;room.party.votedPlayers=[];
vm.runInContext('renderWolf()',sandbox);
assert.match(sandbox.app.innerHTML,/誰が少数派だと思う/);
assert.match(sandbox.app.innerHTML,/aria-valuenow="0"/);
assert.doesNotMatch(sandbox.app.innerHTML,/投票を変更する/);
console.log('Wolf vote revision UI passed');

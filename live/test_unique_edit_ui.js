'use strict';
// Browserless check for the answer-revision experience.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'public', 'party_ui.js'), 'utf8');

let inputValue = '青いりんご';
const events = [];
const room = {
 game: 'unique', phase: 'uniq_answer', matchNo: 1,
 owner: 'p0', code: 'TEST01', active: ['p0','p1','p2'],
 players: ['p0','p1','p2'].map(id => ({id,name:id})),
 party: {
  round: 0, roundLimit: 10, theme: '好きな食べ物',
  streak: 1, targetStreak: 5, submitted: true,
  submittedCount: 2, myAnswer: '赤いりんご'
 }
};
const sandbox = {
 console, room, me: 'p0', app: {innerHTML: ''},
 GAMES: {unique: {icon: '✨', title: '全員不一致ゲーム'}},
 esc: s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 roomBar: () => '', panel: (_tag,_title,body) => body,
 action: label => '<button>' + label + '</button>',
 send: evt => events.push(evt),
 error: msg => {throw Error(msg)},
 document: {getElementById: id => id === 'uniq-input' ? {value: inputValue} : null}
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
vm.runInContext('renderUnique()', sandbox);
assert.match(sandbox.app.innerHTML, /今の回答：<strong>赤いりんご<\/strong>/);
assert.match(sandbox.app.innerHTML, /回答を修正して送る/);
assert.match(sandbox.app.innerHTML, /role="progressbar"/);
assert.match(sandbox.app.innerHTML, /aria-valuenow="2"/);
assert.match(sandbox.app.innerHTML, /aria-valuemax="3"/);
assert.doesNotMatch(sandbox.app.innerHTML, /他の人の回答内容/);

vm.runInContext('submitUnique()', sandbox);
assert.equal(events.length,1);
assert.equal(events[0].type, 'uniq_answer');
assert.equal(events[0].text, '青いりんご');

room.party.myAnswer = '青いりんご';
vm.runInContext('renderUnique()', sandbox);
assert.match(sandbox.app.innerHTML, /今の回答：<strong>青いりんご<\/strong>/);

room.party.round = 1;
room.party.theme = '好きな色';
room.party.submitted = false;
room.party.submittedCount = 0;
room.party.myAnswer = null;
vm.runInContext('renderUnique()', sandbox);
assert.match(sandbox.app.innerHTML, /回答を送る/);
assert.doesNotMatch(sandbox.app.innerHTML, /value="青いりんご"/);
assert.match(sandbox.app.innerHTML, /aria-valuenow="0"/);
console.log('Unique answer edit UI passed');

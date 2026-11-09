'use strict';
/** Runtime smoke test for the spoiler gallery without a real browser or database. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const root = { innerHTML: '' };
const search = { value: '' };
const store = new Map();
const sample = {
  spec: {
    title: 'キャラのミリしら', series: '架空アニメ',
    characters: [
      {id:'c01',label:'キャラクターA',image:'',truthNote:'主人公',
        fields:[{id:'q01',label:'性格は？',truth:'優しい',type:'long',options:[]}]},
      {id:'c02',label:'キャラクターB',image:'',truthNote:'最後のボス',
        fields:[{id:'q02',label:'生存？',truth:'死亡',type:'choice',options:['生存','死亡']}]}
    ]
  },
  responses: Array.from({length: 11}, (_,i) => ({
    id:i+1,name:'友達'+(i+1),votes:i,
    answers: {
      c01:{q01:i===0?'とても勇敢':'おだやか'},
      c02:{q02:'生存'}
    }
  })),
  expiresAt:2000000000
};

const ctx = {
  console,
  location:{origin:'https://demo.test',hash:''},
  window:{addEventListener(){}},
  document:{
    getElementById(id){return id==='milli-root'?root:search;},
    querySelector(){return {scrollIntoView(){}};}
  },
  localStorage:{
    getItem(key){return store.get(key)||null;},
    setItem(key,val){store.set(key,String(val));}
  },
  fetch:async () => ({ok:true,json:async()=>sample}),
  navigator:{clipboard:{writeText:async()=>{}}},
  confirm:()=>true,
  alert:()=>{}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'public','milli.js'),'utf8'),ctx);
const milli = vm.runInContext('Milli',ctx);

(async()=>{
  await milli.loadGallery('form123');
  assert.match(root.innerHTML,/キャラクターA/);
  assert.match(root.innerHTML,/主人公/);
  assert.match(root.innerHTML,/人気順/);
  assert.match(root.innerHTML,/1 \/ 2 ページ/);
  assert.match(root.innerHTML,/11件の回答/);
  milli.galleryTurnPage(1);
  assert.match(root.innerHTML,/2 \/ 2 ページ/);
  milli.setGalleryCharacter(1);
  assert.match(root.innerHTML,/最後のボス/);
  assert.match(root.innerHTML,/死亡/);
  milli.setGalleryCharacter(0);
  search.value='友達3';
  milli.applyGallerySearch();
  assert.match(root.innerHTML,/1件の回答/);
  assert.match(root.innerHTML,/友達3/);
  assert.doesNotMatch(root.innerHTML,/友達2 さん/);
  milli.clearGallerySearch();
  milli.setGallerySort('recent');
  assert.match(root.innerHTML,/新しい順/);
  console.log('PASS: gallery render, responsive sections, tabs, pagination, search and sorting');
})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
/** Basic browser-context smoke test of profile templates and content sanitization. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto').webcrypto;
const encoder=new TextEncoder();
const profile={
  v:1,name:'<script>danger()</script>',subtitle:'作品づくり',bio:'友達とのゲーム',
  emoji:'🌷',avatar:'javascript:alert(1)',cover:'',
  theme:{accent:'#9a54db',bg:'#fff5fa',paper:'#ffffff',text:'#202020',
    pattern:'dots',font:'sans',columns:2,radius:20,spacing:16,shadow:true},
  blocks:[{id:'something12',type:'text',title:'私について',body:'<img src=x onerror=alert(1)>',wide:true},
          {id:'something13',type:'links',title:'リンク',body:'悪いリンク｜javascript:alert(1)\n良いリンク｜https://example.com',wide:false}]
};
const root={innerHTML:'',className:'',addEventListener(){}};
const preview={innerHTML:''};
const storage={getItem(key){return key==='nk_profile_canvas_v1'?JSON.stringify(profile):null},
               setItem(){}};
const document={
  getElementById(id){if(id==='pm-app')return root;if(id==='pm-preview')return preview;return null},
  createElement(){return {style:{},appendChild(){},remove(){}}},
  body:{appendChild(){}}
};
const sandbox={window:{NKM:{profile(){return {name:'おかゆ',emoji:'🌷',avatar:''}}}},
  location:{hash:'',origin:'https://example.test',pathname:'/profile-maker'},
  document,localStorage:storage,console,URL,crypto,TextDecoder,TextEncoder,
  setTimeout,clearTimeout,history:{replaceState(){}},btoa,atob};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'public','profile_maker.js'),'utf8'),sandbox);
const PM=vm.runInContext('PM',sandbox);
assert(PM.empty().blocks.length>=3);
assert.equal(PM.validate(profile).avatar,'');
const safe=PM.card(profile.blocks[0]);
assert(safe.includes('&lt;img'));
assert(!safe.includes('<img src=x'));
assert(preview.innerHTML.includes('&lt;script&gt;'));
assert(!preview.innerHTML.includes('<script>danger'));
assert(!preview.innerHTML.includes('href="javascript:'));
assert(preview.innerHTML.includes('https://example.com'));
(async()=>{
 const payload=JSON.stringify(PM.validate(profile));
 const link='j'+Buffer.from(payload,'utf8').toString('base64url');
 const parsed=await PM.openShared(link);
 assert.equal(parsed.name,profile.name);
 assert.equal(parsed.avatar,'');
 assert.equal(parsed.blocks.length,2);
 console.log('PASS: profile studio bootstrap, rich blocks, HTML escaping, URL validation, JSON share decoding');
})().catch(e=>{console.error(e);process.exitCode=1});

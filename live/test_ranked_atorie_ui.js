'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/public/ranked_ui.js','utf8');
const studio=fs.readFileSync(__dirname+'/public/studio.js','utf8');
const id='a'.repeat(24);
const authorGame={
 id:'saved1',v:2,game:'quiz',title:'友達理解度テスト',
 config:{qs:[{q:'一番好きな食べ物？',options:['りんご','みかん','バナナ','もも']}]},
 truth:[2]
};
const publicQuiz={v:2,game:'quiz',title:'友達理解度テスト',config:authorGame.config};
const htmlX=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const store=new Map(),requests=[],copied=[],notices=[],ui={innerHTML:''};
let draftStart=null,rendered=0,remembered=[],guesses=[],challenge=null;
const labels={quiz:['🎯','理解度クイズ']};
const fakeResponse=(body,ok=true)=>({
 ok,status:ok?200:400,json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)
});
const responseMap={
 '/api/ranked':()=>fakeResponse({id,expiresAt:2000000000,temporary:false}),
 ['/api/ranked/'+id]:()=>fakeResponse({data:publicQuiz,expiresAt:2000000000,temporary:false}),
 ['/api/ranked/'+id+'/leaderboard']:()=>fakeResponse({rows:[
  {name:'<script>危険</script>',score:1,maxScore:1,durationMs:6500}
 ],total:1}),
 ['/api/ranked/'+id+'/start']:()=>fakeResponse({attempt:'b'.repeat(32)}),
 ['/api/ranked/'+id+'/submit']:()=>fakeResponse({score:1,maxScore:1,durationMs:9800,
  truth:[2],rank:1,total:2,leaders:[
  {name:'友達A',score:1,maxScore:1,durationMs:9800}
 ]})
};
const ctx={
 console,JSON,Date,Math,Number,encodeURIComponent,
 location:{origin:'https://example.com',hash:''},ui,tab:'home',finished:false,
 renderPlay:()=>{rendered++},
 N:{games:()=>[authorGame],profile:()=>({name:'プレイヤー'}),remember:x=>remembered.push(x)},
 localStorage:{
  getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)
 },
 KIND:labels,X:htmlX,
 navigator:{clipboard:{writeText:async x=>copied.push(x)}},
 fetch:async(uri,options)=>{
  requests.push({uri,options});
  return responseMap[uri]?responseMap[uri]():fakeResponse('missing',false)
 },
 alert:msg=>notices.push(msg),confirm:()=>true,
 prompt:()=>null,
 renderLibrary:()=>{rendered++},
 payloadFor:g=>({...g}),
 section:(t,b)=>'<section><h2>'+htmlX(t)+'</h2>'+b+'</section>',
 bb:(t,cmd)=>'<button onclick="'+htmlX(cmd)+'">'+htmlX(t)+'</button>',
 document:{getElementById:id=>id==='ranked-name'?{value:'解答者'}:null},
 isStudioPublished:()=>true,
 loadChallenge:data=>{draftStart=data;ctx.tab='play';ctx.play=data;ctx.guesses=[2]},
 NKM:{},
};
vm.createContext(ctx);
vm.runInContext(src,ctx);

async function run(){
 await vm.runInContext('publishRanked(0)',ctx);
 const links=JSON.parse(store.get('nk_ranked_atelier_links_v1'));
 assert.equal(links.length,1);
 assert.equal(links[0].id,id);
 assert.equal(copied.at(-1),'https://example.com/studio#rank='+id);
 const createdRequest=requests.find(r=>r.uri==='/api/ranked');
 assert(createdRequest);
 assert.equal(JSON.parse(createdRequest.options.body).truth[0],2,
  'Author sends answer key to server, but not to public viewers');

 await vm.runInContext("loadRankedLink('"+id+"')",ctx);
 assert(ui.innerHTML.includes('友達理解度テスト'));
 assert(ui.innerHTML.includes('ランキング'));
 assert(ui.innerHTML.includes('&lt;script&gt;'));
 assert(!ui.innerHTML.includes('<script>'));
 assert.equal(vm.runInContext('rankedInfo.data.truth',ctx),undefined,
  'Public read must never include server-side answers');
 await vm.runInContext('startRanked()',ctx);
 assert.equal(draftStart.truth[0],0,'Client gets a placeholder, not the real correct answer');
 assert.equal(ctx.tab,'play');
 assert.equal(vm.runInContext('rankedAttempt',ctx),'b'.repeat(32));
 await vm.runInContext('finishRanked()',ctx);
 assert.equal(vm.runInContext('rankedResult.score',ctx),1);
 assert.equal(vm.runInContext('rankedResult.rank',ctx),1);
 assert.equal(ctx.play.truth[0],2,'Truth revealed only after server accepts submission');
 assert.equal(remembered.length,1);
 assert(!notices.some(x=>/失敗|エラー|採点結果を送信できません/.test(x)),
  'A completed result must not emit browser errors');
 const submitted=requests.find(r=>r.uri==='/api/ranked/'+id+'/submit');
 assert.equal(JSON.parse(submitted.options.body).name,'解答者');
 assert.deepEqual(JSON.parse(submitted.options.body).answers,[2]);
 assert(vm.runInContext('rankedResultHTML()',ctx).includes('あなたの順位'));
 assert(studio.includes('publishRanked('));
 assert(studio.includes("hash.startsWith('#rank=')"));
 assert(studio.includes('if(rankedAttempt)return finishRanked()'));
 assert(studio.includes('rankedResultHTML()'));
 console.log('PASS: author publishing, hidden answer key, valid contestant clicks and ranked scoreboard');
}
run().catch(e=>{console.error(e);process.exitCode=1});

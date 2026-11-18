'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ui={innerHTML:''},games=[],alerts=[],records=[];
const context={
 console,Promise,Math,Date,JSON,Number,Set,Array,
 location:{origin:'https://test.example',pathname:'/studio',hash:''},
 history:{replaceState(){}},
 document:{
  getElementById:id=>id==='content'?ui:id==='ranked-name'?{value:'挑戦者'}:null,
  querySelectorAll:()=>[]
 },
 ui,confirm:()=>true,alert:x=>alerts.push(x),prompt:()=>null,
 localStorage:{getItem:()=>null,setItem(){}},
 navigator:{clipboard:{writeText:async()=>{}}},
 fetch:async()=>({ok:true,json:async()=>({attempt:'z'.repeat(32)})}),
 NKM:{
  profile:()=>({name:'作者',emoji:'🌷'}),avatarHTML:()=>'<span>🌷</span>',
  games:()=>games,saveGame:g=>{
   games.unshift({...JSON.parse(JSON.stringify(g)),id:g.id||'local'+games.length});
   return true
  },deleteGame:()=>true,remember:x=>{records.push(x);return true},records:()=>records
 }
};
vm.createContext(context);
for(const file of ['ranked_ui.js','studio_more_ranked.js','studio.js']){
 const source=fs.readFileSync(__dirname+'/public/'+file,'utf8');
 vm.runInContext(source,context,{filename:file});
}
const go=x=>vm.runInContext(x,context);
function make(kind){
 go("chooseGame('"+kind+"')");
 assert(ui.innerHTML.includes('問題セットのタイトル'));
 assert(ui.innerHTML.includes('Q1'));
 go("draft.title='友達に送るクイズ';draft.config.qs[0].q='実験の問題は？'");
 if(kind==='number'){
  assert(ui.innerHTML.includes('許容誤差'));
  go('draft.truth[0]=60');
 }else if(kind==='typing'){
  assert(ui.innerHTML.includes('別表記'));
  go("draft.truth[0]='ピカチュウ|Pikachu'");
 }else{
  assert(ui.innerHTML.includes('右の答え'));
  go("draft.config.qs[0].options=['A','B','C','D']");
  go("draft.config.qs[0].rightOptions=['Bに合う','Cに合う','Aに合う','Dに合う']");
  go("draft.truth[0]=[2,0,1,3]");
  go('renderMake()');
  assert(ui.innerHTML.includes('pair-editor-row'));
 }
 assert.equal(go('verify(draft)'),'');
 go('saveDraft()');
 assert.equal(games[0].game,kind);
 assert(ui.innerHTML.includes('ランキング付きリンクを作る'));
 assert(!ui.innerHTML.includes('openOnlineRoom(0)'), 'Do not expose unsupported live game option');
 assert(!ui.innerHTML.includes("copyGame(0)"),'No unranked link sharing');
 go('loadChallenge(payloadFor(N.games()[0]))');
 assert.equal(go('play.game'),kind);
 if(kind==='number'){
  assert.equal(go('guesses[0]'),null);
  go('finishChallenge()');
  assert.equal(go('finished'),false);
  go("moreSetNumber(0,'55')");
  go('finishChallenge()');
  assert.equal(go('challengeScore()'),50);
  assert.equal(go('maximumScore()'),100);
 }else if(kind==='typing'){
  assert.equal(go("guesses[0]"),'');
  go("guesses[0]='ｐＩＫＡＣＨＵ  '");
  go('finishChallenge()');
  assert.equal(go('challengeScore()'),1);
 }else{
  assert.equal(JSON.stringify(go('guesses[0]')),'[-1,-1,-1,-1]');
  go('finishChallenge()');
  assert.equal(go('finished'),false);
  [2,0,1,3].forEach((n,j)=>go('moreSetPair(0,'+j+",'"+n+"')"));
  go('finishChallenge()');
  assert.equal(go('challengeScore()'),4);
  assert.equal(go('maximumScore()'),4);
 }
 assert.equal(go('finished'),true);
 assert(ui.innerHTML.includes('得点：'));
 assert(records.length>0);
}
make('number');make('typing');make('pairs');
async function testHiddenKeys(){
 for(const kind of ['number','typing','pairs']){
  go("chooseGame('"+kind+"')");
  const qs=kind==='number'?[{q:'Q',min:0,max:100,tolerance:10}]:
   kind==='typing'?[{q:'Q'}]:
   [{q:'Q',options:['A','B','C','D'],rightOptions:['1','2','3','4']}];
  context.publicData={id:'a'.repeat(24),data:{v:2,title:'非公開正解',game:kind,config:{qs}}};
  go('rankedInfo=publicData');
  await go('startRanked()');
  assert.equal(go('play.game'),kind);
  assert.equal(go('rankedResult'),null);
  assert.equal(go('finished'),false);
  const hidden=go('play.truth[0]');
  if(kind==='number')assert.equal(hidden,0);
  if(kind==='typing')assert.equal(hidden,'非公開');
  if(kind==='pairs')assert.deepEqual(JSON.stringify(hidden),'[0,1,2,3]');
  go("chooseTab('make')");
 }
 console.log('PASS: three distinct editors, local scoring, active controls and hidden ranked answers');
}
testHiddenKeys().catch(e=>{console.error(e);process.exitCode=1});

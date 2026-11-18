'use strict';
// Run the actual creator/player JavaScript without mocking away its controls.
// This catches malformed editors, missing saved-game support and ranking-only
// links accidentally appearing as unsupported real-time multiplayer games.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const files=['ranked_ui.js','studio.js'];
const ui={innerHTML:''},saved=[],messages=[],records=[];
const ctx={
  console,JSON,Math,Date,Set,Number,Promise,Array,encodeURIComponent,
  ui,location:{origin:'https://example.org',pathname:'/studio',hash:''},
  history:{replaceState(){}},navigator:{clipboard:{writeText:async()=>{}}},
  document:{
    getElementById:id=>id==='content'?ui:id==='ranked-name'?{value:'解答者'}:null,
    querySelectorAll:()=>[],
  },
  localStorage:{getItem:()=>null,setItem(){}},
  confirm:()=>true,prompt:()=>null,
  alert:msg=>messages.push(msg),
  fetch:async()=>({ok:false}),
  NKM:{
    profile:()=>({name:'作者',emoji:'🌷'}),avatarHTML:()=>'<span>🌷</span>',
    games:()=>saved,
    saveGame:g=>{
      saved.unshift({...JSON.parse(JSON.stringify(g)),id:g.id||'saved'+saved.length});
      return true
    },
    records:()=>records,remember:r=>{records.push(r);return true},
    deleteGame:()=>true
  }
};
vm.createContext(ctx);
for(const file of files)
  vm.runInContext(fs.readFileSync(__dirname+'/public/'+file,'utf8'),ctx);

function run(src){return vm.runInContext(src,ctx)}
function assertMode(mode){
  run("chooseGame('"+mode+"')");
  assert(ui.innerHTML.includes('問題セットのタイトル'));
  assert(ui.innerHTML.includes('Q1'));
  run("draft.title='自作テスト';draft.config.qs[0].q='新しい問題'");
  if(mode==='truefalse'){
    run("draft.truth[0]=1");
    assert(ui.innerHTML.includes('○ 正しい'));
    assert(ui.innerHTML.includes('× 間違い'));
  }else{
    run("draft.config.qs[0].options=['春','夏','秋','冬']");
    if(mode==='multi'){
      run("draft.truth[0]=[0,2]");
      run('renderMake()');
      assert(ui.innerHTML.includes('toggleMultiTruth'));
      assert(ui.innerHTML.includes('checkbox'));
    }else{
      run("draft.truth[0]=[2,0,3,1]");
      run('renderMake()');
      assert(ui.innerHTML.includes('moveOrder'));
      assert(ui.innerHTML.includes('正しい順番'));
    }
  }
  assert.equal(run('verify(draft)'),'');
  run('saveDraft()');
  assert.equal(saved[0].game,mode);
  assert(ui.innerHTML.includes('ランキング付きリンクを作る'));
  assert(!ui.innerHTML.includes("copyGame(0)"),'Ranking-only games do not use untracked ordinary link');
  assert(!ui.innerHTML.includes("openOnlineRoom(0)"),'Ranking-only games are not real-time rooms');
  run('loadChallenge(payloadFor(N.games()[0]))');
  assert.equal(run('play.game'),mode);
  if(mode==='truefalse'){
    assert.equal(run('guesses[0]'),null);
    run('setGuess(0,1)');run('finishChallenge()');
    assert.equal(run('challengeScore()'),1);
  }else if(mode==='multi'){
    assert.equal(JSON.stringify(run('guesses[0]')),'[]');
    run('toggleMultiGuess(0,0)');
    run('finishChallenge()');
    assert.equal(run('finished'),false,'Require at least 2 selected answers');
    run('toggleMultiGuess(0,2)');
    run('finishChallenge()');
    assert.equal(run('challengeScore()'),1);
  }else{
    assert.equal(JSON.stringify(run('guesses[0]')),'[0,1,2,3]');
    run("moveOrder('play',0,2,-1)");
    run("moveOrder('play',0,1,-1)");
    run("moveOrder('play',0,3,-1)");
    run('finishChallenge()');
    assert.equal(run('challengeScore()'),4);
    assert.equal(run('maximumScore()'),4);
  }
  assert.equal(run('finished'),true);
  assert(ui.innerHTML.includes('得点'));
  assert.equal(records.length>0,true);
}
assertMode('truefalse');
assertMode('multi');
assertMode('order');

async function hiddenAnswerTest(){
  // Server returns only question text; client uses a shape-compatible dummy
  // truth until it receives the real key AFTER grading.
  const originalFetch=ctx.fetch;
  ctx.fetch=async()=>({ok:true,json:async()=>({attempt:'b'.repeat(32)})});
  for(const mode of ['truefalse','multi','order']){
    run("chooseGame('"+mode+"')");
    const config=mode==='truefalse'?
      {qs:[{q:'Q',options:['○ 正しい','× 間違い']}]}:
      {qs:[{q:'Q',options:['春','夏','秋','冬']}]};
    ctx.rankedDummy={id:'a'.repeat(24),data:{v:2,game:mode,title:'秘密の問題',config}};
    run('rankedInfo=rankedDummy');
    await run('startRanked()');
    assert.equal(run('play.game'),mode);
    assert(run('rankedAttempt'));
    assert.equal(run('finished'),false);
    // No correct answers were supplied by the challenge fetch.
    assert.equal(run('rankedResult'),null);
    run("chooseTab('home')");
  }
  ctx.fetch=originalFetch;
}
hiddenAnswerTest().then(()=>console.log(
  'PASS: three author editors, local save, actual answer controls and spoiler-free ranking starts'
)).catch(e=>{console.error(e);process.exitCode=1});

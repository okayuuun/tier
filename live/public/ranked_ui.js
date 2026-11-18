'use strict';
/* Ranked async challenges. The server alone validates answers and times. */
let rankedInfo=null,rankedAttempt='',rankedName='',rankedBoard=null;
let rankedResult=null,rankedSubmitting=false;
const RANKED_LINKS_KEY='nk_ranked_atelier_links_v1';

function rankedLinks(){
 try{
  const data=JSON.parse(localStorage.getItem(RANKED_LINKS_KEY)||'[]');
  return Array.isArray(data)?data.filter(x=>x&&typeof x.id==='string'&&typeof x.gameId==='string'):[]
 }catch(_){return []}
}
function rankedLink(id){return location.origin+'/studio#rank='+encodeURIComponent(id)}
function saveRankedLink(g,result){
 try{
  const entries=rankedLinks().filter(x=>x.id!==result.id);
  entries.unshift({id:result.id,gameId:g.id,title:g.title,expiresAt:result.expiresAt,
                   temporary:result.temporary});
  localStorage.setItem(RANKED_LINKS_KEY,JSON.stringify(entries.slice(0,100)))
 }catch(_){}
}
async function publishRanked(i){
 const g=N.games()[i];if(!g)return;
 if(g.game==='soup')return alert('ウミガメのスープは自由回答のため、自動採点ランキングに対応していません。');
 if(!isStudioPublished(g.game))return alert('現在非公開のゲームです');
 if(!confirm('ランキング付きで公開しますか？ リンクを知っている人は回答者の名前・点数・回答時間を閲覧できます。'))return;
 try{
  const resp=await fetch('/api/ranked',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(payloadFor(g))});
  if(!resp.ok)throw Error((await resp.text())||'リンクを発行できません');
  const result=await resp.json();saveRankedLink(g,result);renderLibrary();
  const url=rankedLink(result.id);
  try{await navigator.clipboard.writeText(url)}
  catch(_){prompt('友達へ送るリンクをコピーしてください',url);return}
  alert('🏆 ランキング付きリンクをコピーしました！'+
   (result.temporary?'（一時リンクのためサーバー再起動で消える場合があります）':'（最大30日間有効）'))
 }catch(err){alert('ランキング付きリンクの作成に失敗しました：'+err.message)}
}
async function copyRankedLink(id){
 const url=rankedLink(id);
 try{await navigator.clipboard.writeText(url);alert('リンクをコピーしました')}
 catch(_){prompt('このリンクをコピーしてください',url)}
}
function openRankedLink(id){location.hash='rank='+encodeURIComponent(id);loadRankedLink(id)}
function rankSeconds(ms){return (Math.max(0,Number(ms)||0)/1000).toFixed(1)+'秒'}
function leaderboardHTML(board){
 const rows=Array.isArray(board?.rows)?board.rows:[];
 return '<section class="ranked-leaderboard"><h3>🏆 ランキング　'+
  X(board?.total||0)+'人</h3>'+
  (rows.length?'<div class="stack">'+rows.map((r,i)=>
   '<div class="stat"><strong>'+(i+1)+'位 '+X(r.name)+'</strong>　'+
   X(r.score)+' / '+X(r.maxScore)+'点 · '+X(rankSeconds(r.durationMs))+
   '</div>').join('')+'</div>':'<p class="muted">まだ回答者がいません。最初の挑戦者になろう！</p>')+
  '<small class="muted">得点順、同点なら短い回答時間順。このリンクを知っている人には、ニックネームと結果が公開されます。</small></section>'
}
function rankedResultHTML(){
 if(!rankedResult)return '';
 const position=rankedResult.rank?rankedResult.rank+'位':'100位圏外';
 return '<div class="result"><strong>あなたの順位：'+X(position)+
  '</strong><p>回答時間：'+X(rankSeconds(rankedResult.durationMs))+'</p></div>'+
  leaderboardHTML(rankedBoard)
}
async function loadRankedLink(id){
 if(!/^[a-zA-Z0-9_-]{16,40}$/.test(id)){
  ui.innerHTML=section('ランキング問題','リンクの形式が正しくありません');return
 }
 tab='ranked';rankedInfo=null;rankedAttempt='';rankedResult=null;rankedBoard=null;
 ui.innerHTML=section('ランキング問題','<p>問題を読み込んでいます…</p>');
 try{
  const [challenge,leaders]=await Promise.all([
   fetch('/api/ranked/'+encodeURIComponent(id),{cache:'no-store'}),
   fetch('/api/ranked/'+encodeURIComponent(id)+'/leaderboard',{cache:'no-store'})
  ]);
  if(!challenge.ok)throw Error(await challenge.text()||'問題を取得できません');
  if(!leaders.ok)throw Error(await leaders.text()||'ランキングを取得できません');
  rankedInfo={id,...await challenge.json()};
  rankedBoard=await leaders.json();renderRankedIntro()
 }catch(e){ui.innerHTML=section('リンクを開けませんでした',
  '<p>'+X(e.message)+'</p>'+bb('アトリエへ戻る',"chooseTab('home')"))}
}
function renderRankedIntro(){
 if(!rankedInfo)return;
 const data=rankedInfo.data;
 const count=data.game==='tier'?data.config.rounds.length:data.config.qs.length;
 const defaultName=N.profile()?.name||'';
 ui.innerHTML=section('🏆 ランキングに挑戦',
  '<h3>'+X(data.title)+'</h3><p>'+X(KIND[data.game]?.[1]||'自作問題')+
  ' · '+X(count)+'問</p>'+
  '<p>名前を決めて挑戦しよう！採点は回答後に行われ、点数と回答時間がランキングに追加されます。</p>'+
  '<label for="ranked-name">ランキングに載せるニックネーム</label>'+
  '<input class="field" id="ranked-name" maxlength="24" autocomplete="nickname" value="'+X(defaultName)+'" placeholder="ニックネーム">'+
  '<div class="row">'+bb('🎮 挑戦する','startRanked()','primary')+
  bb('ランキングを更新','refreshRankedBoard()','secondary')+'</div>'+
  (rankedInfo.temporary?'<div class="notice">⚠️ 一時リンクです。サーバー再起動でランキングが消える場合があります。</div>':
   '<div class="notice">☁️ このランキングは公開から最大30日間保存されます。</div>')+
  leaderboardHTML(rankedBoard))
}
async function startRanked(){
 if(!rankedInfo||rankedSubmitting)return;
 const name=document.getElementById('ranked-name')?.value.trim()||'';
 if(!name||name.length>24)return alert('ニックネームは1〜24文字で入力してください');
 rankedSubmitting=true;
 try{
  const resp=await fetch('/api/ranked/'+encodeURIComponent(rankedInfo.id)+'/start',{method:'POST'});
  if(!resp.ok)throw Error(await resp.text()||'参加に失敗しました');
  rankedAttempt=(await resp.json()).attempt;rankedName=name;
  const data=rankedInfo.data;
  // Dummy answers are never graded locally. The real key stays on the server
  // until after a valid submitted attempt.
  const hidden=data.game==='tier'?data.config.rounds.map(()=>[0,1,2,3,4]):
   data.game==='order'?data.config.qs.map(()=>[0,1,2,3]):
   data.game==='multi'?data.config.qs.map(()=>[0,1]):
   data.game==='pairs'?data.config.qs.map(()=>[0,1,2,3]):
   data.game==='typing'?data.config.qs.map(()=>'非公開'):
   data.game==='number'?data.config.qs.map(q=>q.min):
   data.config.qs.map(()=>0);
  loadChallenge({...data,truth:hidden});
 }catch(e){alert('問題を開始できません：'+e.message)}
 finally{rankedSubmitting=false}
}
async function refreshRankedBoard(){
 if(!rankedInfo)return;
 try{
  const resp=await fetch('/api/ranked/'+encodeURIComponent(rankedInfo.id)+'/leaderboard',{cache:'no-store'});
  if(!resp.ok)throw Error(await resp.text());
  rankedBoard=await resp.json();
  if(tab==='play')renderPlay();else renderRankedIntro()
 }catch(e){alert('ランキングを更新できません：'+e.message)}
}
async function finishRanked(){
 if(rankedSubmitting||!rankedAttempt||!rankedInfo)return;
 rankedSubmitting=true;
 try{
  const resp=await fetch('/api/ranked/'+encodeURIComponent(rankedInfo.id)+'/submit',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({attempt:rankedAttempt,name:rankedName,answers:guesses})
  });
  if(!resp.ok)throw Error(await resp.text()||'採点に失敗しました');
  rankedResult=await resp.json();
  play.truth=rankedResult.truth;finished=true;
  rankedBoard={rows:rankedResult.leaders,total:rankedResult.total};
  N.remember({key:'ranked_'+rankedInfo.id+'_'+Date.now(),title:play.title,game:play.game,
   info:'ランキング '+rankedResult.score+'/'+rankedResult.maxScore+'点'});
  renderPlay()
 }catch(e){alert('採点結果を送信できませんでした。回答はそのまま残っています：'+e.message)}
 finally{rankedSubmitting=false}
}

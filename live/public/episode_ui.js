'use strict';
/* "誰のエピソード？": a private writing round, then anonymous match-and-reveal. */
const EPISODE_GAMES=['episode'];
let epDraft={key:'',topic:'',story:'',answers:{}};
function epState(){
 const p=room.episode,k=[room.code,room.matchNo,p.round,room.game].join(':');
 if(epDraft.key!==k)epDraft={key:k,topic:'',story:'',answers:{}};
 return epDraft;
}
function epBtn(text,js,kind=''){return action(text,js,kind)}
function epPanel(title,body){
 app.innerHTML=panel('STORY / '+GAMES.episode.title,title,roomBar()+body+'<p id="err" class="error" hidden></p>');
}
function epProgress(p){
 return '<div class="ep-progress"><b>ROUND '+(p.round+1)+' / '+p.roundLimit+'</b><span>'+esc(p.topic||'誰が書いたの？')+'</span></div>';
}
function epLeaderboard(){
 return '<div class="ep-board">'+[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>'<div class="ep-score"><b>'+(i+1)+'位 '+esc(p.name)+'</b><strong>'+p.score+'pt</strong></div>').join('')+'</div>';
}
function epPickTopic(i){
 const p=room.episode,d=epState(),choice=p.sampleTopics[Number(i)]||'';
 if(!choice)return;
 d.topic=choice;
 const field=document.getElementById('ep-topic');if(field)field.value=choice;
}
function epSubmitTopic(){
 const d=epState(),v=(document.getElementById('ep-topic')?.value||d.topic).trim();
 if(v.length<3||v.length>110)return error('お題を3〜110文字で入力してください');
 send({type:'ep_topic',text:v});
}
function epSubmitStory(){
 const d=epState(),v=(document.getElementById('ep-story')?.value||d.story).trim();
 if(v.length<8||v.length>320)return error('8〜320文字のエピソードを入力してください');
 if(!confirm('エピソードを提出しますか？ 全員が提出するまで作者は伏せられます。'))return;
 send({type:'ep_submit',text:v});
}
function epPickAuthor(storyId,authorId){
 epState().answers[storyId]=authorId;
}
function epSubmitGuesses(){
 const p=room.episode,d=epState(),expected=p.entries.filter(x=>!x.mine),authors=p.candidates.map(x=>x.id).filter(x=>x!==me);
 const answers={};expected.forEach(x=>answers[x.id]=d.answers[x.id]||'');
 if(expected.some(x=>!answers[x.id]))return error('自分以外のすべてのエピソードの書き手を選んでください');
 if(new Set(Object.values(answers)).size!==expected.length||Object.values(answers).some(x=>!authors.includes(x))){
  return error('同じ人を2回選ぶことはできません。全員を一度ずつ指定してください');
 }
 send({type:'ep_guess',answers});
}
function epForce(){
 if(!confirm('未提出の人を除いて次へ進みますか？ 投稿が3件以上必要です。／予想中なら提出済みの予想だけ採点します。'))return;
 send({type:'ep_force'});
}
function epResult(record,final=false){
 const players=Object.fromEntries(room.players.map(p=>[p.id,p.name]));
 return '<div class="ep-reveal">'+(record.entries||[]).map((x,i)=>{
   const guesses=(record.guesses||[]).filter(g=>g.id!==x.author).map(g=>{
     const predicted=g.answers?.[x.id];
     const correct=predicted===x.author;
     return '<span class="ep-guess-chip '+(correct?'correct':'wrong')+'">'+esc(g.name)+' → '+esc(players[predicted]||'未回答')+(correct?' ✓':' ×')+'</span>';
   }).join('');
   return '<article class="ep-story-card"><div class="ep-card-head"><span class="ep-anon">STORY '+(i+1)+'</span><strong>✍️ '+esc(x.name)+' さん</strong></div><p class="ep-story-text">'+esc(x.text)+'</p><div class="ep-guesses">'+(guesses||'<span class="muted">予想なし</span>')+'</div></article>';
 }).join('')+'</div>'
}
function renderEpisode(){
 if(!room||room.game!=='episode')return;
 const p=room.episode,owner=room.owner===me,phase=room.phase,d=epState();
 if(phase==='ep_topic'){
  if(!d.topic)d.topic=p.sampleTopics[(p.round*3)%p.sampleTopics.length]||'';
  const options=p.sampleTopics.map((t,i)=>'<option value="'+i+'">'+esc(t)+'</option>').join('');
  epPanel('今回のテーマを決めよう',epProgress(p)+
    (owner?'<div class="ep-callout">🎙️ どんな思い出を話してもらう？ お題は完全に自由。例から選んだあと編集もできます。</div><label class="labeled" for="ep-preset">例題を選ぶ</label><select id="ep-preset" class="field" onchange="epPickTopic(this.value)">'+options+'</select><label class="labeled" for="ep-topic">今回のお題（自由に書き換えられます）</label><input class="field" maxlength="110" id="ep-topic" value="'+esc(d.topic)+'" oninput="epState().topic=this.value">'+
    '<div class="btns">'+epBtn('このお題で開始','epSubmitTopic()','gold')+'</div>':'<div class="ep-callout">👑 主催者がお題を選んでいます。みんなには回答の作者が最後まで隠されます。</div>')+
    '<div class="ep-guide">遊び方：全員が実話・創作どちらでもよい短いエピソードを書く → 作者を伏せて展示 → 全員が書き手を予想 → 答え合わせ！<br>※投稿内容は対戦参加者全員に公開されます。個人情報や知られたくない秘密は書かないでください。</div>');
  return
 }
 if(phase==='ep_write'){
  epPanel('エピソードを匿名で投稿',epProgress(p)+'<div class="ep-callout">'+esc(p.topic)+'</div>'+
   '<div class="ep-meter">投稿 '+p.submittedCount+' / '+p.needed+'人</div>'+
   (p.submitted?'<div class="ep-done">✅ 投稿済み！みんなのエピソードが集まるのを待っています。あなたの文章は予想が始まるまで公開されません。</div>':
    '<label class="labeled" for="ep-story">あなただけのエピソード（8〜320文字）</label><textarea id="ep-story" class="field ep-textarea" maxlength="320" oninput="epState().story=this.value" placeholder="例：急いで乗った電車が、実は反対方向だった……">'+esc(d.story)+'</textarea>'+
    '<p class="small">実話でも、身バレしないようにアレンジした話でもOK。投稿後の修正はできません。</p><div class="btns">'+epBtn('匿名で提出する','epSubmitStory()','gold')+'</div>')+
    (owner&&p.submittedCount>=3?'<div class="btns">'+epBtn('3件以上で予想へ進む','epForce()','alt')+'</div>':''));
  return
 }
 if(phase==='ep_guess'){
  const options=p.candidates.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
  let html=epProgress(p)+'<div class="ep-callout">🕵️ 誰がこのエピソードを書いた？ 他の人の文章の作者を全て当てよう。<br>作者は1人1作品。名前は重複して選べません。</div><div class="ep-meter">予想 '+p.guessedCount+' / '+p.guessNeeded+'人</div>';
  if(p.guessed)html+='<div class="ep-done">✅ 予想を提出しました！答え合わせを待っています。</div>';
  else html+='<div class="ep-guess-list">'+p.entries.map((x,i)=>'<article class="ep-story-card"><div class="ep-card-head"><span class="ep-anon">STORY '+(i+1)+'</span>'+(x.mine?'<span class="ep-own">これはあなたの投稿</span>':'')+'</div><p class="ep-story-text">'+esc(x.text)+'</p>'+(x.mine?'<div class="small">あなたの文章なので予想不要です。</div>':'<label class="labeled">誰が書いた？</label><select class="field" onchange="epPickAuthor(\''+esc(x.id)+'\',this.value)"><option value="">予想する人を選択</option>'+p.candidates.filter(y=>y.id!==me).map(y=>'<option value="'+esc(y.id)+'" '+(d.answers[x.id]===y.id?'selected':'')+'>'+esc(y.name)+'</option>').join('')+'</select>')+'</article>').join('')+'</div><div class="btns">'+epBtn('全員分の予想を提出する','epSubmitGuesses()','gold')+'</div>';
  if(owner)html+='<div class="btns">'+epBtn('途中で答え合わせする','epForce()','alt')+'</div>';
  epPanel('誰が書いたか当てよう',html);return
 }
 if(phase==='ep_reveal'){
  const record=p.last;
  if(!record)return epPanel('回答の集計中','結果を読み込んでいます');
  epPanel('正体が判明！',epProgress(p)+'<div class="ep-callout">🎉 見破ったら＋2点、誰かをだませた投稿者には＋1点。会話しながら答えを見比べよう！</div>'+epResult(record)+
   '<h3>現在のランキング</h3>'+epLeaderboard()+
   (owner?'<div class="btns">'+epBtn(p.round+1===p.roundLimit?'最終結果を見る':'次のお題へ進む','send({type:"ep_next"})','gold')+'</div>':'<div class="ep-done">主催者が次のラウンドへ進めるまで待っています。</div>'));
  return
 }
 if(phase==='final'){
  const records=p.history||[];
  epPanel('全ラウンド終了！',epProgress(p)+'<h3>🏆 最終ランキング</h3>'+epLeaderboard()+
   '<h3>これまでのエピソード</h3>'+records.map(rec=>'<details class="ep-history"><summary>ROUND '+rec.round+'：'+esc(rec.topic)+'</summary>'+epResult(rec,true)+'</details>').join('')+
   (owner?'<div class="btns">'+epBtn('もう一度遊ぶ','send({type:"restart"})','gold')+'</div>':'')+
   '<div class="btns">'+epBtn('タイトルへ戻る','leaveToTitle()','alt')+'</div>');
  return
 }
}

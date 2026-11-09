'use strict';
/* Drawing modes use the existing shared, touch-enabled canvas. */
const ART_EXTRA_GAMES=['artcontest','artforbid','drawbluff'];
let axReports=new Set(),axKey='';
function axArt(){const p=room.drawextra,k=[room.code,room.matchNo,room.game,p.round,p.cursor||0].join(':');if(k!==axKey){axKey=k;axReports=new Set()}room.draw={round:p.round,stage:p.cursor||0}}
function axPanel(title,html){app.innerHTML=panel('ART PARTY / '+GAMES[room.game].title,title,roomBar()+html+'<p id="err" class="error" hidden></p>')}
function axBtn(label,fn,style=''){return action(label,fn,style)}
function axPic(s){return drawPicture(s||[])}
function axScores(){return drawScores()}
function axArtist(pid){return room.players.find(x=>x.id===pid)?.name||'参加者'}
function axEntry(x,i,buttons=''){return '<div class="dp-art"><strong>作品 '+(i+1)+(x.name?' ・ '+esc(x.name):'')+'</strong>'+axPic(x.strokes)+buttons+'</div>'}
function axTitle(){const p=room.drawextra;return '<div class="dp-info"><b>ROUND '+(p.round+1)+' / '+p.roundLimit+'</b><span>'+esc(GAMES[room.game].title)+'</span></div>'}
function axCustom(){const v=document.getElementById('ax-custom')?.value.trim();if(!v)return error('お題を入力してください');send({type:'paint_topic',topic:v})}
function axReport(id,v){if(v)axReports.add(id);else axReports.delete(id)}
function axVote(id){send({type:'paint_vote',target:id,violations:[...axReports]})}
function axPaintResult(){const p=room.drawextra,final=room.phase==='final',host=room.owner===me,rows=final?p.history:[p.last].filter(Boolean);let html=axScores();
 html+=rows.map(r=>'<details class="dp-history" '+(final?'':'open')+'><summary>ROUND '+r.round+'｜'+esc(Array.isArray(r.topic)?r.topic[0]:r.topic)+'｜採用 '+(r.winners.map(axArtist).map(esc).join('、')||'なし')+'</summary>'+(Array.isArray(r.topic)?'<p>NG：'+r.topic.slice(1).map(esc).join('・')+'</p>':'')+'<div class="dp-gallery">'+r.entries.map((x,i)=>axEntry(x,i,'<small>票：'+x.votes+(x.disqualified?'｜NG判定で入賞対象外':'')+'</small>')).join('')+'</div></details>').join('');
 html+='<div class="btns">'+(final?(host?axBtn('もう一度遊ぶ','send({type:"restart"})','gold'):'')+axBtn('タイトルへ戻る','leaveToTitle()','alt'):host?axBtn('次のお題へ','send({type:"paint_next"})','gold'):'')+'</div>';
 axPanel(final?'最終ランキング':'作品の発表',html)}
function axPaint(){const p=room.drawextra,host=room.owner===me,ng=room.game==='artforbid';
 if(room.phase==='final'||room.phase==='px_reveal')return axPaintResult();
 const head=axTitle()+'<div class="dp-target">'+esc(p.topic)+'</div>'+(ng?'<div class="ax-ng"><b>🚫 描いてはいけないもの</b><div>'+p.banned.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></div>':'<div class="dp-note">自由な画力・発想で描こう！ 主催者は描画前にお題を変更できます。</div>');
 if(room.phase==='px_draw'){
  if(p.submitted)return axPanel('提出しました',head+'<div class="dp-note">✅ 提出済み '+p.submittedCount+' / '+p.needed+'人</div>'+(host&&p.submittedCount>=2?axBtn('今ある絵で投票へ','send({type:"paint_force"})','alt'):''));
  let edit=!ng&&host&&!p.submittedCount?'<label class="labeled">お題を自由に変更</label><div class="ax-inline"><input class="field" id="ax-custom" maxlength="75" placeholder="好きなお題"><button class="btn alt" onclick="axCustom()">変更</button></div>':'';
  axPanel('絵を描いて提出しよう',head+edit+drawCanvasHTML()+'<div class="btns">'+axBtn('絵を提出','drawSendPicture("paint_submit")','gold')+'</div>');drawBind();return;
 }
 if(room.phase==='px_vote'){
  const list=p.pictures.map((x,i)=>axEntry(x,i,x.id===me?'<small>自分の絵</small>':(ng?'<label class="ax-flag"><input type="checkbox" onchange="axReport('+JSON.stringify(x.id).replaceAll('"','&quot;')+',this.checked)" '+(axReports.has(x.id)?'checked':'')+'>この絵はNG要素を描いていると思う</label>':'')+(p.myVote?'<small>投票済み</small>':axBtn('この絵に投票','axVote('+JSON.stringify(x.id).replaceAll('"','&quot;')+')','gold')))).join('');
  return axPanel('お気に入りの作品に投票しよう',head+'<div class="dp-note">結果までは作者を伏せて表示します。'+(ng?'気になったNG違反にもチェックしてから投票してください。':'')+'</div><div class="dp-gallery">'+list+'</div><p class="small">投票：'+p.voteCount+' / '+room.active.length+'人</p>'+(host&&p.voteCount?axBtn('今の票で集計','send({type:"paint_force"})','alt'):''));}
}
function axBluffReview(){const p=room.drawextra,final=room.phase==='final',host=room.owner===me,rows=final?p.history:[p.last].filter(Boolean);
 let html=axScores()+rows.map((r,i)=>'<details class="dp-history" '+(!final?'open':'')+'><summary>作品 '+(i+1)+'｜'+esc(r.authorName)+'｜本物：'+esc(r.prompt)+'</summary>'+axPic(r.strokes)+'<h4>みんなが選んだタイトル</h4>'+r.guesses.map(x=>'<p>'+esc(x.name)+' → '+esc(x.choice)+(x.choice===r.prompt?' ✅':'')+'</p>').join('')+'<h4>偽のタイトル</h4>'+r.decoys.map(x=>'<p>'+esc(x.name)+'：'+esc(x.text)+'</p>').join('')+'</details>').join('');
 html+='<div class="btns">'+(final?(host?axBtn('もう一度遊ぶ','send({type:"restart"})','gold'):'')+axBtn('タイトルへ戻る','leaveToTitle()','alt'):host?axBtn('次の絵を見る','send({type:"db_next"})','gold'):'')+'</div>';
 axPanel(final?'最終結果':'正解発表',html)}
function axCaption(){const v=document.getElementById('ax-caption')?.value.trim();if(!v||v.length<2)return error('2文字以上で入力してください');send({type:'db_caption',text:v})}
function axBluff(){const p=room.drawextra,host=room.owner===me,artist=p.author===me;
 if(room.phase==='final'||room.phase==='db_reveal')return axBluffReview();
 if(room.phase==='db_draw'){
  if(p.drawingSubmitted)return axPanel('全員のお絵描きがそろうまで待とう','<div class="dp-note">✅ あなたは提出済み '+p.drawingCount+'/'+p.needed+'人</div>');
  axPanel('あなただけのお題を描こう','<div class="dp-secret">🔒 自分だけに見えるお題：<h3>'+esc(p.myPrompt)+'</h3></div>'+drawCanvasHTML()+'<div class="btns">'+axBtn('絵を提出','drawSendPicture("db_draw")','gold')+'</div>');drawBind();return;
 }
 const head='<div class="dp-info"><b>作品 '+(p.cursor+1)+' / '+p.roundLimit+'</b><span>作者：'+esc(p.authorName||'')+'</span></div><div class="ax-featured">'+axPic(p.drawing)+'</div>';
 if(room.phase==='db_caption'){
  if(artist)return axPanel('友達が偽タイトルを考えています',head+'<p class="dp-secret">元のお題：'+esc(p.myPrompt)+'</p>');
  if(p.myCaption)return axPanel('提出しました',head+'<p class="dp-note">✅ タイトル提出済み '+p.captionsCount+'/'+(room.active.length-1)+'人</p>');
  return axPanel('この絵の偽タイトルを考えよう',head+'<p>正解だと思わせる、まぎらわしいタイトルをつけよう。</p><textarea id="ax-caption" class="field dp-textarea" maxlength="80" placeholder="ありそうな偽タイトル"></textarea><div class="btns">'+axBtn('タイトルを提出','axCaption()','gold')+'</div>'+(host&&p.captionsCount?axBtn('今の回答で投票へ','send({type:"db_force"})','alt'):''));}
 if(room.phase==='db_vote'){
  let opts=p.options.map((x,i)=>'<button type="button" class="ax-choice" '+(artist||p.myVote||x.mine?'disabled':'')+' onclick="send({type:\'db_vote\',key:'+JSON.stringify(x.key).replaceAll('"','&quot;')+'})"><b>候補 '+(i+1)+'</b><span>'+esc(x.text)+'</span>'+(x.mine?'<small>自分の偽タイトル</small>':'')+'</button>').join('');
  return axPanel('本物のタイトルを見抜こう',head+(artist?'<div class="dp-secret">🔒 元のお題：'+esc(p.myPrompt)+'</div>':'<p class="dp-note">本物のタイトルが1つだけ混ざっています。自分の偽タイトルには投票できません。</p>')+'<div class="ax-choices">'+opts+'</div>'+(p.myVote?'<p class="dp-note">✅ 投票済み</p>':'')+(host&&p.votesCount?axBtn('今の票で答え合わせ','send({type:"db_force"})','alt'):''));}
}
function renderArtExtra(){if(!room||!ART_EXTRA_GAMES.includes(room.game))return;axArt();if(room.game==='drawbluff')return axBluff();axPaint()}

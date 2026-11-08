/* Three additional realtime party games, with original wording and examples. */
'use strict';
PARTY_GAMES.push('unanimous','insider','secret_rank');
let exUnText='',exInText='',exOrder={key:'',items:[0,1,2,3,4]};
const exOriginalParty=renderParty;
renderParty=function(){
 if(room&&['unanimous','insider','secret_rank'].includes(room.game))return exRender();
 return exOriginalParty();
};
function exScores(){
 return '<div class="party-standings">'+[...room.players].sort((a,b)=>b.score-a.score).map(p=>
   '<div class="party-score"><strong>'+esc(p.name)+'</strong><b>'+p.score+' pt</b></div>').join('')+'</div>';
}
function exHeader(p){return partyStatusBar(p)+exScores()}
function exRender(){
 if(room.phase==='final')return exFinal();
 if(room.game==='unanimous')return exUn();
 if(room.game==='insider')return exIn();
 return exSR();
}
function exFinal(){
 const p=room.party,owner=room.owner===me;let list='';
 if(room.game==='unanimous')list=p.history.map(x=>'<details class="party-detail"><summary>'+x.round+'問目 '+(x.success?'✅ 成功':'❌ 不一致')+'：'+esc(x.theme)+'</summary>'+x.rows.map(y=>'<p><b>'+esc(y.name)+'</b>：'+esc(y.text)+'</p>').join('')+'</details>').join('');
 if(room.game==='insider')list=p.history.map(x=>'<details class="party-detail"><summary>'+x.round+'回目：'+esc(x.word)+'（'+(x.caught?'発見':'逃げ切り')+'）</summary><p>内通者：'+esc(x.insiderName)+' ／ 親：'+esc(x.masterName)+'</p>'+x.votes.map(y=>'<p>'+esc(y.name)+' → '+esc(y.target)+'</p>').join('')+'</details>').join('');
 if(room.game==='secret_rank')list=p.history.map(x=>'<details class="party-detail"><summary>'+x.round+'回目：'+esc(x.title)+'</summary><p>主役：'+esc(x.targetName)+' ／ 秘密の基準：<b>'+esc(x.criteria[x.criterion])+'</b></p><p>'+x.order.map(i=>esc(x.items[i])).join(' → ')+'</p>'+x.guesses.map(y=>'<p>'+esc(y.name)+'：'+esc(x.criteria[y.choice])+(y.correct?' ✅':' ❌')+'</p>').join('')+'</details>').join('');
 const next='<div class="btns">'+(owner?pAction('もう一度遊ぶ','send({type:"restart"})','gold'):'')+pAction('タイトルへ','leaveToTitle()','alt')+'</div>';
 partyTitle('RESULT / ゲーム終了',room.endedEarly?'ここまでの結果':'みんなの結果',exScores()+'<div class="party-stack">'+list+'</div>'+next);
}
function exUn(){
 const p=room.party,owner=room.owner===me;
 const head=exHeader(p)+'<div class="extra-theme"><small>お題 '+(p.round+1)+' / '+p.roundLimit+'</small><strong>'+esc(p.theme)+'</strong></div><p class="extra-progress">全員一致 '+p.successes+' / '+p.goal+' 回</p>';
 if(room.phase==='un_answer'){
  let body=p.submitted?'<div class="info">✅ 回答済みです。'+p.count+' / '+room.active.length+' 人の回答を待っています。</div>':
    '<label class="labeled" for="ex-un">答えを1つ入力</label><input class="field" id="ex-un" maxlength="60" value="'+esc(exUnText)+'" placeholder="例：おにぎり" oninput="exUnText=this.value"><div class="btns">'+pAction('この答えを提出','exSendUn()','gold')+'</div><p class="small">相談せずに、自分で答えを決めてください。</p>';
  if(owner)body+='<div class="btns">'+(p.count===0?pAction('別のお題へ','send({type:"un_redraw"})','alt'):'')+(p.count>=2?pAction('今の回答で集計','send({type:"un_force"})','alt'):'')+'</div>';
  return partyTitle('CO-OP / 全員一致','みんなと同じ答えを出そう！',head+body);
 }
 const res=p.last,rows='<div class="extra-grid">'+res.rows.map(x=>'<div class="extra-cell"><small>'+esc(x.name)+'</small><b>'+esc(x.text)+'</b></div>').join('')+'</div>';
 return partyTitle('REVEAL / 回答公開',res.success?'🎉 全員一致！':'惜しい！ 今回は不一致',head+rows+'<div class="btns">'+(owner?pAction(p.successes>=p.goal||p.round+1>=p.roundLimit?'最終結果へ':'次のお題へ','send({type:"un_next"})','gold'):'')+'</div>');
}
function exSendUn(){
 const v=(document.getElementById('ex-un')?.value||exUnText).trim();if(!v)return error('答えを入力してください');exUnText='';send({type:'un_answer',text:v});
}
function exIn(){
 const p=room.party,isOwner=room.owner===me,isMaster=p.role==='master';
 const roles={master:'🧑‍⚖️ 親：正解を知り、質問に答えます',insider:'🕵️ 内通者：正解を知っていることを隠します',citizen:'🔍 市民：質問で正解を見つけます'};
 const head=exHeader(p)+'<div class="extra-theme"><small>ジャンル：'+esc(p.category)+'</small><strong>'+roles[p.role]+'</strong>'+(p.secretWord?'<p class="extra-secret">秘密の正解：<b>'+esc(p.secretWord)+'</b></p>':'')+'</div><p class="small">親：'+esc(pName(p.master))+'さん。質問には「はい／いいえ／関係ない」で答えます。</p>';
 if(room.phase==='in_ask'){
  let controls=isMaster?'<p class="info">親は質問への回答を選んでください。正解を口に出さないようにしましょう。</p>':
    '<label class="labeled">質問か推理を入力</label><textarea id="ex-in" class="field" rows="2" maxlength="120" oninput="exInText=this.value">'+esc(exInText)+'</textarea><div class="btns">'+pAction('質問する','exAsk(false)')+pAction('正解を答える','exAsk(true)','alt')+'</div>';
  let log='<div class="extra-log">'+p.entries.map(x=>'<div class="extra-entry"><b>'+esc(x.name)+'：</b>'+esc(x.text)+'<div>'+
      (x.kind==='ask'?(x.reply?'<strong class="extra-reply">'+({yes:'はい',no:'いいえ',neutral:'関係ない'}[x.reply])+'</strong>':isMaster?'<div class="btns">'+[['yes','はい'],['no','いいえ'],['neutral','関係ない']].map(v=>pAction(v[1],'exReply('+x.id+',"'+v[0]+'")','alt')).join('')+'</div>':'回答待ち'):(x.reply==='correct'?'✅ 正解！':'❌ 不正解'))+'</div></div>').join('')+'</div>';
  if(isOwner)controls+='<div class="btns">'+pAction('内通者の投票へ進む','send({type:"in_skip"})','alt')+'</div>';
  return partyTitle('MYSTERY / 質問タイム','内通者が混ざっている！',head+controls+'<h3>質問の履歴</h3>'+log);
 }
 if(room.phase==='in_vote'){
  let body='<p class="info">'+(p.solved?'正解が見つかりました。':'親が投票へ進めました。')+' 内通者だと思う人を1人選びます。親は投票しません。</p>';
  if(!isMaster&&!p.myVote)body+='<div class="extra-grid">'+room.players.filter(x=>x.id!==me&&x.id!==p.master).map(x=>
     '<button class="extra-choice" onclick="exVote(\''+x.id+'\')">'+esc(x.name)+'に投票</button>').join('')+'</div>';
  else body+='<div class="info">投票待ち：'+p.votesCount+' / '+(room.active.length-1)+' 件</div>';
  if(isOwner&&p.votesCount)body+='<div class="btns">'+pAction('現在の投票で集計','send({type:"in_force"})','alt')+'</div>';
  return partyTitle('VOTE / 正体を推理','誰が内通者？',head+body);
 }
 const last=p.last;
 return partyTitle('REVEAL / 正体公開',last.caught?'🎉 内通者を発見！':'🕵️ 内通者が逃げ切った！',head+'<div class="extra-theme"><strong>正解：'+esc(last.word)+'</strong><p>内通者：'+esc(last.insiderName)+'さん ／ 親：'+esc(last.masterName)+'さん</p></div><div class="extra-grid">'+last.votes.map(x=>'<div class="extra-cell"><small>'+esc(x.name)+'</small><b>→ '+esc(x.target)+'</b></div>').join('')+'</div><div class="btns">'+(isOwner?pAction(p.round+1>=p.roundLimit?'最終結果へ':'次のラウンドへ','send({type:"in_next"})','gold'):'')+'</div>');
}
function exAsk(isGuess){
 const val=(document.getElementById('ex-in')?.value||exInText).trim();if(val.length<2)return error('2文字以上入力してください');
 exInText='';send({type:isGuess?'in_guess':'in_question',text:val});
}
function exReply(i,v){send({type:'in_answer',id:i,reply:v})}
function exVote(id){if(confirm('この人を内通者として投票しますか？'))send({type:'in_vote',target:id})}
function exRankState(){
 const key=room.code+':'+room.matchNo+':'+room.party.round;
 if(exOrder.key!==key)exOrder={key,items:[0,1,2,3,4]};
 return exOrder.items;
}
function exMove(i,n){const a=exRankState(),j=i+n;if(j<0||j>=5)return;[a[i],a[j]]=[a[j],a[i]];render()}
function exSubmitRank(){send({type:'sr_order',order:exRankState()})}
function exGuessRank(i){send({type:'sr_guess',choice:i})}
function exSR(){
 const p=room.party,isOwner=room.owner===me,isTarget=p.target===me;
 const head=exHeader(p)+'<div class="extra-theme"><small>ジャンル：'+esc(p.title)+'</small><strong>主役：'+esc(pName(p.target))+'さん</strong></div>';
 if(room.phase==='sr_order'){
  let body=isTarget?'<div class="extra-secret">🔒 あなただけの基準：<b>'+esc(p.criteria[p.secretCriterion])+'</b></div><p class="small">この基準に合うように5つの項目を並べます。</p>'+exRankRows(p.items,exRankState(),true)+'<div class="btns">'+pAction('この並びで公開','exSubmitRank()','gold')+'</div>':
    '<div class="info">主役が秘密の基準に従って並び替えています。少しだけお待ちください。</div>';
  return partyTitle('SECRET / 順位作成','主役の秘密の基準',head+body);
 }
 let body=exRankRows(p.items,p.order,false);
 if(room.phase==='sr_guess'){
  if(isTarget)body+='<p class="info">主役は予想に参加せず、みんなの結果を待ちます。</p>';
  else if(p.myGuess!==null&&p.myGuess!==undefined)body+='<p class="info">✅ 予想済みです。</p>';
  else body+='<h3>何を基準に並べたでしょう？</h3><div class="extra-grid">'+p.criteria.map((x,i)=>
    '<button class="extra-choice" onclick="exGuessRank('+i+')">'+esc(x)+'</button>').join('')+'</div>';
  if(isOwner&&p.guessCount)body+='<div class="btns">'+pAction('現在の回答で採点','send({type:"sr_force"})','alt')+'</div>';
  return partyTitle('GUESS / 予想','この順位の秘密を当てよう',head+body);
 }
 const last=p.last;
 body+='<div class="extra-theme"><strong>答え：'+esc(last.criteria[last.criterion])+'</strong></div><div class="extra-grid">'+last.guesses.map(x=>
   '<div class="extra-cell"><small>'+esc(x.name)+(x.correct?' ✅':' ❌')+'</small><b>'+esc(last.criteria[x.choice])+'</b></div>').join('')+'</div><div class="btns">'+(isOwner?pAction(p.round+1>=p.roundLimit?'最終結果へ':'次の主役へ','send({type:"sr_next"})','gold'):'')+'</div>';
 return partyTitle('REVEAL / 基準公開','秘密の評価基準は？',head+body);
}
function exRankRows(items,order,editable){
 return '<div class="extra-ranking">'+order.map((ix,i)=>'<div class="extra-rank"><b>'+('SABCD'[i])+'</b><span>'+esc(items[ix])+'</span>'+
  (editable?'<button '+(i===0?'disabled':'')+' onclick="exMove('+i+',-1)">↑</button><button '+(i===4?'disabled':'')+' onclick="exMove('+i+',1)">↓</button>':'')+'</div>').join('')+'</div>';
}
Object.assign(HOWTO,{
 unanimous:{title:'全員一致ゲーム',icon:'🤝',tagline:'同じ答えを目指す協力ゲーム',slides:[
  {title:'みんなに同じお題',body:'全員の画面に共通のお題が出ます。相談せずに答えを1つ考えます。',tip:'出題は50個以上のオリジナルお題から選ばれます。',picture:{type:'questions',labels:['朝ごはんの定番は？','お祭りの屋台といえば？'],tag:'同じお題'}},
  {title:'回答を一斉公開',body:'回答がそろったら一斉に見せます。同じ答えが全員分あれば成功です。',tip:'誤字や違う言葉は不一致。',picture:{type:'matrix',tag:'みんなの答えを比較'}},
  {title:'5回一致を目指す',body:'8ラウンド以内に5回成功を目指す協力戦です。',tip:'途中でも主催者が進行できます。',picture:{type:'two',a:'一致なら成功',b:'違えばもう一度',tag:'協力して挑戦'}}
 ]},
 insider:{title:'インサイダーゲーム',icon:'🕵️',tagline:'答えを知っている人は誰？',slides:[
  {title:'親・内通者・市民',body:'親は正解を知り質問に答えます。内通者も正解を知っていますが隠します。市民は正解を知らず推理します。',tip:'4人以上で遊びます。',picture:{type:'choices',labels:['親','内通者','市民'],selected:1,tag:'秘密の役割'}},
  {title:'質問して答えを探す',body:'市民と内通者が質問し、親は「はい・いいえ・関係ない」で返答します。',tip:'内通者は怪しまれないように誘導しましょう。',picture:{type:'questions',labels:['食べ物ですか？','冷たいですか？'],tag:'質問の履歴'}},
  {title:'内通者に投票',body:'正解が出るか、主催者が進めたら内通者だと思う人に投票します。',tip:'内通者の逃げ切りにも得点があります。',picture:{type:'matrix',tag:'投票の答え合わせ'}}
 ]},
 secret_rank:{title:'シークレットランキング',icon:'🔐',tagline:'順位の理由を当てる',slides:[
  {title:'主役だけ秘密の基準を知る',body:'主役にだけ、4つの候補から秘密の評価基準が配られます。',tip:'他の人にはまだ答えが見えません。',picture:{type:'two',a:'主役：秘密の基準',b:'みんな：基準を推理',tag:'秘密の基準'}},
  {title:'5項目を並び替える',body:'主役はその基準に沿うようにS〜Dまで項目を並べます。',tip:'主役の価値観で自由に選びます。',picture:{type:'tiers',labels:['ゲーム','旅行','映画','買い物','カフェ'],tag:'完成した順位'}},
  {title:'並びの理由を予想',body:'完成した並びから、何を基準にしたのかを4択で当てます。',tip:'正解なら3点。',picture:{type:'choices',labels:['雨の日にしたい順','高そうな順','疲れる順','友達としたい順'],selected:0,tag:'選択肢から選ぶ'}}
 ]}
});
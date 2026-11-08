'use strict';
// Additional original party modes. The site intentionally uses its own decks and scenarios.
const PARTY_GAMES=['ito','propose','soup'];
let partyDraft={key:'',tokens:[]};
let partyItoText='';
let partySoupText='';
const pName=id=>room.players.find(x=>x.id===id)?.name||'プレイヤー';
const pAction=(t,fn,style='')=>action(t,fn,style);
const pError='<p id="err" class="error" hidden></p>';
const pct=(num)=>Math.min(100,Math.max(0,num));
function partyStatusBar(p){return `<div class="party-status"><span>${esc(GAMES[room.game].icon)} ${esc(GAMES[room.game].title)}</span><span>${esc(p.stage?'STAGE '+p.stage+' / '+p.maxStages:'ROUND '+(p.round+1)+' / '+p.roundLimit)}</span></div>`}
function partyTitle(sub,title,inner){app.innerHTML=panel(sub,title,roomBar()+inner+pError)}
function partyPlayerList(){return `<div class="playergrid">${players()}</div>`}
function partyFinal(){const p=room.party, owner=room.owner===me, game=room.game;let html='';
 if(game==='ito'){
  const completed=p.rounds.filter(x=>x.success).length;html=`<div class="party-hero">${completed===p.maxStages?'🎉 みんなで脱出成功！':'✨ ここまでの結果'}<small>${completed} / ${p.maxStages}ステージ成功｜ライフ ${p.lives}</small></div><div class="party-stack">${p.rounds.map(r=>`<details class="party-detail"><summary>STAGE ${r.stage}：${esc(r.theme)}｜ライフ ${r.lives}</summary><p class="small">公開したカード：${r.played.map(x=>`${esc(x.name)} ${x.number}`).join(' → ')||'なし'}</p><p class="small">失ったカード：${r.discarded.map(x=>`${esc(x.name)} ${x.number}`).join('、')||'なし'}</p></details>`).join('')}</div>`;
 }else if(game==='propose'){
  const winners=Object.entries(p.rings).sort((a,b)=>b[1]-a[1]);html=`<h3>💍 指輪獲得数</h3><div class="party-standings">${winners.map(([id,num],i)=>`<div class="party-score"><strong>${i===0?'🥇 ':''}${esc(pName(id))}</strong><b>${num} / 3 💍</b></div>`).join('')}</div><h3>これまでのプロポーズ</h3><div class="party-stack">${p.history.map(r=>`<details class="party-detail"><summary>${r.round}回目｜審査：${esc(pName(r.judge))}｜💍 ${esc(r.winnerName)}</summary>${r.entries.map(x=>`<p><b>${esc(x.name)}：</b>${esc(x.text)}</p>`).join('')}</details>`).join('')}</div>`;
 }else{
  html=`<div class="party-hero">🔎 ${p.solvedCount} / ${p.history.length}問の真相を解明<small>出題者を交代しながら協力しました</small></div><div class="party-standings">${[...room.players].sort((a,b)=>b.score-a.score).map(x=>`<div class="party-score"><strong>${esc(x.name)}</strong><b>${x.score} pt</b></div>`).join('')}</div><h3>解いた問題を振り返る</h3>${p.history.map(r=>`<details class="party-detail"><summary>${r.round}問目　${esc(r.title)}</summary><p>${esc(r.situation)}</p><div class="party-truth">${esc(r.solution)}</div></details>`).join('')}`;
 }
 html+=`<div class="btns">${owner?pAction('同じメンバーでもう一度','send({type:"restart"})','gold'):''}${pAction('タイトルに戻る','leaveToTitle()','alt')}</div>`;
 partyTitle('RESULT / ゲーム終了',room.endedEarly?'途中終了・ここまでの結果':'みんなの結果',html);
}
function renderParty(){if(!room || !PARTY_GAMES.includes(room.game))return;
 if(room.phase==='final')return partyFinal();
 if(room.game==='ito')return renderIto();
 if(room.game==='propose')return renderProposal();
 if(room.game==='soup')return renderSoup();
}
function renderIto(){const p=room.party,owner=room.owner===me,stage=p.stage,remaining=p.remaining.includes(me);
 const top=partyStatusBar(p)+`<div class="party-hero">🕸️ ${esc(p.theme)}<small>数字を直接言わず、テーマに沿う言葉で伝え合おう</small></div><div class="party-lives">${'❤️'.repeat(p.lives)}${'🤍'.repeat(3-p.lives)} <span>共有ライフ：${p.lives} / 3</span></div>`;
 const secret=p.myNumber===null?'':`<div class="party-number"><small>あなたの秘密の数字</small><strong>${p.myNumber}</strong><span>他の人には見えません</span></div>`;
 if(room.phase==='ito_clue'){
  const mine=p.clueSubmitted; const hintbox=mine?`<div class="info">✅ 例えを提出しました。全員が提出するまで待ちましょう。</div>`:
  `${secret}<label class="labeled" for="clue-input">この数字をどんな言葉で表す？</label><textarea id="clue-input" class="field" rows="3" maxlength="100" placeholder="例：食べ物の人気度なら『みんなで焼肉に行く楽しさ』" oninput="partyItoText=this.value">${esc(partyItoText)}</textarea><div class="btns">${pAction('この例えを全員に送る','submitItoClue()')}</div>`;
  partyTitle(`CO-OP / ヒントの提出 STAGE ${stage}`,'数字を言わずに伝えよう',top+hintbox+`<p class="small">公開済み：${p.clues.length} / ${room.active.length}人</p><div class="party-clues">${p.clues.map(x=>`<div class="party-clue"><b>${esc(x.name)}</b><span>${esc(x.text)}</span></div>`).join('')}</div>${owner&&!p.clues.length?pAction('お題をランダムで変更','send({type:"ito_redraw"})','alt'):''}`);
 }else if(room.phase==='ito_play'){
  const clues=`<div class="party-clues">${p.clues.map(x=>`<div class="party-clue ${!p.remaining.includes(x.pid)?'completed':''}"><b>${esc(x.name)}</b><span>${esc(x.text)}</span></div>`).join('')}</div>`;
  const nums=`<div class="playedline">${p.played.map(x=>`<span>${esc(x.name)} <b>${x.number}</b>${x.mistakes?' ⚠️':''}</span>`).join('')||'<span>まだ誰も出していません</span>'}</div>`;
  const discarded=p.discarded.length?`<p class="small">⚠️ 飛び越えて失ったカード：${p.discarded.map(x=>`${esc(x.name)} ${x.number}`).join('、')}</p>`:'';
  const btn=remaining?`${secret}<div class="btns">${pAction('自分のカードを出す','playItoCard()')}</div>`:`<div class="info">あなたのカードは出し終わりました。残り ${p.remaining.length}枚です。</div>`;
  partyTitle('CO-OP / 小さい順に出そう','相談してカードを出す',top+`<h3>みんなの例え</h3>${clues}<h3>公開された数字</h3>${nums}${discarded}${btn}<p class="small">誰でも好きなタイミングでカードを出せます。より小さいカードが残っていると、その枚数だけライフが減ります。通話で相談しましょう。</p>`);
 }else if(room.phase==='ito_review'){
  const summary=p.rounds.at(-1); const out=`<div class="party-hero">${summary.success?'✨ ステージ終了':'💔 ライフが0になりました'}<small>出した順番と数字を公開します</small></div><div class="playedline">${summary.played.map(x=>`<span>${esc(x.name)} <b>${x.number}</b>${x.mistakes?' ⚠️':''}</span>`).join('')}</div>${summary.discarded.length?`<p>失われたカード：${summary.discarded.map(x=>`${esc(x.name)} ${x.number}`).join(' / ')}</p>`:''}<div class="btns">${owner?pAction(p.lives===0||stage===p.maxStages?'結果を見る':'次のステージへ','send({type:"ito_next"})','gold'):'主催者が次へ進めます'}</div>`;
  partyTitle('REVEAL / 答え合わせ','数字の順番を確認',top+out);
 }
}
function submitItoClue(){const v=(document.getElementById('clue-input')?.value||partyItoText).trim();if(!v)return error('例えを入力してください');send({type:'ito_clue',text:v});}
function playItoCard(){if(confirm('カードを出しますか？ 小さい数字がまだあるとライフが減ります。'))send({type:'ito_play'})}
function proposalKey(){return `${room.code}:${room.matchNo}:${room.party.round}`}
function proposalDraft(){const key=proposalKey();if(partyDraft.key!==key)partyDraft={key,tokens:[]};return partyDraft;}
function proposalChip(i,text,arr){const used=arr.includes(i);return `<button type="button" class="party-chip ${used?'chosen':''}" ${used?'disabled':''} onclick="proposalAdd(${i})">${esc(text)}</button>`}
function renderProposal(){const p=room.party,owner=room.owner===me,judge=p.judge,isJudge=judge===me;
 const top=partyStatusBar(p)+`<div class="party-hero">💌 今回の審査役：${esc(pName(judge))}<small>言葉を組み合わせて、審査役に響くプロポーズを作ろう</small></div><div class="party-standings">${room.players.map(x=>`<div class="party-score"><strong>${esc(x.name)}</strong><b>💍 ${p.rings[x.id]||0}/3</b></div>`).join('')}</div>`;
 if(room.phase==='prop_compose'){
  if(isJudge){return partyTitle('LOVE / 作成中','みんなの告白を待とう',top+`<div class="info">今回はあなたが審査役！ 全員の発表から一番好きな言葉を選びます。</div><p class="small">提出済み：${p.submittedCount} / ${room.active.length-1}</p><div class="btns">${p.submittedCount?pAction('集まった告白を発表する','send({type:"prop_show"})','gold'):''}</div>`)}
  if(p.submitted)return partyTitle('LOVE / 提出済み','審査を待とう',top+`<div class="info">✅ 告白を送信しました。ほかの人が提出するまで待ちましょう。</div><p class="small">${p.submittedCount} / ${room.active.length-1}人が提出済み</p>`);
  const d=proposalDraft(),hand=[...p.starters,...p.hand],preview=d.tokens.map(i=>hand[i]).join(' ');
  return partyTitle('LOVE / 言葉を並べる','オリジナルの告白を作ろう',top+`<div class="proposal-composition"><small>あなたのプロポーズ</small><p>${esc(preview||'カードをタップして、好きな順番に並べてください')}</p><small>最後は「結婚しよう！」と読み上げよう</small></div><h3>何度でも使える6枚</h3><div class="party-chips">${p.starters.map((x,i)=>proposalChip(i,x,d.tokens)).join('')}</div><h3>今回だけのランダム6枚</h3><div class="party-chips">${p.hand.map((x,i)=>proposalChip(i+6,x,d.tokens)).join('')}</div><div class="btns">${pAction('1枚戻す','proposalUndo()','alt')}${pAction('最初から','proposalReset()','alt')}${pAction('この告白を提出する','proposalSubmit()','gold')}</div><p class="small">カードはすべて使う必要はありません。通話中なら、送信後に声に出して読んでみましょう。公式に近い10秒チャレンジは、仲間とカウントして遊べます。</p>`);
 }
 const entries=`<div class="proposal-entries">${p.entries.map(x=>`<article class="proposal-entry"><b>${esc(x.name)}さん</b><p>${esc(x.text)} 結婚しよう！</p>${room.phase==='prop_judge'&&isJudge?pAction('💍 この人に指輪を贈る',`proposalPick('${x.pid}')`,'gold'):''}</article>`).join('')}</div>`;
 if(room.phase==='prop_judge')return partyTitle('LOVE / 審査タイム','いちばん心に響いた言葉は？',top+`${entries}${!isJudge?'<div class="info">審査役が1人を選ぶまでお待ちください。</div>':''}`);
 if(room.phase==='prop_reveal')return partyTitle('LOVE / 結果発表','💍 指輪をもらったのは…',top+`<div class="party-hero">${esc(p.last.winnerName)}さん！<small>今回の審査役：${esc(pName(p.last.judge))}</small></div>${entries}<div class="btns">${owner?pAction(Math.max(...Object.values(p.rings))>=3||p.round+1>=p.roundLimit?'最終結果へ':'次の審査役へ','send({type:"prop_next"})','gold'):''}</div>`);
}
function proposalAdd(i){let d=proposalDraft();if(!d.tokens.includes(i)){d.tokens.push(i);render()}}
function proposalUndo(){proposalDraft().tokens.pop();render()}
function proposalReset(){proposalDraft().tokens=[];render()}
function proposalSubmit(){const d=proposalDraft();if(!d.tokens.length)return error('1枚以上のカードを使って文章を作ってください');send({type:'prop_submit',indexes:d.tokens})}
function proposalPick(pid){if(confirm(`${pName(pid)}さんの告白を選びますか？`))send({type:'prop_pick',winner:pid})}
function renderSoup(){const p=room.party,owner=room.owner===me,narrator=p.narrator,isNarrator=narrator===me;
 const top=partyStatusBar(p)+`<div class="party-hero">🔎 ${esc(p.title)}<small>${esc(p.situation)}</small></div><div class="party-meta"><span>難易度 ${'★'.repeat(p.difficulty)}</span><span>今回の出題者：${esc(pName(narrator))}</span></div>`;
 const log=p.entries.map(x=>{const badge=x.kind==='ask'?'<span class="tiny-pill">質問</span>':'<span class="tiny-pill warn">推理を発表</span>';
 const reply=x.kind==='ask'?(x.verdict?`<span class="verdict ${x.verdict}">${{yes:'はい',no:'いいえ',irrelevant:'関係ありません'}[x.verdict]}</span>`:(isNarrator&&room.phase==='soup_ask'?`<div class="reply-buttons">${[['yes','はい'],['no','いいえ'],['irrelevant','関係ない']].map(([v,t])=>pAction(t,`soupReply(${x.id},'${v}')`,'alt')).join('')}</div>`:'<small>回答待ち</small>')):
 (isNarrator&&room.phase==='soup_ask'?pAction('✅ この推理を正解とする',`soupResolve(${x.id})`,'gold'):'<small>出題者が判定します</small>');
 return `<div class="soup-entry"><div><b>${esc(x.name)}</b> ${badge}</div><p>${esc(x.text)}</p><div>${reply}</div></div>`}).join('');
 if(room.phase==='soup_ask'){
  const secret=isNarrator?`<div class="soup-secret"><b>🔒 出題者だけに見える真相</b><p>${esc(p.solution)}</p>${p.secretHints.map((x,i)=>`<small>ヒント${i+1}：${esc(x)}</small>`).join('')}</div>`:'';
  const hint=p.hints.length?`<div class="info">${p.hints.map((x,i)=>`💡 ヒント${i+1}：${esc(x)}`).join('<br>')}</div>`:'';
  const ask=isNarrator?`${secret}<div class="btns">${p.hints.length<2?pAction('💡 みんなに次のヒントを出す','send({type:"soup_hint"})','alt'):''}${pAction('真相を公開して終了','soupResolve(null)')}</div><p class="small">回答したい質問の「はい／いいえ／関係ない」を押してください。最後に正解の推理を選ぶか、答えを公開できます。</p>`:
  `<label class="labeled" for="soup-text">はい／いいえで答えられる質問をしよう</label><textarea id="soup-text" class="field" rows="3" maxlength="180" oninput="partySoupText=this.value" placeholder="例：登場人物は一人ですか？">${esc(partySoupText)}</textarea><div class="btns">${pAction('質問する','submitSoup("soup_ask")')}${pAction('真相を推理して発表','submitSoup("soup_solve")','gold')}</div>`;
  partyTitle('MYSTERY / 質問で解き明かす','不思議な状況の真相は？',top+hint+ask+`<h3>みんなの質問と回答 <span class="small">${p.entries.length}件</span></h3><div class="soup-log">${log||'<div class="info">まだ質問がありません。気になることを質問してみよう！</div>'}</div>`);
 }else if(room.phase==='soup_reveal'){
  const winner=p.last.winner?`${esc(pName(p.last.winner))}さんが解明！`:'真相を公開しました';
  partyTitle('MYSTERY / 真相公開',winner,top+`<div class="soup-solution"><b>答え</b><p>${esc(p.solution)}</p></div><details class="party-detail"><summary>これまでの質問を振り返る（${p.entries.length}件）</summary><div class="soup-log">${log}</div></details><div class="btns">${owner?pAction(p.round+1>=p.roundLimit?'最終結果へ':'次の問題へ','send({type:"soup_next"})','gold'):''}</div>`);
 }
}
function submitSoup(type){const v=(document.getElementById('soup-text')?.value||partySoupText).trim();if(v.length<2)return error('質問を入力してください');partySoupText='';send({type,text:v})}
function soupReply(id,verdict){send({type:'soup_reply',id,verdict})}
function soupResolve(index){if(confirm(index===null?'正解を公開して、この問題を終了しますか？':'この推理を正解として、問題を終了しますか？'))send({type:'soup_resolve',winner:index})}
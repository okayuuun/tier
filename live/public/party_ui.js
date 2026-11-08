'use strict';
// Additional original party modes. The site intentionally uses its own decks and scenarios.
const PARTY_GAMES=['ito','akaito','propose','soup','unique','wolf'];
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
 if(game==='wolf'){
  html=`<div class="party-hero">🐺 ワードウルフ最終結果<small>5ラウンドの合計</small></div><div class="party-standings">${[...room.players].sort((a,b)=>b.score-a.score).map(x=>`<div class="party-score"><strong>${esc(x.name)}</strong><b>${x.score}pt</b></div>`).join('')}</div>${p.history.map(r=>`<details class="party-detail"><summary>${r.round}回目 ${r.caught?'少数派を発見':'少数派の逃げ切り'}</summary><p>多数派：${esc(r.majority)} / 少数派：${esc(r.minority)} (${esc(r.wolfName)}さん)</p></details>`).join('')}`;
 }else if(game==='ito'){
  const completed=p.rounds.filter(x=>x.success).length;html=`<div class="party-hero">${completed===p.maxStages?'🎉 みんなで脱出成功！':'✨ ここまでの結果'}<small>${completed} / ${p.maxStages}ステージ成功｜ライフ ${p.lives}</small></div><div class="party-stack">${p.rounds.map(r=>`<details class="party-detail"><summary>STAGE ${r.stage}：${esc(r.theme)}｜ライフ ${r.lives}</summary><p class="small">公開したカード：${r.played.map(x=>`${esc(x.name)} ${x.number}`).join(' → ')||'なし'}</p><p class="small">失ったカード：${r.discarded.map(x=>`${esc(x.name)} ${x.number}`).join('、')||'なし'}</p></details>`).join('')}</div>`;
 }else if(game==='akaito'){
  html=`<div class="party-hero">❤️ アカイイト最終結果<small>4ラウンドの総合得点</small></div><div class="party-standings">${[...room.players].sort((a,b)=>b.score-a.score).map((x,i)=>`<div class="party-score"><strong>${i+1}位 ${esc(x.name)}</strong><b>${x.score}pt</b></div>`).join('')}</div>${p.history.map(r=>`<details class="party-detail"><summary>${r.round}回目：${esc(r.theme)}</summary>${r.pairs.map(x=>`<p>${esc(x.leftName)} (${x.a}) ＋ ${esc(x.rightName)} (${x.b}) ＝ <b>${x.total}</b> / ${x.points}点</p>`).join('')||'<p>ペアなし</p>'}</details>`).join('')}`;
 }else if(game==='unique'){
  html=`<div class="party-hero">✨ 全員不一致チャレンジ<small>最終連続成功 ${p.streak} 回</small></div>${p.history.map(r=>`<details class="party-detail"><summary>${r.round}問目：${r.success?'✅ 成功':'❌ 失敗'}｜${esc(r.theme)}</summary>${r.answers.map(a=>`<p>${esc(a.name)}：${esc(a.text)}${a.duplicate?'（かぶり）':''}</p>`).join('')}</details>`).join('')}`;
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
 if(room.game==='akaito')return renderRedIto();
 if(room.game==='unique')return renderUnique();
 if(room.game==='wolf')return renderWolf();
 if(room.game==='propose')return renderProposal();
 if(room.game==='soup')return renderSoup();
}

let redClueDraft='',uniqueAnswerDraft='';
function renderRedIto(){
 const p=room.party,owner=room.owner===me,remain=p.remaining||[],pending=p.pending;
 const top=partyStatusBar(p)+`<div class="party-hero">❤️ ${esc(p.theme)}<small>2人の数字を合わせて100を目指そう。言葉で大きさを伝え、ウソもあり！</small></div>`;
 const secret=p.myNumber===undefined?'':`<div class="party-number"><small>あなたの秘密の数字</small><strong>${p.myNumber}</strong><span>ほかの人には内緒</span></div>`;
 const clues=()=>`<div class="party-clues">${(p.clues||[]).map(x=>`<div class="party-clue"><b>${esc(x.name)}</b><span>${esc(x.text)}</span></div>`).join('')}</div>`;
 if(room.phase==='red_clue'){
  const content=p.clueSubmitted?`<div class="info">✅ あなたの例えを送信しました。他の人を待っています。</div>`:
  secret+`<label class="labeled">この数字を言葉で例える</label><textarea id="red-hint" class="field" rows="2" maxlength="100" oninput="redClueDraft=this.value" placeholder="例：嬉しいプレゼントなら『ちょっと高いケーキ』">${esc(redClueDraft)}</textarea><div class="btns">${pAction('この例えを公開する','submitRedClue()')}</div>`;
  return partyTitle('RED ITO / 例えの準備','数字は口にせず、言葉で伝える',top+content+`<p class="small">${p.clues.length} / ${room.active.length}人の例えが提出済み</p>${clues()}${owner&&!p.clues.length?pAction('🎲 お題を変える','send({type:"red_redraw"})','alt'):''}`);
 }
 if(room.phase==='red_pair'){
  let offer='';
  if(pending){if(pending.to===me){offer=`<div class="proposal-entry">💌 ${esc(pName(pending.from))}さんからペアの申し込みです。<div class="btns">${pAction('ペアになる','send({type:"red_accept"})','gold')}${pAction('断る','send({type:"red_reject"})','alt')}</div></div>`;}else{offer=`<div class="info">${esc(pName(pending.from))}さんが${esc(pName(pending.to))}さんにペアを申し込んでいます。回答待ち。</div>`}}
  else if(remain.includes(me))offer=`<p class="small">合計100に近そうな人を1人選んで申請。相手が承認すると成立します。</p><div class="red-players">${remain.filter(x=>x!==me).map(x=>`<button type="button" class="red-person" onclick="redOffer('${x}')"><b>${esc(pName(x))}</b><small>❤️ ペアを申し込む</small></button>`).join('')||'<div class="info">あなた以外は全員ペア成立済みです。</div>'}</div>`;
  else offer='<div class="info">あなたのペアは成立しました。残りの人を待ちましょう。</div>';
  const pairs=`<div class="party-stack">${p.pairs.map(x=>`<div class="red-pair"><b>${esc(x.leftName)} ＋ ${esc(x.rightName)}</b><span>${x.a} ＋ ${x.b} ＝ ${x.total}</span><strong>${x.over?'💔 100超え：0点':`❤️ +${x.points}点`}</strong></div>`).join('')}</div>`;
  return partyTitle('RED ITO / ペア探し','100になる相手を探そう',top+secret+`<h3>みんなの例え</h3>${clues()}<h3>ペアになっていない人：${remain.length}人</h3>${offer}<h3>成立したペア</h3>${pairs||'<p class="small">まだペアはありません。</p>'}`);
 }
 if(room.phase==='red_reveal'){
  const last=p.last;
  return partyTitle('RED ITO / 答え合わせ','ペアの数字を確認',top+`<div class="party-standings">${last.numbers.map(x=>`<div class="party-score"><strong>${esc(x.name)}</strong><b>${x.number}</b></div>`).join('')}</div><div class="party-stack">${last.pairs.map(x=>`<div class="red-pair"><b>${esc(x.leftName)} ＋ ${esc(x.rightName)}</b><span>${x.a} + ${x.b} = ${x.total}</span><strong>${x.over?'100超え・0点':`+${x.points}pt`}</strong></div>`).join('')}</div>${last.unmatched.length?`<div class="info">ペアを作れなかった人：${last.unmatched.map(x=>esc(x.name)).join('、')}</div>`:''}<div class="btns">${owner?pAction(p.round+1>=p.roundLimit?'最終結果へ':'次のラウンドへ','send({type:"red_next"})','gold'):''}</div>`);
 }
}
function submitRedClue(){const v=(document.getElementById('red-hint')?.value||redClueDraft).trim();if(!v)return error('例えを入力してください');send({type:'red_clue',text:v})}
function redOffer(target){send({type:'red_offer',target})}
function renderUnique(){
 const p=room.party,owner=room.owner===me;
 const top=partyStatusBar(p)+`<div class="party-hero">✨ ${esc(p.theme)}<small>全員が違う回答を出せたら成功！</small></div><div class="unique-streak">連続成功 <strong>${p.streak}</strong> / ${p.targetStreak}回　・　第${p.round+1}問 / ${p.roundLimit}問</div>`;
 if(room.phase==='uniq_answer'){
  const mine=p.submitted?'<div class="info">✅ 提出済み。みんなの回答が集まるまで秘密です。</div>':`<label class="labeled">ほかの人と被らない言葉を考えよう</label><input id="uniq-input" class="field" maxlength="45" value="${esc(uniqueAnswerDraft)}" oninput="uniqueAnswerDraft=this.value" placeholder="例：わさび味のアイス"><div class="btns">${pAction('回答を送る','submitUnique()','gold')}</div>`;
  return partyTitle('UNIQUE / かぶり禁止','全員バラバラを目指そう',top+mine+`<p class="small">提出：${p.submittedCount} / ${room.active.length}人</p>${owner&&!p.submittedCount?pAction('🎲 別のお題にする','send({type:"uniq_redraw"})','alt'):''}`);
 }
 if(room.phase==='uniq_reveal'){
  const r=p.last;
  return partyTitle('UNIQUE / 答え合わせ',r.success?'🎉 全員不一致！':'💥 回答がかぶった！',top+`<div class="unique-results">${r.answers.map(x=>`<div class="unique-result ${x.duplicate?'bad':'good'}"><b>${esc(x.name)}</b><span>${esc(x.text)}</span><strong>${x.duplicate?'かぶり':'セーフ'}</strong></div>`).join('')}</div><div class="btns">${owner?pAction(p.streak>=p.targetStreak||p.round+1>=p.roundLimit?'最終結果へ':'次のお題へ','send({type:"uniq_next"})','gold'):''}</div>`);
 }
}
function submitUnique(){const v=(document.getElementById('uniq-input')?.value||uniqueAnswerDraft).trim();if(!v)return error('回答を入力してください');uniqueAnswerDraft='';send({type:'uniq_answer',text:v})}

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
function proposalDraft(){const key=proposalKey();if(partyDraft.key!==key)partyDraft={key,tokens:[],baseSettings:Array.from({length:6},()=>({face:0,rotation:0})),activeBase:0};return partyDraft}
function proposalBasePhrase(card,state){const opts=card.faces[state.face]||card.faces[0];return opts[state.rotation%opts.length]}
function proposalTokenPhrase(token,p){if(token.index<6)return proposalBasePhrase(p.starters[token.index],token);return p.hand[token.index-6]||''}
function proposalAdd(index){const d=proposalDraft();if(d.tokens.some(t=>t.index===index))return;
 const settings=index<6?d.baseSettings[index]:{face:0,rotation:0};d.tokens.push({index,face:settings.face,rotation:settings.rotation});render();}
// Digital-first phrase editor: choose the actual phrase; there is no card-flipping control.
function proposalOpenBase(index){const d=proposalDraft();if(index<0||index>=room.party.starters.length)return;d.activeBase=index;render()}
function proposalChooseBase(index,face,rotation){const card=room.party.starters[index];if(!card||!card.faces[face]||typeof card.faces[face][rotation]!=='string')return;
 const d=proposalDraft();d.baseSettings[index]={face,rotation};d.activeBase=index;
 const token=d.tokens.find(t=>t.index===index);
 if(token){token.face=face;token.rotation=rotation}else d.tokens.push({index,face,rotation});
 render();}
function proposalMove(pos,step){const d=proposalDraft();const target=pos+step;if(target<0||target>=d.tokens.length)return;[d.tokens[pos],d.tokens[target]]=[d.tokens[target],d.tokens[pos]];render()}
function proposalRemove(pos){proposalDraft().tokens.splice(pos,1);render()}
function proposalUndo(){proposalDraft().tokens.pop();render()}
function proposalReset(){proposalDraft().tokens=[];render()}
function proposalSubmit(){const d=proposalDraft();if(!d.tokens.length)return error('1つ以上の言葉を選んで文章を作ってください');send({type:'prop_submit',tokens:d.tokens})}
function proposalPick(pid){if(confirm(`${pName(pid)}さんの告白を選びますか？`))send({type:'prop_pick',winner:pid})}
function proposalChip(index,text,tokens){const used=tokens.some(x=>x.index===index);return `<button type="button" class="party-chip ${used?'chosen':''}" ${used?'disabled':''} onclick="proposalAdd(${index})">${used?'✓ ':''}${esc(text)}</button>`}
function proposalBaseEditor(p,d){
 const active=Math.min(Math.max(d.activeBase??0,0),p.starters.length-1);
 const categories=p.starters.map((card,i)=>{
  const chosen=d.tokens.find(x=>x.index===i),selected=chosen?proposalTokenPhrase(chosen,p):'タップして言葉を選ぶ';
  const name=card.name.replace(/カード$/,'');
  return `<button type="button" class="proposal-category ${active===i?'is-active':''} ${chosen?'is-added':''}" onclick="proposalOpenBase(${i})" aria-pressed="${active===i}"><span class="proposal-cat-head"><b>${esc(name)}</b><span>${chosen?'✓ 追加済み':'未選択'}</span></span><span class="proposal-cat-phrase">${esc(selected)}</span></button>`;
 }).join('');
 const current=p.starters[active],selected=d.tokens.find(x=>x.index===active),variants=[];
 current.faces.forEach((face,fi)=>face.forEach((phrase,ri)=>variants.push({face:fi,rotation:ri,text:phrase})));
 const choices=variants.map(x=>{const on=!!selected&&selected.face===x.face&&selected.rotation===x.rotation;
  return `<button type="button" class="proposal-option ${on?'is-selected':''}" aria-pressed="${on}" onclick="proposalChooseBase(${active},${x.face},${x.rotation})"><span>${esc(x.text)}</span>${on?'<span aria-hidden="true" class="proposal-option-check">✓</span>':''}</button>`;
 }).join('');
 return `<section class="proposal-phrase-editor"><div class="proposal-section-title"><h3>✨ いつでも使える基本フレーズ</h3><p class="small">6つのカテゴリから好きな言葉を選ぶだけ。使った言葉も、タップし直せば変更できます。</p></div><div class="proposal-category-grid" role="group" aria-label="基本フレーズのカテゴリ">${categories}</div><div class="proposal-variants"><div class="proposal-variants-head"><strong>${esc(current.name.replace(/カード$/,''))}の候補</strong><small>${selected?'別の言葉を選ぶと文章も変わります':'タップすると文章に追加されます'}</small></div><div class="proposal-options" role="group" aria-label="${esc(current.name.replace(/カード$/,''))}の言葉一覧">${choices}</div></div></section>`;
}
function renderProposal(){const p=room.party,owner=room.owner===me,judge=p.judge,isJudge=judge===me;
 const top=partyStatusBar(p)+`<div class="party-hero">💌 今回の審査役：${esc(pName(judge))}<small>好きな言葉をタップして組み合わせるだけ。面白いプロポーズを作ろう！</small></div><div class="party-standings">${room.players.map(x=>`<div class="party-score"><strong>${esc(x.name)}</strong><b>💍 ${p.rings[x.id]||0}/3</b></div>`).join('')}</div>`;
 if(room.phase==='prop_compose'){
  if(isJudge)return partyTitle('LOVE / 作成中','みんなの告白を待とう',top+`<div class="info">今回はあなたが審査役！ 全員の告白からいちばん好きなものを選びます。</div><p class="small">提出済み：${p.submittedCount} / ${room.active.length-1}</p><div class="btns">${p.submittedCount?pAction('集まった告白を発表する','send({type:"prop_show"})','gold'):''}</div>`);
  if(p.submitted)return partyTitle('LOVE / 提出済み','審査を待とう',top+`<div class="info">✅ 告白を提出しました。みんなの提出を待っています。</div><p class="small">${p.submittedCount} / ${room.active.length-1}人が提出済み</p>`);
  const d=proposalDraft(),preview=d.tokens.map(x=>proposalTokenPhrase(x,p)).join(' ');
  const picked=`<div class="proposal-selected">${d.tokens.length?d.tokens.map((x,i)=>`<div class="proposal-picked"><span>${i+1}. ${esc(proposalTokenPhrase(x,p))}</span><div class="picked-actions"><button type="button" aria-label="左へ移動" ${i===0?'disabled':''} onclick="proposalMove(${i},-1)">←</button><button type="button" aria-label="右へ移動" ${i===d.tokens.length-1?'disabled':''} onclick="proposalMove(${i},1)">→</button><button type="button" aria-label="この言葉を外す" onclick="proposalRemove(${i})">×</button></div></div>`).join(''):'<div class="small">下から言葉を選ぶと、ここに追加されます。すべての言葉を使う必要はありません。</div>'}</div>`;
  return partyTitle('LOVE / 言葉を組み合わせる','オリジナルの告白を作ろう',top+
  `<div class="proposal-composition" aria-live="polite"><small>💌 あなたのプロポーズ <b>${d.tokens.length} / 12語</b></small><p>${esc(preview||'ここに選んだ言葉が表示されます')}</p><small>最後は「結婚しよう！」と読み上げよう</small></div>${picked}`+
  proposalBaseEditor(p,d)+
  `<div class="proposal-section-title"><h3>🎲 今回のランダムワード</h3><p class="small">毎ラウンド変わる6個の言葉。タップすると文章の末尾に追加されます。</p></div><div class="party-chips">${p.hand.map((x,i)=>proposalChip(i+6,x,d.tokens)).join('')}</div>`+
  `<div class="btns">${pAction('1つ戻す','proposalUndo()','alt')}${pAction('すべて外す','proposalReset()','alt')}${pAction('この告白を提出する','proposalSubmit()','gold')}</div><p class="small">選んだ言葉は上の矢印で順番を入れ替え、×で取り消せます。</p>`);
 }
 const entries=`<div class="proposal-entries">${p.entries.map(x=>`<article class="proposal-entry"><b>${esc(x.name)}さん</b><p>${esc(x.text)} 結婚しよう！</p>${room.phase==='prop_judge'&&isJudge?pAction('💍 この人に指輪を贈る',`proposalPick('${x.pid}')`,'gold'):''}</article>`).join('')}</div>`;
 if(room.phase==='prop_judge')return partyTitle('LOVE / 審査タイム','いちばん心に響いた言葉は？',top+`${entries}${!isJudge?'<div class="info">審査役が1人を選ぶまでお待ちください。</div>':''}`);
 if(room.phase==='prop_reveal')return partyTitle('LOVE / 結果発表','💍 指輪をもらったのは…',top+`<div class="party-hero">${esc(p.last.winnerName)}さん！<small>今回の審査役：${esc(pName(p.last.judge))}</small></div>${entries}<div class="btns">${owner?pAction(Math.max(...Object.values(p.rings))>=3||p.round+1>=p.roundLimit?'最終結果へ':'次の審査役へ','send({type:"prop_next"})','gold'):''}</div>`);
}
function renderSoup(){const p=room.party,owner=room.owner===me,narrator=p.narrator,isNarrator=narrator===me;
 const top=partyStatusBar(p)+`<div class="party-hero">🔎 ${esc(p.title)}<small>${esc(p.situation)}</small></div><div class="party-meta"><span>${esc(p.category||'謎解き')} · 難易度 ${'★'.repeat(p.difficulty)}</span><span>出題者：${esc(pName(narrator))}</span><span>問題ストック ${p.bankCount||'多数'}問</span></div>`;
 const log=p.entries.map(x=>{const badge=x.kind==='ask'?'<span class="tiny-pill">質問</span>':'<span class="tiny-pill warn">真相の推理</span>';
  let reply='';
  if(x.kind==='ask')reply=x.verdict?`<span class="verdict ${x.verdict}">${{yes:'はい',no:'いいえ',irrelevant:'関係ありません'}[x.verdict]||esc(x.verdict)}</span>`:(isNarrator&&room.phase==='soup_ask'?`<div class="reply-buttons">${[['yes','はい'],['no','いいえ'],['irrelevant','関係ない']].map(([v,t])=>pAction(t,`soupReply(${x.id},'${v}')`,'alt')).join('')}</div>`:'<small>出題者の回答待ち</small>');
  else reply=x.verdict==='wrong'?'<span class="verdict no">まだ正解ではありません</span>':(isNarrator&&room.phase==='soup_ask'?`<div class="reply-buttons">${pAction('✅ 正解にする',`soupResolve(${x.id})`,'gold')}${x.verdict!=='wrong'?pAction('惜しい・不正解',`soupReject(${x.id})`,'alt'):''}</div>`:'<small>出題者が判定します</small>');
  return `<div class="soup-entry"><div><b>${esc(x.name)}</b> ${badge}</div><p>${esc(x.text)}</p><div>${reply}</div></div>`}).join('');
 if(room.phase==='soup_ask'){
  const secret=isNarrator?`<div class="soup-secret"><b>🔒 出題者だけに見える真相</b><p>${esc(p.solution)}</p><div class="soup-master-hints">${(p.secretHints||[]).map((x,i)=>`<div><b>ヒント${i+1}：</b>${esc(x)}</div>`).join('')}</div><details class="party-detail"><summary>🎓 出題者ガイド・重要な確認ポイント</summary>${(p.hostGuide||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')}<h4>質問されたときの回答例</h4>${(p.hostQA||[]).map(x=>`<p><b>Q. ${esc(x.q)}</b><span> → ${esc(x.a)}</span></p>`).join('')}</details><details class="party-detail"><summary>📚 もっと凝った問題を探す（出題者専用）</summary><p class="small">有名な問題の本文や解答はここには転載していません。出題者が元サイトで利用条件を確認できます。</p><p><a href="https://www.umigame-quiz.com/collections/high-rated-umigame" target="_blank" rel="noopener noreferrer">高評価の公開問題集</a></p><p><a href="https://sui-hei.net/mondai" target="_blank" rel="noopener noreferrer">ラテシン問題集</a></p><p><a href="https://quizmondai.com/lateral-thinking/" target="_blank" rel="noopener noreferrer">ピコンクエストの問題集</a></p></details></div>`:'';
  const library=NKM.games().filter(g=>g.game==='soup').slice(0,25);const soupExtras=isNarrator&&!p.entries.length&&!p.hints.length?`<details class="party-detail"><summary>📚 別の良問を使う・自作問題を出す</summary><p>高評価の問題は原作者の掲載元で確認できます。無断転載はせず、出題者が読んで進行するのがおすすめです。</p><div class="btns"><a href="https://www.umigame-quiz.com/collections/high-rated-umigame" target="_blank" rel="noopener noreferrer" class="btn alt">高評価問題集</a><a href="https://sui-hei.net/mondai" target="_blank" rel="noopener noreferrer" class="btn alt">ラテシン問題集</a><a href="https://www.de-bono.net/mondai/good" target="_blank" rel="noopener noreferrer" class="btn alt">解き心地から探す</a></div><div class="party-stack"><p class="small"><strong>評判のよい公開問題（原作者ページで読む）</strong></p><a target="_blank" rel="noopener noreferrer" href="https://www.umigame-quiz.com/problems/0a3ea349-ccd6-4383-940a-2e5c49f5a705">★ 叩き合う男女 — uon_ さん</a><a target="_blank" rel="noopener noreferrer" href="https://www.umigame-quiz.com/problems/ba915e68-7e9b-4eac-b5fe-b36722cb8f14">★ 突然の暴行 — あや さん</a><a target="_blank" rel="noopener noreferrer" href="https://www.umigame-quiz.com/problems/e9988d8f-2238-4b44-8a5d-a6a84c3a8915">★ 怪しい3人組 — Sokura さん</a><a target="_blank" rel="noopener noreferrer" href="https://www.umigame-quiz.com/problems/d6fc4795-3441-45ca-84ff-7ab40c26ea5e">★ 憂鬱な贈り物</a><a target="_blank" rel="noopener noreferrer" href="https://www.umigame-quiz.com/problems/defcdb23-da75-4f3f-94f9-4905a702ace0">★ サングラス</a></div><p>自分で作った問題を出題する場合：</p>${library.length?`<select class="field" id="saved-soup">${library.map((g,i)=>`<option value="${i}">${esc(g.title)}</option>`).join('')}</select><div class="btns">${pAction('保存した謎を出題する','submitMySoup()','gold')}</div>`:'<p class="small">アトリエでウミガメのスープを作成・保存すると、ここから出題できます。</p>'}<a href="/studio" class="btn alt" style="display:inline-block;text-decoration:none">✏️ 出題用の謎を作る</a></details>`:'';
   const hint=p.hints.length?`<div class="info">${p.hints.map((x,i)=>`💡 ヒント${i+1}：${esc(x)}`).join('<br>')}</div>`:'';
  const ask=isNarrator?`${secret}<div class="btns">${p.hints.length<(p.secretHints||[]).length?pAction('💡 次のヒントを公開','send({type:"soup_hint"})','alt'):''}${!p.entries.length&&!p.hints.length?pAction('🎲 難問を選ぶ','send({type:"soup_reroll",difficulty:4})','alt')+pAction('別の問題に変更','send({type:"soup_reroll"})','alt'):''}${pAction('真相を公開して終了','soupResolve(null)')}</div><p class="small">質問に「はい／いいえ／関係ありません」を返して、友達の推理を判定します。真相は公開ボタンを押すまで自分だけに表示されます。</p>`:
   `<label class="labeled" for="soup-text">はい／いいえで答えられる質問をしよう</label><textarea id="soup-text" class="field" rows="3" maxlength="180" oninput="partySoupText=this.value" placeholder="例：場所が重要ですか？ 登場人物は何かを勘違いしていますか？">${esc(partySoupText)}</textarea><div class="btns">${pAction('質問する','submitSoup("soup_ask")')}${pAction('真相を推理して発表','submitSoup("soup_solve")','gold')}</div>`;
  partyTitle('MYSTERY / みんなで真相を探る','不可解な出来事の理由は？',top+soupExtras+hint+ask+`<h3>みんなの質問と回答 <span class="small">${p.entries.length}件</span></h3><div class="soup-log">${log||'<div class="info">質問をして、状況を絞り込もう！</div>'}</div>`);
 }else if(room.phase==='soup_reveal'){
  const winner=p.last.winner?`${esc(pName(p.last.winner))}さんが解明！`:'真相を公開しました';
  partyTitle('MYSTERY / 真相公開',winner,top+`<div class="soup-solution"><b>答え</b><p>${esc(p.solution)}</p></div><details class="party-detail"><summary>質問と回答を振り返る（${p.entries.length}件）</summary><div class="soup-log">${log}</div></details><div class="btns">${owner?pAction(p.round+1>=p.roundLimit?'最終結果へ':'次の問題へ','send({type:"soup_next"})','gold'):''}</div>`);
 }
}
function submitSoup(type){const v=(document.getElementById('soup-text')?.value||partySoupText).trim();if(v.length<2)return error('質問を入力してください');partySoupText='';send({type,text:v})}
function soupReply(id,verdict){send({type:'soup_reply',id,verdict})}
function soupReject(id){send({type:'soup_reject',id})}
function soupResolve(index){if(confirm(index===null?'真相を公開して、この問題を終了しますか？':'この推理を正解として、問題を終了しますか？'))send({type:'soup_resolve',winner:index})}

function submitMySoup(){const saved=NKM.games().filter(g=>g.game==='soup').slice(0,25);const ix=Number(document.getElementById('saved-soup')?.value||0),g=saved[ix];if(!g)return;const p=g.config;if(!confirm('今の問題を、自作の「'+g.title+'」に変更しますか？'))return;send({type:'soup_custom',puzzle:{title:g.title,situation:p.situation,solution:p.solution,hints:p.hints}})}

function renderWolf(){const p=room.party,owner=room.owner===me,other=room.players.filter(x=>x.id!==me);
 const top=partyStatusBar(p)+`<div class="party-hero">🐺 あなたに配られた秘密のお題<small>会話の中で自分と違う言葉を持つ人を探そう</small><div class="wolf-word">${esc(p.myWord)}</div></div>`;
 if(room.phase==='wolf_talk'){
  const vote=p.myVote?`<div class="info">✅ 投票しました。ほかの人を待っています。</div>`:`<h3>誰が少数派だと思う？</h3><div class="red-players">${other.map(x=>`<button type="button" class="red-person" onclick="voteWolf('${x.id}')"><b>${esc(x.name)}さん</b><small>この人に投票する</small></button>`).join('')}</div>`;
  return partyTitle('BLUFF / 少数派を探そう','会話して1人に投票',top+`<div class="info">自分の言葉を直接見せず、同じ言葉かどうか会話で確認しよう。自分への投票はできません。</div>${vote}<p>投票済み：${p.votedCount} / ${room.active.length}人</p>${owner&&p.votedCount>=2?pAction('集まった投票で判定する','send({type:"wolf_force"})','alt'):''}`);
 }
 if(room.phase==='wolf_guess')return partyTitle('BLUFF / 最後の逆転','少数派は多数派の言葉を当てよう',top+`<div class="info">投票で少数派が見つかりました。少数派の人は、多数派が持っている言葉を当てると逆転ボーナスがあります。</div>${p.canGuess?`<label class="labeled">多数派の言葉を予想して入力</label><div class="wolf-guess"><input class="field" id="wolf-guess-input" maxlength="60" placeholder="多数派の言葉は？"><div class="btns">${pAction('回答する','guessWolf()','gold')}</div></div>`:'<div class="info">少数派が多数派のお題を当てるまで待ちましょう。</div>'}`);
 if(room.phase==='wolf_reveal'){
  const r=p.last;return partyTitle('REVEAL / 結果発表',r.caught?'🐺 少数派を発見！':'🐺 少数派が逃げ切り！',top+`<div class="resultbadge center">多数派：${esc(r.majority)}<br>少数派：${esc(r.minority)}<br>少数派だったのは <b>${esc(r.wolfName)}さん</b></div><p>${r.caught?`多数派の言葉を当てて逆転：${r.wolfGuessed?'成功！':'失敗'}`:'少数派に投票が集まりませんでした。'}</p><div class="party-stack">${r.votes.map(x=>`<div class="party-detail">${esc(x.name)}さん → ${esc(pName(x.target))}さんに投票</div>`).join('')}</div><div class="btns">${owner?pAction(p.round+1>=p.roundLimit?'最終結果へ':'次のラウンドへ','send({type:"wolf_next"})','gold'):''}</div>`)
 }
}
function voteWolf(id){if(confirm('この人を少数派として投票しますか？'))send({type:'wolf_vote',target:id})}
function guessWolf(){send({type:'wolf_guess',text:document.getElementById('wolf-guess-input')?.value||''})}

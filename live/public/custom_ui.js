'use strict';
/* Atelier -> live play. Loaded after main.js; shares existing roomBar/panel/action/esc/send. */
let studioDraft={key:'',order:[0,1,2,3,4],selected:null};
let studioReviewIndex=0;
const ST_NAMES={tier:'みんなでティア表！',value:'これって重い？判定シート',either:'恋愛究極の２択',quiz:'理解度チェック',soup:'ウミガメのスープ'};
const stImageOk=src=>typeof src==='string'&&src.length<90000&&(/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(src)||/^https:\/\/[^\s<>"']{1,1000}$/.test(src));
function stPicture(src,alt='',cls='st-picture'){return stImageOk(src)?`<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`:''}
function stPending(){try{const v=sessionStorage.getItem('nkstudio_prepare');return v?JSON.parse(v):null}catch{return null}}
function studioLobbyPanel(){
 const owner=room.owner===me, games=NKM.games().filter(x=>['tier','quiz','either','value','soup'].includes(x.game));
 const imported=room.customMeta, prepared=stPending();
 const summary=imported?`<div class="st-loaded"><b>✅ 読み込み済み：${esc(imported.title)}</b><span>${esc(ST_NAMES[imported.game])} · ${imported.count}問 ${imported.hasImages?'· 画像付き':''}</span><small>作成者の正解は、答え合わせになるまでほかの人には見えません。</small></div>`:'<p class="small">アトリエで保存した問題セットを、友達全員に出題できます。作者が出題者になり、ほかの人が回答します。</p>';
 if(!owner)return `<section class="st-lobby"><h3>✏️ 自作ゲームを持ち込む</h3>${summary}<p class="small">問題セットの選択はルーム作成者が行います。</p></section>`;
 const options=games.map((g,i)=>`<option value="${i}">${esc(g.title)}（${esc(ST_NAMES[g.game])}）</option>`).join('');
 return `<section class="st-lobby"><h3>✏️ アトリエの問題をみんなで遊ぶ</h3>${summary}
 ${prepared?`<div class="st-prepared">📚 アトリエから準備済み：<b>${esc(prepared.title||'自作問題')}</b> ${action('この問題を読み込む','studioImportPending()','gold')}</div>`:''}
 ${games.length?`<div class="st-picker"><label for="st-saved-pick">このブラウザに保存した問題</label><select id="st-saved-pick" class="field">${options}</select>${action('選んだ問題を読み込む','studioImportSaved()','gold')}</div>`:'<p class="small">まだ保存した問題がありません。アトリエで作るか、JSONファイルを読み込んでください。</p>'}
 <div class="st-picker"><label class="st-upload">📁 JSONバックアップから読み込む<input class="st-file" type="file" accept=".json,application/json" onchange="studioImportFile(event)"></label><a href="/studio" class="btn alt">アトリエで作成・編集する</a></div><p class="small">問題画像も送信されます。1セット最大650KB。公開ルームで知らない人に出題しないでください。</p></section>`
}
function studioPayload(game){return {v:2,game:game.game,title:game.title,config:game.config,truth:game.truth}}
function studioImportPayload(g){if(!g||!g.game||!g.config){return error('自作問題データを確認してください')};if(room?.phase!=='lobby'||room.owner!==me)return error('ルーム待機画面でホストが読み込めます');const bytes=new TextEncoder().encode(JSON.stringify(g)).length;if(bytes>650000)return error('画像込みの問題セットが大きすぎます（650KBまで）。画像を減らしてください。');send({type:'studio_import',challenge:studioPayload(g)})}
function studioImportSaved(){const list=NKM.games().filter(x=>['tier','quiz','either','value','soup'].includes(x.game));const index=Number(document.getElementById('st-saved-pick')?.value||0);if(!list[index])return error('保存した問題を選んでください');studioImportPayload(list[index])}
function studioImportPending(){const g=stPending();if(g)studioImportPayload(g);else error('アトリエからの問題を読み込めません')}
async function studioImportFile(event){const f=event.target.files?.[0];if(!f)return;if(f.size>700000)return error('650KB以下のJSONファイルを選んでください');try{const raw=JSON.parse(await f.text());const g=raw.kind==='nakamikurabe-challenge'?raw.game:raw.kind==='nakamikurabe-backup'?raw.games?.[0]:raw;studioImportPayload(g)}catch(e){error('JSONが読み込めませんでした：'+e.message)}}
function studioInitDraft(){const s=room.studio,key=room.code+':'+room.matchNo+':'+s.index;if(studioDraft.key!==key)studioDraft={key,order:[0,1,2,3,4],selected:null}}
function studioMove(pos,delta){studioInitDraft();const j=pos+delta;if(j<0||j>=5)return;[studioDraft.order[pos],studioDraft.order[j]]=[studioDraft.order[j],studioDraft.order[pos]];renderStudioLive()}
function studioSelect(i){studioInitDraft();studioDraft.selected=i;renderStudioLive()}
function studioSendGuess(){studioInitDraft();if(room.studio.hasAnswered)return;const guess=room.game==='tier'?studioDraft.order:studioDraft.selected;if(guess==null)return error('回答を選んでください');send({type:'studio_guess',guess})}
function studioSubmitText(solve=false){const box=document.getElementById('st-question-input');const text=box?.value.trim();if(!text)return error('質問や推理を入力してください');if(text.length>250)return error('250文字以内で入力してください');send({type:'studio_ask',text,solve})}
function studioReply(id,verdict){send({type:'studio_reply',id,verdict})}
function studioResolve(winner=null){if(confirm('この問題の真相を公開しますか？'))send({type:'studio_resolve',winner})}
function studioNext(){send({type:'studio_next'});studioDraft.key=''}
function studioQuestionView(item,game){
 if(!item)return '';
 const title=game==='tier'?item.title:game==='soup'?item.situation:item.q;
 return `<div class="st-question"><div class="st-qtext">${esc(title)}</div>${stPicture(item.image,'問題の画像')}
 ${game==='tier'?'<p class="small">5つの候補をS〜Dの順に並べてください。</p>':''}</div>`
}
function studioScoreboard(){const ps=[...room.players].sort((a,b)=>b.score-a.score);return `<div class="st-scores">${ps.map((p,i)=>`<div class="st-score"><b>${i+1}位 ${esc(p.name)}</b><span>${p.score}pt</span></div>`).join('')}</div>`}
function studioTierCards(item,order,interactive){return `<div class="st-tier-list">${order.map((id,i)=>`<div class="st-tier-line"><b class="st-grade st-grade-${'SABCD'[i]}">${'SABCD'[i]}</b>${stPicture(item.itemImages?.[id],'選択肢の画像','st-mini-image')}<strong>${esc(item.items[id])}</strong>${interactive?`<div class="st-tweak"><button ${i===0?'disabled':''} onclick="studioMove(${i},-1)">↑</button><button ${i===4?'disabled':''} onclick="studioMove(${i},1)">↓</button></div>`:''}</div>`).join('')}</div>`}
function studioChoices(item){studioInitDraft();return `<div class="st-choices">${item.options.map((v,i)=>`<button type="button" class="st-choice ${studioDraft.selected===i?'picked':''}" onclick="studioSelect(${i})">${stPicture(item.optionImages?.[i],'選択肢画像','st-choice-image')}<b>${'ABCD'[i]}</b><span>${esc(v)}</span></button>`).join('')}</div>`}
function studioComparison(record){const item=record.item,game=room.game;if(game==='soup')return `<div class="st-truth">${esc(record.truth)}</div>`;
 const rows=record.rows||[];if(game==='tier'){const bodies=[{name:'★ 正解',guess:record.truth,correct:true,points:5},...rows.map(r=>({...r,correct:false}))];return `<div class="st-scroll"><table class="st-matrix"><thead><tr><th>参加者</th>${['S','A','B','C','D'].map(v=>`<th>${v}</th>`).join('')}<th>得点</th></tr></thead><tbody>${bodies.map(x=>`<tr><th>${esc(x.name)}</th>${x.guess.map((v,i)=>`<td class="${x.correct?'truth':v===record.truth[i]?'right':'wrong'}" title="${esc(item.items[v])}">${stPicture(item.itemImages?.[v],'','st-grid-img')}<span>${esc(item.items[v])}</span></td>`).join('')}<td><b>${x.correct?'—':x.points+'/5'}</b></td></tr>`).join('')}</tbody></table></div>`}
 return `<div class="st-answers"><div class="st-answer truth"><strong>★ 正解</strong><span>${esc(item.options[record.truth])}</span></div>${rows.map(r=>`<div class="st-answer ${r.points?'right':'wrong'}"><strong>${esc(r.name)}</strong><span>${esc(item.options[r.guess])}</span><b>${r.points?'✓':'×'}</b></div>`).join('')}</div>`}
function studioSoupView(s){const owner=room.owner===me;const logs=s.logs||[];
 return `${owner?`<div class="st-secret"><b>🔒 出題者だけに見える真相</b><p>${esc(s.solution||'')}</p>${s.privateHints?.map((h,i)=>`<p class="small">ヒント${i+1}：${esc(h)}</p>`).join('')||''}</div>`:''}
 ${s.hints?.length?`<div class="info">${s.hints.map((h,i)=>`💡 ヒント${i+1}：${esc(h)}`).join('<hr>')}</div>`:''}
 ${owner?`<div class="btns">${action('💡 ヒントを公開','send({type:"studio_hint"})','alt')}${action('真相を公開して終了','studioResolve()','gold')}</div>`:`<div class="st-ask"><label for="st-question-input" class="labeled">はい・いいえで答えられる質問</label><textarea id="st-question-input" class="field" maxlength="250" rows="2" placeholder="例：その行動に理由がありましたか？"></textarea><div class="btns">${action('質問を送信','studioSubmitText(false)')}${action('真相を推理して送信','studioSubmitText(true)','gold')}</div></div>`}
 <div class="st-log"><h3>みんなの質問（${logs.length}件）</h3>${logs.map(l=>`<div class="st-entry"><b>${esc(l.name)} ${l.kind==='solve'?'の推理':'の質問'}</b><p>${esc(l.text)}</p>${l.verdict?`<span class="st-verdict">${({yes:'はい',no:'いいえ',irrelevant:'関係ありません',wrong:'不正解'})[l.verdict]}</span>`:owner?`<div class="btns st-verdicts">${['yes','no','irrelevant','wrong'].map((v,i)=>action(['はい','いいえ','関係ない','不正解'][i],`studioReply(${l.id},'${v}')`,'alt')).join('')}${l.kind==='solve'?action('✓ この人が正解',`studioResolve('${l.pid}')`,'gold'):''}</div>`:'<span class="small">返答待ち</span>'}</div>`).join('')||'<p class="small">質問をするとここに表示されます。</p>'}</div>`}
function studioRenderFinal(){const s=room.studio,records=s.history||[];studioReviewIndex=Math.min(studioReviewIndex,Math.max(0,records.length-1));const r=records[studioReviewIndex];return panel('ATELIER / 最終結果',`${esc(s.title)}｜終了`,roomBar()+studioScoreboard()+`<p class="small">${records.length}/${s.count}問の結果。必要な問題だけ選んで振り返れます。</p>${records.length?`<label class="labeled">振り返る問題</label><select class="field" onchange="studioReviewIndex=Number(this.value);renderStudioLive()">${records.map((x,i)=>`<option value="${i}" ${studioReviewIndex===i?'selected':''}>第${i+1}問</option>`).join('')}</select>${studioQuestionView(r.item,s.game)}${studioComparison(r)}`:'<div class="info">答え合わせ前に終了しました。</div>'}<div class="btns">${room.owner===me?action('同じメンバーでもう一度','send({type:"restart"})','gold'):''}${action('タイトルへ戻る','leaveToTitle()','alt')}</div>`)}
function renderStudioLive(){if(!room?.studio)return;const s=room.studio,owner=room.owner===me,phase=room.phase;if(phase==='final'){app.innerHTML=studioRenderFinal();return}
 const header=`<div class="st-progress"><span>✏️ アトリエから持ち込んだゲーム</span><strong>${s.index+1} / ${s.count}問</strong></div>`;
 const summary=studioQuestionView(s.item,s.game);
 if(phase==='studio_guess'){
 studioInitDraft();const input=owner?'<div class="info">出題者のあなたは答えを知っています。友達の回答を待ちましょう。</div>':s.hasAnswered?'<div class="info">✅ 回答を送りました。ほかの人を待っています。</div>':(s.game==='tier'?studioTierCards(s.item,studioDraft.order,true):studioChoices(s.item))+`<div class="btns">${action('この回答で送信','studioSendGuess()','gold')}</div>`;
 const participants=Math.max(0,room.players.length-1);
 app.innerHTML=panel('ATELIER / 全員でチャレンジ',esc(s.title),roomBar()+header+summary+`<div class="st-answer-count">回答済み：${s.answered}/${participants}人</div>`+input+`<div class="st-bottom">${studioScoreboard()}${owner?action('集まった回答で答え合わせ','send({type:"force"})','alt'):''}</div><p id="err" class="error" hidden></p>`);return;
 }
 if(phase==='studio_soup'){
 app.innerHTML=panel('ATELIER / ウミガメのスープ',esc(s.title),roomBar()+header+summary+studioSoupView(s)+`<p id="err" class="error" hidden></p>`);return;
 }
 if(phase==='studio_reveal'){
 const last=s.last;app.innerHTML=panel('ATELIER / 答え合わせ',esc(s.title),roomBar()+header+summary+(s.game==='soup'?`<div class="st-truth"><b>真相</b><p>${esc(last?.truth||'')}</p><small>${last?.winner?`正解：${esc(last.winner)}さん`:'真相公開'}</small></div>`:studioComparison(last))+studioScoreboard()+`<div class="btns">${owner?action(s.index+1===s.count?'最終結果を見る':'次の問題へ','studioNext()','gold'):'<span class="small">ホストが次の問題に進めます。</span>'}</div><p id="err" class="error" hidden></p>`);return;
 }
}

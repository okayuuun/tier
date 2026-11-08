'use strict';
/* Three additional multiplayer games. Server decides secrets, roles and scoring. */
const MORE_GAMES=['describe','drawfake','mysterymail'];
let moreDescDraft='',moreGuessDraft='',moreMailDraft='',moreDrawPoints=[],moreDrawing=false;
const moreEsc = s => esc(s);
const moreAct = (text,fn,kind='')=>action(text,fn,kind);
const moreName = id=>room.players.find(p=>p.id===id)?.name||'参加者';
const moreStatus = p=>`<div class="more-round"><span>${esc(GAMES[room.game]?.icon||'🎲')} ${esc(GAMES[room.game]?.title||'')}</span><strong>ROUND ${p.round+1} / ${p.roundLimit}</strong></div>`;
const moreScores=()=>`<div class="more-scores">${[...room.players].sort((a,b)=>b.score-a.score).map(p=>`<span class="more-score">${esc(p.emoji||'🌷')} ${esc(p.name)} <b>${p.score}pt</b></span>`).join('')}</div>`;
const moreTitle=(sub,title,html)=>{app.innerHTML=panel(sub,title,roomBar()+moreStatus(room.more)+html+'<p id="err" class="error" hidden></p>');};
const moreNext=()=>room.owner===me?moreAct('次のラウンドへ →',`send({type:'${room.game==='describe'?'desc_next':room.game==='drawfake'?'draw_next':'mail_next'}'})`,'gold'):'<p class="info">主催者が次のラウンドへ進めます。</p>';
function renderMore(){if(!room||!MORE_GAMES.includes(room.game))return;
 if(room.phase==='final')return renderMoreFinal();
 if(room.game==='describe')return renderDescribe();
 if(room.game==='drawfake')return renderDrawFake();
 if(room.game==='mysterymail')return renderMysteryMail();
}
function renderMoreFinal(){const p=room.more;let summary='';
 if(room.game==='describe')summary=`<div class="more-history">${p.history.map((r,i)=>`<details><summary>${i+1}問目：${esc(r.word)} / ${esc(r.winnerName||'正解者なし')}</summary><p>${esc(r.clue||'説明なし')}</p></details>`).join('')}</div>`;
 if(room.game==='drawfake')summary=`<div class="more-history">${p.history.map(r=>`<details><summary>${r.round}回目：${esc(r.word)} / ${esc(r.fakeName)}さんがエセ</summary><p>${r.caught?'投票で発見':'見破られず'} ${r.guessed?'・答えを当てて逆転':''}</p></details>`).join('')}</div>`;
 if(room.game==='mysterymail')summary=`<div class="more-history">${p.history.map(r=>`<p>✅ ${esc(r.title)}（${r.steps}つの謎を解決）</p>`).join('')}</div>`;
 moreTitle('FINISH / 最終結果','みんなの結果',moreScores()+summary+`<div class="btns">${room.owner===me?moreAct('もう一度遊ぶ','send({type:"restart"})','gold'):''}${moreAct('タイトルへ戻る','leaveToTitle()','alt')}</div>`);
}
function renderDescribe(){const p=room.more,host=p.explainer===me,owner=room.owner===me;
 const heading=`<div class="more-hero"><b>${host?'あなたが説明担当！':`${esc(moreName(p.explainer))}さんが説明担当`}</b><small>今回の条件：${esc(p.modifier)}</small></div>`;
 if(room.phase==='desc_clue')return moreTitle('EXPLAIN / ヒントを考えよう','カタカナを使わずに伝えよう',heading+(host?`<div class="more-secret">今回のお題：<strong>${esc(p.word)}</strong><small>お題の名前やカタカナ語は説明に使えません。</small></div><label class="labeled" for="desc-clue">あなたの説明</label><textarea class="field" id="desc-clue" rows="3" maxlength="150" placeholder="例：画面で時間を知らせる道具" oninput="moreDescDraft=this.value">${esc(moreDescDraft)}</textarea><div class="btns">${moreAct('説明を公開する','sendDescClue()','gold')}</div>`:`<div class="info">説明を考えてもらっています。公開されたら回答しましょう！</div>`)+moreScores());
 if(room.phase==='desc_guess')return moreTitle('GUESS / 何の言葉？','説明から正解を当てよう',heading+`<blockquote class="more-clue">${esc(p.clue)}</blockquote>`+(host?`<div class="more-secret">正解：<b>${esc(p.word)}</b></div>`:`<label class="labeled" for="desc-guess">答えを入力（残り${5-p.attemptCount}回）</label><input class="field" id="desc-guess" maxlength="80" value="${esc(moreGuessDraft)}" placeholder="言葉を入力" oninput="moreGuessDraft=this.value"><div class="btns">${moreAct('回答する','sendDescGuess()','gold')}</div>`)+`<div class="more-list">${p.attempts.map(x=>`<p><b>${esc(x.name)}</b>：${esc(x.text)} ${x.correct?'✅':'✕'}</p>`).join('')||'<p>まだ回答はありません</p>'}</div>${owner?`<div class="btns">${moreAct('正解を公開する','send({type:"desc_skip"})','alt')}</div>`:''}`);
 if(room.phase==='desc_reveal')return moreTitle('REVEAL / 答え合わせ','正解はこちら！',`<div class="more-reveal"><span>${esc(p.last.word)}</span><small>${esc(p.last.winnerName||'正解者なし')}</small></div>${moreScores()}<div class="btns">${moreNext()}</div>`);
}
function sendDescClue(){const s=(document.getElementById('desc-clue')?.value||moreDescDraft).trim();if(!s)return error('説明を入力してください');send({type:'desc_clue',text:s})}
function sendDescGuess(){const s=(document.getElementById('desc-guess')?.value||moreGuessDraft).trim();if(!s)return error('答えを入力してください');moreGuessDraft='';send({type:'desc_guess',text:s})}
// Drawing UI: SVG strokes preserve the author and color, each turn draws one continuous line.
const DRAW_COLORS=['#eb4792','#408dd5','#25a889','#e0a02f','#8d6be0','#d35e3f','#55a0ad','#796ed0','#99a239','#bd5c90','#4d8071','#9a6072'];
function drawColor(id){const i=room.players.findIndex(x=>x.id===id);return DRAW_COLORS[(i<0?0:i)%DRAW_COLORS.length];}
function linePath(points){return (points||[]).map((pt,i)=>`${i?'L':'M'} ${pt[0]} ${pt[1]}`).join(' ')}
function drawPicture(strokes,interactive=false){return `<div class="draw-board"><svg id="draw-svg" viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid meet" role="img" aria-label="全員で描いた線のキャンバス" ${interactive?'onpointerdown="morePointerDown(event)" onpointermove="morePointerMove(event)" onpointerup="morePointerUp(event)" onpointercancel="morePointerUp(event)"':''}>
<rect x="0" y="0" width="1000" height="660" rx="18" fill="#fffdfa"/>${strokes.map(s=>`<path d="${linePath(s.points)}" fill="none" stroke="${drawColor(s.pid)}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}<path id="draw-preview" d="${linePath(moreDrawPoints)}" fill="none" stroke="${drawColor(me)}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`}
function canvasXY(event){const rect=event.currentTarget.getBoundingClientRect(),x=Math.min(1000,Math.max(0,Math.round((event.clientX-rect.left)/rect.width*1000))),y=Math.min(660,Math.max(0,Math.round((event.clientY-rect.top)/rect.height*660)));return [x,y]}
function morePointerDown(event){if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();moreDrawing=true;moreDrawPoints=[canvasXY(event)];event.currentTarget.setPointerCapture(event.pointerId);drawPreview()}
function morePointerMove(event){if(!moreDrawing)return;event.preventDefault();const next=canvasXY(event);const old=moreDrawPoints.at(-1);if(!old||Math.abs(old[0]-next[0])+Math.abs(old[1]-next[1])>=5){if(moreDrawPoints.length<145)moreDrawPoints.push(next);drawPreview()}}
function morePointerUp(event){if(!moreDrawing)return;event.preventDefault();moreDrawing=false;if(moreDrawPoints.length===1){let [x,y]=moreDrawPoints[0];moreDrawPoints.push([Math.min(1000,x+2),Math.min(660,y+2)])}drawPreview()}
function drawPreview(){const path=document.getElementById('draw-preview');if(path)path.setAttribute('d',linePath(moreDrawPoints))}
function resetDraw(){moreDrawPoints=[];drawPreview()}
function sendDraw(){if(moreDrawPoints.length<2)return error('キャンバスに1本線を描いてください');send({type:'draw_stroke',points:moreDrawPoints});moreDrawPoints=[]}
function renderDrawFake(){const p=room.more,host=p.myRole==='host',fake=p.myRole==='faker',owner=room.owner===me;
 const role=`<div class="more-role ${fake?'more-role-fake':''}">今回の役割：<b>${host?'出題者':fake?'エセ芸術家':'芸術家'}</b><p>${fake?'ジャンルだけを頼りにお絵描きしよう。':`ジャンル：${esc(p.category)} ${p.word?`／お題：${esc(p.word)}`:''}`}</p></div>`;
 const current=room.players.find(x=>x.id===p.turn);
 const isTurn=room.phase==='draw_stroke'&&p.turn===me;
 const board=drawPicture(p.strokes,isTurn);
 if(room.phase==='draw_stroke')return moreTitle('DRAW / みんなでお絵描き',`一筆ずつ絵を完成させよう（${p.turnNo}/${p.totalTurns}）`,role+`<div class="more-hero">${isTurn?'あなたの番！':'現在は '+esc(current?.name||'参加者')+'さんの番'}</div>${board}${isTurn?`<p class="small">指やマウスで1本の線を描いてください。送信後は消せません。</p><div class="btns">${moreAct('描き直す','resetDraw()','alt')}${moreAct('この線を送る','sendDraw()','gold')}</div>`:'<div class="info">みんなの線がリアルタイムで追加されます。</div>'}<div class="draw-legend">${room.players.filter(x=>x.id!==p.host).map(x=>`<span><i style="background:${drawColor(x.id)}"></i>${esc(x.name)}</span>`).join('')}</div>`);
 if(room.phase==='draw_vote')return moreTitle('VOTE / エセを探そう','誰がお題を知らなかった？',role+board+(host?'<div class="info">出題者は投票結果を待ちます。</div>':p.myVote?'<div class="info">投票しました。全員の投票を待ちます。</div>':`<div class="more-votes">${room.players.filter(x=>x.id!==me&&x.id!==p.host).map(x=>`<button class="more-player" onclick="send({type:'draw_vote',target:'${x.id}'})">${esc(x.name)} に投票</button>`).join('')}</div>`)+`<p class="small">投票済み ${p.votedCount} / ${room.active.length-1}</p>`);
 if(room.phase==='draw_guess')return moreTitle('FINAL CHANCE / 逆転','エセ芸術家のラストチャンス',role+board+(p.canGuess?`<label class="labeled">絵のお題は何？</label><input id="draw-guess-input" class="field" placeholder="単語を入力" maxlength="60"><div class="btns">${moreAct('この答えで勝負','sendDrawGuess()','gold')}</div>`:'<div class="info">エセ芸術家が絵のお題を予想しています。</div>'));
 if(room.phase==='draw_reveal')return moreTitle('REVEAL / 結果発表',p.last.caught?'エセ芸術家を発見！':'エセ芸術家の勝ち！',role+board+`<div class="more-reveal"><span>${esc(p.last.word)}</span><small>エセ役：${esc(p.last.fakeName)}さん ${p.last.guessed?'・逆転正解！':''}</small></div>${moreScores()}<div class="btns">${moreNext()}</div>`);
}
function sendDrawGuess(){const s=document.getElementById('draw-guess-input')?.value?.trim();if(!s)return error('予想を入力してください');send({type:'draw_guess',text:s})}
function renderMysteryMail(){const p=room.more,owner=room.owner===me;
 const heading=`<div class="more-hero"><b>📧 ${esc(p.caseTitle)}</b><small>${esc(p.intro)}</small></div><div class="mail-progress">${Array.from({length:p.stepCount},(_,i)=>`<div class="${i<p.step?'done':i===p.step?'active':''}">${i<p.step?'✓':i+1}</div>`).join('')}</div>`;
 if(room.phase==='mail_stage')return moreTitle('INBOX / メールの謎を解こう',`STEP ${p.step+1}：${esc(p.stepTitle)}`,heading+`<div class="mail-inbox">${p.messages.map(x=>`<article class="mail-message"><small>差出人：${esc(x.sender)}</small><h3>${esc(x.subject)}</h3><p>${esc(x.text)}</p></article>`).join('')}</div><div class="more-question"><b>${esc(p.question)}</b></div><label class="labeled" for="mail-code">解答する</label><input id="mail-code" class="field" value="${esc(moreMailDraft)}" maxlength="70" placeholder="答えを入力" oninput="moreMailDraft=this.value"><div class="btns">${moreAct('この答えで確認','submitMail()','gold')}${owner?moreAct('ヒントを公開','send({type:"mail_hint"})','alt'):''}</div>${p.hints.map((x,i)=>`<div class="info">💡 ヒント${i+1}：${esc(x)}</div>`).join('')}<div class="more-list">${p.attempts.filter(x=>!x.correct).map(x=>`<p>${esc(x.name)}：${esc(x.text)} → ちがいます</p>`).join('')}</div>${moreScores()}`);
 if(room.phase==='mail_reveal')return moreTitle('CLEAR / 解決','メールの謎を解いた！',heading+`<div class="more-reveal"><span>事件解決 🎉</span><small>すべての鍵を開けられました</small></div>${moreScores()}<div class="btns">${moreNext()}</div>`);
}
function submitMail(){const s=(document.getElementById('mail-code')?.value||moreMailDraft).trim();if(!s)return error('答えを入力してください');moreMailDraft='';send({type:'mail_answer',text:s})}
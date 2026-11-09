'use strict';
const DRAW_GAMES=['artguide','drawrelay'];
let drawState={key:'',strokes:[],color:'#4c375e'};
const drawColors=['#4c375e','#ed448f','#397caf','#43a06e','#e89b38','#755dd4','#202020'];
const drawName=id=>room.players.find(x=>x.id===id)?.name||'参加者';
const drawButton=(text,fn,kind='')=>action(text,fn,kind);
function drawPanel(title,body){app.innerHTML=panel('DRAWING PARTY / '+GAMES[room.game].title,title,roomBar()+body+'<p id="err" class="error" hidden></p>')}
function drawKey(){let d=room.draw;return [room.code,room.matchNo,room.game,d.round||0,d.stage||0,me].join(':')}
function drawData(){let k=drawKey();if(drawState.key!==k)drawState={key:k,strokes:[],color:'#4c375e'};return drawState}
function drawPicture(lines){return '<svg viewBox="0 0 720 440" class="dp-picture" role="img" aria-label="描かれたイラスト"><rect x="0" y="0" width="720" height="440" fill="#fff"/>'+NKMBrush.ordered(lines||[]).map(s=>{if(!/^#[0-9a-f]{6}$/i.test(s.c))return '';const pts=(s.p||[]).map(p=>[+(p[0]*720).toFixed(1),+(p[1]*440).toFixed(1)]);if(!pts.length)return '';return pts.length===1?'<circle cx="'+pts[0][0]+'" cy="'+pts[0][1]+'" r="'+(s.w/2)+'" fill="'+s.c+'" fill-opacity="'+(s.a??1)+'"/>':'<polyline fill="none" stroke="'+s.c+'" stroke-width="'+s.w+'" stroke-opacity="'+(s.a??1)+'" stroke-linecap="round" stroke-linejoin="round" points="'+pts.map(x=>x.join(',')).join(' ')+'"/>'}).join('')+'</svg>'}
function drawCanvasHTML(){const d=drawData();return '<div class="dp-tools"><b>🎨 絵を描こう</b>'+drawColors.map(c=>'<button type="button" title="'+c+'" class="dp-color '+(d.color===c?'active':'')+'" style="background:'+c+'" onclick="drawSetColor(\''+c+'\')"></button>').join('')+drawButton('1本戻す','drawUndo()','alt')+drawButton('全消去','drawClear()','alt')+'</div>'+NKMBrush.panel(d,'draw')+'<canvas id="dp-canvas" width="720" height="440" class="dp-canvas" aria-label="指やマウスで描くキャンバス"></canvas><p class="small">タッチ・マウス・ペンで描けます。絵は提出するまで公開されません。</p>'}
function drawBind(){const el=document.getElementById('dp-canvas');if(!el)return;const ctx=el.getContext('2d'),d=drawData();if(!ctx)return;function paint(){ctx.fillStyle='white';ctx.fillRect(0,0,720,440);for(const s of NKMBrush.ordered(d.strokes,d)){if(!s.p.length)continue;ctx.globalAlpha=s.a??1;ctx.strokeStyle=s.c;ctx.fillStyle=s.c;ctx.lineWidth=s.w;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();s.p.forEach(([x,y],i)=>i?ctx.lineTo(x*720,y*440):ctx.moveTo(x*720,y*440));if(s.p.length===1){ctx.arc(s.p[0][0]*720,s.p[0][1]*440,s.w/2,0,Math.PI*2);ctx.fill()}else ctx.stroke()}ctx.globalAlpha=1}
 d.repaint=paint;
 let down=false;const pt=e=>{const r=el.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(x=>+x.toFixed(4))};
 el.addEventListener('pointerdown',e=>{e.preventDefault();if(d.tool==='picker'){NKMBrush.interact(d,ctx,pt(e));return}if(d.tool==='eraser'){down=true;try{el.setPointerCapture(e.pointerId)}catch(_){}NKMBrush.interact(d,ctx,pt(e));return}if(d.strokes.length>=90)return error('線の本数は90本までです');down=true;try{el.setPointerCapture(e.pointerId)}catch(_){}d.strokes.push(NKMBrush.newStroke(d,pt(e)));paint()});
 el.addEventListener('pointermove',e=>{if(!down)return;e.preventDefault();if(d.tool==='eraser'){NKMBrush.interact(d,ctx,pt(e));return}const s=d.strokes.at(-1),x=pt(e);if(!s||s.p.length>=90||d.strokes.reduce((a,v)=>a+v.p.length,0)>=2500)return;const last=s.p.at(-1);if(Math.abs(x[0]-last[0])+Math.abs(x[1]-last[1])>.003){s.p.push(x);paint()}});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,()=>{down=false});paint();NKMBrush.bindPinch(el,d,()=>{down=false})}
function drawSetColor(c){if(drawColors.includes(c)){drawData().color=c;render()}}
function drawUndo(){NKMBrush.undo(drawData());render()}
function drawClear(){if(drawData().strokes.length&&!confirm('描いた絵を全部消しますか？'))return;drawData().strokes=[];render()}
function drawSendPicture(type){let s=NKMBrush.exportStrokes(drawData());if(!s.length)return error('まず絵を描いてください');send({type,strokes:s})}
function drawSendHints(){const h=[0,1,2].map(i=>document.getElementById('dp-h'+i)?.value?.trim()).filter(Boolean);if(h.length<2)return error('2つ以上のヒントが必要です');send({type:'art_hints',hints:h})}
function drawSetTarget(){let topic=document.getElementById('dp-topic')?.value.trim(),target=document.getElementById('dp-target')?.value.trim();if(!topic||!target)return error('テーマと秘密のお題を入力してください');send({type:'art_target',topic,target})}
function drawText(type){const text=document.getElementById('dp-text')?.value.trim();if(!text||text.length<2)return error('2文字以上の文章を入力してください');send({type,text})}
function drawGallery(picks,allowPick){return '<div class="dp-gallery">'+(picks||[]).map(x=>'<article class="dp-art">'+drawPicture(x.strokes)+'<b>'+esc(x.name)+'</b>'+(allowPick?drawButton('この絵を選ぶ','send({type:"art_pick",winner:'+JSON.stringify(x.id)+'})','gold'):'')+'</article>').join('')+'</div>'}
function drawScores(){return '<div class="dp-scores">'+[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>'<div>'+(i+1)+'位 '+esc(p.name)+' <strong>'+p.score+'pt</strong></div>').join('')+'</div>'}
function drawGuide(){
 const p=room.draw,guide=p.guide===me,host=room.owner===me;
 const top='<div class="dp-info"><b>ラウンド '+(p.round+1)+' / '+p.roundLimit+'</b><span>今回の出題者：'+esc(drawName(p.guide))+'</span></div><div class="dp-note">公表テーマ：<b>'+esc(p.topic)+'</b><p>出題者だけが秘密の完成イメージを知っています。</p></div>';
 if(room.phase==='art_hint'){
  if(!guide)return drawPanel('出題者が準備中',top+'<div class="dp-note">🔒 ヒントが届くまで待ちましょう。</div>');
  let html='<div class="dp-secret">🔒 あなただけの完成イメージ：<h3>'+esc(p.target)+'</h3><p>直接答えを言わず、友達に自然と描かせましょう。</p><div class="dp-fields"><input id="dp-topic" class="field" value="'+esc(p.topic)+'" maxlength="36" placeholder="公開テーマ"><input id="dp-target" class="field" value="'+esc(p.target)+'" maxlength="60" placeholder="秘密の完成イメージ"></div>'+drawButton('自分のお題に変更する','drawSetTarget()','alt')+'</div>';
  html+=[0,1,2].map(i=>'<label class="labeled">遠回しのヒント '+(i+1)+(i===2?'（任意）':'')+'</label><input id="dp-h'+i+'" class="field dp-field" maxlength="48" placeholder="例：なんだかえらそう">').join('');
  drawPanel('友達の絵を誘導するヒントを作ろう',top+html+'<div class="btns">'+drawButton('ヒントを公開','drawSendHints()','gold')+'</div>');return;
 }
 if(room.phase==='art_draw'){
  const hints='<div class="dp-hints">'+p.hints.map((h,i)=>'<div>ヒント'+(i+1)+'：'+esc(h)+'</div>').join('')+'</div>';
  if(guide)return drawPanel('お絵描きが完成するまで待とう',top+'<p class="dp-secret">🔒 正解：'+esc(p.target)+'</p>'+hints+'<p>提出 '+p.submittedCount+'/'+p.needed+'人</p>'+(host&&p.submittedCount?drawButton('今ある絵で審査へ','send({type:"art_force"})','alt'):''));
  if(p.submitted)return drawPanel('提出しました',top+hints+'<div class="dp-note">✅ 絵を提出済み：'+p.submittedCount+'/'+p.needed+'人</div>');
  drawPanel('ヒントを見て自由に描こう',top+hints+drawCanvasHTML()+'<div class="btns">'+drawButton('絵を提出する','drawSendPicture("art_submit")','gold')+'</div>');drawBind();return;
 }
 if(room.phase==='art_pick')return drawPanel('出題者がベスト作品を選ぶ',top+(guide?'<div class="dp-secret">🔒 描いてほしかったもの：<b>'+esc(p.target)+'</b></div>':'<div class="dp-note">出題者が作品を選んでいます。</div>')+drawGallery(p.pictures,guide));
 const last=room.phase==='final'?p.history:[p.last].filter(Boolean);
 return drawPanel(room.phase==='final'?'最終結果':'答え合わせ',drawScores()+last.map(r=>'<details class="dp-history" '+(room.phase==='final'?'':'open')+'><summary>第'+r.round+'回：'+esc(r.target)+'　🏆'+esc(r.winnerName)+'</summary><p>ヒント：'+r.hints.map(esc).join('・')+'</p>'+drawGallery(r.pictures,false)+'</details>').join('')+'<div class="btns">'+(room.phase==='final'?(host?drawButton('もう一度遊ぶ','send({type:"restart"})','gold'):'')+drawButton('タイトルに戻る','leaveToTitle()','alt'):host?drawButton('次の出題者へ','send({type:"art_next"})','gold'):'')+'</div>');
}
function drawRelay(){
 const p=room.draw,host=room.owner===me;
 const intro='<div class="dp-info"><b>お絵描き伝言</b><span>ステップ '+p.stage+' / '+p.stepLimit+'</span></div><div class="dp-note">文章と絵を交互に受け渡します。今見えている内容だけを参考にしてください。</div>';
 if(room.phase==='relay_reveal'||room.phase==='final'){
  const rows=p.chains.map(ch=>'<details class="dp-history" '+(room.phase==='final'?'':'open')+'><summary>'+esc(ch.ownerName)+'さんから始まった伝言</summary><div class="dp-gallery">'+ch.steps.map((s,i)=>'<article class="dp-art"><b>'+(i+1)+'．'+esc(s.name)+'（'+(s.kind==='text'?'文章':'イラスト')+'）</b>'+(s.kind==='text'?'<p class="dp-text">'+esc(s.text)+'</p>':drawPicture(s.strokes))+'</article>').join('')+'</div></details>').join('');
  return drawPanel('最初と最後を見比べよう',intro+rows+'<div class="btns">'+(room.phase==='final'?(host?drawButton('もう一度遊ぶ','send({type:"restart"})','gold'):'')+drawButton('タイトルへ戻る','leaveToTitle()','alt'):host?drawButton('最終結果へ','send({type:"relay_next"})','gold'):'')+'</div>');
 }
 if(p.submitted)return drawPanel('次の人を待っています',intro+'<p class="dp-note">✅ 提出しました　'+p.submittedCount+'/'+p.needed+'人</p>');
 if(room.phase==='relay_seed')return drawPanel('次の人に描いてほしいお題を書く',intro+'<textarea class="field dp-textarea" id="dp-text" maxlength="70" placeholder="例：宇宙を飛ぶ焼きそばパン"></textarea><div class="btns">'+drawButton('お題を渡す','drawText("relay_seed")','gold')+'</div>');
 if(room.phase==='relay_caption')return drawPanel('絵を言葉にして渡そう',intro+drawPicture(p.prompt?.strokes)+'<textarea id="dp-text" class="field dp-textarea" maxlength="70" placeholder="何の絵に見える？"></textarea><div class="btns">'+drawButton('文章を渡す','drawText("relay_caption")','gold')+'</div>');
 if(room.phase==='relay_draw'){drawPanel('文章を絵にして渡そう',intro+'<div class="dp-target">'+esc(p.prompt?.text||'')+'</div>'+drawCanvasHTML()+'<div class="btns">'+drawButton('この絵を渡す','drawSendPicture("relay_draw")','gold')+'</div>');drawBind()}
}
function renderDraw(){if(!room||!DRAW_GAMES.includes(room.game))return;if(room.game==='artguide')return drawGuide();return drawRelay()}

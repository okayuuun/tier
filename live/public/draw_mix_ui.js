'use strict';
/* Drawing party controls for mix, collaboration, and reverse guessing. */
const DRAW_MIX_GAMES=['artmix','artcollab','reverseart'];
let mixSketch={key:'',strokes:[],color:'#4c375e',size:5},mixDraftText='';
function mixBtn(s,fn,style){return action(s,fn,style||'')}
function mixPage(title,inner){app.innerHTML=panel('DRAW LAB / '+GAMES[room.game].title,title,roomBar()+inner+'<p id="err" class="error" hidden></p>')}
function mixData(){let d=room.drawmix,k=[room.code,room.matchNo,room.game,d.round,room.phase,me].join(':');if(mixSketch.key!==k)mixSketch={key:k,strokes:[],color:'#4c375e',size:5};return mixSketch}
function mixProgress(d,label){return '<div class="mx-progress"><b>ROUND '+(d.round+1)+' / '+d.roundLimit+'</b><span>'+esc(label||'')+'</span></div>'}
function mixDrawLine(ctx,s){let a=s.p||[];if(!a.length)return;ctx.lineWidth=s.w;ctx.globalAlpha=s.a??1;ctx.strokeStyle=s.c;ctx.fillStyle=s.c;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();a.forEach((p,i)=>{if(i)ctx.lineTo(p[0]*720,p[1]*440);else ctx.moveTo(p[0]*720,p[1]*440)});if(a.length===1){ctx.arc(a[0][0]*720,a[0][1]*440,s.w/2,0,Math.PI*2);ctx.fill()}else ctx.stroke();ctx.globalAlpha=1}
function mixPad(){let d=mixData(),t='<div class="mx-pens">';drawColors.forEach(c=>{t+='<button class="dp-color '+(d.color===c?'active':'')+'" style="background:'+c+'" title="'+c+'" onclick="mixColor(\''+c+'\')"></button>'});t+=' <span>ペンの太さ</span>';[2,5,9].forEach(n=>{t+='<button class="mx-size '+(d.size===n?'on':'')+'" onclick="mixSize('+n+')">'+n+'</button>'});t+=mixBtn('1本戻す','mixUndo()','alt')+mixBtn('自分の線を消去','mixClear()','alt');return t+'</div>'+NKMBrush.panel(d,'mix')+'<canvas id="mix-canvas" class="dp-canvas" width="720" height="440"></canvas><p class="small">指・マウス・ペンで描画できます。提出するまでは描き直せます。</p>'}
function mixBind(base){const el=document.getElementById('mix-canvas');if(!el)return;let ctx=el.getContext('2d'),d=mixData();if(!ctx)return;let prev=base||[];
 function paint(){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,720,440);for(const s of NKMBrush.ordered(prev))mixDrawLine(ctx,s);for(const s of NKMBrush.ordered(d.strokes,d))mixDrawLine(ctx,s)}
 const pt=e=>{let r=el.getBoundingClientRect();return [+(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))).toFixed(4),+(Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))).toFixed(4)]};
 let pointer=null;
 el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();const point=pt(e);if(d.tool==='eraser'){NKMBrush.eraseAt(d,point);paint();return}if(d.tool==='picker'){NKMBrush.pickColor(d,el,point);return}if(d.strokes.length>=85)return error('線は85本までです');pointer=e.pointerId;try{el.setPointerCapture(pointer)}catch(_e){}d.strokes.push(NKMBrush.newStroke(d,pt(e)));paint()});
 el.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;e.preventDefault();let s=d.strokes.at(-1),xy=pt(e);if(!s||s.p.length>=85||d.strokes.reduce((k,v)=>k+v.p.length,0)>2400)return;let last=s.p.at(-1);if(Math.abs(last[0]-xy[0])+Math.abs(last[1]-xy[1])>.003){s.p.push(xy);paint()}});
 ['pointerup','pointercancel','lostpointercapture'].forEach(k=>el.addEventListener(k,e=>{if(pointer===e.pointerId)pointer=null}));d.repaint=paint;d.canvas=el;paint()}
function mixColor(c){if(!drawColors.includes(c))return;mixData().color=c;render()}
function mixSize(n){if(![2,5,9].includes(n))return;mixData().size=n;render()}
function mixUndo(){NKMBrush.undo(mixData());render()}
function mixClear(){if(mixData().strokes.length&&!confirm('自分が描いた線を全部消しますか？'))return;mixData().strokes=[];render()}
function mixSendPicture(type){const strokes=NKMBrush.exportStrokes(mixData());if(!strokes.length)return error('まず絵を描いてください');send({type,strokes})}
function mixInput(type,id,min){let v=(document.getElementById(id)?.value||'').trim();mixDraftText=v;if(v.length<(min||2))return error('入力が短すぎます');send({type,text:v})}
function mixScores(){return '<div class="mx-scores">'+[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>'<div><span>'+(i+1)+'位 '+esc(p.name)+'</span><b>'+p.score+'pt</b></div>').join('')+'</div>'}
function mixArtwork(strokes){return drawPicture(strokes||[])}
function mixResult(){let d=room.drawmix,final=room.phase==='final',host=room.owner===me;
 let result=mixScores(),records=final?d.history:(d.last?[d.last]:[]);
 for(const r of records){result+='<details class="mx-review" '+(final?'':'open')+'><summary>ROUND '+r.round+'　作品と結果を見る</summary>';
 if(room.game==='artmix'){result+='<div class="mx-gallery">'+r.entries.map(x=>'<div class="mx-card"><b>絵：'+esc(x.artistName)+' / セリフ：'+esc(x.writerName)+'</b>'+mixArtwork(x.strokes)+'<p class="mx-quote">'+esc(x.caption)+'</p><small>'+x.votes+'票 '+(r.winners.includes(x.key)?'🏆 最多得票':'')+'</small></div>').join('')+'</div>';}
 if(room.game==='artcollab'){result+='<h3>'+esc(r.topic)+'</h3>'+mixArtwork(r.strokes)+'<div class="mx-notes">'+r.contributions.map(x=>'<div><b>'+esc(x.name)+'</b>：'+esc(x.mission)+'（'+x.count+'本）</div>').join('')+'</div>';}
 if(room.game==='reverseart'){result+='<h3>'+esc(r.artistName)+'さんの絵</h3>'+mixArtwork(r.strokes)+'<div class="mx-note">正解：<b>'+esc(r.target)+'</b>　回答：<b>'+esc(r.guess)+'</b> '+(r.accepted?'✅ 正解':'❌ 不正解')+'</div><div class="mx-notes">'+r.hints.map(x=>'<div>'+esc(x.name)+'：'+esc(x.text)+'</div>').join('')+'</div>';}
 result+='</details>';}
 let next={artmix:'mx_next',artcollab:'co_next',reverseart:'rv_next'}[room.game];
 result+='<div class="btns">'+(final?(host?mixBtn('もう一度遊ぶ','send({type:"restart"})','gold'):'')+mixBtn('タイトルに戻る','leaveToTitle()','alt'):(host?mixBtn(d.round+1>=d.roundLimit?'最終結果へ':'次のラウンドへ','send({type:"'+next+'"})','gold'):'') )+'</div>';
 mixPage(final?'最終結果':'作品発表・答え合わせ',result)}
function renderArtMix(){let d=room.drawmix,p=room.phase,host=room.owner===me;
 let top=mixProgress(d,'絵を描く → セリフを書く → ランダム合体 → 投票');
 if(p==='mx_draw'){if(d.submitted)return mixPage('提出完了',top+'<div class="mx-note">✅ 絵を提出しました。'+d.submittedCount+'/'+d.needed+'人</div>');
 mixPage('あなたのお題を描こう',top+'<div class="mx-secret">あなただけのお題 <b>'+esc(d.myPrompt)+'</b></div>'+mixPad()+mixBtn('絵を提出','mixSendPicture("mx_draw")','gold'));mixBind();return;}
 if(p==='mx_caption'){if(d.submitted)return mixPage('セリフ提出完了',top+'<div class="mx-note">✅ セリフを提出しました。'+d.submittedCount+'/'+d.needed+'人</div>');
 mixPage('なんにでも合いそうなセリフを書こう',top+'<div class="mx-note">セリフはあなた以外の誰かの絵と組み合わされます。</div><textarea class="field mx-textarea" id="mx-caption" maxlength="70" placeholder="たとえば：そんなはずじゃなかった！"></textarea>'+mixBtn('セリフを提出','mixInput("mx_caption","mx-caption",2)','gold'));return;}
 if(p==='mx_vote'){let cards='<div class="mx-gallery">'+d.combos.map((x,i)=>'<div class="mx-card"><b>組み合わせ '+(i+1)+'</b>'+mixArtwork(x.strokes)+'<p class="mx-quote">'+esc(x.caption)+'</p>'+(x.mine?'<small>この作品には投票できません</small>':d.myVote?'<small>投票済み</small>':mixBtn('この作品に投票','send({type:"mx_vote",key:"'+x.key+'"})','gold'))+'</div>').join('')+'</div>';
 return mixPage('いちばん好きな組み合わせは？',top+cards+'<div class="mx-note">投票 '+d.votesCount+'/'+d.needed+'人</div>'+(host&&d.votesCount?mixBtn('今の票で集計','send({type:"mx_force"})','alt'):''));}
 return mixResult()}
function renderArtCollab(){let d=room.drawmix,host=room.owner===me,turn=d.turn===me;
 if(room.phase!=='co_turn')return mixResult();
 let top=mixProgress(d,'一枚の絵に順番に描き足していこう');
 top+='<div class="mx-secret">お題 <b>'+esc(d.topic)+'</b></div><div class="mx-note">今の手番：<b>'+esc(d.turnName)+'</b>　'+(d.turnCount+1)+'/'+d.needed+'番目</div>';
 if(host&&!d.turnCount)top+='<div class="mx-edit"><input class="field" id="co-topic" maxlength="65" placeholder="好きなお題に変更"><button class="btn alt" onclick="mixChangeTopic()">お題を変更</button></div>';
 if(turn){mixPage('前の人の絵に描き足そう',top+'<div class="mx-mission">🔒 自分だけの秘密ミッション <b>'+esc(d.myMission)+'</b></div>'+mixPad()+'<p class="small">1手番で描けるのは12本まで。ほかの人の線は消せません。</p>'+mixBtn('描き足して次へ','mixSendPicture("co_submit")','gold'));mixBind(d.canvas);return;}
 mixPage('描き足しを待っています',top+mixArtwork(d.canvas)+(host?mixBtn('今の手番をスキップ','send({type:"co_skip"})','alt'):''))}
function mixChangeTopic(){let topic=(document.getElementById('co-topic')?.value||'').trim();if(topic.length<2)return error('お題を入力してください');send({type:'co_topic',topic})}
function renderReverseArt(){let d=room.drawmix,p=room.phase,artist=d.artist===me,host=room.owner===me;
 let top=mixProgress(d,'絵描き役：'+d.artistName);
 if(p==='rv_hint'){
 if(artist)return mixPage('ヒントを待とう',top+'<div class="mx-note">🔒 自分だけが正解を知りません。ほかの人のヒントを待っています。　'+d.hintsCount+'/'+d.needed+'人</div>');
 if(d.hinted)return mixPage('ヒント提出済み',top+'<div class="mx-secret">正解：'+esc(d.target)+'</div><div class="mx-note">✅ 提出しました。'+d.hintsCount+'/'+d.needed+'人</div>');
 return mixPage('答えを直接言わずにヒントを出そう',top+'<div class="mx-secret">あなただけに見える正解 <b>'+esc(d.target)+'</b></div><textarea class="field mx-textarea" id="rv-hint" maxlength="65" placeholder="例：丸い形がいくつか重なるもの"></textarea>'+mixBtn('ヒントを提出','mixInput("rv_hint","rv-hint",2)','gold'));}
 if(p==='rv_draw'){
 let hints='<div class="mx-notes">'+d.hints.map((x,i)=>'<div>ヒント '+(i+1)+'：'+esc(x.text)+'</div>').join('')+'</div>';
 if(!artist)return mixPage('絵描き役が絵を描いています',top+'<div class="mx-secret">正解：'+esc(d.target)+'</div>'+hints);
 mixPage('ヒントだけで描いてみよう',top+hints+mixPad()+mixBtn('絵が完成！','mixSendPicture("rv_draw")','gold'));mixBind();return;}
 if(p==='rv_guess'){
 if(!artist)return mixPage('絵描き役が推理中',top+'<div class="mx-secret">正解：'+esc(d.target)+'</div>'+mixArtwork(d.drawing));
 return mixPage('自分の絵は何の絵？',top+mixArtwork(d.drawing)+'<div class="mx-notes">'+d.hints.map(x=>'<div>'+esc(x.text)+'</div>').join('')+'</div><input class="field" id="rv-answer" maxlength="65" placeholder="推理した答え">'+mixBtn('答えを提出','mixInput("rv_guess","rv-answer",1)','gold'));}
 if(p==='rv_judge'){
 let base=top+mixArtwork(d.drawing)+'<div class="mx-note">絵描き役の答え：<b>'+esc(d.guess)+'</b></div>';
 if(artist)return mixPage('友達が判定中',base+'<div class="mx-note">🔒 正解の発表を待とう。判定 '+d.votedCount+'/'+d.needed+'人</div>');
 return mixPage('近い答えなら正解として認めよう',base+'<div class="mx-secret">本当の正解 <b>'+esc(d.target)+'</b></div>'+(d.voted?'<div class="mx-note">✅ 判定済み</div>':mixBtn('正解として認める','send({type:"rv_judge",accept:true})','gold')+mixBtn('不正解','send({type:"rv_judge",accept:false})','alt'))+'<div class="mx-note">判定 '+d.votedCount+'/'+d.needed+'人</div>'+(host&&d.votedCount?mixBtn('ここまでで判定','send({type:"rv_force"})','alt'):''));}
 return mixResult()}
function renderDrawMix(){if(!room||!DRAW_MIX_GAMES.includes(room.game))return;if(room.phase==='final'||['mx_reveal','co_reveal','rv_reveal'].includes(room.phase))return mixResult();if(room.game==='artmix')return renderArtMix();if(room.game==='artcollab')return renderArtCollab();return renderReverseArt()}

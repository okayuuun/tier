
'use strict';
const WORD_GAMES=['senryu','tanka','booktitle'];
let wordDraft={key:'',lines:[],selected:0,top:null,bottom:null};
const wButton=(s,fn,k='')=>action(s,fn,k);
function wordLobbyPanel(){
 if(!WORD_GAMES.includes(room?.game))return '';
 return `<section class="w-panel"><h3>🃏 自由なカード組み合わせ</h3><p>配られた5音・7音のカードを、各自が好きな枚数・順番で並べます。5・7・5などの型をホストが指定する必要はありません。</p><p class="small">公式カード全文の収録ではありません。自分の所有するカードの言葉は下のマイカード機能から登録できます。</p></section>${wordDeckEditor()}`;
}
function wordDeckEditor(){
 const book=room.game==='booktitle',types=book?['bookTop','bookBottom']:['five','seven'],labels=book?['タイトル前半','タイトル後半']:['5音の言葉','7音の言葉'];
 let saved={};try{saved=JSON.parse(localStorage.getItem('nk_word_bank_'+room.game)||'{}')}catch(_){}
 const host=room.owner===me;
 return `<details class="w-panel"><summary style="cursor:pointer;font-weight:900;color:#9d3171">🗃️ マイカードを登録して遊ぶ ${room.wordDeckLoaded?'（登録済み）':''}</summary><p class="small">元のカードで遊ぶ場合は、手元の言葉を改行区切りで入力。2〜200語／種類。自分のブラウザに保存されます。</p>${types.map((t,i)=>`<label class="labeled" for="w-deck-${t}">${labels[i]}</label><textarea id="w-deck-${t}" class="field" rows="5" placeholder="1行に1つずつ">${esc((saved[t]||[]).join('\n'))}</textarea>`).join('')}<div class="btns">${host?'<button class="btn gold" onclick="wordDeckImport()">この言葉で遊ぶ</button>':'<p class="small">ホストだけがカードを登録できます。</p>'}</div></details>`;
}
function wordDeckImport(){
 if(room.owner!==me)return;
 const fields=room.game==='booktitle'?['bookTop','bookBottom']:['five','seven'],deck={};
 for(const key of fields){
  const text=document.getElementById('w-deck-'+key)?.value||'';
  const list=[...new Set(text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
  if(list.length<2||list.length>200||list.some(x=>x.length>35))return alert('各種類に2〜200語、1語35文字以内で登録してください');
  deck[key]=list;
 }
 try{localStorage.setItem('nk_word_bank_'+room.game,JSON.stringify(deck))}catch(_){}
 send({type:'word_deck',deck});
}

function wordSetFormat(f){send({type:'word_format',format:f})}
function wordCustom(){const f=(document.getElementById('w-custom')?.value||'').trim();if(!/^[57]{2,6}$/.test(f))return alert('5と7を2〜6個並べてください');wordSetFormat(f)}
function wState(){const p=room.word,k=[room.code,room.matchNo,p.round,room.game].join(':');if(wordDraft.key!==k)wordDraft={key:k,lines:[],selected:0,top:null,bottom:null};return wordDraft}
function wPanel(title,body){app.innerHTML=panel('WORD PARTY / '+GAMES[room.game].title,title,roomBar()+body+'<p id="err" class="error" hidden></p>')}
function wPoem(lines){return '<div class="w-poem">'+lines.map(x=>`<div>${esc(x||'・・・・')}</div>`).join('')+'</div>'}
function wPickSlot(i){wState().selected=i;render()}
function wUse(kind,s){const d=wState();if(d.lines.length>=12)return error('1作品12枚までです');if(d.lines.some(x=>!x.free&&x.kind===kind&&x.text===s))return error('同じ手札カードは2回使えません');d.lines.push({text:s,kind,free:false});render()}
function wCustomWord(){const s=(document.getElementById('w-free')?.value||'').trim();if(!s||s.length>35)return error('自由入力は1〜35文字です');if(wState().lines.length>=12)return error('12枚まで使えます');wState().lines.push({text:s,kind:'free',free:true});render()}
function wClear(i){const d=wState();d.lines[i]=null;d.selected=i;render()}
function wHalf(which,text){wState()[which]={text,free:false};render()}
function wHalfFree(which){const s=(document.getElementById('w-'+which)?.value||'').trim();if(!s||s.length>35)return alert('1〜35文字で入力してください');wState()[which]={text:s,free:true};render()}
function wSubmit(){const d=wState();if(room.game==='booktitle'){if(!d.top||!d.bottom)return error('タイトルの前半と後半を選んでください');send({type:'word_submit',top:d.top,bottom:d.bottom})}else{if(d.lines.length<2)return error('2枚以上の句を好きな順に選んでください');send({type:'word_submit',lines:d.lines})}}
function wIntro(p){return `<div class="w-progress"><b>ROUND ${p.round+1} / ${p.roundLimit}</b><div class="w-bar"><i style="width:${Math.round(100*p.submittedCount/Math.max(1,p.toSubmit))}%"></i></div><span>提出 ${p.submittedCount}/${p.toSubmit}</span></div>`}
function wCompose(){
 const p=room.word,d=wState(),judge=p.judge===me,host=room.owner===me;
 if(judge)return wPanel('今回は審査役です',wIntro(p)+`<div class="w-note">👑 みんなの作品を待っています。匿名で発表された作品から一番好きなものを選んでください。</div>${p.submittedCount?wButton('集まった句を発表','send({type:"word_show"})','gold'):''}`);
 if(p.submitted)return wPanel('提出しました',wIntro(p)+'<div class="w-note">✅ 提出完了！ ほかの人を待っています。</div>');
 if(room.game==='booktitle'){
  const half=(type,label)=>`<section class="w-half"><h3>${label}</h3><div class="w-chips">${(p.hand[type]||[]).map(s=>`<button class="w-chip ${d[type]?.text===s?'chosen':''}" onclick="wHalf('${type}',${JSON.stringify(s).replaceAll('"','&quot;')})">${esc(s)}</button>`).join('')}</div><div class="w-inline"><input class="field" maxlength="35" id="w-${type}" placeholder="自由入力（${label}）"><button class="btn alt" onclick="wHalfFree('${type}')">自由入力</button></div></section>`;
  return wPanel('面白いタイトルを考えよう',wIntro(p)+`<div class="w-book"><small>今のタイトル</small><h2>${esc(d.top?.text||'（前半）')}${esc(d.bottom?.text||'（後半）')}</h2></div>${half('top','前半')}${half('bottom','後半')}<div class="btns">${wButton('タイトルを提出 →','wSubmit()','gold')}</div>`);
 }
 const rows=d.lines.map((line,i)=>`<div class="w-free-row"><span>${i+1}</span><b>${esc(line.text)}</b><small>${line.free?'自作':line.kind+'音'}</small><div><button type="button" ${i===0?'disabled':''} onclick="wMove(${i},-1)" aria-label="上へ">↑</button><button type="button" ${i===d.lines.length-1?'disabled':''} onclick="wMove(${i},1)" aria-label="下へ">↓</button><button type="button" onclick="wRemove(${i})" aria-label="削除">×</button></div></div>`).join('')||'<p class="w-note">下のカードを自由な順番で押してください</p>';
 const hand=['5','7'].map(kind=>`<h3>${kind}音カード（${(p.hand[kind]||[]).length}枚）</h3><div class="w-chips">${(p.hand[kind]||[]).map(s=>`<button type="button" class="w-chip ${d.lines.some(x=>!x.free&&x.text===s&&x.kind===kind)?'chosen':''}" onclick="wUse('${kind}',${JSON.stringify(s).replaceAll('"','&quot;')})">${esc(s)}</button>`).join('')}</div>`).join('');
 const prompt=p.prompt?`<div class="w-note">🎭 お題のヒント：<b>${esc(p.prompt)}</b><br><small>このお題を使っても、無視してふざけてもOK！</small></div>`:'';
 return wPanel('手札から好きなように並べよう',wIntro(p)+prompt+'<div class="w-note">✨ 5・7・5の形式指定はありません。好きな句を2〜12枚使って自由に並べられます。</div>'+`<div class="w-preview"><small>作成中（${d.lines.length}枚）</small>${wPoem(d.lines.map(x=>x.text))}</div><div class="w-free-list">${rows}</div>`+hand+`<div class="w-inline"><input id="w-free" class="field" maxlength="35" placeholder="自由な言葉を追加"><button class="btn alt" onclick="wCustomWord()">追加</button></div><div class="btns">${wButton('全部消す','wClearAll()','alt')}${wButton('この作品を提出 →','wSubmit()','gold')}</div>`);
}
function wEntries(){
 const p=room.word,judge=p.judge===me,voteMode=room.game!=='senryu',host=room.owner===me;
 const rows=p.entries.map((e,j)=>`<article class="w-entry"><b>作品 ${j+1}${voteMode&&e.id===me?'（自分）':''}</b>${wPoem((e.text||'').split('\n'))}${voteMode?(p.myVote?'<small>投票済み</small>':e.id===me?'<small>自分には投票できません</small>':wButton('この作品に投票','send({type:"word_vote",target:'+JSON.stringify(e.id)+'})')):judge?wButton('この句を採用','send({type:"word_pick",target:'+JSON.stringify(e.id)+'})','gold'):'<small>親の発表を待っています</small>'}</article>`).join('');
 return wPanel(voteMode?'みんなで投票しよう':'親が一番好きな句を選ぶ',`<div class="w-note">${voteMode?'他人の作品を1つ選ぼう。':'作者名を隠して発表しています。'}</div><div class="w-entries">${rows}</div>${voteMode?`<div class="w-note">投票状況：${p.voteCount} / ${room.players.length}人</div>`:''}${voteMode&&host&&p.voteCount?wButton('今の票数で集計','send({type:"word_force"})','alt'):''}`);
}
function wResult(final){
 const p=room.word,host=room.owner===me,rank=[...room.players].sort((a,b)=>b.score-a.score),rows=final?p.history:[p.last].filter(Boolean);
 let body=`<div class="w-score">${rank.map((x,i)=>`<div><strong>${i+1}位 ${esc(x.name)}</strong><b>${x.score} pt</b></div>`).join('')}</div>`;
 for(const r of rows){const winners=r.type==='booktitle'?r.winners:[r.winner];body+=`<details open class="w-review"><summary>ROUND ${r.round}｜採用作品</summary><div class="w-entries">${r.entries.map(e=>`<article class="w-entry"><b>${winners.includes(e.id)?'🏆 ':''}${esc(e.name)}${r.type==='booktitle'?'・'+e.votes+'票':''}</b>${wPoem(e.text.split('\n'))}</article>`).join('')}</div></details>`;}
 body+=`<div class="btns">${final?host?wButton('もう一度遊ぶ','send({type:"restart"})','gold'):'':host?wButton(p.round+1>=p.roundLimit?'最終結果へ':'次のラウンドへ','send({type:"word_next"})','gold'):''}${final?wButton('タイトルへ戻る','leaveToTitle()','alt'):''}</div>`;
 return wPanel(final?'最終ランキング':'作品の発表・結果',body);
}
function renderWord(){if(!room||!WORD_GAMES.includes(room.game))return;if(room.phase==='final')return wResult(true);if(room.phase==='word_reveal')return wResult(false);if(['word_judge','word_vote'].includes(room.phase))return wEntries();return wCompose()}

function wRemove(i){wState().lines.splice(i,1);render()}
function wMove(i,dir){const d=wState(),j=i+dir;if(j<0||j>=d.lines.length)return;[d.lines[i],d.lines[j]]=[d.lines[j],d.lines[i]];render()}
function wClearAll(){wState().lines=[];render()}


'use strict';
const WORD_GAMES=['senryu','tanka','booktitle'];
let wordDraft={key:'',lines:[],selected:0,top:null,bottom:null};
const wButton=(s,fn,k='')=>action(s,fn,k);
function wordLobbyPanel(){
 if(!WORD_GAMES.includes(room?.game))return '';
 if(room.game==='booktitle')return '<div class="w-note">📚 タイトルの前半・後半を組み合わせ、全員で投票して採用作品を選びます。自由入力もできます。</div>' + wordDeckEditor();
 const f=room.wordFormat||(room.game==='tanka'?'57577':'575'),owner=room.owner===me;
 return `<section class="w-panel"><h3>句の形式を選ぼう</h3><div class="w-formats">${[['575','5・7・5'],['57577','5・7・5・7・7'],['5577','5・5・7・7'],['7775','7・7・7・5']].map(([n,l])=>`<button class="w-format ${n===f?'selected':''}" ${owner?'':'disabled'} onclick="wordSetFormat('${n}')">${l}</button>`).join('')}</div><div class="w-inline"><label for="w-custom">自由形式</label><input class="field" id="w-custom" maxlength="6" inputmode="numeric" value="${esc(f)}" placeholder="5577" ${owner?'':'disabled'}><button class="btn alt" ${owner?'':'disabled'} onclick="wordCustom()">設定</button></div><p class="small">現在：<b>${f.split('').join('・')}</b>（音数は厳密に強制しません）</p></section>${wordDeckEditor()}`;
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
function wState(){const p=room.word,k=[room.code,room.matchNo,p.round,room.game].join(':');if(wordDraft.key!==k)wordDraft={key:k,lines:p.format.map(()=>null),selected:0,top:null,bottom:null};return wordDraft}
function wPanel(title,body){app.innerHTML=panel('WORD PARTY / '+GAMES[room.game].title,title,roomBar()+body+'<p id="err" class="error" hidden></p>')}
function wPoem(lines){return '<div class="w-poem">'+lines.map(x=>`<div>${esc(x||'・・・・')}</div>`).join('')+'</div>'}
function wPickSlot(i){wState().selected=i;render()}
function wUse(s){const d=wState(),i=d.selected;d.lines[i]={text:s,free:false};d.selected=Math.min(d.lines.length-1,i+1);render()}
function wCustomWord(){const s=(document.getElementById('w-free')?.value||'').trim();if(!s||s.length>35)return alert('1〜35文字で入力してください');const d=wState(),i=d.selected;d.lines[i]={text:s,free:true};d.selected=Math.min(d.lines.length-1,i+1);render()}
function wClear(i){const d=wState();d.lines[i]=null;d.selected=i;render()}
function wHalf(which,text){wState()[which]={text,free:false};render()}
function wHalfFree(which){const s=(document.getElementById('w-'+which)?.value||'').trim();if(!s||s.length>35)return alert('1〜35文字で入力してください');wState()[which]={text:s,free:true};render()}
function wSubmit(){const d=wState();if(room.game==='booktitle'){if(!d.top||!d.bottom)return alert('前半と後半を選んでください');send({type:'word_submit',top:d.top,bottom:d.bottom})}else{if(d.lines.some(x=>!x))return alert('すべての句を入力してください');send({type:'word_submit',lines:d.lines})}}
function wIntro(p){return `<div class="w-progress"><b>ROUND ${p.round+1} / ${p.roundLimit}</b><div class="w-bar"><i style="width:${Math.round(100*p.submittedCount/Math.max(1,p.toSubmit))}%"></i></div><span>提出 ${p.submittedCount}/${p.toSubmit}</span></div>`}
function wCompose(){
 const p=room.word,d=wState(),judge=p.judge===me,host=room.owner===me;
 if(judge)return wPanel('審査役の番です',wIntro(p)+`<div class="w-note">👑 みんなの句を待っています。集まったら作品を匿名で発表し、最高の1作を選びましょう。</div>${p.submittedCount?wButton('集まった句を発表','send({type:"word_show"})','gold'):''}`);
 if(p.submitted)return wPanel('提出しました',wIntro(p)+'<div class="w-note">✅ あなたの作品を提出しました。ほかの人の完成を待っています。</div>');
 if(room.game==='booktitle'){
 const half=(type,label)=>`<section class="w-half"><h3>${label}</h3><div class="w-chips">${(p.hand[type]||[]).map(s=>`<button class="w-chip ${d[type]?.text===s?'chosen':''}" onclick="wHalf('${type}',${JSON.stringify(s).replaceAll('"','&quot;')})">${esc(s)}</button>`).join('')}</div><div class="w-inline"><input class="field" maxlength="35" id="w-${type}" placeholder="自由入力（${label}）"><button class="btn alt" onclick="wHalfFree('${type}')">自由入力</button></div></section>`;
 return wPanel('面白いタイトルを考えよう',wIntro(p)+`<div class="w-book"><small>今のタイトル</small><h2>${esc(d.top?.text||'（前半）')}${esc(d.bottom?.text||'（後半）')}</h2></div>${half('top','前半')}${half('bottom','後半')}<div class="btns">${wButton('タイトルを提出 →','wSubmit()','gold')}</div>`);
 }
 const i=d.selected,kind=p.format[i],options=p.hand[String(kind)]||[];
 return wPanel('言葉を組み立てよう',wIntro(p)+`<div class="w-note">音数は目安です。字余り、変則5・5・7・7、身内ネタもOK！</div><div class="w-slots">${p.format.map((n,j)=>`<button class="w-slot ${i===j?'active':''}" onclick="wPickSlot(${j})"><small>${j+1}句目（${n}音）</small><b>${esc(d.lines[j]?.text||'＋ 選ぶ')}</b></button>`).join('')}</div><div class="w-preview"><small>できあがり</small>${wPoem(d.lines.map(x=>x?.text))}</div><h3>${i+1}句目：${kind}音の候補</h3><div class="w-chips">${options.map(s=>`<button class="w-chip" onclick="wUse(${JSON.stringify(s).replaceAll('"','&quot;')})">${esc(s)}</button>`).join('')}</div><div class="w-inline"><input id="w-free" maxlength="35" class="field" placeholder="手札にない言葉も書けます"><button class="btn alt" onclick="wCustomWord()">自由入力を使う</button></div><div class="btns">${wButton('この作品を提出 →','wSubmit()','gold')}</div>`);
}
function wEntries(){
 const p=room.word,judge=p.judge===me,book=room.game==='booktitle',host=room.owner===me;
 const rows=p.entries.map((e,j)=>`<article class="w-entry"><b>作品 ${j+1}${book&&e.id===me?'（自分）':''}</b>${wPoem((e.text||'').split('\n'))}${book?(p.myVote?'<small>投票済み</small>':e.id===me?'<small>自分には投票できません</small>':wButton('このタイトルに投票','send({type:"word_vote",target:'+JSON.stringify(e.id)+'})')):judge?wButton('この句を採用','send({type:"word_pick",target:'+JSON.stringify(e.id)+'})','gold'):'<small>親の発表を待っています</small>'}</article>`).join('');
 return wPanel(book?'編集会議：投票しよう':'親が一番好きな句を選ぶ',`<div class="w-note">${book?'他人の作品を1つ選ぼう。':'作者名を隠して発表しています。'}</div><div class="w-entries">${rows}</div>${book?`<div class="w-note">投票状況：${p.voteCount} / ${room.players.length}人</div>`:''}${book&&host&&p.voteCount?wButton('今の票数で集計','send({type:"word_force"})','alt'):''}`);
}
function wResult(final){
 const p=room.word,host=room.owner===me,rank=[...room.players].sort((a,b)=>b.score-a.score),rows=final?p.history:[p.last].filter(Boolean);
 let body=`<div class="w-score">${rank.map((x,i)=>`<div><strong>${i+1}位 ${esc(x.name)}</strong><b>${x.score} pt</b></div>`).join('')}</div>`;
 for(const r of rows){const winners=r.type==='booktitle'?r.winners:[r.winner];body+=`<details open class="w-review"><summary>ROUND ${r.round}｜採用作品</summary><div class="w-entries">${r.entries.map(e=>`<article class="w-entry"><b>${winners.includes(e.id)?'🏆 ':''}${esc(e.name)}${r.type==='booktitle'?'・'+e.votes+'票':''}</b>${wPoem(e.text.split('\n'))}</article>`).join('')}</div></details>`;}
 body+=`<div class="btns">${final?host?wButton('もう一度遊ぶ','send({type:"restart"})','gold'):'':host?wButton(p.round+1>=p.roundLimit?'最終結果へ':'次のラウンドへ','send({type:"word_next"})','gold'):''}${final?wButton('タイトルへ戻る','leaveToTitle()','alt'):''}</div>`;
 return wPanel(final?'最終ランキング':'作品の発表・結果',body);
}
function renderWord(){if(!room||!WORD_GAMES.includes(room.game))return;if(room.phase==='final')return wResult(true);if(room.phase==='word_reveal')return wResult(false);if(['word_judge','word_vote'].includes(room.phase))return wEntries();return wCompose()}

'use strict';
/* Works with locally stored custom game data. Images are resized in the browser. */
const ui=document.getElementById('content');
const X=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=NKM;
let STUDIO_PUBLIC=null;
const RANKED_ONLY = new Set(['truefalse','multi','order']);
const isStudioPublished=g=>RANKED_ONLY.has(g)||!STUDIO_PUBLIC||STUDIO_PUBLIC.includes(g);
const KIND={tier:['🏆','みんなでティア表！','主役のS〜Dを予想する'],quiz:['🎯','理解度チェック','本人の答えを予想する'],either:['⚖️','恋愛究極の２択','本人が選んだA/Bを予想する'],value:['💗','これって重い？判定シート','3段階の価値観を予想する'],soup:['🔎','ウミガメのスープ','質問して真相にたどり着く'],
 truefalse:['⭕','○×チャレンジ','自作の○×問題に挑戦！'],
 multi:['🧩','正解を全部選べ！','4択から複数の正解をすべて探す'],
 order:['🔢','順番を当てろ！','4つの項目を正しい順番に並べる']};
const MAX={tier:15,quiz:30,either:30,value:30,soup:20,truefalse:30,multi:30,order:30};
let tab='home',draft=null,play=null,guesses=[],playIndex=0,shownHints=[],notes=[],finished=false,shareLink='',activeEditor=0;
const bb=(t,fn,cls='')=>`<button type="button" class="btn ${cls}" onclick="${X(fn)}">${X(t)}</button>`;
const section=(title,body,desc='')=>`<section class="panel"><h2>${X(title)}</h2>${desc?`<p>${X(desc)}</p>`:''}${body}</section>`;
function idValue(){return 'g_'+Date.now()+'_'+Math.random().toString(36).slice(2,9)}
function countOf(g){return g.game==='tier'?g.config.rounds.length:g.game==='soup'?g.config.puzzles.length:g.config.qs.length}
function imageOK(s){return typeof s==='string'&&s.length<90000&&(/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(s)||/^https:\/\/[^\s<>"']{1,1000}$/.test(s))}
function imageHTML(src,alt='問題の画像',cls='question-image'){return imageOK(src)?`<img class="${cls}" src="${X(src)}" alt="${X(alt)}" loading="lazy">`:''}
function questionSize(kind){return kind==='either'||kind==='truefalse'?2:kind==='value'?3:4}
function emptyQuestion(kind){return {q:'',options:kind==='truefalse'?['○ 正しい','× 間違い']:Array(questionSize(kind)).fill(''),image:'',optionImages:Array(questionSize(kind)).fill('')}}
function initialTruth(kind){return kind==='multi'?[0,1]:kind==='order'?[0,1,2,3]:0}
function emptyRound(){return {title:'',items:Array(5).fill(''),image:'',itemImages:Array(5).fill('')}}
function emptyPuzzle(){return {situation:'',solution:'',hints:['','',''],image:''}}
function normalized(g){const out=JSON.parse(JSON.stringify(g));out.v=2;out.config=out.config||{};
 if(out.game==='tier'){
   if(!Array.isArray(out.config.rounds))out.config.rounds=[{title:out.config.title||out.title||'',items:out.config.items||Array(5).fill(''),image:out.config.image||'',itemImages:out.config.itemImages||Array(5).fill('')}];
   out.config.rounds=out.config.rounds.map(r=>({...emptyRound(),...r,items:Array.from({length:5},(_,i)=>String(r.items?.[i]||'')),itemImages:Array.from({length:5},(_,i)=>r.itemImages?.[i]||'')}));
   if(!Array.isArray(out.truth?.[0]))out.truth=[Array.isArray(out.truth)?[...out.truth]:[0,1,2,3,4]];
   while(out.truth.length<out.config.rounds.length)out.truth.push([0,1,2,3,4]);
 }else if(out.game==='soup'){
   if(!Array.isArray(out.config.puzzles))out.config.puzzles=[{situation:out.config.situation||'',solution:out.config.solution||'',hints:out.config.hints||['','',''],image:out.config.image||''}];
   out.config.puzzles=out.config.puzzles.map(p=>({...emptyPuzzle(),...p,hints:Array.from({length:3},(_,i)=>p.hints?.[i]||'')}));out.truth=[];
 }else {
   out.config.qs=(Array.isArray(out.config.qs)?out.config.qs:[emptyQuestion(out.game)]).map(q=>({...emptyQuestion(out.game),...q,options:out.game==='truefalse'?['○ 正しい','× 間違い']:Array.from({length:questionSize(out.game)},(_,i)=>String(q.options?.[i]||'')),optionImages:Array.from({length:questionSize(out.game)},(_,i)=>q.optionImages?.[i]||'')}));
   out.truth=Array.from({length:out.config.qs.length},(_,i)=>{
    const t=out.truth?.[i];
    if(out.game==='multi')return Array.isArray(t)?t.slice():[0,1];
    if(out.game==='order')return Array.isArray(t)?t.slice():[0,1,2,3];
    return Number.isInteger(t)?t:0
   });
 }
 return out;
}
function chooseTab(x){tab=x;draft=null;play=null;playIndex=0;activeEditor=0;shownHints=[];finished=false; rankedInfo=null;rankedAttempt='';rankedResult=null;rankedBoard=null;rankedSubmitting=false; history.replaceState(null,'',location.pathname);render()}
function render(){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));if(tab==='play')return renderPlay();if(tab==='make')return renderMake();if(tab==='library')return renderLibrary();if(tab==='profile')return renderProfile();renderHome()}
function renderHome(){const p=N.profile();ui.innerHTML=section('どんな遊び方にする？',`<div class="grid"><div class="tile"><span class="badge">ONLINE · 2〜12人</span><strong>👥 みんなで遊ぶ</strong><p>ルームを作って、今までのゲームをリアルタイムで遊ぶ。</p><a class="btn primary" href="/" style="display:inline-block;text-decoration:none">ルームへ進む</a></div><div class="tile"><span class="badge">SOLO · ランキング付きリンク</span><strong>✏️ じぶんで問題を作る</strong><p>好きな問題数で作り、リンクを送って友達の結果をランキングで見られます。</p>${bb('ゲームを作る',"chooseTab('make')",'primary')}</div><div class="tile"><span class="badge">LIBRARY</span><strong>📚 作ったゲーム</strong><p>保存した問題はいつでも編集・共有・バックアップできます。</p>${bb('保存一覧',"chooseTab('library')")}</div><div class="tile"><span class="badge">NEW · SOLO</span><strong>🖼️ キャラクター・ミリしら</strong><p>アニメやゲームのキャラの性格や生死を自由に予想。画像付きで作って友達へ共有。</p><a class="btn primary" href="/milli" style="display:inline-block;text-decoration:none">ミリしらを作る</a></div><div class="tile"><span class="badge">PROFILE</span><strong>${N.avatarHTML(p,38)} ${X(p.name||'未設定')}</strong><p>名前やアイコン画像をこの端末に保存できます。</p>${bb('プロフィールを設定',"chooseTab('profile')")}</div></div>`,'自分の好きなものから始めよう。')}
function initDraft(kind,existing){draft=existing?normalized(existing):{v:2,id:null,game:kind,title:'',config:kind==='tier'?{rounds:[emptyRound()]}:kind==='soup'?{puzzles:[emptyPuzzle()]}:{qs:[emptyQuestion(kind)]},truth:kind==='tier'?[[0,1,2,3,4]]:kind==='soup'?[]:[initialTruth(kind)]};activeEditor=0}
function chooseGame(kind){if(!KIND[kind])return;if(!isStudioPublished(kind))return alert('このゲームは現在非公開です');initDraft(kind);tab='make';render()}
function editGame(i){const g=N.games()[i];if(!g)return;initDraft(g.game,g);tab='make';render()}
function blockImg(target,i,j=null){const src=target.image||'';const imageName=j===null?'問題の画像':'選択肢の画像';const attr=`${i},${j===null?'null':j}`;return `<details class="photo-control" ${src?'open':''}><summary class="photo-label">${src?'🖼️ 添付した画像を確認・変更':'＋ '+imageName+'を添付（任意）'}</summary>${imageHTML(src,imageName,'editor-image')}<div class="row"><label class="mini-upload">📷 写真を追加<input class="hidden" type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadImage(event,${attr})"></label>${bb('画像URLを入力',`setImageURL(${attr})`,'secondary')}${src?bb('画像を外す',`removeImage(${attr})`,'secondary'):''}</div><small>画像は自動で縮小保存。公開画像のURLも使用できます。</small></details>`}
function roundImg(i,j=null){const r=draft.game==='tier'?draft.config.rounds[i]:draft.game==='soup'?draft.config.puzzles[i]:draft.config.qs[i];return blockImg({image:j===null?r.image:(draft.game==='tier'?r.itemImages[j]:r.optionImages[j])},i,j)}
function orderRows(order,options,mode,i){
 return order.map((n,pos)=>`<div class="tierline"><span class="tierlabel">${pos+1}</span><span>${X(options[n]||'候補 '+(n+1))}</span>
 ${mode==='correct'?'':`<button type="button" class="tiny" ${pos===0?'disabled':''} onclick="moveOrder('${mode}',${i},${pos},-1)">↑</button><button type="button" class="tiny" ${pos===order.length-1?'disabled':''} onclick="moveOrder('${mode}',${i},${pos},1)">↓</button>`}</div>`).join('')
}
function extraQuestionEditor(i,q,ctrl){
 const g=draft.game,truth=draft.truth[i];
 const head=`<div class="question" id="question-${i}"><h3>Q${i+1}</h3>${ctrl}
 <label>問題文</label><textarea class="field question-text" maxlength="300"
 oninput="draft.config.qs[${i}].q=this.value">${X(q.q)}</textarea>${roundImg(i)}`;
 if(g==='truefalse')return head+`<p>答えが「○ 正しい」か「× 間違い」かを決めます。</p>
 <label>正解</label><select class="field" onchange="draft.truth[${i}]=Number(this.value)">
 <option value="0" ${truth===0?'selected':''}>○ 正しい</option>
 <option value="1" ${truth===1?'selected':''}>× 間違い</option></select></div>`;
 const fields=`<div class="choicegrid">${q.options.map((v,j)=>`<div class="choice-edit">
 <label>候補 ${j+1}</label><input class="field" maxlength="160" value="${X(v)}"
 oninput="draft.config.qs[${i}].options[${j}]=this.value">${roundImg(i,j)}</div>`).join('')}</div>`;
 if(g==='multi')return head+fields+`<h4>正しい選択肢を2個以上選んでください</h4>
 <div class="choicegrid">${q.options.map((v,j)=>`<label class="multi-check">
 <input type="checkbox" ${truth.includes(j)?'checked':''} onchange="toggleMultiTruth(${i},${j})">
 <span>${'ABCD'[j]}. ${X(v||'候補'+(j+1))}</span></label>`).join('')}</div></div>`;
 return head+fields+`<h4>正しい順番（上から1→4）</h4>
 <p class="muted">↑↓ボタンで正解の並びを決めます。</p>
 ${orderRows(truth,q.options,'edit',i)}</div>`
}
function toggleMultiTruth(i,j){
 const current=draft.truth[i],p=current.indexOf(j);
 if(p<0)current.push(j);else current.splice(p,1);
 current.sort((a,b)=>a-b);renderMake()
}
function moveOrder(mode,i,pos,dx){
 const target=mode==='edit'?draft?.truth[i]:guesses[i],next=pos+dx;
 if(!Array.isArray(target)||next<0||next>=target.length)return;
 [target[pos],target[next]]=[target[next],target[pos]];
 if(mode==='edit')renderMake();else renderPlay()
}
function toggleMultiGuess(i,j){
 const selected=guesses[i],p=selected.indexOf(j);
 if(p<0)selected.push(j);else selected.splice(p,1);
 selected.sort((a,b)=>a-b);renderPlay()
}
function renderOneQuestion(i){const g=draft.game,t=draft,part=g==='tier'?t.config.rounds[i]:g==='soup'?t.config.puzzles[i]:t.config.qs[i],name=g==='tier'?'Tier表':g==='soup'?'謎':'問題';const ctrl=`<div class="question-actions">${bb('↑ 上へ',`moveQuestion(${i},-1)`,'secondary')}${bb('↓ 下へ',`moveQuestion(${i},1)`,'secondary')}${bb('複製',`duplicateQuestion(${i})`,'secondary')}${bb('削除',`removeQuestion(${i})`,'danger')}</div>`;
 if(RANKED_ONLY.has(g))return extraQuestionEditor(i,part,ctrl);
 if(g==='tier')return `<div class="question" id="question-${i}"><h3>${name} ${i+1}</h3>${ctrl}<label>このTier表のお題</label><input class="field" value="${X(part.title)}" maxlength="100" placeholder="例：友達と行きたい場所" oninput="draft.config.rounds[${i}].title=this.value">${roundImg(i)}<div class="choicegrid">${part.items.map((val,j)=>`<div><label>候補 ${j+1}</label><input class="field" maxlength="80" value="${X(val)}" oninput="draft.config.rounds[${i}].items[${j}]=this.value">${roundImg(i,j)}</div>`).join('')}</div><h4>自分の答え（S → D）</h4>${tierRows(t.truth[i],part.items,'edit',i)}</div>`;
 if(g==='soup')return `<div class="question" id="question-${i}"><h3>${name} ${i+1}</h3>${ctrl}<label>問題文</label><textarea class="field" maxlength="1500" oninput="draft.config.puzzles[${i}].situation=this.value">${X(part.situation)}</textarea>${roundImg(i)}<label>真相（解説）</label><textarea class="field" maxlength="3000" oninput="draft.config.puzzles[${i}].solution=this.value">${X(part.solution)}</textarea>${part.hints.map((val,j)=>`<label>ヒント ${j+1}</label><input class="field" maxlength="300" value="${X(val)}" oninput="draft.config.puzzles[${i}].hints[${j}]=this.value">`).join('')}</div>`;
 return `<div class="question" id="question-${i}"><h3>Q${i+1}</h3>${ctrl}<label>質問文</label><textarea class="field question-text" maxlength="300" oninput="draft.config.qs[${i}].q=this.value">${X(part.q)}</textarea>${roundImg(i)}<div class="choicegrid">${part.options.map((val,j)=>`<div class="choice-edit"><label>選択肢 ${'ABCD'[j]}</label><input class="field" maxlength="160" value="${X(val)}" oninput="draft.config.qs[${i}].options[${j}]=this.value">${roundImg(i,j)}</div>`).join('')}</div><div class="answerpick"><label>あなたの正解</label><select class="field" onchange="draft.truth[${i}]=Number(this.value)">${part.options.map((_,j)=>`<option value="${j}" ${t.truth[i]===j?'selected':''}>${'ABCD'[j]}</option>`).join('')}</select></div></div>`;
}
function renderMake(){const tiles=`<div class="grid">${Object.entries(KIND).filter(([g])=>isStudioPublished(g)).map(([k,[e,title,desc]])=>`<div class="tile"><strong>${e} ${X(title)}</strong><p>${X(desc)}</p>${bb('これを作る',`chooseGame('${k}')`,'primary')}</div>`).join('')}</div>`;if(!draft){ui.innerHTML=section('作るゲームを選ぶ',tiles,'問題数・文章・画像を自由に設定できます。');return}
 const t=draft,g=t.game,total=countOf(t);const name=`<label for="game-title">問題セットのタイトル</label><input id="game-title" class="field" maxlength="100" value="${X(t.title)}" placeholder="例：私についてどれだけ知ってる？" oninput="draft.title=this.value">`;
 const questionNav=`<div class="editor-toolbar"><strong>${total} ${g==='tier'?'お題':g==='soup'?'問':'問'} / 最大${MAX[g]}問</strong><div class="row">${bb('＋ 問題を追加','addQuestion()','primary')}${bb('問題一覧',`document.getElementById('question-nav').scrollIntoView({behavior:'smooth'})`,'secondary')}</div></div><div class="question-nav" id="question-nav">${Array.from({length:total},(_,i)=>bb(`${i+1}`,`showQuestion(${i})`,i===activeEditor?'primary':'secondary')).join('')}</div>`;
 ui.innerHTML=section(`${KIND[g][0]} ${KIND[g][1]} の問題を作る`,name+questionNav+renderOneQuestion(activeEditor)+`<div class="row" style="margin-top:20px">${bb('＋ 次の問題を追加','addQuestion()','secondary')}${bb('保存して共有する','saveDraft()','primary')}${bb('戻る',"chooseTab('home')")}</div><p class="muted">作成した問題と画像はこのブラウザに保存。保存後も編集・バックアップできます。画像つきの共有リンクは、サーバー再起動で無効になる場合があります。</p>`,'基本ルールや元ネタの名前は変えず、お題・問題数・画像を自分でカスタマイズできます。');
}
function showQuestion(i){activeEditor=Math.max(0,Math.min(countOf(draft)-1,i));renderMake();document.getElementById('question-nav')?.scrollIntoView({behavior:'smooth',block:'start'})}
function addQuestion(){const g=draft.game,arr=g==='tier'?draft.config.rounds:g==='soup'?draft.config.puzzles:draft.config.qs;if(arr.length>=MAX[g])return alert('この形式の上限は'+MAX[g]+'問です');arr.push(g==='tier'?emptyRound():g==='soup'?emptyPuzzle():emptyQuestion(g));if(g==='tier')draft.truth.push([0,1,2,3,4]);else if(g!=='soup')draft.truth.push(initialTruth(g));showQuestion(arr.length-1)}
function duplicateQuestion(i){const g=draft.game,arr=g==='tier'?draft.config.rounds:g==='soup'?draft.config.puzzles:draft.config.qs;if(arr.length>=MAX[g])return alert('上限に達しています');arr.splice(i+1,0,JSON.parse(JSON.stringify(arr[i])));if(g!=='soup')draft.truth.splice(i+1,0,JSON.parse(JSON.stringify(draft.truth[i])));showQuestion(i+1)}
function moveQuestion(i,dir){const arr=draft.game==='tier'?draft.config.rounds:draft.game==='soup'?draft.config.puzzles:draft.config.qs,j=i+dir;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];if(draft.game!=='soup')[draft.truth[i],draft.truth[j]]=[draft.truth[j],draft.truth[i]];showQuestion(j)}
function removeQuestion(i){const arr=draft.game==='tier'?draft.config.rounds:draft.game==='soup'?draft.config.puzzles:draft.config.qs;if(arr.length===1)return alert('最低1問必要です');if(!confirm('この問題を削除しますか？'))return;arr.splice(i,1);if(draft.game!=='soup')draft.truth.splice(i,1);showQuestion(Math.min(i,arr.length-1))}
function imageField(i,j){const r=draft.game==='tier'?draft.config.rounds[i]:draft.game==='soup'?draft.config.puzzles[i]:draft.config.qs[i];return j===null?['image',r]:draft.game==='tier'?['itemImages',r]:['optionImages',r]}
function assignImage(i,j,v){const [field,obj]=imageField(i,j);if(j===null)obj[field]=v;else obj[field][j]=v;renderMake()}
function setImageURL(i,j){const [field,obj]=imageField(i,j),prev=j===null?obj[field]:obj[field][j];let url=prompt('画像URLを入力してください（https:// で始まる画像の直接URL）',prev?.startsWith('https://')?prev:'');if(url===null)return;url=url.trim();if(url&&!imageOK(url))return alert('https:// で始まる画像のURLを入力してください');assignImage(i,j,url)}
function removeImage(i,j){assignImage(i,j,'')}
function downsize(file){return new Promise((resolve,reject)=>{if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000)return reject(Error('8MB以下のPNG・JPEG・WebP画像を選んでください'));
 const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const canvas=document.createElement('canvas');const limit=320,scale=Math.min(1,limit/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let v=canvas.toDataURL('image/webp',.64);if(v.length>75000)v=canvas.toDataURL('image/jpeg',.45);if(v.length>75000)throw Error('縮小後も容量が大きすぎます。別の画像を選んでください');URL.revokeObjectURL(u);resolve(v)}catch(e){URL.revokeObjectURL(u);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(u);reject(Error('画像を開けませんでした'))};img.src=u;})}
async function uploadImage(e,i,j){const file=e.target.files?.[0];if(!file)return;try{const src=await downsize(file);assignImage(i,j,src)}catch(err){alert(err.message)}}
function tierRows(order,items,mode,index=0){return order.map((n,i)=>`<div class="tierline"><span class="tierlabel">${'SABCD'[i]}</span><span>${X(items[n]||`候補 ${n+1}`)}</span>${mode==='correct'?'':`<button type="button" class="tiny" ${i===0?'disabled':''} onclick="moveTier('${mode}',${index},${i},-1)">↑</button><button type="button" class="tiny" ${i===4?'disabled':''} onclick="moveTier('${mode}',${index},${i},1)">↓</button>`}</div>`).join('')}
function moveTier(mode,index,i,dx){const a=mode==='edit'?draft?.truth[index]:guesses[index],j=i+dx;if(!a||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];mode==='edit'?renderMake():renderPlay()}
function verify(x){if(!x||!KIND[x.game]||!x.title?.trim())return '問題セットのタイトルを入力してください';const g=normalized(x),total=countOf(g);if(total<1||total>MAX[g.game])return '問題数が範囲外です';if(g.game==='tier'){
 for(const r of g.config.rounds){if(!r.title.trim()||r.items.some(s=>!s.trim())||new Set(r.items.map(s=>s.trim())).size!==5)return 'Tier表ごとにお題と異なる5つの選択肢を入力してください';}
 }else if(g.game==='soup'){for(const p of g.config.puzzles){if(p.situation.trim().length<10||p.solution.trim().length<10)return 'ウミガメのスープは問題文と真相を10文字以上入力してください';}}
 else{for(let i=0;i<g.config.qs.length;i++){
  const q=g.config.qs[i],answer=g.truth[i];
  if(!q.q.trim())return 'すべての問題文を入力してください';
  if(g.game==='truefalse'){
   if(!Number.isInteger(answer)||answer<0||answer>1)return '○×の正解を決めてください';
   continue
  }
  if(q.options.some(x=>!x.trim())||new Set(q.options.map(x=>x.trim())).size!==q.options.length)
   return 'すべての問題に異なる選択肢を入力してください';
  if(g.game==='multi'&&(!Array.isArray(answer)||answer.length<2||answer.length>4||
      new Set(answer).size!==answer.length||answer.some(x=>!Number.isInteger(x)||x<0||x>3)))
   return '複数正解クイズでは、正解を2個以上選んでください';
  if(g.game==='order'&&(!Array.isArray(answer)||answer.length!==4||
      new Set(answer).size!==4||answer.some(x=>!Number.isInteger(x)||x<0||x>3)))
   return '並べ替えの正しい順番を確認してください';
 }}
 return ''}
function saveDraft(){const errorText=verify(draft);if(errorText)return alert(errorText);const g=normalized(draft);g.title=g.title.trim();g.config.title=g.title;if(!N.saveGame(g))return alert('ブラウザの保存容量がいっぱいです。画像を減らすか、バックアップを保存してください');draft.id=N.games()[0].id;tab='library';renderLibrary();const note=document.getElementById('saved-notice');if(note)note.textContent=RANKED_ONLY.has(g.game)?'保存しました！「🏆 ランキング付きリンクを作る」から友達へ送れます。':'保存しました！「共有リンクをコピー」から友達へ送れます。'}
function payloadFor(g){const c=normalized(g);return {v:2,game:c.game,title:c.title,config:c.config,truth:c.truth}}
function embeddedLink(g){return location.origin+'/studio#play='+N.pack(payloadFor(g))}
async function shareGame(g){const local=embeddedLink(g);if(local.length<=7300)return {url:local,short:false};const c=payloadFor(g),raw=JSON.stringify(c);if(raw.length>650000)throw Error('画像が多すぎます。画像を減らすか、JSONバックアップで共有してください');const resp=await fetch('/api/challenges',{method:'POST',headers:{'Content-Type':'application/json'},body:raw});if(!resp.ok)throw Error('共有リンクの作成に失敗しました（'+resp.status+'）');const data=await resp.json();return {url:location.origin+'/studio#share='+data.id,short:true}}
async function copyGame(i){const g=N.games()[i];if(!g)return;try{const out=await shareGame(g);try{await navigator.clipboard.writeText(out.url);alert(out.short?'共有リンクをコピーしました。サーバー再起動で無効になる場合があります。':'共有リンクをコピーしました！')}catch{prompt('友達へ送るリンクをコピーしてください',out.url)}}catch(err){alert(err.message)}}
function openOnlineRoom(i){const g=N.games()[i];if(!g)return;try{sessionStorage.setItem('nkstudio_prepare',JSON.stringify(payloadFor(g)));location.href='/'}catch(e){alert('この問題は大きすぎます。JSONで保存してからルームで読み込んでください')}}
function openChallenge(i){const g=N.games()[i];if(!g)return;if(!isStudioPublished(g.game))return alert('このゲームは現在非公開です');loadChallenge(payloadFor(g));history.replaceState(null,'',location.pathname)}
function removeGame(i){const g=N.games()[i];if(g&&confirm('この問題セットを削除しますか？')){N.deleteGame(g.id);renderLibrary()}}
function downloadText(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000)}
function exportGames(){downloadText('nakamikurabe-backup.json',JSON.stringify({v:2,kind:'nakamikurabe-backup',profile:N.profile(),games:N.games()},null,2),'application/json')}
function exportOne(i){const g=N.games()[i];if(g)downloadText('nakamikurabe-'+g.game+'.json',JSON.stringify({kind:'nakamikurabe-challenge',game:payloadFor(g)},null,2),'application/json')}
async function importGames(e){const file=e.target.files?.[0];if(!file)return;if(file.size>3_000_000)return alert('3MB以下のJSONを選んでください');try{const data=JSON.parse(await file.text());const arr=data.kind==='nakamikurabe-challenge'?[data.game]:data.kind==='nakamikurabe-backup'?data.games:null;if(!Array.isArray(arr))throw Error('形式が違います');let count=0;for(const raw of arr.slice(0,45)){if(KIND[raw.game]){const g=normalized(raw);if(!verify(g)&&N.saveGame(g))count++}}if(data.profile&&confirm('バックアップのプロフィールも復元しますか？'))N.saveProfile(data.profile);alert(count+'件を読み込みました');renderLibrary()}catch(err){alert('読み込めませんでした：'+err.message)}}
function renderLibrary(){const arr=N.games(),published=rankedLinks();ui.innerHTML=section('保存したゲーム',`<p id="saved-notice" class="muted">このブラウザ内の保存データ：${arr.length}セット。端末を変える前にバックアップしてください。</p><div class="row">${bb('新しく作る',"chooseTab('make')",'primary')}${bb('全部バックアップ','exportGames()','secondary')}<label class="import-label"><span class="btn secondary">JSONを読み込む</span><input type="file" accept=".json,application/json" onchange="importGames(event)" class="hidden"></label></div>${arr.length?`<div class="stack" style="margin-top:16px">${arr.map((g,i)=>`<div class="tile"><div class="row spaced"><strong>${KIND[g.game]?.[0]||'📝'} ${X(g.title)}</strong><span class="badge">${X(KIND[g.game]?.[1]||'')}</span></div><p>${countOf(normalized(g))}問 / ${countImages(g)}枚の画像</p><div class="row">${RANKED_ONLY.has(g.game)?'':bb('友達に送るリンク','copyGame('+i+')','primary')}${g.game==='soup'?'':bb('🏆 ランキング付きリンクを作る','publishRanked('+i+')','primary')}${bb('自分で試す','openChallenge('+i+')')}${RANKED_ONLY.has(g.game)?'':bb('👥 みんなで遊ぶ','openOnlineRoom('+i+')','primary')}${bb('編集','editGame('+i+')')}${bb('JSONで書き出す','exportOne('+i+')','secondary')}${bb('削除','removeGame('+i+')','danger')}</div>${published.filter(p=>p.gameId===g.id).slice(0,5).map(p=>'<div class="notice">🏆 ランキング公開中（期限：'+X(new Date(p.expiresAt*1000).toLocaleDateString('ja-JP'))+'）<div class="row">'+bb('URLをコピー',"copyRankedLink('"+p.id+"')",'secondary')+bb('ランキングを見る',"openRankedLink('"+p.id+"')",'secondary')+'</div></div>').join('')}</div>`).join('')}</div>`:'<div class="notice">まだありません。「新しく作る」から始めましょう。</div>'}<div class="notice">画像が多い問題はサーバー経由の短いリンクになります。Renderが再起動すると無効になるため、確実に保管するにはJSONを書き出してください。通常の共有リンクには正解が含まれ、結果は集計されません。ランキング付きリンクはサーバーで採点し、提出後に正解を公開します。</div>`,'作った内容はこの端末のブラウザに保存されます。')}
function countImages(g){const c=normalized(g);let out=0;const arr=c.game==='tier'?c.config.rounds:c.game==='soup'?c.config.puzzles:c.config.qs;for(const x of arr){if(x.image)out++;for(const v of (x.itemImages||x.optionImages||[]))if(v)out++}return out}
function renderProfile(){const p=N.profile(),r=N.records(),face=p.avatar?`<img class="thumb" src="${p.avatar}" alt="保存したアイコン">`:`<span class="thumb">${X(p.emoji)}</span>`;ui.innerHTML=section('自分のプロフィール',`<div class="row">${face}<div><strong>${X(p.name||'ゲスト')}</strong><p class="muted">写真は96×96pxに縮小して保存します。</p></div></div><label>ニックネーム</label><input id="prof-name" class="field" maxlength="24" value="${X(p.name)}"><label>写真を使わないときのアイコン</label><div class="row">${['🌷','🌙','🐈','🎮','🍮','🍀','⭐','🐻','🌸','🦊'].map(e=>`<button class="tiny" style="font-size:24px" onclick="document.getElementById('prof-emoji').value='${e}'">${e}</button>`).join('')}</div><input id="prof-emoji" class="field" maxlength="5" value="${X(p.emoji)}"><label>アイコン写真</label><input id="prof-photo" class="field" type="file" accept="image/png,image/jpeg,image/webp"><div class="row" style="margin-top:15px">${bb('保存','saveMyProfile()','primary')}${bb('写真を削除','clearMyPhoto()')}</div><div class="notice">ブラウザ保存のため端末間同期はありません。ルーム参加中、登録したアイコンはほかの参加者にも表示されます。</div>`)+section('最近のプレイ記録',r.length?`<div class="stack">${r.slice(0,15).map(x=>`<div class="stat">${X(x.title)} <span class="muted">${X(x.info||'')} · ${new Date(x.at).toLocaleDateString('ja-JP')}</span></div>`).join('')}</div>`:'<div class="muted">まだ記録はありません。</div>')}
function shrinkImage(file){return new Promise((resolve,reject)=>{if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5_000_000)return reject(Error('5MB以下の画像を選んでください'));const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const cv=document.createElement('canvas');cv.width=cv.height=96;const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,96,96);let s=Math.max(96/img.width,96/img.height);ctx.drawImage(img,(96-img.width*s)/2,(96-img.height*s)/2,img.width*s,img.height*s);const data=cv.toDataURL('image/jpeg',.75);URL.revokeObjectURL(url);resolve(data)}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('画像を開けません'))};img.src=url})}
async function saveMyProfile(){const p=N.profile();p.name=document.getElementById('prof-name').value.trim().slice(0,24);p.emoji=document.getElementById('prof-emoji').value||'🌷';const file=document.getElementById('prof-photo').files?.[0];try{if(file)p.avatar=await shrinkImage(file);if(!N.saveProfile(p))return alert('保存できませんでした。ブラウザ容量を確認してください');if(p.name)sessionStorage.setItem('nakami_name',p.name);alert('保存しました');renderProfile()}catch(e){alert(e.message)}}
function clearMyPhoto(){const p=N.profile();p.avatar='';N.saveProfile(p);renderProfile()}
function validChallenge(raw){
 if(!raw||!KIND[raw.game]||![1,2].includes(raw.v)||typeof raw.title!=='string'||
    raw.title.length>120||typeof raw.config!=='object'||raw.config===null)return false;
 try{
  const g=normalized(raw),amount=countOf(g);
  if(amount<1||amount>MAX[g.game]||JSON.stringify(g).length>650000)return false;
  if(g.game==='tier')return g.config.rounds.every((r,i)=>r.items.length===5&&g.truth[i].length===5);
  if(g.game==='soup')return g.config.puzzles.every(p=>typeof p.situation==='string'&&typeof p.solution==='string');
  return g.config.qs.every((q,i)=>{
   if(typeof q.q!=='string'||!q.q.trim()||q.options.length!==questionSize(g.game))return false;
   const a=g.truth[i];
   if(g.game==='multi')return Array.isArray(a)&&a.length>=2&&a.length<=4&&
    a.every(n=>Number.isInteger(n)&&n>=0&&n<4)&&new Set(a).size===a.length;
   if(g.game==='order')return Array.isArray(a)&&a.length===4&&
    a.every(n=>Number.isInteger(n))&&new Set(a).size===4&&a.every(n=>n>=0&&n<4);
   return Number.isInteger(a)&&a>=0&&a<q.options.length
  })
 }catch{return false}
}
function loadChallenge(raw){if(!validChallenge(raw))throw Error('この問題データは読み込めません');if(!isStudioPublished(raw.game))throw Error('このゲームは現在非公開です');play=normalized(raw);guesses=play.game==='tier'?play.config.rounds.map(()=>[0,1,2,3,4]):
  play.game==='order'?play.config.qs.map(()=>[0,1,2,3]):
  play.game==='multi'?play.config.qs.map(()=>[]):
  play.game==='soup'?[]:play.config.qs.map(()=>null);shownHints=[];notes=[];finished=false;tab='play';playIndex=0;render()}
function startFromUrl(){const hash=location.hash;if(hash.startsWith('#rank=')){loadRankedLink(hash.slice(6));return true}if(hash.startsWith('#play=')){try{const c=N.unpack(hash.slice(6));loadChallenge(c)}catch(e){ui.innerHTML=section('リンクを開けませんでした',`<p>${X(e.message)}</p>${bb('ホームに戻る',"chooseTab('home')")}`)}return true}
 if(hash.startsWith('#share=')){const id=hash.slice(7);ui.innerHTML=section('問題を読み込み中','<p>画像つきの問題を取得しています…</p>');if(!/^[a-zA-Z0-9_-]{12,40}$/.test(id)){ui.innerHTML=section('読み込み失敗',`<p>リンクが正しくありません。</p>${bb('ホームへ',"chooseTab('home')")}`);return true}fetch('/api/challenges/'+encodeURIComponent(id)).then(async r=>{if(!r.ok)throw Error('問題が見つかりません（サーバー再起動で消えた可能性があります）');return r.json()}).then(v=>loadChallenge(v.data)).catch(e=>{ui.innerHTML=section('読み込み失敗',`<p>${X(e.message)}</p>${bb('ホームへ',"chooseTab('home')")}`)});return true}
 return false}
function showPlay(i){playIndex=Math.max(0,Math.min(countOf(play)-1,i));renderPlay()}
function setGuess(i,j){guesses[i]=j;renderPlay()}
function changeHint(){shownHints[playIndex]=Math.min(3,(shownHints[playIndex]||0)+1);renderPlay()}
function saveMemo(s){notes[playIndex]=s}
function challengeScore(){
 if(!play||play.game==='soup')return null;
 if(play.game==='tier'||play.game==='order')
  return guesses.reduce((score,a,i)=>score+a.filter((x,j)=>x===play.truth[i][j]).length,0);
 if(play.game==='multi')
  return guesses.filter((a,i)=>a.length===play.truth[i].length&&
   a.every(x=>play.truth[i].includes(x))).length;
 return guesses.filter((x,i)=>x===play.truth[i]).length
}
function maximumScore(){return play.game==='tier'?countOf(play)*5:play.game==='order'?countOf(play)*4:countOf(play)}
function finishChallenge(){if(play.game!=='soup'&&play.game!=='tier'&&guesses.some(x=>x===null))return alert('未回答の問題があります。すべてに回答してください');if(play.game==='multi'&&guesses.some(a=>a.length<2))
  return alert('各問題で正解だと思うものを2個以上選んでください');
 if(rankedAttempt)return finishRanked();finished=true;const pts=challengeScore();N.remember({key:'solo_'+Date.now()+'_'+Math.random(),title:play.title,info:pts===null?'真相を確認':`正解 ${pts}/${maximumScore()}`,game:play.game});renderPlay()}
async function copySoloScore(){const pts=challengeScore(),text=play.title+' に挑戦！\n結果：'+pts+'/'+maximumScore()+'点\nなかみくらべ。';try{await navigator.clipboard.writeText(text);alert('結果をコピーしました')}catch{prompt('この結果をコピーしてください',text)}}
function renderPlay(){if(!play){ui.innerHTML=section('問題がありません',bb('ホーム',"chooseTab('home')"));return}const g=play.game,c=play.config,num=countOf(play),i=playIndex;let content='';
 if(g==='tier'){const q=c.rounds[i];content=`<h3>${X(q.title||play.title)}</h3>${imageHTML(q.image)}<div class="tier-play-images">${q.items.map((v,k)=>`<div>${imageHTML(q.itemImages?.[k],'候補 '+(k+1),'option-thumb')}<span>${X(v)}</span></div>`).join('')}</div><p class="muted">この人のS〜Dの並びを予想して矢印で並べ替えてください。</p>${tierRows(guesses[i],q.items,'play',i)}`}
 else if(g==='soup'){const q=c.puzzles[i];content=`<h3>なぜ？</h3>${imageHTML(q.image)}<p class="mystery-text">${X(q.situation)}</p>${(q.hints||[]).slice(0,shownHints[i]||0).map((h,j)=>`<div class="notice">ヒント${j+1}：${X(h||'（なし）')}</div>`).join('')}${!finished?bb('💡 ヒントを見る','changeHint()','secondary'):''}<label>推理メモ</label><textarea class="field" maxlength="1000" oninput="saveMemo(this.value)" placeholder="気づいたことを自由にメモ">${X(notes[i]||'')}</textarea>${finished?`<div class="result"><h3>真相</h3><p>${X(q.solution)}</p></div>`:''}`}
 else if(g==='multi'){
  const q=c.qs[i],selected=guesses[i],truth=play.truth[i];
  content=`<h3>${X(q.q)}</h3>${imageHTML(q.image)}
  <p class="muted">正解だと思う選択肢を2個以上選ぼう。全て当てると1点！</p>
  <div class="option-play">${q.options.map((v,k)=>`<button type="button"
   class="challenge-choice ${selected.includes(k)?'selected':''}" ${finished?'disabled':''}
   onclick="toggleMultiGuess(${i},${k})">
   ${imageHTML(q.optionImages?.[k],'候補 '+(k+1),'option-thumb')}
   <span>${selected.includes(k)?'☑':'☐'} ${'ABCD'[k]}. ${X(v)}</span></button>`).join('')}</div>
   ${finished?`<div class="result"><strong>${selected.length===truth.length&&selected.every(x=>truth.includes(x))?'✓ 完全正解':'✕ 不正解'}</strong>
   <p>正解：${truth.map(k=>X(q.options[k])).join(' ／ ')}</p></div>`:''}`
 }
 else if(g==='order'){
  const q=c.qs[i],correct=play.truth[i];
  content=`<h3>${X(q.q)}</h3>${imageHTML(q.image)}
  <p class="muted">上から順に正しく並べ替えてね。正しい位置1つにつき1点。</p>
  ${orderRows(guesses[i],q.options,finished?'correct':'play',i)}
  ${finished?`<div class="result"><strong>正しい並び</strong>
  ${orderRows(correct,q.options,'correct',i)}</div>`:''}`
 }
 else {const q=c.qs[i];content=`<h3>${X(q.q)}</h3>${imageHTML(q.image)}<div class="option-play">${q.options.map((label,k)=>`<button type="button" class="challenge-choice ${guesses[i]===k?'selected':''}" ${finished?'disabled':''} onclick="setGuess(${i},${k})">${imageHTML(q.optionImages?.[k], '選択肢'+(k+1),'option-thumb')}<span>${guesses[i]===k?'✓ ':''}${'ABCD'[k]}. ${X(label)}</span></button>`).join('')}</div>${finished?`<div class="result"><strong>${guesses[i]===play.truth[i]?'✓ 正解':'✕ 不正解'}</strong><p>正解：${X(q.options[play.truth[i]])}</p></div>`:''}`}
 if(finished&&g==='tier'){content+=`<div class="result"><strong>主役の正解Tier表</strong>${tierRows(play.truth[i],c.rounds[i].items,'correct',i)}</div>`}
 const nav=`<div class="solo-progress"><strong>${i+1} / ${num}</strong><div class="progress-track"><span style="width:${(i+1)/num*100}%"></span></div></div>`;
 const buttons=`<div class="row">${i>0?bb('← 前の問題',`showPlay(${i-1})`,'secondary'):''}${i<num-1?bb('次の問題 →',`showPlay(${i+1})`,'primary'):''}${!finished&&i===num-1?bb(g==='soup'?'全問の真相を見る':'答え合わせする','finishChallenge()','primary'):''}${finished&&g!=='soup'?bb('結果をコピー','copySoloScore()','secondary'):''}${rankedInfo?bb('ランキングを更新','refreshRankedBoard()','secondary'):''}${bb('ホーム',"chooseTab('home')")}</div>`;
 const scoreInfo=finished?`<div class="result result-total"><strong>${g==='soup'?'解説を公開しました':`得点：${challengeScore()} / ${maximumScore()}`}</strong><p>${g==='soup'?'各問の真相は問題ページごとに表示されます。':'問題を切り替えて正解と自分の答えを確認できます。'}</p></div>`:'';
 ui.innerHTML=section(`${KIND[g][0]} ${X(play.title)}`,nav+`<div class="question solo-question">${content}</div>`+scoreInfo+(rankedResult?rankedResultHTML():'')+buttons+`<div class="notice">${rankedInfo?'🏆 回答結果はサーバーで採点され、提出後に正解とランキングが公開されます。':'共有リンクに正解が含まれるため、相手がリンクを調べると正解を確認できます。回答は出題者へ自動送信されません。'}</div>`)}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>chooseTab(b.dataset.tab)));
if(!startFromUrl())render();
fetch('/api/games',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(!d?.games)return;STUDIO_PUBLIC=d.games;if(play&&!isStudioPublished(play.game)){play=null;tab='home';ui.innerHTML=section('非公開のゲーム','このゲームは現在公開されていません。')}else if(tab==='make'&&!draft)renderMake()}).catch(()=>{});

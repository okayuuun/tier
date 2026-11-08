'use strict';
const app=document.getElementById('app');let ws=null,room=null,me=null,connectCode='',playerName='',pendingAction='',draft=null,connecting=false,retryTimer=null;let desiredGame='tier',topicDraft=null,selectedRound=0,activeCompare=null;
const GAMES={tier:{title:'みんなでTier予想',icon:'🏆',desc:'人ごとに異なるお題！主役の並びを予想'},value:{title:'これって重い？',icon:'💗',desc:'本人の3段階の価値観を当てる'},either:{title:'究極の二択',icon:'⚖️',desc:'本人ならA/Bどちらを選ぶ？'},quiz:{title:'私の理解度クイズ',icon:'🎯',desc:'好みの答えを予想して理解度を競う'}};
Object.assign(GAMES,{ito:{title:'ことばの数値リレー',icon:'🕸️',desc:'数字を例えて伝え、小さい順に出す協力ゲーム'},propose:{title:'ひと言プロポーズ',icon:'💍',desc:'6枚の単語を組み合わせて即興告白バトル'},soup:{title:'ひらめきのスープ',icon:'🔎',desc:'出題者に質問して、不思議な状況の真相を解こう'}});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const action=(title,fn,kind='')=>`<button type="button" class="btn ${kind}" onclick="${esc(fn)}">${esc(title)}</button>`;
const panel=(sub,title,content)=>`<section class="pane"><div class="head"><small>${esc(sub)}</small><h2>${esc(title)}</h2></div><div class="body">${content}</div></section>`;
const iid=()=>{let v=new Uint8Array(20);crypto.getRandomValues(v);return Array.from(v,x=>x.toString(16).padStart(2,'0')).join('')};
function getSid(code){let k='nakami_sid_'+code;let sid=sessionStorage.getItem(k);if(!sid){sid=iid();sessionStorage.setItem(k,sid)}return sid}
function status(text,isOn){document.getElementById('status').innerHTML=`<span class="status"><span class="dot ${isOn?'online':''}"></span>${esc(text)}</span>`}
function send(obj){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));else alert('接続が切れています。再接続をお待ちください')}
function landing(){let code=new URLSearchParams(location.search).get('room')||'';app.innerHTML=`<section class="hero"><div class="kicker">REALTIME / みんなで参加</div><h1>予想が当たると、<br>もっと仲良くなる。</h1><p class="lead">各自が秘密の正解を決め、順番に主役になろう。ほかの全員がその人の答えを予想して、まとめて答え合わせ！</p></section><div class="cards">${Object.entries(GAMES).map(([k,d])=>`<div class="game-card-shell"><div class="card"><span>${d.icon}</span><strong>${d.title}</strong><small>${d.desc}</small></div><button type="button" class="game-rule-btn" onclick="openRules('${k}')">📖 ルールを見る</button></div>`).join('')}</div>${panel('START / ルーム参加','友達といっしょに遊ぼう',`<label class="labeled">あなたのニックネーム</label><input id="nickname" class="field" maxlength="24" placeholder="例：おかゆ" value="${esc(sessionStorage.getItem('nakami_name')||'')}"><label class="labeled">ルームコード（友達の部屋に入る場合）</label><input id="roomcode" class="field" maxlength="6" value="${esc(code.toUpperCase())}" placeholder="例：AB12CD" autocapitalize="characters"><div class="btns">${action('新しい部屋を作る','connectNow("create")')}${action('ルームに参加する','connectNow("join")','alt')}</div><div class="notice">2人以上で遊べます。公開後はURLを送るだけで各自のスマホから参加可能。公開前は同じPCやLAN上で動作確認できます。</div><p id="err" class="error" hidden></p>`)}`;status('未接続',false)}
function error(msg){let e=document.getElementById('err');if(e){e.hidden=false;e.textContent=msg}else{let target=document.querySelector('.body');if(target)target.insertAdjacentHTML('afterbegin',`<p class="error">${esc(msg)}</p>`);else alert(msg)}}
function connectNow(kind){playerName=document.getElementById('nickname').value.trim().slice(0,24);if(!playerName)return error('ニックネームを入力してください');let code=document.getElementById('roomcode').value.trim().toUpperCase();if(kind==='join'&&!/^[A-Z2-9]{6}$/.test(code))return error('6桁のルームコードを入力してください');sessionStorage.setItem('nakami_name',playerName);connectCode=kind==='join'?code:'';pendingAction=kind;openSocket()}
function openSocket(){if(connecting)return;connecting=true;status('接続中…',false);if(ws&&ws.readyState===WebSocket.OPEN)ws.close();let url=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws';ws=new WebSocket(url);
ws.onopen=()=>{connecting=false;status('接続中',true);let type=room||connectCode?'join':'create';let code=room?.code||connectCode;let sid=getSid(code||'creating');send({type,code,name:playerName,sid})};
ws.onmessage=evt=>{let obj;try{obj=JSON.parse(evt.data)}catch{return}if(obj.type==='error')return error(obj.message);
if(obj.type==='example'){
 if(room && room.phase==='compose' && room.game===obj.game && room.matchNo===obj.matchNo){
   const d=getTopicDraft();
   if(obj.game==='tier'){d.title=obj.config.title;d.items=[...obj.config.items]}
   else d.qs=obj.config.qs.map(q=>({q:q.q,options:[...q.options]}));
   render();
 }
 return;
}
if(obj.type!=='state')return;room=obj.room;me=obj.me;let code=room.code;let creatingSid=sessionStorage.getItem('nakami_sid_creating');if(creatingSid){sessionStorage.setItem('nakami_sid_'+code,creatingSid);sessionStorage.removeItem('nakami_sid_creating')}connectCode=code;history.replaceState(null,'',location.pathname+'?room='+encodeURIComponent(code));render()};
ws.onclose=()=>{connecting=false;status('切断・再接続中',false);if(room||connectCode||pendingAction){if(!room)error('接続が切れました。無料サーバーの起動中かもしれません。自動で再接続します。');clearTimeout(retryTimer);retryTimer=setTimeout(openSocket,2500)}};
ws.onerror=()=>status('通信エラー',false);
}
function players(){return room.players.map(p=>`<div class="player ${p.online?'':'off'}"><strong>${esc(p.name)} ${p.id===room.owner?'👑':''} ${p.id===me?'（あなた）':''}</strong><small>${p.online?'🟢 接続中':'⚪ 切断中'} ${room.phase==='compose'?(p.topicSubmitted?'・お題提出済み':'・お題を作成中'):room.phase==='answer'?(p.answered?'・回答済み':'・未回答'):room.phase==='guess'?(p.id===room.targetId?'・主役':p.guessed?'・予想済み':'・予想中'):''}</small><div class="stars">${p.score} pt</div></div>`).join('')}
function invite(){return location.origin+location.pathname+'?room='+encodeURIComponent(room.code)}
async function copyInvite(){let v=invite();try{await navigator.clipboard.writeText(v);alert('招待リンクをコピーしました')}catch{prompt('このリンクをコピーしてください',v)}}
function roomBar(){
 const host=room.owner===me && room.phase!=='lobby' && room.phase!=='final';
 return `<div class="banner"><div><div class="kicker">ROOM CODE</div><div class="code">${esc(room.code)}</div></div><div class="headtools">${action('招待URL','copyInvite()','gold')}${action('📖 ルール','openRules(room.game)','alt')}${action('タイトルへ戻る','leaveToTitle()','alt')}${host?action('ゲームを終了','endGame()','exit'):''}</div></div>`;
}
function endGame(){if(confirm('このゲームをここで終了し、全員に途中結果を表示しますか？'))send({type:'end'})}
function leaveToTitle(){
 if(room&&room.phase!=='final'&&!confirm('ルームから退出してタイトルに戻りますか？ ほかの人のゲームは続きます。'))return;
 clearTimeout(retryTimer);pendingAction='';connectCode='';
 if(ws){try{ws.onclose=null;ws.onmessage=null;if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'leave'}));ws.close()}catch{}}
 ws=null;room=null;me=null;connecting=false;draft=null;topicDraft=null;selectedRound=0;activeCompare=null;
 history.replaceState(null,'',location.pathname);
 landing();
}
function render(){
if(!room)return landing();
let phase=room.phase,owner=room.owner===me,top=roomBar();
if(PARTY_GAMES.includes(room.game)&&phase!=='lobby'){renderParty();return}
if(phase==='lobby'){
  const choices=`<div class="cards">${Object.entries(GAMES).map(([k,g])=>`<div class="game-card-shell"><button class="card ${room.game===k?'on':''}" ${owner?'':'disabled'} onclick="chooseGame('${k}')"><span>${g.icon}</span><strong>${g.title}</strong><small>${g.desc}</small></button><button type="button" class="game-rule-btn" onclick="openRules('${k}')">📖 ルールを見る</button></div>`).join('')}</div>`;
  const modes=`<h3>お題の配布方法</h3><div class="modegrid"><button class="mode ${room.tierMode==='self'?'on':''}" ${owner?'':'disabled'} onclick="setTierMode('self')"><strong>✍️ 自分で作って、自分で答える</strong><small>参加者全員が自由にお題と5つの選択肢を考え、自分の作ったTier表に答える</small></button><button class="mode ${room.tierMode==='shuffle'?'on':''}" ${owner?'':'disabled'} onclick="setTierMode('shuffle')"><strong>🎲 みんなのお題をシャッフル</strong><small>全員が作ったお題を、必ず作成者以外の誰かにランダムで1つずつ配る</small></button></div><div class="notice">全員が各自のお題を作成するか、例題からランダム読み込みできます。${room.game==='tier'?'Tier表を1題':'5問のクイズセット'}を作成します。</div>`;
  const buttons=owner?`<div class="btns">${action('ゲーム開始 →','startGame()')}</div>`:`<div class="info">ルーム作成者がゲームを選んで開始するまでお待ちください。</div>`;
  app.innerHTML=panel('WAITING ROOM / ゲーム待機中','みんなが集まったらスタート',top+`<div class="kicker">参加メンバー (${room.players.length}人)</div><div class="playergrid">${players()}</div><h3>遊ぶゲーム</h3>${choices}${PARTY_GAMES.includes(room.game)?`<div class="info">✨ ${esc(GAMES[room.game].desc)}<br>各自のスマホから参加できます。通話しながら遊ぶのがおすすめです。</div>`:modes}${buttons}<p id="err" class="error" hidden></p>`);return;
}
if(phase==='compose'){
  const mine=room.players.find(p=>p.id===me)?.topicSubmitted;
  let box=mine?`<div class="resultbadge center">✅ あなたのお題を提出しました。ほかの人のお題がそろうまで待っています。</div>`:topicForm();
  app.innerHTML=panel('STEP 1 / みんなでお題作り','自分の問題セットを作ろう',top+`<div class="info">${room.tierMode==='shuffle'?'🎲 シャッフル：あなたの問題セットがほかの人に配られます。':'✍️ 自作：あなたの問題セットに自分で答えます。'}<br>${room.game==='tier'?'Tier表を1題（5つの選択肢）':'5問分の質問と選択肢'}を自由に作成できます。例題はランダムに読み込んで編集することもできます。</div><div class="countbox">お題提出：${room.topicCount} / ${room.active.length}人</div>${box}<div class="playergrid">${players()}</div>${owner?action('未提出の人を除いて進める','send({type:"force"})','alt'):''}<p id="err" class="error" hidden></p>`);return;
}
if(phase==='answer'){let done=room.players.find(p=>p.id===me)?.answered;app.innerHTML=panel('SECRET / 答えはまだ秘密','自分の本当の答えを決めよう',top+`<div class="info">あなたに配られた問題セット： <strong>${esc(room.config.title)}</strong><br><strong>${room.answeredCount} / ${room.active.length}人</strong> が回答済み。まだ他の人には見えません。</div>${done?`<div class="resultbadge center">✅ あなたの正解を登録しました。全員の回答を待っています。</div>`:renderEditor('answer',null)}<div class="playergrid">${players()}</div>${owner?action('未回答の人を除いて進める','send({type:"force"})','alt'):''}<p id="err" class="error" hidden></p>`);return}
if(phase==='guess'){let target=room.players.find(p=>p.id===room.targetId);let isTarget=room.targetId===me,already=room.players.find(p=>p.id===me)?.guessed,eligible=room.active.includes(me);app.innerHTML=panel(`ROUND ${room.roundIndex+1} / ${room.totalTargets}`,'この人の答えを当てよう！',top+`<div class="resultbadge center">今回の主役：<strong style="font-size:25px">${esc(target?.name||'')}</strong><br><span class="small">お題：${esc(room.config.title)}</span></div><p class="lead center">${isTarget?'あなたが主役です。みんながあなたの答えを予想しています！':'この人なら、どう並べる？どう答える？'}</p>${isTarget?'<div class="info center">回答が集まるまで待ってね。正解はまだ秘密！</div>':!eligible?'<div class="info">今回は観戦モードです。</div>':already?'<div class="info center">✅ 予想を提出しました。答え合わせを待っています。</div>':renderEditor('guess',room.targetId)}<div class="playergrid">${players()}</div>${owner?action('途中でも答え合わせする','send({type:"force"})','alt'):''}<p id="err" class="error" hidden></p>`);return}
if(phase==='reveal'){
 const r=room.reveal;
 const next=owner?action(room.roundIndex+1===room.totalTargets?'最終結果を見る →':'次の主役へ →','send({type:"next"})'):'';
 const creator=room.tierMode==='shuffle'&&r.creatorName?`<p class="small">作成者：${esc(r.creatorName)}さん</p>`:'';
 app.innerHTML=panel(`REVEAL ${room.roundIndex+1} / ${room.totalTargets}`,'全員の回答を一覧で比較',top+`<div class="resultbadge center">主役：<strong>${esc(r.targetName)}さん</strong><br>${esc(r.config.title)}</div>${creator}${compareMatrix(r)}<div class="btns">${action('🖼️ この結果を画像保存','saveResultImage(\"round\")','gold')}${action('画像を共有','shareResultImage(\"round\")','alt')}${next}</div><p class="small">正解は答え合わせまで秘密です。各マスをタップすると回答の全文を表示します。</p>`);return;
}
if(phase==='final'){
 const ranked=[...room.players].sort((a,b)=>b.score-a.score);
 const historyList=room.history||[];
 if(selectedRound>=historyList.length)selectedRound=0;
 const roundChooser=historyList.length?`<label class="labeled" for="round-select">振り返るラウンドを選択</label><select class="field" id="round-select" onchange="changeRound(this.value)">${historyList.map((r,i)=>`<option value="${i}" ${i===selectedRound?'selected':''}>${i+1}. ${esc(r.targetName)}さん｜${esc(r.config.title)}</option>`).join('')}</select>${compareMatrix(historyList[selectedRound])}`:'<div class="info">まだ答え合わせを完了したラウンドはありません。</div>';
 app.innerHTML=panel('FINAL / ゲーム終了',room.endedEarly?'途中終了｜ここまでの結果':'理解度ランキング！',top+`<div class="compact-scoreboard">${ranked.map((p,i)=>`<div class="scorechip"><strong>${i+1}位 ${esc(p.name)}</strong><b>${p.score}pt</b></div>`).join('')}</div><h3>みんなの回答を振り返る</h3><p class="small">全ラウンドを縦に並べず、見たいラウンドだけ切り替えます。</p>${roundChooser}<div class="btns">${historyList.length?action('🖼️ このラウンドを画像保存','saveResultImage(\"round\")','gold'):''}${historyList.length?action('全ラウンドまとめ画像','saveResultImage(\"all\")','alt'):''}${historyList.length?action('画像を共有','shareResultImage(\"all\")','alt'):''}</div><div class="btns">${owner?action('もう一度遊ぶ','send({type:"restart"})'):''}${action('タイトルへ戻る','leaveToTitle()','alt')}</div>`);return;
}

}
function chooseGame(g){if(!GAMES[g]||room.owner!==me)return;desiredGame=g;send({type:'configure',game:g})}
function setTierMode(mode){if(room.owner!==me)return;send({type:'configure',game:room.game,tierMode:mode})}
function startGame(){send({type:'start'})}
function getTopicDraft(){
 const key=room.code+':'+room.matchNo+':'+room.game;
 if(!topicDraft||topicDraft.key!==key){
   const count={value:3,either:2,quiz:4}[room.game]||5;
   topicDraft={key,title:'',items:['','','','',''],qs:Array.from({length:5},()=>({q:'',options:Array(count).fill('')}))};
 }
 return topicDraft;
}
function setTopicField(which,value){let d=getTopicDraft();if(which==='title')d.title=value;else d.items[which]=value}
function setQuestionField(i,which,j,value){let d=getTopicDraft();if(which==='q')d.qs[i].q=value;else d.qs[i].options[j]=value}
function topicForm(){
 const d=getTopicDraft(),isTier=room.game==='tier';
 const random=`<div class="btns">${action('🎲 例題をランダムで読み込む','loadRandomExample()','gold')}${action('入力をリセット','clearTopic()','alt')}</div><p class="small">各ゲームに50個の例題があります。何度でも引き直せて、すべて編集できます。</p>`;
 const form=isTier?`<label class="labeled" for="own-topic">お題（例：休日に一緒にしたいこと）</label><input id="own-topic" class="field" maxlength="90" value="${esc(d.title)}" placeholder="お題を入力" oninput="setTopicField('title',this.value)">${d.items.map((x,i)=>`<label class="labeled" for="own-item${i}">選択肢 ${i+1}</label><input class="field" id="own-item${i}" maxlength="40" value="${esc(x)}" placeholder="選択肢を入力" oninput="setTopicField(${i},this.value)">`).join('')}`:
 d.qs.map((q,i)=>`<div class="qedit"><div class="qnum">Q${i+1}</div><label class="labeled" for="prompt${i}">質問文</label><input id="prompt${i}" class="field" maxlength="120" value="${esc(q.q)}" placeholder="この人について何を聞く？" oninput="setQuestionField(${i},'q',0,this.value)"><div class="options-grid">${q.options.map((v,j)=>`<label class="edit-option">${'ABCD'[j]}<input class="field" maxlength="80" value="${esc(v)}" placeholder="選択肢${j+1}" oninput="setQuestionField(${i},'option',${j},this.value)"></label>`).join('')}</div></div>`).join('');
 return random+`<div class="composeform">${form}</div><div class="btns">${action('この問題セットを提出する →','submitTopic()')}</div><p class="small">内容を確認してから提出してください。提出後は自分の正解を決めるまで、ほかの人には公開されません。</p>`;
}
function loadRandomExample(){send({type:'example'})}
function clearTopic(){topicDraft=null;render()}
function submitTopic(){
 const d=getTopicDraft();let config;
 if(room.game==='tier'){
   const title=d.title.trim(),items=d.items.map(v=>v.trim());
   if(!title||items.some(x=>!x)||new Set(items).size!==5){error('お題と重複のない5つの選択肢を入力してください');return}
   config={title,items};
 }else{
   const qs=d.qs.map(q=>({q:q.q.trim(),options:q.options.map(x=>x.trim())}));
   if(qs.length!==5||qs.some(x=>!x.q||x.options.some(y=>!y)||new Set(x.options).size!==x.options.length)){
     error('5つの質問と、質問ごとの重複しない選択肢を入力してください');return;
   }
   config={qs};
 }
 send({type:'topic',config});
}
function changeRound(i){selectedRound=Number(i);render()}
function compactChoice(x,config,i){
 if(room.game==='tier')return config.items[x]??'?';
 return config.qs[i]?.options[x]??'?';
}
function compactCode(x,config,i){
 if(room.game==='tier')return compactChoice(x,config,i);
 return room.game==='value'?['①','②','③'][x]:(room.game==='either'?['A','B'][x]:['A','B','C','D'][x]);
}
function compareMatrix(r){
 activeCompare=r;
 const rows=[{name:'★ '+r.targetName+'（正解）',answer:r.truth,score:null,truth:true},
   ...(r.rows||[]).map(v=>({name:v.name,answer:v.guess,score:v.score,truth:false}))];
 const heads=room.game==='tier'?['S','A','B','C','D']:r.truth.map((_,i)=>'Q'+(i+1));
 const matrix=`<table class="compare-table"><thead><tr><th scope="col">回答者</th>${heads.map((v,i)=>`<th scope="col" class="head-${i}">${v}</th>`).join('')}</tr></thead><tbody>${rows.map((row,ri)=>`<tr class="${row.truth?'truth-row':''}"><th scope="row"><span class="rowname">${esc(row.name)}</span><span class="rowpoints">${row.truth?'正解':row.score+'/'+r.truth.length+'一致'}</span></th>${row.answer.map((v,qi)=>{const matched=v===r.truth[qi],label=compactCode(v,r.config,qi),longLabel=compactChoice(v,r.config,qi);return `<td><button type="button" class="mini-cell ${row.truth?'neutral':matched?'match':'miss'}" onclick="inspectCell(${ri},${qi})" aria-label="${esc(row.name+'：'+longLabel)}" title="${esc(longLabel)}">${esc(label)}</button></td>`}).join('')}</tr>`).join('')}</tbody></table>`;
 const help=room.game==='tier'?`<p class="small">S〜D：横に並ぶ5つの順位を一度に比較。選択肢の全文はマスをタップ。</p>`:
 `<details class="question-key"><summary>Q1〜Q5の質問と選択肢を確認</summary>${r.config.qs.map((q,i)=>`<div class="keyitem"><b>Q${i+1} ${esc(q.q)}</b><p>${q.options.map((o,j)=>`${room.game==='value'?['①','②','③'][j]:['A','B','C','D'][j]} ${esc(o)}`).join(' ／ ')}</p></div>`).join('')}</details>`;
 return `<div class="compare-wrap"><div class="compare-caption"><b>★ 正解とみんなの予想</b><span>緑＝一致 / 赤＝不一致</span></div>${matrix}<div id="cell-detail" class="cell-detail" aria-live="polite">マスをタップすると、回答の全文が表示されます。</div>${help}</div>`;
}
function inspectCell(rowIndex,colIndex){
 const r=activeCompare;if(!r)return;
 const rows=[{name:r.targetName+'（正解）',answer:r.truth},...(r.rows||[]).map(x=>({name:x.name,answer:x.guess}))];
 const user=rows[rowIndex],answer=compactChoice(user.answer[colIndex],r.config,colIndex),correct=compactChoice(r.truth[colIndex],r.config,colIndex);
 const q=room.game==='tier'?'Tier '+['S','A','B','C','D'][colIndex]:'Q'+(colIndex+1)+' '+r.config.qs[colIndex].q;
 const cell=document.getElementById('cell-detail');if(cell)cell.textContent=`${user.name}｜${q}：${answer}　（正解：${correct}）`;
}
function editorInit(kind,target){let key=room.matchNo+'_'+kind+'_'+room.game+'_'+(target||'self');if(!draft||draft.key!==key){draft={key,kind,target,arr:room.game==='tier'?[0,1,2,3,4]:Array(room.config.qs.length).fill(null)}}}
function renderEditor(kind,target){editorInit(kind,target);let c=room.config,arr=draft.arr;let html='';if(room.game==='tier'){html=`<p class="small">Sがいちばん上。矢印を使って、5つのワードを並べ替えよう。</p><div class="board">${arr.map((item,i)=>`<div class="tier"><span class="rank r${'SABCD'[i]}">${'SABCD'[i]}</span><span class="itemname">${esc(c.items[item])}</span><div class="arrows"><button ${i===0?'disabled':''} onclick="swap(${i},-1)">↑</button> <button ${i===4?'disabled':''} onclick="swap(${i},1)">↓</button></div></div>`).join('')}</div>`}
else{html=`<p class="small">${c.qs.length}問すべて選んでください。</p><div class="review">${c.qs.map((q,qi)=>`<div class="questionbox"><div class="prompt">${qi+1}. ${esc(q.q)}</div><div class="choices">${q.options.map((o,oi)=>`<button class="choice ${arr[qi]===oi?'on':''}" onclick="chooseAnswer(${qi},${oi})">${arr[qi]===oi?'✓ ':''}${esc(o)}</button>`).join('')}</div></div>`).join('')}</div>`}
let filled=room.game==='tier'||arr.every(v=>v!==null);html+=`<div class="btns"><button class="btn" ${filled?'':'disabled'} onclick="submitDraft()">${kind==='answer'?'秘密の正解を登録する':'この予想を送信する'} →</button></div>`;return `<div id="editor">${html}</div>`}
function chooseAnswer(q,v){draft.arr[q]=v;const ed=document.getElementById('editor');if(ed)ed.innerHTML=renderEditor(draft.kind,draft.target)}
function swap(pos,delta){let j=pos+delta;if(j<0||j>=5)return;[draft.arr[pos],draft.arr[j]]=[draft.arr[j],draft.arr[pos]];const ed=document.getElementById('editor');if(ed)ed.innerHTML=renderEditor(draft.kind,draft.target)}
function submitDraft(){if(!draft||room.game!=='tier'&&draft.arr.some(v=>v===null))return;send({type:draft.kind==='answer'?'answer':'guess',answers:draft.arr})}

// Create shareable result images locally. No screenshots or player answers leave the browser.
function getExportRounds(which){
 if(!room || !['reveal','final'].includes(room.phase)) return [];
 if(room.phase==='reveal')return room.reveal?[room.reveal]:[];
 const hist=room.history||[];
 return which==='all'?hist:(hist[selectedRound]?[hist[selectedRound]]:[]);
}
function makeResultCanvas(which){
 const rounds=getExportRounds(which);
 if(!rounds.length)throw Error('まだ共有できる結果がありません');
 const isAll=which==='all'&&room.phase==='final';
 const W=1120, M=46, colStart=304, cellW=(W-M-colStart)/5, rowH=52;
 const cards=rounds.map(r=>({r,people:[{name:r.targetName+'（正解）',truth:true,score:null,answer:r.truth},...(r.rows||[]).map(x=>({name:x.name,truth:false,score:x.score,answer:x.guess}))],legend:room.game==='tier'?5:5}));
 const headerH=isAll?205+Math.ceil((room.players?.length||0)/3)*39:140;
 const cardH=c=>116+rowH*(c.people.length+1)+(room.game==='tier'?116:260);
 const H=headerH+cards.reduce((v,c)=>v+cardH(c)+20,0)+72;
 if(H>16000)throw Error('全ラウンドの画像が大きすぎます。1ラウンドずつ保存してください');
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像作成に対応していないブラウザです');
 ctx.fillStyle='#fff9fc';ctx.fillRect(0,0,W,H);
 const draw=(txt,x,y,size=22,color='#392d3a',weight='700',maxWidth=null)=>{
   ctx.font=`${weight} ${size}px system-ui, "Noto Sans JP", sans-serif`;
   let value=String(txt??'');
   if(maxWidth){while(value.length>1&&ctx.measureText(value).width>maxWidth)value=value.slice(0,-2)+'…'}
   ctx.fillStyle=color;ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(value,x,y);
 };
 const card=(x,y,w,h,color,stroke=null)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h)}};
 card(0,0,W,16,'#ef3a9d');
 draw('♡ なかみくらべ。',M,59,39,'#e73596','900');
 draw(isAll?'みんなの最終結果':'主役の答えを当てよう！',M,110,30,'#483448','900');
 let y=headerH;
 if(isAll){
   const ranked=[...(room.players||[])].sort((a,b)=>b.score-a.score);
   draw('理解度ランキング',M,151,20,'#9d3873','900');
   ranked.forEach((p,i)=>{
     const j=Math.floor(i/3),k=i%3;
     const yy=185+j*39;
     card(M+k*338,yy-15,325,32,'#ffeaf4');
     draw(`${i+1}位  ${p.name}`,M+8+k*338,yy,16,'#613d56','850',220);
     draw(`${p.score} pt`,M+237+k*338,yy,15,'#b52d7e','900',80);
   });
 }
 for(let ri=0;ri<cards.length;ri++){
  const c=cards[ri],r=c.r,height=cardH(c);
  card(M,y,W-M*2,height-10,'#ffffff','#edcede');
  card(M,y,W-M*2,6,'#eb3695');
  draw(`ROUND ${isAll?ri+1:room.phase==='reveal'?room.roundIndex+1:selectedRound+1}  |  ${r.targetName} さんの正解`,M+18,y+36,25,'#a52873','900',W-2*M-36);
  draw(r.config.title,M+18,y+79,22,'#513d52','850',W-2*M-36);
  const top=y+104;
  card(M+12,top, W-2*M-24,44,'#fbe8f2');
  draw('プレイヤー',M+26,top+23,17,'#753a61','850');
  const headers=room.game==='tier'?['S','A','B','C','D']:['Q1','Q2','Q3','Q4','Q5'];
  headers.forEach((v,i)=>draw(v,colStart+i*cellW+cellW*.41,top+23,22,'#a12d78','900'));
  for(let pi=0;pi<c.people.length;pi++){
   const person=c.people[pi],yy=top+44+pi*rowH;
   card(M+12,yy,W-2*M-24,rowH-2,person.truth?'#fff1c5':pi%2===0?'#fff8fc':'#ffffff');
   draw(person.name,M+23,yy+18,16,person.truth?'#794a27':'#603a52','850',208);
   draw(person.truth?'正解':`${person.score??0} / ${r.truth.length} 一致`,M+23,yy+38,13,'#92758a','700',207);
   for(let qi=0;qi<5;qi++){
    const x=colStart+qi*cellW, v=person.answer[qi];
    const correct=person.truth||r.truth[qi]===v;
    card(x+2,yy+4,cellW-7,rowH-10,person.truth?'#fbe2a7':correct?'#d6f4e1':'#ffdde7');
    const raw=room.game==='tier'?(r.config.items[v]||'?'):
      (room.game==='value'?['①','②','③'][v]:room.game==='either'?['A','B'][v]:['A','B','C','D'][v])||'?';
    draw(raw,x+8,yy+rowH/2,16,person.truth?'#734d26':correct?'#266d50':'#a54364','850',cellW-22);
   }
  }
  let legendY=top+44+c.people.length*rowH+24;
  draw('項目・質問の詳細',M+24,legendY,17,'#ae367a','900');
  if(room.game==='tier'){
   for(let qi=0;qi<5;qi++){
    const xx=M+24+(qi%3)*323,ly=legendY+26+Math.floor(qi/3)*34;
    draw(`${'SABCD'[qi]}  ${r.config.items[r.truth[qi]]}`,xx,ly,15,'#735d72','800',303);
   }
  }else{
   for(let qi=0;qi<5;qi++){
    const ly=legendY+29+qi*38,q=r.config.qs[qi];
    draw(`Q${qi+1}  ${q.q}`,M+24,ly,15,'#735d72','800',690);
    const ans=q.options[r.truth[qi]]||'';
    draw(`正解: ${ans}`,M+754,ly,15,'#a83878','850',285);
   }
  }
  y+=height+20;
 }
 draw('結果は各参加者の予想に基づきます。',M,H-38,16,'#98788d','600');
 return canvas;
}
function resultFileName(which){
 const key=room?.game||'result';const suffix=which==='all'?'all-rounds':'round-'+((room?.roundIndex??selectedRound)+1);
 return `nakamikurabe-${key}-${suffix}.png`;
}
async function resultImageBlob(which){
 const canvas=makeResultCanvas(which);
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像に変換できませんでした')),'image/png'));
}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function saveResultImage(which){
 try{const blob=await resultImageBlob(which);saveBlob(blob,resultFileName(which))}
 catch(e){alert('画像の保存に失敗しました：'+e.message)}
}
async function shareResultImage(which){
 try{
  const blob=await resultImageBlob(which),name=resultFileName(which);
  const file=new File([blob],name,{type:'image/png'});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:'なかみくらべ。の結果'});return}
    catch(e){if(e.name==='AbortError')return}
  }
  saveBlob(blob,name);
  alert('画像を保存しました。Discordなどのチャットに添付して共有してください。');
 }catch(e){alert('画像の共有に失敗しました：'+e.message)}
}

landing();let roomParam=new URLSearchParams(location.search).get('room');let savedName=sessionStorage.getItem('nakami_name');if(roomParam&&savedName){document.getElementById('nickname').value=savedName;document.getElementById('roomcode').value=roomParam.toUpperCase();connectNow('join')}
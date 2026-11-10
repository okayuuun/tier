'use strict';
/* Independent digital adaptations of card and word-game mechanisms. */
const BOARD_PLUS_GAMES=['royalletter','cipherrelay','skyfire','scoutline','aiuebattle'];
let scStart=0,scLength=1;
const bpBtn=(s,cmd,variant='alt')=>action(s,cmd,variant);
const bpN=id=>room.players.find(x=>x.id===id)?.name||'参加者';
const bpE=s=>esc(s??'');
function bpField(id,title,placeholder='',max=60){
 return '<label class="labeled" for="'+id+'">'+bpE(title)+'</label>'+
 '<input class="field" id="'+id+'" maxlength="'+max+'" placeholder="'+bpE(placeholder)+'" autocomplete="off">';
}
function bpScores(){return '<div class="bp-scores">'+room.players.map(x=>
 '<span>'+bpE(x.emoji||'🌷')+' '+bpE(x.name)+' <b>'+x.score+'点</b></span>').join('')+'</div>'}
function bpPage(title,html){
 const p=room.boardplus;const isRound=!['skyfire','cipherrelay'].includes(room.game);
 const progress=room.game==='skyfire'?'協力・一局勝負':'ROUND '+(Math.min(p.round+1,p.roundLimit))+' / '+p.roundLimit;
 app.innerHTML=panel('BOARD / '+GAMES[room.game].title,title,
 roomBar()+'<div class="bp-top"><strong>'+progress+'</strong><span>'+bpE(GAMES[room.game].desc)+'</span></div>'+
 html+bpScores()+'<p id="err" class="error" hidden></p>')
}
function bpWinners(){
 const g=room.game,p=room.boardplus,owner=room.owner===me;
 let html='<div class="bp-hero">🏆 最終結果</div>';
 if(g==='royalletter'||g==='aiuebattle'||g==='scoutline'){
  html+='<div class="bp-history">'+(p.history||[]).map((r,i)=>
   '<div>ROUND '+(i+1)+'：'+bpE(r.winnerName||(r.winnerNames||[]).join('・')||'終了')+'</div>').join('')+'</div>';
 }else if(g==='cipherrelay'){
  html+='<div class="bp-highlight">🔴 赤 '+p.teamScores.red+' 点　｜　🔵 青 '+p.teamScores.blue+' 点</div>';
 }else if(g==='skyfire'){
  html+='<div class="bp-highlight">🎆 花火 '+Object.values(p.progress).reduce((a,b)=>a+b,0)+' / 12 点</div>';
 }
 html+='<div class="btns">'+(owner?bpBtn('同じメンバーでもう一度','send({type:"restart"})','gold'):'')+
  bpBtn('タイトルへ戻る','leaveToTitle()')+'</div>';
 bpPage('ゲーム終了',html)
}
function bpRoyal(){
 const p=room.boardplus,phase=room.phase,owner=room.owner===me;
 const desc={1:'相手の数字を予想して的中なら脱落',2:'手札の数字を大切に残す',3:'相手と数字を比べて弱い方が脱落',
 4:'次の自分の手番まで相手の効果を防ぐ',5:'相手と手札を交換',6:'相手の手札を強制交換',
 7:'高い数字で勝負',8:'このカードを捨てると脱落'};
 let html='<div class="bp-hero">💌 密書の駆け引き <small>『ラブレター』の手札推理を参考にしたオリジナルカード対戦</small></div>'+
 '<p class="bp-help">1人1枚の秘密のカードを持ち、手番に追加でもう1枚引いて1枚使います。最後まで生き残るか、最高の数字を残して勝ちましょう。</p>'+
 '<div class="bp-stats">🎲 残り山札 '+p.deckCount+' 枚｜手番：'+bpE(bpN(p.turn))+
 '｜脱落：'+p.gone.map(bpN).map(bpE).join('・')+'</div>';
 html+='<div class="bp-history">'+p.discards.map(x=>
  '<div>'+bpE(bpN(x.by))+' がカード '+x.card+' を使用'+(x.target?' → '+bpE(bpN(x.target)):'')+'</div>').join('')+'</div>';
 if(phase==='bp_royal'){
  if(p.gone.includes(me))html+='<div class="bp-wait">あなたは今回の勝負から脱落しました。結果をお待ちください。</div>';
  else html+='<div class="bp-role">あなたの手札：<strong>'+p.hand+'｜'+bpE(desc[p.hand])+'</strong></div>';
  if(p.turn===me){
   html+='<div class="bp-card-grid">'+[p.hand,p.drawn].map((card,i)=>
    '<div class="bp-card"><strong>'+card+'</strong><small>'+bpE(desc[card])+'</small>'+
    bpBtn('このカードを使用','bpRoyalPlay('+i+')','gold')+'</div>').join('')+'</div>';
   html+='<label class="labeled" for="bp-target">対象プレイヤー（対象が必要な効果のみ）</label>'+
    '<select id="bp-target" class="field"><option value="">対象なし</option>'+
    room.active.filter(x=>x!==me&&!p.gone.includes(x)).map(x=>'<option value="'+bpE(x)+'">'+bpE(bpN(x))+'</option>').join('')+
    '</select><label class="labeled" for="bp-guess">予想カードの数字（1の効果で使用）</label>'+
    '<select id="bp-guess" class="field">'+Array.from({length:8},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join('')+'</select>';
  }else html+='<div class="bp-wait">手番のプレイヤーを待っています。</div>';
 }else{
  const r=p.last;
  html+='<div class="bp-highlight">今回の勝者：<strong>'+bpE(r.winnerNames.join('・'))+'</strong></div>';
  html+='<div class="bp-history">'+Object.entries(r.hands).map(([id,n])=>
  '<div>'+bpE(bpN(id))+' の最後のカード：'+n+'</div>').join('')+'</div>';
  if(owner)html+='<div class="btns">'+bpBtn('次のラウンドへ','send({type:"rl_next"})','gold')+'</div>'
 }
 bpPage('相手の数字を読み切ろう',html)
}
function bpRoyalPlay(i){
 const p=room.boardplus;
 const card=[p.hand,p.drawn][i];
 const target=document.getElementById('bp-target')?.value||null;
 const guess=Number(document.getElementById('bp-guess')?.value||1);
 send({type:'rl_play',card,target,guess})
}
function bpCipher(){
 const p=room.boardplus,owner=room.owner===me,phase=room.phase,team=p.team;
 let html='<div class="bp-hero">🔐 ひみつの暗号便 <small>『デクリプト』の暗号伝達を参考にした独自チーム戦</small></div>'+
 '<div class="bp-teams">🔴 赤 '+p.teamScores.red+' 点　　🔵 青 '+p.teamScores.blue+' 点</div>'+
 '<div class="bp-role">あなたのチーム：'+(team==='red'?'🔴 赤':'🔵 青')+
 '<div class="bp-keygrid">'+p.words.map((w,i)=>'<span><b>'+(i+1)+'</b> '+bpE(w)+'</span>').join('')+'</div></div>'+
 '<div class="bp-stats">今回の暗号送信：'+(p.side==='red'?'🔴 赤':'🔵 青')+'｜ヒント役 '+bpE(bpN(p.clueGiver))+
 '｜味方の推理役 '+bpE(bpN(p.guesser))+'｜相手の盗聴役 '+bpE(bpN(p.interceptor))+'</div>';
 if(phase==='bp_cipher_clue'){
  if(me===p.clueGiver){
   html+='<div class="bp-highlight">秘密コード：<strong>'+p.code.join(' - ')+'</strong></div>';
   html+='<p class="bp-help">この並びを伝える3つのヒントを書いてください。あなたのチームの4つの単語を参考に。</p>';
   for(let i=0;i<3;i++)html+=bpField('bp-clue-'+i,'ヒント '+(i+1),'一語で表現',25);
   html+='<div class="btns">'+bpBtn('3つのヒントを送信','bpCipherClue()','gold')+'</div>';
  }else html+='<div class="bp-wait">ヒント役が秘密の数字を言葉に変えています…</div>';
  if(owner)html+='<div class="btns">'+bpBtn('ヒントなしで進める','send({type:"dc_skip"})')+'</div>';
 }else if(phase==='bp_cipher_guess'){
  html+='<div class="bp-hints">'+p.clues.map((x,i)=>'<div>'+ (i+1)+'. '+bpE(x)+'</div>').join('')+'</div>';
  const role=me===p.guesser?'味方の解読係':me===p.interceptor?'相手の暗号を盗聴する係':null;
  const already=me===p.guesser?p.submitted.own:me===p.interceptor?p.submitted.intercept:true;
  if(role&&!already){
   html+='<div class="bp-role">'+role+'：3つのヒントに対応する「異なる数字」を選ぼう。</div><div class="bp-code-row">';
   for(let i=0;i<3;i++)html+='<select class="field" id="bp-code-'+i+'">'+
    [1,2,3,4].map(n=>'<option value="'+n+'" '+(n===i+1?'selected':'')+'>'+n+'</option>').join('')+'</select>';
   html+='</div><div class="btns">'+bpBtn('この数字で予想を確定','bpCipherGuess()','gold')+'</div>';
  }else html+='<div class="bp-wait">'+(already?'解読結果を待っています。':'ほかの人の推理を待っています。')+'</div>';
  if(owner)html+='<div class="btns">'+bpBtn('ここまでで答え合わせ','send({type:"dc_skip"})')+'</div>';
 }else{
  const r=p.last;
  html+='<div class="bp-highlight">正解：<strong>'+r.code.join(' - ')+'</strong><small>'+
   (r.ownCorrect?'味方が解読成功！':'味方は失敗')+' / '+(r.interceptCorrect?'盗聴成功！':'盗聴は失敗')+
   '</small></div><div class="bp-hints">'+r.clues.map(x=>'<div>'+bpE(x)+'</div>').join('')+'</div>';
  if(owner)html+='<div class="btns">'+bpBtn('次の暗号へ','send({type:"dc_next"})','gold')+'</div>';
 }
 bpPage('ヒントを組み立てて秘密の数字を伝えよう',html)
}
function bpCipherClue(){
 const words=[0,1,2].map(i=>document.getElementById('bp-clue-'+i)?.value.trim()||'');
 if(words.some(x=>!x))return error('3つのヒントを入力してください');
 send({type:'dc_clue',words})
}
function bpCipherGuess(){
 const numbers=[0,1,2].map(i=>Number(document.getElementById('bp-code-'+i)?.value));
 if(new Set(numbers).size!==3)return error('同じ数字は選べません');
 send({type:'dc_guess',numbers})
}
function bpFire(){
 const p=room.boardplus,turn=p.turn===me;
 let html='<div class="bp-hero">🎆 みんなの花火 <small>『花火（Hanabi）』の他人にだけ見える手札を参考にした協力ゲーム</small></div>'+
 '<div class="bp-stats">❤️ 残りライフ：'+p.lives+'　💡 ヒント：'+p.hints+' / 6　🂠 山札：'+p.deckCount+
 '　手番：'+bpE(bpN(p.turn))+'</div>'+
 '<div class="bp-fireworks">'+Object.entries(p.progress).map(([c,n])=>
 '<div><strong>'+bpE(c)+'の花火</strong><span>'+n+' / 4</span><div class="bp-meter"><i style="width:'+n*25+'%"></i></div></div>').join('')+'</div>';
 html+='<p class="bp-help">**自分のカードは見えません。** ほかの人に見えるカードを参考に、色や数字のヒントを送ろう。1→4の順に各色を完成させると成功！</p>';
 for(const [pid,hand] of Object.entries(p.hands)){
  html+='<div class="bp-person"><strong>'+bpE(bpN(pid))+(pid===me?'（自分／カードは隠し表示）':'')+'</strong>'+
   '<div class="bp-card-grid">'+hand.map((card,i)=>'<div class="bp-card bp-small"><strong>'+
    bpE(card.c||'？')+' '+(card.n||'？')+'</strong>'+
    (pid===me&&turn?'<div class="bp-inline">'+bpBtn('出す','bpFireAct("hf_play",'+i+')','gold')+
     bpBtn('捨てる','bpFireAct("hf_discard",'+i+')')+'</div>':'')+
    (pid!==me&&turn&&p.hints>0?'<div class="bp-inline">'+
     bpBtn('色を伝える', 'bpFireHint('+JSON.stringify(pid)+',"c",'+JSON.stringify(card.c)+')')+
     bpBtn('数字を伝える','bpFireHint('+JSON.stringify(pid)+',"n",'+card.n+')')+
     '</div>':'')+'</div>').join('')+'</div></div>';
 }
 html+='<div class="bp-history">'+(p.played||[]).slice(-8).reverse().map(x=>
 '<div>'+bpE(bpN(x.by))+'：'+bpE(x.event==='hint'?'ヒント':x.event==='hf_play'?'カードを出す':'カードを捨てる')+
 (x.c?' '+bpE(x.c)+x.n:'')+'</div>').join('')+'</div>';
 bpPage('手札を教えあって花火を完成させよう',html)
}
function bpFireAct(type,index){send({type,index})}
function bpFireHint(target,axis,value){send({type:'hf_hint',target,axis,value})}
function bpScout(){
 const p=room.boardplus,owner=room.owner===me,turn=me===p.turn;
 let html='<div class="bp-hero">🎪 スカウト・ライン <small>『スカウト』の「手札を並び替えない」発想を参考にしたカード戦</small></div>'+
 '<div class="bp-stats">手番：'+bpE(bpN(p.turn))+'｜今回のカード取得：'+(p.scouted[me]||0)+' / 3 回'+
 '｜残り手札 '+p.myHand.length+' 枚</div>'+
 '<div class="bp-role">中央のカード</div><div class="bp-card-grid">'+
 (p.field.length?p.field.map((n,i)=>'<div class="bp-card bp-small"><strong>'+n+'</strong>'+
 (turn&&p.scouted[me]<3?'<div class="bp-inline">'+bpBtn('左へ取る','bpScoutGet('+i+',"left")')+
 bpBtn('右へ取る','bpScoutGet('+i+',"right")')+'</div>':'')+'</div>').join(''):'<p class="bp-wait">場は空です。自由に出せます。</p>')+'</div>';
 html+='<div class="bp-role">あなたの手札：順番は変更できません</div><div class="bp-card-grid">'+p.myHand.map((n,i)=>
 '<button class="bp-card bp-pick '+(scStart===i?'bp-selected':'')+'" onclick="bpSetStart('+i+')">'+
 '<strong>'+n+'</strong><small>'+(i+1)+'枚目</small></button>').join('')+'</div>';
 if(turn){
  html+='<label class="labeled" for="bp-length">選択位置から何枚を連続して出す？（同じ数 or 連番）</label>'+
    '<select class="field" id="bp-length" onchange="scLength=Number(this.value)">'+
    [1,2,3,4].map(n=>'<option value="'+n+'" '+(scLength===n?'selected':'')+'>'+n+'枚</option>').join('')+'</select>'+
    '<p class="bp-help">選択中：'+(scStart+1)+'枚目から '+scLength+'枚。場より多い枚数、または同数で合計の大きなカードが出せます。</p>'+
    '<div class="btns">'+bpBtn('この組を出す','bpScoutPlay()','gold')+
    bpBtn('出せないのでパス（−1点）','send({type:"sc_skip"})')+'</div>';
 }else html+='<div class="bp-wait">ほかの人の手番です。</div>';
 if(room.phase==='bp_scout_reveal'){
  html+='<div class="bp-highlight">今回の最多得点者：<strong>'+bpE(p.last.winnerName)+'</strong></div>';
  if(owner)html+='<div class="btns">'+bpBtn('次のゲームへ','send({type:"sc_next"})','gold')+'</div>';
 }
 bpPage('カードを並べ替えず、強い組をつくろう',html)
}
function bpSetStart(i){scStart=i;render()}
function bpScoutPlay(){send({type:'sc_play',start:scStart,length:scLength})}
function bpScoutGet(index,side){send({type:'sc_scout',index,side})}
const BP_KANA='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー';
function bpAiue(){
 const p=room.boardplus,phase=room.phase,owner=room.owner===me;
 let html='<div class="bp-hero">🔤 ひらがな文字バトル <small>人気の『あいうえバトル』を参考にしたWeb向けオリジナル文字推理</small></div>'+
 '<div class="bp-highlight">今回のお題：<strong>'+bpE(p.theme)+'</strong></div>';
 if(phase==='bp_ai_write'){
  if(owner&&p.submitted.length===0)html+=bpField('bp-theme','主催者：お題を変更できる','例：食べ物、動物、赤いもの',40)+
   '<div class="btns">'+bpBtn('お題を変更','bpAiTheme()')+'</div>';
  if(!p.submitted.includes(me))html+=bpField('bp-secret','お題に合う2〜7文字のひらがなを秘密で入力',
   '例：かすてら、ぺんぎん',14)+
   '<p class="bp-help">濁点・半濁点や小文字は自動で通常のかなに変わります。漢字は入力できません。</p>'+
   '<div class="btns">'+bpBtn('この秘密の言葉に決定','bpAiWrite()','gold')+'</div>';
  else html+='<div class="bp-wait">✅ 秘密の言葉を登録しました。全員の提出を待っています。</div>';
  html+='<div class="bp-stats">提出済み '+p.submitted.length+' / '+room.active.length+'人</div>';
 }else{
  html+='<div class="bp-stats">現在の攻撃役：'+bpE(bpN(p.turn))+
   '｜宣言済み '+p.called.length+' 文字｜残り '+(room.active.length-p.out.length)+' 人</div>';
  html+='<div class="bp-words">'+room.active.map(who=>{
   const board=p.boards[who],out=p.out.includes(who);
   const cells=board?board.letters.map(x=>'<span class="bp-letter">'+bpE(x||'？')+'</span>').join(''):'未提出';
   return '<div class="bp-word"><strong>'+bpE(bpN(who))+(who===me?'（自分）':'')+
    (out?'　脱落':'')+'</strong><div>'+cells+'</div></div>';
  }).join('')+'</div>';
  html+='<div class="bp-stats">攻撃済み：'+(p.called.join('・')||'まだなし')+'</div>';
  if(phase==='bp_ai_attack'){
   if(me===p.turn){
    html+='<p class="bp-help">他の人の言葉にありそうな1文字を選んで攻撃！誰かの文字に当たれば連続で攻撃できます。</p>'+
    '<div class="bp-kana-grid">'+[...BP_KANA].map(k=>
     '<button '+(p.called.includes(k)?'disabled':'onclick="bpAiAttack('+JSON.stringify(k)+')"')+
      '>'+bpE(k)+'</button>').join('')+'</div>';
   }else html+='<div class="bp-wait">ほかのプレイヤーの攻撃を待っています。</div>';
  }else{
   html+='<div class="bp-highlight">勝者：<strong>'+bpE(p.last.winnerName)+'</strong></div>'+
   '<div class="bp-history">'+Object.entries(p.last.words).map(([pid,word])=>
    '<div>'+bpE(bpN(pid))+'：'+bpE(word)+'</div>').join('')+'</div>';
   if(owner)html+='<div class="btns">'+bpBtn('次の勝負へ','send({type:"ai_next"})','gold')+'</div>';
  }
  html+='<div class="bp-history">'+p.attacks.slice(-6).reverse().map(a=>
   '<div>'+bpE(bpN(a.by))+'が「'+bpE(a.letter)+'」で攻撃 → '+a.count+'文字公開</div>').join('')+'</div>';
 }
 bpPage('ひらがなで相手の隠し言葉を暴こう',html)
}
function bpAiTheme(){
 const theme=document.getElementById('bp-theme')?.value.trim()||'';
 if(!theme)return error('お題を入力してください');
 send({type:'ai_theme',theme})
}
function bpAiWrite(){
 const word=document.getElementById('bp-secret')?.value.trim()||'';
 if(!word)return error('ひらがなを入力してください');
 send({type:'ai_write',word})
}
function bpAiAttack(letter){send({type:'ai_attack',letter})}
function renderBoardPlus(){
 if(!room||!BOARD_PLUS_GAMES.includes(room.game))return;
 if(room.phase==='final')return bpWinners();
 if(room.game==='royalletter')return bpRoyal();
 if(room.game==='cipherrelay')return bpCipher();
 if(room.game==='skyfire')return bpFire();
 if(room.game==='scoutline')return bpScout();
 if(room.game==='aiuebattle')return bpAiue();
}

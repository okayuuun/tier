'use strict';
/* Original digital adaptations of five classic party-board-game mechanisms. */
const BOARD_GAMES=['oneword','spectrum','quiet','bluff','wordagents'];
let boardSpectrumDraft=50;
function baButton(title,fn,style){return action(title,fn,style||'alt')}
function baName(id){return room.players.find(p=>p.id===id)?.name||'プレイヤー'}
function baInput(id,label,placeholder,max){
 return '<label class="labeled" for="'+id+'">'+esc(label)+'</label>'+
  '<input class="field" id="'+id+'" placeholder="'+esc(placeholder||'')+'" maxlength="'+(max||60)+'" autocomplete="off">';
}
function baScoreboard(){
 return '<div class="ba-scoreboard">'+room.players.map(p=>
  '<div class="ba-score"><span>'+esc(p.emoji||'🌷')+' '+esc(p.name)+'</span><b>'+p.score+' pt</b></div>'
 ).join('')+'</div>'
}
function baPage(title,content){
 const b=room.board;
 const progress=room.game==='quiet'?'STAGE '+b.stage+' / '+b.roundLimit:
  room.game==='wordagents'?'RED VS BLUE':'ROUND '+(b.round+1)+' / '+b.roundLimit;
 app.innerHTML=panel('BOARD GAMES / '+GAMES[room.game].title,title,
  roomBar()+'<div class="ba-progress"><strong>'+esc(progress)+'</strong>'+
  '<span>'+esc(GAMES[room.game].desc)+'</span></div>'+
  content+baScoreboard()+'<p id="err" class="error" hidden></p>')
}
function baSendText(type,id){
 const text=document.getElementById(id)?.value.trim()||'';
 if(!text)return error('言葉を入力してください');
 send({type,text})
}
function baForce(type){send({type})}
function baNext(type){send({type})}
function baFinal(){
 const b=room.board,game=room.game,owner=room.owner===me;
 let msg='<div class="ba-hero"><strong>🎊 おつかれさま！</strong>今回の結果を振り返ろう</div>';
 if(game==='wordagents'){
  const who=b.winner==='red'?'🔴 赤チーム':b.winner==='blue'?'🔵 青チーム':'勝敗なし';
  msg+='<div class="ba-highlight">'+who+' が勝ちました！</div>';
 }else if(game==='quiet'){
  msg+='<div class="ba-highlight">'+(b.lives>0&&b.stage===b.roundLimit?'全ステージ成功！':'ここまでの挑戦終了')+
   '　残りライフ '+b.lives+'</div>';
 }else if(game==='bluff'){
  msg+='<div class="ba-highlight">⭐ '+room.players.map(p=>esc(p.name)+'：'+(b.stars[p.id]||0)+'勝').join(' / ')+'</div>';
 }else{
  msg+='<div class="ba-highlight">全ラウンド終了！</div>';
 }
 if(b.history&&b.history.length){
  msg+='<div class="ba-history">'+b.history.map((r,i)=>{
   let label='第'+(i+1)+'ラウンド';
   if(game==='oneword')label+='　'+esc(r.word)+'：'+(r.correct?'成功':'失敗');
   if(game==='spectrum')label+='　正解位置 '+r.target;
   if(game==='bluff')label+='　'+(r.success?'成功':'失敗');
   if(game==='quiet')label+='　ステージ '+r.stage;
   return '<div>'+label+'</div>'
  }).join('')+'</div>'
 }
 msg+='<div class="btns">'+(owner?baButton('同じメンバーでもう一度','send({type:"restart"})','gold'):'')+
  baButton('タイトルへ戻る','leaveToTitle()','alt')+'</div>';
 baPage('ゲーム終了',msg)
}
function baOneWord(){
 const p=room.board,phase=room.phase,owner=room.owner===me,guesser=me===p.guesser;
 let body='<div class="ba-hero">🧩 ひとことヒント <small>『Just One』式の協力ゲームを参考にした簡略版</small></div>';
 body+='<div class="ba-role">'+(guesser?'🎯 あなたは回答担当です！':'🎙️ 今回の回答者：'+esc(baName(p.guesser)))+'</div>';
 if(phase==='bg_hint'){
  if(guesser)body+='<p class="ba-wait">仲間がヒントを考えています。答えのお題はまだ見えません。</p>';
  else{
   body+='<div class="ba-highlight">今回の秘密のお題：<strong>'+esc(p.word)+'</strong></div>';
   if(!p.mine){
    body+=baInput('ba-one-hint','お題を連想できる一語のヒント','例：空、甘い、休日',35)+
     '<div class="btns">'+baButton('ヒントを提出','baSendText("bg_hint","ba-one-hint")','gold')+'</div>';
   }else body+='<div class="ba-wait">✅ ヒントを提出しました。ほかの人を待っています。</div>';
  }
  body+='<div class="ba-stats">提出済み '+p.count+' / '+(room.active.length-1)+'人</div>';
  if(owner)body+='<div class="btns">'+baButton('今のヒントで回答へ','baForce("bg_skip")')+'</div>';
 }else if(phase==='bg_guess'){
  body+='<p class="ba-help">同じ言葉のヒントは自動で除外されています。</p>';
  if(!p.clues.length)body+='<div class="ba-wait">使えるヒントはありません。</div>';
  else body+='<div class="ba-hints">'+p.clues.map(x=>
   '<span class="ba-chip">'+esc(x.text)+'</span>').join('')+'</div>';
  if(guesser){
   body+=baInput('ba-one-answer','ヒントから秘密のお題を当てよう','回答は1回だけ',60)+
    '<div class="btns">'+baButton('この答えで確定','baSendText("bg_answer","ba-one-answer")','gold')+'</div>';
  }else body+='<div class="ba-wait">答えは「'+esc(p.word)+'」。回答役の予想を待っています。</div>';
  if(owner)body+='<div class="btns">'+baButton('回答せずに正解公開','baForce("bg_skip")')+'</div>';
 }else if(phase==='bg_reveal'){
  const r=p.last;
  body+='<div class="ba-highlight">'+(r.correct?'🎉 正解！ +1点':'今回は残念！')+
   '<strong>'+esc(r.word)+'</strong><small>回答：'+esc(r.answer||'パス')+'</small></div>';
  body+='<div class="ba-hints">'+r.clues.map(x=>'<span class="ba-chip '+(x.duplicate?'ba-duplicate':'')+'">'+
   esc(x.text)+(x.duplicate?'（重複）':'')+'</span>').join('')+'</div>';
  if(owner)body+='<div class="btns">'+baButton('次のお題へ','baNext("bg_next")','gold')+'</div>'
 }
 baPage('ヒントをかぶらせずに伝えよう',body)
}
function baSpectrum(){
 const p=room.board,phase=room.phase,guide=me===p.guide,owner=room.owner===me;
 let body='<div class="ba-hero">🌡️ 感覚メーター <small>『Wavelength』の発想を参考にした数字当てアレンジ</small></div>';
 body+='<div class="ba-axis"><strong>'+esc(p.axis[0])+'</strong><span>0 ───── 50 ───── 100</span><strong>'+esc(p.axis[1])+'</strong></div>';
 body+='<div class="ba-role">ヒント役：'+esc(baName(p.guide))+'</div>';
 if(phase==='sp_clue'){
  if(guide){
   body+='<div class="ba-highlight">あなただけが見える正解位置 <strong>'+p.target+' / 100</strong></div>';
   body+=baInput('ba-spectrum-clue','その場所らしいものを言葉で表現','例：おにぎり、屋台、テーマパーク',70)+
    '<div class="btns">'+baButton('ヒントを公開','baSendText("sp_clue","ba-spectrum-clue")','gold')+'</div>';
  }else body+='<div class="ba-wait">ヒント役が0〜100の秘密位置を見て言葉を考えています。</div>';
  if(owner)body+='<div class="btns">'+baButton('ヒントなしで進める','baForce("sp_force")')+'</div>';
 }else if(phase==='sp_guess'){
  body+='<div class="ba-highlight">ヒント：<strong>'+esc(p.clue)+'</strong></div>';
  if(guide)body+='<p class="ba-wait">あなたが示した位置：'+p.target+'。みんなの予想を待っています。</p>';
  else if(p.guessed)body+='<div class="ba-wait">✅ あなたの予想：'+p.myGuess+' / 100。公開まで待機中です。</div>';
  else body+='<label class="labeled" for="ba-spectrum-range">秘密の位置を予想</label>'+
    '<div class="ba-range-line"><input type="range" id="ba-spectrum-range" min="0" max="100" value="'+boardSpectrumDraft+'" oninput="boardSpectrumDraft=Number(this.value);document.getElementById('+'\'ba-spectrum-value\''+').textContent=this.value"><b id="ba-spectrum-value">'+boardSpectrumDraft+'</b></div>'+
    '<div class="btns">'+baButton('この数字で予想','baSendSpectrum()','gold')+'</div>';
  body+='<p class="ba-stats">予想 '+p.guessCount+' / '+(room.active.length-1)+'人</p>';
  if(owner)body+='<div class="btns">'+baButton('ここまでで答え合わせ','baForce("sp_force")')+'</div>';
 }else if(phase==='sp_reveal'){
  const r=p.last;
  body+='<div class="ba-highlight">正解位置 <strong>'+r.target+' / 100</strong><small>ヒント：'+esc(r.clue)+'</small></div>';
  body+='<div class="ba-results">'+r.guesses.map(x=>'<div><strong>'+esc(x.name)+'</strong><span>'+
   x.guess+'（差 '+x.distance+'）</span><b>+'+x.points+'点</b></div>').join('')+'</div>';
  if(owner)body+='<div class="btns">'+baButton('次のテーマへ','baNext("sp_next")','gold')+'</div>';
 }
 baPage('みんなの感覚は合っている？',body)
}
function baSendSpectrum(){send({type:'sp_guess',number:boardSpectrumDraft})}
function baQuiet(){
 const p=room.board,owner=room.owner===me;
 let body='<div class="ba-hero">🤫 無言の数字 <small>『The Mind』の昇順協力を参考にした3ステージ版</small></div>';
 body+='<p class="ba-help">秘密の数字を声やチャットで教えず、全員で小さい順にカードを出そう。飛ばすと共有ライフが1つ減ります。</p>';
 body+='<div class="ba-stats">❤️ 残りライフ：'+p.lives+' / 3　　残りカード：'+p.remaining+'</div>';
 body+='<div class="ba-played">'+p.played.map(x=>'<span class="ba-num">'+x.number+(x.skipped.length?' ⚠️':'')+'</span>').join('')+'</div>';
 if(room.phase==='qt_play'){
  body+='<div class="ba-role">あなたの秘密の手札</div>';
  if(p.myHand.length)body+='<div class="ba-cards">'+p.myHand.map(n=>
   '<button class="ba-number" onclick="baQuietPlay('+n+')">'+n+'</button>').join('')+'</div>';
  else body+='<div class="ba-wait">あなたのカードは出し終わりました。仲間を待っています。</div>';
  if(p.misses.length)body+='<p class="ba-warning">⚠️ 直前に飛ばしてしまったカード：'+
   p.misses.at(-1).skipped.join('、')+'</p>';
 }else if(room.phase==='qt_reveal'){
  body+='<div class="ba-highlight">🎉 ステージ '+p.stage+' 成功！</div>';
  if(owner)body+='<div class="btns">'+baButton('次のステージへ','baNext("qt_next")','gold')+'</div>';
 }
 baPage('相談せずにタイミングを合わせよう',body)
}
function baQuietPlay(n){send({type:'qt_play',number:n})}
function baBluff(){
 const p=room.board,phase=room.phase,owner=room.owner===me;
 let body='<div class="ba-hero">💀 花かドクロか <small>『Skull』の心理戦を参考にした1枚カードの簡略版</small></div>';
 body+='<p class="ba-help">みんなが花🌸かドクロ💀を秘密で1枚置く。入札で宣言した枚数の花をめくれれば成功、ドクロで失敗！</p>';
 body+='<div class="ba-stats">⭐ '+room.players.map(x=>esc(x.name)+' '+(p.stars[x.id]||0)+'勝').join('　')+'</div>';
 if(phase==='bl_place'){
  if(p.myCard)body+='<div class="ba-wait">✅ あなたのカード：'+(p.myCard==='safe'?'🌸 花':'💀 ドクロ')+'（ほかの人には秘密）</div>';
  else body+='<div class="ba-role">秘密で1枚出そう</div><div class="ba-cards">'+
    baButton('🌸 花を伏せて置く','baPlant("safe")','gold')+
    baButton('💀 ドクロを伏せて置く','baPlant("danger")','alt')+'</div>';
  body+='<p class="ba-stats">提出済み '+p.placedCount+' / '+room.active.length+'人</p>';
 }else if(phase==='bl_bid'){
  body+='<div class="ba-highlight">現在の最高入札 <strong>'+(p.bid||'まだなし')+'</strong>'+
   '<small>'+esc(p.bidder?baName(p.bidder):'だれでも最初の入札ができます')+'</small></div>';
  if(p.passed.includes(me))body+='<div class="ba-wait">あなたはパスしました。</div>';
  else{
   body+='<label class="labeled" for="ba-bid-number">何枚の花をめくれる？（1〜'+room.active.length+'）</label>'+
    '<input class="field" type="number" id="ba-bid-number" min="1" max="'+room.active.length+'" value="'+Math.min(p.bid+1,room.active.length)+'">'+
    '<div class="btns">'+baButton('この枚数で入札','baBid()','gold')+
    (p.bid&&p.bidder!==me?baButton('パス','send({type:"bl_pass"})'):'')+'</div>';
  }
 }else if(phase==='bl_flip'){
  body+='<div class="ba-highlight">最高入札者：<strong>'+esc(baName(p.bidder))+'</strong><small>'+
   p.bid+'枚をめくる！　成功：'+p.flipped.length+' / '+p.bid+'</small></div>';
  body+='<div class="ba-cards">'+p.planted.filter(id=>!p.flipped.some(x=>x.by===id)).map(id=>{
   const can=me===p.bidder;
   return '<button class="ba-hidden-card" '+(can?'onclick="baFlip('+JSON.stringify(id).replace(/"/g,'&quot;')+')"':'disabled')+'>❓ '+esc(baName(id))+'</button>'
  }).join('')+'</div>';
 }else if(phase==='bl_reveal'){
  const r=p.last;
  body+='<div class="ba-highlight">'+(r.success?'🌸 チャレンジ成功！':'💀 ドクロに遭遇！')+
   '<strong>'+esc(baName(r.bidder))+'</strong><small>宣言 '+r.bid+'枚</small></div>';
  body+='<div class="ba-cards">'+r.cards.map(x=>
   '<span class="ba-reveal-card">'+esc(x.name)+'　'+(x.card==='safe'?'🌸':'💀')+'</span>').join('')+'</div>';
  if(owner)body+='<div class="btns">'+baButton('次の勝負へ','baNext("bl_next")','gold')+'</div>';
 }
 baPage('相手の表情を読んで勝負！',body)
}
function baPlant(card){send({type:'bl_place',card})}
function baBid(){const number=Number(document.getElementById('ba-bid-number')?.value);send({type:'bl_bid',number})}
function baFlip(target){send({type:'bl_flip',target})}
function baWordAgents(){
 const p=room.board,team=p.teams[me],captain=p.captains[team]===me;
 const ownTurn=p.turn===team,phase=room.phase;
 let body='<div class="ba-hero">🕵️ 暗号ワード対決 <small>『Codenames』のヒント推理を参考にした4×4のチーム戦</small></div>';
 body+='<div class="ba-teams"><div class="ba-red">🔴 赤チーム：残り'+p.counts.red+'</div>'+
  '<div class="ba-blue">🔵 青チーム：残り'+p.counts.blue+'</div></div>';
 body+='<p class="ba-help">あなたは'+(team==='red'?'🔴 赤':'🔵 青')+'チームの'+
  (captain?'ヒント係':'回答係')+'。赤のヒント係：'+esc(baName(p.captains.red))+
  '／青のヒント係：'+esc(baName(p.captains.blue))+'</p>';
 body+='<div class="ba-role">現在は'+(p.turn==='red'?'🔴 赤':'🔵 青')+'チームの'+
  (p.step==='clue'?'ヒント出し':'言葉選び')+'です</div>';
 const classes={red:'ba-red-card',blue:'ba-blue-card',neutral:'ba-neutral-card',trap:'ba-trap-card'};
 body+='<div class="ba-word-grid">'+p.words.map((word,i)=>{
  const revealed=p.revealed.includes(i);
  const color=p.owners?.[i]||(p.visibleOwners?.[String(i)]||null);
  const classname=color?classes[color]:'';
  const can=phase==='wa_play'&&ownTurn&&p.step==='guess'&&!captain&&!revealed;
  return '<button '+(can?'onclick="baPickWord('+i+')"':'disabled')+
   ' class="ba-word '+classname+' '+(revealed?'ba-revealed':'')+'">'+esc(word)+
   (revealed?'<small>公開済み</small>':captain&&color?'<small>'+esc({red:'赤',blue:'青',neutral:'無所属',trap:'危険'}[color])+'</small>':'')+'</button>'
 }).join('')+'</div>';
 if(phase==='wa_play'&&ownTurn&&p.step==='clue'&&captain){
  body+='<div class="ba-role">仲間に1語のヒントを出そう（盤面のワードは禁止）</div>'+
   baInput('ba-wa-clue','ヒントの一語','例：乗り物',30)+
   '<label class="labeled" for="ba-wa-number">関連するワードの数</label>'+
   '<select class="field" id="ba-wa-number"><option value="1">1個</option>'+
   '<option value="2">2個</option><option value="3">3個</option></select>'+
   '<div class="btns">'+baButton('ヒントを公開','baSendCode()','gold')+'</div>';
 }else if(phase==='wa_play'&&p.step==='guess'){
  body+='<div class="ba-highlight">ヒント：<strong>'+esc(p.clue)+'　'+p.number+'</strong>'+
   '<small>あと'+p.left+'枚まで選べます。</small></div>';
  if(ownTurn&&!captain)body+='<div class="btns">'+baButton('これ以上めくらず手番を終了','send({type:"wa_pass"})')+'</div>';
 }else body+='<div class="ba-wait">次のヒントを待っています。相談しながら仲間のワードを探そう。</div>';
 baPage('チームで秘密の言葉を探そう',body)
}
function baSendCode(){
 const text=document.getElementById('ba-wa-clue')?.value.trim()||'';
 const number=Number(document.getElementById('ba-wa-number')?.value||1);
 if(!text)return error('ヒントを入力してください');
 send({type:'wa_clue',text,number})
}
function baPickWord(index){send({type:'wa_pick',index})}
function renderBoard(){
 if(!room||!BOARD_GAMES.includes(room.game))return;
 if(room.phase==='final')return baFinal();
 if(room.game==='oneword')return baOneWord();
 if(room.game==='spectrum')return baSpectrum();
 if(room.game==='quiet')return baQuiet();
 if(room.game==='bluff')return baBluff();
 if(room.game==='wordagents')return baWordAgents()
}

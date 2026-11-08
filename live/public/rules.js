(function tutorialScript(){
'use strict';
const RULES={
tier:{name:"🏆 みんなでTier予想",pages:[
["お題と5つのワードを作る","全員が好きなお題と5つの選択肢を作ります。自作モードと、ほかの人へランダムに配るシャッフルモードがあります。","two","✍️ 自分で答える","🎲 友達に配る"],
["S〜Dに秘密の順位を付ける","配られた5つのワードを自分の好みでS・A・B・C・Dに並べ、本人の正解として登録します。","tier","ゲーム","映画","旅行","カラオケ","おうち"],
["友達の並べ方を予想する","1人ずつ主役になります。ほかの人は、主役が決めた順位を予想して提出します。","versus","主役：友達A","予想：Sはゲーム？"],
["みんなのTier表を見比べる","主役の正解と全員の予想を比較。順位が一致した項目1つにつき1点です。","matrix","一致は緑","不一致は赤"]]},
value:{name:"💗 これって重い？",pages:[
["行動についての5問を用意","「毎日好きと言ってくれる」などの行動を5問作ります。例題をランダムに読み込んで編集もできます。","questions","毎日好きと言ってくれる","デートのたびに送ってくれる","返事が遅いと催促される"],
["本人が3段階で評価","「嬉しい」「嬉しいけど重い」「重い」のどれかを選びます。答えはまだ秘密です。","choices","嬉しい","嬉しいけど重い","重い"],
["主役の価値観を予想","自分の意見ではなく、友達ならどう判断するかを考えて全5問を回答します。","versus","主役：友達B","毎晩電話は嬉しい？"],
["全員の予想を答え合わせ","各問の本人の回答と全員の回答が一覧になり、1問一致につき1点を獲得します。","matrix","本人の答え","全員の予想"]]},
either:{name:"⚖️ 究極の二択",pages:[
["AかBを選ぶ問題を作成","どちらも捨てがたい二択を5問用意します。ランダム例題や自作の問題を使えます。","two","A：毎日少し会う","B：週1で長く会う"],
["本人が秘密で選択","それぞれA・Bのどちらを選ぶか、本人が正解を登録します。","choices","A：冒険する","B：のんびり過ごす"],
["主役の選択を予想","順番に主役を交代しながら、友達ならAとBどちらを選んだかを全員が予想します。","versus","主役：友達C","あなたの予想：B"],
["回答を一覧で確認","本人の選択と全員の予想を比較。正解数を競い、なぜ選んだか話し合って楽しめます。","matrix","本人の回答","友達の予想"]]},
quiz:{name:"🎯 私の理解度クイズ",pages:[
["自分についての5問を作る","「一番好きな場所は？」など、各問4つの選択肢から選べるクイズを作ります。","questions","好きな休日の過ごし方","一番落ち着く場所","一番嬉しいプレゼント"],
["本人が本当の答えを登録","5問すべてを本人が回答します。この時点ではほかの人に正解は見えません。","choices","自分の部屋","カフェ","公園","図書館"],
["友達が本人の答えを当てる","主役の好みをどれだけ理解しているか、全員が同じ5問に回答して競います。","versus","主役：友達A","あなたの予想：カフェ"],
["得点と理解度を発表","1問正解で1点。本人の正解・予想者全員の回答をまとめて表示します。","matrix","5問中4問一致","4ポイント"]]},
ito:{name:"🕸️ ことばの数値リレー",pages:[
["自分だけの秘密の数字","1〜100の数字が各プレイヤーに配られます。数字をほかの人に直接言ってはいけません。","number","73"],
["お題に沿う言葉で例える","「嬉しいプレゼント」などのお題に合わせ、数字の大きさを言葉で表現して全員に伝えます。","questions","嬉しいプレゼントは？","手作りの手紙","欲しかったゲーム"],
["小さそうな順に出していく","全員の例えを見て相談し、数字が小さいと思う人からカードを出します。","order","12","?","?","?"],
["順番を間違えるとライフ減少","小さい数字が残っているのに大きい数字を出すと共有ライフが減ります。","hearts","❤️","❤️","🤍"],
["3ステージの協力クリアを目指す","順番と数字を振り返りながら3ステージを進めます。みんなで成功を目指しましょう。","progress","STAGE 1","STAGE 2","STAGE 3"]]},
propose:{name:"💍 ひと言プロポーズ",pages:[
["基本フレーズとランダムワード","いつでも使える基本フレーズ6カテゴリと、毎回配られるランダムな言葉6個があります。","two","基本：気持ち・主語など","ランダム：世界一・味噌汁"],
["タップして文章を組み立てる","好きな言葉を直接選ぶと文章に追加されます。カードの表裏や向きを変える必要はありません。","words","ぼくは","世界一","好きだよ"],
["並べ替えて提出する","言葉を矢印で移動したり、不要なものを外したりして、完成した告白を送信します。","order","ぼくは","世界一","君が","好き"],
["審査役が気に入った告白を選ぶ","提出された告白を読み、審査役が一番好きなものに指輪を贈ります。審査役は順番に交代します。","versus","友達A：ずっと一緒に…","友達B：世界一大切…"],
["指輪3個を目指す","選ばれた人に指輪が1個付きます。3個集めたら勝利です。","hearts","💍","💍","💍"]]},
soup:{name:"🔎 ひらめきのスープ",pages:[
["不思議な出来事の謎を読む","問題文は全員に表示されますが、真相を知っているのは出題者だけです。","mystery","奇妙な出来事が起きた。","どうしてだろう？"],
["はい／いいえで答えられる質問","ほかの人は真相に近づく質問を送ります。なるべく答えを絞れる聞き方を考えましょう。","questions","登場人物は知り合いですか？","場所が重要ですか？"],
["出題者が質問に答える","出題者は「はい」「いいえ」「関係ありません」で答えます。必要ならヒントも出せます。","choices","はい","いいえ","関係ありません"],
["真相を推理して回答","分かったと思ったら真相を文章で発表します。出題者が正誤を判断します。","versus","推理：実は勘違い？","正解かどうかを判定"],
["真相を公開して次の問題へ","正解が出るか出題者が公開すると答えを確認できます。質問を振り返り、出題者を交代します。","progress","真相公開","振り返り","次の謎へ"]]}
};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={game:null,page:0,focus:null}, layer=null;
function graphic(s){
 const [,,kind,...args]=s;
 const box=(x,y,w,h,fill='#fff',border='#edcbdc')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${border}" stroke-width="2"/>`;
 const txt=(v,x,y,size=24,color='#673354')=>`<text x="${x}" y="${y}" font-family="Meiryo,'Noto Sans JP',sans-serif" font-weight="800" font-size="${size}" fill="${color}" text-anchor="middle">${esc(v)}</text>`;
 let out=box(0,0,800,400,'#fffbfd','none')+box(0,0,800,60,'#ffe3f2','none')+txt('なかみくらべ。｜ゲーム画面イメージ',400,40,20,'#a63678');
 if(kind==='two'||kind==='versus'){
  out+=box(73,120,308,159,'#fff1d5')+box(419,120,308,159,'#ffedf5')+txt(args[0]||'',227,207,23)+txt(args[1]||'',571,207,23);
  if(kind==='two')out+=txt('OR',400,207,24,'#da4d93');else out+=txt('⇄',400,207,36,'#da4d93');
 }else if(kind==='tier'){
  ['S','A','B','C','D'].forEach((r,i)=>{const y=80+i*52;out+=box(175,y,450,44,['#fdb5b9','#ffd0a7','#ffe893','#c8ebbd','#c5e7f8'][i])+txt(r,215,y+30,25)+txt(args[i]||'',417,y+29,23);});
 }else if(kind==='choices'){
  (args||[]).forEach((v,i)=>{let x=args.length===4?100+(i%2)*306:139;let y=args.length===4?111+Math.floor(i/2)*105:85+i*84;out+=box(x,y,args.length===4?285:522,args.length===4?86:72,i===0?'#f9c9df':'#fff')+txt(v,x+(args.length===4?142:261),y+49,22);});
 }else if(kind==='questions'){
  (args||[]).forEach((v,i)=>{const y=92+i*89;out+=box(93,y,615,73,i%2?'#fff0d9':'#ffedf5')+txt(`${i+1}. ${v}`,400,y+45,23);});
 }else if(kind==='matrix'){
  out+=txt('S　　　　　A　　　　 B　　　　C　　　　D',461,108,22);
  ['正解','友達A','友達B'].forEach((r,j)=>{out+=txt(r,140,169+j*67,21);for(let i=0;i<5;i++){const ok=j===0||i%3!==j;out+=box(211+i*102,133+j*67,92,52,j===0?'#fff2c5':ok?'#d4f4db':'#ffdee6')+txt(j===0?'●':ok?'✓':'✕',257+i*102,168+j*67,28);}});
 }else if(kind==='number'){
  out+=box(265,86,270,238,'#ffdfec')+txt('秘密の数字',400,143,25)+txt(args[0]||'73',400,258,106,'#d32d85');
 }else if(kind==='order'){
  (args||[]).forEach((v,i)=>{const x=87+i*161;out+=box(x,147,130,110,i===0?'#d5f2e0':'#f7e3f0')+txt(v,x+65,214,28);if(i<args.length-1)out+=txt('→',x+146,215,28,'#c54d8a');});
 }else if(kind==='hearts'){
  out+=box(109,115,580,178,'#fff1dd')+txt(args.join('　'),400,220,53);
 }else if(kind==='progress'){
  (args||[]).forEach((v,i)=>{const x=92+i*215;out+=box(x,142,186,119,i===2?'#fff2d8':'#dcf4e3')+txt(v,x+93,201,21)+txt(i===2?'★':'✓',x+93,245,25,'#cb4990');});
 }else if(kind==='words'){
  (args||[]).forEach((v,i)=>{const x=74+i*223;out+=box(x,154,204,95,i===1?'#fff1d3':'#fbe4f0')+txt(v,x+102,209,25);});
 }else if(kind==='mystery'){
  out+=box(142,99,516,208,'#ffedf5')+txt(args[0]||'',400,172,28)+txt(args[1]||'',400,232,32,'#bc3781');
 }
 out+=box(160,351,480,28,'#fff1d9','none')+txt('図の例は説明用です。ゲーム中の内容は異なります。',400,372,15,'#977047');
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">${out}</svg>`);
}
function ensure(){
 if(layer)return layer;
 layer=document.createElement('div');layer.id='howto-overlay';layer.className='rules-overlay';layer.hidden=true;layer.addEventListener('click',e=>{if(e.target===layer)close()});document.body.append(layer);return layer;
}
function render(){
 const r=RULES[state.game],pages=r.pages,s=pages[state.page],idx=state.page;
 ensure().innerHTML=`<section class="rules-window" role="dialog" aria-modal="true" aria-labelledby="rules-title" tabindex="-1">
 <div class="rules-bar"><strong>${esc(r.name)}　｜ルール説明</strong><button class="rules-close" onclick="closeRules()" aria-label="閉じる">✕</button></div>
 <div class="rules-inner">
 <div class="rules-steps">${pages.map((_,i)=>`<button class="rules-dot ${idx===i?'on':''}" aria-label="${i+1}ページ" onclick="jumpRules(${i})">${i+1}</button>`).join('')}</div>
 <div class="rules-main"><div class="rules-progress">STEP ${idx+1} / ${pages.length}</div><h2 id="rules-title">${esc(s[0])}</h2>
 <div class="rules-picture"><img alt="${esc(s[0])}の説明図" src="${graphic(s)}"/></div>
 <p class="rules-desc">${esc(s[1])}</p><p class="rules-hint">💡 画像は操作のイメージです。実際の問題や言葉は毎回変わります。</p></div>
 <div class="rules-bottom"><button class="rules-back" ${idx===0?'disabled':''} onclick="prevRules()">← 前へ</button><b>${idx+1} / ${pages.length}</b><button class="rules-forward" onclick="${idx===pages.length-1?'closeRules()':'nextRules()'}">${idx===pages.length-1?'閉じて遊ぶ ✓':'次へ →'}</button></div>
 </div></section>`;
 layer.querySelector('.rules-window').focus({preventScroll:true});
}
function open(game){if(!RULES[game])return;state={game,page:0,focus:document.activeElement};ensure().hidden=false;document.documentElement.classList.add('rules-open');render();}
function close(){if(!layer||layer.hidden)return;layer.hidden=true;layer.innerHTML='';document.documentElement.classList.remove('rules-open');const el=state.focus;if(el&&el.isConnected&&typeof el.focus==='function')el.focus({preventScroll:true});state={game:null,page:0,focus:null};}
function next(){if(!state.game)return;if(state.page<RULES[state.game].pages.length-1){state.page++;render();}}
function prev(){if(!state.game)return;if(state.page>0){state.page--;render();}}
function jump(n){if(!state.game)return;if(n>=0&&n<RULES[state.game].pages.length){state.page=n;render();}}
window.openRules=open;window.closeRules=close;window.nextRules=next;window.prevRules=prev;window.jumpRules=jump;
document.addEventListener('keydown',e=>{if(!layer||layer.hidden)return;if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='ArrowRight'){e.preventDefault();next();}else if(e.key==='ArrowLeft'){e.preventDefault();prev();}else if(e.key==='Tab'){const xs=[...layer.querySelectorAll('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===xs[0]){e.preventDefault();xs.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===xs.at(-1)){e.preventDefault();xs[0].focus();}}});
})();
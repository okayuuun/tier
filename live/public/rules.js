/* なかみくらべ。v8 - accessible, illustrated how-to slides for 7 games.
   All pictures are original SVG walkthrough diagrams, generated locally. */
'use strict';
const HOWTO = {
  tier: { title:'みんなでTier予想', icon:'🏆', tagline:'あの人なら、どう並べる？', slides:[
    {title:'まずはお題を用意',body:'全員が「好きな休日の過ごし方」などのお題と、5つの選択肢を作ります。例題をランダムに読み込んで編集することもできます。',tip:'自作モードとシャッフル配布モードを選べます。',picture:{type:'two',a:'✍️ 自分のお題に回答',b:'🎲 友達のお題が届く',tag:'ルームで出題方法を選ぼう'}},
    {title:'自分の正解を秘密で登録',body:'自分に配られた5つのワードを、好きな順にS・A・B・C・Dへ並べ替えます。ここで作った順位はまだほかの人には見えません。',tip:'上にある「↑」「↓」で並びを調整できます。',picture:{type:'tiers',labels:['ゲーム','映画','旅行','カラオケ','おうち'],tag:'自分だけの秘密のTier表'}},
    {title:'主役の好みを全員で予想',body:'順番に1人が主役になります。主役以外のプレイヤーは、同じ5つのワードを「この人ならこう並べる」と予想して送信します。',tip:'自分の好みではなく、主役の好みを考えます。',picture:{type:'versus',a:'今回の主役：友達A',b:'あなたの予想：Sはゲーム？',tag:'みんなが別々に予想を提出'}},
    {title:'全員の答えを一目で比較',body:'主役の正解と、友達全員の予想が表で公開されます。正しい位置に置けたワード1つにつき1点。主役を交代して総合点を競います。',tip:'緑は一致、赤は不一致。マスを押すと全文を見られます。',picture:{type:'matrix',tag:'S〜Dの予想を照合'}},
  ]},
  value: {title:'これって重い？',icon:'💗',tagline:'嬉しい？ それとも重い？',slides:[
    {title:'恋愛の行動を5問チェック',body:'「毎日好きと言われる」「毎晩電話したがる」など、恋愛での行動を5問用意します。自分で作成するかランダム例題を使えます。',tip:'お題を作った本人が回答するか、ほかの人に配るかも選択できます。',picture:{type:'questions',labels:['毎日好きって言ってくれる','デートのたび送ってくれる','返信が遅いと催促される'],tag:'1セット5問のお題'}},
    {title:'本人が3段階で本音を回答',body:'一つひとつの行動を「嬉しい」「嬉しいけど重い」「重い」の3つから選びます。本人の回答は予想が終わるまで秘密です。',tip:'正解は多数決ではなく、その人が選んだ回答です。',picture:{type:'choices',labels:['① 嬉しい','② 嬉しいけど重い','③ 重い'],selected:1,tag:'自分の価値観を選ぶ'}},
    {title:'友達の気持ちを当てよう',body:'主役になった人がそれぞれの質問をどう判断したか、ほかの人が予想します。全5問に答えたら送信しましょう。',tip:'「自分なら嬉しい」ではなく「友達ならどう思う？」を考えよう。',picture:{type:'versus',a:'主役：友達B',b:'毎晩電話 → 友達Bなら重い？',tag:'友達の選択を予想'}},
    {title:'本音と予想を答え合わせ',body:'本人が選んだ正解と、全員の予想が一覧表に表示されます。1問一致で1点。理由を話し合うとさらに楽しめます。',tip:'回答を押すと詳しい選択肢を確認できます。',picture:{type:'matrix',tag:'5問の一致数で採点'}},
  ]},
  either: {title:'究極の二択',icon:'⚖️',tagline:'AかB、あの人はどっち？',slides:[
    {title:'二択のお題を用意',body:'「お金持ちだけど会えない／普通の暮らしだけど毎日会える」など、どちらも選びづらい二択を5問作ります。',tip:'例題のランダム読込・編集もできます。',picture:{type:'two',a:'A：毎日少し会える',b:'B：週1で長く会える',tag:'迷うくらいが面白い！'}},
    {title:'まず本人がAかBを選ぶ',body:'それぞれの問いについて、本人がどちらかを選び、秘密で正解を登録します。',tip:'答えに正しさはありません。本人の好みが正解です。',picture:{type:'choices',labels:['A：好きな人と遠距離','B：友達のまま近距離'],selected:0,tag:'本人の回答は非公開'}},
    {title:'主役の二択を全員で予想',body:'順番に1人が主役になり、ほかの全員はその人がA・Bどちらを選んだか予想します。',tip:'意外な回答ほど会話が盛り上がります。',picture:{type:'versus',a:'主役：友達A',b:'あなたの予想は「B」',tag:'相手の選択を推理'}},
    {title:'誰が一番理解していた？',body:'5問中いくつ一致したか採点します。予想が出そろったら本人の答えと全員の回答を一覧表示し、次の主役に交代します。',tip:'各人の結果は最終画面でも振り返れます。',picture:{type:'matrix',tag:'正解をまとめてチェック'}},
  ]},
  quiz: {title:'私の理解度クイズ',icon:'🎯',tagline:'友達のこと、どれだけ知ってる？',slides:[
    {title:'本人についてのクイズを用意',body:'「一番落ち着く場所は？」「休日に何をしたい？」など、選択肢4つの質問を5問作ります。ランダム例題の編集もできます。',tip:'答える人が迷う、個性の見える問題がおすすめです。',picture:{type:'questions',labels:['一番落ち着く場所は？','休日にしたいことは？','嬉しいプレゼントは？'],tag:'自分を知ってもらう5問'}},
    {title:'本人が正解を決める',body:'5問すべてに本人が回答します。みんなが予想するまでは秘密にしておきます。',tip:'4つの候補から必ず1つ選びます。',picture:{type:'choices',labels:['自分の部屋','カフェ','公園','図書館'],selected:0,tag:'この人の本当の好みは？'}},
    {title:'友達が同じ問題に回答',body:'主役以外のプレイヤーは「本人なら何を選ぶ？」と予想します。全員の回答が集まったら答え合わせです。',tip:'自分自身の好みを選ぶゲームではありません。',picture:{type:'versus',a:'出題の主役：友達C',b:'あなたの予想：カフェ',tag:'理解度を試そう！'}},
    {title:'正解数を比べて順位を発表',body:'1問正解につき1点。本人の正解と友達全員の回答を同じ表に並べ、最後に理解度ランキングを発表します。',tip:'色のついたマスを押すと回答内容を確認できます。',picture:{type:'matrix',tag:'誰が一番分かっていた？'}},
  ]},
  ito: {title:'ことばの数値リレー',icon:'🕸️',tagline:'数字を言わずに、感覚を伝えよう',slides:[
    {title:'1〜100の秘密の数字を受け取る',body:'各プレイヤーに1〜100の数字が1つ配られます。数字は自分だけが見られ、ほかの人に教えてはいけません。',tip:'全員で協力するゲームです。',picture:{type:'number',tag:'この数字は自分にしか見えない'}},
    {title:'テーマに沿う例えを作る',body:'「嬉しいプレゼント」などのお題に対して、数字の大きさが伝わる言葉を考えます。例えば「手作りの手紙」「欲しかったゲーム」など。',tip:'数字をそのまま言わず、感覚で伝えます。',picture:{type:'clues',tag:'言葉の強さで数字を表現'}},
    {title:'相談して小さい順に出す',body:'全員の例えを見ながら相談します。数字が一番小さそうな人から順番に自分のカードを公開していきます。',tip:'誰でも好きなタイミングで出せます。',picture:{type:'order',tag:'小さい数字から順番に！'}},
    {title:'順番を間違えるとライフ減少',body:'まだ小さい数字が残っているのに大きい数字を出すと、飛ばされたカードの枚数に応じて共有ライフが減ります。',tip:'ライフは共有。協力して守り抜こう。',picture:{type:'hearts',tag:'❤️ ❤️ ❤️ → ❤️ ❤️ 🤍'}},
    {title:'3ステージに挑戦',body:'各ステージ終了時に数字と順番が公開されます。3ステージを突破できれば全員で成功です。',tip:'数字と例えの感覚のズレを楽しみましょう。',picture:{type:'progress',tag:'みんなでゴールまで！'}},
  ]},
  propose: {title:'ひと言プロポーズ',icon:'💍',tagline:'言葉をつなげて、審査役の心をつかめ！',slides:[
    {title:'使える言葉を選ぼう',body:'いつでも使える6種類の基本フレーズと、毎ラウンド変わる6つのランダムワードが表示されます。',tip:'実際のカードを裏返す必要はありません。言葉を直接タップできます。',picture:{type:'words',tag:'基本フレーズ ＋ ランダムワード'}},
    {title:'言葉を組み合わせて文章を作る',body:'使いたいフレーズをタップすると文章に追加されます。基本フレーズはカテゴリを開いて好みの言葉を選びましょう。',tip:'全部使う必要はありません。自由な文章を作れます。',picture:{type:'compose',tag:'文章のプレビューがその場で更新'}},
    {title:'順番を整えて提出',body:'追加した言葉を左右の矢印で並べ替えたり、不要な言葉を外したりできます。完成したら「この告白を提出」を押します。',tip:'Discord通話で読み上げるとより楽しくなります。',picture:{type:'edit',tag:'気持ちが伝わる順番にしよう'}},
    {title:'審査役が一番好きな告白を選ぶ',body:'そのラウンドの審査役が提出された告白を読み、最も気に入った人に指輪を渡します。次は審査役を交代します。',tip:'文章の上手さより面白さや熱意で選んでもOK。',picture:{type:'judge',tag:'💍 一番心に響いた告白は？'}},
    {title:'指輪を3個集めたら勝利',body:'各ラウンドの結果が公開され、指輪の数が加算されます。指輪を3個集めたプレイヤーが勝者です。',tip:'お題や言葉は毎ラウンド変化します。',picture:{type:'rings',tag:'集めた指輪を競おう'}},
  ]},
  soup: {title:'ひらめきのスープ',icon:'🔎',tagline:'「なぜ？」を質問して真相に迫る',slides:[
    {title:'奇妙な出来事と出題者を確認',body:'全員に短い謎の文章が表示されます。出題者だけがその真相を知っています。',tip:'出題者は答えを先に教えてはいけません。',picture:{type:'mystery',tag:'真相は出題者だけに表示'}},
    {title:'はい／いいえで答えられる質問を送る',body:'ほかのプレイヤーは「その人は知り合いですか？」など、答えを絞り込める質問を入力します。',tip:'「どうしてですか？」より「〇〇だからですか？」が基本。',picture:{type:'question',tag:'質問は全員に見える'}},
    {title:'出題者が質問に回答する',body:'出題者は各質問に「はい」「いいえ」「関係ありません」で答えます。質問履歴から新しい推理を考えましょう。',tip:'行き詰まったら段階的なヒントを公開できます。',picture:{type:'replies',tag:'3つの回答を手がかりに'}},
    {title:'真相を推理して送信',body:'理由が分かったら「真相を推理して発表」を選び、自分の考えを送ります。出題者が正解かどうか判定します。',tip:'推理が違っても質問を続けられます。',picture:{type:'answer',tag:'分かったら真相を発表！'}},
    {title:'答え合わせして出題者交代',body:'正解が出るか出題者が公開すると真相が表示されます。何を見落としていたか振り返り、次の謎へ進みます。',tip:'問題は毎回変わり、出題者も交代します。',picture:{type:'reveal',tag:'意外だけど納得できる真相へ'}},
  ]},
  akaito: {title:'アカイイト｜100になるペア',icon:'❤️',tagline:'言葉から数字を想像して、運命の相手を探そう',slides:[
    {title:'1〜100の秘密の数字を受け取る',body:'各プレイヤーに秘密の数字が1つ配られます。数字そのものはほかの人に見せません。',tip:'数字が大きい場合は、あえて低そうな例えで駆け引きも可能です。',picture:{type:'number',tag:'数字は自分だけに表示'}},
    {title:'お題に沿った言葉で表現',body:'例えば「嬉しいプレゼント」のお題で、自分の数字を連想させる例えを一つ提出します。数字を直接書いてはいけません。',tip:'ほかの人の言葉やニュアンスもよく聞こう。',picture:{type:'clues',tag:'みんなの例えが公開される'}},
    {title:'合計100に近い相手へ申し込む',body:'相性が良さそうな人にペアの申請を送り、相手が承認すると成立します。相手は断ることもできます。',tip:'合計100以下なら得点。ぴったり100にはボーナス！',picture:{type:'two',a:'あなた：数字は65？',b:'相手：35くらい？',tag:'65＋35なら100ぴったり'}},
    {title:'ペアを公開して得点を獲得',body:'ペア成立時に二人の数字を公開します。合計が100を超えると0点。100以下なら100に近いほど高得点、ちょうど100は6点です。',tip:'ここでの得点は、サイト独自の簡易ルールです。',picture:{type:'versus',a:'62 ＋ 38 ＝ 100',b:'❤️ ぴったり +6点',tag:'4ラウンドの合計を競おう'}},
  ]},
  unique: {title:'全員不一致チャレンジ',icon:'✨',tagline:'全員の回答がバラバラなら成功！',slides:[
    {title:'全員に同じお題が出る',body:'「コンビニで買うもの」「おにぎりの具」など、自由に答えられるお題が表示されます。',tip:'答えが多いお題ほど、意外な答えを狙えます。',picture:{type:'questions',labels:['コンビニで買うもの','ほかの人と違う回答にしよう','相談はせずに考えてね'],tag:'同じ質問に全員が回答'}},
    {title:'誰とも被らない言葉を書く',body:'全員がそれぞれ短い言葉を入力します。ほかの人の回答は答え合わせまで秘密です。',tip:'全員の個性が出る自由回答です。',picture:{type:'clues',tag:'誰が何を答えたのかは秘密'}},
    {title:'全員の答えを一斉公開',body:'答え合わせで同じ回答が2件以上あれば失敗。全員違う答えなら成功です。',tip:'表記の違いだけによる一致・不一致はなるべく正規化しています。',picture:{type:'matrix',tag:'かぶりを見つけよう！'}},
    {title:'5回連続の成功を目指す',body:'成功すると連続記録が1増え、失敗すると0へ戻ります。10問以内に5回連続成功できれば協力勝利です。',tip:'TOP4の実況で知られる「全員不一致」のルールをヒントにしています。',picture:{type:'progress',tag:'5回連続で全員不一致！'}},
  ]}
};

let rulesState={game:null,page:0,trigger:null};
const RE=(s)=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const RCOL={pink:'#e73592',pinkLight:'#fce3f0',dark:'#60304f',gold:'#ffde7d',mint:'#d5f5df',red:'#ffe0e5',blue:'#dceafb',cream:'#fffaf5'};
function ruleArtwork(slide){
 const v=slide.picture, W=800,H=400;
 const rect=(x,y,w,h,fill=RCOL.cream,rx=17,stroke='none',sw=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
 const tx=(s,x,y,size=25,fill=RCOL.dark,bold=true,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="'Noto Sans JP','Hiragino Kaku Gothic ProN',Meiryo,sans-serif" font-weight="${bold?800:550}" font-size="${size}" fill="${fill}">${RE(s)}</text>`;
 const line=(x1,y1,x2,y2,color='#edb6d5',width=3)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
 const card=(s,x,y,w=210,h=105,bg='white',size=21)=>rect(x,y,w,h,bg,18,'#eccbdc')+tx(s,x+w/2,y+h/2+8,size);
 let z=rect(0,0,W,H,'#fffafc',23);z+=rect(0,0,W,55,'#ffe7f3',22);z+=rect(0,41,W,14,'#ffe7f3',0);
 z+=tx('なかみくらべ。｜ルールのイメージ',34,37,20,'#9a2867',true,'start');
 const note=()=>rect(170,352,460,33,'#ffecf6',16)+tx(v.tag||'',400,375,17,'#9c3972');
 switch(v.type){
 case 'two':z+=card(v.a,65,118,310,160,'#fff3ce',26)+card(v.b,424,118,310,160,'#fce5f0',25)+tx('OR',400,208,25,'#aa3f7b');break;
 case 'tiers':{const colors=['#f9b0b4','#ffd19c','#ffe999','#ccebb9','#c6e3f7'];for(let i=0;i<5;i++){const y=79+i*51;z+=rect(155,y,490,43,'white',8,'#f0d6e1')+rect(155,y,85,43,colors[i],8)+tx('SABCD'[i],197,y+30,26)+tx(v.labels[i],420,y+29,22);}}break;
 case 'versus':z+=rect(116,90,568,80,'#f4dcf0',20)+tx(v.a,400,141,27)+tx('↓',400,215,36,RCOL.pink)+rect(116,241,568,72,'#fff1c8',18)+tx(v.b,400,287,25);break;
 case 'matrix':{z+=rect(80,85,640,260,'#fff5fa',17,'#efc8dd');const hx=260;for(let i=0;i<5;i++){z+=rect(hx+i*88,104,80,38,'#ffe2f0',8)+tx(`${i+1}`,hx+i*88+40,131,22);}for(let r=0;r<3;r++){const y=157+r*58;z+=tx(['正解','友達A','友達B'][r],167,y+31,21);for(let i=0;i<5;i++){const good=r===0||r===1?(i%3!==1):(i%3===1);z+=rect(hx+i*88,y,80,47,r===0?'#f9eabb':good?RCOL.mint:RCOL.red,9);z+=tx(r===0?['A','C','D','B','A'][i]:good?'✓':'✕',hx+i*88+40,y+31,24,good?'#3f815b':'#b64e71');}}}break;
 case 'questions':{z+=rect(92,82,616,257,'white',18,'#f3d5e4');(v.labels||[]).forEach((q,i)=>{const y=95+i*81;z+=rect(111,y,580,67,i%2?'#fff9db':'#fff1f8',12)+tx(`Q${i+1}`,151,y+40,20,'#ba3d85')+tx(q,394,y+41,22);});}break;
 case 'choices':{const labels=v.labels||[];const cols=labels.length===4?2:1;const width=cols===2?279:520;const ht=labels.length===4?97:65;labels.forEach((s,i)=>{const x=cols===2?103+(i%2)*305:140;const y=cols===2?105+Math.floor(i/2)*114:87+i*84;const sel=i===v.selected;z+=rect(x,y,width,ht,sel?'#f8c8e1':'white',13,sel?RCOL.pink:'#ead4e1',sel?4:2)+tx(s,x+width/2,y+ht/2+8,22,sel?'#8c2058':RCOL.dark);});}break;
 case 'number':z+=rect(261,81,278,247,'#ffe7f3',25,RCOL.pink,3)+tx('秘密の数字',400,139,24,'#a32f73')+tx('73',400,265,108,RCOL.pink)+tx('ほかの人には見えない',400,316,17);break;
 case 'clues':{const qs=['友達A：帰り道の寄り道','友達B：おいしいランチ','あなた：大好きな旅行'];qs.forEach((s,i)=>z+=card(s,144,84+i*85,512,68,['#e4f2fc','#fff3d5','#fbe8f3'][i],21));}break;
 case 'order':{const nums=['12','?','?','?'];const xs=[102,265,428,591];nums.forEach((s,i)=>{z+=rect(xs[i],149,108,98,i===0?'#d6f3e2':'#fbe7f1',18)+tx(s,xs[i]+54,210,44,i===0?'#3b8b64':RCOL.pink);if(i<3)z+=tx('→',xs[i]+139,211,33,RCOL.pink);});z+=tx('小さい　→　大きい',400,303,23);break;}
 case 'hearts':z+=rect(116,106,568,187,'#fff2e2',23)+tx('❤️     ❤️     🤍',400,209,56)+tx('ライフが残り2個！',400,257,26,'#b44d68');break;
 case 'progress':z+=rect(87,130,185,130,RCOL.mint,18)+rect(308,130,185,130,RCOL.mint,18)+rect(528,130,185,130,'#fff0cc',18);['STAGE 1','STAGE 2','STAGE 3'].forEach((s,i)=>{z+=tx(s,[179,400,620][i],182,24)+tx(i===2?'GOAL':'✓',[179,400,620][i],232,33,RCOL.pink);});break;
 case 'words':{z+=tx('いつでも使える',230,104,20,'#9e3574')+tx('今回だけの言葉',580,104,20,'#9e3574');['主語','気持ち','つなぎ'].forEach((s,i)=>z+=card(s,76,124+i*69,320,55,'#ffecf6',20));['世界一','抱きしめたい','味噌汁'].forEach((s,i)=>z+=card(s,422,124+i*69,302,55,'#fff5d2',20));}break;
 case 'compose':{z+=rect(79,82,642,87,'#fff6d6',14)+tx('「ぼくは」＋「世界一」＋「好きだよ」',400,135,28);['ぼくは','世界一','好きだよ'].forEach((s,i)=>{z+=rect(113+i*203,217,180,68,i===0?'#fbe7f3':i===1?'#fff2ce':'#e7f5ec',13)+tx(s,203+i*203,260,22);});z+=tx('タップした順番に追加',400,322,20,'#a64a7d');break;}
 case 'edit':z+=rect(97,107,606,155,'white',16,'#edc9db')+tx('① ぼくは    ② 世界一    ③ 好きだよ',400,177,26)+tx('←　→　×　　←　→　×　　←　→　×',400,227,24,'#be5f91')+rect(266,285,268,43,RCOL.pink,11)+tx('この告白を提出する',400,314,19,'white');break;
 case 'judge':z+=card('友達A：ずっと一緒に…',112,87,576,92,'#fff1db',22)+card('友達B：あなたは世界一…',112,201,576,92,'#fce5f0',22)+tx('💍',400,323,39);break;
 case 'rings':z+=rect(120,102,560,215,'#fff3da',19)+tx('友達A　💍 💍 💍',400,167,28)+tx('友達B　💍 💍',400,228,28)+tx('3個集めたら勝利！',400,292,24,RCOL.pink);break;
 case 'mystery':z+=rect(140,83,520,235,'#ffedf5',17)+tx('奇妙な出来事が起きた。',400,147,30)+tx('いったいなぜ？',400,201,35,RCOL.pink)+tx('🔒 真相は出題者だけ',400,275,20);break;
 case 'question':z+=rect(106,114,588,86,'white',16,'#eccbdc')+tx('Q. 男は誰かと会いましたか？',400,169,26)+rect(260,232,280,62,RCOL.pink,13)+tx('質問を送信',400,272,23,'white');break;
 case 'replies':{['はい','いいえ','関係ありません'].forEach((s,i)=>z+=card(s,97+i*206,135,197,104,['#d9f4de','#ffe1e5','#e7e9fb'][i],22));}break;
 case 'answer':z+=rect(111,103,578,130,'#ffefdc',18)+tx('「実は◯◯だったのでは？」',400,175,27)+rect(235,267,330,55,RCOL.pink,12)+tx('真相を推理して発表',400,303,20,'white');break;
 case 'reveal':z+=rect(95,91,610,231,'#e5f6e9',18,'#9bdbb1')+tx('真相が公開！',400,150,33,'#287b56')+tx('それまでの質問を振り返ろう',400,208,24)+tx('✓ 次の問題へ',400,278,23,'#2e9465');break;
 default:z+=card('このゲームの流れをチェック！',120,120,560,140);break;
 }
 z+=note();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${RE(v.tag||slide.title)}">${z}</svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
function ruleOverlay(){let root=document.getElementById('rules-overlay');if(root)return root;
 root=document.createElement('div');root.id='rules-overlay';root.className='rules-overlay';root.hidden=true;root.addEventListener('click',e=>{if(e.target===root)closeRules();});
 document.body.append(root);return root;}
function openRules(game){if(!HOWTO[game])return;const root=ruleOverlay();rulesState={game,page:0,trigger:document.activeElement};root.hidden=false;document.documentElement.classList.add('rules-open');renderRules();}
function renderRules(){const game=HOWTO[rulesState.game];if(!game)return;const slides=game.slides,slide=slides[rulesState.page],i=rulesState.page,root=ruleOverlay();
 root.innerHTML=`<section class="rules-window" role="dialog" aria-modal="true" aria-labelledby="rules-heading" aria-describedby="rules-description" tabindex="-1"><div class="rules-bar"><div class="rules-brand">${game.icon} <strong>${RE(game.title)}</strong><span>｜遊び方</span></div><button type="button" class="rules-close" onclick="closeRules()" aria-label="ルール説明を閉じる">✕</button></div><div class="rules-inner"><div class="rules-steps">${slides.map((s,j)=>`<button type="button" class="rules-dot ${j===i?'on':''} ${j<i?'done':''}" onclick="jumpRules(${j})" aria-label="${j+1}ページへ" ${j===i?'aria-current="step"':''}><span>${j+1}</span></button>`).join('')}</div><div class="rules-main"><div class="rules-progress"><span>STEP ${i+1} / ${slides.length}</span><b>${RE(game.tagline)}</b></div><h2 id="rules-heading">${RE(slide.title)}</h2><figure class="rules-picture"><img src="${ruleArtwork(slide)}" alt="${RE(slide.picture.tag)}" draggable="false"/></figure><p id="rules-description" class="rules-desc">${RE(slide.body)}</p><p class="rules-hint">💡 ${RE(slide.tip)}</p></div><div class="rules-bottom"><button type="button" class="rules-back" ${i===0?'disabled':''} onclick="prevRules()">← 前へ</button><span class="rules-page">${i+1} / ${slides.length}</span><button type="button" class="rules-forward" onclick="${i===slides.length-1?'closeRules()':'nextRules()'}">${i===slides.length-1?'閉じて遊ぶ ✓':'次へ →'}</button></div></div></section>`;
 const dialog=root.querySelector('.rules-window');dialog?.focus({preventScroll:true});
}
function nextRules(){if(!HOWTO[rulesState.game])return;if(rulesState.page<HOWTO[rulesState.game].slides.length-1){rulesState.page++;renderRules();}}
function prevRules(){if(rulesState.page>0){rulesState.page--;renderRules();}}
function jumpRules(i){if(rulesState.game&&Number.isInteger(i)&&i>=0&&i<HOWTO[rulesState.game].slides.length){rulesState.page=i;renderRules();}}
function closeRules(){const root=document.getElementById('rules-overlay');if(!root||root.hidden)return;root.hidden=true;root.innerHTML='';document.documentElement.classList.remove('rules-open');if(rulesState.trigger instanceof HTMLElement&&rulesState.trigger.isConnected)rulesState.trigger.focus({preventScroll:true});rulesState={game:null,page:0,trigger:null};}
document.addEventListener('keydown',event=>{const root=document.getElementById('rules-overlay');if(!root||root.hidden)return;if(event.key==='Escape'){event.preventDefault();closeRules();}else if(event.key==='ArrowRight'){event.preventDefault();nextRules();}else if(event.key==='ArrowLeft'){event.preventDefault();prevRules();}else if(event.key==='Tab'){const els=[...root.querySelectorAll('button:not(:disabled)')].filter(x=>x.offsetWidth||x.offsetHeight||x.getClientRects().length);if(!els.length)return;const first=els[0],last=els.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});

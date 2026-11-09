'use strict';
/* Four illustrated steps for each new art game. */
Object.assign(HOWTO,{
 artcontest:{title:'お絵描き作品コンテスト',icon:'🖼️',tagline:'絵の上手さと発想を競う',slides:[
 {title:'みんなで同じお題を確認',body:'全員に共通のお題が表示されます。主催者は描き始める前にお題を変更することもできます。',tip:'意外性のあるお題ほど面白い作品が生まれます。',picture:{type:'two',a:'未来の動物園',b:'ラスボスのペット',tag:'全員に同じテーマ'}},
 {title:'絵を描いて秘密で提出',body:'スマホやマウスで自由に描きます。提出するまで絵はほかの人に見えません。',tip:'1本戻す・全消去もできます。',picture:{type:'compose',tag:'自分の作品を描く'}},
 {title:'匿名で発表・みんなで投票',body:'作品がそろうと絵だけが公開されます。好きな作品に投票します。自分の作品には投票できません。',tip:'画力だけでなく発想の面白さでも選べます。',picture:{type:'choices',labels:['作品A','作品B','作品C'],selected:1,tag:'最も好きな作品を選ぶ'}},
 {title:'投票結果と得点を確認',body:'最多得票の作品に3点。3ラウンドを遊んで最終ランキングを発表します。',tip:'絵は結果から見返せます。',picture:{type:'matrix',tag:'全作品を確認'}}]},
 artforbid:{title:'NGお絵描き',icon:'🚫',tagline:'描かずに伝える',slides:[
 {title:'お題と禁止事項を確認',body:'例：猫を描きます。ただし「耳」「しっぽ」は描いてはいけません。',tip:'描いてはいけない特徴が2つ表示されます。',picture:{type:'choices',labels:['お題：猫','NG：耳','NG：しっぽ'],selected:0,tag:'NGの特徴をチェック'}},
 {title:'代わりの表現を考えて描く',body:'禁止されたものを描かずに、正体が伝わる絵を作ります。',tip:'背景・表情・ポーズが重要になります。',picture:{type:'compose',tag:'頭を使って描く'}},
 {title:'投票とNGチェック',body:'好きな絵を選び、NG要素を描いていると思った作品にはチェックを入れます。',tip:'NG判定は画像AIではなく参加者の判断です。',picture:{type:'questions',labels:['作品A：これは禁止？','作品B：発想がすごい','作品C：うまく伝わる'],tag:'みんなで判定'}},
 {title:'最多得票を表彰',body:'過半数がNGと判定した絵は入賞対象外。残った作品で最も票を得た絵が3点を獲得します。',tip:'判断に迷ったら友達と話し合いましょう。',picture:{type:'matrix',tag:'違反と得点を確認'}}]},
 drawbluff:{title:'絵のタイトル当て',icon:'🧩',tagline:'本物のお題はどれ？',slides:[
 {title:'秘密のお題を絵にする',body:'それぞれ違うお題を受け取り、文章を言わず絵だけを描きます。',tip:'絵は提出まで秘密です。',picture:{type:'mystery',tag:'自分だけのお題'}},
 {title:'ほかの人の絵に偽タイトルを書く',body:'絵の作者以外は、もっともらしい偽のタイトルを考えて提出します。',tip:'本物に似た嘘ほどほかの人を迷わせます。',picture:{type:'questions',labels:['ありそうなタイトル','少し変わった解釈','だまされそうな表現'],tag:'偽タイトルを作る'}},
 {title:'本物のタイトルを当てる',body:'本当のお題と偽タイトルが混ざった選択肢から、本物だと思うものを選びます。',tip:'自分の偽タイトルには投票できません。',picture:{type:'choices',labels:['踊る魔王','眠る恐竜','働く宇宙人'],selected:1,tag:'1つ選ぼう'}},
 {title:'正解もハッタリも得点に',body:'本物を当てたら3点、偽タイトルを選んでもらえたら1点。絵の作者も正解者数に応じて得点を獲得します。',tip:'全員の絵を見終えたら結果発表！',picture:{type:'matrix',tag:'みんなの予想を比較'}}]}
});
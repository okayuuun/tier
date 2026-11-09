'use strict';
/* Lightweight feedback: sound is synthesized locally; no external audio assets. */
(()=>{
const KEY='nakami_sound_v15';
let sound=true,ctx=null,lastPhase='',lastRoom='';
try{sound=localStorage.getItem(KEY)!=='off'}catch(_e){}
function toggleSound(){sound=!sound;try{localStorage.setItem(KEY,sound?'on':'off')}catch(_e){};drawSwitch();if(sound)tone('tap')}
function drawSwitch(){let target=document.getElementById('nk-sound');if(target){target.textContent=sound?'🔊 効果音 ON':'🔇 効果音 OFF';target.setAttribute('aria-pressed',String(sound));target.title='効果音のオン・オフ（この端末に保存）'}}
function tone(type){if(!sound)return;
try{
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
 ctx=ctx||new AC();if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 const now=ctx.currentTime;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';
 const pitch=type==='reveal'?660:type==='send'?480:600;osc.frequency.setValueAtTime(pitch,now);if(type==='reveal')osc.frequency.linearRampToValueAtTime(880,now+0.15);else osc.frequency.linearRampToValueAtTime(pitch*1.18,now+0.065);
 gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(0.035,now+0.012);gain.gain.exponentialRampToValueAtTime(0.0001,now+(type==='reveal'?0.26:0.095));osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+(type==='reveal'?0.27:0.10));
}catch(_e){} }
function install(){
 const top=document.querySelector('header .top')||document.querySelector('header');if(top&&!document.getElementById('nk-sound')){const b=document.createElement('button');b.id='nk-sound';b.type='button';b.className='nk-sound-switch';b.addEventListener('click',toggleSound);top.append(b);drawSwitch()}
 document.addEventListener('click',e=>{
   const target=e.target.closest('button');if(!target||target.id==='nk-sound'||target.disabled)return;
   target.classList.add('nk-pressed');setTimeout(()=>target.classList.remove('nk-pressed'),220);
   const label=(target.textContent||'').trim();tone(/回答|提出|送信|確定|開始|進める|投票|選ぶ|作成|公開|確認|線を送る|次へ/.test(label)?'send':'tap');
 },true);
 const app=document.getElementById('app');if(app){new MutationObserver(()=>renderProgress()).observe(app,{childList:true,subtree:true})}
 renderProgress();
}
function describe(phase){
 const names={lobby:['待機','ゲームを選び、友達を招待'],compose:['作成','お題を準備'],answer:['秘密回答','本音を登録'],guess:['みんなで予想','相手の選択を当てる'],reveal:['答え合わせ','全員の結果を確認'],final:['終了','結果を振り返る'],
 desc_clue:['説明','担当者がヒントを準備'],desc_guess:['予想','言葉を当てよう'],desc_reveal:['結果','答え合わせ'],draw_stroke:['お絵描き','一筆ずつ描く'],draw_vote:['投票','エセ役を見つける'],draw_guess:['逆転','エセ役が正解を推理'],draw_reveal:['結果','役割とお題を公開'],mail_stage:['謎解き','メールから手掛かりを探す'],mail_reveal:['解決','今回の事件はクリア'],
 ito_clue:['ヒント','数字を例える'],ito_play:['カード公開','小さい順に出す'],ito_review:['振り返り','結果を確認'],red_clue:['ヒント','数字を例える'],red_pair:['ペア探し','合計100を目指す'],red_reveal:['結果','合計値を公開'],prop_compose:['文章作成','言葉を組み立てる'],prop_judge:['審査','お気に入りを選ぶ'],prop_reveal:['結果','指輪を授与'],soup_ask:['質問','真相を絞る'],soup_reveal:['真相公開','謎を振り返る'],uniq_answer:['回答','かぶらずに答える'],uniq_reveal:['判定','一致を確認'],wolf_talk:['会話・投票','少数派を探す'],wolf_guess:['逆転','お題を当てる'],wolf_reveal:['正体公開','推理を確認'],un_answer:['回答','全員一致を目指す'],un_reveal:['判定','一致を確認'],in_ask:['質問','答えを探す'],in_vote:['投票','内通者を見抜く'],in_reveal:['結果','正体を公開'],sr_rank:['ランキング','秘密の順番を登録'],sr_guess:['推理','並べ方の基準を予想'],sr_reveal:['結果','秘密の基準を公開'],word_compose:['文章作成','カードや言葉を組み立てる'],word_judge:['審査','親が作品を選ぶ'],word_vote:['投票','一番面白い作品を選ぶ'],word_reveal:['結果','採用作品を発表'],art_hint:['ヒント準備','描いてほしい目標を決める'],art_draw:['お絵描き','ヒントから絵を描く'],art_pick:['審査','一番目標に近い絵を選ぶ'],art_reveal:['結果','目標を公開'],relay_seed:['出題','次の人へのお題を書く'],relay_draw:['描画','伝えられた文章を絵にする'],relay_caption:['説明','絵を文章にする'],relay_reveal:['発表','伝言の変化を見る'],px_draw:['お絵描き','作品を完成させる'],px_vote:['投票・NG判定','みんなの作品を評価'],px_reveal:['結果発表','作品と得点を確認'],db_draw:['お絵描き','秘密のお題を描く'],db_caption:['ウソを作る','もっともらしい偽タイトルを考える'],db_vote:['本物を当てる','偽タイトルの中から推理'],db_reveal:['結果発表','正解と偽タイトルを確認'],mx_draw:['お絵描き','秘密のお題の絵を提出'],mx_caption:['セリフ','別の人の絵に合う言葉を書く'],mx_vote:['投票','絵とセリフの合体を評価'],mx_reveal:['結果発表','絵とセリフの作者を公開'],co_turn:['合作','今の手番の人が描き足す'],co_reveal:['完成','秘密のミッションを公開'],rv_hint:['ヒント','絵描きに形を伝える'],rv_draw:['お絵描き','正解を知らずに描く'],rv_guess:['推理','自分の絵の正体を当てる'],rv_judge:['判定','近い回答を採点'],rv_reveal:['発表','絵の本当の正体を公開'],studio_guess:['自作問題','出題された問題に回答'],studio_reveal:['答え合わせ','全員で結果を比較']};
 return names[phase]||['進行中','みんなで協力しよう'];
}
function renderProgress(){
 const current=typeof room==='undefined'?null:room;const app=document.getElementById('app');if(!app||!current)return;
 const body=app.querySelector('.body');if(!body)return;
 const phase=current.phase||'lobby';const [label,detail]=describe(phase);
 const phases={lobby:0,compose:1,answer:2,guess:2,reveal:3,final:4,desc_clue:1,desc_guess:2,desc_reveal:3,draw_stroke:1,draw_vote:2,draw_guess:2,draw_reveal:3,mail_stage:2,mail_reveal:3,ito_clue:1,ito_play:2,ito_review:3,red_clue:1,red_pair:2,red_reveal:3,prop_compose:1,prop_judge:2,prop_reveal:3,soup_ask:2,soup_reveal:3,uniq_answer:2,uniq_reveal:3,wolf_talk:2,wolf_guess:2,wolf_reveal:3,un_answer:2,un_reveal:3,in_ask:1,in_vote:2,in_reveal:3,sr_rank:1,sr_guess:2,sr_reveal:3,word_compose:1,word_judge:2,word_vote:2,word_reveal:3,studio_guess:2,studio_reveal:3,art_hint:1,art_draw:2,art_pick:3,art_reveal:3,relay_seed:1,relay_draw:2,relay_caption:2,relay_reveal:3,px_draw:1,px_vote:2,px_reveal:3,db_draw:1,db_caption:2,db_vote:2,db_reveal:3,mx_draw:1,mx_caption:2,mx_vote:2,mx_reveal:3,co_turn:2,co_reveal:3,rv_hint:1,rv_draw:2,rv_guess:2,rv_judge:2,rv_reveal:3};
 const pos=phases[phase]??1;
 let bar=body.querySelector('#nk-flow');if(!bar){bar=document.createElement('div');bar.id='nk-flow';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');const banner=body.querySelector('.banner');if(banner)banner.insertAdjacentElement('afterend',bar);else body.prepend(bar)}
 const marker=current.code+':'+phase+':'+(current.drawmix?.round??current.drawextra?.cursor??current.drawextra?.round??current.draw?.stage??current.word?.round??current.more?.round??current.party?.round??current.roundIndex??0);
 if(bar.dataset.marker!==marker){bar.dataset.marker=marker;bar.innerHTML=`<div class="nk-flow-top"><span>📍 <b>${label}</b> <small>${detail}</small></span><strong>${Math.min(5,pos+1)} / 5</strong></div><div class="nk-flow-track">${Array.from({length:5},(_,i)=>`<span class="${i<pos?'finished':i===pos?'now':''}"></span>`).join('')}</div>`;
 if(lastRoom===current.code&&lastPhase&&lastPhase!==phase&&(/reveal|review|final/.test(phase))){tone('reveal');const el=document.createElement('div');el.className='nk-state-toast';el.textContent='✨ '+label;document.body.append(el);setTimeout(()=>el.remove(),1500)}
 lastRoom=current.code;lastPhase=phase;
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.NKFeedback={tone,toggleSound,renderProgress};
})();
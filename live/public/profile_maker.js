'use strict';
/* Browser-only profile studio. Public share links store content in the URL hash, not on the server. */
const PM=(()=>{
const root=document.getElementById('pm-app'),STORE='nk_profile_canvas_v1';
const TYPES={text:'文章',facts:'基本情報',tags:'好きなもの／タグ',list:'リスト',rank:'ランキング',qa:'質問と回答',timeline:'年表',links:'リンク集',image:'画像',quote:'好きな言葉',divider:'区切り'};
const PRESETS={
 candy:{label:'🍬 ゆめかわ',accent:'#df4b9f',bg:'#fff5fa',paper:'#ffffff',text:'#50304a',pattern:'dots',font:'rounded'},
 night:{label:'🌙 夜空',accent:'#afa0ef',bg:'#1e1a32',paper:'#30294b',text:'#faf2ff',pattern:'grid',font:'sans'},
 mint:{label:'🍃 ミント',accent:'#168d7b',bg:'#e7fff6',paper:'#ffffff',text:'#284d46',pattern:'none',font:'sans'},
 retro:{label:'🕹️ レトロ',accent:'#c96b33',bg:'#fff5d4',paper:'#fff9eb',text:'#44352a',pattern:'stripes',font:'mono'},
 clean:{label:'✍️ シンプル',accent:'#4b6fad',bg:'#f3f7ff',paper:'#ffffff',text:'#263248',pattern:'none',font:'serif'}
};
let p,view=false,toastTimer;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color=(c,f)=>/^#[0-9a-f]{6}$/i.test(c)?c:f;
const pic=v=>typeof v==='string' && (/^https:\/\/[^\s<>"']{1,1500}$/.test(v)||/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]{1,150000}$/.test(v))?v:'';
const link=v=>{try{const x=new URL(String(v||''));return x.protocol==='https:'&&!x.username&&!x.password?x.href:''}catch(_){return ''}};
const id=()=>crypto.getRandomValues(new Uint8Array(8)).reduce((s,n)=>s+n.toString(16).padStart(2,'0'),'');
function empty(){
 const game=window.NKM?.profile?.()||{};
 return {v:1,name:game.name||'あなたの名前',subtitle:'My Profile / 自己紹介',bio:'好きなものや、みんなに知ってほしいことを自由に書いてみよう！',emoji:game.emoji||'🌸',avatar:pic(game.avatar),cover:'',
 theme:{accent:'#df4b9f',bg:'#fff5fa',paper:'#ffffff',text:'#50304a',pattern:'dots',font:'rounded',columns:2,radius:20,spacing:16,shadow:true},
 blocks:[{id:id(),type:'facts',title:'わたしについて',body:'呼び名｜おかゆ\n好きな時間｜夜\n最近のブーム｜ゲーム',wide:false},
 {id:id(),type:'tags',title:'好きなもの',body:'ゲーム,アニメ,音楽,お絵描き',wide:false},
 {id:id(),type:'text',title:'ひとこと',body:'気軽に声をかけてください！',wide:true},
 {id:id(),type:'qa',title:'Q&A',body:'休日は何をする？｜ゲームをする！\n最近楽しかったことは？｜友達と遊んだこと',wide:true}]}
}
function validate(x){
 if(!x||typeof x!=='object')throw Error('プロフィールデータの形式が不正です');
 const t=x.theme||{},safe=(v,valid,f)=>valid.includes(v)?v:f;
 return {v:1,name:String(x.name||'').slice(0,70),subtitle:String(x.subtitle||'').slice(0,130),bio:String(x.bio||'').slice(0,1500),emoji:String(x.emoji||'🌸').slice(0,8),avatar:pic(x.avatar),cover:pic(x.cover),
 theme:{accent:color(t.accent,'#df4b9f'),bg:color(t.bg,'#fff5fa'),paper:color(t.paper,'#ffffff'),text:color(t.text,'#50304a'),
 pattern:safe(t.pattern,['none','dots','grid','stripes'],'dots'),font:safe(t.font,['rounded','sans','serif','mono'],'rounded'),columns:t.columns===1?1:2,
 radius:Math.max(0,Math.min(36,Number(t.radius)||0)),spacing:Math.max(8,Math.min(30,Number(t.spacing)||16)),shadow:t.shadow!==false},
 blocks:(Array.isArray(x.blocks)?x.blocks:[]).slice(0,30).map(b=>({id:typeof b.id==='string'&&/^[a-zA-Z0-9_-]{3,30}$/.test(b.id)?b.id:id(),type:TYPES[b.type]?b.type:'text',title:String(b.title||'').slice(0,90),body:String(b.body||'').slice(0,5000),image:pic(b.image),wide:b.wide===true,hidden:b.hidden===true}))}
}
function restore(){try{return validate(JSON.parse(localStorage.getItem(STORE)))}catch(_){return empty()}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(p));return true}catch(_){notice('保存容量が不足しています。画像を減らすかJSONでバックアップしてください。');return false}}
function notice(t){
 let el=document.getElementById('pm-toast');if(!el){el=document.createElement('div');el.id='pm-toast';el.className='pm-toast';document.body.appendChild(el)}
 el.textContent=t;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),4500)
}
function pairs(s){return String(s||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,60).map(v=>{let k=v.indexOf('｜');if(k<0)k=v.indexOf('|');return k<0?[v,'']:[v.slice(0,k).trim(),v.slice(k+1).trim()]})}
function card(b){
 if(b.hidden)return '';
 let body='',parts=pairs(b.body);
 switch(b.type){
 case 'facts':case 'timeline':body='<div class="pm-facts">'+parts.map(([a,v])=>'<div class="pm-fact"><strong>'+E(a)+'</strong><span>'+E(v)+'</span></div>').join('')+'</div>';break;
 case 'tags':body='<div class="pm-tags">'+b.body.split(/[,、\n]/).map(v=>v.trim()).filter(Boolean).slice(0,55).map(v=>'<span>'+E(v)+'</span>').join('')+'</div>';break;
 case 'list':case 'rank':{let tag=b.type==='rank'?'ol':'ul';body='<'+tag+' class="pm-list">'+b.body.split(/\r?\n/).filter(Boolean).map(v=>'<li>'+E(v)+'</li>').join('')+'</'+tag+'>';break}
 case 'links':body='<div class="pm-links">'+parts.map(([name,url])=>link(url)?'<a href="'+E(link(url))+'" rel="noopener noreferrer nofollow" target="_blank">↗ '+E(name||url)+'</a>':'<span>'+E(name)+'（URL未設定）</span>').join('')+'</div>';break;
 case 'qa':body='<div class="pm-qa">'+parts.map(([q,a])=>'<details><summary>'+E(q)+'</summary><p>'+E(a)+'</p></details>').join('')+'</div>';break;
 case 'image':body=(pic(b.image)?'<img class="pm-image" src="'+E(b.image)+'" alt="'+E(b.title)+'">':'<p>画像を追加してください</p>')+'<p>'+E(b.body)+'</p>';break;
 case 'quote':body='<div class="pm-quote">'+E(b.body)+'</div>';break;
 case 'divider':body='<hr>';break;
 default:body='<p>'+E(b.body)+'</p>'
 }
 return '<section class="pm-card '+(b.wide?'pm-span-full':'')+'">'+(b.title?'<h2>'+E(b.title)+'</h2>':'')+body+'</section>';
}
function preview(){
 const t=p.theme,fonts={rounded:'system-ui,sans-serif',sans:'Meiryo,system-ui,sans-serif',serif:'YuMincho,serif',mono:'Consolas,monospace'};
 const styles='--bg:'+t.bg+';--paper:'+t.paper+';--text:'+t.text+';--accent:'+t.accent+';--radius:'+t.radius+'px;--gap:'+t.spacing+'px;--font:'+fonts[t.font]+';';
 const cover=pic(p.cover)?' style="background-image:url(&quot;'+E(p.cover)+'&quot;)"':'';
 const avatar=pic(p.avatar)?'<img class="pm-avatar" alt="" src="'+E(p.avatar)+'">':'<div class="pm-avatar">'+E(p.emoji)+'</div>';
 return '<article class="pm-sheet pm-pattern-'+t.pattern+' '+(t.columns===2?'pm-two-cols ':'')+(t.shadow?'pm-shadow':'')+'" style="'+E(styles)+'"><div class="pm-header"><div class="pm-cover"'+cover+'></div><div class="pm-header-main">'+avatar+
 '<div class="pm-title"><h1>'+E(p.name||'無題')+'</h1><small>'+E(p.subtitle)+'</small></div></div><p class="pm-bio">'+E(p.bio)+'</p></div>'+
 '<div class="pm-cards">'+p.blocks.map(card).join('')+'</div><div class="pm-footer">♡ PROFILE MADE WITH なかみくらべ。</div></article>'
}
function showPreview(){const out=document.getElementById('pm-preview');if(out)out.innerHTML=preview()}
function input(label,key,val,kind='text',rows=3){return '<label class="pm-label">'+E(label)+'</label>'+(kind==='area'?'<textarea class="pm-field" rows="'+rows+'" data-main="'+key+'">'+E(val)+'</textarea>':'<input class="pm-field" data-main="'+key+'" value="'+E(val)+'" maxlength="1500">')}
function selection(label,name,choices,current){return '<label class="pm-label">'+E(label)+'</label><select class="pm-field" data-theme="'+name+'">'+choices.map(([key,text])=>'<option value="'+E(key)+'" '+(String(key)===String(current)?'selected':'')+'>'+E(text)+'</option>').join('')+'</select>'}
function imageUpload(target,text){return '<label class="pm-btn">'+E(text)+'<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-upload="'+target+'"></label>'}
function blockEditor(b,i){
 const guide={text:'自由な文章。改行も反映',facts:'「項目｜内容」を1行ずつ',tags:'カンマ区切り',list:'1行につき1項目',rank:'1行につき1項目',qa:'「質問｜回答」を1行ずつ',timeline:'「年月｜出来事」を1行ずつ',links:'「表示名｜https://URL」を1行ずつ',image:'写真＋キャプション',quote:'お気に入りの言葉'};
 return '<div class="pm-block-editor"><div class="pm-editor-head"><b>'+E(TYPES[b.type])+' '+(i+1)+'</b><span class="pm-actions">'+
 '<button class="pm-btn" data-do="up" data-i="'+i+'">↑</button><button class="pm-btn" data-do="down" data-i="'+i+'">↓</button>'+
 '<button class="pm-btn" data-do="copy" data-i="'+i+'">複製</button><button class="pm-btn danger" data-do="remove" data-i="'+i+'">削除</button></span></div>'+
 '<details><summary>'+E(b.title||'(タイトルなし)')+'</summary>'+
 '<label class="pm-label">カードの種類</label><select class="pm-field" data-i="'+i+'" data-block="type">'+Object.entries(TYPES).map(([k,v])=>'<option value="'+k+'" '+(k===b.type?'selected':'')+'>'+E(v)+'</option>').join('')+'</select>'+
 '<label class="pm-label">見出し</label><input class="pm-field" data-i="'+i+'" data-block="title" value="'+E(b.title)+'">'+
 (b.type==='image'?'<label class="pm-label">画像URL（https://）</label><input class="pm-field" data-i="'+i+'" data-block="image" value="'+E(b.image.startsWith('data:')?'':b.image)+'">'+imageUpload('b'+i,'📷 画像ファイルを使う'):'')+
 (b.type!=='divider'?'<label class="pm-label">内容</label><textarea rows="4" class="pm-field" data-i="'+i+'" data-block="body">'+E(b.body)+'</textarea><p class="pm-muted">'+E(guide[b.type]||'')+'</p>':'')+
 '<label class="pm-row"><input type="checkbox" data-i="'+i+'" data-block="wide" '+(b.wide?'checked':'')+'> 幅いっぱいに広げる</label>'+
 '<label class="pm-row"><input type="checkbox" data-i="'+i+'" data-block="hidden" '+(b.hidden?'checked':'')+'> 一時的に非表示</label></details></div>'
}
function editor(){
 root.className='pm-layout';
 let t=p.theme;
 root.innerHTML='<aside class="pm-sidebar"><div class="pm-box"><h2>🌈 プロフィール工房</h2><p>好きなもの、経歴、質問、写真……自分だけのプロフィールを作れます。</p>'+
 input('表示名','name',p.name)+input('肩書き・サブタイトル','subtitle',p.subtitle)+input('自己紹介','bio',p.bio,'area',4)+input('アイコン絵文字','emoji',p.emoji)+
 input('アバター画像URL','avatar',p.avatar.startsWith('data:')?'':p.avatar)+
 '<div class="pm-actions">'+imageUpload('avatar','📷 画像を選択')+'<button class="pm-btn" data-do="clear-avatar">画像を外す</button></div>'+
 input('カバー画像URL','cover',p.cover.startsWith('data:')?'':p.cover)+
 '<div class="pm-actions">'+imageUpload('cover','🖼️ カバーを選択')+'<button class="pm-btn" data-do="clear-cover">外す</button></div></div>'+
 '<div class="pm-box"><h2>🎨 デザイン</h2><div class="pm-template-row">'+Object.entries(PRESETS).map(([k,v])=>'<button data-do="preset" data-key="'+k+'">'+E(v.label)+'</button>').join('')+'</div>'+
 '<div class="pm-colors">'+[['accent','メイン色'],['bg','背景'],['paper','カード色'],['text','文字色']].map(([k,label])=>'<label>'+label+'<input type="color" data-theme="'+k+'" value="'+E(t[k])+'"></label>').join('')+'</div>'+
 selection('背景の模様','pattern',[['none','無地'],['dots','ドット'],['grid','グリッド'],['stripes','ストライプ']],t.pattern)+
 selection('文字フォント','font',[['rounded','丸みのある文字'],['sans','シンプル'],['serif','明朝'],['mono','等幅']],t.font)+
 selection('カードの列数','columns',[[1,'縦1列'],[2,'2列（スマホは1列）']],t.columns)+
 '<label class="pm-label">角の丸さ</label><input type="range" class="pm-field" min="0" max="36" data-theme="radius" value="'+t.radius+'">'+
 '<label class="pm-label">余白</label><input type="range" class="pm-field" min="8" max="30" data-theme="spacing" value="'+t.spacing+'">'+
 '<label class="pm-row"><input type="checkbox" data-theme="shadow" '+(t.shadow?'checked':'')+'> カードに影をつける</label></div>'+
 '<div class="pm-box pm-editor-wrap"><h2>🧩 自由なカード（'+p.blocks.length+'/30）</h2><p>好きなカードを何枚でも追加・移動・複製できます（最大30枚）。カード名を押すと編集できます。</p>'+
 p.blocks.map(blockEditor).join('')+'<label class="pm-label">追加する種類</label><select id="pm-type" class="pm-field">'+Object.entries(TYPES).map(([k,v])=>'<option value="'+k+'">'+E(v)+'</option>').join('')+'</select>'+
 '<button class="pm-btn primary" data-do="add">＋ カードを追加</button></div>'+
 '<div class="pm-box"><h2>📦 保存・共有</h2><p class="pm-notice">自動保存はこのブラウザ内。外部データベースの設定は必要ありません。共有する文章・画像には個人情報を含めないでください。</p>'+
 '<div class="pm-actions"><button class="pm-btn primary" data-do="share">🔗 共有リンクをコピー</button><button class="pm-btn" data-do="export">JSONバックアップ</button>'+
 '<label class="pm-btn">JSONを読み込む<input hidden type="file" data-upload="json" accept="application/json,.json"></label><button class="pm-btn" data-do="print">🖨️ 印刷 / PDF</button>'+
 '<button class="pm-btn" data-do="sync">ゲームに名前を反映</button><button class="pm-btn danger" data-do="reset">初期化</button></div>'+
 '<p>共有URLはデータを圧縮して含めます。大きな写真を何枚もアップロードするとURLの制限を超えることがあります。その場合は画像URLを使うかJSONで共有してください。</p></div></aside>'+
 '<div class="pm-workspace"><div class="pm-workspace-bar"><b>👀 リアルタイムプレビュー</b><span>保存は自動です</span></div><div id="pm-preview" class="pm-preview"></div></div>';
 showPreview()
}
function viewer(){
 root.className='pm-layout pm-view-only';
 root.innerHTML='<div class="pm-view-actions"><button class="pm-btn" data-do="edit">自分のプロフィールを編集</button><button class="pm-btn" data-do="print">🖨️ 印刷・PDF保存</button></div><div id="pm-preview" class="pm-preview"></div>';
 showPreview()
}
function setField(el){
 const key=el.dataset.main;
 if(key){p[key]=key==='avatar'||key==='cover'?pic(el.value):String(el.value).slice(0,key==='bio'?1500:130)}
 if(el.dataset.theme){
  const field=el.dataset.theme,t=p.theme;t[field]=el.type==='checkbox'?el.checked:el.type==='range'||field==='columns'?Number(el.value):el.value;
 }
 if(el.dataset.block){
  const b=p.blocks[Number(el.dataset.i)],key=el.dataset.block;if(!b)return;
  b[key]=el.type==='checkbox'?el.checked:key==='image'?pic(el.value):String(el.value).slice(0,key==='body'?5000:100);
  if(key==='type'){save();editor();return}
 }
 save();showPreview()
}
async function upload(el){
 const file=el.files?.[0],target=el.dataset.upload;if(!file)return;
 if(target==='json'){
  if(file.size>1500000)return notice('JSONは1.5MB以下にしてください');
  try{const parsed=JSON.parse(await file.text()),freshData=validate(parsed.profile||parsed);if(!confirm('現在のプロフィールを読み込んだデータで置き換えますか？'))return;p=freshData;save();editor();notice('読み込みました')}catch(e){notice('読み込み失敗：'+e.message)}
  return
 }
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8e6)return notice('8MB以下のPNG/JPEG/WebP画像を選んでください');
 const object=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('画像を開けません'));img.src=object});
  const width=target==='avatar'?300:target==='cover'?800:520,ratio=Math.min(1,width/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let value='';for(const q of [.72,.56,.42]){value=canvas.toDataURL('image/jpeg',q);if(value.length<125000)break}
  if(!pic(value))throw Error('画像が大きすぎます');
  if(target.startsWith('b')){const b=p.blocks[Number(target.slice(1))];if(b)b.image=value}
  else p[target]=value;
  save();editor();notice('画像を設定しました')
 }catch(e){notice('画像の設定に失敗しました：'+e.message)}finally{URL.revokeObjectURL(object)}
}
function exportData(){
 const blob=new Blob([JSON.stringify({kind:'nakami-profile',profile:p},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='nakami-profile.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800)
}
function toB64(bytes){
 let out='';for(let i=0;i<bytes.length;i+=6000)out+=String.fromCharCode(...bytes.slice(i,i+6000));
 return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
function fromB64(str){
 if(!/^[A-Za-z0-9_-]{1,90000}$/.test(str))throw Error('不正なURL形式です');
 const input=atob(str.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((str.length+3)%4));return Uint8Array.from(input,c=>c.charCodeAt(0))
}
async function share(){
 try{
  const raw=new TextEncoder().encode(JSON.stringify(validate(p)));let zipped=raw,kind='j';
  if(typeof CompressionStream==='function'){zipped=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());kind='g'}
  const url=location.origin+'/profile-maker#p='+kind+toB64(zipped);
  if(url.length>16000)return notice('プロフィール画像が大きく共有URLに入りません。画像をHTTPSのリンクにするかJSONファイルで共有してください');
  try{await navigator.clipboard.writeText(url);notice('友達に送れるプロフィールURLをコピーしました！')}catch(_){prompt('このURLをコピーしてください',url)}
 }catch(e){notice('リンクを作れませんでした：'+e.message)}
}
async function openShared(hash){
 if(hash.length>90000)throw Error('長すぎるURLです');
 const kind=hash[0],data=fromB64(hash.slice(1));
 let decoded=data;
 if(kind==='g'){
  if(!window.DecompressionStream)throw Error('このブラウザは共有リンクを解凍できません');
  decoded=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
 }else if(kind!=='j')throw Error('共有形式が不正です');
 if(decoded.length>500000)throw Error('プロフィールが大きすぎます');
 return validate(JSON.parse(new TextDecoder().decode(decoded)))
}
function operate(el){
 const op=el.dataset.do,i=Number(el.dataset.i||0);
 if(op==='add'){
  if(p.blocks.length>=30)return notice('カードは30枚までです');
  const type=document.getElementById('pm-type').value;p.blocks.push({id:id(),type,title:TYPES[type],body:'',image:'',wide:false,hidden:false})
 }else if(op==='up'||op==='down'){
  const j=i+(op==='up'?-1:1);if(j<0||j>=p.blocks.length)return;[p.blocks[i],p.blocks[j]]=[p.blocks[j],p.blocks[i]]
 }else if(op==='copy'){
  if(p.blocks.length>=30)return notice('カードは30枚までです');
  p.blocks.splice(i+1,0,{...p.blocks[i],id:id(),title:p.blocks[i].title+'（コピー）'})
 }else if(op==='remove'){if(!confirm('このカードを削除しますか？'))return;p.blocks.splice(i,1)}
 else if(op==='clear-avatar')p.avatar='';
 else if(op==='clear-cover')p.cover='';
 else if(op==='preset'){const preset=PRESETS[el.dataset.key];if(!preset)return;Object.assign(p.theme,preset)}
 else if(op==='reset'){if(!confirm('プロフィールを初期化しますか？ 必要ならJSONを保存してください。'))return;p=empty()}
 else if(op==='export')return exportData();
 else if(op==='share')return share();
 else if(op==='print')return window.print();
 else if(op==='sync'){const old=NKM.profile();NKM.saveProfile({name:p.name.slice(0,24),emoji:p.emoji,avatar:old.avatar});return notice('ゲームの表示名と絵文字を反映しました')}
 else if(op==='edit'){history.replaceState(null,'',location.pathname);view=false;p=restore();return editor()}
 else return;
 save();editor()
}
root.addEventListener('input',ev=>{if(ev.target.matches('[data-main],[data-theme],[data-block]'))setField(ev.target)});
root.addEventListener('change',ev=>{if(ev.target.dataset.upload)return upload(ev.target);if(ev.target.matches('[data-main],[data-theme],[data-block]'))setField(ev.target)});
root.addEventListener('click',ev=>{const el=ev.target.closest('[data-do]');if(el)operate(el)});
(async()=>{
 if(location.hash.startsWith('#p=')){
  try{p=await openShared(location.hash.slice(3));view=true;viewer();return}catch(e){history.replaceState(null,'',location.pathname);notice('共有リンクを開けません：'+e.message)}
 }
 p=restore();editor()
})();
return {empty,validate,preview,card,openShared};
})();
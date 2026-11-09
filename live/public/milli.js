'use strict';
/* ミリしら authoring, answer and results UI. No real character facts are sent to respondents. */
const Milli=(()=>{
const root=document.getElementById('milli-root'),KEY='nakami_milli_projects_v1';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>{const a=new Uint8Array(9);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};
const btn=(s,fn,k='')=>`<button type="button" class="btn ${k}" onclick="Milli.${fn}">${E(s)}</button>`;
const field=(s,id,value,max=85)=>`<label class="label" for="${id}">${E(s)}</label><input class="field" id="${id}" maxlength="${max}" value="${E(value)}">`;
const card=(title,inside)=>`<section class="card"><h2>${E(title)}</h2>${inside}</section>`;
const warn=s=>`<p class="note">${s}</p>`;
const blankFields=()=>[{id:uid(),label:'このキャラの名前は？',type:'short',options:[]},{id:uid(),label:'性格は？',type:'long',options:[]},{id:uid(),label:'どんな役割・過去がありそう？',type:'long',options:[]}];
const newCharacter=()=>({id:uid(),label:'キャラクター',image:'',truthNote:'',fields:blankFields()});
const empty=()=>({id:uid(),title:'',series:'',hideSeries:false,randomCount:0,characters:[newCharacter()],published:[]});
let projects=[],current=null,active=0,mode='home',challenge=null,response={},answerIndex=0,resultData=null,manageId='',manageKey='',sending=false,showcase=false;
try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(raw))projects=raw.filter(x=>x&&Array.isArray(x.characters)).slice(0,30)}catch(_){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(projects))}catch(_){alert('端末の保存容量がいっぱいです。画像の枚数を減らすか、JSONでバックアップしてください。')}}
function message(msg,kind='note'){const target=document.getElementById('milli-message');if(target){target.innerHTML=`<p class="${kind}">${E(msg)}</p>`;target.scrollIntoView({behavior:'smooth',block:'nearest'})}else alert(msg)}
function home(){mode='home';current=null;const rows=projects.map((p,i)=>`<div class="list-item"><div><b>${E(p.title||'無題のミリしら')}</b><p class="muted">${E(p.series||'作品名未設定')} · ${p.characters.length}キャラ · 公開リンク${(p.published||[]).length}件</p></div><div class="bar">${btn('編集',`edit(${i})`,'sub')}${btn('削除',`remove(${i})`,'outline')}</div></div>`).join('')||'<p class="muted">まだセットがありません。最初のミリしらを作成しましょう。</p>';
root.innerHTML=`<div class="hero"><span class="pill">SOLO CREATE / SHARE / ANSWER</span><h1>キャラクター・ミリしら</h1><p>キャラの見た目だけを頼りに、名前も性格も生死も想像してみよう。<br>作る人が画像と質問を決め、友達は共有リンクから自分の設定を考えます。</p></div>${card('ミリしらを作成',`<p>キャラごとに質問を自由追加。画像と選択式・記述式の質問を組み合わせられます。</p><div class="bar">${btn('＋ 新しいセットを作る','create()')}${btn('JSONを読み込む','openImport()','outline')}<input type="file" accept="application/json,.json" id="import-file" hidden onchange="Milli.importFile(event)"></div>`)}${card('自分のセット',`<div class="rows">${rows}</div>`)}${warn('画像はアップロード時に縮小して保存します。回答者用リンクには作者の正解や秘密メモを含めません。回答はニックネームと入力した文章のみ保存し、作者だけが見られます。')}`}
function create(){const p=empty();projects.unshift(p);save();edit(0)}
function edit(i){current=projects[i];if(!current)return home();active=0;mode='edit';renderEdit()}
function remove(i){if(!confirm('この端末にあるセットを削除しますか？ 公開済みのリンクは残ります。'))return;projects.splice(i,1);save();home()}
function update(k,value){if(current){current[k]=value;save()}}
function changeChar(i,k,value){const p=current?.characters[i];if(p){p[k]=value;save()}}
function updateField(i,j,key,value){const f=current?.characters[i]?.fields[j];if(!f)return;f[key]=value;if(key==='type'){f.options=value==='choice'?['生存','死亡','不明']:[];renderEdit()}save()}
function updateOptions(i,j,s){const f=current?.characters[i]?.fields[j];if(f){f.options=s.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,12);save()}}
function addChar(){if(current.characters.length>=20)return message('キャラクターは20人までです','error');const c=newCharacter();c.label='キャラクター '+(current.characters.length+1);current.characters.push(c);active=current.characters.length-1;save();renderEdit()}
function cloneChar(){const c=current.characters[active];if(!c)return;if(current.characters.length>=20)return message('20人までです','error');const d=JSON.parse(JSON.stringify(c));d.id=uid();d.label+='（複製）';d.fields.forEach(f=>f.id=uid());current.characters.splice(active+1,0,d);active++;save();renderEdit()}
function removeChar(){if(current.characters.length<=1)return message('最低1キャラは必要です','error');if(!confirm('このキャラを削除しますか？'))return;current.characters.splice(active,1);active=Math.max(0,active-1);save();renderEdit()}
function addField(){const c=current.characters[active];if(c.fields.length>=16)return message('1キャラの質問は16個までです','error');c.fields.push({id:uid(),label:'新しい質問',type:'short',options:[],truth:''});save();renderEdit()}
function removeField(i){const c=current.characters[active];if(c.fields.length<=1)return message('最低1問は必要です','error');c.fields.splice(i,1);save();renderEdit()}
function moveField(i,step){const c=current.characters[active],j=i+step;if(j<0||j>=c.fields.length)return;[c.fields[i],c.fields[j]]=[c.fields[j],c.fields[i]];save();renderEdit()}
function addLifeField(){const c=current.characters[active];if(c.fields.some(f=>f.label==='生存／死亡予想'))return message('すでに生死の質問があります');c.fields.push({id:uid(),label:'生存／死亡予想',type:'choice',options:['生存','死亡','不明・その他'],truth:''});save();renderEdit()}
function copyQuestions(){const c=current.characters[active];if(!confirm('このキャラの質問項目をほかの全キャラにコピーしますか？'))return;current.characters.forEach(x=>{if(x.id!==c.id)x.fields=c.fields.map(f=>({...f,id:uid(),options:[...f.options]}))});save();renderEdit()}
function moveChar(i,step){const j=i+step;if(j<0||j>=current.characters.length)return;[current.characters[i],current.characters[j]]=[current.characters[j],current.characters[i]];active=j;save();renderEdit()}
function setURL(){const value=prompt('画像の直接URL（https:// で始まるURL）',current.characters[active].image.startsWith('https://')?current.characters[active].image:'');if(value===null)return;if(value&&!/^https:\/\/[^\s<>"']{1,1000}$/.test(value))return message('https:// で始まる直接画像URLを入力してください','error');changeChar(active,'image',value);renderEdit()}
function removeImage(){changeChar(active,'image','');renderEdit()}
async function imageUpload(ev){const file=ev.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>9e6)return message('PNG / JPEG / WebP（9MB以下）を選んでください','error');try{
 const url=URL.createObjectURL(file);const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});let dim=560,quality=.70,data='';for(let attempt=0;attempt<6;attempt++){
 const ratio=Math.min(1,dim/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/webp',quality);if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',quality);if(data.length<84000)break;dim=Math.round(dim*.77);quality=Math.max(.42,quality-.055)
 }if(data.length>100000)throw new Error('画像を十分に縮小できませんでした');current.characters[active].image=data;save();renderEdit()}finally{URL.revokeObjectURL(url)}}catch(e){message(e.message||'画像を読み込めませんでした','error')}}
function renderEdit(){if(!current)return home();mode='edit';let c=current.characters[active]||current.characters[0];const tabs=current.characters.map((v,i)=>`<button type="button" class="character ${i===active?'selected':''}" onclick="Milli.selectChar(${i})">${v.image?`<img src="${E(v.image)}" alt="">`:''}<span>${E(v.label)}</span></button>`).join('');const questions=c.fields.map((f,j)=>`<div class="question"><div class="question-head"><b>Q${j+1}</b><button class="btn sub" onclick="Milli.moveField(${j},-1)" aria-label="上へ">↑</button><button class="btn sub" onclick="Milli.moveField(${j},1)" aria-label="下へ">↓</button><button class="btn outline" onclick="Milli.removeField(${j})" aria-label="削除">×</button></div><label class="label">質問文</label><input class="field" maxlength="90" value="${E(f.label)}" oninput="Milli.updateField(${active},${j},'label',this.value)"><label class="label">回答の形式</label><select onchange="Milli.updateField(${active},${j},'type',this.value)"><option value="short" ${f.type==='short'?'selected':''}>短い文章</option><option value="long" ${f.type==='long'?'selected':''}>自由記述</option><option value="choice" ${f.type==='choice'?'selected':''}>選択肢</option></select>${f.type==='choice'?`<label class="label">選択肢（1行ずつ）</label><textarea rows="3" oninput="Milli.updateOptions(${active},${j},this.value)">${E(f.options.join('\n'))}</textarea>`:''}<label class="label">本当の答え・公式設定（任意／回答者には非公開）</label><textarea rows="2" maxlength="600" placeholder="答え合わせで表示する内容" oninput="Milli.updateField(${active},${j},'truth',this.value)">${E(f.truth||'')}</textarea></div>`).join('');
const pub=(current.published||[]).map((v,i)=>`<div class="publication"><b>公開リンク ${i+1}</b><p class="muted">公開から30日間・デプロイで消える可能性があります</p><label class="label">回答者に送るリンク</label><input class="field" readonly value="${E(location.origin+'/milli#play:'+v.id)}" onclick="this.select()"><div class="bar">${btn('回答者URLをコピー',`copyLink(${i},'play')`,'sub')}${btn('回答一覧を開く',`goResults(${i})`,'gold')}${btn('作者専用URLをコピー',`copyLink(${i},'results')`,'outline')}${btn('展示会URLをコピー',`copyLink(${i},'gallery')`,'sub')}</div></div>`).join('');
root.innerHTML=`<div class="hero"><div class="bar space"><h1>📝 ミリしらの作成</h1>${btn('保存一覧へ戻る','home()','sub')}</div><p>1人ずつのキャラ画像と質問を作成します。正式なキャラの設定は入力しなくても遊べます。</p></div>${card('セットの情報',`${field('セット名','ms-title',current.title,85)}${field('作品名・シリーズ名','ms-series',current.series,85)}<label class="milli-toggle"><input type="checkbox" ${current.hideSeries?'checked':''} onchange="Milli.update('hideSeries',this.checked)"> ミリしら回答中は作品名を隠す（答え合わせ時に公開）</label><label class="label" for="ms-random">ランダム出題する人数</label><select id="ms-random" onchange="Milli.update('randomCount',Number(this.value))"><option value="0" ${(current.randomCount||0)===0?'selected':''}>全キャラクターを出題</option>${current.characters.map((_,i)=>`<option value="${i+1}" ${(current.randomCount||0)===i+1?'selected':''}>${i+1}人をランダム出題</option>`).join('')}</select><p class="muted">キャラ名を伏せたいときは表示名を「キャラクター1」などにしてください。</p>`)}${card('キャラクター（'+current.characters.length+'/20）',`<div class="characters">${tabs}</div><div class="bar">${btn('＋ キャラを追加','addChar()')}${btn('キャラを複製','cloneChar()','sub')}${btn('順番↑',`moveChar(${active},-1)`,'sub')}${btn('順番↓',`moveChar(${active},1)`,'sub')}${btn('キャラを削除','removeChar()','outline')}</div><div class="editor-grid"><div>${field('回答者に見せるキャラ表示名','ms-char-label',c.label,70)}${c.image?`<img class="thumb" src="${E(c.image)}" alt="キャラの画像">`:'<div class="noimg">🖼️ キャラ画像を追加</div>'}<div class="bar"><label class="btn sub" style="cursor:pointer">画像をアップロード<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="Milli.imageUpload(event)"></label>${btn('画像URLを使う','setURL()','sub')}${c.image?btn('画像を外す','removeImage()','outline'):''}</div><p class="muted">画像は自動圧縮。アニメ・ゲームの画像は利用許諾や公開範囲にご注意ください。</p><label class="label">キャラクターの公式設定・補足（任意／回答者には非公開）</label><textarea rows="4" maxlength="1200" placeholder="本当の名前、背景、物語上の役割などを記入" oninput="Milli.changeChar(${active},'truthNote',this.value)">${E(c.truthNote||'')}</textarea></div><div><h3>質問項目（${c.fields.length}/16）</h3><p class="muted">キャラごとに質問を別々に設定できます。生死の質問が不要なら追加しなくてOK。</p>${questions}<div class="bar">${btn('＋ 自由な質問を追加','addField()')}${btn('生存／死亡を追加','addLifeField()','gold')}${btn('この質問を全キャラへ複製','copyQuestions()','sub')}</div></div></div>`)}${card('保存・共有',`<div id="milli-message"></div><div class="bar">${btn('この端末に保存','saveCurrent()','sub')}${btn('JSONバックアップ','exportCurrent()','outline')}${btn('🔗 友達用の回答リンクを発行','publish()')}</div><p class="muted">公開すると、その時点のセットをサーバーに30日間保存します。編集した内容を反映するには新しいリンクを発行してください。URLを知る人だけが回答でき、作者専用URLで結果を確認できます。</p>${pub}`)}`;
 document.getElementById('ms-title').addEventListener('input',e=>update('title',e.target.value));document.getElementById('ms-series').addEventListener('input',e=>update('series',e.target.value));document.getElementById('ms-char-label').addEventListener('input',e=>changeChar(active,'label',e.target.value));
}
function selectChar(i){active=i;renderEdit()}
function saveCurrent(){save();message('この端末に保存しました。','success')}
function exportCurrent(){if(!current)return;download('millishira-set.json',JSON.stringify({kind:'nakami-millishira',project:current},null,2),'application/json')}
function openImport(){document.getElementById('import-file').click()}
async function importFile(ev){
 const file=ev.target.files?.[0];if(!file||file.size>800000)return alert('800KB以下のJSONを選んでください');
 try{
  const v=JSON.parse(await file.text()),raw=v.project||v;
  if(!raw||!Array.isArray(raw.characters)||!raw.characters.length)throw new Error('キャラがありません');
  const p=empty();p.title=String(raw.title||'').slice(0,85);p.series=String(raw.series||'').slice(0,85);p.hideSeries=raw.hideSeries===true;p.randomCount=Number.isInteger(raw.randomCount)&&raw.randomCount>=0?Math.min(raw.randomCount,raw.characters.length,20):0;
  p.characters=raw.characters.slice(0,20).map((item,i)=>{
    const c=item&&typeof item==='object'?item:{};
    const image=String(c.image||'');
    const acceptedImage=image.length<=110000&&(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/.test(image)||/^https:\/\/[^\s<>"']{1,1000}$/.test(image));
    const fields=(Array.isArray(c.fields)?c.fields:[]).slice(0,16).map(q=>{
      q=q&&typeof q==='object'?q:{};
      const type=['short','long','choice'].includes(q.type)?q.type:'short';
      const opts=Array.isArray(q.options)?q.options.filter(x=>typeof x==='string').map(x=>x.slice(0,70).trim()).filter(Boolean).slice(0,12):[];
      return {id:uid(),label:String(q.label||'質問').slice(0,90),type,options:type==='choice'?(opts.length>=2?opts:['はい','いいえ']):[],truth:String(q.truth||'').slice(0,600)};
    });
    return {id:uid(),label:String(c.label||'キャラクター '+(i+1)).slice(0,70),image:acceptedImage?image:'',truthNote:String(c.truthNote||'').slice(0,1200),fields:fields.length?fields:blankFields()};
  });
  projects.unshift(p);save();edit(0);
 }catch(e){alert('読み込み失敗：'+e.message)}
}
function validated(){if(!current?.title.trim()||current.title.trim().length<2)throw new Error('セット名を2文字以上で入力してください');const copy=JSON.parse(JSON.stringify(current));delete copy.published;delete copy.id;copy.characters.forEach((c,i)=>{if(!c.label.trim())throw new Error((i+1)+'人目のキャラ表示名がありません');if(!c.fields.length)throw new Error('質問がないキャラがあります');c.fields.forEach(q=>{if(!q.label.trim())throw new Error('空の質問文があります');if(q.type==='choice'&&q.options.length<2)throw new Error('選択肢は2個以上必要です')})});return copy}
async function postJSON(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){let message=await r.text();throw new Error(message.slice(0,200))}return await r.json()}
async function publish(){if(sending)return;try{const data=validated();sending=true;message('公開リンクを発行しています…');const result=await postJSON('/api/milli',data);current.published=current.published||[];current.published.unshift({id:result.id,key:result.ownerKey,created:Date.now()});save();renderEdit();message('共有リンクを発行しました！ 回答者用URLを友達に送ってください。','success')}catch(e){message(e.message||'公開できませんでした','error')}finally{sending=false}}
function publicationLink(i,type){const p=current?.published?.[i];if(!p)return'';return location.origin+'/milli#'+(type==='results'?`results:${p.id}:${p.key}`:type==='gallery'?`gallery:${p.id}`:`play:${p.id}`)}
async function copyLink(i,type){const v=publicationLink(i,type);if(!v)return;try{await navigator.clipboard.writeText(v);message(type==='results'?'作者専用URLをコピーしました。ほかの人には送らないでください。':type==='gallery'?'展示会URLをコピーしました。作者が公開をONにすると見られます。':'回答者用のリンクをコピーしました。','success')}catch(_){prompt('このURLをコピーしてください',v)}}
function goResults(i){const p=current?.published?.[i];if(!p)return;location.hash='results:'+p.id+':'+p.key;route()}
async function loadPlay(id){mode='play';root.innerHTML=card('読み込み中','キャラクターと質問を読み込んでいます…');try{const r=await fetch('/api/milli/'+encodeURIComponent(id),{cache:'no-store'});if(!r.ok)throw new Error((await r.text()).slice(0,160));challenge={id,...await r.json()};answerIndex=0;response={};showcase=false;challenge.spec.characters.forEach(c=>{response[c.id]={};c.fields.forEach(f=>response[c.id][f.id]='')});renderPlay()}catch(e){root.innerHTML=card('開けませんでした',`<p class="error">${E(e.message)}</p><a href="/milli">作成画面に戻る</a>`)}}
function updateAnswer(cid,fid,v){if(response[cid])response[cid][fid]=v}
function renderPlay(){if(!challenge)return;mode='play';const spec=challenge.spec,c=spec.characters[answerIndex];let q=c.fields.map((f,i)=>`<div class="question"><label class="label">Q${i+1}. ${E(f.label)}</label>${f.type==='choice'?`<div class="choice-list">${f.options.map(opt=>`<label><input type="radio" name="ans-${E(f.id)}" value="${E(opt)}" ${response[c.id]?.[f.id]===opt?'checked':''} onchange="Milli.updateAnswer('${c.id}','${f.id}',this.value)">${E(opt)}</label>`).join('')}</div>`:f.type==='long'?`<textarea maxlength="600" placeholder="このキャラの設定を自由に考えよう" oninput="Milli.updateAnswer('${c.id}','${f.id}',this.value)">${E(response[c.id]?.[f.id]||'')}</textarea>`:`<input class="field" maxlength="600" placeholder="思いつくままに入力" value="${E(response[c.id]?.[f.id]||'')}" oninput="Milli.updateAnswer('${c.id}','${f.id}',this.value)">`}</div>`).join('');root.innerHTML=`<div class="hero"><span class="pill">SPOILER-FREE / ミリしら回答</span><h1>${E(spec.title)}</h1><p>${E(spec.series)}　名前・性格・設定を想像して楽しもう。公式設定の知識は不要です。</p></div>${card('キャラクター '+(answerIndex+1)+' / '+spec.characters.length,`<div class="progress"><span style="width:${100*(answerIndex+1)/spec.characters.length}%"></span></div><h2>${E(c.label)}</h2>${c.image?`<img class="answer-photo" src="${E(c.image)}" alt="${E(c.label)}">`:'<div class="noimg">画像の設定なし</div>'}<div class="rows">${q}</div><div class="bar space">${btn('← 前のキャラ','prevAnswer()','sub')}${answerIndex===spec.characters.length-1?btn('回答を送信する','submit()'):btn('次のキャラ →','nextAnswer()')}</div>${answerIndex===spec.characters.length-1?'<label class="milli-toggle"><input type="checkbox" '+(showcase?'checked':'')+' onchange="Milli.setShowcase(this.checked)"> 自分のニックネームと回答を、作者が公開する展示会に載せてもよい（任意）</label>':''}<div id="milli-message"></div><p class="muted">回答は送信前なら何度でも編集できます。作者の正解やキャラ設定は送られていません。</p>`)}`}
function setShowcase(v){showcase=!!v}
function prevAnswer(){if(answerIndex>0){answerIndex--;renderPlay()}}
function nextAnswer(){if(answerIndex<challenge.spec.characters.length-1){answerIndex++;renderPlay()}}
async function submit(){if(sending)return;const name=prompt('回答者のニックネーム（作者に表示されます）','');if(name===null)return;if(!name.trim())return message('ニックネームを入力してください','error');sending=true;try{const receipt=await postJSON('/api/milli/'+challenge.id+'/submit',{name:name.slice(0,24),answers:response,showcase});if(receipt.voterToken)try{localStorage.setItem('nakami_milli_voter_'+challenge.id,receipt.voterToken)}catch(_){}mode='done';renderDone(name)}catch(e){message('送信できませんでした：'+e.message,'error')}finally{sending=false}}
function renderDone(name){const spec=challenge.spec;root.innerHTML=`<div class="hero"><h1>🎉 ミリしら回答を送信しました！</h1><p>${E(name)}さんの考えた設定を作者に届けました。</p></div>${card('あなたのミリしら設定',spec.characters.map(c=>`<details open class="question"><summary><b>${E(c.label)}</b></summary>${c.image?`<img class="smallimg" src="${E(c.image)}" alt="">`:''}${c.fields.map(q=>`<p><b>${E(q.label)}</b><span style="display:block;white-space:pre-wrap">${E(response[c.id]?.[q.id]||'（未回答）')}</span></p>`).join('')}</details>`).join('')+`<div class="bar">${btn('自分の回答をコピー','copyMyAnswer()','sub')}${btn('もう一度回答する','replay()','outline')}<a href="/milli" class="btn sub" style="text-decoration:none">ミリしらを作る</a><a href="/milli#gallery:${challenge.id}" class="btn gold" style="text-decoration:none">答え合わせ・みんなの回答を見る</a></div><p class="muted">作者が展示会を公開すると答え合わせを見られます。展示されるのは公開に同意した回答のみです。</p>`)}`}
function myAnswerText(){return challenge.spec.characters.map(c=>`【${c.label}】\n`+c.fields.map(f=>f.label+'：'+(response[c.id]?.[f.id]||'（未回答）')).join('\n')).join('\n\n')}
async function copyMyAnswer(){try{await navigator.clipboard.writeText(myAnswerText());alert('自分の回答をコピーしました')}catch(_){prompt('コピーしてください',myAnswerText())}}
function replay(){loadPlay(challenge.id)}
async function loadResults(id,key){mode='results';manageId=id;manageKey=key;root.innerHTML=card('作者用の結果','回答一覧を読み込んでいます…');try{resultData=await postJSON('/api/milli/'+encodeURIComponent(id)+'/manage',{ownerKey:key});renderResults()}catch(e){root.innerHTML=card('作者用の結果を開けませんでした',`<p class="error">${E(e.message)}</p><a href="/milli">ホームに戻る</a>`)}}
function renderResults(){
 if(!resultData)return;
 const spec=resultData.spec,results=resultData.responses;
 root.innerHTML=`<div class="hero"><span class="pill">AUTHOR ONLY / 結果一覧</span><h1>${E(spec.title)}</h1><p>${E(spec.series)} · 回答 ${results.length}件</p></div>
 ${card('回答・展示会の管理',`<p class="notice">このページのURLには作者専用の秘密キーが含まれます。絶対に他人へ送らないでください。</p>
 <p>展示会：<b>${resultData.galleryEnabled?'公開中':'非公開'}</b>。公開すると、公式設定と、掲載に同意した回答者の名前・回答をリンクを知る人が見られます。</p>
 <div class="bar">${btn('回答を更新','refreshResults()')}${btn('JSONで書き出す','exportResults()','sub')}${btn('CSVで書き出す','exportCSV()','outline')}
 ${btn(resultData.galleryEnabled?'展示会を非公開にする':'展示会を公開する','toggleGallery()','gold')}
 <a href="/milli#gallery:${E(manageId)}" class="btn sub" style="text-decoration:none">展示会を見る</a>
 <a href="/milli" class="btn sub" style="text-decoration:none">作成画面</a></div>
 <p class="muted">作者の回答一覧には掲載同意がない回答も表示されます。セットは発行から30日間有効で、無料Renderの再デプロイでデータを失う場合があります。</p>`)}
 ${results.length?card('キャラクター別の答え合わせ・比較',compareAnswers(spec,results)):''}
 ${results.length?results.map((r,i)=>card(`${i+1}. ${E(r.name)} さん`, `<p class="muted">${new Date(r.created*1000).toLocaleString('ja-JP')} ／ 展示会への掲載：${r.showcase?'同意あり':'同意なし'}</p>`+spec.characters.filter(c=>r.answers?.[c.id]).map(c=>`<details class="question"><summary><b>${E(c.label)}</b></summary>${c.image?`<img src="${E(c.image)}" class="smallimg" alt="">`:''}${c.fields.map(f=>`<p><b>${E(f.label)}</b><span style="display:block;white-space:pre-wrap">${E(r.answers?.[c.id]?.[f.id]||'（未回答）')}</span></p>`).join('')}</details>`).join(''))).join(''):card('まだ回答がありません','回答者用の共有リンクを送ってください。')}`
}
function compareAnswers(spec,results){
 return spec.characters.map(c=>`<details class="question"><summary><b>${E(c.label)}</b> ／ 回答者の比較</summary>
 ${c.image?`<img class="smallimg" src="${E(c.image)}" alt="">`:''}
 ${c.truthNote?`<p class="milli-truth"><b>本当の設定：</b>${E(c.truthNote)}</p>`:''}
 ${c.fields.map(f=>`<div class="milli-compare"><b>${E(f.label)}</b>
 ${f.truth?`<p class="milli-truth">公式・正解：${E(f.truth)}</p>`:''}
 ${results.filter(r=>r.answers?.[c.id]).map(r=>`<p><strong>${E(r.name)}：</strong> ${E(r.answers?.[c.id]?.[f.id]||'（未回答）')}</p>`).join('')||'<p class="muted">出題された回答はありません。</p>'}</div>`).join('')}
 </details>`).join('')
}
async function toggleGallery(){
 if(!resultData)return;
 const enabled=!resultData.galleryEnabled;
 if(enabled&&!confirm('展示会を公開しますか？ 公式設定と、掲載に同意した回答者の名前・回答が、展示会URLを知る人に表示されます。'))return;
 try{
  const d=await postJSON('/api/milli/'+encodeURIComponent(manageId)+'/gallery-toggle',{ownerKey:manageKey,enabled});
  resultData.galleryEnabled=d.galleryEnabled;renderResults()
 }catch(e){alert('展示会の公開設定を変更できませんでした：'+e.message)}
}
async function loadGallery(id){
 galleryId=id;mode='gallery';
 root.innerHTML=card('展示会を読み込んでいます','公開された回答を確認します…');
 try{
  const r=await fetch('/api/milli/'+encodeURIComponent(id)+'/gallery',{cache:'no-store'});
  if(!r.ok)throw new Error((await r.text()).slice(0,180));
  galleryData=await r.json();renderGallery()
 }catch(e){
  root.innerHTML=card('展示会はまだ公開されていません',`<p class="muted">${E(e.message)}</p><a href="/milli#play:${E(id)}">回答画面に戻る</a>`)
 }
}
function renderGallery(){
 if(!galleryData)return;
 const spec=galleryData.spec,entries=galleryData.responses;
 root.innerHTML=`<div class="hero"><span class="pill">MILLISHIRA / REVEAL & GALLERY</span><h1>🎭 ミリしら答え合わせ</h1><p>${E(spec.title)} ／ ${E(spec.series)}　公開同意済み：${entries.length}件</p></div>
 ${card('本当の設定とみんなの想像',spec.characters.map(c=>`<details class="question"><summary><b>${E(c.label)}</b></summary>
 ${c.image?`<img class="smallimg" src="${E(c.image)}" alt="">`:''}
 ${c.truthNote?`<p class="milli-truth">${E(c.truthNote)}</p>`:''}
 ${c.fields.map(f=>`<div class="milli-compare"><b>${E(f.label)}</b><p class="milli-truth">本当の答え：${E(f.truth||'（作者の入力なし）')}</p>
 ${entries.filter(r=>r.answers?.[c.id]).map(r=>`<p><strong>${E(r.name)}：</strong> ${E(r.answers?.[c.id]?.[f.id]||'（未回答）')}</p>`).join('')||'<p class="muted">公開された回答はまだありません。</p>'}</div>`).join('')}
 </details>`).join(''))}
 ${card('一番面白かった回答に投票',entries.length?entries.map(r=>`<div class="milli-vote"><b>${E(r.name)} さん</b><span>${r.votes}票</span>${btn('この人に投票',`vote(${r.id})`,'sub')}</div>`).join('')+'<p class="muted">回答済みの人が1セットにつき1票。投票の変更はできますが、自分には投票できません。</p>':'展示への掲載に同意した回答はまだありません。')}
 ${card('共有・戻る',`<div class="bar">${btn('展示会URLをコピー','copyGallery()','sub')}<a class="btn outline" href="/milli">ミリしらのトップへ</a></div>`)}`
}
async function vote(responseId){
 const token=localStorage.getItem('nakami_milli_voter_'+galleryId)||'';
 if(!token)return alert('回答を送信したブラウザから投票してください');
 try{await postJSON('/api/milli/'+encodeURIComponent(galleryId)+'/vote',{voterToken:token,responseId});await loadGallery(galleryId)}
 catch(e){alert('投票できませんでした：'+e.message)}
}
async function copyGallery(){
 const url=location.origin+'/milli#gallery:'+galleryId;
 try{await navigator.clipboard.writeText(url);alert('展示会URLをコピーしました')}
 catch(_){prompt('こちらをコピーしてください',url)}
}
function refreshResults(){loadResults(manageId,manageKey)}
function exportResults(){download('millishira-results.json',JSON.stringify(resultData,null,2),'application/json')}
function exportCSV(){const d=resultData,s=d.spec;const headers=['名前','回答日時',...s.characters.flatMap(c=>c.fields.map(f=>c.label+' / '+f.label))];let rows=d.responses.map(r=>[r.name,new Date(r.created*1000).toISOString(),...s.characters.flatMap(c=>c.fields.map(f=>r.answers?.[c.id]?.[f.id]||''))]);const enc=r=>r.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(',');download('millishira-results.csv','\ufeff'+[headers,...rows].map(enc).join('\r\n'),'text/csv;charset=utf-8')}
function download(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function route(){const h=decodeURIComponent(location.hash.slice(1));if(h.startsWith('play:'))return loadPlay(h.slice(5));if(h.startsWith('gallery:'))return loadGallery(h.slice(8));if(h.startsWith('results:')){const parts=h.split(':');if(parts.length===3)return loadResults(parts[1],parts[2])}home()}
window.addEventListener('hashchange',route);route();
return{home,create,edit,remove,update,changeChar,updateField,updateOptions,addChar,cloneChar,removeChar,addField,removeField,moveField,addLifeField,copyQuestions,moveChar,setURL,removeImage,imageUpload,selectChar,saveCurrent,exportCurrent,openImport,importFile,publish,copyLink,goResults,updateAnswer,setShowcase,prevAnswer,nextAnswer,submit,copyMyAnswer,replay,refreshResults,exportResults,exportCSV,toggleGallery,loadGallery,renderGallery,vote,copyGallery};
})();
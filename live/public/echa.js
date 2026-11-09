'use strict';
/* Nakamikurabe live paint room: no account or database required. */
(()=>{
const WIDTH=3072,HEIGHT=2048;
const $=id=>document.getElementById(id);
let ws=null,code='',myId='',owner=false,ownerKey='',tool='pen',spaceHeld=false;
let strokes=[],pending=new Map(),members=[],messages=[],view={x:0,y:0,zoom:.3},activePointer=null,sendQueue=[],moveTimer=null;
let layers=[{id:'base',name:'レイヤー 1',visible:true,opacity:1}],selectedLayer='base',maxLayers=8,selectNewLayer=false;
const paintScratch=new Map();
const layerPaintCache=new Map();
const main=$('ec-canvas'),overlay=$('ec-active'),ctx=main.getContext('2d',{alpha:true}),octx=overlay.getContext('2d',{alpha:true});
const board=$('ec-board'),workspace=$('ec-workspace');
function normalizeLayers(data){
 if(!Array.isArray(data)||!data.length)return;
 layers=data;
 if(!layers.some(layer=>layer.id===selectedLayer))selectedLayer=layers[layers.length-1].id;
 renderLayers()
}
function renderLayers(){
 $('ec-layer-count').textContent=layers.length+' / '+maxLayers;
 $('ec-layer-add').disabled=layers.length>=maxLayers||!connected();
 $('ec-layer-selected').textContent='選択中：'+(layers.find(l=>l.id===selectedLayer)?.name||'なし');
 $('ec-layers').innerHTML=[...layers].reverse().map((layer,reverseIndex)=>{
  const idx=layers.length-1-reverseIndex;
  return '<div class="ec-layer-row '+(selectedLayer===layer.id?'ec-layer-active':'')+'">'+
  '<div class="ec-layer-main"><button type="button" class="ec-layer-pick" data-layer-do="select" data-layer-id="'+esc(layer.id)+'" aria-pressed="'+(selectedLayer===layer.id)+'">🎨 '+esc(layer.name)+'</button>'+
  '<span class="ec-layer-z">#'+(idx+1)+'</span></div>'+
  '<div class="ec-layer-controls"><button type="button" data-layer-do="visible" data-layer-id="'+esc(layer.id)+'" title="表示切り替え">'+(layer.visible?'👁':'🚫')+'</button>'+
  '<button type="button" data-layer-do="up" data-layer-id="'+esc(layer.id)+'" title="前面へ" '+(idx===layers.length-1?'disabled':'')+'>↑</button>'+
  '<button type="button" data-layer-do="down" data-layer-id="'+esc(layer.id)+'" title="背面へ" '+(idx===0?'disabled':'')+'>↓</button>'+
  (owner&&layers.length>1?'<button type="button" class="ec-layer-delete" data-layer-do="remove" data-layer-id="'+esc(layer.id)+'" title="このレイヤーを削除">✕</button>':'')+'</div>'+
  '<div class="ec-layer-details"><label>名前<input type="text" maxlength="40" data-layer-rename="'+esc(layer.id)+'" value="'+esc(layer.name)+'"></label>'+
  '<label>不透明度 '+Math.round(layer.opacity*100)+'%<input type="range" min="0" max="100" value="'+Math.round(layer.opacity*100)+'" data-layer-opacity="'+esc(layer.id)+'"></label></div></div>'
 }).join('');
}
$('ec-layer-add').addEventListener('click',()=>{
 if(!connected()||layers.length>=maxLayers)return;
 selectNewLayer=true;send({type:'layer_op',op:'add'})
});
$('ec-layers').addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-layer-do]');if(!btn)return;
 const id=btn.dataset.layerId,op=btn.dataset.layerDo;
 if(op==='select'){selectedLayer=id;renderLayers();return}
 if(op==='remove'&&!confirm('このレイヤーと、その中の線をすべて削除しますか？'))return;
 if(op==='visible'){
  const layer=layers.find(x=>x.id===id);
  if(layer)send({type:'layer_op',op:'visible',id,value:!layer.visible});
 }else if(op==='up'||op==='down')send({type:'layer_op',op:'move',id,direction:op==='up'?1:-1});
 else if(op==='remove')send({type:'layer_op',op:'remove',id})
});
$('ec-layers').addEventListener('change',ev=>{
 const el=ev.target;
 if(el.dataset.layerRename){
  const id=el.dataset.layerRename,name=el.value.trim();
  if(!name||name.length>40){alertUI('レイヤー名は1〜40文字にしてください');return}
  send({type:'layer_op',op:'rename',id,name})
 }else if(el.dataset.layerOpacity){
  send({type:'layer_op',op:'opacity',id:el.dataset.layerOpacity,value:Number(el.value)/100})
 }
});

let drawingScheduled=false,lastError='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function alertUI(msg){$('ec-status').textContent=msg;lastError=msg}
function connected(){return ws&&ws.readyState===WebSocket.OPEN}
function send(data){if(connected())ws.send(JSON.stringify(data))}
function storedName(){try{return localStorage.getItem('nk_echa_name')||''}catch(_){return ''}}
$('ec-name').value=storedName();
function currentColor(){return $('ec-color').value}
function currentWidth(){return Number($('ec-width').value)}
function currentOpacity(){return Number($('ec-opacity').value)/100}
function markTool(){
 document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('is-selected',el.dataset.tool===tool));
 workspace.classList.toggle('is-pan',tool==='pan');
 $('ec-bucket-options').hidden=tool!=='bucket'
}
document.querySelectorAll('[data-tool]').forEach(el=>el.addEventListener('click',()=>{tool=el.dataset.tool;markTool()}));
$('ec-width').addEventListener('input',()=>{$('ec-width-text').textContent=currentWidth()});
$('ec-opacity').addEventListener('input',()=>{$('ec-opacity-text').textContent=Math.round(currentOpacity()*100)+'%'});
$('ec-tolerance').addEventListener('input',()=>{$('ec-tolerance-text').textContent=$('ec-tolerance').value});
function roomKey(){return 'nk_echa_owner_'+code}
function roomLink(){return location.origin+'/echa?room='+encodeURIComponent(code)}
async function copyInvite(){
 const url=roomLink();
 try{await navigator.clipboard.writeText(url);alertUI('招待URLをコピーしました')}
 catch(_){prompt('招待URLをコピーしてください',url)}
}
$('ec-copy').addEventListener('click',copyInvite);
$('ec-rejoin').addEventListener('click',()=>{if(code)connectRoom($('ec-name').value.trim()||storedName()||'ゲスト')});
async function createRoom(){
 const name=$('ec-name').value.trim();
 if(!name){$('ec-join-error').textContent='ニックネームを入力してください';return}
 $('ec-join-error').textContent='';
 try{
  const resp=await fetch('/api/echa/create',{method:'POST'});
  if(!resp.ok)throw Error(await resp.text());
  const out=await resp.json();
  code=out.code;ownerKey=out.ownerKey;
  try{sessionStorage.setItem(roomKey(),ownerKey)}catch(_){}
  connectRoom(name);
 }catch(e){$('ec-join-error').textContent='部屋を作れませんでした：'+e.message}
}
function joinRoom(){
 const name=$('ec-name').value.trim(),input=$('ec-code').value.trim().toUpperCase();
 if(!name||!(/^[A-Z2-9]{6}$/.test(input))){$('ec-join-error').textContent='ニックネームと6桁の部屋コードを入力してください';return}
 code=input;
 try{ownerKey=sessionStorage.getItem(roomKey())||''}catch(_){ownerKey=''}
 connectRoom(name)
}
$('ec-create').addEventListener('click',createRoom);
$('ec-join-btn').addEventListener('click',joinRoom);
function connectRoom(name){
 try{localStorage.setItem('nk_echa_name',name)}catch(_){}
 if(ws)ws.close();
 alertUI('接続しています…');
 const proto=location.protocol==='https:'?'wss:':'ws:';
 ws=new WebSocket(proto+'//'+location.host+'/api/echa/ws');
 const socket=ws;
 socket.onopen=()=>{if(ws===socket)send({type:'join',code,name,ownerKey})};
 socket.onmessage=ev=>{if(ws!==socket)return;try{onMessage(JSON.parse(ev.data))}catch(e){console.error('絵チャのデータ読み込みに失敗',e)}};
 socket.onclose=()=>{if(ws!==socket)return;alertUI('接続が切れました。再接続ボタンでキャンバスを同期できます')};
 socket.onerror=()=>{if(ws===socket)alertUI('ネットワークエラーが発生しました')};
}
function onMessage(d){
 if(d.type==='error'){
  alertUI(d.message);
  if($('ec-join').hidden===false)$('ec-join-error').textContent=d.message;
  return
 }
 if(d.type==='snapshot'){
  code=d.code;myId=d.me;owner=d.owner;
  strokes=Array.isArray(d.strokes)?d.strokes:[];resetPaintCache();
  pending=new Map((d.drawing||[]).map(x=>[x.by,x]));
  members=d.members||[];messages=d.messages||[];
  maxLayers=d.maxLayers||8;normalizeLayers(d.layers);
  try{localStorage.setItem('nk_echa_recent_room',code);localStorage.setItem('nk_echa_recent_at',String(Date.now()))}catch(_){}
  $('ec-join').hidden=true;$('ec-room').hidden=false;
  $('ec-room-code').textContent=code;$('ec-clear').hidden=!owner;
  history.replaceState(null,'',location.pathname+'?room='+code);
  redraw();schedulePending();renderChat();renderMembers();fit();
  alertUI('● 接続中');return
 }
 if(d.type==='members'){members=d.members||[];renderMembers();return}
 if(d.type==='chat'){messages.push(d.item);messages=messages.slice(-65);renderChat();return}
 if(d.type==='begin'){pending.set(d.stroke.by,d.stroke);schedulePending();return}
 if(d.type==='points'){const s=pending.get(d.by);if(s){s.points.push(...d.points);schedulePending()}return}
 if(d.type==='end'){
  strokes.push(d.stroke);pending.delete(d.stroke.by);
  redraw();schedulePending();updateCount();return
 }
 if(d.type==='remove'){strokes=strokes.filter(s=>s.id!==d.id);resetPaintCache();redraw();updateCount();return}
 if(d.type==='clear'){strokes=[];pending.clear();resetPaintCache();redraw();schedulePending();updateCount();return}
 if(d.type==='layers'){
   resetPaintCache(); // Rebuild fill boundaries after shared layer order/visibility changes.
  if(d.selected&&selectNewLayer)selectedLayer=d.selected;
  selectNewLayer=false;
  if(d.strokes){strokes=d.strokes;pending=new Map((d.drawing||[]).map(x=>[x.by,x]));resetPaintCache()}
  normalizeLayers(d.layers);redraw();return
 }
 if(d.type==='sync'){strokes=d.strokes||[];pending=new Map((d.drawing||[]).map(x=>[x.by,x]));resetPaintCache();normalizeLayers(d.layers);redraw();schedulePending();updateCount()}
}
function renderMembers(){
 $('ec-members-count').textContent='・'+members.length+'人参加';
 $('ec-members').innerHTML=members.map(m=>'<span class="ec-member"><span class="ec-member-dot" style="background:'+esc(m.color)+'"></span>'+esc(m.name)+(m.owner?' 👑':'')+(m.id===myId?'（あなた）':'')+'</span>').join('')
}
function renderChat(){
 const dst=$('ec-chat-log');dst.innerHTML='';
 for(const item of messages){
  const el=document.createElement('div');el.className='ec-chat-message';
  const header=document.createElement('b');header.textContent=item.name;
  const time=document.createElement('time');time.textContent=new Date(item.ts*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  const text=document.createElement('p');text.textContent=item.text;
  el.append(header,time,text);dst.appendChild(el)
 }
 dst.scrollTop=dst.scrollHeight
}
$('ec-chat-form').addEventListener('submit',ev=>{
 ev.preventDefault();
 const msg=$('ec-chat-text').value.trim();
 if(!msg)return;
 send({type:'chat',text:msg});$('ec-chat-text').value=''
});
function stroke(ctx2,s){
 if(!s.points||!s.points.length)return;
 ctx2.save();
 ctx2.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';
 ctx2.globalAlpha=Number(s.opacity)||1;
 ctx2.lineWidth=s.width||6;
 ctx2.strokeStyle=s.color||'#453557';ctx2.fillStyle=ctx2.strokeStyle;
 ctx2.lineCap='round';ctx2.lineJoin='round';
 ctx2.beginPath();
 ctx2.moveTo(s.points[0][0]*WIDTH,s.points[0][1]*HEIGHT);
 for(let i=1;i<s.points.length;i++)ctx2.lineTo(s.points[i][0]*WIDTH,s.points[i][1]*HEIGHT);
 if(s.points.length===1){
  ctx2.arc(s.points[0][0]*WIDTH,s.points[0][1]*HEIGHT,Math.max(1,s.width/2),0,Math.PI*2);
  ctx2.fill()
 }else ctx2.stroke();
 ctx2.restore()
}
function sceneScratch(w,h){
 const key=w+'x'+h;
 let canvas=paintScratch.get(key);
 if(!canvas){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paintScratch.set(key,canvas)}
 return canvas
}
function resetPaintCache(){layerPaintCache.clear()}
/* Cache finished strokes on each layer individually. Pending pen/eraser input
   is composited onto a temporary copy of that one layer, never on top of the
   whole finished picture. Layer erasers therefore cannot damage other layers.
   Each new stroke is rasterized once at the relevant output resolution. */
function paintBucket(entry,targetCanvas,fill,w,h){
 const layerContext=targetCanvas.getContext('2d');
 const ref=fill.reference==='layer'?targetCanvas:sceneScratch(w,h);
 if(fill.reference!=='layer'){
  const rc=ref.getContext('2d');
  rc.save();rc.setTransform(1,0,0,1,0,0);rc.globalAlpha=1;
  rc.globalCompositeOperation='source-over';
  rc.clearRect(0,0,w,h);
  rc.fillStyle='#ffffff';rc.fillRect(0,0,w,h);
  // Sample the other layers as boundaries but paint ONLY on the chosen layer.
  for(const layer of layers){
   if(!layer.visible||layer.opacity<=0)continue;
   const canvas=entry.images.get(layer.id);
   if(!canvas)continue;
   rc.globalAlpha=layer.opacity;
   rc.drawImage(canvas,0,0)
  }
  rc.restore()
 }
 const referenceImage=ref.getContext('2d').getImageData(0,0,w,h);
 const targetImage=layerContext.getImageData(0,0,w,h);
 const x=Math.max(0,Math.min(w-1,Math.floor(fill.point[0]*w)));
 const y=Math.max(0,Math.min(h-1,Math.floor(fill.point[1]*h)));
 ECFill.fill(referenceImage,targetImage,x,y,fill.color,fill.opacity,fill.tolerance);
 layerContext.putImageData(targetImage,0,0)
}
/* Cache completed strokes per layer, and replay bucket operations in order.
   Boundaries include only drawings that were present before the bucket click. */
function renderedLayers(w,h,count){
 const key=w+'x'+h;
 let entry=layerPaintCache.get(key);
 if(!entry||entry.count>count){
  entry={count:0,images:new Map()};layerPaintCache.set(key,entry)
 }
 for(let i=entry.count;i<count;i++){
  const s=strokes[i],id=s.layer||'base';
  if(!layers.some(x=>x.id===id))continue;
  let c=entry.images.get(id);
  if(!c){c=document.createElement('canvas');c.width=w;c.height=h;entry.images.set(id,c)}
  if(s.tool==='fill'){
   paintBucket(entry,c,s,w,h);
  }else{
   const lc=c.getContext('2d');
   lc.save();lc.setTransform(w/WIDTH,0,0,h/HEIGHT,0,0);
   stroke(lc,s);lc.restore()
  }
 }
 entry.count=count;
 return entry.images
}
function composite(target,count=strokes.length,live=false){
 const w=target.canvas.width,h=target.canvas.height;
 const completed=renderedLayers(w,h,count),drafts=live?[...pending.values()]:[];
 target.save();target.setTransform(1,0,0,1,0,0);
 target.globalAlpha=1;target.globalCompositeOperation='source-over';
 target.clearRect(0,0,w,h);target.fillStyle='#fff';target.fillRect(0,0,w,h);
 for(const layer of layers){
  if(!layer.visible||layer.opacity<=0)continue;
  let c=completed.get(layer.id);
  const active=drafts.filter(s=>(s.layer||'base')===layer.id);
  if(active.length){
   const scratch=sceneScratch(w,h),sc=scratch.getContext('2d');
   sc.save();sc.setTransform(1,0,0,1,0,0);sc.globalCompositeOperation='source-over';sc.globalAlpha=1;sc.clearRect(0,0,w,h);
   if(c)sc.drawImage(c,0,0);
   sc.setTransform(w/WIDTH,0,0,h/HEIGHT,0,0);
   active.forEach(s=>stroke(sc,s));sc.restore();
   c=scratch
  }
  if(c){target.globalAlpha=layer.opacity;target.drawImage(c,0,0)}
 }
 target.restore()
}
function redraw(){composite(ctx,strokes.length,true);updateCount()}
function updateCount(){$('ec-strokes').textContent=strokes.length+'本'}
function schedulePending(){
 if(drawingScheduled)return;drawingScheduled=true;
 requestAnimationFrame(()=>{drawingScheduled=false;redraw()})
}
function transform(){board.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.zoom+')';$('ec-zoom-label').textContent=Math.round(view.zoom*100)+'%'}
function fit(){
 const rect=workspace.getBoundingClientRect();
 view.zoom=Math.max(.09,Math.min(1.15,Math.min((rect.width-28)/WIDTH,(rect.height-28)/HEIGHT)));
 view.x=(rect.width-WIDTH*view.zoom)/2;view.y=(rect.height-HEIGHT*view.zoom)/2;
 transform()
}
function zoomAt(factor,clientX,clientY){
 const box=workspace.getBoundingClientRect();
 const x=(clientX??box.left+box.width/2)-box.left,y=(clientY??box.top+box.height/2)-box.top;
 const next=Math.max(.08,Math.min(3.2,view.zoom*factor));
 const ratio=next/view.zoom;
 view.x=x-(x-view.x)*ratio;view.y=y-(y-view.y)*ratio;view.zoom=next;
 transform()
}
$('ec-fit').addEventListener('click',fit);
$('ec-zoom-in').addEventListener('click',()=>zoomAt(1.3));
$('ec-zoom-out').addEventListener('click',()=>zoomAt(1/1.3));
workspace.addEventListener('wheel',ev=>{ev.preventDefault();zoomAt(ev.deltaY<0?1.12:1/1.12,ev.clientX,ev.clientY)},{passive:false});
window.addEventListener('keydown',ev=>{if(ev.code==='Space'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){spaceHeld=true;ev.preventDefault()}});
window.addEventListener('keyup',ev=>{if(ev.code==='Space')spaceHeld=false});
function coords(ev){
 const rect=overlay.getBoundingClientRect();
 const nx=(ev.clientX-rect.left)/rect.width,ny=(ev.clientY-rect.top)/rect.height;
 if(nx<0||nx>1||ny<0||ny>1)return null;
 return [Math.max(0,Math.min(1,Number(nx.toFixed(5)))),Math.max(0,Math.min(1,Number(ny.toFixed(5))))];
}
function flushPoints(){
 if(moveTimer){clearTimeout(moveTimer);moveTimer=null}
 while(sendQueue.length)send({type:'points',points:sendQueue.splice(0,24)})
}
function bufferPoint(pt){
 const s=pending.get(myId);
 if(!s||s.points.length>=320)return;
 const last=s.points[s.points.length-1];
 if(last&&Math.abs(last[0]-pt[0])+Math.abs(last[1]-pt[1])<.00012)return;
 s.points.push(pt);sendQueue.push(pt);
 schedulePending();
 if(!moveTimer)moveTimer=setTimeout(flushPoints,50)
}
overlay.addEventListener('pointerdown',ev=>{
 if(!connected()||ev.button===2)return;
 const panning=tool==='pan'||spaceHeld||ev.button===1;
 const pt=coords(ev);
 if(!pt&&!panning)return;
 if(!panning&&tool==='bucket'){
  const layer=layers.find(x=>x.id===selectedLayer);
  if(!layer||!layer.visible){alertUI('表示中のレイヤーを選んでください');return}
  send({type:'fill',point:pt,layer:selectedLayer,color:currentColor(),
   opacity:currentOpacity(),tolerance:Number($('ec-tolerance').value),
   reference:$('ec-reference').value});
  alertUI('🪣 塗りつぶしを反映しています…');
  return
 }
 overlay.setPointerCapture(ev.pointerId);
 activePointer={id:ev.pointerId,mode:panning?'pan':'draw',atX:ev.clientX,atY:ev.clientY};
 if(panning)return;
 const layer=layers.find(x=>x.id===selectedLayer);
 if(!layer||!layer.visible){alertUI('描画するには表示中のレイヤーを選んでください');activePointer=null;return}
 const s={by:myId,layer:selectedLayer,color:currentColor(),width:currentWidth(),opacity:currentOpacity(),tool:tool==='eraser'?'eraser':'pen',points:[pt]};
 pending.set(myId,s);schedulePending();send({type:'begin',point:pt,color:s.color,width:s.width,opacity:s.opacity,tool:s.tool,layer:selectedLayer})
});
overlay.addEventListener('pointermove',ev=>{
 if(!activePointer||activePointer.id!==ev.pointerId)return;
 if(activePointer.mode==='pan'){
  view.x+=ev.clientX-activePointer.atX;view.y+=ev.clientY-activePointer.atY;transform();
 }else{
  const pt=coords(ev);if(pt)bufferPoint(pt)
 }
 activePointer.atX=ev.clientX;activePointer.atY=ev.clientY
});
function finishStroke(ev){
 if(!activePointer||activePointer.id!==ev.pointerId)return;
 if(activePointer.mode==='draw'){
  const pt=coords(ev);if(pt)bufferPoint(pt);
  flushPoints();send({type:'end'});
 }
 try{overlay.releasePointerCapture(ev.pointerId)}catch(_){}
 activePointer=null
}
overlay.addEventListener('pointerup',finishStroke);
overlay.addEventListener('pointercancel',finishStroke);
overlay.addEventListener('contextmenu',ev=>ev.preventDefault());
$('ec-undo').addEventListener('click',()=>send({type:'undo'}));
$('ec-clear').addEventListener('click',()=>{if(confirm('全員が描いた作品を本当に消去しますか？タイムラプスの線も消えます。'))send({type:'clear'})});
function download(blob,filename){
 const u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2500)
}
$('ec-export').addEventListener('click',()=>{
 const target=document.createElement('canvas');target.width=WIDTH;target.height=HEIGHT;
 composite(target.getContext('2d'),strokes.length,false);
 target.toBlob(blob=>blob?download(blob,'nakami-echa-'+code+'-full.png'):alertUI('PNG出力に失敗しました'),'image/png')
});
const modal=$('ec-timeline-modal'),tlCanvas=$('ec-timeline-canvas'),tl=tlCanvas.getContext('2d');
let tlPlaying=false,tlFrame=null,tlIndex=0,tlDrawn=0,tlLast=0,tlRate=8,recorder=null,recordChunks=[];
function playbackReset(){
 tlDrawn=-1;composite(tl,0,false);tlDrawn=0
}
function playbackDraw(n){
 const to=Math.max(0,Math.min(strokes.length,Math.floor(n)));
 if(to!==tlDrawn){composite(tl,to,false);tlDrawn=to}
 tlIndex=n;$('ec-timeline-range').value=to;$('ec-timeline-progress').textContent=to+' / '+strokes.length+'本'
}
function stopPlayback(){
 tlPlaying=false;if(tlFrame)cancelAnimationFrame(tlFrame);tlFrame=null;
 $('ec-timeline-play').textContent='▶ 再生'
}
function playbackFrame(now){
 if(!tlPlaying)return;
 const dt=Math.min(.09,(now-tlLast)/1000||0);tlLast=now;
 tlIndex=Math.min(strokes.length,tlIndex+tlRate*Number($('ec-timeline-speed').value)*dt);
 playbackDraw(tlIndex);
 if(tlIndex>=strokes.length){stopPlayback();if(recorder&&recorder.state==='recording')recorder.stop();return}
 tlFrame=requestAnimationFrame(playbackFrame)
}
function play(){
 if(!strokes.length)return alertUI('まず絵を描いてください');
 if(tlPlaying){stopPlayback();if(recorder&&recorder.state==='recording')recorder.stop();return}
 if(tlIndex>=strokes.length){playbackReset();tlIndex=0}
 tlPlaying=true;tlLast=performance.now();tlRate=Math.max(4,strokes.length/40);
 $('ec-timeline-play').textContent='⏸ 一時停止';
 tlFrame=requestAnimationFrame(playbackFrame)
}
function openTimeline(){
 if(!strokes.length)return alertUI('線がまだありません');
 stopPlayback();modal.hidden=false;
 $('ec-timeline-range').max=strokes.length;playbackReset();playbackDraw(0)
}
function closeTimeline(){
 stopPlayback();if(recorder&&recorder.state==='recording')recorder.stop();modal.hidden=true
}
$('ec-timelapse').addEventListener('click',openTimeline);
$('ec-timeline-close').addEventListener('click',closeTimeline);
$('ec-timeline-play').addEventListener('click',play);
$('ec-timeline-range').addEventListener('input',ev=>{stopPlayback();playbackDraw(Number(ev.target.value))});
$('ec-record').addEventListener('click',()=>{
 if(!tlCanvas.captureStream||typeof MediaRecorder==='undefined')return alertUI('このブラウザは動画出力に対応していません');
 if(recorder&&recorder.state==='recording')return;
 const fmt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(v=>MediaRecorder.isTypeSupported(v));
 if(!fmt)return alertUI('このブラウザはWebM動画の保存に対応していません');
 stopPlayback();playbackReset();playbackDraw(0);
 recordChunks=[];
 recorder=new MediaRecorder(tlCanvas.captureStream(30),{mimeType:fmt});
 recorder.ondataavailable=ev=>{if(ev.data.size)recordChunks.push(ev.data)};
 recorder.onstop=()=>{
  if(recordChunks.length)download(new Blob(recordChunks,{type:fmt}),'nakami-echa-'+code+'-timelapse.webm');
  $('ec-record').disabled=false;recorder=null;
 };
 recorder.start(500);$('ec-record').disabled=true;play()
});
window.addEventListener('resize',()=>{if($('ec-room').hidden===false)fit()});
const prefill=new URLSearchParams(location.search).get('room');
if(prefill&&/^[A-Z2-9]{6}$/.test(prefill.toUpperCase())){
 $('ec-code').value=prefill.toUpperCase();
 if(storedName()){
  code=prefill.toUpperCase();
  try{ownerKey=sessionStorage.getItem(roomKey())||''}catch(_){ownerKey=''}
  connectRoom(storedName())
 }
}
markTool()
})();
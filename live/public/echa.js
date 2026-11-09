'use strict';
/* Nakamikurabe live paint room: no account or database required. */
(()=>{
const WIDTH=3072,HEIGHT=2048;
const $=id=>document.getElementById(id);
let ws=null,code='',myId='',owner=false,ownerKey='',tool='pen',spaceHeld=false;
let strokes=[],pending=new Map(),members=[],messages=[],view={x:0,y:0,zoom:.3},activePointer=null,sendQueue=[],moveTimer=null;
const main=$('ec-canvas'),overlay=$('ec-active'),ctx=main.getContext('2d',{alpha:true}),octx=overlay.getContext('2d',{alpha:true});
const board=$('ec-board'),workspace=$('ec-workspace');
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
 workspace.classList.toggle('is-pan',tool==='pan')
}
document.querySelectorAll('[data-tool]').forEach(el=>el.addEventListener('click',()=>{tool=el.dataset.tool;markTool()}));
$('ec-width').addEventListener('input',()=>{$('ec-width-text').textContent=currentWidth()});
$('ec-opacity').addEventListener('input',()=>{$('ec-opacity-text').textContent=Math.round(currentOpacity()*100)+'%'});
function roomKey(){return 'nk_echa_owner_'+code}
function roomLink(){return location.origin+'/echa?room='+encodeURIComponent(code)}
async function copyInvite(){
 const url=roomLink();
 try{await navigator.clipboard.writeText(url);alertUI('招待URLをコピーしました')}
 catch(_){prompt('招待URLをコピーしてください',url)}
}
$('ec-copy').addEventListener('click',copyInvite);
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
 ws.onopen=()=>send({type:'join',code,name,ownerKey});
 ws.onmessage=ev=>{try{onMessage(JSON.parse(ev.data))}catch(e){console.error('絵チャのデータ読み込みに失敗',e)}};
 ws.onclose=()=>alertUI('接続が切れました。再参加すると最新の絵を読み込めます');
 ws.onerror=()=>alertUI('ネットワークエラーが発生しました');
}
function onMessage(d){
 if(d.type==='error'){
  alertUI(d.message);
  if($('ec-join').hidden===false)$('ec-join-error').textContent=d.message;
  return
 }
 if(d.type==='snapshot'){
  code=d.code;myId=d.me;owner=d.owner;
  strokes=Array.isArray(d.strokes)?d.strokes:[];
  pending=new Map((d.drawing||[]).map(x=>[x.by,x]));
  members=d.members||[];messages=d.messages||[];
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
 if(d.type==='remove'){strokes=strokes.filter(s=>s.id!==d.id);redraw();updateCount();return}
 if(d.type==='clear'){strokes=[];pending.clear();redraw();schedulePending();updateCount();return}
 if(d.type==='sync'){strokes=d.strokes||[];pending=new Map((d.drawing||[]).map(x=>[x.by,x]));redraw();schedulePending();updateCount()}
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
function redraw(){
 ctx.clearRect(0,0,WIDTH,HEIGHT);
 for(const s of strokes)stroke(ctx,s);
 updateCount()
}
function updateCount(){$('ec-strokes').textContent=strokes.length+'本'}
function schedulePending(){
 if(drawingScheduled)return;drawingScheduled=true;
 requestAnimationFrame(()=>{
  drawingScheduled=false;octx.clearRect(0,0,WIDTH,HEIGHT);
  for(const s of pending.values())stroke(octx,s)
 })
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
 overlay.setPointerCapture(ev.pointerId);
 activePointer={id:ev.pointerId,mode:panning?'pan':'draw',atX:ev.clientX,atY:ev.clientY};
 if(panning)return;
 const s={by:myId,color:currentColor(),width:currentWidth(),opacity:currentOpacity(),tool:tool==='eraser'?'eraser':'pen',points:[pt]};
 pending.set(myId,s);schedulePending();send({type:'begin',point:pt,color:s.color,width:s.width,opacity:s.opacity,tool:s.tool})
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
 const cx=target.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,WIDTH,HEIGHT);
 // Draw over white *after* compositing: eraser reveals white instead of black.
 const merged=document.createElement('canvas');merged.width=WIDTH;merged.height=HEIGHT;
 const mx=merged.getContext('2d');for(const s of strokes)stroke(mx,s);
 cx.drawImage(merged,0,0);
 target.toBlob(blob=>blob?download(blob,'nakami-echa-'+code+'-full.png'):alertUI('PNG出力に失敗しました'),'image/png')
});
const modal=$('ec-timeline-modal'),tlCanvas=$('ec-timeline-canvas'),tl=tlCanvas.getContext('2d');
let tlPlaying=false,tlFrame=null,tlIndex=0,tlDrawn=0,tlLast=0,tlRate=8,recorder=null,recordChunks=[];
function playbackReset(){
 tl.setTransform(1,0,0,1,0,0);
 tl.clearRect(0,0,960,640);tl.fillStyle='#fff';tl.fillRect(0,0,960,640);
 tl.setTransform(960/WIDTH,0,0,640/HEIGHT,0,0);tlDrawn=0
}
function playbackDraw(n){
 const to=Math.max(0,Math.min(strokes.length,Math.floor(n)));
 if(to<tlDrawn)playbackReset();
 while(tlDrawn<to){stroke(tl,strokes[tlDrawn]);tlDrawn++}
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
 if(tlPlaying){stopPlayback();return}
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
if(prefill&&/^[A-Z2-9]{6}$/.test(prefill.toUpperCase()))$('ec-code').value=prefill.toUpperCase();
markTool()
})();
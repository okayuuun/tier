'use strict';
/* Nakamikurabe live paint room: no account or database required. */
(()=>{
const WIDTH=3072,HEIGHT=2048;
const $=id=>document.getElementById(id);
let ws=null,code='',myId='',owner=false,ownerKey='',tool='pen',spaceHeld=false;
let reconnectAttempt=0,reconnectTimer=null,pingTimer=null,handshakeTimer=null,lastPongAt=0,lastPacketAt=0,retryWanted=true,lastConnected=false,activeName='';
let handedOffToOtherTab=false;
const MAX_RECONNECTS=12;
const MAX_SILENCE_MS=150000; // Avoid restart loops during a large art sync.
let strokes=[],pending=new Map(),members=[],messages=[],view={x:0,y:0,zoom:.3},activePointer=null,sendQueue=[],moveTimer=null;
let localStrokeSerial=0;
const waitingLocal=new Map(); // Sent marks awaiting acknowledgement.
let layers=[{id:'base',name:'レイヤー 1',visible:true,opacity:1}],selectedLayer='base',maxLayers=8,selectNewLayer=false;
let drawProblem='';
let preserveLocalArt=false,drawnRoomCode=''; // Keep old ink only for its exact room.
const paintScratch=new Map();
const layerPaintCache=new Map();
// Full quality is the DEFAULT. The previous forced 50% live resolution
// blurred existing artwork even though the saved strokes were still intact.
// People can opt into a lighter preview if their device needs less memory.
const RENDER_SCALES={high:1,balanced:.75,light:.5};
let renderQuality='high';
const main=$('ec-canvas'),overlay=$('ec-active');
const ctx=main.getContext('2d',{alpha:true}),octx=overlay.getContext('2d',{alpha:true});
const board=$('ec-board'),workspace=$('ec-workspace');
// Browsers can discard 2D canvas contexts under memory pressure. A restored
// backing store starts blank, so rebuild it from saved stroke history instead
// of requiring a page reload (which may also lose local, unconfirmed marks).
for(const canvas of [main,overlay]){
 canvas.addEventListener('contextlost',ev=>{
  ev.preventDefault();
  alertUI('⚠️ 描画用メモリを一時的に解放しました。画面を復元しています…');
 });
 canvas.addEventListener('contextrestored',()=>{
  resetPaintCache();
  redraw();
  alertUI('✅ キャンバスを復元しました');
 });
}
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
function networkHelp(state){
 const target=$('ec-connection-help');
 if(!target)return;
 target.hidden=state==='ok';
 if(state==='ok')return;
 target.textContent=state==='offline'
  ?'📶 インターネットに接続されていません。Wi-Fi／モバイル通信を確認してください。描画の送信は再接続後に行ってください。'
  :state==='lost'
  ?'⚠️ この部屋は保存期限切れか削除済みの可能性があります。画面に絵が残っていれば、先にPNG保存してください。'
  :state==='other-tab'
  ?'🔁 別のタブがこの描き手として接続しました。こちらで再開する場合だけ「↻ 再接続」を押してください。'
  :reconnectAttempt>=3
  ?'⚠️ 接続に時間がかかっています。通信状態を確認し、「↻ 再接続」を押してください。画面に絵が残っている場合はPNG保存もできます。'
  :'🔄 サーバーへの接続を回復しています。画面を閉じずにお待ちください。復帰までは新しい線を送信できません。';
}
function connected(){return !preserveLocalArt&&ws&&ws.readyState===WebSocket.OPEN}
function send(data){if(!connected())return false;try{ws.send(JSON.stringify(data));return true}catch(_){return false}}
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
let cloudSaveInFlight=false;
$('ec-save-cloud').addEventListener('click',()=>{
 if(cloudSaveInFlight)return;
 if(!connected()){
  $('ec-save-result').textContent='⚠️ 未接続のため保存確認できません。再接続後にお試しください。';return
 }
 cloudSaveInFlight=true;
 $('ec-save-cloud').disabled=true;
 $('ec-save-result').textContent='☁️ クラウドへの書き込み完了を確認しています…';
 send({type:'save_now'});
});
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
function resumeKey(){return 'nk_echa_resume_'+code}
function stopNetworkTimers(){
 clearTimeout(reconnectTimer);clearInterval(pingTimer);clearTimeout(handshakeTimer);
 reconnectTimer=null;pingTimer=null;handshakeTimer=null
}
function scheduleReconnect(){
 if(!retryWanted||!code)return;
 if(reconnectAttempt>=MAX_RECONNECTS){
  alertUI('再接続が続けて失敗しました。「↻ 再接続」を押すか、ブラウザを再読み込みしてください。');
  networkHelp('retry');
  return
 }
 const delay=Math.min(20000,1200*Math.pow(2,Math.min(reconnectAttempt,4)))+
   Math.floor(Math.random()*350);
 reconnectAttempt++;
 alertUI('通信が切断されました。'+Math.ceil(delay/1000)+'秒後に再接続（'+reconnectAttempt+'/'+MAX_RECONNECTS+'）');
 networkHelp(navigator.onLine===false?'offline':'retry');
 clearTimeout(reconnectTimer);
 reconnectTimer=setTimeout(()=>connectRoom(activeName||storedName()||'ゲスト',true),delay)
}
function connectRoom(name,isRetry=false){
 activeName=name;
 if(!isRetry){reconnectAttempt=0;retryWanted=true;handedOffToOtherTab=false}
 stopNetworkTimers();
 try{localStorage.setItem('nk_echa_name',name)}catch(_){}
 if(ws){
  // Detach handlers BEFORE intentional replacement: its close must not
  // accidentally initiate another reconnect or overwrite the new status.
  ws.onclose=null;ws.onerror=null;ws.onmessage=null;
  try{ws.close()}catch(_){}
 }
 alertUI(isRetry?'再接続しています…':'接続しています…');
 networkHelp(navigator.onLine===false?'offline':'retry');
 const proto=location.protocol==='https:'?'wss:':'ws:';
 const socket=new WebSocket(proto+'//'+location.host+'/api/echa/ws');
 ws=socket;
 function arm(ms){
  clearTimeout(handshakeTimer);
  handshakeTimer=setTimeout(()=>{
   if(ws===socket&&socket.readyState!==WebSocket.CLOSED){
    alertUI('サーバーの応答が遅いため接続をやり直します…');
    try{socket.close()}catch(_){}
   }
  },ms)
 }
 arm(100000);
 socket.onopen=()=>{
  if(ws!==socket)return;
  arm(65000); // Large rooms can take longer to restore and transfer.
  let resumeToken='';
  try{resumeToken=sessionStorage.getItem(resumeKey())||''}catch(_){}
  socket.send(JSON.stringify({type:'join',code,name,ownerKey,resumeToken}))
 };
 socket.onmessage=ev=>{
  if(ws!==socket)return;
  // A valid server packet proves that the connection is alive even if a
  // separate pong is delayed by a large room snapshot or a slow renderer.
  lastPacketAt=Date.now();
  try{onMessage(JSON.parse(ev.data))}
  catch(e){
   console.error('絵チャのデータ読み込みに失敗',e);
   alertUI('描画の読み込みに失敗しました。再接続して復旧を試みます');
   try{socket.close(1011,'art render error')}catch(_){}
  }
 };
 socket.onclose=ev=>{
  if(ws!==socket)return;
  clearTimeout(handshakeTimer);handshakeTimer=null;
  clearInterval(pingTimer);pingTimer=null;
  // A disconnected socket cannot deliver its outstanding ACKs.
  if(waitingLocal.size){waitingLocal.clear();schedulePending()}
  if(activePointer?.mode==='draw'||pending.has(myId)){
   discardPendingStroke();
   drawProblem='⚠️ 通信が切れたため未確定の線を取り消しました。接続回復後に描き直してください。';
   $('ec-draw-warning').hidden=false;
   $('ec-draw-warning').textContent=drawProblem;
  }
  if(cloudSaveInFlight){
   cloudSaveInFlight=false;
   $('ec-save-cloud').disabled=false;
   $('ec-save-result').textContent='⚠️ 保存確認中に通信が切れました。再接続後にもう一度お試しください。';
  }
  try{sessionStorage.setItem('nk_echa_last_disconnect',
   new Date().toLocaleString('ja-JP')+' / code '+ev.code)}catch(_){}
  if(ev.code===1000&&ev.reason==='replaced'){
   handedOffToOtherTab=true;
   retryWanted=false;stopNetworkTimers();
   alertUI('別のタブでこの描き手が接続しました');
   networkHelp('other-tab');
   return;
  }
  scheduleReconnect()
 };
 socket.onerror=()=>{
  if(ws===socket)alertUI('通信エラーが発生しました。接続を回復しています…')
 }
}
window.addEventListener('pagehide',()=>{retryWanted=false;stopNetworkTimers()});
window.addEventListener('pageshow',ev=>{
 // Safari may restore a tab without reloading its JavaScript.
 if(!ev.persisted||!code||handedOffToOtherTab)return;
 retryWanted=true;
 connectRoom(activeName||storedName()||'ゲスト',true)
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible'||!code||!retryWanted||handedOffToOtherTab)return;
 if(!ws||ws.readyState===WebSocket.CLOSED||
    (ws.readyState===WebSocket.OPEN&&Date.now()-Math.max(lastPongAt,lastPacketAt)>MAX_SILENCE_MS)){
  connectRoom(activeName||storedName()||'ゲスト',true)
 }
});
window.addEventListener('offline',()=>{if(code)networkHelp('offline')});
window.addEventListener('online',()=>{
 if(ws&&ws.readyState===WebSocket.OPEN)return;
 if(retryWanted&&!handedOffToOtherTab&&code){stopNetworkTimers();connectRoom(activeName||storedName()||'ゲスト',true)}
});
function onMessage(d){
 if(d.type==='save_status'){
  cloudSaveInFlight=false;
  $('ec-save-cloud').disabled=false;
  const clock=d.ok&&Number.isFinite(d.at)
   ?new Date(d.at*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
  $('ec-save-result').textContent=d.ok
   ?'✅ '+clock+' にクラウドへの保存完了を確認しました。'
   :'⚠️ '+(d.message||'クラウドへの保存を確認できませんでした。');
  return;
 }
 if(d.type==='error'){
  if(['begin','points','end'].includes(d.action)){
   // The server rejected the stroke. Remove the local-only preview so
   // the next line never appears to erase the previous line.
   discardPendingStroke();
   if(connected()){
    // A rejected points/end may leave an unfinished server draft.
    if(d.action!=='begin')send({type:'cancel'});
    send({type:'sync'});
   }
   drawProblem='⚠️ 描画を保存できませんでした：'+(d.message||'接続状況をご確認ください。');
   $('ec-draw-warning').hidden=false;
   $('ec-draw-warning').textContent=drawProblem;
  }
  alertUI(d.message);
  // An identity-history limit is NOT an expired room. Only mark a
  // room lost when the server explicitly reports a missing room.
  if(/部屋が見つかりません|再起動で消えた/.test(d.message)){
   // A free Render service may restart and discard an in-memory room.
   // Stop futile retries; old local artwork can still be saved as PNG.
   retryWanted=false;stopNetworkTimers();networkHelp('lost');
   if(ws){ws.onclose=null;try{ws.close()}catch(_){}}
   const text='前の絵チャの部屋を復元できませんでした。'+d.message+' 作品の保存状態を確認してから、新しい部屋を作成してください。';
   $('ec-join-error').textContent=text;
   if(lastConnected){
    $('ec-recovery').hidden=false;
    $('ec-recovery-text').textContent=text+' 現在表示中の絵はPNGで保存できます。';
   }else{$('ec-join').hidden=false;$('ec-room').hidden=true}
   return
  }
  if($('ec-join').hidden===false)$('ec-join-error').textContent=d.message;
  return
 }
 if(d.type==='pong'){lastPongAt=Date.now();return}
 if(d.type==='server_restart'){
  alertUI('サーバーの入れ替え中です。再接続を待っています…');return
 }
 if(d.type==='snapshot'){
  // If a restarted/failed server unexpectedly returns a new EMPTY canvas,
  // protect the artwork already visible in this tab. Do not send edits or
  // cloud-save the empty room over the lost drawing: offer PNG export instead.
  const unsafeBlank=lastConnected&&drawnRoomCode===d.code&&strokes.length>0&&
    Array.isArray(d.strokes)&&d.strokes.length===0&&Number(d.version)===0;
  preserveLocalArt=unsafeBlank;
  drawnRoomCode=d.code;
  code=d.code;myId=d.me;owner=d.owner;
  if(cloudSaveInFlight){
   $('ec-save-result').textContent='⚠️ 保存確認中に再接続しました。もう一度保存を確認してください。';
  }
  cloudSaveInFlight=false;
  $('ec-save-cloud').disabled=false;
  $('ec-save-cloud').hidden=d.persistence==='memory';
  const restoring=lastConnected;
  retryWanted=true;lastConnected=true;reconnectAttempt=0;stopNetworkTimers();
  lastPongAt=Date.now();lastPacketAt=Date.now();
  if(typeof d.resumeToken==='string'){
   try{sessionStorage.setItem(resumeKey(),d.resumeToken)}catch(_){}
  }
  $('ec-recovery').hidden=true;
  networkHelp('ok');
  const restored=$('ec-restored-note');
  restored.hidden=!d.restoredAt;
  restored.textContent=d.restoredAt?
   '✅ サーバー再起動後、保存済みのキャンバスを復元しました。直前の一部の線は保存されていない可能性があります。':'';
  const hours=Number(d.retentionHours)||0;
  $('ec-save-hint').textContent=d.persistence==='postgres'?
   '☁️ このキャンバスは最終操作から約'+(hours>=24?Math.round(hours/24)+'日':hours+'時間')+'、復元できる状態で保存されます。':
   d.persistence==='degraded'?
   '⚠️ 保存先に接続できません。大切な絵をPNG保存してください。':
   'ℹ️ 現在は一時保存です。大切な絵はPNG保存してください。';
  const current=ws;
  pingTimer=setInterval(()=>{
   if(ws!==current||current.readyState!==WebSocket.OPEN)return;
   if(Date.now()-Math.max(lastPongAt,lastPacketAt)>MAX_SILENCE_MS&&document.visibilityState!=='hidden'){
    alertUI('通信の応答がないため再接続します…');
    try{current.close(4000,'heartbeat timeout')}catch(_){}
    return
   }
   try{current.send(JSON.stringify({type:'ping'}))}catch(_){}
  },20000);
  waitingLocal.clear();
  if(!unsafeBlank){
   strokes=Array.isArray(d.strokes)?d.strokes:[];resetPaintCache();
  }
  pending=unsafeBlank?new Map():new Map((d.drawing||[]).map(x=>[x.by,x]));
  members=d.members||[];messages=d.messages||[];
  maxLayers=d.maxLayers||8;
  drawProblem=unsafeBlank
   ?'⚠️ サーバーから空のキャンバスが届きました。元の絵をこの画面に保持しています。再読み込みせず、先に「PNG保存」で作品を保存してください。'
   :'';
  normalizeLayers(d.layers);
  try{localStorage.setItem('nk_echa_recent_room',code);localStorage.setItem('nk_echa_recent_at',String(Date.now()))}catch(_){}
  $('ec-join').hidden=true;$('ec-room').hidden=false;
  $('ec-room-code').textContent=code;$('ec-clear').hidden=!owner;
  history.replaceState(null,'',location.pathname+'?room='+code);
  if(unsafeBlank){
   $('ec-save-cloud').disabled=true;
   $('ec-save-result').textContent='⚠️ サーバー側は空の状態です。クラウドへの上書きを止めています。まずPNG保存してください。';
   $('ec-recovery').hidden=false;
   $('ec-recovery-text').textContent=drawProblem;
   $('ec-draw-warning').hidden=false;
   $('ec-draw-warning').textContent=drawProblem;
  }else{
   redraw();schedulePending();
  }
  renderChat();renderMembers();
  if(!restoring)fit();else transform();
  alertUI(unsafeBlank?'⚠️ 絵を保護しています。PNG保存してください。':'● 接続中');return
 }
 if(d.type==='members'){members=d.members||[];renderMembers();return}
 if(d.type==='chat'){messages.push(d.item);messages=messages.slice(-65);renderChat();return}
 if(d.type==='begin'){pending.set(d.stroke.by,d.stroke);schedulePending();return}
 if(d.type==='points'){const s=pending.get(d.by);if(s){s.points.push(...d.points);schedulePending()}return}
 if(d.type==='cancel'){
  const draft=pending.get(d.by);
  if(d.by!==myId||!draft||d.clientSerial==null||
     draft.clientSerial===d.clientSerial)pending.delete(d.by);
  if(d.by===myId&&d.clientSerial!=null)waitingLocal.delete(d.clientSerial);
  schedulePending();return
 }
 if(d.type==='end'){
  strokes.push(d.stroke);
  if(d.stroke.by===myId){
   const serial=d.stroke.clientSerial;
   if(serial!=null)waitingLocal.delete(serial);
   // The old line's ACK cannot clear a newer local line.
   const active=pending.get(myId);
   if(!active||serial==null||active.clientSerial===serial)pending.delete(myId);
   drawProblem=''
  }else pending.delete(d.stroke.by);
  redraw();return
 }
 if(d.type==='remove'){strokes=strokes.filter(s=>s.id!==d.id);resetPaintCache();redraw();updateCount();return}
 if(d.type==='clear'){strokes=[];pending.clear();waitingLocal.clear();resetPaintCache();redraw();schedulePending();updateCount();return}
 if(d.type==='layers'){
   resetPaintCache(); // Rebuild fill boundaries after shared layer order/visibility changes.
  if(d.selected&&selectNewLayer)selectedLayer=d.selected;
  selectNewLayer=false;
  if(d.strokes){strokes=d.strokes;pending=new Map((d.drawing||[]).map(x=>[x.by,x]));waitingLocal.clear();resetPaintCache()}
  normalizeLayers(d.layers);redraw();return
 }
 if(d.type==='sync'){strokes=d.strokes||[];pending=new Map((d.drawing||[]).map(x=>[x.by,x]));waitingLocal.clear();resetPaintCache();normalizeLayers(d.layers);redraw();schedulePending();updateCount()}
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
function releasePaintCache(key){
 const entry=layerPaintCache.get(key);
 if(entry){
  for(const canvas of entry.images.values()){canvas.width=0;canvas.height=0}
  layerPaintCache.delete(key)
 }
 const scratch=paintScratch.get(key);
 if(scratch){scratch.width=0;scratch.height=0;paintScratch.delete(key)}
}
function resetPaintCache(){
 for(const key of [...layerPaintCache.keys()])releasePaintCache(key);
 for(const key of [...paintScratch.keys()])releasePaintCache(key)
}
// Switching changes only temporary display buffers. The original stroke
// coordinates, cloud history and 3072x2048 PNG export are never resampled.
function setRenderQuality(next){
 const scale=RENDER_SCALES[next];
 if(!scale)return false;
 if(renderQuality===next)return true;
 resetPaintCache();
 for(const canvas of [main,overlay]){
  canvas.width=Math.round(WIDTH*scale);
  canvas.height=Math.round(HEIGHT*scale)
 }
 renderQuality=next;
 redraw();
 return true
}
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
 const completed=renderedLayers(w,h,count),drafts=live?[...waitingLocal.values(),...pending.values()]:[];
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
/* Paint in-progress pen strokes onto the already-present transparent input
   canvas. The expensive full-size layer composite only runs when an operation
   commits, not on every pointer movement. Erasers or multiple visible layers
   retain accurate layer-by-layer compositing while drawing. */
let previewOnMain=false;
function paintPending(){
 const drafts=[...waitingLocal.values(),...pending.values()];
 const visible=layers.filter(layer=>layer.visible&&layer.opacity>0);
 const needsLayerComposite=drafts.length>0 &&
   (visible.length!==1||drafts.some(s=>s.tool==='eraser'));
 octx.save();
 octx.setTransform(1,0,0,1,0,0);
 octx.clearRect(0,0,overlay.width,overlay.height);
 octx.restore();
 if(needsLayerComposite){
  composite(ctx,strokes.length,true);
  previewOnMain=true;
  return;
 }
 if(previewOnMain){
  // The last eraser/pending multi-layer stroke was cancelled or completed.
  // Restore the committed picture before clearing the temporary preview.
  composite(ctx,strokes.length,false);
  previewOnMain=false;
 }
 if(!drafts.length)return;
 octx.save();
 // Brush geometry uses full logical coordinates; scale only preview pixels.
 octx.setTransform(overlay.width/WIDTH,0,0,overlay.height/HEIGHT,0,0);
 const layer=visible[0];
 for(const s of drafts){
  if((s.layer||'base')!==layer.id)continue;
  octx.save();
  // stroke() assigns globalAlpha itself, so bake the layer opacity into
  // this preview-only copy rather than mutating the real stroke.
  stroke(octx,{...s,opacity:(Number(s.opacity)||1)*layer.opacity});
  octx.restore();
 }
 octx.restore()
}
function redraw(){
 composite(ctx,strokes.length,false);
 previewOnMain=false;
 paintPending();
 updateCount()
}
function updateCount(){
 const count=strokes.length;
 // There is no fixed stroke count quota. Keep this a plain count, not x / limit.
 $('ec-strokes').textContent=count+'本（本数制限なし）';
 const note=$('ec-draw-warning');
 if(!note)return;
 note.hidden=!drawProblem;
 note.textContent=drawProblem||'';
}
let lastDraftFrame=0;
function schedulePending(){
 if(drawingScheduled)return;
 drawingScheduled=true;
 requestAnimationFrame(function frame(now){
  // 30fps is ample for pen previews while reducing large-canvas work.
  if(Number.isFinite(now)&&lastDraftFrame&&now-lastDraftFrame<32){
   requestAnimationFrame(frame);
   return;
  }
  lastDraftFrame=Number.isFinite(now)?now:0;
  drawingScheduled=false;
  paintPending()
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
const renderQualityControl=$('ec-render-quality');
renderQualityControl.addEventListener('change',()=>{
 if(activePointer?.mode==='draw'||pending.has(myId)||waitingLocal.size){
  renderQualityControl.value=renderQuality;
  alertUI('線を描き終えてから表示画質を変更してください。');
  return
 }
 const mode=renderQualityControl.value;
 if(!setRenderQuality(mode))return;
 try{localStorage.setItem('nk_echa_render_quality',mode)}catch(_){}
 alertUI(mode==='high'
  ?'✅ 高画質表示に戻しました。保存済みの線もそのままです。'
  :'ℹ️ 表示だけを軽量化しました。保存データやPNGの画質は変わりません。')
});
let preferredQuality='high';
try{preferredQuality=localStorage.getItem('nk_echa_render_quality')||'high'}catch(_){}
if(RENDER_SCALES[preferredQuality]){
 renderQualityControl.value=preferredQuality;
 setRenderQuality(preferredQuality)
}

workspace.addEventListener('wheel',ev=>{ev.preventDefault();zoomAt(ev.deltaY<0?1.12:1/1.12,ev.clientX,ev.clientY)},{passive:false});
/* On mobile, two touch pointers pan/zoom the whole board. A pinch discards
   the current brush stroke so there are no unwanted marks on the canvas. */
const touchPoints=new Map();
const twoFingerUndoToggle=$('ec-two-finger-undo');
let pinch=null,pinchUsed=false;
let firstTouchAt=0,twoFingerTap=false,touchMoved=false,hadTwoFingers=false;
function pinchInfo(){
 const [a,b]=[...touchPoints.values()];
 if(!a||!b)return null;
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,
  distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}
}
workspace.addEventListener('pointerdown',ev=>{
 if(ev.pointerType!=='touch')return;
 if(touchPoints.size===0){
  firstTouchAt=Date.now();twoFingerTap=false;touchMoved=false;hadTwoFingers=false
 }
 touchPoints.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,
                              startX:ev.clientX,startY:ev.clientY});
 if(touchPoints.size>2)twoFingerTap=false;
 if(touchPoints.size===2){
  hadTwoFingers=true;
  // A quick, stationary two-finger tap undoes one completed operation.
  // Moving fingers, a third finger or holding too long cannot trigger undo.
  twoFingerTap=!touchMoved&&Date.now()-firstTouchAt<=260;
  if(activePointer?.mode==='draw'){
   if(moveTimer){clearTimeout(moveTimer);moveTimer=null}
   sendQueue.length=0;
   pending.delete(myId);
   send({type:'cancel'});
   schedulePending()
  }
  activePointer=null;pinchUsed=true;
  const pos=pinchInfo(),rect=workspace.getBoundingClientRect();
  pinch={distance:pos.distance,zoom:view.zoom,
    anchorX:(pos.x-rect.left-view.x)/view.zoom,
    anchorY:(pos.y-rect.top-view.y)/view.zoom};
  try{workspace.setPointerCapture(ev.pointerId)}catch(_){}
  ev.preventDefault()
 }
},true);
workspace.addEventListener('pointermove',ev=>{
 if(ev.pointerType!=='touch'||!touchPoints.has(ev.pointerId))return;
 const point=touchPoints.get(ev.pointerId);
 if(Math.hypot(ev.clientX-point.startX,ev.clientY-point.startY)>12){
  touchMoved=true;twoFingerTap=false
 }
 point.x=ev.clientX;point.y=ev.clientY;
 if(pinch&&touchPoints.size>=2){
  const pos=pinchInfo(),rect=workspace.getBoundingClientRect();
  view.zoom=Math.max(.08,Math.min(3.2,pinch.zoom*pos.distance/pinch.distance));
  view.x=pos.x-rect.left-pinch.anchorX*view.zoom;
  view.y=pos.y-rect.top-pinch.anchorY*view.zoom;
  transform();ev.preventDefault()
 }
},true);
function liftTouch(ev){
 if(ev.pointerType!=='touch')return;
 if(ev.type==='pointercancel')twoFingerTap=false;
 touchPoints.delete(ev.pointerId);
 if(touchPoints.size<2)pinch=null;
 if(touchPoints.size===0){
  // Gesture undo is opt-in: incidental extra fingertips/palm contact
  // must not silently delete a finished stroke while someone is drawing.
  const undoTap=twoFingerUndoToggle?.checked&&hadTwoFingers&&twoFingerTap&&!touchMoved&&
                Date.now()-firstTouchAt<=430;
  pinchUsed=false;twoFingerTap=false;hadTwoFingers=false;
  if(undoTap&&connected()){
   send({type:'undo'});
   alertUI('↶ 2本指タップ：1手戻す操作を送信しました')
  }
 }
}
workspace.addEventListener('pointerup',liftTouch,true);
workspace.addEventListener('pointercancel',liftTouch,true);
for(const type of ['selectstart','dblclick','dragstart']){
 workspace.addEventListener(type,ev=>ev.preventDefault())
}

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
 while(sendQueue.length){
  if(!send({type:'points',points:sendQueue.splice(0,24)})){
   discardPendingStroke();
   alertUI('通信が切れたため線を保存できませんでした。再接続してから描いてください。');
   return false
  }
 }
 return true
}
function discardPendingStroke(){
 if(moveTimer){clearTimeout(moveTimer);moveTimer=null}
 sendQueue.length=0;
 pending.delete(myId);
 if(activePointer?.mode==='draw'){
  try{overlay.releasePointerCapture(activePointer.id)}catch(_){}
  activePointer=null
 }
 schedulePending()
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
 if(!connected()||ev.button===2||(ev.pointerType==='touch'&&pinchUsed))return;
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
 const s={by:myId,clientSerial:++localStrokeSerial,layer:selectedLayer,color:currentColor(),width:currentWidth(),opacity:currentOpacity(),tool:tool==='eraser'?'eraser':'pen',points:[pt]};
 pending.set(myId,s);schedulePending();
 if(!send({type:'begin',clientSerial:s.clientSerial,point:pt,color:s.color,width:s.width,opacity:s.opacity,tool:s.tool,layer:selectedLayer})){
  discardPendingStroke();alertUI('未接続のため描画を保存できません。↻ 再接続をお試しください。')
 }
});
overlay.addEventListener('pointermove',ev=>{
 if(ev.pointerType==='touch'&&pinchUsed)return;
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
  if(ev.type==='pointercancel'){
   // A cancelled pointer (e.g. Safari gesture) must not commit a mark.
   if(moveTimer){clearTimeout(moveTimer);moveTimer=null}
   sendQueue.length=0;pending.delete(myId);
   send({type:'cancel'});schedulePending();
  }else{
   const pt=coords(ev);if(pt)bufferPoint(pt);
   if(!flushPoints())return;
   if(!send({type:'end'})){
    discardPendingStroke();
    alertUI('通信が切れたため線を保存できませんでした。再接続してから描いてください。')
   }else{
    // Keep the preview until this exact stroke is acknowledged.
    const draft=pending.get(myId);
    if(draft?.clientSerial!=null){
     waitingLocal.set(draft.clientSerial,draft);
     pending.delete(myId);
    }
   }
  }
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
 const key=WIDTH+'x'+HEIGHT;
 function cleanup(){releasePaintCache(key);target.width=0;target.height=0}
 try{
  composite(target.getContext('2d'),strokes.length,false);
  target.toBlob(blob=>{
   cleanup();
   if(blob)download(blob,'nakami-echa-'+code+'-full.png');
   else alertUI('PNG出力に失敗しました。端末の空きメモリをご確認ください。')
  },'image/png')
 }catch(err){
  console.error('PNG export failed',err);cleanup();
  alertUI('PNG出力に必要なメモリが足りません。ほかのタブを閉じて再度お試しください。')
 }
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
 stopPlayback();if(recorder&&recorder.state==='recording')recorder.stop();modal.hidden=true;
 releasePaintCache(tlCanvas.width+'x'+tlCanvas.height)
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
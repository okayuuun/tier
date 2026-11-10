/* Recent game rooms. Stored locally, used only after explicit "continue". */
(function(root){
 'use strict';
 const KEY='nk_recent_game_sessions_v1';
 const LIMIT=4, MAX_AGE=14*24*60*60*1000;
 const CODE=/^[A-Z2-9]{6}$/, SID=/^[a-zA-Z0-9_-]{12,90}$/;
 function clean(raw,now){
  if(!Array.isArray(raw))return [];
  const seen=new Set(),out=[];
  for(const x of raw){
   if(!x||typeof x!=='object')continue;
   const code=String(x.code||'').toUpperCase();
   if(!CODE.test(code)||!SID.test(x.sid)||typeof x.name!=='string'||!x.name.trim()||
      !Number.isFinite(x.expiresAt)||x.expiresAt<=now||
      x.expiresAt>now+MAX_AGE||seen.has(code))continue;
   seen.add(code);
   out.push({code,sid:x.sid,name:x.name.slice(0,24),
     game:String(x.game||'').slice(0,40),title:String(x.title||'ゲーム').slice(0,100),
     expiresAt:x.expiresAt,updatedAt:Number(x.updatedAt)||now});
   if(out.length>=LIMIT)break;
  }
  return out.sort((a,b)=>b.updatedAt-a.updatedAt);
 }
 function list(){
  try{return clean(JSON.parse(localStorage.getItem(KEY)||'[]'),Date.now())}
  catch(_){return []}
 }
 function write(a){
  try{localStorage.setItem(KEY,JSON.stringify(a));return true}
  catch(_){return false}
 }
 function remember(value){
  const now=Date.now();
  const code=String(value?.code||'').toUpperCase();
  if(!CODE.test(code)||!SID.test(value?.sid)||!String(value?.name||'').trim())return false;
  const past=list(),previous=past.find(x=>x.code===code);
  const game=String(value.game||'').slice(0,40);
  const title=String(value.title||'ゲーム').slice(0,100);
  const name=String(value.name).slice(0,24);
  const hours=Math.min(336,Math.max(1,Number(value.retentionHours)||72));
  // Throttle writes when clients receive frequent state changes.
  if(previous&&previous.sid===value.sid&&previous.game===game&&previous.name===name&&
     previous.title===title&&now-previous.updatedAt<10000)return true;
  const entry={code,sid:value.sid,name,game,title,
    updatedAt:now,expiresAt:now+hours*3600000};
  return write([entry,...past.filter(x=>x.code!==code)].slice(0,LIMIT));
 }
 function get(code){
  const c=String(code||'').toUpperCase();
  return list().find(x=>x.code===c)||null
 }
 function forget(code){
  const c=String(code||'').toUpperCase();
  return write(list().filter(x=>x.code!==c))
 }
 function clear(){
  try{localStorage.removeItem(KEY);return true}catch(_){return false}
 }
 root.NKRecent=Object.freeze({list,get,remember,forget,clear});
})(window);

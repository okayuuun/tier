'use strict';
/* Data stays in this browser unless the user explicitly shares a game URL or joins a room. */
(()=>{
  const prefix='nakamikurabe_v10_';
  function read(key,fallback){try{const v=localStorage.getItem(prefix+key);return v?JSON.parse(v):fallback}catch{return fallback}}
  function write(key,value){try{localStorage.setItem(prefix+key,JSON.stringify(value));return true}catch{return false}}
  function profile(){const p=read('profile',{});return {name:String(p.name||'').slice(0,24),emoji:String(p.emoji||'🌷').slice(0,5),avatar:typeof p.avatar==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,30000}$/.test(p.avatar)?p.avatar:''}}
  function saveProfile(p){return write('profile',{name:String(p.name||'').trim().slice(0,24),emoji:String(p.emoji||'🌷').slice(0,5),avatar:profileImage(p.avatar)})}
  function profileImage(s){return typeof s==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,30000}$/.test(s)?s:''}
  function games(){const a=read('games',[]);return Array.isArray(a)?a.filter(x=>x&&typeof x==='object').slice(0,45):[]}
  function saveGame(g){if(!g||!['tier','quiz','either','value','soup'].includes(g.game))return false;const a=games(),game={...g,id:String(g.id||('g_'+Date.now()+'_'+Math.random().toString(36).slice(2,8))),savedAt:Date.now()};const ix=a.findIndex(x=>x.id===game.id);if(ix>=0)a.splice(ix,1);a.unshift(game);return write('games',a.slice(0,45))}
  function deleteGame(id){return write('games',games().filter(x=>x.id!==id))}
  function records(){const a=read('records',[]);return Array.isArray(a)?a.slice(0,40):[]}
  function remember(r){const a=records(), key=String(r.key||'');if(!key||a.some(x=>x.key===key))return false;a.unshift({...r,at:Date.now()});return write('records',a.slice(0,40))}
  function pack(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function unpack(s){if(!/^[A-Za-z0-9_-]{1,18000}$/.test(s))throw Error('リンクの形式が正しくありません');const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}
  function avatarHTML(p,size=42){const a=profileImage(p?.avatar);return a?`<img class="nk-avatar" style="width:${size}px;height:${size}px" src="${a}" alt="">`:`<span class="nk-avatar nk-emoji" style="width:${size}px;height:${size}px">${String(p?.emoji||'🌷').replace(/[&<>"']/g,'')}</span>`}
  window.NKM={profile,saveProfile,games,saveGame,deleteGame,records,remember,pack,unpack,avatarHTML};
})();

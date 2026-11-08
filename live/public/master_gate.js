'use strict';
/* Hidden entry is a convenience, NOT the authorization mechanism. */
(() => {
  const btn=document.createElement('button');
  btn.type='button';btn.textContent='···';btn.title='';btn.setAttribute('aria-label','追加メニュー');btn.className='secret-entry';btn.style.cssText='border:0;background:transparent;color:#b59bad;font-size:13px;opacity:.5;cursor:pointer;padding:3px 9px;float:right';
  let parent=document.querySelector('footer')||document.body;
  parent.appendChild(btn);
  function promptMaster(){
    const code=window.prompt('コマンドを入力してください');
    if(code===null)return;
    if(code.trim().toLowerCase()==='okayu')location.href='/master';
    else if(code.trim())alert('コマンドが違います');
  }
  btn.addEventListener('click',promptMaster);
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==='k'){
      event.preventDefault();promptMaster();
    }
  });
})();
'use strict';
/* Block long-press selection and native callouts ONLY inside art surfaces.
   iOS Safari sometimes creates a Selection even with CSS user-select:none.
   Capture the gesture area and immediately clear that unwanted selection,
   without disabling input/textarea selection or the two-finger zoom gesture. */
(() => {
 const SURFACES='.ec-workspace,.nkb-zoom-viewport,.draw-board';
 const EDITABLE='input,textarea,select,[contenteditable="true"],[role="textbox"]';
 let activeSurface=null;
 let recentUntil=0;
 const closest=(node,selector)=>node&&typeof node.closest==='function'?node.closest(selector):null;
 const editable=node=>!!closest(node,EDITABLE);
 const surface=node=>editable(node)?null:closest(node,SURFACES);
 function mark(event){
  const zone=surface(event.target);
  if(zone){
   activeSurface=zone;
   recentUntil=Date.now()+1600;
  }
 }
 function refresh(event){
  if(activeSurface&&surface(event.target)===activeSurface){
   recentUntil=Date.now()+1600;
  }
 }
 document.addEventListener('pointerdown',mark,true);
 document.addEventListener('touchstart',mark,{capture:true,passive:true});
 document.addEventListener('pointermove',refresh,true);
 document.addEventListener('touchmove',refresh,{capture:true,passive:true});
 for(const type of ['contextmenu','selectstart','dragstart','dblclick']){
  document.addEventListener(type,event=>{
   if(surface(event.target)){
    event.preventDefault();
    // Do not stop propagation: existing pointer/touch handling should work.
    mark(event);
   }
  },true);
 }
 // Selection often arrives asynchronously on Safari *after* touchstart.
 document.addEventListener('selectionchange',()=>{
  if(!activeSurface||Date.now()>recentUntil||editable(document.activeElement))return;
  const selection=window.getSelection?.();
  if(selection&&!selection.isCollapsed&&typeof selection.removeAllRanges==='function'){
   selection.removeAllRanges();
  }
 });
 document.addEventListener('touchend',refresh,{capture:true,passive:true});
 document.addEventListener('pointerup',refresh,true);
})();

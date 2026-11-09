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
 // WebKit can still show its "Copy Link with Highlight" callout when CSS
 // user-select is none. Cancel ONLY native touch defaults over actual art
 // surfaces, never on buttons, links, text fields or the rest of the page.
 // Do not stop event propagation: our Pointer Events brush and pinch handlers
 // must continue receiving the complete gesture.
 function blockNativeTouch(event){
  if(surface(event.target)){
   mark(event);
   if(event.cancelable!==false)event.preventDefault()
  }
 }
 document.addEventListener('touchstart',blockNativeTouch,{capture:true,passive:false});
 document.addEventListener('pointermove',refresh,true);
 document.addEventListener('touchmove',blockNativeTouch,{capture:true,passive:false});
 document.addEventListener('gesturestart',blockNativeTouch,{capture:true,passive:false});
 document.addEventListener('gesturechange',blockNativeTouch,{capture:true,passive:false});
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

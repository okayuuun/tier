'use strict';
/** Shared non-destructive drawing controls. Strokes keep layer index and composed opacity. */
const NKMBrush=(()=>{
 const states={};
 const safe=s=>String(s).replace(/[^a-z0-9_-]/gi,'');
 function prepare(d){if(!['pen','eraser','picker'].includes(d.tool))d.tool='pen';if(!d.layers)d.layers=[{name:'レイヤー1',opacity:1,visible:true}];if(!Number.isInteger(d.layerIndex))d.layerIndex=0;if(!Number.isFinite(d.brushOpacity))d.brushOpacity=1;return d}
 function selected(d){return prepare(d).layers[d.layerIndex]||d.layers[0]}
 function panel(d,key){
 prepare(d);states[key]=d;d.canvasId={draw:'dp-canvas',mix:'mix-canvas',design:'ds-canvas'}[key];
 const opts=d.layers.map((l,i)=>`<option value="${i}" ${i===d.layerIndex?'selected':''}>${i+1}. ${l.name}</option>`).join('');
 const l=selected(d);
 const swatches=storedSwatches().map(c=>`<button type="button" class="nkb-swatch" style="background:${c}" title="${c}" onclick="NKMBrush.color('${safe(key)}','${c}')"></button>`).join('');
 return `<section class="nkb-panel"><div class="nkb-title">🎨 レイヤー・ペイントツール <small>最大6層</small></div>
 <div class="nkb-row">
  <button type="button" class="${d.tool==='pen'?'nkb-active':''}" onclick="NKMBrush.tool('${safe(key)}','pen')">✏️ ペン</button>
  <button type="button" class="${d.tool==='eraser'?'nkb-active':''}" onclick="NKMBrush.tool('${safe(key)}','eraser')">🧽 線消しゴム</button>
  <button type="button" class="${d.tool==='picker'?'nkb-active':''}" onclick="NKMBrush.tool('${safe(key)}','picker')">💧 スポイト</button>
  <button type="button" onclick="NKMBrush.savePNG('${safe(key)}')">📷 PNG保存</button>
 </div>
 <div class="nkb-row"><label>編集レイヤー <select onchange="NKMBrush.choose('${safe(key)}',this.value)">${opts}</select></label>
  <button type="button" onclick="NKMBrush.add('${safe(key)}')">＋ レイヤー</button>
  <button type="button" onclick="NKMBrush.move('${safe(key)}',1)">前面へ</button>
  <button type="button" onclick="NKMBrush.move('${safe(key)}',-1)">背面へ</button>
  <button type="button" onclick="NKMBrush.visibility('${safe(key)}')">${l.visible?'👁 表示中':'🙈 非表示'}</button></div>
 <div class="nkb-row">
  <label>レイヤーの透明度 <input type="range" min="0" max="100" value="${Math.round(l.opacity*100)}" oninput="NKMBrush.layerOpacity('${safe(key)}',this.value,this)"> <span>${Math.round(l.opacity*100)}%</span></label>
  <label>ペンの透明度 <input type="range" min="10" max="100" value="${Math.round(d.brushOpacity*100)}" oninput="NKMBrush.brushOpacity('${safe(key)}',this.value,this)"> <span>${Math.round(d.brushOpacity*100)}%</span></label>
 <label>ペンの太さ <input type="range" min="1" max="17" value="${d.size||5}" oninput="NKMBrush.brushSize('${safe(key)}',this.value,this)"> <span>${d.size||5}px</span></label>
 </div>
 <div class="nkb-row"><label>好きな色 <input type="color" value="${/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#4c375e'}" onchange="NKMBrush.color('${safe(key)}',this.value)"></label>
 <button type="button" onclick="NKMBrush.saveSwatch('${safe(key)}')">＋ 色をパレットに保存</button><button type="button" onclick="NKMBrush.removeSwatch('${safe(key)}')">選択色を削除</button>${swatches}
 <button type="button" onclick="NKMBrush.erase('${safe(key)}')">このレイヤーを全消去</button></div>
 <div class="nkb-row"><small>線消しゴムは触れた線を1本ずつ削除します。スポイトは絵の色を取得。保存した色はこのブラウザ内で共有します。</small></div></section>`
}
 function redraw(d){if(typeof d.repaint==='function')d.repaint();}
 function choose(k,i){const d=states[k];if(!d)return;d.layerIndex=Math.max(0,Math.min(d.layers.length-1,Number(i)));render()}
 function add(k){const d=states[k];if(!d)return;if(d.layers.length>=6){alert('レイヤーは最大6つです');return}d.layers.push({name:'レイヤー'+(d.layers.length+1),opacity:1,visible:true});d.layerIndex=d.layers.length-1;render()}
 function visibility(k){const d=states[k];if(!d)return;const l=selected(d);l.visible=!l.visible;render()}
 function layerOpacity(k,v,el){const d=states[k];if(!d)return;selected(d).opacity=Number(v)/100;if(el)el.nextElementSibling.textContent=v+'%';redraw(d)}
 function brushOpacity(k,v,el){const d=states[k];if(!d)return;d.brushOpacity=Number(v)/100;if(el)el.nextElementSibling.textContent=v+'%'}
 function color(k,v){const d=states[k];if(!d||!/^#[0-9a-f]{6}$/i.test(v))return;d.color=v;render()}
 function erase(k){const d=states[k];if(!d)return;if(!confirm('今のレイヤーの線だけを消しますか？'))return;d.strokes=d.strokes.filter(s=>(s.layer??0)!==d.layerIndex);render()}
  function storedSwatches(){
 try{const v=JSON.parse(localStorage.getItem('nakami_paint_swatches_v1')||'[]');return Array.isArray(v)?v.filter(c=>/^#[0-9a-f]{6}$/i.test(c)).slice(-12):[]}catch(_){return []}
}
 function saveSwatch(key){
 const d=states[key];if(!d||!/^#[0-9a-f]{6}$/i.test(d.color))return;
 const v=storedSwatches().filter(c=>c.toLowerCase()!==d.color.toLowerCase());v.push(d.color.toLowerCase());
 try{localStorage.setItem('nakami_paint_swatches_v1',JSON.stringify(v.slice(-12)))}catch(_){alert('パレットを保存できませんでした')}
 render()
}
 function removeSwatch(key){
 const d=states[key];if(!d)return;
 const colors=storedSwatches(),i=colors.indexOf(String(d.color||'').toLowerCase());
 if(i<0)return alert('選択中の色は保存されていません');
 colors.splice(i,1);
 try{localStorage.setItem('nakami_paint_swatches_v1',JSON.stringify(colors))}catch(_){return alert('パレットの変更に失敗しました')}
 render()
}
 function brushSize(key,v,el){
 const d=states[key];if(!d)return;
 d.size=Math.max(1,Math.min(17,Number(v)||5));
 if(el)el.nextElementSibling.textContent=d.size+'px'
}
 function tool(key,mode){
 const d=states[key];if(!d||!['pen','eraser','picker'].includes(mode))return;
 d.tool=mode;render()
}
 function move(key,delta){
 const d=states[key];if(!d)return;
 const old=d.layerIndex,target=old+delta;
 if(target<0||target>=d.layers.length)return;
 [d.layers[old],d.layers[target]]=[d.layers[target],d.layers[old]];
 d.strokes.forEach(s=>{if((s.layer??0)===old)s.layer=target;else if(s.layer===target)s.layer=old});
 d.layerIndex=target;render()
}
 function eraseAt(d,pt){
 if(!d.strokes?.length)return false;
 const x=pt[0]*720,y=pt[1]*440;
 const distance=(a,b)=>Math.hypot(a[0]*720-x,a[1]*440-y);
 for(let i=d.strokes.length-1;i>=0;i--){
  const s=d.strokes[i];if((s.layer??0)!==d.layerIndex)continue;
  const points=s.p||[];if(!points.length)continue;
  const threshold=Math.max(11,(s.w||5)/2+6),limit=threshold*threshold;
  for(let j=0;j<points.length;j++){
   const a=points[j],b=points[j+1]||a;
   const ax=a[0]*720,ay=a[1]*440,bx=b[0]*720,by=b[1]*440;
   const dx=bx-ax,dy=by-ay;
   const fraction=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
   if((x-ax-fraction*dx)**2+(y-ay-fraction*dy)**2<=limit){
    d.strokes.splice(i,1);return true
   }
  }
 }
 return false
}
 function interact(d,ctx,pt){
 prepare(d);
 if(d.tool==='picker'){
  const v=ctx.getImageData(Math.max(0,Math.min(719,Math.floor(pt[0]*720))),Math.max(0,Math.min(439,Math.floor(pt[1]*440))),1,1).data;
  d.color='#'+Array.from(v).slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join('');
  d.tool='pen';render();return true
 }
 if(d.tool==='eraser'){
  if(eraseAt(d,pt))redraw(d);
  return true
 }
 return false
}
 function savePNG(key){
 const d=states[key],canvas=d&&document.getElementById(d.canvasId);
 if(!canvas)return alert('描画画面を開いてから保存してください');
 canvas.toBlob(blob=>{
  if(!blob)return alert('PNGを作成できませんでした');
  const u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download='nakami-art-'+new Date().toISOString().slice(0,10)+'.png';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)
 },'image/png')
}
 function ordered(strokes,d){let items=[...strokes].sort((a,b)=>(a.layer??0)-(b.layer??0));if(!d)return items;prepare(d);return items.filter(s=>d.layers[s.layer??0]?.visible!==false).map(s=>({...s,a:Number((Math.min(1,Math.max(.05,s.a??1))*(d.layers[s.layer??0]?.opacity??1)).toFixed(3))}));}
 function newStroke(d,p){prepare(d);return {c:d.color,w:d.size||5,p:[p],layer:d.layerIndex,a:d.brushOpacity}}
 function undo(d){prepare(d);for(let i=d.strokes.length-1;i>=0;i--){if((d.strokes[i].layer??0)===d.layerIndex){d.strokes.splice(i,1);return}}}
 function exportStrokes(d){return ordered(d.strokes,d).filter(s=>s.a>=0.01).map(s=>({c:s.c,w:s.w,p:s.p,layer:s.layer??0,a:s.a??1}))}
 return {panel,prepare,ordered,newStroke,undo,exportStrokes,choose,add,visibility,layerOpacity,brushOpacity,color,erase,storedSwatches,saveSwatch,removeSwatch,brushSize,tool,move,eraseAt,interact,savePNG};
})();
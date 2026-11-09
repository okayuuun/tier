'use strict';
/** Shared non-destructive drawing controls. Strokes keep layer index and composed opacity. */
const NKMBrush=(()=>{
 const states={};
 const safe=s=>String(s).replace(/[^a-z0-9_-]/gi,'');
 function prepare(d){if(!d.layers)d.layers=[{name:'レイヤー1',opacity:1,visible:true}];if(!Number.isInteger(d.layerIndex))d.layerIndex=0;if(!Number.isFinite(d.brushOpacity))d.brushOpacity=1;if(!['pen','eraser','picker'].includes(d.tool))d.tool='pen';return d}
 function selected(d){return prepare(d).layers[d.layerIndex]||d.layers[0]}

 function favorites(){try{return JSON.parse(localStorage.getItem('nakami_favorite_colors_v1')||'[]').filter(c=>/^#[0-9a-f]{6}$/i.test(c)).slice(0,12)}catch(_){return []}}
 function storeFavorites(colors){try{localStorage.setItem('nakami_favorite_colors_v1',JSON.stringify(colors))}catch(_){alert('色の保存容量を超えました')}}
 function panel(d,key){
  prepare(d);states[key]=d;
  const k="'"+safe(key)+"'";
  const l=selected(d);
  const button=(label,method)=>'<button type="button" onclick="NKMBrush.'+method+'('+k+')">'+label+'</button>';
  const opts=d.layers.map((layer,i)=>'<option value="'+i+'" '+(i===d.layerIndex?'selected':'')+'>'+(i+1)+'. '+layer.name+'</option>').join('');
  const palette=favorites().map(c=>'<button type="button" class="nkb-swatch" title="'+c+'（クリックで選択）" style="background:'+c+'" onclick="NKMBrush.useFavorite('+k+',\''+c+'\')"></button>').join('');
  return '<section class="nkb-panel"><div class="nkb-title">🗂️ レイヤー・カスタムペン <small>最大6層</small></div>'
   +'<div class="nkb-row"><label>レイヤー <select onchange="NKMBrush.choose('+k+',this.value)">'+opts+'</select></label>'
   +button('＋ レイヤー','add')+button(l.visible?'👁 表示中':'🙈 非表示','visibility')
   +button('↑ 上へ','up')+button('↓ 下へ','down')+'</div>'
   +'<div class="nkb-row"><label>レイヤー透明度 <input type="range" min="1" max="100" value="'+Math.round(l.opacity*100)+'" oninput="NKMBrush.layerOpacity('+k+',this.value,this)"> <span>'+Math.round(l.opacity*100)+'%</span></label>'
   +'<label>ペン透明度 <input type="range" min="1" max="100" value="'+Math.round(d.brushOpacity*100)+'" oninput="NKMBrush.brushOpacity('+k+',this.value,this)"> <span>'+Math.round(d.brushOpacity*100)+'%</span></label>'
   +'<label>太さ <input type="range" min="1" max="17" value="'+(d.size||5)+'" oninput="NKMBrush.brushSize('+k+',this.value,this)"> <span>'+(d.size||5)+'px</span></label></div>'
   +'<div class="nkb-row"><label>自由な色 <input type="color" value="'+(/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#4c375e')+'" onchange="NKMBrush.color('+k+',this.value)"></label>'
   +button('★ 今の色を保存','saveFavorite')+button('保存色を1つ消す','removeFavorite')+'</div>'
   +'<div class="nkb-row">'+(palette||'<small>よく使う色を登録できます</small>')+'</div>'
   +'<div class="nkb-row"><strong>道具：</strong>'
   +'<label><input type="radio" name="nkb-tool" value="pen" '+(d.tool==='pen'?'checked':'')+' onchange="NKMBrush.setTool('+k+',this.value)"> ペン</label>'
   +'<label><input type="radio" name="nkb-tool" value="eraser" '+(d.tool==='eraser'?'checked':'')+' onchange="NKMBrush.setTool('+k+',this.value)"> 線を消す</label>'
   +'<label><input type="radio" name="nkb-tool" value="picker" '+(d.tool==='picker'?'checked':'')+' onchange="NKMBrush.setTool('+k+',this.value)"> スポイト</label>'
   +button('今のレイヤーを全消去','erase')+button('PNG保存','downloadPng')+'</div>'
   +'<small>線消しはタップした線を1本ずつ消します。レイヤーの上下は作品にも反映されます。</small></section>';
 }

 function redraw(d){if(typeof d.repaint==='function')d.repaint();}
 function choose(k,i){const d=states[k];if(!d)return;d.layerIndex=Math.max(0,Math.min(d.layers.length-1,Number(i)));render()}
 function add(k){const d=states[k];if(!d)return;if(d.layers.length>=6){alert('レイヤーは最大6つです');return}d.layers.push({name:'レイヤー'+(d.layers.length+1),opacity:1,visible:true});d.layerIndex=d.layers.length-1;render()}
 function visibility(k){const d=states[k];if(!d)return;const l=selected(d);l.visible=!l.visible;render()}
 function layerOpacity(k,v,el){const d=states[k];if(!d)return;selected(d).opacity=Number(v)/100;if(el)el.nextElementSibling.textContent=v+'%';redraw(d)}
 function brushOpacity(k,v,el){const d=states[k];if(!d)return;d.brushOpacity=Number(v)/100;if(el)el.nextElementSibling.textContent=v+'%'}
 function color(k,v){const d=states[k];if(!d||!/^#[0-9a-f]{6}$/i.test(v))return;d.color=v;render()}
 function erase(k){const d=states[k];if(!d)return;if(!confirm('今のレイヤーの線だけを消しますか？'))return;d.strokes=d.strokes.filter(s=>(s.layer??0)!==d.layerIndex);render()}

 function up(k){moveLayer(k,1)}
 function down(k){moveLayer(k,-1)}
 function moveLayer(k,step){const d=states[k];if(!d)return;const a=d.layerIndex,b=a+step;if(b<0||b>=d.layers.length)return;
  [d.layers[a],d.layers[b]]=[d.layers[b],d.layers[a]];
  d.strokes.forEach(s=>{if((s.layer??0)===a)s.layer=b;else if((s.layer??0)===b)s.layer=a});
  d.layerIndex=b;render()}
 function brushSize(k,v,el){const d=states[k];if(!d)return;d.size=Math.max(1,Math.min(17,Number(v)||5));if(el)el.nextElementSibling.textContent=d.size+'px'}
 function saveFavorite(k){const d=states[k];if(!d)return;const c=d.color;if(!/^#[0-9a-f]{6}$/i.test(c))return;const colors=favorites().filter(x=>x!==c);colors.push(c);storeFavorites(colors.slice(-12));render()}
 function removeFavorite(k){const d=states[k];if(!d)return;const colors=favorites();const idx=colors.lastIndexOf(d.color);if(idx>=0)colors.splice(idx,1);else colors.pop();storeFavorites(colors);render()}
 function useFavorite(k,c){if(/^#[0-9a-f]{6}$/i.test(c))color(k,c)}
 function setTool(k,tool){const d=states[k];if(d&&['pen','eraser','picker'].includes(tool))d.tool=tool}
 function eraseAt(d,point){
  prepare(d);const px=point[0]*720,py=point[1]*440;let best=-1,dist=Infinity;
  d.strokes.forEach((s,i)=>{
   if((s.layer??0)!==d.layerIndex)return;
   const pts=s.p||[];for(let j=0;j<pts.length;j++){
    const a=pts[Math.max(0,j-1)],b=pts[j],ax=a[0]*720,ay=a[1]*440,bx=b[0]*720,by=b[1]*440;
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
    const dd=Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
    if(dd<dist){best=i;dist=dd}
   }
  });
  if(best>=0&&dist<=Math.max(14,(d.strokes[best].w||5)/2+7)){d.strokes.splice(best,1);return true}return false;
 }
 function pickColor(d,canvas,point){
  if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
  try{const pix=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,Math.floor(point[0]*canvas.width))),Math.max(0,Math.min(canvas.height-1,Math.floor(point[1]*canvas.height))),1,1).data;
   d.color='#'+Array.from(pix.slice(0,3),x=>x.toString(16).padStart(2,'0')).join('');d.tool='pen';render()
  }catch(_){alert('色を取得できませんでした')}
 }
 function downloadPng(k){const d=states[k];const canvas=d?.canvas;if(!canvas)return alert('描画画面が見つかりません');
  canvas.toBlob(blob=>{if(!blob)return alert('PNGの保存に失敗しました');const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='nakami-illustration.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)
  },'image/png')}
 function ordered(strokes,d){let items=[...strokes].sort((a,b)=>(a.layer??0)-(b.layer??0));if(!d)return items;prepare(d);return items.filter(s=>d.layers[s.layer??0]?.visible!==false).map(s=>({...s,a:Number((Math.min(1,Math.max(.05,s.a??1))*(d.layers[s.layer??0]?.opacity??1)).toFixed(3))}));}
 function newStroke(d,p){prepare(d);return {c:d.color,w:d.size||5,p:[p],layer:d.layerIndex,a:d.brushOpacity}}
 function undo(d){prepare(d);for(let i=d.strokes.length-1;i>=0;i--){if((d.strokes[i].layer??0)===d.layerIndex){d.strokes.splice(i,1);return}}}
 function exportStrokes(d){return ordered(d.strokes,d).map(s=>({c:s.c,w:s.w,p:s.p,layer:s.layer??0,a:s.a??1}))}
 return {panel,prepare,ordered,newStroke,undo,exportStrokes,choose,add,visibility,layerOpacity,brushOpacity,brushSize,color,erase,up,down,setTool,eraseAt,pickColor,saveFavorite,removeFavorite,useFavorite,downloadPng};
})();
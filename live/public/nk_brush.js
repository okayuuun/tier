'use strict';
/** Shared non-destructive drawing controls. Strokes keep layer index and composed opacity. */
const NKMBrush=(()=>{
 const states={};
 const safe=s=>String(s).replace(/[^a-z0-9_-]/gi,'');
 function prepare(d){if(!d.layers)d.layers=[{name:'レイヤー1',opacity:1,visible:true}];if(!Number.isInteger(d.layerIndex))d.layerIndex=0;if(!Number.isFinite(d.brushOpacity))d.brushOpacity=1;return d}
 function selected(d){return prepare(d).layers[d.layerIndex]||d.layers[0]}
 function panel(d,key){prepare(d);states[key]=d;const opts=d.layers.map((l,i)=>`<option value="${i}" ${i===d.layerIndex?'selected':''}>${i+1}. ${l.name}</option>`).join('');const l=selected(d);return `<section class="nkb-panel"><div class="nkb-title">🗂️ レイヤー・カスタムペン <small>最大6層</small></div><div class="nkb-row"><label>編集レイヤー <select onchange="NKMBrush.choose('${safe(key)}',this.value)">${opts}</select></label><button type="button" onclick="NKMBrush.add('${safe(key)}')">＋ レイヤー</button><button type="button" onclick="NKMBrush.visibility('${safe(key)}')">${l.visible?'👁 表示中':'🙈 非表示'}</button></div><div class="nkb-row"><label>レイヤーの透明度 <input type="range" min="10" max="100" value="${Math.round(l.opacity*100)}" oninput="NKMBrush.layerOpacity('${safe(key)}',this.value,this)"> <span>${Math.round(l.opacity*100)}%</span></label><label>ペンの透明度 <input type="range" min="10" max="100" value="${Math.round(d.brushOpacity*100)}" oninput="NKMBrush.brushOpacity('${safe(key)}',this.value,this)"> <span>${Math.round(d.brushOpacity*100)}%</span></label></div><div class="nkb-row"><label>好きな色 <input type="color" value="${/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#4c375e'}" onchange="NKMBrush.color('${safe(key)}',this.value)"></label><button type="button" onclick="NKMBrush.erase('${safe(key)}')">このレイヤーの線を消す</button><small>レイヤーを切り替えると下の線を残して重ね描きできます。</small></div></section>`}
 function redraw(d){if(typeof d.repaint==='function')d.repaint();}
 function choose(k,i){const d=states[k];if(!d)return;d.layerIndex=Math.max(0,Math.min(d.layers.length-1,Number(i)));render()}
 function add(k){const d=states[k];if(!d)return;if(d.layers.length>=6){alert('レイヤーは最大6つです');return}d.layers.push({name:'レイヤー'+(d.layers.length+1),opacity:1,visible:true});d.layerIndex=d.layers.length-1;render()}
 function visibility(k){const d=states[k];if(!d)return;const l=selected(d);l.visible=!l.visible;render()}
 function layerOpacity(k,v,el){const d=states[k];if(!d)return;selected(d).opacity=Number(v)/100;if(el)el.nextElementSibling.textContent=v+'%';redraw(d)}
 function brushOpacity(k,v,el){const d=states[k];if(!d)return;d.brushOpacity=Number(v)/100;if(el)el.nextElementSibling.textContent=v+'%'}
 function color(k,v){const d=states[k];if(!d||!/^#[0-9a-f]{6}$/i.test(v))return;d.color=v;render()}
 function erase(k){const d=states[k];if(!d)return;if(!confirm('今のレイヤーの線だけを消しますか？'))return;d.strokes=d.strokes.filter(s=>(s.layer??0)!==d.layerIndex);render()}
 function ordered(strokes,d){let items=[...strokes].sort((a,b)=>(a.layer??0)-(b.layer??0));if(!d)return items;prepare(d);return items.filter(s=>d.layers[s.layer??0]?.visible!==false).map(s=>({...s,a:Number((Math.min(1,Math.max(.05,s.a??1))*(d.layers[s.layer??0]?.opacity??1)).toFixed(3))}));}
 function newStroke(d,p){prepare(d);return {c:d.color,w:d.size||5,p:[p],layer:d.layerIndex,a:d.brushOpacity}}
 function undo(d){prepare(d);for(let i=d.strokes.length-1;i>=0;i--){if((d.strokes[i].layer??0)===d.layerIndex){d.strokes.splice(i,1);return}}}
 function exportStrokes(d){return ordered(d.strokes,d).map(s=>({c:s.c,w:s.w,p:s.p,layer:s.layer??0,a:s.a??1}))}
 return {panel,prepare,ordered,newStroke,undo,exportStrokes,choose,add,visibility,layerOpacity,brushOpacity,color,erase};
})();
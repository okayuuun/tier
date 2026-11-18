'use strict';
/* Three original, link-first quiz mechanics inspired by broad quiz formats.
 * These helpers are loaded before studio.js; all state is resolved at call time.
 */
const STUDIO_MORE = new Set(['number','pairs','typing']);
const moreDefault = kind => kind==='number'?{min:0,max:100,tolerance:10,unit:''}:
 kind==='pairs'?{rightOptions:['','','','']}: {};
function moreEditor(i,q,ctrl){
 const k=draft.game,correct=draft.truth[i];
 const start='<div class="question" id="question-'+i+'"><h3>Q'+(i+1)+'</h3>'+ctrl+
 '<label>問題文</label><textarea class="field question-text" maxlength="300" '+
 'oninput="draft.config.qs['+i+'].q=this.value">'+X(q.q)+'</textarea>'+roundImg(i);
 if(k==='number')return start+
  '<p class="muted">好きな人の年齢やプレイ時間、誕生日の数字などを予想。ピッタリなら100点、許容誤差内は距離に応じて加点されます。</p>'+
  '<div class="grid">'+
  [['min','最小値'],['max','最大値'],['tolerance','許容誤差']].map(([key,label])=>
   '<div><label>'+label+'</label><input class="field" type="number" step="1" value="'+X(q[key])+
   '" oninput="draft.config.qs['+i+'].'+key+'=Number(this.value)"></div>').join('')+
  '<div><label>単位（任意）</label><input class="field" maxlength="15" value="'+X(q.unit||'')+
  '" oninput="draft.config.qs['+i+'].unit=this.value"></div></div>'+
  '<label>正解の数字</label><input class="field" type="number" step="1" value="'+X(correct)+
  '" oninput="draft.truth['+i+']=Number(this.value)"></div>';
 if(k==='typing')return start+
  '<p class="muted">答えを文字で入力してもらいます。全角・半角や大文字・小文字、スペースの違いを吸収して採点します。</p>'+
  '<label>正解（別表記も許すなら半角の | で区切る・最大5種類）</label>'+
  '<input class="field" maxlength="300" value="'+X(correct)+
  '" placeholder="例：ピカチュウ|ぴかちゅう" oninput="draft.truth['+i+']=this.value"></div>';
 return start+
  '<p class="muted">左に4つの項目、右に4つの答えを入れ、どの答えが正しいペアかを指定してください。正しい組み合わせ1つにつき1点。</p>'+
  '<div class="choicegrid">'+q.options.map((v,j)=>
    '<div><label>左の項目 '+(j+1)+'</label><input class="field" maxlength="160" value="'+X(v)+
    '" oninput="draft.config.qs['+i+'].options['+j+']=this.value"></div>').join('')+
  q.rightOptions.map((v,j)=>
    '<div><label>右の答え '+(j+1)+'</label><input class="field" maxlength="160" value="'+X(v)+
    '" oninput="draft.config.qs['+i+'].rightOptions['+j+']=this.value"></div>').join('')+
  '</div><h4>左の項目に対応する右の答えを選ぶ</h4>'+
  q.options.map((v,j)=>'<div class="pair-editor-row"><strong>'+(j+1)+'. '+X(v||'左の項目'+(j+1))+'</strong>'+
    '<select class="field" onchange="draft.truth['+i+']['+j+']=Number(this.value)">'+
    q.rightOptions.map((v,k)=>'<option value="'+k+'" '+(correct[j]===k?'selected':'')+'>'+
    (k+1)+'. '+X(v||'右の答え'+(k+1))+'</option>').join('')+
    '</select></div>').join('')+
  '<p class="muted">※同じ右の答えを2つの項目に割り当てることはできません。</p></div>'
}
function moreVerify(game,q,correct){
 const k=game.game;
 if(k==='number')return (!Number.isSafeInteger(q.min)||!Number.isSafeInteger(q.max)||
  q.min< -1000000||q.max>1000000||q.max<=q.min||q.max-q.min>1000000||
  !Number.isSafeInteger(q.tolerance)||q.tolerance<1||q.tolerance>q.max-q.min||
  !Number.isSafeInteger(correct)||correct<q.min||correct>q.max||
  typeof q.unit!=='string'||q.unit.length>15)?
  '数字の範囲・許容誤差・正解を確認してください':'';
 if(k==='typing')return (typeof correct!=='string'||correct.length>300||
   correct.split('|').length>5||correct.split('|').some(v=>!v.trim()||v.trim().length>60)||
   new Set(correct.split('|').map(v=>moreNorm(v))).size!==correct.split('|').length)?
   '文字の正解を1〜5種類、各60文字以内で入力してください':'';
 return (!Array.isArray(q.options)||q.options.length!==4||
   !Array.isArray(q.rightOptions)||q.rightOptions.length!==4||
   [...q.options,...q.rightOptions].some(v=>typeof v!=='string'||!v.trim()||v.length>160)||
   new Set(q.options.map(x=>x.trim())).size!==4||
   new Set(q.rightOptions.map(x=>x.trim())).size!==4||
   !Array.isArray(correct)||correct.length!==4||
   correct.some(x=>!Number.isInteger(x)||x<0||x>3)||new Set(correct).size!==4)?
   '左右4個の異なる項目と、重複しない正しいペアを設定してください':''
}
function moreValid(g,q,a){
 if(!q||typeof q.q!=='string'||!q.q.trim()||!Array.isArray(g.config.qs))return false;
 if(g.game==='number'&&(!Number.isInteger(a)||a<q.min||a>q.max))return false;
 if(g.game==='typing'&&typeof a!=='string')return false;
 return !moreVerify(g,q,a)
}
function moreNorm(s){return String(s).normalize('NFKC').toLowerCase().replace(/\s/g,'')}
function moreScore(play,guesses){
 if(play.game==='number')return guesses.reduce((score,a,i)=>{
  const q=play.config.qs[i],tol=q.tolerance,diff=Math.abs(a-play.truth[i]);
  return score+Math.max(0,Math.floor((100*(tol-diff)+tol/2)/tol))
 },0);
 if(play.game==='typing')return guesses.reduce((s,a,i)=>
   s+(play.truth[i].split('|').some(t=>moreNorm(t)===moreNorm(a))?1:0),0);
 return guesses.reduce((s,row,i)=>s+row.filter((v,j)=>v===play.truth[i][j]).length,0)
}
function moreMaximum(kind,count){return count*(kind==='number'?100:kind==='pairs'?4:1)}
function moreInitGuesses(kind,qs){
 return qs.map(()=>kind==='number'?null:kind==='typing'?'':[-1,-1,-1,-1])
}
function moreCheckGuesses(kind,guesses,qs){
 if(kind==='number')return guesses.every((v,i)=>Number.isSafeInteger(v)&&
  v>=qs[i].min&&v<=qs[i].max);
 if(kind==='typing')return guesses.every(v=>typeof v==='string'&&
  !!v.trim()&&v.length<=80);
 return guesses.every(row=>Array.isArray(row)&&row.length===4&&
  row.every(x=>Number.isInteger(x)&&x>=0&&x<4)&&new Set(row).size===4)
}
function moreSetNumber(i,v){
 if(v===''){guesses[i]=null;return}
 const num=Number(v);
 guesses[i]=Number.isSafeInteger(num)?num:null
}
function moreSetPair(i,j,v){
 guesses[i][j]=v===''?-1:Number(v)
}
function morePlayQuestion(kind,i,q){
 const head='<h3>'+X(q.q)+'</h3>'+imageHTML(q.image);
 if(kind==='number'){
  const selected=guesses[i],min=q.min,max=q.max,unit=X(q.unit||'');
  const answer=finished?'<div class="result">正解：<strong>'+X(play.truth[i])+unit+
   '</strong><p>あなたの回答：'+X(selected)+unit+'</p></div>':'';
  return head+'<p>範囲：'+X(min)+'〜'+X(max)+unit+
   '　正解に近いほど高得点（最大100点）</p>'+
   '<label for="more-number-'+i+'">あなたの予想</label>'+
   '<input id="more-number-'+i+'" class="field" type="number" step="1" min="'+X(min)+
   '" max="'+X(max)+'" value="'+(selected===null?'':X(selected))+'" '+
   (finished?'disabled':'oninput="moreSetNumber('+i+',this.value)"')+'>'+
   '<p class="muted">許容誤差の範囲内で加点。近いほど高得点！</p>'+answer
 }
 if(kind==='typing'){
  const correct=finished?'<div class="result">正解：<strong>'+
    X(play.truth[i].split('|').join(' ／ '))+'</strong></div>':'';
  return head+'<p class="muted">選択肢はありません。答えを文字で入力してください。</p>'+
   '<input class="field" maxlength="80" type="text" autocomplete="off" '+
   'value="'+X(guesses[i])+'" placeholder="ここに答えを入力" '+
   (finished?'disabled':'oninput="guesses['+i+']=this.value"')+'>'+correct
 }
 const result=finished?'<div class="result"><strong>正しい組み合わせ</strong>'+
 q.options.map((v,j)=>'<p>'+X(v)+' ＝ '+X(q.rightOptions[play.truth[i][j]])+'</p>').join('')+
 '</div>':'';
 return head+'<p class="muted">左の4項目に対応する右の答えを1つずつ選んでください。</p>'+
 q.options.map((v,j)=>'<div class="pair-editor-row"><strong>'+X(v)+'</strong>'+
 '<select class="field" '+(finished?'disabled':'onchange="moreSetPair('+i+','+j+',this.value)"')+'>'+
 '<option value="">答えを選ぶ</option>'+
 q.rightOptions.map((x,k)=>'<option value="'+k+'" '+(guesses[i][j]===k?'selected':'')+'>'+X(x)+'</option>').join('')+
 '</select></div>').join('')+result
}

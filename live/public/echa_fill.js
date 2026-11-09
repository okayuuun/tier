'use strict';
/* Deterministic, bounded 4-connected bucket fill for the art-chat canvas.
   The boundary pixels come from the selected reference image; output pixels
   are written ONLY into the selected destination layer. */
const ECFill=(()=>{
 function fill(source,target,x,y,color,opacity=1,tolerance=15){
  if(!source||!target||source.width!==target.width||source.height!==target.height)
   throw Error('塗りつぶし画像のサイズが一致しません');
  const w=source.width,h=source.height,total=w*h;
  const sx=Math.floor(x),sy=Math.floor(y);
  if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<0||sx>=w||sy<0||sy>=h)
   return 0;
  if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('塗りつぶしの色が不正です');
  const o=Math.max(0,Math.min(1,Number(opacity)));
  if(!o)return 0;
  const delta=Math.max(0,Math.min(255,Math.round(tolerance*255/100)));
  const c=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
  const pixels=source.data,dst=target.data,origin=(sy*w+sx)*4;
  const a=pixels[origin],b=pixels[origin+1],g=pixels[origin+2],alpha=pixels[origin+3];
  // A visited array ensures a pixel is tested at most once. The queue cannot
  // grow past the canvas area even when filling the entire background.
  const visited=new Uint8Array(total),queue=new Uint32Array(total);
  let head=0,tail=0;
  function enqueue(i){
   if(visited[i])return;
   visited[i]=1;
   const p=i*4;
   if(Math.abs(pixels[p]-a)<=delta&&Math.abs(pixels[p+1]-b)<=delta&&
      Math.abs(pixels[p+2]-g)<=delta&&Math.abs(pixels[p+3]-alpha)<=delta){
    queue[tail++]=i;
   }
  }
  enqueue(sy*w+sx);
  for(;head<tail;head++){
   const i=queue[head],p=i*4;
   const oldA=dst[p+3]/255,remaining=oldA*(1-o),newA=o+remaining;
   dst[p]=Math.round((c[0]*o+dst[p]*remaining)/newA);
   dst[p+1]=Math.round((c[1]*o+dst[p+1]*remaining)/newA);
   dst[p+2]=Math.round((c[2]*o+dst[p+2]*remaining)/newA);
   dst[p+3]=Math.round(newA*255);
   const col=i%w;
   if(col>0)enqueue(i-1);
   if(col+1<w)enqueue(i+1);
   if(i>=w)enqueue(i-w);
   if(i+w<total)enqueue(i+w);
  }
  return tail;
 }
 return {fill};
})();

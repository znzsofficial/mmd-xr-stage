import {observationText} from '../sectionProjection';

export type GlyphRow={text:string;size:number;weight:number;color:string};
const W=232,H=27;
function rows(zh:boolean){
  const table:GlyphRow[]=[],word=(text:string,size:number,weight:number,color='#fff1e9')=>table.push({text,size,weight,color});
  word(zh?'外阴':'Vulva',17,650);word(zh?'阴道剖面':'Vaginal canal',17,650);
  word(zh?'阴道口':'Opening',13,550);word(zh?'宫颈限位':'Cervical stop',13,550);
  for(const [k,t] of Object.entries(observationText))word(t[zh?0:1],16,620,k==='waiting'?'#cfb9c2':k==='inside'||k==='stop'?'#90bcff':k==='outside'||k==='outsideOffset'||k==='approach'?'#c7a5ff':'#ffba9f');
  word(zh?'待命 · 实测杆位':'Parked · measured position',16,620,'#ebc68e');
  for(const text of zh?['入口半径','在内深度','距入口平面','侧偏']:['Opening radius','Insertion depth','From entry plane','Lateral'])word(text,13.5,520,'#cfb9c2');
  for(const ch of '0123456789.+-cm')word(ch,13.5,550,'#fff1e9');
  return table;
}
function sheet(image:CanvasImageSource,table:GlyphRow[]){
  const index=new Map(table.map((r,i)=>[r.text,i]));
  const draw=(ctx:CanvasRenderingContext2D,word:string,x:number,y:number,width=W)=>{const i=index.get(word);if(i!==undefined)ctx.drawImage(image,0,i*2*H,2*width,2*H,x-1,y-H/2,width,H);};
  function number(ctx:CanvasRenderingContext2D,value:string,right:number,y:number){
    // Tabular metric, decimal and signed coordinates, not a reconstructed pose.
    for(let i=value.length-1;i>=0;i--){const ch=value[i],step=ch==='.'||ch===' '?4:ch==='m'?13:ch==='+'||ch==='-'?9:8.5;
      right-=step;if(ch!==' ')draw(ctx,ch,right,y,step+2);}
  }
  return {draw,number};
}
export type EntryType=ReturnType<typeof sheet>;
function nativeFallback(table:GlyphRow[]):EntryType{
  const rows=new Map(table.map(r=>[r.text,r]));
  return {draw(ctx,text,x,y){const r=rows.get(text);if(!r)return;ctx.font=`${r.weight} ${r.size}px system-ui,sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=r.color;ctx.fillText(text,x,y);},
    number(ctx,v,x,y){ctx.font='550 13.5px system-ui,sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle='#fff1e9';ctx.fillText(v,x,y);}};
}

/** Per visible destination, with no font lookup or rasterization on its first
 * tracking frame. Paint the calibrated silhouettes and observed nozzle first;
 * font completion only wakes the owner, it cannot publish a stale sample. */
export function entryLettering(ready:()=>void){
  let worker:Worker|null=null,bitmap:ImageBitmap|null=null,result:EntryType|null=null,locale:boolean|undefined,epoch=0;
  function release(){epoch++;worker?.terminate();worker=null;bitmap?.close();bitmap=null;result=null;}
  function get(zh:boolean){
    if(zh===locale)return result;release();locale=zh;const token=epoch,table=rows(zh);
    function accept(img:ImageBitmap|HTMLImageElement){if(token!==epoch){if('close' in img)img.close();return;}
      if('close' in img)bitmap=img;result=sheet(img,table);ready();}
    // Some engines deny Worker or OffscreenCanvas. Decode a local typesheet
    // asynchronously; no actor pixels, network fonts or image service involved.
    function fallback(){if(token!==epoch)return;worker?.terminate();worker=null;
      const img=new Image();img.decoding='async';const text=table.map(({text,size,weight,color},i)=>
        `<text x="1" y="${(i+.5)*H}" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${color}">${text}</text>`).join('');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${2*W}" height="${2*H*table.length}" viewBox="0 0 ${W} ${H*table.length}"><g font-family="system-ui,Microsoft YaHei,sans-serif">${text}</g></svg>`;
      img.onload=()=>{if(token!==epoch)return;if(typeof createImageBitmap==='function')void createImageBitmap(img).then(accept,()=>accept(img));else accept(img);};
      img.onerror=()=>{if(token===epoch){result=nativeFallback(table);ready();}};img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'){fallback();return null;}
    try{worker=new Worker(new URL('./entryLettering.worker.ts',import.meta.url),{type:'module'});
      worker.onerror=e=>{e.preventDefault();fallback();};worker.onmessageerror=fallback;
      worker.onmessage=(e:MessageEvent<ImageBitmap|null>)=>{if(!e.data){fallback();return;}if(token===epoch){worker?.terminate();worker=null;}accept(e.data);};
      worker.postMessage({rows:table,w:W,rh:H});
    }catch{fallback();}return null;
  }
  return {get,dispose(){release();locale=undefined;}};
}

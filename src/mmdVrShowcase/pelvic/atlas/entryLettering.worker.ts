import type {GlyphRow} from './entryLettering';

// This sheet contains interface strings only. Never send a sample, actor, or
// generated figure to the lettering worker. Transferred once per locale.
self.onmessage=(e:MessageEvent<{rows:GlyphRow[];w:number;rh:number}>)=>{
  try{
    const {rows,w,rh}=e.data,c=new OffscreenCanvas(2*w,2*rh*rows.length),ctx=c.getContext('2d')!;
    ctx.scale(2,2);ctx.textBaseline='middle';ctx.fontKerning='normal';
    rows.forEach(({text,size,weight,color},i)=>{ctx.font=`${weight} ${size}px system-ui,"Microsoft YaHei",sans-serif`;ctx.fillStyle=color;ctx.fillText(text,1,(i+.5)*rh);});
    const b=c.transferToImageBitmap();self.postMessage(b,{transfer:[b]});
  }catch{self.postMessage(null);}
};

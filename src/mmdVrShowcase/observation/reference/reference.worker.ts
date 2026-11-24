import {createReferenceArt,type ReferenceFrame} from './art';

const art=createReferenceArt();let canvas:OffscreenCanvas|undefined;
self.onmessage=({data:{options,scale}}:MessageEvent<{options:ReferenceFrame;scale:number}>)=>{
  try{
    const w=Math.round(options.width*scale),h=Math.round(options.height*scale);
    if(!canvas||canvas.width!==w||canvas.height!==h)canvas=new OffscreenCanvas(w,h);
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Missing 2D canvas');ctx.setTransform(scale,0,0,scale,0,0);
    art.draw(ctx,options);const bitmap=canvas.transferToImageBitmap();self.postMessage({bitmap},{transfer:[bitmap]});
  }catch{self.postMessage({unavailable:true});}
};

import {createBreastArt,type BreastArtFrame} from './art';

let canvas:OffscreenCanvas|undefined;
const art=createBreastArt();
self.onmessage=(e:MessageEvent<{scale:number;options:BreastArtFrame}>)=>{
  try{
    const {scale,options}=e.data,w=Math.round(options.width*scale),h=Math.round(options.height*scale);
    if(!canvas||w!==canvas.width||h!==canvas.height)canvas=new OffscreenCanvas(w,h);
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Missing 2D canvas');
    ctx.setTransform(scale,0,0,scale,0,0);art.draw(ctx as unknown as CanvasRenderingContext2D,options);
    const bitmap=canvas.transferToImageBitmap();self.postMessage({bitmap},{transfer:[bitmap]});
  }catch{self.postMessage({unavailable:true});}
};

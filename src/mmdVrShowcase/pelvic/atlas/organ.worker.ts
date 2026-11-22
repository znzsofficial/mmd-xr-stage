import {createOrganArt,type OrganArtOptions} from './organArt';

// Only numerical illustration inputs cross this boundary, not actor meshes,
// files, camera handles or XRFrames. The output is a local, transferable image.
const art=createOrganArt();
let surface:OffscreenCanvas|null=null;
self.onmessage=(e:MessageEvent<{options:OrganArtOptions;scale:number}>)=>{
  try{
    const {options,scale}=e.data,w=Math.round(options.width*scale),h=Math.round(options.height*scale);
    if(!surface||surface.width!==w||surface.height!==h)surface=new OffscreenCanvas(w,h);
    const ctx=surface.getContext('2d');if(!ctx)throw new Error('2D surface unavailable');
    ctx.setTransform(scale,0,0,scale,0,0);
    art.draw(ctx as unknown as CanvasRenderingContext2D,options);
    const bitmap=surface.transferToImageBitmap();self.postMessage({bitmap},{transfer:[bitmap]});
  }catch{self.postMessage({unavailable:true});}
};

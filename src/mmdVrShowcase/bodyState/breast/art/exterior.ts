import { figure,wallMeshes } from './figure';
import type { AreolaStyle } from './areola';
import type { Camera,Ink,Side } from './geometry';
import { inkContours,meshRenderer,PORTRAIT_HEIGHT,PORTRAIT_WIDTH,RASTER_HEIGHT,RASTER_WIDTH } from './raster';
import { drawChestWall,drawSection,H,W,WALL_HEIGHT,WALL_WIDTH } from './section';
import { sideFullness } from './teardrop';
import { cutMap,marks,type Cut } from './teardropCut';
import { collarInk,paintTeardrop,type Face,type Faces } from './teardropPaint';

export type Bitmap={canvas:HTMLCanvasElement|OffscreenCanvas;ctx:Ink};
type Allocate=(width:number,height:number)=>Bitmap|null;
type View={camera:Camera;fullness:number;leftFill:number;rightFill:number;lactating:boolean;section:boolean;leftSettle:number;rightSettle:number;areolaStyle:AreolaStyle};
type Cache={full?:number;cut?:Cut;fill?:number;tile?:ImageData};

export function createPortraitRenderer(allocate:Allocate){
  const bitmap=allocate(RASTER_WIDTH,RASTER_HEIGHT);if(!bitmap)return null;
  const image=bitmap.ctx.createImageData(RASTER_WIDTH,RASTER_HEIGHT),depths=new Float32Array(RASTER_WIDTH*RASTER_HEIGHT);
  const render=meshRenderer(depths,image.data,true),outfit=figure(),left:Cache={},right:Cache={};
  let base:{s:number;section:boolean;depth:Float32Array;color:Uint8ClampedArray}|undefined;
  let scratch:Bitmap|null=null,wall:ImageData|undefined;
  const tiles=()=>scratch??=allocate(Math.max(W,WALL_WIDTH),Math.max(H,WALL_HEIGHT));
  function face(cache:Cache,side:Side,full:number,fill:number,lactating:boolean):Face|null{
    if(!cache.cut||cache.full!==full){cache.cut=cutMap(full,side);cache.full=full;}
    const key=lactating?fill:-1;
    if(!cache.tile||cache.fill!==key){const ctx=tiles()?.ctx;if(!ctx)return null;
      ctx.clearRect(0,0,W,H);drawSection(ctx,side,fill,lactating);cache.tile=ctx.getImageData(0,0,W,H);cache.fill=key;
    }return {cut:cache.cut,tile:cache.tile};
  }
  function background(cam:Camera,section:boolean){
    if(base?.s===cam.s&&base.section===section){depths.set(base.depth);image.data.set(base.color);return;}
    depths.fill(-1e4);image.data.fill(0);render(outfit[0][0],cam,outfit[0][1],0);
    if(section){
      if(!wall){const ctx=tiles()?.ctx;if(ctx){drawChestWall(ctx);wall=ctx.getImageData(0,0,WALL_WIDTH,WALL_HEIGHT);}}
      if(wall)for(const mesh of wallMeshes())render(mesh,cam,1,0,wall);
    }
    base??={s:NaN,section,depth:new Float32Array(depths.length),color:new Uint8ClampedArray(image.data.length)};
    base.s=cam.s;base.section=section;base.depth.set(depths);base.color.set(image.data);
  }
  return {draw(ctx:Ink,v:View){
    const cam=v.camera,lf=sideFullness(v.fullness,v.leftFill),rf=sideFullness(v.fullness,v.rightFill);
    let cuts:Faces|null=null;
    if(v.section){const l=face(left,1,lf,v.leftFill,v.lactating),r=face(right,-1,rf,v.rightFill,v.lactating);if(l&&r)cuts=[l,r];}
    background(cam,v.section);
    paintTeardrop(image.data,depths,cam,lf,rf,v.leftSettle,v.rightSettle,cuts,v.areolaStyle);
    for(let i=1;i<outfit.length;i++)render(outfit[i][0],cam,outfit[i][1],0);
    inkContours(depths,image.data);bitmap.ctx.putImageData(image,0,0);collarInk(bitmap.ctx,cam,depths);
    ctx.drawImage(bitmap.canvas,0,0,PORTRAIT_WIDTH,PORTRAIT_HEIGHT);
    return cuts?marks(cuts[cam.s<0?1:0].cut,cam,depths):null;
  }};
}

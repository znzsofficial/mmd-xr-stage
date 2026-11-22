import { cutMound, mound, type BreastMesh } from './breastSurface';
import { brushwork, labelAnchors } from './brushwork';
import { figure, wallMeshes } from './figure';
import type { Camera, Ink, Side } from './geometry';
import { inkContours, meshRenderer, PORTRAIT_HEIGHT, PORTRAIT_WIDTH, RASTER_HEIGHT, RASTER_WIDTH } from './raster';
import { drawChestWall, drawSection, H, W, WALL_HEIGHT, WALL_WIDTH } from './section';

export type Bitmap = {canvas:HTMLCanvasElement|OffscreenCanvas; ctx:Ink};
type Allocate = (width:number,height:number)=>Bitmap|null;
type PortraitView = {camera:Camera;fullness:number;leftFill:number;rightFill:number;lactating:boolean;section:boolean;settle:number};
type SideCache = {fullness?:number;mesh?:BreastMesh;cut?:ReturnType<typeof cutMound>;tile?:ImageData;tileFill?:number};

/** Composes one portrait. Static geometry is shared, but pixels, depth,
 * deformed surfaces and tissue textures belong to this renderer only. */
export function createPortraitRenderer(allocate:Allocate) {
  const bitmap=allocate(RASTER_WIDTH,RASTER_HEIGHT);
  if (!bitmap) return null;
  const image=bitmap.ctx.createImageData(RASTER_WIDTH,RASTER_HEIGHT);
  const depths=new Float32Array(RASTER_WIDTH*RASTER_HEIGHT);
  const render=meshRenderer(depths,image.data);
  const left:SideCache={}, right:SideCache={};
  let backdrop:{sinYaw:number;section:boolean;depth:Float32Array;color:Uint8ClampedArray}|undefined;
  let wall:ImageData|undefined, scratch:Bitmap|null=null;

  function textureCanvas() {
    return scratch??=allocate(Math.max(W,WALL_WIDTH),Math.max(H,WALL_HEIGHT));
  }

  function tissueTile(cache:SideCache,side:Side,fill:number,lactating:boolean) {
    const key=lactating?fill:-1;
    if (!cache.tile || cache.tileFill!==key) {
      const ctx=textureCanvas()?.ctx;
      if (ctx) {
        ctx.clearRect(0,0,W,H);
        drawSection(ctx,side,fill,lactating);
        cache.tile=ctx.getImageData(0,0,W,H);
        cache.tileFill=key;
      }
    }
    return cache.tile;
  }

  function drawBackdrop({camera,section}:PortraitView) {
    if (backdrop?.sinYaw===camera.s && backdrop.section===section) {
      depths.set(backdrop.depth);
      image.data.set(backdrop.color);
      return;
    }
    depths.fill(-1e4); image.data.fill(0);
    for (const [mesh,sign] of figure()) render(mesh,camera,sign,0);
    if (section) {
      if (!wall) {
        const ctx=textureCanvas()?.ctx;
        if (ctx) {
          drawChestWall(ctx);
          wall=ctx.getImageData(0,0,WALL_WIDTH,WALL_HEIGHT);
        }
      }
      if (wall) for (const mesh of wallMeshes()) render(mesh,camera,1,0,wall);
    }
    backdrop??={sinYaw:NaN,section,depth:new Float32Array(depths.length),color:new Uint8ClampedArray(image.data.length)};
    backdrop.sinYaw=camera.s; backdrop.section=section;
    backdrop.depth.set(depths); backdrop.color.set(image.data);
  }

  function drawSide(view:PortraitView,side:Side,cache:SideCache,fill:number) {
    const fullness=view.fullness+.31*fill;
    if (!cache.mesh || cache.fullness!==fullness) {
      cache.mesh=mound(side,fullness);
      cache.fullness=fullness;
      cache.cut=undefined;
    }
    if (view.section) {
      const cut=cache.cut??=cutMound(cache.mesh);
      render(cut.skin,view.camera,-side,view.settle);
      const tile=tissueTile(cache,side,fill,view.lactating);
      if (tile) render(cut.face,view.camera,1,0,tile);
    } else {
      render(cache.mesh,view.camera,-side,view.settle);
    }
    return cache.mesh;
  }

  return {draw(ctx:Ink,view:PortraitView) {
    drawBackdrop(view);
    const rightMesh=drawSide(view,-1,right,view.rightFill);
    const leftMesh=drawSide(view,1,left,view.leftFill);
    inkContours(depths,image.data);
    bitmap.ctx.putImageData(image,0,0);
    brushwork(bitmap.ctx,view.camera,depths,leftMesh,rightMesh,view.settle);
    ctx.drawImage(bitmap.canvas,0,0,PORTRAIT_WIDTH,PORTRAIT_HEIGHT);
    if (!view.section) return null;
    return view.camera.s<0 ? labelAnchors(rightMesh,-1,view.camera,depths) : labelAnchors(leftMesh,1,view.camera,depths);
  }};
}

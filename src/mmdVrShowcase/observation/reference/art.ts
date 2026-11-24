import {camera,type Camera,type Ink} from '../../bodyState/breast/art/geometry';
import {meshRenderer,inkContours,portraitX,portraitY,RASTER_WIDTH as W,RASTER_HEIGHT as H} from '../../bodyState/breast/art/raster';
import {createMammaryStudy} from './mammaryStudy';
import {createUterineStudy} from './uterineStudy';
import {createVulvarStudy} from './vulvarStudy';
import {createVaginalStudy} from './vaginalStudy';
import type {Mark,Study} from './forms';

export type ReferencePart='uterus'|'breast'|'vulva'|'vagina';
export type ReferenceFrame={part:ReferencePart;width:number;height:number;degrees:number;section:boolean;labels:boolean;zh:boolean};
// The lower-tract atlas looks towards actor right on a positive orbit; the
// breast portrait uses its own, existing actor-left convention.
export const referenceCamera=(f:ReferenceFrame)=>camera(f.part==='breast'?f.degrees:-f.degrees);
function buffer(w:number,h:number){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Missing 2D canvas');return {canvas,ctx};
}
function leaders(c:Ink,marks:Mark[],cam:Camera,zh:boolean,halfWidth:number){
  c.lineJoin=c.lineCap='round';c.textBaseline='middle';c.font='600 15px system-ui,sans-serif';
  for(const [i,m] of marks.entries()){
    const x=portraitX(cam,m.at[0],m.at[2]),y=portraitY(m.at[1],0),left=i===0||i===2,end=200+(left?-1:1)*(halfWidth-8),ty=[72,38,181,224][i];
    const text=zh?m.zh:m.en,elbow=end+(left?1:-1)*(c.measureText(text).width+5);
    c.beginPath();c.moveTo(x,y);c.lineTo(elbow+(left?5:-5),ty);c.lineTo(elbow,ty);c.strokeStyle='#875865';c.lineWidth=2.3;c.stroke();
    c.strokeStyle='#f0cba7';c.lineWidth=.95;c.stroke();c.beginPath();c.arc(x,y,2.45,0,Math.PI*2);c.fillStyle='#ffe5bc';c.fill();
    c.textAlign=left?'left':'right';c.strokeStyle='#382433';c.lineWidth=3;c.strokeText(text,end,ty);c.fillStyle='#fff1df';c.fillText(text,end,ty);
  }
}
/** All plates share one local depth pass. Allocations are lazy and owned by
 * the mounted study, including when the worker cannot start. */
export function createReferenceArt(){
  const make=()=>{const {canvas,ctx}=buffer(W,H),image=ctx.createImageData(W,H),depth=new Float32Array(W*H);
    return {canvas,ctx,image,depth,render:meshRenderer(depth,image.data,true),mammary:createMammaryStudy()};};
  let plate:ReturnType<typeof make>|undefined,uterus:ReturnType<typeof createUterineStudy>|undefined,canal:Study|undefined,vulva:Study|undefined;
  return {draw(c:Ink,f:ReferenceFrame){
    const p=plate??=make(),cam=referenceCamera(f);p.depth.fill(-1e4);p.image.data.fill(0);
    let marks:Mark[];
    if(f.part==='breast')marks=p.mammary(p.render,p.image.data,p.depth,cam,f.section,(w,h)=>buffer(w,h).ctx);
    else if(f.part==='uterus'){const study=uterus??=createUterineStudy();
      // External adnexa, like the anterior half of the shell, are cut away
      // inside the window. A profile never lays a tube across the fetal face.
      for(const [mesh,flip] of study.adnexa)p.render(mesh,cam,flip,0);p.depth.fill(-1e4);
       for(const [mesh,flip] of study.layers)p.render(mesh,cam,flip,0);marks=study.marks;}
    else {const study=f.part==='vulva'?(vulva??=createVulvarStudy()):(canal??=createVaginalStudy());
      for(const [mesh,flip] of study.layers)p.render(mesh,cam,flip,0);marks=study.marks;}
    inkContours(p.depth,p.image.data);p.ctx.putImageData(p.image,0,0);
    const zoom=f.height/260;
    c.save();c.fillStyle='#211722';c.fillRect(0,0,f.width,f.height);c.translate(f.width/2-200*zoom,0);c.scale(zoom,zoom);
    c.drawImage(p.canvas,0,0,400,260);if(f.labels)leaders(c,marks,cam,f.zh,f.width/(2*zoom));c.restore();
  },dispose(){plate=undefined;uterus=undefined;canal=vulva=undefined;}};
}

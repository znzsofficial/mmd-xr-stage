import {figure} from '../../bodyState/breast/art/figure';
import {cutBounds,type Camera,type Ink,type Side} from '../../bodyState/breast/art/geometry';
import {W,H,R,Y} from '../../bodyState/breast/art/section';
import {cutMap} from '../../bodyState/breast/art/teardropCut';
import {paintTeardrop,type Faces} from '../../bodyState/breast/art/teardropPaint';
import {portraitX,portraitY,RASTER_SCALE,RASTER_WIDTH,RASTER_HEIGHT,type meshRenderer} from '../../bodyState/breast/art/raster';
import {height,middle} from '../../bodyState/breast/art/teardrop';
import type {Mark} from './forms';

// Fixed plate: abundant lobular tissue around branching ducts, rather than
// a reservoir. No gland or pigment here is driven by a milk-store fraction.
const form=1.46;
const clusters=[[.13,.39],[.21,.50],[.34,.33],[.48,.26],[.59,.12],
  [.11,.07],[.24,.06],[.39,-.015],[.51,-.12],[.63,-.18],
  [.13,-.30],[.29,-.35],[.41,-.41],[.55,-.49],[.67,-.44],
  [.11,-.56],[.23,-.64],[.35,-.72],[.48,-.69]];
// The warmer areolar field sits on the actual anterior surface, with a
// slightly irregular margin. An orbit must not leave it on the chest wall.
function areolarWash(rgba:Uint8ClampedArray,depth:Float32Array,cam:Camera){
  const cy=middle(form)-.39*height(form),px=portraitY(0,0)-portraitY(1,0),cx=portraitX(cam,0,0);
  const top=Math.floor(portraitY(cy+.112,0)*RASTER_SCALE),base=Math.ceil(portraitY(cy-.112,0)*RASTER_SCALE);
  for(let iy=Math.max(0,top);iy<Math.min(RASTER_HEIGHT,base);iy++){
    const y=(portraitY(0,0)-iy/RASTER_SCALE)/px,dy=(y-cy)/.109;
    for(let ix=0;ix<RASTER_WIDTH;ix++){
      const i=iy*RASTER_WIDTH+ix,d=(depth[i]-.057*y)/(1+.057**2),h=(ix/RASTER_SCALE-cx)/px,z=-h*cam.s+d*cam.c;
      if(z<.58)continue;const x=h*cam.c+d*cam.s,dx=(Math.abs(x)-.532)/.14,r=Math.hypot(dx,dy);
      if(r>1.04)continue;const a=Math.atan2(dy,dx),edge=1-r+.022*Math.cos(7*a)+.012*Math.cos(11*a+1.8);
      const ink=Math.min(1,Math.max(0,5*edge))*(.59+.20*r),j=4*i;
      rgba[j]-=11*ink;rgba[j+1]-=32*ink;rgba[j+2]-=20*ink;
    }
  }
}
function lobularTile(c:Ink,side:Side){
  c.fillStyle='#edc197';c.fillRect(0,0,W,H);c.lineCap='round';
  for(let j=0;j<13;j++)for(let i=-1;i<10;i++){
    const x=i*22+(j%2)*10,y=j*19,a=4*Math.sin(i*4+j*7);c.beginPath();c.moveTo(x,y+a);c.quadraticCurveTo(x+10,y+a-5,x+22,y-a);
    c.moveTo(x,y+a);c.quadraticCurveTo(x+9,y+9,x+10,y+18-a);c.strokeStyle='#d5ac85';c.lineWidth=.8;c.stroke();
  }
  for(const [i,[u,v]] of clusters.entries()){
    const x=W*u,y=Y-R*v,end=Y+R*.30+(i%4-1.5)*1.4;
    c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+19,y-4,W*.76,end+(y-end)*.35,W+2,end);
    c.strokeStyle='#be7e76';c.lineWidth=4.0;c.stroke();c.strokeStyle='#f9dfbc';c.lineWidth=1.8;c.stroke();
  }
  for(const [i,[u,v]] of clusters.entries()){
    const x=W*u,y=Y-R*v;
    for(let j=0;j<7;j++){
      const a=j*Math.PI*2/7+.37*i+.13*side,dx=11*Math.cos(a),dy=7.3*Math.sin(a);
      c.beginPath();c.ellipse(x+dx,y+dy,6.8,4.8,a,0,Math.PI*2);c.fillStyle='#d89391';c.fill();
      c.strokeStyle='#b27479';c.lineWidth=.85;c.stroke();c.beginPath();c.ellipse(x+dx*.92,y+dy*.92,2.6,1.55,a,0,Math.PI*2);c.fillStyle='#f5c6ad';c.fill();
    }
  }
  for(const i of [0,1]){c.beginPath();for(let j=0;j<=70;j++){const s=j/70,x=W*s,y=Y-R*cutBounds(s)[i];if(!j)c.moveTo(x,y);else c.lineTo(x,y);}
    c.strokeStyle='#f6d5b4';c.lineWidth=6;c.stroke();c.strokeStyle='#c58780';c.lineWidth=1.3;c.stroke();}
  return c.getImageData(0,0,W,H);
}
export function createMammaryStudy(){
  let faces:Faces|undefined;
  return (render:ReturnType<typeof meshRenderer>,rgba:Uint8ClampedArray,depth:Float32Array,cam:Camera,section:boolean,tile:(w:number,h:number)=>Ink):Mark[]=>{
    if(section&&!faces){const c=tile(W,H),face=(side:Side)=>({cut:cutMap(form,side),tile:lobularTile(c,side)});faces=[face(1),face(-1)];}
    const outfit=figure();render(outfit[0][0],cam,outfit[0][1],0);
    paintTeardrop(rgba,depth,cam,form,form,0,0,section?faces!:null,'rounded');
    if(!section)areolarWash(rgba,depth,cam);
    for(const [mesh,flip] of outfit.slice(1))render(mesh,cam,flip,0);
    if(!section)return [];
    const cut=faces![cam.s<0?1:0].cut;
    return [{at:cut.point(.34,.33),zh:'腺小叶',en:'Lobules'},{at:cut.point(.83,-.28),zh:'乳管',en:'Milk duct'}];
  };
}

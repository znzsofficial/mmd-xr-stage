import {BufferGeometry,Float32BufferAttribute} from 'three';
import {paintedSurface} from '../sceneryPaint';

export type Panel={x:number;y:number;z:number;w:number;h:number;yaw:number};
type Ink=[number,number,number,number];
export type Glazing=Panel&{crop:Ink};
export type Print={w:number;h:number;paint:(g:CanvasRenderingContext2D)=>void};
export type PrintedPanel=Panel&{art:Print;from?:number;to?:number};

export function printMesh(panels:readonly Glazing[]){
  const pos:number[]=[],uv:number[]=[],index:number[]=[];
  for(const q of panels){
    const first=pos.length/3,c=Math.cos(q.yaw),s=Math.sin(q.yaw),[l,b,r,t]=q.crop;
    for(const [dx,dy] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){
      pos.push(q.x+dx*q.w*c,q.y+dy*q.h,q.z-dx*q.w*s);uv.push(dx<0?l:r,dy<0?b:t);
    }
    index.push(first,first+1,first+2,first,first+2,first+3);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

// Pack only what this room sees. One continuous shop display can occupy
// three separate windows without allocating three copies of the artwork.
export function streetPrint(panels:PrintedPanel[]){
  const prints=[...new Set(panels.map(p=>p.art))].sort((a,b)=>b.w-a.w||b.h-a.h);
  const width=Math.max(512,...prints.map(p=>p.w),prints.length>1?1024:0);
  const tiles=new Map<Print,{x:number;y:number}>();
  // All stock widths are multiples of one 128px clock face. Place broad
  // ribbons first, then fit the door guides and clock into the low columns.
  const unit=128,levels:number[]=Array(width/unit).fill(0);
  for(const art of prints){
    const cells=Math.ceil(art.w/unit);let start=0,lowest=Infinity;
    for(let i=0;i+cells<=levels.length;i++){
      const top=Math.max(...levels.slice(i,i+cells));
      if(top<lowest){lowest=top;start=i;}
    }
    tiles.set(art,{x:start*unit,y:lowest});levels.fill(lowest+art.h,start,start+cells);
  }
  const height=Math.max(1,...levels);
  const texture=paintedSurface(width,height,g=>{
    for(const [art,{x,y}] of tiles){
      g.save();g.translate(x,y);g.beginPath();g.rect(0,0,art.w,art.h);g.clip();art.paint(g);g.restore();
    }
  });
  const geometry=printMesh(panels.map(p=>{
    const {x,y}=tiles.get(p.art)!,{w,h}=p.art;
    const u=(fraction:number)=>(x+2+fraction*(w-4))/width;
    return {...p,crop:[u(p.from??0),1-(y+h-2)/height,u(p.to??1),1-(y+2)/height]};
  }));
  return {texture,geometry};
}

export function enamelLabel(p:Panel,title:string,sub:string,ground:string,guide=false):PrintedPanel{
  const h=guide?96:64,w=guide?256:512;
  return {...p,art:{w,h,paint(g){
    // Lay type in the board's physical aspect ratio. A long shop nameplate
    // should have room between the name and trade, not stretched Han glyphs.
    const span=h*p.w/p.h;
    g.scale(w/span,1);g.fillStyle=ground;g.fillRect(0,0,span,h);
    g.fillStyle='#d6c395';g.fillRect(6,5,span-12,2);g.fillRect(6,h-7,span-12,2);
    g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff1d2';
    if(guide){
      // Same route mast as the map: a line, two enamel stops, then the
      // destinations. Both faces are lettered in the approaching eye's frame.
      g.fillStyle='#d4b78c';g.fillRect(11,23,2,h-46);
      for(const y of [24,h-24]){g.beginPath();g.arc(12,y,4,0,Math.PI*2);g.fill();}
      g.fillStyle='#fff1d2';g.font='700 32px system-ui,sans-serif';g.fillText(title,(span+20)/2,h*.32,span-36);
      g.fillStyle='#f1dfb9';g.font='650 29px system-ui,sans-serif';g.fillText(sub,(span+20)/2,h*.73,span-36);
    }else if(span/h>9){
      const mid=span*.51;
      g.font='700 46px system-ui,sans-serif';g.fillText(title,mid/2,h*.51,mid-28);
      g.fillStyle='#c6ac81';g.fillRect(mid,h*.24,2,h*.52);
      g.fillStyle='#f2e0bc';g.font='650 25px system-ui,sans-serif';g.fillText(sub,(span+mid)/2,h*.52,span-mid-26);
    }else{
      g.font='700 34px system-ui,sans-serif';g.fillText(title,span/2,h*.34,span-18);
      g.fillStyle='#f1dfb9';g.font='650 16px system-ui,sans-serif';g.fillText(sub,span/2,h*.73,span-18);
    }
  }}};
}

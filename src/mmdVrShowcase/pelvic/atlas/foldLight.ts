import {fitSite,formColors,junctionColor,slitHalfLength,vulvaHalves,type CutBasis} from '../vulvaForm';

// The diagram exposes a reference cut. No measurement is inferred from it.
// Slice the SAME fitted sheets at constant anatomical Y before projection:
// a single flat gradient along the whole length streaks the turning folds.
export const studyCut:CutBasis={x:0,y:0,xx:1,xy:0,yx:0,yy:1-slitHalfLength};
const rgb=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
const skin=rgb(junctionColor),pigment=formColors.map(rgb),last=pigment.length-1;
const satinWeight=pigment.map((_,k)=>.22*Math.sin(Math.PI*k/last)**2*Math.max(0,(k-8)/7));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(v:number)=>Math.min(1,Math.max(0,v));

function makeColumns(cut:CutBasis){return vulvaHalves.map(({side,rows})=>{
  const points=rows.map(r=>r.sites.map(site=>fitSite(site,1,cut,{x:0,y:0,z:0})));
  const columns=pigment.map((color,k)=>points.map((row,j)=>{
    const p=row[k],l=row[Math.max(0,k-1)],r=row[Math.min(last,k+1)];
    const bottom=points[Math.max(0,j-1)][k],top=points[Math.min(rows.length-1,j+1)][k];
    const ax=r.x-l.x,ay=r.y-l.y,az=r.z-l.z,bx=top.x-bottom.x,by=top.y-bottom.y,bz=top.z-bottom.z;
    const nx=side*(ay*bz-az*by),ny=side*(az*bx-ax*bz),nz=side*(ax*by-ay*bx),inv=1/(Math.hypot(nx,ny,nz)||1);
    const site=rows[j].sites[k];
    const c=color.map((n,i)=>mix(n,skin[i],site.blend));
    return {x:p.x,y:p.y,z:p.z,nx:nx*inv,ny:ny*inv,nz:nz*inv,r:c[0],g:c[1],b:c[2],contact:site.contactShade,gloss:site.gloss};
  }));return {side,columns};
});}
type Knot=ReturnType<typeof makeColumns>[number]['columns'][number][number];
function cutAt(col:Knot[],y:number){
  let lo=0,hi=col.length-1;while(hi-lo>1){const mid=(hi+lo)>>1;if(col[mid].y<y)lo=mid;else hi=mid;}
  const a=col[lo],b=col[hi],t=clamp((y-a.y)/(b.y-a.y)||0);
  return {x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),nx:mix(a.nx,b.nx,t),ny:mix(a.ny,b.ny,t),nz:mix(a.nz,b.nz,t),
    r:mix(a.r,b.r,t),g:mix(a.g,b.g,t),b:mix(a.b,b.b,t),contact:mix(a.contact,b.contact,t),gloss:mix(a.gloss,b.gloss,t)};
}
type Cut=ReturnType<typeof cutAt>;
type Row={left:Cut[];right:Cut[];y:number;joined:boolean};
// Store only projection-independent sections, never a cache of rotated images.
const sectionsByCut=new WeakMap<CutBasis,Row[]>();
function sample(unit:number,oy:number,cut:CutBasis){const [left,right]=makeColumns(cut),result:Row[]=[];
  const lo=left.columns[0][0].y,hi=left.columns[0].at(-1)!.y;
  for(let py=Math.floor((oy-hi*unit)*2);py<Math.ceil((oy-lo*unit)*2);py++){
    const y=(oy-(py+.5)*.5)/unit;if(y<=lo||y>=hi)continue;
    const l=left.columns.map(c=>cutAt(c,y)),r=right.columns.map(c=>cutAt(c,y));
    result.push({y:py*.5,left:l,right:r,joined:Math.abs(l[0].x-r[0].x)<1e-6});
  }return result;
}

/** Orthographic transverse sections. Front-facing runs are already in pixel
 * order; project their depth for occlusion. Canvas interpolates the shaded
 * stops. No triangle raster, extra GL context, readback or ImageData upload. */
export function paintFoldLight(c:CanvasRenderingContext2D,yaw:number,ox:number,oy:number,unit:number,cut=studyCut){
  let sections=sectionsByCut.get(cut);if(!sections){sections=sample(unit,oy,cut);sectionsByCut.set(cut,sections);}
  const co=Math.cos(yaw),si=Math.sin(yaw);
  const xx=new Float64Array(2*(last+1)),depth=new Float64Array(xx.length),col:string[]=Array(xx.length);
  const stride=last+1,runs:{from:number;to:number;depth:number}[]=[];
  const byte=(x:number)=>Math.max(0,Math.min(255,Math.round(x)));
  for(const row of sections){runs.length=0;
    for(let h=0;h<2;h++){
      const points=h?row.right:row.left,base=h*stride,side=h?1:-1;let start=-1;
      for(let k=0;k<=last;k++){
        const p=points[k],i=base+k;
        xx[i]=ox+unit*(co*p.x+si*p.z);depth[i]=co*p.z-si*p.x;
        const u=co*p.nx+si*p.nz,v=p.ny,w=co*p.nz-si*p.nx;
        // A broad warm key, cherry-coloured bounced light and local contact
        // shadow. A turning pad retains reflected colour on its unlit side.
        const key=clamp((1.0-.58*u+.32*v+.75*w)*.5),light=.70+.297*key-.081*p.contact;
        const facing=clamp(w+.14),spec=Math.max(0,-.32*u+.17*v+.932*w);
        const sheen=satinWeight[k]*spec**7+p.gloss*facing*(.30+.68*spec**9);
        col[i]=`rgb(${byte(mix(p.r*light+9*(1-key),255,sheen))},${byte(mix(p.g*light-8*(1-key)-5*p.contact,225,sheen))},${byte(mix(p.b*light+2*(1-key),229,sheen))})`;
        if(k){const visible=(xx[i]-xx[i-1])*side>1e-6;if(visible&&start<0)start=i-1;
          if(start>=0&&(!visible||k===last)){const end=visible?i:i-1;runs.push({from:h?start:end,to:h?end:start,depth:depth[(start+end)>>1]});start=-1;}}
      }
    }
    runs.sort((a,b)=>a.depth-b.depth);
    for(const {from,to} of runs){const x0=xx[from],x1=xx[to],width=x1-x0;if(width<.015)continue;
      const shade=c.createLinearGradient(x0,0,x1,0),step=from<to?1:-1;
      for(let i=from;;i+=step){shade.addColorStop(clamp((xx[i]-x0)/width),col[i]);if(i===to)break;}
      // Adjacent halves share one medial edge outside the cut. Antialiasing
      // two fractional spans independently would leave a black dotted seam.
      const left=row.joined&&from%stride===0?.47:0,right=row.joined&&to%stride===0?.47:0;
      c.fillStyle=shade;c.fillRect(x0-left,row.y,width+left+right,.5);
    }
  }
}

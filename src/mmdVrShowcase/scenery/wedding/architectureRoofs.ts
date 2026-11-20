import {A, Skin, type V} from './architectureMesh';

type Roof = {x:number; z:number; hw:number; hd:number; eave:number; rise:number; hip?:number; lift?:number; turn?:boolean; detail?:boolean; soffit?:boolean};
type Corners=[V,V,V,V];

/** Both pitches are curved in section. The gate has four pitched faces; the
 * main hall is a suspended gable roof with an exposed timber underside. */
export function tiledRoof(g:Skin,p:Roof){
  const {x,z,hw,hd,eave,rise,hip=0,lift=.21,turn=false,detail=true,soffit=true}=p;
  const ridge=hw-hip,depth=detail?.105:.08;
  const world=(u:number,y:number,v:number):V=>turn?[x-v,y,z+u]:[x+u,y,z+v];
  const peak=(s:number,t:number)=>eave+rise*(.35*t+.65*t*t)+lift*Math.pow(Math.abs(s),5.5)*(1-t)**2;
  for(const end of hip>0?[false,true]:[false])for(const dir of [-1,1]){
    const at=(s:number,t:number):V=>world(end?dir*(hw-hip*t):s*(hw-hip*t),peak(s,t),end?s*hd*(1-t):dir*hd*(1-t));
    const nx=Math.max(2,Math.round(2*(end?hd:hw)/1.28)),nz=detail?Math.max(2,Math.round(hd/1.08)):2;
    const below=(q:V):V=>[q[0],q[1]-depth,q[2]];
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const l=i/nx*2-1,r=(i+1)/nx*2-1,b=j/nz,t=(j+1)/nz;
      const corners:Corners=[at(l,b),at(r,b),at(r,t),at(l,t)];
      if((!end&&dir<0)||(end&&dir>0))corners.reverse();
      const uv:[[number,number],[number,number],[number,number],[number,number]]=[[0,0],[1,0],[1,1],[0,1]];
      if((!end&&dir<0)||(end&&dir>0))uv.reverse();
      g.face(corners,A.tile,'#ffffff',uv);
      if(soffit)g.face(corners.map(below).reverse() as Corners,A.boards,'#c3b7a7');
      if(j===0)g.beam(below(at(l,0)),below(at(r,0)),depth*1.02,.1,A.wood,'#b9aaa0');
    }
    // Projecting quarter-round cover tiles and their pressed clay lotus ends.
    // The rows line up with the eight rolls in each albedo repeat.
    if(detail){
      const n=nx*8,rad=Math.min(.075,(end?hd:hw)/n*.81);
      const center=(s:number)=>{const a=at(s,0);a[1]+=.002;return a;};
      const lateral:V=turn?(end?[-1,0,0]:[0,0,1]):end?[0,0,1]:[1,0,0];
      const outward:V=turn?(end?[0,0,dir]:[-dir,0,0]):end?[dir,0,0]:[0,0,dir];
      const sign=(lateral[2]*outward[0]-lateral[0]*outward[2])<0?1:-1;
      for(let i=0;i<=n;i++){
        const c=center(-1+2*i/n),arc=(a:number,inset:number):V=>[c[0]+rad*Math.cos(a)*lateral[0]*sign+outward[0]*inset,
          c[1]+rad*Math.sin(a)-inset*.12,c[2]+rad*Math.cos(a)*lateral[2]*sign+outward[2]*inset];
        const steps=6, uv=(a:number):[number,number]=>[.50+.49*Math.cos(a),.50+.49*Math.sin(a)];
        for(let k=0;k<steps;k++){
          const a=k*Math.PI*2/steps+Math.PI/6,b=(k+1)*Math.PI*2/steps+Math.PI/6;
          const l=arc(a,.095),r=arc(b,.095),mid:V=[c[0]+outward[0]*.095,c[1]-.0114,c[2]+outward[2]*.095];
          g.face([mid,l,r,mid],A.lotus,'#ffffff',[[.5,.5],uv(a),uv(b),[.5,.5]]);
          g.face([r,l,arc(a,-.075),arc(b,-.075)],A.plain,'#5d6667');
        }
      }
    }
    if(hip>0&&!end)for(const s of [-1,1])for(let j=0;j<nz;j++){
      const a=at(s,j/nz),b=at(s,(j+1)/nz);a[1]+=.055;b[1]+=.055;g.beam(a,b,.12,.12,A.granite,'#888d8c');
    }
    if(!end&&!hip)for(const s of [-1,1])for(let j=0;j<nz;j++){
      const a=at(s,j/nz),b=at(s,(j+1)/nz);g.beam(a,b,.15,.14,A.granite,'#8d908d');
    }
  }
  g.beam(world(-ridge-.06,eave+rise+.07,0),world(ridge+.06,eave+rise+.07,0),.19,.17,A.granite,'#8a8e88');
  if(detail)for(const s of [-1,1]){
    const end=Math.min(.32,hw*.13);
    const a=world(s*(ridge-.14),eave+rise+.10,0),b=world(s*(ridge+.04),eave+rise+.14,0),c=world(s*(ridge+end),eave+rise+.25,0);
    g.beam(a,b,.16,.17,A.granite,'#93958d');g.beam(b,c,.115,.14,A.granite,'#93958d');
  }
}

/** Stepped limewashed fire gable, with a masonry thickness and coping on each
 * tread. The wall continues through to the ridge, never a floating silhouette. */
export function fireGable(g:Skin,x:number,cz:number,half:number,base:number,eave:number,rise:number,w:number){
  const tiers=[{edge:1,h:eave+.11},{edge:.74,h:eave+.45*rise},{edge:.40,h:eave+.83*rise},{edge:.18,h:eave+rise+.23}];
  let lo=base;
  for(const t of tiers){
    if(t.h>lo)g.block(x,(lo+t.h)/2,cz,w,t.h-lo,2*half*t.edge,A.lime,'#e9e8dc',1.4,1.1);
    g.block(x,t.h+.021,cz,w+.065,.065,2*half*t.edge+.085,A.brick,'#a0a8a3',1.3,.65);
    g.block(x,t.h+.081,cz,w+.115,.055,2*half*t.edge+.12,A.granite,'#919894');lo=t.h+.065;
  }
}

import {A,Skin,type V} from './architectureMesh';
import {Frame} from './architectureJoinery';
import {fireGable,tiledRoof} from './architectureRoofs';
import {WEDDING_FLOORS} from './weddingLayout';

// The camera can orbit outside the furnished footprint. The next lane and
// roofs are scenery, not placeable extensions. Every street elevation has a
// closed rear, gable returns and a covered footing. No distant scene mount.
export function surroundingLane(groups:{horizon:Skin;laneSouth:Skin;laneWest:Skin;laneEast:Skin;laneNorth:Skin;leafWest:Skin;leafSouth:Skin}){
  const g=groups.horizon;
  const lane=WEDDING_FLOORS.lane,far=lane.z+lane.d/2;
  g.block(0,-.125,0,260,.18,260,A.plain,'#b9c1af');
  g.surface([-33,-.018,far+.75],[33,-.018,far+.75],[33,-.018,far-lane.d-.58],[-33,-.018,far-lane.d-.58],A.paving,'#d3d1c0',1.95,1.68);

  function house(x:number,z:number,w:number,d:number,h:number,sign:number,kind:number,near=false){
    const g=z>far?groups.laneSouth:z<-10?groups.laneNorth:x<0?groups.laneWest:groups.laneEast;
    const f=new Frame(g,x,z),hd=d/2+.35,hw=w/2+.31,e=h+.12,rise=.25*d+.04;
    f.box(0,.18,0,w,.45,d,A.brick,'#bfc3b7',1.22,.86);
    f.box(0,(.385+h)/2,0,w,h-.385,d,A.lime,['#e4e1d3','#f2efdd','#dfddce'][kind%3],1.61,1.40);
    // Top of the wall at each long side meets the pitch under its overhang.
    f.box(0,h+.072,0,w,.144,d,A.wood,'#a39480');
    for(const side of [-1,1]){
      const xx=x+side*(w/2-.04);
      if(near||kind%2===0)fireGable(g,xx,z,d/2+.10,h-.042,e+.14,rise,.19);
      else{
        const pf=new Frame(g,xx,z,true);
        for(let j=0;j<6;j++){
          const a=d*(j/6-.5),b=d*((j+1)/6-.5),peak=(u:number)=>{const t=1-Math.abs(u)/hd;return e+rise*(.35*t+.65*t*t);};
          const q:[V,V,V,V]=[pf.at(a,h,side*.064),pf.at(b,h,side*.064),pf.at(b,peak(b),side*.064),pf.at(a,peak(a),side*.064)];if(side<0)q.reverse();g.face(q,A.lime,'#e3e1d2');
        }
      }
    }
    tiledRoof(g,{x,z,hw,hd,eave:e,rise,lift:near?.10:.04,detail:false,soffit:true});
    for(const s of near?[sign,-sign]:[sign]){
      const dep=s*d/2;
      for(const side of [-1,1]){
        const u=side*w*.294,ww=Math.min(1.40,w*.24),high=Math.min(1.27,h*.36),bottom=.94;
        f.box(u,bottom+high/2,dep+s*.016,ww,high,.052,A.wood,'#948372');
        f.panel(u,bottom+.055,dep+s*.046,ww-.105,high-.105,s,A.paper,'#d2c9b0');
        for(const xx of [-.29,0,.29])f.box(u+xx*ww,bottom+high/2,dep+s*.060,.035,high-.06,.028,A.wood,'#a28e77');
        for(const t of [.22,.72,.80])f.box(u,bottom+high*t,dep+s*.059,ww-.07,.032,.026,A.wood,'#a28e77');
        f.box(u,bottom-.017,dep+s*.02,ww+.12,.075,.14,A.granite,'#c1c3b6');
      }
      if(near){
        const ww=Math.min(1.23,w*.23),height=Math.min(2.16,h*.81),facing=dep+s*.051;
        f.box(0,height/2,dep+s*.012,ww+.13,height+.10,.062,A.granite,'#a8a697');
        for(const a of [-1,1]){f.panel(a*ww/4,.014,facing,ww*.49,height,s,A.lacquer,'#c3a793');f.box(a*.091,height*.49,facing+s*.006,.028,.087,.037,A.granite,'#817f6b');}
        f.box(0,.012,dep+s*.12,ww+.23,.066,.28,A.granite,'#aaa99d');
        f.box(0,height+.095,dep+s*.038,ww+.27,.124,.145,A.granite,'#c1bca8');
        // Small tiled rain eyebrow directly on the lintel of the closed house.
        const q:[V,V,V,V]=[f.at(-ww*.68,height+.135,dep+s*.27),f.at(ww*.68,height+.135,dep+s*.27),f.at(ww*.68,height+.259,dep),f.at(-ww*.68,height+.259,dep)];if(s<0)q.reverse();g.face(q,A.tile);
      }
    }
  }

  // A bend in the lane at either end; opposite facades are slightly staggered
  // and of different heights, rather than a flat row facing the camera.
  house(-7.0,far+2.96,6.90,4.36,2.70,-1,0,true);
  house(-.47,far+3.54,5.65,5.1,3.01,-1,1,true);
  house(6.83,far+3.51,6.40,4.68,2.82,-1,2,true);
  house(-14.5,far+4.14,7.18,5.36,3.53,-1,1);
  house(14.92,far+3.47,7.11,4.27,3.37,-1,0);
  house(-10.8,2.50,7.5,5.35,2.96,1,2);house(12.31,2.47,7.78,5.80,3.29,1,1);
  house(-12.64,-5.28,6.46,5.52,3.71,1,0);house(16.23,-5.89,7.17,5.68,3.02,1,2);
  house(-3.36,-13.92,7.85,4.6,2.93,1,2);house(4.79,-14.38,7.24,4.8,3.60,1,0);
  house(-15.92,lane.z+.19,5.52,5.38,3.71,-1,2); // end of the lane turns behind its gable
  for(const [x,z,w,d] of [[-6.54,-1.08,1.24,14.88],[7.33,-8.85,9.37,1.24],[10.74,-4.97,1.59,7.09]])
    g.surface([x-w/2,-.025,z+d/2],[x+w/2,-.025,z+d/2],[x+w/2,-.025,z-d/2],[x-w/2,-.025,z-d/2],A.paving,'#bdc1b4',1.97,1.74);

  let seed=1274;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  // Old osmanthus outside the wall. Every printed spray grows on a real fork;
  // a shallow midrib fold breaks up the outline from above and on the reverse.
  function tree(x:number,z:number,h:number){
    const g=x<0?groups.laneWest:groups.laneSouth,leaves=x<0?groups.leafWest:groups.leafSouth;
    const root:V=[x,-.06,z],mid:V=[x+.24,h*.50,z-.12],fork:V=[x+.07,h*.74,z+.17];
    g.beam(root,mid,.26,.23,A.wood,'#897c68');g.beam(mid,fork,.18,.14,A.wood,'#938670');
    for(let j=0;j<16;j++){
      const a=j*2.39996,rad=.95+rnd()*.86;
      const tip:V=[x+Math.cos(a)*rad,h*(.81+rnd()*.23),z+Math.sin(a)*rad],knuckle:V=[x+Math.cos(a)*rad*.58,h*(.7+rnd()*.16),z+Math.sin(a)*rad*.58];
      const start=j%3?fork:mid;g.beam(start,knuckle,.085,.073,A.wood,'#948873');g.beam(knuckle,tip,.041,.037,A.wood,'#9b8d73');
      for(let k=0;k<11;k++){
        const b=rnd()*Math.PI*2,dx=Math.cos(b),dz=Math.sin(b),ll=.55+rnd()*.54,ww=.47+rnd()*.25,up=.30+rnd()*.36;
        const p=(u:number,v:number):V=>[tip[0]+dx*ll*v+dz*ww*(u-.5),tip[1]+v*up-.16*Math.abs(u-.5),tip[2]+dz*ll*v-dx*ww*(u-.5)];
        const c=['#dedfcb','#e8e7cd','#f1eed7'][k%3];
        for(let i=0;i<2;i++){const a=i/2,t=(i+1)/2;leaves.face([p(a,0),p(t,0),p(t,1),p(a,1)],0,c,[[a,0],[t,0],[t,1],[a,1]]);}
      }
    }
  }
  tree(-6.82,-.47,4.76);tree(2.94,far+2.94,4.72);
}

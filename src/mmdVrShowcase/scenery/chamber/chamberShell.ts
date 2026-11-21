import {CELL,HALL as H,PORTAL as P,RIBS,WEST,NORTH,LEAF} from './chamberLayout';
import {Masonry,type V} from './masonry';
import {towerViews} from './outsideTower';

const sand=['#c2b89e','#ada48d','#c9bca4','#b8b09d','#cfc1a8'];
// A single cut edge for backing, reveal and coloured stones. Mortar is a change
// of stone colour; a second solid of the same radius mustn't fill the opening.
function arch(m:Masonry,x:number,z:number,spring:number,r:number,rise:number,dr:number,dy:number,d:number,n:number,wall?:{depth:number;cap:number}|'raised'){
  for(let i=0;i<n;i++){
    const p=(k:number,ext:boolean,off:number):V=>{const a=k*Math.PI/n;return [x+Math.cos(a)*(r+(ext?dr:0)),spring+Math.sin(a)*(rise+(ext?dy:0)),z+off];};
    const col=sand[(i*7)%sand.length];
    m.face('toolstone',[p(i,false,-d/2),p(i+1,false,-d/2),p(i+1,false,d/2),p(i,false,d/2)],col,'xz');
    for(const s of [-1,1]){
      const off=s*d/2,a=p(i,true,off),b=p(i+1,true,off);
      m.face('toolstone',[p(i,false,off),p(i+1,false,off),b,a],col,'xy');
      if(wall==='raised'&&s===-1)m.face('toolstone',[a,b,p(i+1,true,d/2),p(i,true,d/2)],col,'xz');
      else if(wall&&wall!=='raised'){const v=p(i,true,s*wall.depth/2),w=p(i+1,true,s*wall.depth/2);
        m.face('toolstone',[a,b,w,v],col,'xz');
        m.face('ashlar',[w,v,[v[0],wall.cap,v[2]],[w[0],wall.cap,w[2]]],'#b2a998','xy');}
    }
  }
}

function westLight(m:Masonry){
  const {z,w,b,t,x}=WEST;
  const outer=w+.28;
  for(const [n,s] of [[H.back,z-outer/2],[z+outer/2,H.front]])m.box('ashlar',x-.12,H.spring/2,(n+s)/2,.24,H.spring,s-n,'#bdbbb3');
  m.box('ashlar',x-.12,(b-.14)/2,z,.24,b-.14,outer,'#bdbbb3');
  m.box('toolstone',x-.035,b-.07,z,.49,.14,outer,'#d2c9b1');
  m.box('toolstone',x-.095,(t+H.spring)/2,z,.40,H.spring-t,outer,'#babbaa');
  for(const s of [-1,1])m.box('toolstone',x-.10,(t+b)/2,z+s*(w/2+.07),.38,t-b,.14,'#bdbbaa');
  for(const off of [-w/2+.038,w/2-.038])m.box('oak',x-.23,(t+b)/2,z+off,.10,t-b,.076,'#775649');
  m.box('toolstone',x-.12,(t+b)/2,z,.22,t-b,.082,'#c6bdad');
  for(const s of [-1,1])m.box('iron',x-.21,t-.20,z+s*(w/4-.0175),.034,.04,w/2-.117,'#3f4854');
}

function holdingBay(m:Masonry){
  const {x,z,w,depth,top}=CELL;
  for(const [n,s] of [[H.back,z-w/2],[z+w/2,H.front]])m.box('ashlar',x+.12,H.spring/2,(n+s)/2,.24,H.spring,s-n,'#b0a99c');
  m.box('toolstone',x+.13,(H.spring+top)/2,z,.36,H.spring-top,w,'#b4af9c');
  const end=depth-.115;
  m.box('ashlar',x+depth,top/2,z,.23,top,w+.28,'#808785');
  for(const side of [-1,1])m.box('ashlar',x+(.24+end)/2,top/2,z+side*(w/2+.07),end-.24,top,.14,'#9f9e90',['west','east']);
  m.box('toolstone',x+end/2,-.045,z,end,.09,w,'#969584');
  m.box('toolstone',x+(.31+end)/2,top+.06,z,end-.31,.12,w,'#959b93');
  m.box('oak',x+depth-.31,.395,z,.40,.08,1.51,'#8a7153');
  for(const s of [-.55,.55])m.box('toolstone',x+depth-.31,.18,z+s,.34,.36,.21,'#928a78');
  for(let i=0;i<10;i++)m.box('iron',x+.085,top/2,z-w/2+.095+i*(w-.19)/9,.041,top,.045,'#585950');
  for(const y of [.19,1.04,1.92])m.box('iron',x+.0445,y,z,.04,.071,w,'#545750');
}

function backWall(m:Masonry){
  const {x,w,b,spring,z,dr}=NORTH,outer=w+2*dr;
  for(const [l,r] of [[-H.half,x-outer/2],[x+outer/2,H.half]])m.box('ashlar',(l+r)/2,2.15,z,r-l,4.3,.33,'#bfb9ab');
  m.box('ashlar',x,(b-.12)/2,z,outer,b-.12,.33,'#bfb9ab');m.box('toolstone',x,b-.06,z,outer,.12,.43,'#d4c9b7');
  for(const s of [-1,1])m.box('toolstone',x+s*(w+dr)/2,(b+spring)/2,z,dr,spring-b,.43,'#adaea4');
  arch(m,x,z,spring,w/2,.57,dr,.14,.43,16,{depth:.33,cap:4.3});
  for(const off of [-.35,.33]){const t=spring+.57*Math.sqrt(1-(off/(w/2))**2);m.box('iron',x+off,(b+t)/2,z-.10,.036,t-b,.046,'#3f4852');}
  m.box('iron',x,b+1.19,z-.059,w,.035,.036,'#555964');
}

function passage(m:Masonry){
  const cap=4.30,{x,r,rise,spring,z,depth}=P;
  const dr=.24;
  for(const [l,u] of [[-H.half,x-r-dr],[x+r+dr,H.half]])m.box('ashlar',(l+u)/2,cap/2,z,u-l,cap,depth-.13,'#b2a998');
  for(const s of [-1,1])for(let i=0;i<5;i++){
    m.box('toolstone',x+s*(r+dr/2),spring*(i+.5)/5,z,dr,spring/5,depth,sand[(i+(s+1))%5]);
  }
  arch(m,x,z,spring,r,rise,dr,.265,depth,24,{depth:depth-.13,cap});
  // Directional chapter tablets, printed on the faces looking INTO the arriving room.
  for(const side of [-1,1]){
    const xx=x-2.46,zz=z+side*(depth/2-.024),w=1.20,lo=1.30,hi=1.72;
    m.box('oak',xx,(lo+hi)/2,zz,w+.09,hi-lo+.095,.07,'#78623e',[side===1?'south':'north']);
    const face=zz+side*.035;
    // The centre of the plaque is the print itself, not a second plate 2 mm over oak.
    const edge=(l:number,r:number,b:number,t:number)=>m.face('oak',[[xx+l,b,face],[xx+r,b,face],[xx+r,t,face],[xx+l,t,face]],'#78623e','xy');
    const W=(w+.09)/2;edge(-W,W,lo-.0475,lo);edge(-W,W,hi,hi+.0475);edge(-W,-w/2,lo,hi);edge(w/2,W,lo,hi);
    m.quad('tablets',[[xx-side*w/2,lo,face],[xx+side*w/2,lo,face],[xx+side*w/2,hi,face],[xx-side*w/2,hi,face]],'#fff8df',side>0?[[0,.5],[1,.5],[1,1],[0,1]]:[[0,0],[1,0],[1,.5],[0,.5]]);
  }
}

export function chamberShell(m:Masonry){
  const {half,front,back,spring,rise}=H;
  m.quad('pavement',[[-half,0,front],[half,0,front],[half,0,back],[-half,0,back]],'#f1e9db');
  westLight(m);holdingBay(m);backWall(m);passage(m);towerViews(m);
  m.box('ashlar',0,2.15,front+.12,half*2,4.3,.24,'#bfb7a4');
  // Interrupt the barrel at each rib, rather than pushing a second barrel
  // through it. Both use the same angular subdivisions and meet edge-to-edge.
  const n=32,spans=[...RIBS.map(z=>[z-.15,z+.15]),[P.z-(P.depth-.13)/2,P.z+(P.depth-.13)/2]].sort((a,b)=>a[0]-b[0]);
  let lo=back;
  for(const [hi,next] of [...spans,[front,front]]){
    for(let i=0;i<n;i++){
      const point=(k:number,z:number):V=>{const a=k*Math.PI/n;return [half*Math.cos(a),spring+rise*Math.sin(a),z];};
      const u=i/n*2.8,v=(i+1)/n*2.8,l=(lo-back)/(front-back)*5.63,h=(hi-back)/(front-back)*5.63;
      m.quad('ashlar',[point(i,lo),point(i+1,lo),point(i+1,hi),point(i,hi)],'#a9a397',[[u,l],[v,l],[v,h],[u,h]]);
    }lo=next;
  }
  for(const z of RIBS){
    arch(m,0,z,spring,half-.21,rise-.14,.21,.14,.30,n);
    for(const side of [-1,1]){
      const rear=side===1&&Math.abs(z-CELL.z)<CELL.w/2?[]:side===1?['east'] as const:['west'] as const;
      for(let i=0;i<7;i++)m.box('toolstone',side*(half-.098),.20+(i+.5)*.295,z,.196,.295,.31,sand[(i+2)%5],[...rear,'base','top']);
      for(const [b,t,w,d] of [[0,.2,.27,.42],[2.265,2.37,.24,.36],[2.37,2.50,.27,.42]])m.box('toolstone',side*(half-w/2),(b+t)/2,z,w,t-b,d,'#baaf99',rear);
    }
  }
  // Closed entry leaf. Its visible planks fill the reveal without buried edges
  // on the pavement or doubled surfaces up against the intrados.
  const {x,z,r}=LEAF;
  for(let i=0;i<14;i++){
    const a=i*Math.PI/14,b=(i+1)*Math.PI/14,l=x+r*Math.cos(b),u=x+r*Math.cos(a);
    const front=z-.046;
    m.face('oak',[[u,0,front],[l,0,front],[l,1.48+.61*Math.sin(b),front],[u,1.48+.61*Math.sin(a),front]],i%3?'#82674e':'#927458','xy');
  }
  for(const y of [.31,1.32])m.box('iron',x,y,z-.056,1.47,.076,.037,'#615e52');
  for(const s of [-1,1])m.box('toolstone',x+s*(r+.088),.74,z,.176,1.48,.27,'#baaf98');
  arch(m,x,z,1.48,r,.61,.176,.16,.27,14,'raised');
}

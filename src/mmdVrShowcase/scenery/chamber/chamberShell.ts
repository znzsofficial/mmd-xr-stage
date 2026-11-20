import {CELL,HALL as H,PORTAL as P,RIBS} from './chamberLayout';
import {Masonry,type V} from './masonry';

const sand=['#c2b89e','#ada48d','#c9bca4','#b8b09d','#cfc1a8'];
function voussoirs(m:Masonry,x:number,z:number,spring:number,r:number,rise:number,dr:number,dy:number,d:number,n:number){
  for(let i=0;i<n;i++){
    const t=(i+.025)*Math.PI/n,u=(i+.975)*Math.PI/n,keystone=i===Math.floor(n/2)?1.15:1;
    const point=(a:number,ext:boolean):[number,number]=>[x+Math.cos(a)*(r+(ext?dr:0)),spring+Math.sin(a)*(rise+(ext?dy*keystone:0))];
    m.stone([point(t,false),point(t,true),point(u,true),point(u,false)],z,d*(i===Math.floor(n/2)?1.06:1),sand[(i*7)%sand.length]);
  }
}

function westLight(m:Masonry){
  const z=1.41,w=1.12,b=1.38,t=2.32,x=-H.half;
  for(const [n,s] of [[H.back,z-w/2],[z+w/2,H.front]])m.box('ashlar',x-.12,H.spring/2,(n+s)/2,.24,H.spring,s-n,'#bdbbb3');
  for(const [lo,hi] of [[-.01,b],[t,H.spring]])m.box('ashlar',x-.12,(lo+hi)/2,z,.24,hi-lo,w,'#bdbbb3');
  m.box('toolstone',x-.04,b-.045,z,.34,.09,w+.2,'#d2c9b1');
  m.quad('window',[[x-.25,b,z+w/2],[x-.25,b,z-w/2],[x-.25,t,z-w/2],[x-.25,t,z+w/2]],'#eff6f5');
  for(let i=1;i<=3;i++)m.box('iron',x-.20,(t+b)/2,z-w/2+i*w/4,.045,t-b,.037,'#393e3e');
  m.box('iron',x-.22,b+.58,z,.035,.032,w,'#3f4544');
}

function holdingBay(m:Masonry){
  const {x,z,w,depth,top}=CELL;
  for(const [n,s] of [[H.back,z-w/2],[z+w/2,H.front]])m.box('ashlar',x+.12,H.spring/2,(n+s)/2,.24,H.spring,s-n,'#b0a99c');
  m.box('toolstone',x+.13,(H.spring+top)/2,z,.36,H.spring-top,w+.11,'#b4af9c');
  m.box('ashlar',x+depth,top/2,z,.23,top,w+.24,'#808785');
  for(const side of [-1,1])m.box('ashlar',x+depth/2,top/2,z+side*(w/2+.07),depth,top,.14,'#9f9e90');
  m.box('toolstone',x+depth/2,-.045,z,depth,.09,w,'#969584');m.box('toolstone',x+depth/2,top+.06,z,depth,.12,w,'#959b93');
  m.box('oak',x+depth-.31,.395,z,.40,.08,1.51,'#8a7153');
  for(const s of [-.55,.55])m.box('toolstone',x+depth-.31,.18,z+s,.34,.36,.21,'#928a78');
  for(let i=0;i<10;i++)m.box('iron',x+.085,top/2,z-w/2+.095+i*(w-.19)/9,.041,top,.045,'#585950');
  for(const y of [.19,1.04,1.92])m.box('iron',x+.057,y,z,.064,.071,w,'#545750');
}

function backWall(m:Masonry){
  const x=1.99,w=.73,b=1.52,t=2.94,z=H.back;
  for(const [l,r] of [[-H.half,x-w/2],[x+w/2,H.half]])m.box('ashlar',(l+r)/2,2.15,z-.13,r-l,4.3,.26,'#bfb9ab');
  for(const [lo,hi] of [[0,b],[t,4.3]])m.box('ashlar',x,(hi+lo)/2,z-.13,w,hi-lo,.26,'#bfb9ab');
  m.quad('window',[[x-w/2,b,z-.27],[x+w/2,b,z-.27],[x+w/2,t,z-.27],[x-w/2,t,z-.27]],'#edf6ff');
  m.box('toolstone',x,b-.05,z+.03,w+.20,.10,.32,'#d4c9b7');
  for(const off of [-.15,.13])m.box('iron',x+off,(b+t)/2,z-.195,.042,t-b,.046,'#3f4844');
  for(const off of [.51,1.08])m.box('iron',x,b+off,z-.21,w,.03,.04,'#535749');
}

function passage(m:Masonry){
  const cap=4.30,{x,r,rise,spring,z,depth}=P;
  for(const [l,u] of [[-H.half,x-r],[x+r,H.half]])m.box('ashlar',(l+u)/2,cap/2,z,u-l,cap,depth-.13,'#b2a998');
  for(let i=0;i<24;i++){
    const a=(i+1)*Math.PI/24,b=i*Math.PI/24,l=x+r*Math.cos(a),u=x+r*Math.cos(b);
    m.stone([[l,spring+rise*Math.sin(a)],[u,spring+rise*Math.sin(b)],[u,cap],[l,cap]],z,depth-.13,'#b2a998','ashlar');
  }
  for(const s of [-1,1])for(let i=0;i<5;i++){
    const w=i===4?.27:.225;
    m.box('toolstone',x+s*(r+w/2),spring*(i+.5)/5,z,w,spring/5-.009,depth,sand[(i+(s+1))%5]);
  }
  voussoirs(m,x,z,spring,r,rise,.24,.265,depth,15);
  // Directional chapter tablets, printed on the faces looking INTO the arriving room.
  for(const side of [-1,1]){
    const xx=x-2.46,zz=z+side*(depth/2-.024),w=1.20,lo=1.30,hi=1.72;
    m.box('oak',xx,(lo+hi)/2,zz,w+.09,hi-lo+.095,.07,'#78623e');
    const face=zz+side*.037;
    m.quad('tablets',[[xx-side*w/2,lo,face],[xx+side*w/2,lo,face],[xx+side*w/2,hi,face],[xx-side*w/2,hi,face]],'#fff8df',side>0?[[0,.5],[1,.5],[1,1],[0,1]]:[[0,0],[1,0],[1,.5],[0,.5]]);
  }
}

export function chamberShell(m:Masonry){
  const {half,front,back,spring,rise}=H;
  m.quad('pavement',[[-half,0,front],[half,0,front],[half,0,back],[-half,0,back]],'#f1e9db');
  westLight(m);holdingBay(m);backWall(m);passage(m);
  m.box('ashlar',0,2.15,front+.12,half*2,4.3,.24,'#bfb7a4');
  // Continuous barrel soffit, split into strips with metre-scaled curved UVs.
  const n=36;
  for(let i=0;i<n;i++){
    const point=(k:number,z:number):V=>{const a=k*Math.PI/n;return [half*Math.cos(a),spring+rise*Math.sin(a),z];};
    const u=i/n*2.8,v=(i+1)/n*2.8;
    m.quad('ashlar',[point(i,back),point(i+1,back),point(i+1,front),point(i,front)],'#a9a397',[[u,0],[v,0],[v,5.63],[u,5.63]]);
  }
  for(const z of RIBS){
    voussoirs(m,0,z,spring,half-.21,rise-.14,.235,.18,.30,21);
    for(const side of [-1,1]){
      for(let i=0;i<7;i++)m.box('toolstone',side*(half-.092),.19+(i+.5)*.30,z,.20,.29,.31,sand[(i+2)%5]);
      for(const [y,h,w,d] of [[.10,.2,.27,.42],[2.32,.11,.25,.40],[2.43,.14,.27,.42]])m.box('toolstone',side*(half-w/2),y,z,w,h,d,'#baaf99');
    }
  }
  // Closed entry leaf visible on the reverse crossing; thick boards follow the arch profile.
  const x=.76,z=front-.05,r=.78;
  for(let i=0;i<11;i++){
    const dx=((i+.5)/11-.5)*r*2,ht=1.48+.61*Math.sqrt(1-(dx/r)**2);
    m.box('oak',x+dx,ht/2,z,r*2/11-.006,ht,.092,i%3?'#82674e':'#927458');
  }
  for(const y of [.31,1.32])m.box('iron',x,y,z-.056,1.47,.076,.037,'#615e52');
  for(const s of [-1,1])m.box('toolstone',x+s*(r+.088),.74,z,.176,1.48,.27,'#baaf98');
  voussoirs(m,x,z,1.48,r,.61,.177,.16,.27,13);
}

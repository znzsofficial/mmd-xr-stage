import {BENCH,DAIS,DESK,HALL,PRESS,READERS,STOOL} from './chamberLayout';
import {Masonry,type V} from './masonry';
import {ironEffigy} from './ironEffigy';
import {galleryModels} from './galleryModels';

const heart='#98775b',edge='#b4946a',rail='#6d5341',brass='#b49860';
function candle(m:Masonry,x:number,y:number,z:number,scale:number){
  const turned=(profile:[number,number][])=>profile.map(([h,r]):[number,number]=>[y+h*scale,r*scale]);
  m.spindle('iron',x,z,turned([[0,0],[0,.094],[.024,.092],[.038,.052],[.083,.025],[.14,.027],[.15,.067],[.167,.072],[.16,.033]]),brass,14);
  m.spindle('pigment',x,z,turned([[.16,.033],[.29,.032],[.30,.025],[.294,0]]),'#ecd4a2');
  m.spindle('light',x,z,turned([[.297,0],[.31,.014],[.325,.018],[.345,.012],[.379,0]]),'#ffc87c',8);
}

function ledger(m:Masonry){
  const x=DESK.x+.02,z=DESK.z,w=.67,d=.43,base=DESK.hi;
  m.box('pigment',x,base+.014,z,w+.04,.028,d+.034,'#5f3d30');
  // Two signatures meet in a gutter; shape the page block, exposed fore edge and the painted opening together.
  const page=(u:number,v:number):V=>{const q=(2*u)%1,s=u===1?1:q;return [x+(u-.5)*w,base+.041+Math.sin(s*Math.PI)**.78*.038,z+(.5-v)*d];};
  for(let k=0;k<20;k++){
    const a=k/20,b=(k+1)/20;
    m.quad('register',[page(a,0),page(b,0),page(b,1),page(a,1)],'#fff9e9',[[a,0],[b,0],[b,1],[a,1]]);
    for(const v of [0,1]){
      const p=page(a,v),q=page(b,v);m.quad('pigment',[[p[0],base+.026,p[2]],[q[0],base+.026,q[2]],q,p],'#c3ad84');
    }
  }
  const inkX=x+.56,inkZ=z-.20;
  m.spindle('iron',inkX,inkZ,[[base,.038],[base+.01,.05],[base+.062,.047],[base+.078,.026],[base+.094,.022],[base+.094,.013]],'#555b54',12);
  const v=(u:number,v:number):V=>[inkX+u*.12+v,base+.081+u*.246-v*.55,inkZ-u*.027];
  for(let i=0;i<7;i++){
    const a=i/7,b=(i+1)/7,sw=(u:number)=>Math.sin(u*Math.PI)**.75*.023;
    for(const side of [-1,1])m.quad('pigment',[v(a,0),v(a,side*sw(a)),v(b,side*sw(b)),v(b,0)],side===1?'#d4c4a1':'#b3aa90');
  }
  const sx=x+.72,sz=z+.19;
  m.box('pigment',sx,base+.008,sz,.32,.016,.20,'#d9bf91');m.box('pigment',sx+.015,base+.02,sz-.012,.29,.009,.17,'#e7cda3');
  m.spindle('pigment',sx+.034,sz+.05,[[base+.024,.032],[base+.031,.032],[base+.034,.026],[base+.034,0]],'#973e32',13);
}

function desk(m:Masonry){
  const {x,z,w,d,hi}=DESK;
  m.box('oak',x,hi-.040,z,w,.080,d,heart);m.box('oak',x,.716,z,w-.105,.13,d-.075,rail);
  for(const s of [-1,1])for(const t of [-1,1]){
    const xx=x+s*(w/2-.175),zz=z+t*(d/2-.16);
    m.box('oak',xx,.375,zz,.13,.75,.13,heart);
    for(const [y,h,sz] of [[.065,.080,.169],[.58,.09,.145]])m.box('oak',xx,y,zz,sz,h,sz,edge);
  }
  for(const off of [-.67,0,.67]){
    m.box('oak',x+off,.71,z+d/2-.025,.56,.113,.043,heart);
    m.box('iron',x+off,.715,z+d/2+.008,.07,.028,.04,brass);
  }
  ledger(m);candle(m,x-.74,hi,z-.27,1.12);
  const st=STOOL;m.box('oak',st.x,.445,st.z,st.w,.07,st.d,heart);
  for(const a of [-1,1])for(const b of [-1,1])m.box('oak',st.x+a*.175,.205,st.z+b*.165,.063,.41,.063,rail);
}

function archivePress(m:Masonry){
  const {x,z,w,d,hi}=PRESS;
  m.box('oak',x+w/2-.04,hi/2,z,.08,hi,d,rail);
  for(const s of [-1,1])m.box('oak',x,hi/2,z+s*(d/2-.042),w-.035,hi-.04,.084,heart);
  for(const y of [.09,.55,.99,hi-.04])m.box('oak',x,y,z,w,.08,d,y===hi-.04?edge:heart);
  const hides=['#844b39','#625845','#475c57','#8e714d','#716953'];
  for(let row=0;row<3;row++){
    const floor=[.13,.59,1.03][row];
    for(let i=0;i<(row===1?6:8);i++){
      const xx=x-.14+(i%3)*.011,zz=z-.64+i*.128+(i>3?.060:0),h=.24+(i*7%4)*.032;
      m.box('pigment',xx,floor+h/2,zz,.30,h,.106,hides[(row*2+i)%5]);
      for(const r of [.23,.76])m.box('pigment',xx-.153,floor+r*h,zz,.010,.012,.103,'#c1a266');
    }
  }
}

function portrait(m:Masonry){
  const {x}=DAIS,w=2.38,z=HALL.back+.14,lo=.54,hi=3.48;
  m.box('oak',x,hi+.030,z,w+.22,.083,.10,'#a88c66');
  const at=(u:number,v:number):V=>[x+(u-.5)*w,lo+(hi-lo)*v-.065*(1-v)*Math.sin(Math.PI*u*5)**2,z+.012+.047*(.5+.5*Math.cos(Math.PI*u*14))];
  for(let i=0;i<56;i++){
    const a=i/56,b=(i+1)/56;const tint=['#fff7df','#f0dacb','#dcc9b8','#e9d2c3','#faf2da','#fff7df','#fff7df','#fff7df'][i%8];
    m.quad('arras',[at(a,0),at(b,0),at(b,1),at(a,1)],tint,[[a,0],[b,0],[b,1],[a,1]]);
  }
  for(const {x:xx,z:zz} of READERS){
    m.spindle('toolstone',xx,zz,[[0,.19],[.05,.19],[.075,.144],[.13,.146],[.19,.11],[.89,.094],[.95,.142],[.98,.17],[1,.17],[1,0]],'#bbab90',8);
    candle(m,xx,1,zz,.80);
  }
  const b=BENCH;
  m.box('oak',b.x,.46,b.z,b.w,.085,b.d,heart);m.box('oak',b.x-.245,.78,b.z,.071,.54,b.d-.045,rail);
  for(let i=0;i<3;i++){
    const zz=b.z+(i-1)*.46,xx=b.x-.202;
    m.box('oak',xx,.805,zz,.042,.38,.377,heart);
    m.quad('pigment',[[xx+.024,.744,zz+.080],[xx+.024,.680,zz],[xx+.024,.744,zz-.080],[xx+.024,.946,zz]],'#b6935f');
  }
  m.box('oak',b.x-.24,1.063,b.z,.125,.074,b.d,edge);
  for(const s of [-1,1]){m.box('oak',b.x,.675,b.z+s*.706,.51,.075,.094,edge);m.box('oak',b.x+.17,.595,b.z+s*.706,.07,.19,.07,rail);}
  for(const s of [-1,1])m.box('oak',b.x,.217,b.z+s*.56,b.w-.13,.434,.125,heart);
}

export function dressChamber(m:Masonry){desk(m);archivePress(m);portrait(m);ironEffigy(m);galleryModels(m);}

import {Joinery,type V} from './joinery';
import {SPA as p} from './retreatLayout';

const cedar='#bb956c',heart='#937056',bronze='#ab8d64',moss='#617873',light='#fff1bf';
function dryRoom(s:Joinery){
  const l=p.locker,b=p.bench;
  s.slab('wood',l,heart);
  for(let i=0;i<3;i++){
    const z=l.z+(i-1)*.83;
    s.pad('wood',[l.x+.313,1.32,z],.044,1.63,.79,.017,i===1?'#c9a079':cedar);
    s.turn('metal',[l.x+.348,1.22,z+.29],.025,.025,.042,bronze,[0,0,Math.PI/2]);
    for(let j=0;j<5;j++)s.box('matte',[l.x+.336,.68,z+(j-2)*.09],.006,.023,.064,'#80664d');
  }
  for(const k of [-1,1])s.box('wood',[b.x,.195,b.z+k*.56],b.w-.13,.39,.095,heart);
  for(let i=0;i<5;i++)s.pad('wood',[b.x+(i-2)*.132,.391,b.z],.117,.076,b.d,.022,cedar);
  for(let j=0;j<2;j++)s.pad('cloth',[b.x,.464+j*.049,b.z-.44],.40,.049,.39,.019,j?'#dbe1ce':'#eeead7');
  // Two pairs of low cedar sandals tucked under the bench, not character props.
  for(let i=0;i<4;i++){const z=b.z+.54-i*.185;s.pad('wood',[b.x+.03,.044,z],.245,.057,.105,.025,'#987d5e');s.pad('cloth',[b.x-.019,.080,z],.070,.045,.108,.018,'#728982');}
  // The bath side is a limewashed solid wall; the dry side has cedar battens
  // and two hanging lengths of linen on pegs. Both stop at the open portal.
  for(const r of p.divider){s.slab('matte',r,'#99a89b');const n=Math.floor(r.w/.20);
    for(let i=0;i<n;i++)s.box('wood',[r.x-r.w/2+(i+.5)*r.w/n,1.16,r.z+.085],r.w/n-.017,2.32,.031,cedar);
    s.box('wood',[r.x,2.36,r.z],r.w,.09,.25,heart);
  }
  for(const k of [-1,1]){
    const x=-1.20+k*.49;s.turn('metal',[x,1.73,1.06],.031,.03,.11,bronze,[Math.PI/2,0,0]);
    s.grid('cloth',24,8,(u,v)=>[x+(u-.5)*(.31+.12*(1-v)),.78+.93*v+.025*Math.cos(u*21)*(1-v),1.108+.044*Math.cos(u*6*Math.PI)],k<0?'#d7c7a6':'#e0e0ca',[.8,1.74]);
  }
  s.slab('wood',p.lintel,heart);for(const x of [.85,2.59])s.box('wood',[x,1.17,.91],.07,2.34,.23,heart);
  s.box('wood',[1.58,1.12,3.905],1.01,2.24,.08,cedar);s.box('metal',[1.97,1.03,3.84],.038,.21,.060,bronze);
}
function flags(s:Joinery){
  const b=p.basin,x0=b.x-b.w/2,x1=b.x+b.w/2,z0=b.z-b.d/2,z1=b.z+b.d/2;
  const colors=['#8a9992','#91a099','#84968e','#99a69d','#83938e','#93a199'];let row=0;
  const cut=(x:number,z:number,w:number,d:number)=>{
    s.box('matte',[x,-.087,z],w,.16,d,'#596b66');const nz=Math.ceil(d/.67);
    for(let j=0;j<nz;j++,row++){
      const dz=d/nz,nx=Math.ceil(w/1.07),ww=w/nx;
      for(let i=-1;i<nx;i++){
        const xx=x-w/2+(i+Number(row%2)*.5)*ww,xa=Math.max(xx,x-w/2),xb=Math.min(xx+ww,x+w/2);if(xb-xa<.01)continue;
        s.box('stone',[(xa+xb)/2,-.007,z-d/2+(j+.5)*dz],xb-xa-.009,.014,dz-.009,colors[(i+j+row+13)%6]);
      }
    }
  };
  cut(0,(-7.2+z0)/2,7.2,z0+7.2);cut((-3.6+x0)/2,b.z,x0+3.6,b.d);cut((3.6+x1)/2,b.z,3.6-x1,b.d);cut(0,(.92+z1)/2,7.2,.92-z1);
  // Dry boards start flush with the wet floor, with a narrow drain at the sill.
  for(let i=0;i<27;i++)s.box('wood',[0,-.033,.92+(i+.5)*3.08/27],7.18,.066,3.08/27-.006,i%3===1?'#b89d7d':'#c5aa87');
  s.box('metal',[1.72,.001,.69],1.67,.006,.06,'#736f5f');for(let i=0;i<43;i++)s.box('matte',[.92+i*.038,.005,.69],.012,.002,.046,'#4a554e');
  // Actual recess. The horizontal deck has a hole, even with the water hidden.
  s.box('stone',[b.x,-.742,b.z],b.w,.072,b.d,moss);
  const seg=(x:number,z:number,w:number,d:number,n:number,alongX:boolean)=>{
    for(let i=0;i<n;i++){
      const j=(i+.5)/n-.5,xx=x+(alongX?j*w:0),zz=z+(alongX?0:j*d),sw=alongX?w/n:w,sd=alongX?d:d/n;
      s.box('stone',[xx,-.33,zz],sw,.75,sd,'#69807b');s.pad('stone',[xx,.052,zz],sw-.004,.086,sd-.004,.017,i%3?'#a9afa1':'#a0aa9c');
    }
  };
  for(const k of [-1,1]){seg(b.x,b.z+k*(b.d/2-.095),b.w,.19,5,true);seg(b.x+k*(b.w/2-.095),b.z,.19,b.d-.38,6,false);}
  s.grid('water',58,72,(u,v)=>[x0+.176+u*(b.w-.352),-.087+.0035*Math.sin(33*v+13*u)+.002*Math.sin(92*v-4*u),z1-.176-v*(b.d-.352)],'#ffffff');
  // Stream and overlapping non-concentric rings under the stone spillway.
  const sp=p.spout;s.slab('stone',sp,'#768882');
  s.pad('stone',[sp.x,.87,sp.z+.30],.39,.065,.82,.019,'#9ea897');
  s.box('metal',[sp.x,.910,sp.z+.30],.246,.016,.83,bronze);
  for(const side of [-1,1])s.pad('stone',[sp.x+side*.164,.932,sp.z+.29],.062,.097,.82,.013,'#a1a99b');
  const stream=(u:number,v:number):V=>[sp.x+(u-.5)*(.228-.068*v+.014*Math.sin(22*v)),.923-1.002*v*v,sp.z+.722+.13*v+.009*Math.cos(33*u+3*v)];
  s.grid('stream',36,22,stream,'#c7e0d5');
  for(let i=0;i<5;i++){const u=(i+.3)/5;s.grid('stream',1,22,(a,v)=>stream(u+a*.007,v),'#ffffff');}
  for(let j=0;j<3;j++){const rad=.085+j*.093,z=sp.z+.87+j*.028;
    s.grid('metal',56,1,(u,v)=>[sp.x+(rad+v*.005)*Math.sin(u*6.283),-.078+j*.0004,z+(rad+v*.005)*.69*Math.cos(u*6.283)],j===0?'#a9c3b7':'#86afa4');}
}
export function buildSpa(){
  const s=new Joinery(),{floor:f,h}=p;
  for(const [x,z,w,d] of [[-3.6,-1.6,.14,11.2],[3.6,-1.6,.14,11.2],[0,-7.2,7.2,.14],[0,4,7.2,.14]]){
    s.box('matte',[x,h/2,z],w,h,d,'#bec6b4');s.box('stone',[x,.38,z],w+.049,.76,d+.049,'#86978a');s.box('wood',[x,.80,z],w+.054,.065,d+.054,cedar);
  }
  s.box('matte',[f.x,h+.05,f.z],f.w,.10,f.d,'#d7d4c2');
  // The wet wing has visible rafters; the dry room has a lower timber canopy.
  for(let z=-6.87;z<4;z+=.82)s.box('wood',[0,3.16,z],7.08,.17,.12,z<0?'#a99371':cedar);
  for(const x of [-3.44,3.44]){
    s.box('wood',[x,2.98,-1.6],.22,.13,11.1,heart);
    for(const z of [-5.62,-1.82,2.70]){
      const xx=x*.986;s.box('wood',[xx,1.68,z],.16,.64,.29,heart);s.pad('glow',[xx*.975,1.68,z],.102,.48,.23,.03,light);
      for(const a of [-1,1])s.box('metal',[xx*.977,1.68+.23*a,z],.14,.029,.26,bronze);
    }
  }
  // Slatted lining and a deep circular bronze reveal frame the borrowed garden.
  for(let i=0;i<52;i++)s.box('wood',[-3.51+i*.137,1.72,-7.095],.105,2.79,.10,i%3?'#a89172':'#b49a77');
  s.turn('wood',[0,1.87,-7.018],1.175,1.175,.072,heart,[Math.PI/2,0,0],80);
  s.medallion('garden',[0,1.87,-6.97],1.123,'#ffffff');s.hoop('metal',[0,1.87,-6.959],1.13,.036,bronze);
  s.box('stone',[0,.53,-7.026],6.84,.30,.19,'#8c998c');
  // Towels on an open slatted rack. Leave the full length of the east bank free.
  const r=p.towels;
  for(const k of [-1,1])for(const a of [-1,1])s.box('wood',[r.x+k*.214,.48,r.z+a*.61],.066,.96,.066,heart);
  for(const y of [.18,.64,.90])for(let i=0;i<4;i++)s.box('wood',[r.x+(i-1.5)*.12,y,r.z],.107,.045,r.d,cedar);
  for(const z of [r.z-.33,r.z+.13,r.z+.40])s.turn('cloth',[r.x,.765,z],.10,.10,.34,'#e5dfca',[0,0,Math.PI/2]);
  for(let i=0;i<2;i++)s.pad('cloth',[r.x,.946+i*.07,r.z+.19],.41,.069,.56,.024,i?'#d7d9c2':'#e8ddc5');
  flags(s);dryRoom(s);return s.finish();
}

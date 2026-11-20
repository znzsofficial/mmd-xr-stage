import {Joinery,type Finish,type V} from './joinery';
import {SUITE as plan} from './retreatLayout';

const brass='#bb9367',champagne='#e5bc83',walnut='#845a48',plum='#744453',paper='#ffdc9e';
function pillow(s:Joinery,f:'cloth'|'brocade',[x,y,z]:V,w:number,d:number,h:number,angle:number,c:string){
  // Fullness in the middle, pinched corners and a narrow sewn welt rather
  // than a bevel around a rigid block. Both shells meet the same perimeter.
  const skin=(u:number,v:number,side:number):V=>{
    const a=2*u-1,b=2*v-1,fill=Math.max(0,(1-a*a)*(1-b*b))**.54;
    const dx=a*w*.5*(1-.07*b**6),dz=b*d*.5*(1-.06*a**6),dy=side*(.008+h*.5*fill)+.012*fill*(Math.sin(13*a+7*b)+.5*Math.cos(19*b));
    return [x+dx,y+dy*Math.cos(angle)-dz*Math.sin(angle),z+dz*Math.cos(angle)+dy*Math.sin(angle)];
  };
  for(const k of [-1,1])s.grid(f,30,18,(u,v)=>skin(u,v,k),c,[1.9,1]);
  for(const edge of [0,1]){
    s.grid('cloth',30,1,(u,v)=>skin(u,edge,2*v-1),c);s.grid('cloth',18,1,(u,v)=>skin(edge,u,2*v-1),c);
  }
}
function bed(s:Joinery){
  const {x,z,w,d}=plan.bed;
  s.pad('wood',[x,.12,z],w-.21,.24,d-.20,.06,'#4f3937');s.pad('cloth',[x,.27,z],w,.25,d,.08,'#89535a');
  s.pad('cloth',[x,.425,z],w-.15,.19,d-.08,.087,'#f1d9c3');
  const cloth=(u:number,v:number,raise=0):[number,number,number]=>{
    const side=Math.min(u,1-u),foot=Math.min(1,v/.096),edge=Math.min(1,side/.068);
    return [x+(u-.5)*(w+.008),.383+.174*Math.sin(edge*Math.PI/2)+.062*Math.sin(foot*Math.PI/2)+(.014*Math.cos(24*u+6*v)+.008*Math.sin(51*u-9*v))*(.48+.52*(1-v))+.012*Math.sin(Math.PI*u)+raise,z+d/2-.004-v*(d-.13)];
  };
  // Piece the woven insert into the same cloth surface. Separate overlaid
  // sheets used to intersect where the rolled edge turns down at the foot.
  const band=(f:Finish,lo:number,hi:number,rows:number,col:string,uv:[number,number])=>s.grid(f,48,rows,(u,v)=>cloth(u,lo+(hi-lo)*v),col,uv);
  band('cloth',0,.065,8,'#f4daca',[3.6,.25]);band('cloth',.065,.072,1,champagne,[4,.06]);
  band('brocade',.072,.34,18,'#fff0d8',[3.9,.92]);band('cloth',.34,.347,1,champagne,[4,.06]);band('cloth',.347,1,28,'#f4daca',[3.6,2.4]);
  s.pad('cloth',[x,.624,z-.55],w-.18,.094,.35,.042,'#f4e7d8',[-.05,0,0]);
  for(const k of [-1,1]){
    const xx=x+k*.52;pillow(s,'cloth',[xx,.738,z-.82],.99,.59,.27,.29,'#fff0d7');
    pillow(s,'brocade',[xx,.829,z-.64],.48,.41,.19,1.10,'#f4c8be');
  }
  // Separate silk channels step up into a scalloped fan above the bed.
  for(let i=-6;i<=6;i++){
    const h=.92+.58*Math.cos(i/7*Math.PI*.5),xx=x+i*.222;
    s.pad('cloth',[xx,.23+h/2,plan.head.z],.229,h+.08,.245,.112,i%2?'#b67877':'#be837f');
  }
  for(const r of plan.tables){
    s.pad('wood',[r.x,.285,r.z],r.w-.08,.52,r.d-.08,.035,walnut);s.pad('stone',[r.x,.572,r.z],r.w,.07,r.d,.028,'#cca890');
    s.box('metal',[r.x,.41,r.z+.306],.21,.018,.025,brass);
    const xx=r.x,zz=r.z-.055;
    s.turn('metal',[xx,.641,zz],.15,.17,.064,brass);s.turn('metal',[xx,.843,zz],.034,.055,.35,brass);
    s.turn('glow',[xx,1.13,zz],.184,.235,.34,paper);for(const [yy,rad] of [[.964,.236],[1.303,.185]])s.hoop('metal',[xx,yy,zz],rad,.009,brass,[Math.PI/2,0,0]);
    for(let i=0;i<28;i++){const a=Math.PI*2*i/28,c=Math.cos(a),t=Math.sin(a);s.line('matte',[xx+.235*c,.966,zz+.235*t],[xx+.185*c,1.299,zz+.185*t],.0029,'#dfb685');}
  }
}
function salon(s:Joinery){
  // Deep window reveal, not a city decal on the bedroom wall.
  const cx=3.36,zz=-3.58;
  s.box('wood',[cx,.46,zz],4.14,.92,.21,walnut);
  s.grid('city',1,1,(u,v)=>[1.31+u*4.06,.88+v*2.10,-3.616],'#ffffff');
  for(const x of [1.34,2.58,4.07,5.40])s.box('metal',[x,1.96,-3.573],.044,2.18,.083,'#604f51');
  s.box('wood',[cx,.91,-3.48],4.14,.082,.29,walnut);s.box('metal',[cx,2.55,-3.56],4.12,.032,.06,'#5c5055');
  for(const end of [-1,1]){
    const xx=end===-1?1.55:5.20;
    s.grid('cloth',56,10,(u,v)=>[xx+(u-.5)*(.46+.20*v),.12+v*2.93+.021*Math.cos(u*37)*(1-v),-3.36+.079*Math.cos(u*Math.PI*12)+.035*Math.sin(v*4+u)],'#b78982',[1,4]);
  }
  const r=plan.sofa;
  s.pad('wood',[r.x,.16,r.z],r.w-.13,.22,r.d-.11,.06,'#6c4340');
  s.pad('cloth',[r.x,.34,r.z],r.w,.34,r.d,.13,plum);s.pad('cloth',[r.x+.31,.65,r.z],.25,.61,r.d-.03,.10,'#855560');
  for(const sign of [-1,1]){s.pad('cloth',[r.x-.08,.52,r.z+.49*sign],.68,.21,.95,.09,'#bf8983');s.pad('cloth',[r.x-.01,.64,r.z+1.10*sign],.89,.32,.18,.08,plum);}
  const t=plan.tea;s.turn('metal',[t.x,.052,t.z],.23,.246,.078,brass);s.turn('wood',[t.x,.28,t.z],.066,.095,.43,walnut);s.turn('stone',[t.x,.53,t.z],.29,.29,.06,'#d2bca8');
  for(const k of [-1,1]){
    const x=t.x+k*.098,z=t.z+.025*k;s.turn('metal',[x,.571,z],.041,.049,.01,champagne);s.turn('metal',[x,.617,z],.009,.009,.085,champagne);s.turn('metal',[x,.691,z],.049,.018,.084,champagne);
  }
}
function divider(s:Joinery){
  for(const r of plan.divider){
    s.slab('wood',r,'#735449');const pieces=Math.ceil(r.d/.31);
    for(let i=0;i<pieces;i++){const z=r.z-r.d/2+(i+.5)*r.d/pieces;for(const k of [-1,1])s.box('cloth',[r.x+k*.084,1.46,z],.025,2.24,r.d/pieces-.021,i%2?'#b78a7e':'#b18179');}
    for(const h of [.29,2.65])s.box('metal',[r.x,h,r.z],.19,.028,r.d,brass);
  }
  s.slab('wood',plan.lintel,walnut);s.box('metal',[1.15,2.54,.97],.21,.04,2.28,champagne);
}
export function buildSuite(){
  const s=new Joinery(),{floor:f,h}=plan;
  s.box('wood',[f.x,-.065,f.z],f.w,.12,f.d,'#684d46');
  const palette=['#a77d65','#b2866d','#a77f68','#9d7765'];
  for(let k=0;k<20;k++)for(let row=-1;row<5;row++){
    const x=-4.45+(k+.5)*.5,offset=k%3*.61,start=Math.max(-3.7,-3.7+row*1.93+offset),end=Math.min(3.8,-3.7+(row+1)*1.93+offset);if(end>start+.01)s.box('wood',[x,-.004,(start+end)/2],.496,.008,end-start-.005,palette[(k+row+9)%4]);
  }
  for(const [x,z,w,d] of [[-4.45,.05,.14,7.5],[5.55,.05,.14,7.5],[.55,3.8,10,.14],[.55,-3.7,10,.14]]){
    s.box('matte',[x,h/2,z],w,h,d,'#aa8381');s.box('wood',[x,.145,z],w+.051,.29,d+.051,walnut);
    s.box('metal',[x,.307,z],w+.053,.019,d+.053,brass);s.box('wood',[x,3.02,z],w+.095,.12,d+.095,'#845f54');
  }
  s.box('matte',[f.x,h+.06,f.z],f.w,.12,f.d,'#d3bcb0');
  // Raised velvet panels and gilded sunrise rays behind the channel headboard.
  for(let i=0;i<9;i++)s.pad('cloth',[-4.05+.58*i,1.62,-3.587],.562,2.59,.081,.033,i%2?'#965f68':'#9e6770');
  for(const rad of [.46,.62,.84])s.hoop('metal',[plan.bed.x,1.50,-3.529],rad,.012,brass);
  for(let i=-8;i<=8;i++){const a=i*.093;s.line('metal',[plan.bed.x+.88*Math.sin(a),1.50+.88*Math.cos(a),-3.529],[plan.bed.x+1.13*Math.sin(a),1.50+1.13*Math.cos(a),-3.529],.008,champagne);}
  const rug=(f:Finish,x:number,z:number,w:number,d:number,y:number,c:string)=>s.box(f,[x,y,z],w,.004,d,c);
  rug('cloth',-1.58,-.24,3.52,2.49,.002,'#a17370');rug('cloth',-1.58,-.24,3.41,2.38,.006,'#dbb39a');rug('cloth',-1.58,-.24,3.36,2.33,.010,'#a98080');
  for(const k of [-1,1])for(let i=0;i<56;i++)s.box('cloth',[-3.27+i*.061,.003,-.24+k*1.255],.019,.006,.066,'#b38978');
  const c=plan.cabinet;s.pad('wood',[c.x,.50,c.z],c.w-.065,.98,c.d-.05,.035,'#80584d');s.pad('stone',[c.x,1.01,c.z],c.w,.055,c.d,.02,'#d6baa5');
  for(const k of [-1,1]){s.pad('wood',[c.x+.338,.54,c.z+k*.42],.038,.76,.79,.018,'#9e7460');s.box('metal',[c.x+.372,.69,c.z+k*.16],.044,.108,.015,brass);}
  // Circular bronze mirror with a smoked dusk tint over the drinks cabinet.
  s.turn('metal',[-4.353,1.93,c.z],.565,.565,.038,'#9e9692',[0,0,Math.PI/2],64);s.hoop('metal',[-4.316,1.93,c.z],.569,.024,champagne,[0,Math.PI/2,0]);
  bed(s);salon(s);divider(s);
  // Recessed entry leaf and lever establish scale on the reverse view.
  s.box('wood',[-.85,1.14,3.71],1.16,2.28,.08,walnut);s.box('metal',[-.43,1.02,3.65],.15,.026,.07,brass);
  return s.finish();
}

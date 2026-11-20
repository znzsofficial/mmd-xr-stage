import { C, ClinicParts } from './clinicParts';
import { WARD, WALLS, DOORS, FIXTURES as F, type ClinicRect } from './clinicLayout';

const H=WARD.h, pi=Math.PI;

function waitingSeats(p:ClinicParts,f:ClinicRect,nx:number,nz:number){
  // nx,nz point from the backrest to the sitter's knees.
  const ax=nz,az=-nx,yaw=Math.atan2(nx,nz);
  const at=(along:number,ahead:number)=>[f.x+ax*along+nx*ahead,f.z+az*along+nz*ahead] as const;
  p.box(f.x,.30,f.z,2.43,.081,.098,C.graphite,0,yaw);
  for(const u of [-.80,.80]){
    const [x,z]=at(u,0);p.pad(x,.056,z,.16,.09,.55,C.iron,0,yaw);p.box(x,.183,z,.091,.22,.13,C.chrome,0,yaw);
  }
  for(const u of [-.96,-.32,.32,.96]){
    const [x,z]=at(u,.025),[bx,bz]=at(u,-.239);
    p.pad(x,.442,z,.562,.078,.475,C.green,0,yaw);
    p.pad(bx,.673,bz,.550,.407,.087,C.mint,0,yaw);
    for(const i of [-.16,.16]){
      const [px,pz]=at(u+i,-.18),[tx,tz]=at(u+i,-.245);p.rod([px,.322,pz],[tx,.67,tz],.025,C.iron);
    }
  }
  for(const u of [-1.237,0,1.237]){
    const [x,z]=at(u,-.03),[xx,zz]=at(u,-.195);
    p.rod([xx,.36,zz],[xx,.64,zz],.025,C.chrome);p.pad(x,.65,z,.043,.048,.34,C.oak,0,yaw);
  }
}
function windowStrip(p:ClinicParts,x:number,z:number,w:number,yaw:number,count:number){
  const nx=Math.sin(yaw),nz=Math.cos(yaw),ax=Math.cos(yaw),az=-Math.sin(yaw),y=1.91,h=1.25;
  const beam=(u:number,dy:number,dn:number,width:number,height:number,depth:number,c:string)=>p.box(x+ax*u+nx*dn,y+dy,z+az*u+nz*dn,width,height,depth,c,0,yaw);
  beam(0,0,0,w+.10,h+.10,.07,C.iron);
  const width=w/count;
  for(let j=0;j<count;j++){
    const u=-w/2+(j+.5)*width;p.print(x+ax*u+nx*.041,y,z+az*u+nz*.041,width-.034,h,yaw,12);
    beam(u,0,.053,.025,h,.042,C.milk);
  }
  beam(0,-h/2-.018,.035,w+.12,.065,.17,C.porcelain);beam(0,h*.22,.059,w,.033,.045,C.milk);
}
function lightingPanel(p:ClinicParts,x:number,z:number,w:number,d:number){
  p.box(x,H-.045,z,w+.065,.085,d+.065,C.milk);p.lit(x,H-.096,z,w,.016,d,'#f6f7e9');
}
export function clinicShell(p:ClinicParts){
  p.box(0,H+.065,(WARD.south+WARD.north)/2,WARD.east-WARD.west+.16,.13,WARD.south-WARD.north+.16,'#dedfd4');
  // The continuous base and protective bands stop with the wall at each doorway.
  for(const {x,z,w,d} of WALLS){
    const along=d>w,ext=(along?[.024,0]:[0,.024]);
    p.box(x,H/2,z,w,H,d,C.chalk);
    p.box(x,.475,z,w+ext[0],.95,d+ext[1], '#bbcec3');
    p.box(x,.10,z,w+ext[0]*2,.2,d+ext[1]*2,'#7f9c92');
    p.box(x,.91,z,w+ext[0]*2.2,.084,d+ext[1]*2.2,'#a4b6ab');
    p.box(x,.958,z,w+ext[0]*2.5,.026,d+ext[1]*2.5,'#e5e5ce');
  }
  // Cover the butt ends where two protective panels meet at the waiting bay.
  p.box(WARD.right,.506,WARD.orSouth,.223,1.012,.223,'#9fae9e');
  windowStrip(p,WARD.west+.094,.12,4.14,pi/2,3);
  windowStrip(p,WARD.east-.094,2.02,4.30,-pi/2,4);
  windowStrip(p,5.85,WARD.north+.093,3.15,0,3);
  for(const [key,{x,z,width}] of Object.entries(DOORS)){
    const side=x>0?-1:1,panel=key==='wc'?'#b3989f':key==='or'?'#88b8b4':'#b5c7ac';
    p.box(x,(H+2.25)/2,z,WARD.t,H-2.25,width,C.chalk);
    for(const k of [-1,1])p.box(x,1.135,z+k*(width/2-.015),.214,2.27,.058,C.iron);
    p.box(x,2.28,z,.216,.065,width,C.iron);
    // Sliding leaves are parked against the side wall, never in the opening.
    const pz=z-width/2-width*.5-.048,px=x-side*.143;
    p.box(px,1.10,pz,.072,2.18,width,panel);
    p.box(px-side*.047,1.46,pz,.030,.58,width*.53,C.milk);
    p.box(px-side*.065,1.46,pz,.018,.50,width*.48,'#a1b9bb');
    p.box(px-side*.050,.315,pz,.018,.43,width-.065,C.chrome);
    p.box(px-side*.075,1.05,pz+width*.36,.044,.27,.032,C.graphite);
    p.box(px,2.246,pz+width*.49,.10,.067,width*2+.03,C.milk);
    const cell=key==='exam'?0:key==='wc'?1:2, signZ=z+width/2+.48;
    p.frame(x+side*.12,1.66,signZ,.66,.415,side*pi/2,cell);
    // Double-sided blade visible before turning into the room.
    p.box(x+side*.41,2.43,signZ,.64,.37,.050,C.graphite);
    p.print(x+side*.41,2.43,signZ+.026,.62,.35,0,cell);p.print(x+side*.41,2.43,signZ-.026,.62,.35,pi,cell);
  }
  // Oak ribbing backs the directory at the end of the hall. A recessed linear
  // strip and a modest soffit distinguish this endpoint at walking eye height.
  p.box(0,1.53,-8.895,3.94,3.06,.07,'#957957');
  for(let i=0;i<42;i++)p.box(-1.92+i*.094,1.53,-8.838,.067,3.05,.046,i%3?'#b79c7a':'#c5ac86');
  p.frame(-.34,1.71,-8.793,1.52,.94,0,4,C.oak);
  for(const sx of [-.72,.72])p.rod([sx,2.821,-.94],[sx,H,-.94],.018,C.chrome);
  p.box(0,2.57,-.94,2.07,.53,.073,C.graphite);
  p.print(0,2.57,-.902,2.05,.51,0,14);p.print(0,2.57,-.978,2.05,.51,pi,14);
  p.box(0,2.98,-8.42,4.24,.25,.99,'#d6c9ab');p.lit(0,2.847,-8.51,3.90,.017,.056,'#ffe6ba');
  for(const z of [-6.85,-3.84,-.83,2.18]){
    lightingPanel(p,0,z,.45,1.59);
    p.box(0,H-.019,z-1.37,4.24,.033,.023,'#c6ccbf');
  }
  for(const [x,z] of [[-5.12,-1.60],[-5.12,2.64],[-5.40,-5.47],[-5.40,-8.02],[4,-5.67],[7.40,-3.50],[4.03,2],[7.12,2.57]])lightingPanel(p,x,z,1.09,.51);
  // Ceiling grid is delicate enough to stay quieter than the doors at eye level.
  for(const x of [-7.39,-6.18,-4.97,-3.76,-2.55,2.55,3.76,4.97,6.18,7.39])p.box(x,H-.009,-2.10,.011,.015,13.6,'#c6ccbf');
  for(const z of [-7.85,-6.63,-5.41,-4.19,-2.97,-1.75,-.53,.69,1.91,3.13,4.35])for(const x of [-5.38,5.38])p.box(x,H-.012,z,6.34,.014,.012,'#c6ccbf');

  waitingSeats(p,F.seatsA,0,-1);waitingSeats(p,F.seatsB,0,1);waitingSeats(p,F.seatsC,-1,0);
  p.frame(3.09,1.92,-.492,.88,.55,0,7);
  for(const [i,px] of [4.40,5.42,6.44].entries())p.poster(px,1.71,-.492,.79,0,i);
  p.teachingPoster(7.69,1.71,-.492,.79,0,'postpartumPlate');
  p.frame(4.29,1.63,4.69,1.25,.77,pi,3,C.oak);
  for(const [px,pz] of [[WARD.left,-2.32],[WARD.right,-5.13]]){
    const side=px<0?1:-1;
    p.box(px+side*.139,1.24,pz,.085,.235,.107,C.milk);p.box(px+side*.185,1.247,pz,.012,.079,.064,'#71958d');
    p.box(px+side*.173,1.025,pz,.119,.022,.148,C.chrome);
  }
  const k=F.kiosk;p.pad(k.x,.058,k.z,.63,.11,.50,C.iron);p.box(k.x,.64,k.z,.39,1.06,.27,C.milk);p.box(k.x,1.26,k.z,.62,.44,.115,C.graphite);
  p.print(k.x,1.26,k.z+.061,.552,.356,0,15);p.box(k.x,.83,k.z+.151,.23,.045,.046,C.graphite);
  const {x,z}=F.planter;p.cylinder(x,.21,z,.48,.42,.48,'#c59379');p.cylinder(x,.426,z,.47,.024,.47,'#776b54');
  for(let i=0;i<13;i++){
    const a=i*2.4,h=.29+.29*((i*7%13)/13),r=.06+.14*(i%4/3),dx=Math.cos(a)*r,dz=Math.sin(a)*r;
    p.rod([x,.423,z],[x+dx,.43+h,z+dz],.011,'#6a8976');p.egg(x+dx,.43+h,z+dz,.12,.31,.045,i%3?'#638b7b':'#9bb498',.33,a,dx>.0?-.35:.35);
  }
}

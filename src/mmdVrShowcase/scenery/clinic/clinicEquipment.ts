import { C, ClinicParts, type V } from './clinicParts';
import { FIXTURES as F, STALLS, STALL_PANELS, TOILETS, type ClinicRect } from './clinicLayout';
import { hygieneStation, instrumentTray, modelBench } from './clinicTeaching';

const pi=Math.PI;
function wheel(p:ClinicParts,x:number,z:number,r=.058){
  p.rod([x,r,z],[x,r*2.8,z],r*.7,C.chrome);
  p.cylinder(x,r,z,r*2,r*.78,r*2,C.graphite,0,0,pi/2);
}
function wheels(p:ClinicParts,x:number,z:number,w:number,d:number){for(const i of [-1,1])for(const j of [-1,1])wheel(p,x+i*w*.5,z+j*d*.5);}
function cabinet(p:ClinicParts,f:ClinicRect,n:number,front=1){
  const {x,z,w,d}=f,face=z+front*d/2;
  p.box(x,.118,z,w-.13,.19,d-.10,C.iron);p.box(x,.485,z,w,.68,d,C.milk);p.pad(x,.862,z,w+.008,.070,d+.009,C.porcelain);
  for(let i=0;i<n;i++){
    const u=x-w*.5+(i+.5)*w/n, tint=i%3===1?'#b9ccc0':'#c9d7cb';
    if(i===0){for(let j=0;j<3;j++){
      p.box(u,.29+j*.20,face+front*.01,w/n-.023,.186,.021,tint);
      p.box(u,.35+j*.20,face+front*.036,.19,.017,.038,C.iron);
    }}else{
      p.box(u,.5,face+front*.01,w/n-.019,.585,.021,tint);p.box(u-w/n*.33,.716,face+front*.036,.028,.106,.04,C.iron);
    }
  }
}
function bottle(p:ClinicParts,x:number,y:number,z:number,color:string,s=1){
  p.cylinder(x,y+.066*s,z,.088*s,.132*s,.088*s,color);p.cylinder(x,y+.15*s,z,.047*s,.036*s,.047*s,C.chalk);
  p.cylinder(x,y+.181*s,z,.024*s,.037*s,.024*s,C.chrome);p.box(x+.014*s,y+.204*s,z,.078*s,.018*s,.027*s,C.milk);
}
function monitor(p:ClinicParts,x:number,y:number,z:number,w:number,h:number,cell:number,yaw=0){
  p.box(x,y,z,w,h,.064,C.graphite,0,yaw);
  p.print(x+.034*Math.sin(yaw),y+.008,z+.034*Math.cos(yaw),w-.038,h-.042,yaw,cell);
}
function tap(p:ClinicParts,x:number,y:number,z:number,front=1){
  const top=y+.235; p.cylinder(x,y+.015,z,.084,.03,.084,C.chrome);
  p.rod([x,y,z],[x,top-.039,z],.042,C.chrome);p.rod([x,top-.039,z],[x,top,z+.038*front],.039,C.chrome);
  p.rod([x,top,z+.038*front],[x,top,z+.149*front],.038,C.chrome);p.rod([x,top,z+.149*front],[x,top-.047,z+.18*front],.036,C.chrome);
  p.box(x+.038,y+.114,z,.101,.022,.041,C.iron);
}

export function examRoom(p:ClinicParts){
  let {x,z}=F.examChair;
  p.pad(x,.096,z,.68,.166,1.01,C.chrome);p.pad(x,.31,z,.46,.35,.57,C.milk);p.box(x,.502,z,.39,.16,.45,C.iron);
  p.pad(x,.63,z,.72,.17,1.04,C.porcelain);p.pad(x,.751,z+.105,.693,.105,.677,C.green);
  // Reclined back, separate head cushion and independently mounted calf cradles.
  p.pad(x,.954,z-.443,.68,.092,.79,C.teal,.65);
  p.pad(x,1.145,z-.66,.42,.112,.25,C.mint,.65);
  for(const k of [-1,1]){
    p.rod([x+k*.294,.59,z+.23],[x+k*.425,.69,z+.48],.043,C.chrome);
    p.rod([x+k*.425,.69,z+.48],[x+k*.47,.99,z+.82],.038,C.chrome);
    p.pad(x+k*.47,1.002,z+.79,.207,.074,.31,C.rose,.26,-k*.24);
    p.rod([x+k*.315,.672,z-.06],[x+k*.397,.917,z-.015],.032,C.iron);p.pad(x+k*.399,.934,z-.089,.078,.063,.36,C.teal,.08);
  }
  // Heel rest, two individual rockers and a short cable from the pedestal.
  const pedal=F.footControl;p.pad(pedal.x,.031,pedal.z,pedal.w,.056,pedal.d,C.graphite);
  for(const k of [-1,1]){
    const px=pedal.x+k*.068;p.pad(px,.063,pedal.z-.012,.113,.032,.159,C.iron,-.11);
    for(let j=0;j<4;j++)p.box(px,.081,pedal.z-.065+j*.027,.081,.006,.009,C.graphite,-.11);
  }
  const flex:V[]=[[x+.27,.101,z+.222],[x+.385,.027,z+.27],[x+.49,.018,z+.376],[pedal.x-.18,.015,pedal.z-.074],[pedal.x-.142,.029,pedal.z]];
  for(let j=1;j<flex.length;j++)p.rod(flex[j-1],flex[j],.015,C.graphite);
  ({x,z}=F.ultrasound);wheels(p,x,z,.505,.47);p.pad(x,.166,z,.66,.125,.58,C.milk);p.pad(x,.47,z,.46,.51,.46,C.porcelain);p.pad(x,.754,z,.46,.095,.43,C.teal);
  p.box(x,.865,z,.22,.17,.26,C.iron);p.pad(x,.984,z,.78,.094,.55,C.milk,-.09);
  for(let i=0;i<5;i++)for(let j=0;j<3;j++)p.box(x-.29+i*.08,1.031+j*.002,z+.013+j*.051,.055,.018,.034,'#899d9a');
  p.egg(x+.203,1.038,z+.097,.085,.043,.085,C.green);p.box(x,1.127,z-.13,.08,.29,.08,C.iron);
  monitor(p,x,1.43,z-.12,.675,.432,9,.17);
  p.box(x+.376,.973,z-.084,.095,.061,.248,C.chrome); // twin cradle fixed to the keyboard carriage
  for(const dz of [-.152,.006]){
    p.cylinder(x+.377,1.017,z+dz,.105,.049,.105,C.milk);p.cylinder(x+.377,1.043,z+dz,.074,.010,.074,C.graphite);
    p.rod([x+.377,1.041,z+dz],[x+.381,1.120,z+dz+.002],.038,C.milk);p.egg(x+.385,1.138,z+dz+.01,.069,.069,.045,C.porcelain);
  }
  for(let j=0;j<6;j++)p.box(x+.04,.40+j*.028,z+.236,.238,.010,.015,'#93a49f');
  p.rod([x+.377,1.02,z],[x+.35,.45,z+.066],.012,C.graphite);p.rod([x+.35,.45,z+.066],[x+.249,.37,z+.12],.012,C.graphite);p.rod([x+.249,.37,z+.12],[x+.23,.41,z+.14],.012,C.graphite);
  ({x,z}=F.stool);p.cylinder(x,.48,z,.40,.091,.40,C.rose);p.cylinder(x,.302,z,.062,.29,.062,C.chrome);
  for(let i=0;i<5;i++){const a=i*2*pi/5,dx=.212*Math.cos(a),dz=.212*Math.sin(a);p.rod([x,.175,z],[x+dx,.096,z+dz],.031,C.chrome);wheel(p,x+dx,z+dz,.034);}
  cabinet(p,F.examCabinet,4);modelBench(p);
  // Gathered curtain, not a solid screen across the entrance. Its track wraps
  // above the chair; the occupied floor rectangle is only the gathered length.
  const f=F.curtain;p.rod([f.x,2.66,-2.73],[f.x,2.66,.86],.028,C.chrome);
  for(const tz of [-2.54,.68])p.rod([f.x,2.66,tz],[f.x,3.116,tz],.017,C.chrome);
  for(let i=0;i<10;i++){
    const zz=f.z-.54+i*.120;p.rod([f.x,2.45,zz],[f.x,2.66,zz],.011,C.chrome);
  }
  const desk=F.consultDesk;p.pad(desk.x,.757,desk.z,desk.w,.064,desk.d,C.oak);
  p.box(desk.x-.78,.375,desk.z,.57,.706,.62,C.milk);p.box(desk.x+.96,.382,desk.z,.062,.703,.64,C.chrome);
  p.box(desk.x+.014,.894,desk.z+.074,.11,.235,.10,C.iron);monitor(p,desk.x+.015,1.175,desk.z+.081,.612,.367,13,pi);
  p.pad(desk.x+.02,.81,desk.z-.17,.41,.022,.13,C.graphite);
  ({x,z}=F.deskSeat);p.pad(x,.465,z,.46,.076,.427,C.teal);p.pad(x,.708,z-.18,.428,.332,.071,C.green);p.cylinder(x,.25,z,.064,.348,.064,C.chrome);p.cylinder(x,.07,z,.41,.063,.41,C.iron);
  p.frame(-7.99,1.79,4.69,.80,.80,pi,5,C.oak);
}

function shadowlessLamp(p:ClinicParts,x:number,z:number){
  p.cylinder(x+.87,3.015,z-.60,.44,.204,.44,C.milk);p.cylinder(x+.87,2.84,z-.60,.14,.26,.14,C.chrome);
  p.rod([x+.87,2.766,z-.60],[x-.345,2.766,z-.79],.079,C.milk);p.egg(x-.345,2.766,z-.79,.148,.122,.148,C.iron);
  p.rod([x-.345,2.765,z-.79],[x-.39,2.43,z-.07],.079,C.milk);p.rod([x-.39,2.43,z-.07],[x,2.40,z],.060,C.chrome);
  // Parallelogram link, hinge axle endcaps and the retainer around the yoke.
  p.rod([x-.405,2.747,z-.775],[x-.449,2.422,z-.073],.028,C.chrome);
  for(const [u,y,v] of [[-.36,2.753,-.78],[-.397,2.428,-.071]]){
    p.cylinder(x+u,y,z+v,.111,.159,.111,C.milk,0,0,pi/2);p.cylinder(x+u-.085,y,z+v,.064,.015,.064,C.iron,0,0,pi/2);
  }
  // +Z edge is higher, so the light is aimed down toward the approach to the table.
  const angle=-.39,c=Math.cos(angle),s=Math.sin(angle);
  const local=(u:number,y:number,v:number):V=>[x+u,2.327+c*y-s*v,z+s*y+c*v];
  p.add(p.poles,local(0,0,0),[.32,.126,.32],C.milk,angle);
  for(let i=0;i<5;i++){
    const a=i*2*pi/5,u=.275*Math.sin(a),v=.275*Math.cos(a);p.add(p.poles,local(u,.002,v),[.35,.102,.35],C.milk,angle);
    p.add(p.poles,local(u,-.058,v),[.316,.025,.316],C.chrome,angle);
    for(let j=0;j<7;j++){
      const aa=j*2*pi/6,du=j<6?.092*Math.sin(aa):0,dv=j<6?.092*Math.cos(aa):0;
      p.add(p.bulbs,local(u+du,-.075,v+dv),[.073,.015,.073],j%3?'#faf1d1':'#cde5df',angle);
    }
  }
  p.add(p.poles,local(0,-.115,0),[.051,.17,.051],C.teal,angle);p.add(p.poles,local(0,-.206,0),[.089,.023,.089],C.mint,angle);
}
export function operatingRoom(p:ClinicParts){
  let {x,z}=F.table;
  p.pad(x,.11,z,.735,.17,1.11,C.chrome);p.pad(x,.369,z,.43,.421,.58,C.milk);p.pad(x,.576,z,.38,.123,.57,C.iron);
  p.pad(x,.70,z,.76,.146,2.04,C.chrome);
  for(const [v,len,up] of [[-.79,.395,.044],[-.251,.64,.034],[.358,.515,.027]])p.pad(x,.834+up,z+v,.668,.116,len,'#568d8b');
  for(const k of [-1,1]){
    p.pad(x+k*.173,.843,z+.824,.326,.109,.438,C.teal);p.rod([x+k*.363,.719,z-.9],[x+k*.363,.719,z+.89],.026,C.graphite);
    p.rod([x+k*.36,.710,z-.29],[x+k*.482,.795,z-.29],.037,C.chrome);p.pad(x+k*.47,.823,z-.245,.137,.059,.56,C.teal);
  }
  p.pad(x,.955,z-.834,.425,.102,.31,C.mint); shadowlessLamp(p,x,z-.13);
  ({x,z}=F.anaesthesia);wheels(p,x,z,.81,.62);p.pad(x,.171,z,1.0,.104,.73,C.milk);p.box(x-.085,.60,z,.56,.76,.595,C.porcelain);
  for(let j=0;j<3;j++){
    p.box(x-.085,.361+.193*j,z+.306,.514,.17,.029,j===2?C.slate:C.milk);p.box(x-.085,.395+.193*j,z+.333,.197,.022,.034,C.chrome);
  }
  p.pad(x-.04,1.008,z,.95,.075,.673,C.milk);p.box(x-.09,1.147,z-.117,.16,.25,.12,C.chrome);
  monitor(p,x-.115,1.474,z-.13,.70,.443,8,-.22);p.cylinder(x+.326,.61,z,.199,.66,.199,C.green);p.egg(x+.326,.93,z,.19,.146,.19,C.mint);p.box(x+.326,1.036,z,.058,.091,.055,C.chrome);
  for(let i=0;i<4;i++)p.cylinder(x-.31+.095*i,1.063,z+.163,.049,.035,.049,i%2?C.teal:C.iron);
  const hose:V[]=[[x-.39,1.02,z+.15],[x-.477,.84,z+.28],[x-.473,.45,z+.32],[x-.39,.35,z+.31],[x-.318,.41,z+.309],[x-.304,.66,z+.309]];
  for(let i=1;i<hose.length;i++)p.rod(hose[i-1],hose[i],.034,'#9bb1b3');
  ({x,z}=F.steelCart);wheels(p,x,z,.75,.46);
  for(let i of [-1,1])for(let j of [-1,1])p.rod([x+i*.372,.126,z+j*.219],[x+i*.372,.91,z+j*.219],.028,C.chrome);
  for(const y of [.33,.81]){p.pad(x,y,z,.84,.046,.53,C.chrome);p.box(x,y+.044,z-.235,.80,.062,.022,C.iron);}
  instrumentTray(p);bottle(p,x+.20,.353,z-.06,C.milk,.66);
  cabinet(p,F.orCabinet,5);
  // Auxiliary supply rail with connectors, suction jar and theatre clock on
  // the visible service wall. Slim wall mounts stay outside the walking inset.
  const railX=8.471,railZ=-5.97;
  p.box(railX,1.47,railZ,.068,.405,2.72,'#b1c5c1');p.box(railX-.04,1.65,railZ,.036,.046,2.73,C.chrome);
  p.frame(railX-.058,1.47,railZ+.18,.61,.32,-pi/2,10,C.milk);
  for(let j=0;j<3;j++){const q=railZ-.32-.26*j;p.cylinder(railX-.059,1.44,q,.094,.05,.094,C.iron,0,0,pi/2);p.cylinder(railX-.093,1.44,q,.059,.023,.059,j%2?C.rose:C.teal,0,0,pi/2);}
  const clockZ=railZ+.77;p.cylinder(railX,2.26,clockZ,.49,.065,.49,C.iron,0,0,pi/2);p.cylinder(railX-.038,2.26,clockZ,.455,.018,.455,C.white,0,0,pi/2);
  for(let i=0;i<12;i++){const a=i*pi/6;p.box(railX-.052,2.26+.188*Math.cos(a),clockZ+.188*Math.sin(a),.010,i%3?.022:.036,.014,C.graphite,a);}
  p.rod([railX-.062,2.26,clockZ],[railX-.062,2.38,clockZ+.089],.014,C.graphite);p.rod([railX-.065,2.26,clockZ],[railX-.065,2.28,clockZ-.091],.020,C.teal);
  const scrub=F.scrub;cabinet(p,scrub,3,-1);p.add(p.bowls,[scrub.x,.913,scrub.z-.014],[.66,.19,.40],C.chrome);tap(p,scrub.x,.913,scrub.z+.201,-1);bottle(p,scrub.x+.61,.90,scrub.z+.10,C.mint);
  ({x,z}=F.iv);p.cylinder(x,1.02,z,.027,1.84,.027,C.chrome);
  for(let i=0;i<5;i++){const a=i*2*pi/5,dx=.194*Math.sin(a),dz=.194*Math.cos(a);p.rod([x,.174,z],[x+dx,.101,z+dz],.026,C.chrome);wheel(p,x+dx,z+dz,.034);}
  p.rod([x-.144,1.95,z],[x+.144,1.95,z],.021,C.chrome);p.box(x-.12,1.824,z,.144,.185,.058,C.milk);p.box(x-.12,1.805,z+.035,.103,.07,.009,C.mint);
}

export const MIRROR_Y=1.605;
export function washroom(p:ClinicParts){
  const vanity=F.sinks; cabinet(p,vanity,4);const {x,z}=vanity;
  for(const u of [-.664,.664]){
    // Vessel bowls sit ON the stone, unlike an inset basin that would need a hole.
    p.add(p.bowls,[x+u,1.002,z+.046],[.735,.215,.43],C.porcelain);
    p.cylinder(x+u,.940,z+.046,.057,.007,.044,C.iron);tap(p,x+u, .923,z-.15);
    p.pad(x+u,MIRROR_Y,-8.879,1.113,.827,.045,C.chrome);p.lit(x+u,2.042,-8.82,.76,.035,.068,'#f7ebd9');
  }
  bottle(p,x,.902,z+.01,C.green,.80);p.poster(-2.70,1.72,-8.876,.465,0,5);
  for(const r of STALL_PANELS){
    p.box(r.x,1.14,r.z,r.w,1.84,r.d,'#a5b9ad');
    const face=r.d>r.w;
    p.box(r.x,2.065,r.z,r.w+(face?.012:0),.026,r.d+(face?0:.012),C.chrome);
    if(r.w>1.8)for(const q of [-.83,.83])p.cylinder(r.x+q,.115,r.z,.052,.22,.052,C.chrome);
  }
  for(const [{closed,z:tz,front},toilet] of STALLS.map((s,i)=>[s,TOILETS[i]] as const)){
    for(const v of [-.53,.53]){p.box(front,1.15,tz+v,.092,1.85,.043,C.chrome);p.cylinder(front,.117,tz+v,.058,.225,.058,C.chrome);}
    const xx=toilet.x;
    p.pad(xx-.20,.40,tz,.22,.69,.431,C.porcelain);p.pad(xx-.20,.777,tz,.24,.05,.464,C.milk);p.egg(xx-.18,.805,tz,.060,.011,.048,C.chrome);
    p.egg(xx+.025,.183,tz,.335,.336,.294,C.porcelain);p.add(p.bowls,[xx+.062,.347,tz],[.617,.209,.42],C.porcelain);
    p.egg(xx+.059,.285,tz,.159,.015,.087,'#a7c5c4');
    if(closed){p.box(front+.04,1.16,tz+.34,.024,.119,.081,C.chrome);p.box(front+.058,1.178,tz+.34,.012,.027,.046,C.rose);}
    else{p.box(front-.83,1.16,tz+.536,.082,.12,.022,C.chrome);}
    p.box(xx+.13,.8,tz-.996,.21,.26,.085,C.milk);p.box(xx+.13,.699,tz-.933,.15,.087,.026,C.white);
  }
  // Full-height ceramic splashback, with grouted joints geometry only at
  // standing-eye scale. The panel sits behind the basin and mirrors.
  p.box(-4.49,1.034,-8.914,3.72,2.06,.030,'#c7d7ce');
  for(let i=0;i<7;i++)p.box(-6.21+i*.55,1.03,-8.896,.010,2.05,.006,'#adbfb6');
  for(let i=1;i<6;i++)p.box(-4.49,i*.37,-8.895,3.72,.009,.006,'#adbfb6');
  hygieneStation(p);
}

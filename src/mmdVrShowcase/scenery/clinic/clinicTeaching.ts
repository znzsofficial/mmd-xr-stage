import { EXHIBITS, FIXTURES as F, STALL_BINS, type ClinicRect } from './clinicLayout';
import { C, type ClinicParts } from './clinicParts';

export function modelBench(p:ClinicParts){
  const labels=['pelvisBase','uterusBase','pregnancyBase'] as const;
  for(const [i,{x,z,w,d}] of EXHIBITS.entries()){
    p.pad(x,.921,z,w,.046,d,C.oak);p.pad(x,.958,z,w-.014,.063,d-.012,C.pine);
    p.label(x,.957,z+d/2-.003,w*.79,.055,0,labels[i]);
    p.rod([x,.977,z-.045],[x,i===1?1.24:1.08,z-.045],.031,C.chrome);
  }
  p.teachingPoster(EXHIBITS[0].x,2.10,-3.142,.76,0,'pelvisPlate');
  p.poster(EXHIBITS[1].x,2.10,-3.142,.76,0,3);p.poster(EXHIBITS[2].x,2.10,-3.142,.76,0,4);
}

export function seatedNurse(p:ClinicParts){
  const {x,z}=F.deskSeat,scrubs='#648f9a',sleeve='#8cb0b5',skin='#c9987d',hair='#533e3b';
  // A seated static figure on the existing seat, facing its keyboard (+Z).
  p.egg(x,.605,z+.035,.333,.237,.238,scrubs);
  p.egg(x,.813,z+.026,.367,.421,.249,scrubs,-.065);
  p.cylinder(x,.995,z+.052,.095,.104,.09,skin);
  p.egg(x,1.13,z+.060,.204,.25,.191,skin,.07);
  p.egg(x,1.192,z+.036,.214,.164,.203,hair,.04);p.egg(x,1.13,z-.038,.182,.162,.091,hair);
  p.egg(x,1.117,z-.092,.107,.099,.101,hair);p.egg(x,1.247,z+.03,.215,.095,.201,sleeve,-.05);
  p.egg(x,1.133,z+.15,.039,.049,.039,skin);
  for(const k of [-1,1]){
    p.egg(x+k*.052,1.16,z+.14,.015,.012,.008,hair);
    p.rod([x+k*.156,.939,z+.04],[x+k*.213,.826,z+.119],.101,sleeve);
    p.rod([x+k*.209,.831,z+.114],[x+k*.191,.773,z+.287],.068,skin);
    p.rod([x+k*.191,.773,z+.287],[x+k*.111,.827,z+.603],.059,skin);
    p.egg(x+k*.108,.824,z+.634,.069,.041,.091,skin);
    p.rod([x+k*.087,.573,z+.055],[x+k*.105,.515,z+.348],.134,'#486775');
    p.egg(x+k*.103,.515,z+.35,.135,.135,.136,'#486775');
    p.rod([x+k*.105,.515,z+.35],[x+k*.104,.122,z+.329],.093,'#486775');
    p.pad(x+k*.104,.075,z+.389,.108,.081,.196,C.milk);
  }
  p.box(x-.09,.892,z+.136,.062,.051,.012,C.white,0,-.18,-.10);
}

export function instrumentTray(p:ClinicParts){
  const {x,z}=F.steelCart;
  p.pad(x,.842,z,.786,.018,.435,C.chrome);p.pad(x,.852,z,.75,.006,.394,'#315e62');
  for(const k of [-1,1]){
    p.box(x+k*.389,.865,z,.011,.035,.432,C.chrome);
    p.box(x,.865,z+k*.213,.777,.035,.011,C.chrome);
    p.rod([x+k*.155,.833,z-.227],[x+k*.155,1.016,z-.227],.009,C.chrome);
  }
  p.box(x,.999,z-.227,.369,.182,.016,C.pine);p.label(x,.999,z-.217,.359,.174,0,'inventory');
  p.box(x,.738,z+.259,.47,.108,.014,C.iron);p.label(x,.738,z+.268,.458,.099,0,'instrumentLabel');
  for(let i=0;i<3;i++)p.pad(x-.17,.363+i*.024,z,.292,.021,.213,C.mint);
}

function disposalBin(p:ClinicParts,f:ClinicRect,small=false){
  const {x,z,w,d}=f,h=small?.49:.59,front=small?1:-1,yaw=small?0:Math.PI;
  p.pad(x,h*.48,z,w*.92,h*.90,d*.87,'#809a96');p.pad(x,h-.043,z,w,.034,d,C.graphite);
  p.pad(x,h-.013,z,w,.045,d,C.milk);p.box(x,h*.17,z+front*d*.45,w*.35,.025,d*.20,C.chrome);
  p.box(x,h-.065,z-front*d*.44,w*.48,.038,.038,C.iron);
  p.label(x,h*.58,z+front*(d*.435+.002),w*.72,w*.28,yaw,'binLabel');
}

export function hygieneStation(p:ClinicParts){
  const {x,z,w,d}=F.supplyShelf,front=z-d/2,yaw=Math.PI;
  p.pad(x,.099,z,w-.073,.153,d-.06,C.iron);p.box(x,.79,z+.192,w,1.36,.054,'#b9c9bd');
  for(const k of [-1,1])p.box(x+k*(w/2-.020),.79,z,.04,1.36,d,C.milk);
  for(const y of [.21,.63,1.02,1.46])p.pad(x,y,z,w,.040,d,C.oak);
  for(const k of [-1,1])p.box(x+k*.223,1.235,z,.018,.41,d-.055,C.milk);
  p.box(x,1.548,z+.143,w-.03,.185,.046,C.pine);p.label(x,1.548,z+.118,w-.044,.17,yaw,'supplyHeader');
  const packs=[['testPack','#adced2',.315,.169],['padPack','#deb4bd',.245,.22],['briefPack','#bdc8d9',.256,.217]] as const;
  for(const [i,[key,tint,pw,ph]] of packs.entries()){
    const px=x+(.448-i*.448);
    for(const [shelf,y] of [1.046,.656].entries()){
      // Stock extends back into the cubby; front facings expose the printed
      // silhouettes and Chinese names even when viewed without the tour.
      for(let j=0;j<(shelf?2:3);j++){
        const pz=front+.086+.117*j;
        p.pad(px+.016*(j%2),y+ph/2,pz,pw,ph,.096,tint);
        p.label(px+.016*(j%2),y+ph/2,pz-.049,pw-.011,ph-.010,yaw,key);
      }
    }
    for(let j=0;j<3;j++)p.pad(px,.251+j*.043,z,pw*.95,.040,.231,tint);
  }
  // Individually wrapped flat pads/briefs and a capped demo stick displayed
  // on the upper shelf, distinct from the bulk stock below.
  p.pad(x+.448,1.489,front+.125,.204,.014,.066,'#c4d6d1');
  p.pad(x+.451,1.506,front+.123,.169,.018,.037,C.white);p.pad(x+.506,1.510,front+.123,.066,.020,.039,'#82b9c3');
  p.box(x+.425,1.517,front+.123,.026,.003,.016,'#6d8f97');
  for(const [dx,tint] of [[0,'#e7c7c9'],[-.448,'#c1cddc']] as const){
    for(let j=0;j<2;j++){p.pad(x+dx,1.494+j*.023,front+.135,.202,.021,.143,tint);p.box(x+dx,1.506+j*.023,front+.135,.037,.002,.133,C.white);}
  }
  disposalBin(p,F.disposal);for(const f of STALL_BINS)disposalBin(p,f,true);
  p.teachingPoster(-3.35,1.75,-3.358,.83,yaw,'postpartumPlate');
}

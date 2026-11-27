import type {Part} from '../SceneryBatch';
import {span} from '../detailParts';
import {bench,booth,canopyEaves,floors,gauge,lantern,posts,railRuns,sign} from './shoreLayout';

export function stationParts(){
  const enamel:Part[]=[],trim:Part[]=[],tubes:Part[]=[],glow:Part[]=[],land:Part[]=[],pines:Part[]=[];
  const steel='#37625e',mint='#89a99a',cream='#e3d6b0',oxide='#a65338',brass='#bc975b';
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,parts=trim,rz=0,rx=0)=>parts.push({p:[x,y,z],s:[w,h,d],color,rz,rx});
  const rod=(a:Part['p'],b:Part['p'],d:number,c=steel)=>tubes.push(span(a,b,d,c));
  let seed=281047;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  // Salt-stained masonry below a pale mineral cap; lower steps turn into
  // a causeway at ebb. Never use the ocean surface as a walkable plane.
  for(const f of floors){const bottom=-1.64;box(f.x,(bottom+f.y)/2,f.z,f.w,f.y-bottom,f.d,f.y<0?'#777e72':'#939489');
    if(f.y>=0){box(f.x,f.y-.074,f.z,f.w+.038,.14,f.d+.038,'#c1bcaa');}
  }
  for(let i=0;i<42;i++)for(const z of [-14.023,-9.977]){const x=-3.85+i*.50;if(z>-10&&x<3.2)continue;
    box(x,-.47-rand()*.17,z,.43+rand()*.07,.26+rand()*.21,.016,i%4?'#757f77':'#827f72');}
  for(let i=0;i<22;i++){const z=-13.5+i;box(-3.78,.003,z,.19,.006,.95,'#e8c975');box(-3.40,.002,z,.03,.004,.93,'#d1b194');}
  for(let x=-3;x<3;x+=1.2)for(let z=-14;z<7;z+=1.8)box(x,.002,z+.91,.012,.004,1.78,'#aaa698');
  for(let z=-13;z<8;z+=1.8)box(-.54,.002,z,6.53,.004,.012,'#a7a398');
  // Resting rail, fishplates and the terminal buffer; track ends beside
  // the station sign rather than continuing out over the sea.
  box(-6,-.71,4,3.96,.55,28,'#666b63');
  for(let z=-8.9;z<18;z+=.62){box(-6,-.405,z,2.48,.14,.21,rand()>.55?'#69594b':'#5e534a');for(const x of [-6.71,-5.29])box(x,-.306,z,.29,.045,.18,'#665e50');}
  for(const x of [-6.71,-5.29]){box(x,-.268,4.45,.127,.07,27.55,'#87735e');box(x,-.197,4.45,.065,.10,27.55,'#816e59');box(x,-.126,4.45,.085,.042,27.55,'#b1afa1');
    trim.push(span([x,-.14,-8.94],[x,.75,-8.12],.16,oxide),span([x,-.14,-7.18],[x,.75,-8.12],.16,oxide));}
  box(-6,.76,-8.15,2.62,.27,.30,'#ad6249');for(const x of [-6.77,-5.23]){box(x,.76,-7.94,.31,.32,.22,'#453f37');box(x,.76,-8.325,.69,.083,.016,cream);}
  // Enamelled riveted ironwork; shallow gable, visible rafters and battens.
  for(const post of posts){const {x,z}=post;box(x,1.47,z,.13,2.94,.15,steel,enamel);box(x,.16,z,.24,.32,.26,'#888579');box(x,1.44,z,.155,.061,.175,brass);
    for(const dz of [-.55,.55])enamel.push(span([x,2.41,z],[x,2.94,z+dz],.065,mint));}
  for(const x of [-3.25,2.68])box(x,2.98,-1.28,.14,.19,11.42,steel,enamel);
  for(let z=-6.82;z<4.56;z+=1.12){box(-.285,3.03,z,6.32,.12,.077,'#817e64');for(const side of [-1,1])trim.push(span([-.285,3.64,z],[-.285+side*3.35,3.05,z],.077,cream));}
  for(const side of [-1,1]){const slope=-side*.1737;box(-.285+side*1.69,3.36,-1.23,3.48,.105,11.7,'#a6baaf',enamel,slope);
    box(canopyEaves.x+side*canopyEaves.w/2,canopyEaves.y,canopyEaves.z,.105,.19,canopyEaves.d,steel,enamel);
    for(let z=-7.01;z<=4.61;z+=.34)box(-.285+side*1.69,3.431,z,3.45,.028,.026,'#a7b4a1',enamel,slope);}
  box(-.285,3.68,-1.23,.15,.10,11.73,steel,enamel);
  for(const z of [-5.2,2.66]){rod([-.35,3.46,z],[-.35,2.79,z],.022);box(-.35,2.76,z,.45,.07,.28,steel);box(-.35,2.718,z,.34,.025,.21,'#ffe7b6',glow);}
  // Old ticket office: a service opening, sliding sash, shelf and lower
  // vertical boarding; windows face the passenger aisle (west side).
  const b=booth,front=b.x-b.w/2;box(b.x,1.26,b.z,b.w,2.52,b.d,'#e4e3d6');box(b.x,.38,b.z,b.w+.035,.76,b.d+.035,'#8daba0');
  for(let z=b.z-b.d/2+.08;z<b.z+b.d/2;z+=.155)box(front-.021,.38,z,.018,.68,.012,steel);
  box(front-.025,1.53,b.z,.04,1.15,3.25,'#3d5c5a');box(front-.052,1.56,b.z,.042,.91,3.01,'#75959a');
  for(const z of [-.9,0,.95])box(front-.081,1.54,b.z+z,.045,1.04,.054,cream);
  for(const y of [1.045,1.85,2.06])box(front-.09,y,b.z,.07,.055,3.2,cream);
  box(front-.15,1.016,b.z,.35,.07,3.5,'#9a7959');box(b.x,2.6,b.z,b.w+.17,.12,b.d+.24,steel);
  for(let z=-.72;z<3.7;z+=.32)box(b.x,2.671,z,b.w+.12,.022,.028,mint);
  for(const dz of [-.94,.94]){const z=bench.z+dz;box(bench.x,.20,z,.48,.40,.13,steel,enamel);box(bench.x+.26,.59,z,.075,.59,.075,steel,enamel);}
  for(let i=0;i<4;i++)box(bench.x-.24+i*.14,.454,bench.z,.118,.061,bench.d,i%2?'#ba895e':'#b17e55');
  for(let i=0;i<3;i++)box(bench.x+.29,.595+i*.11,bench.z,.065,.092,bench.d,'#ad7d57');
  for(const dx of [-.90,.90]){const x=sign.x+dx;box(x,1.14,sign.z,.072,2.28,.072,steel,enamel);box(x,.10,sign.z,.20,.20,.20,'#969385');}
  box(sign.x,1.85,sign.z,2.17,.84,.115,steel,enamel);
  // Tubular guard rails leave both sets of steps open from the dry upper quay.
  for(const [x,z,a,bz] of railRuns){const n=Math.ceil(Math.hypot(a-x,bz-z)/1.55);for(let i=0;i<=n;i++){const k=i/n,px=x+(a-x)*k,pz=z+(bz-z)*k;
    rod([px,.025,pz],[px,.91,pz],.049);box(px,.029,pz,.135,.058,.135,'#696f63');}
    for(const y of [.49,.89])rod([x,y,z],[a,y,bz],y>.5?.049:.030);}
  const l=lantern;box(l.x,.17,l.z,1,.34,1,'#a2a18c');
  rod([l.x,.32,l.z],[l.x,3.53,l.z],.51,cream);for(const y of [1.05,2.40])rod([l.x,y,l.z],[l.x,y+.58,l.z],.523,oxide);
  rod([l.x,3.48,l.z],[l.x,3.62,l.z],.82,'#445d57');rod([l.x,3.63,l.z],[l.x,4.13,l.z],.53,'#f9df95');
  for(let i=0;i<6;i++){const x=l.x+.278*Math.sin(i*Math.PI/3),z=l.z+.278*Math.cos(i*Math.PI/3);rod([x,3.62,z],[x,4.15,z],.031);}
  rod([l.x,4.12,l.z],[l.x,4.23,l.z],.76,steel);rod([l.x,4.23,l.z],[l.x,4.5,l.z],.065,brass);
  box(gauge.x,.49,gauge.z,.19,.98,.21,steel,enamel);box(gauge.x,1.02,gauge.z,.44,.33,.15,cream,enamel);
  // Shoreline sweeps around the inland side of the track; cedars follow the
  // contour instead of ringing the horizon. A fishing hamlet at its foot.
  for(let i=0;i<50;i++){const z=-33+rand()*65,x=-10-rand()*17,y=-1.4+Math.min(4,(-x-10)*.18);const h=2+rand()*4;
    land.push({p:[x,y,z],s:[6+rand()*8,h,4+rand()*9],rz:(rand()-.5)*.25,ry:rand()*5,color:['#849b83','#738f7d','#9cae91','#849687'][i%4]});
    if(i%2){const sy=y+h*.42;pines.push({p:[x,sy+.9,z],s:[1.05,2.8,1.12],color:'#537769'},{p:[x,sy+1.78,z],s:[.75,1.93,.79],color:'#608673'});}}
  for(let i=0;i<9;i++){const x=-10.9-(i%2)*2.6,z=-17+i*4.9,y=.27+rand()*.4;box(x,y,z,2.65,2.1,3.1,'#d9cdb1');
    for(const s of [-1,1])box(x+s*.73,y+1.31,z,1.56,.14,3.46,i%3?'#706f65':'#a77a60',trim,-s*.32);
    for(const dz of [-.76,.76])box(x+1.34,y+.10,z+dz,.02,.69,.65,'#566d6a');}
  // The exposed outer harbour: low reefs and a long breakwater, well below
  // the skyline. Open water ahead of the performer remains uncluttered.
  for(let i=0;i<31;i++){const x=-22+i*.73,z=-25.4+Math.sin(i*.13)*2.5;land.push({p:[x,-.54+rand()*.34,z],s:[1+rand()*2,.70+rand()*1.27,1.4+rand()*1.2],ry:rand()*6,color:i%2?'#697e77':'#7c8c80'});}
  return {enamel,trim,tubes,glow,land,pines};
}

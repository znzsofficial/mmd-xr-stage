import type {Part} from './SceneryBatch';
import {span} from './detailParts';

// Pool origin in meadow metres. Both rooms draw the actual arcade, so walking
// through the gate changes only the active district, not the user's heading.
export const POOL_ORIGIN_Z=-20;
export const LIDO_ENTRY={x:0,z:11.15,w:3.64,d:9};
export const LIDO_PIERS=[8.75,11.55,14.35].flatMap(z=>[-1.66,1.66].map(x=>({x,z,w:.39,d:.43})));
export const TIME_DECK={x:5.72,z:-20.55,w:5.05,d:2.72};
export const GUARD_CHAIR={x:7.05,z:-20.65,w:1.4,d:1.70};
export const PACE_CLOCK={x:4.77,z:-20.94,w:.50,d:.43};
export const PAVILION_POSTS=[-8,-4,0,4,8].map(x=>({x,z:-20.89,w:.12,d:.12}));
export const LIDO_ROUTE_SHOTS={
  gate:{key:'lidoGate',eye:[.75,1.61,-4.1],aim:[0,1.78,-12.1]},
  clock:{key:'lidoClock',eye:[6.14,1.58,-16.49],aim:[5.85,1.30,-20.91]},
  return:{key:'lidoLookBack',eye:[.92,1.63,3.68],aim:[0,1.38,13.52]},
} as const;
export function inLidoApproach(x:number,z:number,margin=0){return Math.abs(x)<2.04+margin&&z< -3.8+margin&&z> -14.1-margin;}

// Append to an existing instance batch: no second pool/station running behind a gate.
export function arcadeParts(room:'pool'|'lawn'):Part[]{
  const dz=room==='pool'?0:POOL_ORIGIN_Z,out:Part[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>out.push({p:[x,y,z+dz],s:[w,h,d],color});
  box(0,-.064,LIDO_ENTRY.z,LIDO_ENTRY.w,.144,LIDO_ENTRY.d,'#ded1b9');
  for(const x of [-1.47,1.47])box(x,.010,LIDO_ENTRY.z,.067,.002,LIDO_ENTRY.d,'#547f80');
  for(let i=0;i<14;i++)box(0,.010,6.92+i*.65,3.52,.002,.015,'#a8a697');
  for(const {x,z,w,d} of LIDO_PIERS){box(x,.30,z,w,.6,d,'#509499');box(x,.625,z,w+.04,.056,d+.04,'#ece1c3');box(x,1.64,z,.14,2.04,.15,'#678884');}
  for(const x of [-1.66,1.66])box(x,2.71,11.55,.16,.18,6.10,'#669494');
  for(let i=0;i<12;i++)box(0,2.86,8.56+i*.54,3.68,.12,.14,'#cba87a');
  box(0,2.43,8.75,3.19,.40,.105,'#356c74');
  for(const s of [-1,1])for(let i=0;i<3;i++)box(s*1.66,1.03+i*.28,10.15,.054,.06,2.64,'#879c94');
  return out;
}
export function distantLido():Part[]{return [
  {p:[.8,1.44,-23.15+POOL_ORIGIN_Z],s:[18.5,2.86,1.42],color:'#f2dfb9'}, {p:[.8,3,-22.5+POOL_ORIGIN_Z],s:[19.2,.30,3.8],color:'#649592'},
  {p:[0,-.035,-12.4+POOL_ORIGIN_Z],s:[10.1,.1,13.35],color:'#76b8bd'},
  ...[-5.45,5.45].map(x=>({p:[x,1.5,-9.5+POOL_ORIGIN_Z] as Part['p'],s:[.07,3,.07] as Part['s'],color:'#87a4a1'})),
  ...Array.from({length:17},(_,i)=>({p:[(i-8)*.59,2.66+((i-8)/8)**2*.24,-9.5+POOL_ORIGIN_Z] as Part['p'],s:[.34,.20,.05] as Part['s'],color:i%2?'#dd805d':'#639a9c'})),
];}
export function judgeStand(){
  const out:Part[]=[],{x,z}=GUARD_CHAIR,frame='#d2d8c8',wood='#c4855d';
  const box=(dx:number,y:number,dz:number,w:number,h:number,d:number,color:string)=>out.push({p:[x+dx,y,z+dz],s:[w,h,d],color});
  for(const side of [-1,1]){
    out.push(span([x+side*.55,.06,z+.79],[x+side*.36,1.5,z+.12],.07,frame),span([x+side*.5,.06,z-.56],[x+side*.36,1.53,z-.24],.07,frame));
    box(side*.36,1.79,-.28,.065,.90,.065,frame);box(side*.37,1.70,.01,.076,.074,.62,wood);
    box(side*.47,.04,.78,.22,.08,.19,'#686f68');
    out.push(span([x+side*.47,.27,z-.49],[x+side*.40,1.15,z+.29],.043,frame));
  }
  for(let i=0;i<5;i++){box(0,.24+i*.24,.67-i*.115,.79,.057,.13,wood);box(0,1.44,-.24+i*.10,.80,.073,.09,wood);}
  for(let i=0;i<3;i++)box(0,1.83+i*.15,-.31,.85,.11,.065,wood);
  // Rescue tube with contrasting webbing on the outside of the frame.
  box(.442,1.56,-.02,.15,.17,.89,'#cc6647');for(const f of [-.26,.26])box(.445,1.56,f,.156,.18,.062,'#f2dcae');
  out.push(span([x+.45,1.52,z+.38],[x+.45,1.17,z+.20],.025,'#4f544f'),span([x+.45,1.17,z+.20],[x+.45,1.48,z-.39],.025,'#4f544f'));
  return out;
}

import type {Part} from '../SceneryBatch';

// Local +Z points out of the shop toward the pavement. The buildings close
// the long views along the street and form the opposite sides of the venues.
export const streetPlots=[
  // Front x/z, rotation, frontage, depth, eaves, upper floors, facade, joinery, name, trading line, window display.
  [-24.1,93.55,Math.PI,10.3,6.4,6.40,1,'#d9cbb3','#5e8982','潮汐器材社','LIDO SUPPLY  /  SWIM & SAIL','sail'],
  [-14.15,94.00,Math.PI,8.5,5.8,4.25,0,'#c49177','#466c64','帆布工房','HARBOUR CANVAS  /  SAIL LOFT','canvas'],
  [-4.10,93.62,Math.PI,9.7,6.2,8.85,2,'#ccc4ac','#56746c','体育街邮务所','POST & TELEGRAPH','post'],
  [13.20,93.80,Math.PI,8.2,6.4,5.83,1,'#d7ac8c','#7a6557','海岸印务','COASTAL LETTERPRESS','press'],
  [28.8,93.72,Math.PI,11.3,7.4,7.85,2,'#e7dcc4','#527d74','灯塔唱片','LIGHTHOUSE RECORDS','records'],
  [40.05,93.93,Math.PI,9.10,7.1,5.70,1,'#b6c3b7','#597886','晨报发行所','THE MORNING EDITION','news'],
  [40.6,64.45,Math.PI,8.8,5.4,6.48,1,'#eadfc7','#537568','南窗文具店','SOUTH WINDOW  /  STATIONERS','stationery'],
  [-7.4,68.62,Math.PI/2,9.5,5.6,5.2,1,'#ddd4bd','#5d817a','海站修表铺','HARBOUR WATCH REPAIR','clocks'],
  [-7.4,79.12,Math.PI/2,8.7,5.1,6.7,1,'#d7b79d','#826c5b','潮路药房','TIDE STREET PHARMACY','pharmacy'],
  [-46.4,69.5,Math.PI/2,10.8,6.9,7.7,2,'#c0c8b9','#708375','滨海会所','BATHING PAVILION','pavilion'],
  [52.4,79.75,-Math.PI/2,10.5,6.4,6.2,1,'#c8c6b5','#56796e','电工器材社','MARINE ELECTRICAL','electrical'],
] as const;

// The tide office rents the end wall of the pharmacy. Its counter looks onto
// sports street (+Z), not into the pharmacy's entrance on inland street (+X).
const [pharmacyX,pharmacyZ,,pharmacyWidth,pharmacyDepth]=streetPlots[8];
export const tideOffice={x:pharmacyX-pharmacyDepth/2,z:pharmacyZ+pharmacyWidth/2,w:pharmacyDepth};
function officeFittings():Part[]{
  const {x,z,w}=tideOffice,parts:Part[]=[];
  const add=(dx:number,y:number,dz:number,width:number,height:number,depth:number,color:string)=>
    parts.push({p:[x+dx,y,z+dz],s:[width,height,depth],color});
  // A sheltered collection window, not an extra freestanding kiosk. The
  // counter is low enough to see over when seated. The sides hold the hood.
  add(0,.43,.065,w-.30,.86,.18,'#4e726c');
  add(0,.875,.18,w-.24,.09,.44,'#c5af89');
  add(0,1.57,.063,w-.38,1.29,.14,'#475a57');
  add(0,2.305,.09,w-.24,.19,.22,'#ae8866');
  for(const hand of [-1,1]){
    add(hand*(w/2-.16),1.44,.13,.16,2.07,.30,'#b8b6a2');
    add(hand*(w/2-.29),2.50,.28,.085,.17,.60,'#536a63');
  }
  add(0,2.65,.46,w+.18,.14,1.20,'#b0b6a5');
  const returnDepth=1.08,frontEnd=1.06,frontStart=-pharmacyWidth+.08;
  add(w/2+.09+returnDepth/2,2.65,(frontStart+frontEnd)/2,returnDepth,.14,frontEnd-frontStart,'#b0b6a5');
  add(returnDepth/2,2.625,frontEnd+.0375,w+.18+returnDepth,.19,.075,'#487272');
  add(w/2+.09+returnDepth+.0375,2.625,(frontStart+frontEnd)/2,.075,.19,frontEnd-frontStart,'#487272');
  // A scale in fired enamel. Its rectangular carrier has narrow, proud
  // limestone coping; the dial and its scale are a single opaque print.
  add(0,4.70,.11,w-.32,2.72,.24,'#727c70');
  add(0,6.095,.12,w-.13,.10,.34,'#d9ccb1');
  return parts;
}
export const tideOfficeParts=officeFittings();

const [repairX,repairZ,,repairWidth]=streetPlots[7];
export const watchClock={x:repairX+1.03,y:3.74,z:repairZ-repairWidth/2+.45,w:.95,h:1.22,d:.20};
const {x:clockX,y:clockY,z:clockZ}=watchClock;
export const watchClockParts:Part[]=[
  {p:[repairX+.55,clockY+.48,clockZ],s:[1.13,.09,.10],color:'#536c62'},
  {p:[repairX+.55,clockY-.44,clockZ],s:[1.13,.075,.09],color:'#536c62'},
  {p:[clockX,clockY,clockZ],s:[watchClock.w,watchClock.h,watchClock.d],color:'#416461'},
  {p:[clockX,clockY+.64,clockZ],s:[1.03,.055,.28],color:'#ad9979'},
];

// Non-corner shops have either projecting canvas (including the valance) or
// a zinc eyebrow. Use the same rotated bounds for the high placement ray.
export function shopCanopy(i:number,frontage:number){
  if(streetPlots[i][11]==='pharmacy')return [];
  const w=frontage-.32;
  if(i%3===2)return [{w:frontage+.19,y:2.48,z:.42,h:.13,d:1.15,pitch:0}];
  return [{w,y:2.45,z:.47,h:.06,d:1.04,pitch:.165},{w,y:2.299,z:.98,h:.14,d:.055,pitch:0}];
}

export const shopBuildingBlocks=streetPlots.flatMap(([cx,cz,yaw,w,d,h],i)=>{
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const box=(x:number,z:number,width:number,depth:number,bottom:number,top:number)=>({
    x:cx+c*x+s*z,z:cz-s*x+c*z,w:Math.abs(c)*width+Math.abs(s)*depth,
    d:Math.abs(s)*width+Math.abs(c)*depth,bottom,top,
  });
  const canopy=shopCanopy(i,w).map(p=>{
    const height=p.h*Math.cos(p.pitch)+p.d*Math.sin(p.pitch),depth=p.d*Math.cos(p.pitch)+p.h*Math.sin(p.pitch);
    return box(0,p.z,p.w,depth,p.y-height/2,p.y+height/2);
  });
  const rooftop=i%3===1?[box(0,-d*.64,w*.79,d*.32,h+.17,h+.77),box(0,-d*.64,w*.79+.18,d*.32+.18,h+.77,h+.88)]:
    [box(w*.20,-d*.66,w*.39,d*.41,h+.07,h+.99),box(w*.20,-d*.66,w*.39+.19,d*.41+.22,h+.99,h+1.09)];
  return [box(0,-d/2,w,d,0,h),box(0,-d/2,w+.33,d+.39,h,h+.17),...canopy,...rooftop];
});

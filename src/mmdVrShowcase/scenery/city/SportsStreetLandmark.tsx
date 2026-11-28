import {useEffect,useMemo} from 'react';
import {Batch,type Part} from '../SceneryBatch';
import {noPick,paintedSurface} from '../sceneryPaint';
import {CITY_ORIGINS,cityPavements} from './site';
import {mapCase} from './streetFurniture';
import {inReturnView,type StreetRoom} from './streetGround';

const pine='#335b58',cream='#f1dfb8',teal='#417e7e',red='#c2684e';
function sportsMural(){return paintedSurface(1280,280,g=>{
  g.fillStyle=cream;g.fillRect(0,0,1280,280);
  // A fired-ceramic frieze: a swimmer breaks across two colours of surf.
  // The curved strokes are independent artwork, not a poster from the arcade.
  g.save();g.beginPath();g.rect(0,0,522,280);g.clip();
  g.fillStyle='#dca65e';g.beginPath();g.arc(247,108,79,0,Math.PI*2);g.fill();
  for(const [j,color] of [teal,'#739f91',pine].entries()){
    g.beginPath();const y=158+j*41;
    g.moveTo(-70,y);for(let i=0;i<7;i++){const x=-70+i*106;g.bezierCurveTo(x+25,y-31,x+59,y-27,x+93,y-8);g.quadraticCurveTo(x+102,y,x+106,y);}
    g.lineTo(680,310);g.lineTo(-70,310);g.closePath();g.fillStyle=color;g.fill();
  }
  g.lineWidth=25;g.lineCap='round';g.lineJoin='round';g.strokeStyle=red;g.beginPath();
  g.moveTo(102,154);g.quadraticCurveTo(151,139,187,133);g.lineTo(264,70);g.lineTo(347,121);g.lineTo(395,129);g.stroke();
  g.fillStyle=red;g.beginPath();g.ellipse(258,139,32,25,-.23,0,2*Math.PI);g.fill();
  g.strokeStyle=pine;g.lineWidth=5;g.beginPath();g.moveTo(253,142);g.lineTo(284,135);g.stroke();
  g.restore();g.fillStyle=pine;g.fillRect(522,0,758,280);g.fillStyle='#c1c9a6';g.fillRect(551,32,673,3);
  g.fillStyle=cream;g.font='700 115px system-ui,sans-serif';g.fillText('体 育 街',553,166,625);
  g.font='650 34px system-ui,sans-serif';g.fillText('SEASIDE   /   SPORTING QUARTER',558,223,655);
  g.fillStyle=red;g.fillRect(1231,53,10,170);
  // Glaze interrupts the artwork at the grout, rather than a second depth layer.
  g.lineWidth=1.8;g.strokeStyle='rgba(77,78,61,.29)';g.beginPath();
  for(let x=0;x<=1280;x+=40){g.moveTo(x,0);g.lineTo(x,280);}for(let y=0;y<=280;y+=40){g.moveTo(0,y);g.lineTo(1280,y);}g.stroke();
});}

function arcadeElevation():Part[]{
  const parts:Part[]=[];
  const add=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,rx=0)=>parts.push({p:[x,y,z],s:[w,h,d],color,rx});
  // The actual back wall is a solid two-storey block at z=-4.5. A high-sill
  // ribbon and a continuous cantilever distinguish it from the red entrance.
  for(let i=0;i<6;i++){
    const x=-5.75+2.30*i;
    add(x,1.88,-4.74,2.17,1.46,.20,'#66796e');
    add(x,1.86,-4.849,1.99,1.28,.038,i%2?'#84a5a4':'#87a9a7');
    add(x,2.31,-4.881,1.99,.29,.021,'#bbc9b7');
    for(const dx of [-.98,0,.98])add(x+dx,1.87,-4.896,.05,1.37,.074,pine);
    add(x,2.13,-4.909,2.03,.056,.082,pine);add(x,1.107,-4.86,2.23,.095,.44,'#d8d2b9');
    add(x+.53,.68,-4.708,.75,.40,.115,'#7a9186');
    for(let k=0;k<4;k++)add(x+.53,.55+k*.080,-4.778,.65,.023,.066,'#c1c3ab');
  }
  add(0,3.28,-5.04,14.44,.20,1.18,'#b9c2af');add(0,3.202,-5.65,14.55,.16,.13,pine);
  for(let j=0;j<8;j++)add(-6.62+j*1.89,3.04,-5.10,.075,.15,.87,'#688275',-.24);
  add(0,4.96,-4.72,13.26,2.52,.16,'#9c927a');add(0,6.285,-4.76,13.44,.11,.32,'#c7bda5');
  for(const s of [-1,1])add(s*6.86,4.97,-4.732,.14,3.00,.21,'#acc0ad');
  return parts;
}

function ArcadeWall(){
  const art=useMemo(sportsMural,[]),parts=useMemo(arcadeElevation,[]);
  useEffect(()=>()=>art.dispose(),[art]);
  const o=CITY_ORIGINS.arcadeHall;
  return <group name="city:arcade-sports-elevation" position={[o.x,0,o.z]}>
    <Batch name="city:arcade-glazed-window-ribbon" parts={parts}/>
    <mesh name="city:sports-ceramic-mural" rotation-y={Math.PI} position={[0,4.96,-4.805]} raycast={noPick} userData={{playerCollision:false}}>
      <planeGeometry args={[13.13,2.40]}/><meshStandardMaterial map={art} roughness={.73}/></mesh>
  </group>;
}

function cityMap(){return paintedSurface(864,448,g=>{
  const px=(x:number)=>35+(44-x)*6.9,py=(z:number)=>72+(89-z)*6.1;
  g.fillStyle='#ede6d0';g.fillRect(0,0,864,448);g.fillStyle=pine;g.fillRect(0,0,864,55);
  g.font='650 32px system-ui,sans-serif';g.fillStyle=cream;g.fillText('海站街区图',25,39);
  g.textAlign='right';g.font='650 20px system-ui,sans-serif';g.fillText('STATION DISTRICT   /   01',839,37);g.textAlign='left';
  for(const q of cityPavements){g.fillStyle='#b4b9a5';g.fillRect(px(q.x+q.w/2),py(q.z+q.d/2),q.w*6.9,q.d*6.1);}
  const route=[[21.4,43],[21.4,58.5],[1,58.5],[1,87],[29.1,87],[29.1,82.5]];
  g.strokeStyle=red;g.lineWidth=6;g.lineJoin='round';g.setLineDash([10,5]);g.beginPath();
  for(const [i,[x,z]] of route.entries()){if(i)g.lineTo(px(x),py(z));else g.moveTo(px(x),py(z));}g.stroke();g.setLineDash([]);
  const stops=[['01','花园诊所',8.6,53.8],['02','海站教室',39.97,53.6],['03','夏日泳池',-24.25,72.05],['04','电玩厅西廊',29.1,82.5]] as const;
  for(const [i,[n,title,x,z]] of stops.entries()){
    g.font='750 19px system-ui,sans-serif';
    g.fillStyle=i===3?red:pine;g.beginPath();g.arc(px(x),py(z),17,0,Math.PI*2);g.fill();g.fillStyle=cream;
    g.textAlign='center';g.font='750 19px system-ui,sans-serif';g.fillText(n,px(x),py(z)+7);
    const line=115+i*47;g.textAlign='left';g.fillStyle=i===3?red:pine;g.fillText(n,574,line);
    g.font='650 26px system-ui,sans-serif';g.fillText(title,621,line);
  }
  g.fillStyle=pine;g.font='650 23px system-ui,sans-serif';g.fillText('电玩厅正门',572,330);g.fillStyle=red;
  g.fillRect(572,340,253,3);g.font='600 22px system-ui,sans-serif';g.fillText('沿虚线至体育街左转',572,378);
  g.fillStyle=pine;g.font='600 19px system-ui,sans-serif';g.fillText('海站 · 站前公园',px(21.4)-56,py(43)+35);
  g.fillStyle=red;g.beginPath();g.arc(px(mapCase.x),py(mapCase.z),8,0,2*Math.PI);g.fill();
  g.font='700 18px system-ui,sans-serif';g.fillText('当前位置',px(mapCase.x)+13,py(mapCase.z)-5);
});}

function DistrictMap({shadows}:{shadows:boolean}){
  const art=useMemo(cityMap,[]),m=mapCase;useEffect(()=>()=>art.dispose(),[art]);
  const parts=useMemo(()=>{
    const p:Part[]=[{p:[0,m.y,0],s:[m.w,m.h,m.d],color:pine},
      {p:[0,m.y+m.h/2+.05,-.018],s:[m.w+.14,.082,.34],color:'#a1997c'}];
    for(const dx of [-.9,.9])p.push({p:[dx,.56,0],s:[.10,1.12,.10],color:pine},{p:[dx,.065,0],s:[.13,.13,.13],color:'#b2ac97'});
    return p;
  },[m]);
  return <group name="city:district-map-case" position={[m.x,0,m.z]}>
    <Batch name="city:map-frame" parts={parts} casts={shadows}/>
    <mesh name="city:district-map" position={[0,m.y,-m.d/2-.004]} rotation-y={Math.PI} raycast={noPick} userData={{playerCollision:false}}>
      <planeGeometry args={[m.w-.075,m.h-.075]}/><meshBasicMaterial map={art} toneMapped={false}/></mesh>
  </group>;
}

export function SportsStreetLandmark({room,shadows}:{room:StreetRoom;shadows:boolean}){
  // Pool sees the same rear wall via its existing ramp-side arcade envelope.
  // The active hall's return sees the opposite record shop, not its own rear.
  return <>{(room==='seasideTerminus'||room==='classroom'||room==='pool')&&<ArcadeWall/>}
    {inReturnView(room,mapCase.x,mapCase.z)&&<DistrictMap shadows={shadows}/>}</>;
}

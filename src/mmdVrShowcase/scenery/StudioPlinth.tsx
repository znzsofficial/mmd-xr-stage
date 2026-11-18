import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import { SIMPLE_FLOOR_RADIUS } from './placementAreas';
import { noPick, paintedSurface } from './sceneryPaint';

function floorInlay() {
  return paintedSurface(512,512,g=>{
    const c=256;g.fillStyle='#fff';g.fillRect(0,0,512,512);g.translate(c,c);
    g.strokeStyle='#a1abb1';g.lineWidth=1.6;
    for(const r of [237,247]){g.beginPath();g.arc(0,0,r,0,2*Math.PI);g.stroke();}
    for(let i=0;i<48;i++){g.save();g.rotate(i*Math.PI/24);g.beginPath();g.moveTo(0,-237);g.lineTo(0,i%4?-241:-246);g.stroke();g.restore();}
    for(let i=0;i<12;i++){g.save();g.rotate(i*Math.PI/6);g.strokeStyle='#c3c9c9';g.beginPath();g.moveTo(0,-193);g.lineTo(0,-236);g.stroke();g.restore();}
    // Flush registration marks around the subject position, useful without the grid.
    for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);g.strokeStyle='#c1cbcb';g.lineWidth=1.8;g.beginPath();g.arc(0,0,91,-.26,.26);g.stroke();g.beginPath();g.moveTo(91,0);g.lineTo(97,0);g.stroke();g.restore();}
  });
}
// A large curved photographic sweep beyond the usable plinth. Graduated light
// is painted into its vertices; the character's light rig remains independent.
function backdrop() {
  const profile=[new Vector2(8.3,-.58),new Vector2(9,-.55),new Vector2(9.52,-.4),new Vector2(9.90,-.05),new Vector2(10.15,.55),new Vector2(10.21,1.2),new Vector2(10.21,2.6),new Vector2(10.21,4.1)];
  const geo=new LatheGeometry(profile,64,Math.PI*.42,Math.PI*1.16),pos=geo.attributes.position,cols:number[]=[],base=new Color('#374854'),light=new Color('#89939b'),tmp=new Color();
  for(let i=0;i<pos.count;i++){const a=Math.atan2(pos.getX(i),-pos.getZ(i)),y=pos.getY(i);
    const wash=Math.exp(-((a+.63)**2)/.27)*Math.exp(-((y-.95)**2)/11)+.34*Math.exp(-((a-.85)**2)/.17);
    tmp.copy(base).lerp(light,Math.min(.87,.10+wash*.62));cols.push(tmp.r,tmp.g,tmp.b);}
  geo.setAttribute('color',new Float32BufferAttribute(cols,3));return geo;
}
export function StudioPlinth({segments,shadows,color}:{segments:number;shadows:boolean;color:string}) {
  const map=useMemo(floorInlay,[]),sweep=useMemo(backdrop,[]);
  const tint=useMemo(()=>new Color(color).lerp(new Color('#7f8989'),.38),[color]);
  useEffect(()=>()=>{map.dispose();sweep.dispose();},[map,sweep]);
  const r=SIMPLE_FLOOR_RADIUS;
  return <group name="scenery:floor">
    <mesh position-y={-.135} raycast={noPick}><cylinderGeometry args={[r,r-.10,.26,Math.max(48,segments),1,true]}/><meshStandardMaterial color="#626d72" roughness={.66}/></mesh>
    <mesh position-y={-.19} rotation-x={-Math.PI/2} raycast={noPick}><ringGeometry args={[r-.08,r+.02,64]}/><meshBasicMaterial color="#a7b8b8" /></mesh>
    <mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><circleGeometry args={[r,Math.max(48,segments)]}/><meshStandardMaterial color={tint} map={map} roughness={.92} /></mesh>
    <mesh geometry={sweep} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide} /></mesh>
  </group>;
}

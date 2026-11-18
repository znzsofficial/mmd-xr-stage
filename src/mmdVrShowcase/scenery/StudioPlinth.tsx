import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import { Batch, type Part } from './SceneryBatch';
import { span } from './detailParts';
import { SIMPLE_FLOOR_RADIUS } from './placementAreas';
import { noPick, paintedSurface } from './sceneryPaint';

function floorInlay() {
  return paintedSurface(512,512,g=>{
    const c=256;const wash=g.createRadialGradient(208,186,24,256,256,268);wash.addColorStop(0,'#fff9ed');wash.addColorStop(.69,'#e9e5db');wash.addColorStop(1,'#adb9bb');g.fillStyle=wash;g.fillRect(0,0,512,512);g.translate(c,c);
    g.strokeStyle='#a1abb1';g.lineWidth=1.6;
    for(const r of [237,247]){g.beginPath();g.arc(0,0,r,0,2*Math.PI);g.stroke();}
    for(let i=0;i<48;i++){g.save();g.rotate(i*Math.PI/24);g.beginPath();g.moveTo(0,-237);g.lineTo(0,i%4?-241:-246);g.stroke();g.restore();}
    for(let i=0;i<12;i++){g.save();g.rotate(i*Math.PI/6);g.strokeStyle='#c3c9c9';g.beginPath();g.moveTo(0,-193);g.lineTo(0,-236);g.stroke();g.restore();}
    // Flush registration marks around the subject position, useful without the grid.
    for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);g.strokeStyle='#c1cbcb';g.lineWidth=1.8;g.beginPath();g.arc(0,0,91,-.26,.26);g.stroke();g.beginPath();g.moveTo(91,0);g.lineTo(97,0);g.stroke();g.restore();}
  });
}

// Two fixed octagonal photographic banks: sewn panels, recessed diffuser and
// a proper telescoping stand. No light source or extra shadow map is needed.
function softbox(){
  const p:number[]=[],rgb:number[]=[],color=new Color();
  function triangle(a:number[],b:number[],c:number[],tint:string){color.set(tint);for(const v of [a,b,c]){p.push(...v);rgb.push(color.r,color.g,color.b);}}
  const corner=(i:number,r:number,z:number)=>[Math.cos(i*Math.PI/4+Math.PI/8)*r,Math.sin(i*Math.PI/4+Math.PI/8)*r,z];
  for(let i=0;i<8;i++){
    const [a,b,c,d]=[corner(i,.22,-.62),corner(i+1,.22,-.62),corner(i,.97,0),corner(i+1,.97,0)];
    const inner=corner(i,.903,-.024),next=corner(i+1,.903,-.024);
    triangle(a,b,c,i%2?'#414752':'#535962');triangle(b,d,c,i%2?'#414752':'#535962');
    triangle(c,d,inner,'#647077');triangle(d,next,inner,'#647077');triangle(inner,next,[0,0,.03],i%2?'#efdfc6':'#f4e8d4');
    triangle(a,[0,0,-.62],b,'#363b43');
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.computeVertexNormals();return g;
}
function studioRig() {
  const metal:Part[]=[],brass:Part[]=[];
  for(const side of [-1,1]){
    const x=side*6.45,z=-6.4,y=side===1?2.91:2.42;
    for(let i=0;i<3;i++){const a=i*2*Math.PI/3+.4;metal.push(span([x,.59,z],[x+Math.sin(a)*.67,.015,z+Math.cos(a)*.67],.055,'#707772'));}
    metal.push(span([x,.06,z],[x,1.66,z],.083,'#535957'),span([x,1.65,z],[x,y+.06,z],.046,'#a8aaa1'));
    for(const h of [.61,1.64,y])brass.push({p:[x,h,z],s:[.124,.08,.124],color:'#bea782'});
    metal.push({p:[x,-.135,z],s:[1.57,.27,1.57],color:'#707773'});
  }
  // A measuring arch behind the sweep's subject line, with a small gap and
  // graduation every five degrees. Lives entirely behind the plinth footprint.
  for(const r of [3.68,3.9])for(let i=0;i<48;i++){
    const pt=(a:number):Part['p']=>[Math.cos(a)*r,.04+Math.sin(a)*r,-9.04];
    const a=i*Math.PI/48,b=(i+1)*Math.PI/48;metal.push(span(pt(a),pt(b),r<3.8?.045:.085,r<3.8?'#b8b5a5':'#8b9694'));
  }
  for(let i=0;i<=36;i++){const a=i*Math.PI/36,r=i%3?3.79:3.69;
    brass.push(span([Math.cos(a)*r,.04+Math.sin(a)*r,-9.03],[Math.cos(a)*3.91,.04+Math.sin(a)*3.91,-9.03],.031,i%3?'#9ca9a6':'#d2b891'));}
  for(const side of [-1,1])metal.push({p:[side*3.8,-.11,-9.04],s:[.5,.36,.44],color:'#7a8380'});
  return {metal,brass};
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
  const map=useMemo(floorInlay,[]),sweep=useMemo(backdrop,[]),fabric=useMemo(softbox,[]),rig=useMemo(studioRig,[]);
  const tint=useMemo(()=>new Color(color).lerp(new Color('#a5b1ad'),.64),[color]);
  useEffect(()=>()=>{map.dispose();sweep.dispose();fabric.dispose();},[map,sweep,fabric]);
  const r=SIMPLE_FLOOR_RADIUS;
  return <group name="scenery:floor">
    <mesh rotation-x={-Math.PI/2} position-y={-.27} raycast={noPick}><circleGeometry args={[13.4,80]}/><meshStandardMaterial color="#677274" roughness={.96}/></mesh>
    <mesh position-y={-.135} raycast={noPick}><cylinderGeometry args={[r,r-.10,.26,Math.max(48,segments),1,true]}/><meshStandardMaterial color="#626d72" roughness={.66}/></mesh>
    <mesh position-y={-.19} rotation-x={-Math.PI/2} raycast={noPick}><ringGeometry args={[r-.08,r+.02,64]}/><meshBasicMaterial color="#a7b8b8" /></mesh>
    <mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><circleGeometry args={[r,Math.max(48,segments)]}/><meshStandardMaterial color={tint} map={map} roughness={.92} /></mesh>
    <mesh geometry={sweep} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide} /></mesh>
    <Batch name="studio-measuring-arch-and-stands" parts={rig.metal} /><Batch name="studio-brass-graduations" parts={rig.brass} lit />
    {[-1,1].map(side=><mesh key={side} position={[side*6.45-side*.27,side===1?2.91:2.42,-6.10]} rotation={[.14,-side*.74,side*.06]} geometry={fabric} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide}/></mesh>)}
  </group>;
}

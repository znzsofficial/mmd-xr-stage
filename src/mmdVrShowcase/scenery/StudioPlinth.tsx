import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import { Batch, type Part } from './SceneryBatch';
import { span } from './detailParts';
import { SIMPLE_FLOOR_RADIUS } from './placementAreas';
import { noPick } from './sceneryPaint';
import { useBakedSurface } from './useBakedSurface';
import registrationURL from './studio-registration.webp';

// Two fixed octagonal photographic banks: sewn panels, recessed diffuser and
// a proper telescoping stand. No light source or extra shadow map is needed.
function softbox(gridded:boolean){
  const p:number[]=[],rgb:number[]=[],color=new Color();
  function triangle(a:number[],b:number[],c:number[],tint:string){color.set(tint);for(const v of [a,b,c]){p.push(...v);rgb.push(color.r,color.g,color.b);}}
  const corner=(i:number,r:number,z:number)=>[Math.cos(i*Math.PI/4+Math.PI/8)*r,Math.sin(i*Math.PI/4+Math.PI/8)*r,z];
  for(let i=0;i<8;i++){
    const [a,b,c,d]=[corner(i,.22,-.62),corner(i+1,.22,-.62),corner(i,.97,0),corner(i+1,.97,0)];
    const inner=corner(i,.903,-.024),next=corner(i+1,.903,-.024);
    triangle(a,b,c,i%2?'#414752':'#535962');triangle(b,d,c,i%2?'#414752':'#535962');
    triangle(c,d,inner,'#647077');triangle(d,next,inner,'#647077');triangle(inner,next,[0,0,.03],i%2?'#efdfc6':'#f4e8d4');
    triangle(a,[0,0,-.62],b,'#363b43');
    // Narrow reflective piping joins each fabric gore at its seam.
    triangle(a,corner(i+.024,.22,-.623),c,'#83908e');triangle(c,corner(i+.021,.97,0),corner(i+.024,.22,-.623),'#748285');
  }
  if(gridded){
    // Broad, widely spaced textile baffles on the fill bank; the key stays open.
    // Clip each ribbon to the actual octagonal opening instead of a square grid.
    const edge=.89*Math.cos(Math.PI/8),diag=edge*Math.SQRT2;
    for(const swap of [false,true])for(let j=-3;j<=3;j++){
      const u=j*.215,reach=Math.min(edge,diag-Math.abs(u));
      const pt=(v:number,w:number,z:number)=>swap?[v,w,z]:[w,v,z];
      const a=pt(-reach,u,.038),b=pt(reach,u,.038),c=pt(reach,u+.012,.081),d=pt(-reach,u+.012,.081);
      triangle(a,b,c,'#7d807a');triangle(a,c,d,'#7d807a');
    }
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
    for(let j=0;j<3;j++){const a=j*2*Math.PI/3+.4;
      metal.push(span([x,.22,z],[x+Math.sin(a)*.42,.22,z+Math.cos(a)*.42],.027,'#a5a9a2'));
      metal.push({p:[x+Math.sin(a)*.62,.04,z+Math.cos(a)*.62],s:[.115,.075,.105],color:'#434d4e'});}
    for(const h of [.63,1.66,y-.1]){metal.push(span([x,h,z],[x+side*.136,h+.01,z],.036,'#838b88'));
      brass.push({p:[x+side*.14,h,z],s:[.051,.097,.078],color:'#ac987e'});}
    metal.push({p:[x,y+.01,z-.25],s:[.23,.20,.31],color:'#4f5b61'});
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
  // The two narrow gel libraries sit behind the softboxes. Angled proof
  // sheets and swatches frame the subject without intruding onto the disc.
  for(const side of [-1,1]){
    const x=side*4.8,z=-8.45,yaw=-side*.25;
    const put=(u:number,y:number,v:number,s:Part['s'],color:string)=>metal.push({p:[x+u*Math.cos(yaw)+v*Math.sin(yaw),y,z-u*Math.sin(yaw)+v*Math.cos(yaw)],s,ry:yaw,color});
    put(0,-.10,0,[1.34,.34,.65],'#788488');put(0,1.34,0,[1.20,2.52,.10],'#5a696c');
    put(0,1.36,.065,[1.10,2.34,.035],'#c4c3b6');
    const swatches=side<0?['#b0bab1','#ced2bc','#d2ae8c','#b38c7d','#8b7472','#6a6772']:['#a9bbb8','#8ca5a8','#779099','#787e91','#a99aa2','#c5aba3'];
    for(let i=0;i<6;i++){const u=(i%2-.5)*.48,y=2.05-Math.floor(i/2)*.63;
      put(u,y,.10,[.40,.49,.015],swatches[i]);put(u,y+.24,.115,[.16,.025,.025],'#9d8e77');put(u-.09,y-.29,.10,[.19,.018,.018],'#838780');}
    put(0,2.63,0,[1.32,.054,.16],'#b6bcb4');
  }
  return {metal,brass};
}
// A large curved photographic sweep beyond the usable plinth. Graduated light
// is painted into its vertices; the character's light rig remains independent.
function backdrop() {
  const profile=[new Vector2(8.3,-.58),new Vector2(9,-.55),new Vector2(9.52,-.4),new Vector2(9.90,-.05),new Vector2(10.15,.55),new Vector2(10.21,1.2),new Vector2(10.21,2.6),new Vector2(10.21,4.1),new Vector2(10.21,6.4),new Vector2(10.21,8.0)];
  const geo=new LatheGeometry(profile,64,Math.PI*.42,Math.PI*1.16),pos=geo.attributes.position,cols:number[]=[],base=new Color('#374854'),light=new Color('#89939b'),tmp=new Color();
  for(let i=0;i<pos.count;i++){const a=Math.atan2(pos.getX(i),-pos.getZ(i)),y=pos.getY(i);
    const wash=Math.exp(-((a+.63)**2)/.27)*Math.exp(-((y-.95)**2)/11)+.34*Math.exp(-((a-.85)**2)/.17);
    tmp.copy(base).lerp(light,Math.min(.87,.10+wash*.62));cols.push(tmp.r,tmp.g,tmp.b);}
  geo.setAttribute('color',new Float32BufferAttribute(cols,3));return geo;
}
export function StudioPlinth({segments,shadows,color}:{segments:number;shadows:boolean;color:string}) {
  const map=useBakedSurface(registrationURL),sweep=useMemo(backdrop,[]),fabric=useMemo(()=>[softbox(false),softbox(true)],[]),rig=useMemo(studioRig,[]);
  const tint=useMemo(()=>new Color(color).lerp(new Color('#c4cfca'),.76),[color]);
  useEffect(()=>()=>{sweep.dispose();fabric.forEach(g=>g.dispose());},[sweep,fabric]);
  const r=SIMPLE_FLOOR_RADIUS;
  return <group name="scenery:floor">
    <mesh rotation-x={-Math.PI/2} position-y={-.27} raycast={noPick}><circleGeometry args={[13.4,80]}/><meshStandardMaterial color="#677274" roughness={.96}/></mesh>
    <mesh position-y={-.135} raycast={noPick}><cylinderGeometry args={[r,r-.10,.26,Math.max(48,segments),1,true]}/><meshStandardMaterial color="#626d72" roughness={.66}/></mesh>
    <mesh position-y={-.19} rotation-x={-Math.PI/2} raycast={noPick}><ringGeometry args={[r-.08,r+.02,64]}/><meshBasicMaterial color="#a7b8b8" /></mesh>
    <mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><circleGeometry args={[r,Math.max(48,segments)]}/><meshStandardMaterial key={map?'inlay':'loading'} color={tint} map={map} roughness={.92} /></mesh>
    <mesh geometry={sweep} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide} /></mesh>
    <Batch name="studio-measuring-arch-and-stands" parts={rig.metal} /><Batch name="studio-brass-graduations" parts={rig.brass} lit />
    {[-1,1].map((side,i)=><mesh key={side} position={[side*6.45-side*.27,side===1?2.91:2.42,-6.10]} rotation={[.14,-side*.74,side*.06]} geometry={fabric[i]} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide}/></mesh>)}
  </group>;
}

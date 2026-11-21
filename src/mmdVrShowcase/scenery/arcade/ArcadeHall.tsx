import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {BoxGeometry,CanvasTexture,Color,DoubleSide,InstancedMesh,Matrix4,MeshStandardMaterial,SRGBColorSpace} from 'three';
import {blocks,board,cabinets,opening,skylight,lowerPad,upperPad,UPPER,ROOF,upperFrontZ,lowerFrontZ,frontLip} from './arcadeLayout';
import {ArcadePrints} from './ArcadePrints';

type Piece={x:number;y:number;z:number;w:number;h:number;d:number;ink:string};
const trim:Piece[]=[];
const add=(x:number,y:number,z:number,w:number,h:number,d:number,ink:string)=>trim.push({x,y,z,w,h,d,ink});
// Separate decorative skins from solids. One instance batch for each; all
// dimensions below are colours and edge profiles, not an extra walking layer.
for(const b of blocks){
  if(b.tag==='wall'&&b.y>UPPER&&Math.abs(b.z)===upperFrontZ){
    // Horizontal cladding rails are real silhouettes over the painted ribs.
    for(const off of [-.48,.42])add(b.x,b.y+off*b.h,b.z+Math.sign(b.z)*.189,b.w,.084,.065,'#6a9790');
  }
  if(b.tag==='pillar'){
    for(const s of [-1,1])for(const t of [-1,1])add(b.x+s*.444,b.y,b.z+t*.454,.035,b.h,.035,'#635f70');
    add(b.x,UPPER-.45,b.z,1.17,.05,1.18,'#ebecdd');
    for(const s of [-1,1])add(b.x,.96,b.z+s*.468,.888,.025,.012,'#727581');
    for(let i=0;i<4;i++)add(b.x-.39+i*.26,.014,b.z+.59,.245,.018,.18,['#826c78','#ac926e','#688e95','#966c6a'][i]);
  }
}
const rim=(hole:typeof opening,y:number,ink:string)=>{
  const {left:l,right:r,back:b,front:f}=hole;
  for(const z of [b-.057,f+.057])add((l+r)/2,y,z,r-l+.23,.042,.115,ink);
  for(const x of [l-.057,r+.057])add(x,y,(b+f)/2,.115,.042,f-b,ink);
};
for(const y of [UPPER+.004,UPPER-.275])rim(opening,y,'#eb9978');
rim(skylight,ROOF-.245,'#c9826e');
// The front is pale below, blue-grey *above* the floor line; the wood back
// can be inspected by walking around either end. Both skins share one core.
add(0,UPPER/2,board.z+.123,board.w-.08,UPPER,.012,'#d0c5ad');
add(0,UPPER+.59,board.z+.125,board.w-.14,1.04,.016,'#627692');
add(0,board.y,board.z-.123,board.w-.12,board.h-.13,.012,'#995d44');
for(const x of [-1,1])add(x*(board.w/2-.028),board.y,board.z,.06,board.h,.28,'#734f43');
for(const y of [.06,UPPER+.02,board.h-.04])add(0,y,board.z,board.w,.075,.28,'#8a6657');

for(const y of [UPPER-.285,ROOF-.253])for(const z of [-3.28,3.02])for(const x of [-5.6,-2.82,0,2.82,5.6]){
  if(Math.abs(x)>2){add(x+.28,y-.014,z,1.09,.044,.47,'#576476');add(x+.28,y-.040,z,1.02,.018,.37,'#eeeede');}
}
for(const {x,y,z,side,style} of cabinets){
  const face=x+side*.366,fault=style==='fault',w=fault?1.13:.66;
  add(face,y+(fault?1.51:1.15),z,.021,fault?.84:.53,w,'#222f3d');
  if(style!=='vent'){
    add(face+side*.047,y+.806,z,.19,.07,w+.02,'#777c88');add(face+side*.042,y+.32,z,.018,.19,w*.53,'#2d3844');
    for(const s of [-1,1])add(face,y+.50,z+s*w*.46,.047,.54,.032,'#97aaa9');
  }
}
for(const x of [-6.4,6.4])for(let i=0;i<4;i++)add(x,ROOF+.25,-3.4+i*2.23,.08,.48,2.03,'#4f766b');
for(let i=0;i<14;i++)add(-6.5+i,ROOF+.24,4.47,.93,.49,.21,'#517c73');
for(let i=0;i<4;i++)add(11.37+i*.85,1.2,1.563,.058,2.38,.033,'#93aeb9');
for(let i=0;i<17;i++)add(-13.41,2.048,-2.64+i*.34,1.64,.012,.328,i%2?'#a7c1b7':'#5d8b86');
for(let i=0;i<17;i++)add(-12.552,1.944,-2.64+i*.34,.028,.20,.337,i%2?'#a7c1b7':'#5d8b86');
for(const y of [0,UPPER])for(const z of [-.72,.95])add(6.90,y+2.37,z,.11,.80,1.69,'#536475');
// Graphic fenestration: pale sill, paired fixed lights, handle strip and
// overhead housings give the coloured blocks an immediately human scale.
for(const z of [-1.79,-1.01,-.23,.55,1.33,2.11]){
  add(-13.466,.53,z,.035,1.40,.74,'#91a59c');add(-13.44,.57,z,.025,1.22,.66,'#566c6d');
  add(-13.42,-.02,z,.046,.084,.71,'#a6b3a1');
}
for(const z of [-2.04,1.87])add(-13.33,1.73,z,.86,.051,1.32,'#d7dac1');
for(let i=0;i<10;i++)add(-14.54+i*.63,2.67,-5.44,.054,.19,.13,'#446568');
add(-10.6,.54,-5.44,2.57,2.39,.043,'#4e686e');add(-10.6,.52,-5.407,2.27,2.19,.03,'#778482');
for(let i=0;i<5;i++)add(-10.6,.07+i*.31,-5.375,2.17,.029,.025,'#607875');
for(let i=0;i<6;i++)add(12.61,3.00,-3.86+i*1.5,2.63,.16,.11,'#4f626b');
for(const x of [11.65,13.60])add(x,.69,1.33,.09,.37,.13,'#756d65');
add(12.62,.81,1.33,2.37,.25,.17,'#94816e');
for(const x of [-3.8,3.8]){add(x,1.24,12.823,1.76,2.48,.035,'#857f7d');add(x,1.21,12.80,1.50,2.29,.022,'#986f59');}
for(let i=-1;i<=1;i++)add(i*.45,1.92,lowerFrontZ-.165,.418,.355,.064,'#bcaa79');
for(let i=0;i<8;i++)add(-6.51+i*1.84,UPPER-.16,frontLip+.012,1.72,.20,.07,'#829395');
add(0,UPPER+.004,frontLip-.12,14,.012,.028,'#8daac2');add(0,UPPER+.004,frontLip-.175,14,.012,.017,'#b599af');
for(const p of [lowerPad,upperPad]){
  for(const s of [-1,1]){add(p.x+s*.48,p.y+.009,p.z,.055,.012,.85,'#e4bf74');add(p.x,p.y+.009,p.z+s*.42,.94,.012,.055,'#e4bf74');}
}

function Batch({pieces,solid}:{pieces:readonly Piece[];solid:boolean}){
  const ref=useRef<InstancedMesh>(null);
  const [g,m]=useMemo(()=>[new BoxGeometry(),new MeshStandardMaterial({roughness:.88})] as const,[]);
  useEffect(()=>()=>{g.dispose();m.dispose();},[g,m]);
  useLayoutEffect(()=>{const im=ref.current!,mat=new Matrix4(),ink=new Color();
    pieces.forEach((b,i)=>{im.setMatrixAt(i,mat.makeScale(b.w,b.h,b.d).setPosition(b.x,b.y,b.z));im.setColorAt(i,ink.set(b.ink));});
    im.instanceMatrix.needsUpdate=true;im.instanceColor!.needsUpdate=true;im.computeBoundingSphere();
  },[pieces]);
  return <instancedMesh ref={ref} args={[g,m,pieces.length]} name={solid?'arcade:solids':'arcade:skins'} userData={{playerCollision:solid}} receiveShadow/>;
}

function Sign({text,pos,yaw=0,w,h,ink='#e6f0e8',bg='#38585f',floor=false}:{text:string;pos:[number,number,number];yaw?:number;w:number;h:number;ink?:string;bg?:string;floor?:boolean}){
  const map=useMemo(()=>{const c=document.createElement('canvas');c.width=768;c.height=Math.round(768*h/w);const g=c.getContext('2d')!;
    g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);g.fillStyle=ink;g.font=`bold ${Math.floor(c.height*.62)}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(text,c.width/2,c.height*.51,c.width*.93);
    const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;return t;},[text,w,h,ink,bg]);useEffect(()=>()=>map.dispose(),[map]);
  return <mesh position={pos} rotation={[floor?-Math.PI/2:0,yaw,0]} userData={{playerCollision:false}}><planeGeometry args={[w,h]}/><meshBasicMaterial map={map} side={DoubleSide}/></mesh>;
}

export function ArcadeHall(){return <group pointerEvents="none" name="scenery:arcadeHall">
  <Batch pieces={blocks} solid/><Batch pieces={trim} solid={false}/>
  <ArcadePrints/>
  <Sign text="01    /    ARCADE" pos={[0,1.91,frontLip+.009]} w={1.58} h={.38}/>
  <Sign text="洞口试行   ↑   G / 左 X" pos={[lowerPad.x,1.07,board.z+.145]} w={1.98} h={.32} ink="#ffe5a9" bg="#575360"/>
  <Sign text="↓   G / 左 X" pos={[upperPad.x,UPPER+.021,upperPad.z]} w={.83} h={.28} floor/>
  <Sign text="↑   G / 左 X" pos={[lowerPad.x,.021,lowerPad.z]} w={.83} h={.28} floor/>
  <mesh position={[-13.66,3.80,-1.31]}><sphereGeometry args={[.95,16,12]}/><meshStandardMaterial color="#a0af9e" roughness={.66}/></mesh>
  <mesh position={[-13.66,3.80,-1.31]}><cylinderGeometry args={[.96,.96,.12,20]}/><meshStandardMaterial color="#637578"/></mesh>
  {[-12.39,-11.70,-11.01].map(x=><mesh key={x} position={[x,-.13,-4.08]} rotation={[.12,0,0]}><torusGeometry args={[.35,.126,8,16]}/><meshStandardMaterial color="#424852"/></mesh>)}
</group>;}

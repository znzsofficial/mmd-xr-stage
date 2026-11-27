import {useEffect,useMemo} from 'react';
import {noPick,paintedSurface} from '../sceneryPaint';

function directionFace(park:boolean){
  return paintedSurface(768,152,ctx=>{
    ctx.fillStyle=park?'#f1e7c8':'#23544e';ctx.fillRect(0,0,768,152);
    const ink=park?'#244f46':'#f3eacb';ctx.fillStyle=ink;
    ctx.fillRect(18,15,732,3);ctx.fillRect(18,134,732,3);
    ctx.beginPath();ctx.moveTo(46,75);ctx.lineTo(76,42);ctx.lineTo(106,75);ctx.lineTo(96,82);
    ctx.lineTo(82,66);ctx.lineTo(82,110);ctx.lineTo(69,110);ctx.lineTo(69,66);ctx.lineTo(55,82);ctx.fill();
    ctx.font='600 56px system-ui,sans-serif';ctx.fillText(park?'公 园 出 口':'海 堤 站 台',135,81);
    ctx.font='500 25px system-ui,sans-serif';ctx.fillText(park?'CITY EXIT   /   FOUNTAIN PARK':'PLATFORM   /   SEAWALL',139,117);
    ctx.textAlign='right';ctx.font='500 40px system-ui,sans-serif';ctx.fillText(park?'20 m':'12 m',715,96);
  });
}

/** Two enamel faces hung from the landward truss, above standing head height. */
export function PlatformWayfinding(){
  const faces=useMemo(()=>[directionFace(true),directionFace(false)],[]);
  useEffect(()=>()=>faces.forEach(t=>t.dispose()),[faces]);
  return <group name="terminus:city-exit-sign" position={[-.38,2.50,3.25]} pointerEvents="none" userData={{playerCollision:false}}>
    {[-.62,.62].map(x=><mesh key={x} position={[x,.525,0]} raycast={noPick}><cylinderGeometry args={[.009,.009,.78,8]}/><meshStandardMaterial color="#445952" roughness={.46}/></mesh>)}
    <mesh raycast={noPick}><boxGeometry args={[1.74,.359,.052]}/><meshStandardMaterial color="#3d6156" roughness={.52}/></mesh>
    {faces.map((map,i)=><mesh key={i} position-z={i?.028:-.028} rotation-y={i?0:Math.PI} raycast={noPick}>
      <planeGeometry args={[1.717,.34]}/><meshStandardMaterial map={map} roughness={.52}/>
    </mesh>)}
  </group>;
}

import {useEffect,useMemo} from 'react';
import {paintedSurface,noPick} from '../sceneryPaint';
import {clearingDeck as deck,clearingRadius as r} from './lanternClearing';

// A cut through a bracket fungus, like a spore print: broad growth bands
// turn into branching gill lines around the perimeter of the clearing.
function print(){return paintedSurface(512,512,c=>{
  c.translate(256,256);c.fillStyle='#665749';c.fillRect(-256,-256,512,512);
  c.lineJoin='round';const tau=Math.PI*2;
  for(let j=1;j<=39;j++){
    const radius=j*6.5;c.beginPath();
    for(let i=0;i<=168;i++){
      const t=i*tau/168,k=radius*(1+.043*Math.sin(3*t+.4)+.025*Math.cos(5*t+j*.046));
      const x=k*Math.cos(t)+17*(1-j/40),y=k*Math.sin(t)-8*(1-j/40);
      if(!i)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.closePath();c.strokeStyle=j%6===0?'#92705a':j%3===0?'#756554':'#5a5148';c.lineWidth=j%6===0?2.5:1.3;c.stroke();
  }
  for(let i=0;i<89;i++){
    const t=tau*i/89+.012*Math.sin(i*2),inner=192+19*Math.sin(i*.43)+13*Math.sin(i*4.1);
    const rib=(t1:number,r1:number,t2:number,r2:number)=>{c.beginPath();c.moveTo(r1*Math.cos(t1),r1*Math.sin(t1));c.quadraticCurveTo((r1+r2)/2*Math.cos(t1+.02),(r1+r2)/2*Math.sin(t1+.02),r2*Math.cos(t2),r2*Math.sin(t2));c.stroke();};
    c.strokeStyle=i%4===0?'#c39171':'#ab8066';c.lineWidth=i%4===0?2.7:1.4;rib(t-.05,inner,t,257);
    if(i%3===0)rib(t-.016,234,t+.02,257);
  }
});}

export function ClearingStage(){
  const map=useMemo(print,[]);useEffect(()=>()=>map.dispose(),[map]);
  return <group name="lantern:performers-clearing" position={[deck.x,deck.y,deck.z]}>
    <mesh position-y={-.076} raycast={noPick}><cylinderGeometry args={[r,r-.065,.15,64]}/><meshStandardMaterial color="#654f4e" roughness={.95}/></mesh>
    <mesh rotation-x={-Math.PI/2} raycast={noPick}><circleGeometry args={[r,64]}/><meshStandardMaterial map={map} roughness={.9}/></mesh>
  </group>;
}

import { useEffect, useMemo } from 'react';
import { paintedSurface, noPick } from '../scenery/sceneryPaint';
import { POST_MARKS, POST_Z, useLunarCard } from './lunarCard';
import { useStagePlay } from './stagePlay';

const palette=['#ffc883','#a2ece1','#ffc3cd'];
function emblem(g:CanvasRenderingContext2D,i:number,r:number,color:string) {
  g.save();g.fillStyle=color;g.strokeStyle=color;g.lineWidth=r*.09;g.lineCap='round';
  if(i===0){g.beginPath();g.arc(0,0,r,-Math.PI*.49,Math.PI*.49,true);g.bezierCurveTo(-r*.32,r*.32,-r*.32,-r*.32,0,-r);g.fill();}
  else if(i===1){for(let j=0;j<3;j++){g.beginPath();g.moveTo(-.12*r, (.12+j*.17)*r);g.lineTo((.45+j*.16)*r,(-.98+j*.13)*r);g.stroke();}g.beginPath();g.arc(-r*.31,r*.32,r*.44,0,2*Math.PI);g.fill();}
  else {for(const [x,y,k] of [[-.4,-.26,.65],[.45,.37,.43]]){g.beginPath();for(let n=0;n<8;n++){const a=n*Math.PI/4,rad=(n%2?.27:1)*k*r;const xx=x*r+rad*Math.sin(a),yy=y*r-rad*Math.cos(a);if(!n)g.moveTo(xx,yy);else g.lineTo(xx,yy);}g.closePath();g.fill();}}
  g.restore();
}
function sealTexture(i:number,done:boolean){return paintedSurface(160,160,g=>{
  g.translate(80,80);g.fillStyle=done?'#21544f':'#24354a';g.beginPath();g.arc(0,0,73,0,2*Math.PI);g.fill();g.strokeStyle=done?'#fff6d6':palette[i];g.lineWidth=4;g.stroke();g.setLineDash([2,6]);g.lineWidth=2;g.beginPath();g.arc(0,0,60,0,2*Math.PI);g.stroke();emblem(g,i,35,done?'#fff4c9':palette[i]);
});}
function Seal({i,done}:{i:number;done:boolean}){const texture=useMemo(()=>sealTexture(i,done),[i,done]);useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh name={`post:mark:${i}`} position={[...POST_MARKS[i],POST_Z]} raycast={noPick}><planeGeometry args={[.88,.88]} /><meshBasicMaterial map={texture} transparent alphaTest={.1} toneMapped={false} /></mesh>;
}
function cardTexture(first:number) {return paintedSurface(1024,560,g=>{
  const w=1024,h=560;g.fillStyle='#233e58';g.fillRect(0,0,w,h);g.fillStyle='#28475c';g.fillRect(24,24,w-48,h-48);
  g.strokeStyle='#b3ced1';g.lineWidth=2;g.strokeRect(25,25,w-50,h-50);g.strokeStyle='#f3d59c';g.setLineDash([6,10]);g.strokeRect(12,12,w-24,h-24);g.setLineDash([]);
  // Inked orbital chart. Leave the central portrait field quiet for the actor.
  for(let j=0;j<4;j++){g.beginPath();g.ellipse(780,405,186+31*j,65+j*18,-.58,0,2*Math.PI);g.strokeStyle='#668a99';g.stroke();}
  for(let j=0;j<95;j++){const x=40+(j*617)%942,y=45+(j*191)%463;g.fillStyle=j%3?'#a6c4ca':'#f4dbad';g.fillRect(x,y,j%5?2:4,j%5?2:4);}
  g.fillStyle='#f6deba';g.font='600 32px system-ui';g.fillText('月面郵局',49,74);g.font='17px system-ui';g.fillText('LUNAR POST   /   POSTAGE PAID',50,101);
  g.save();g.translate(850,118);g.rotate(-.15);g.strokeStyle=palette[first];g.lineWidth=3;for(const r of [62,69]){g.beginPath();g.arc(0,0,r,0,2*Math.PI);g.stroke();}emblem(g,first,34,palette[first]);g.restore();
  g.fillStyle='#eee2c9';g.fillRect(31,h-58,w-62,29);g.fillStyle='#244051';g.font='600 15px system-ui';g.fillText('EARTH   →   LUNA',50,h-37);g.fillText('01  /  FIRST ISSUE',w-205,h-37);
});}
export function MoonPost(){const stamps=useLunarCard(s=>s.stamps), held=useStagePlay(s=>s.held?.toy==='post');const first=stamps[0]??0;
  const card=useMemo(()=>stamps.length===3?cardTexture(first):null,[stamps.length,first]);useEffect(()=>()=>card?.dispose(),[card]);
  if(!held&&!card)return null;
  return <group name="play:moon-post" pointerEvents="none">
    {card?<mesh name="post:finished" position={[0,1.92,POST_Z-.1]} raycast={noPick}><planeGeometry args={[7.1,3.88]} /><meshBasicMaterial map={card} toneMapped={false}/></mesh>:
    POST_MARKS.map((_,i)=><Seal key={i} i={i} done={stamps.includes(i)} />)}
  </group>;
}

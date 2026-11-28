import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {noPick,paintedSurface} from '../../sceneryPaint';
import {timingBoards} from './site';

// The two sides of each board face the arcade and the pool respectively.
const cream='#f2e3bd',green='#28575a',red='#ba5945';
function printAtlas(){return paintedSurface(1024,256,g=>{
  for(let i=0;i<2;i++){
    g.save();g.translate(i*512,0);g.beginPath();g.rect(0,0,512,256);g.clip();
    const fg=i===0?cream:green,bg=i===0?green:cream;g.fillStyle=bg;g.fillRect(0,0,512,256);
    const text=(s:string,x:number,y:number,size:number,color=fg)=>{g.fillStyle=color;g.font=`700 ${size}px system-ui,sans-serif`;g.fillText(s,x,y,487-x);};
    const rule=(x:number,y:number,w:number,h:number,col=fg)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
    rule(18,17,476,3);rule(18,231,476,3);
    if(i===0){text('TIMING WALK     /     02',22,60,29);text('LOUNGE  ↑',18,157,78);text('GALLERY VIA THE RAMP',24,208,26,'#e3bd75');}
    else {text('LIDO   /   SPLIT TIMES',20,61,32);for(let j=0;j<4;j++){rule(22+j*111,84,103,100,green);text('0124'[j],39+j*111,166,82,cream);rule(22+j*111,134,103,2,green);}text('PAVILION     /     25 M',22,218,24,red);}
    g.restore();
  }
});}
function sheets(){
  const v:number[]=[],uv:number[]=[],idx:number[]=[];
  function panel(i:number,x:number,y:number,z:number,normalX:number){
    const k=v.length/3;
    for(const [s,t] of [[0,0],[1,0],[1,1],[0,1]]){
      v.push(x,y+(t-.5)*.69,z-normalX*(s-.5)*1.14);uv.push(i/2+.002+s*.496,.008+t*.984);
    }idx.push(k,k+1,k+2,k,k+2,k+3);
  }
  for(const [x,y,z] of timingBoards){
    panel(0,x-.087,y+1.48,z,-1);panel(1,x+.087,y+1.48,z,1);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(v,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function PrintedSigns(){
  const g=useMemo(sheets,[]),tex=useMemo(printAtlas,[]);
  useEffect(()=>()=>g.dispose(),[g]);useEffect(()=>()=>tex.dispose(),[tex]);
  return <mesh geometry={g} name="campus:timing-boards" userData={{playerCollision:false}} raycast={noPick}><meshStandardMaterial map={tex} roughness={.85}/></mesh>;
}

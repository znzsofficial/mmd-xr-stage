import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {noPick,paintedSurface} from '../../sceneryPaint';
import type {SceneryId} from '../../catalog';
import {ARCADE_ORIGIN as A,EAST as E,WEST as W} from './site';

// Eight two-ink plates from a student print fair: title, colophon, two
// woodcut posters, direction blades, split timing face and edition number.
const cream='#f2e3bd',green='#28575a',red='#ba5945',ochre='#dda954';
function printAtlas(){return paintedSurface(1024,1024,g=>{
  for(let i=0;i<8;i++){
    g.save();g.translate((i%2)*512,(i>>1)*256);g.beginPath();g.rect(0,0,512,256);g.clip();
    const fg=i===2||i===5?cream:green,bg=i===2||i===5?green:cream;g.fillStyle=bg;g.fillRect(0,0,512,256);
    const text=(s:string,x:number,y:number,size:number,color=fg)=>{g.fillStyle=color;g.font=`700 ${size}px system-ui,sans-serif`;g.fillText(s,x,y,487-x);};
    const rule=(x:number,y:number,w:number,h:number,col=fg)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
    rule(18,17,476,3);rule(18,231,476,3);
    if(i===0){text('FIELD   /   校园版画',21,56,28);text('PRINT EXCHANGE',17,150,69);text('STUDENT EDITIONS     •     EST. 1978',21,205,26,red);}
    if(i===1||i===2){
      // Offset registration, carved wave lines and a three-pass disc.
      const x=i===1?164:330,y=124;g.fillStyle=i===1?ochre:red;g.beginPath();g.arc(x+4,y,80,0,2*Math.PI);g.fill();
      for(let k=0;k<19;k++){
        g.beginPath();for(let j=0;j<65;j++){const xx=j*8,yy=127+k*5+19*Math.sin(xx/72+k*.11)+16*Math.cos(xx/55+k*.05);if(j)g.lineTo(xx,yy);else g.moveTo(xx,yy);}g.strokeStyle=i===1?green:cream;g.lineWidth=k%3?2:4;g.stroke();}
      text(i===1?'SLOW SUN':'TIDE STUDY',18,53,32);text(i===1?'EA / 05':'ED / 08',398,218,22);
    }
    if(i===3){text('校 园 印 务   /   01',23,64,31);text('PAPER + INK',19,154,70);text('OPEN WORKSHOP   •   RISOGRAPH',22,208,25,red);}
    if(i===4){text('WEST GALLERY   /   西廊',23,64,30);text('←  ARCADE',16,163,85);text('THROUGH THE RED FRAMES',24,207,25,red);}
    if(i===5){text('TIMING WALK     /     02',22,60,29);text('LOUNGE  ↑',18,157,78);text('GALLERY VIA THE RAMP',24,208,26,'#e3bd75');}
    if(i===6){text('LIDO   /   SPLIT TIMES',20,61,32);for(let j=0;j<4;j++){rule(22+j*111,84,103,100,green);text('0124'[j],39+j*111,166,82,cream);rule(22+j*111,134,103,2,green);}text('PAVILION     /     25 M',22,218,24,red);}
    if(i===7){text('PARK WALK  /  花径',23,68,31);text('←  GARDEN',18,162,80);text('VIA THE PRINT EXCHANGE',24,207,25,red);}
    g.restore();
  }
});}
function sheets(room:SceneryId){
  const v:number[]=[],uv:number[]=[],idx:number[]=[];
  function panel(i:number,x:number,y:number,z:number,w:number,h:number,n:'x'|'-x'|'z'|'-z'){
    const k=v.length/3,l=(i%2)/2,b=1-((i>>1)+1)/4;
    for(const [s,t] of [[0,0],[1,0],[1,1],[0,1]]){
      const d=(s-.5)*w;v.push(x+(n==='z'?d:n==='-z'?-d:0),y+(t-.5)*h,z+(n==='x'?-d:n==='-x'?d:0));uv.push(l+.002+s*.496,b+.002+t*.246);
    }idx.push(k,k+1,k+2,k,k+2,k+3);
  }
  if(room!=='pool'){
    panel(0,34.1,3.06,6.648,7.05,.88,'-z');
    for(const [x,w,face,n] of [[22,6.3,5.31,3],[34.1,9,6.66,4],[44,6.4,5.31,3]])for(let k=0;k<n;k++)panel(k===1?3:k%2===0?1:2,x-w/2+(k+.5)*w/n,1.36,face-.183,w/n-.47,.81,'-z');
    panel(4,W.x+1.632,.30,1.18,1.57,.34,'-x');
    // The garden-return blade faces the west portal, at the side of the turn.
    panel(7,44.8,2.1,5.119,2.04,.45,'-z');
  }
  if(room!=='lawn')for(const [x,y,z] of [[A.x-22.3,1.08,E.z-1.73],[E.x+1.67,2.05,E.z-.36]]){
    panel(5,x-.087,y+1.48,z,1.14,.69,'-x');panel(6,x+.087,y+1.48,z,1.14,.69,'x');
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(v,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function PrintedSigns({room}:{room:SceneryId}){
  const g=useMemo(()=>sheets(room),[room]),tex=useMemo(printAtlas,[]);
  useEffect(()=>()=>g.dispose(),[g]);useEffect(()=>()=>tex.dispose(),[tex]);
  return <mesh geometry={g} name="campus:student-editions" userData={{playerCollision:false}} raycast={noPick}><meshStandardMaterial map={tex} roughness={.85}/></mesh>;
}

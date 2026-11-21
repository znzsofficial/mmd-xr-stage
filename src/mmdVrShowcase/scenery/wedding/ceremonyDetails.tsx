import {useEffect,useMemo} from 'react';
import {BufferGeometry,DoubleSide,Float32BufferAttribute,type Texture} from 'three';
import {noPick,paintedSurface} from '../sceneryPaint';
import {arc,curve,tau,Workshop,type V} from './furnishingsMesh';
import {WEDDING_ANCHORS,WEDDING_HALL_FRONT} from './weddingLayout';

// Paired halves of one dried gourd, cut lengthwise. An ochre cut edge and
// vermilion lacquer interior meet at an open lip, rather than a solid goblet.
export function addRiteSet(shop:Workshop){
  const s=shop.body,m=shop.metal;
  s.box([.59,.917,.19],.59,.025,.39,'#643b34');
  for(const k of [-1,1]){
    const cx=.59+k*.13,cz=.19;
    const vessel=(u:number,v:number,inner=false):V=>{
      const t=(u-.5)*2, a=v*Math.PI;
      const r=(.078+.031*Math.cos((t+.54)*Math.PI)) * Math.sqrt(Math.max(0,1-t*t));
      return [cx+Math.cos(a)*r*(inner?.90:1)+k*t*.026,1.027+.027*t-Math.sin(a)*r*(inner?.79:.93),cz+.146*t];};
    s.grid(24,10,(u,v)=>vessel(u,v),'#c9a267');s.grid(24,10,(u,v)=>vessel(u,1-v,true),'#943c2f');
    for(const edge of [0,1])m.sweep(arc(t=>vessel(t,edge),26,1),.0038,'#e1bd77',6);
    for(const h of [-.075,.065])s.box([cx,.95,cz+h],.138,.038,.024,'#9b754d');
  }
  const thread=curve([.487,1.055,.333],[.51,.914,.388],[.67,.915,.392],[.69,1.055,.333],18);s.sweep(thread,.0068,'#a02c27',8);
  s.box([-.58,.925,.14],.62,.043,.42,'#513937');s.box([-.58,.95,.14],.59,.009,.398,'#be9161');
  // Tied loops and cut gold fringe on the wedding book's cloth case.
  for(const side of [-1,1])s.sweep(arc(t=>[-.57+side*.05*Math.sin(t/2),.962+.012*Math.sin(t),.352+.026*Math.sin(t)],18),.0042,'#ac3d35',6);
}

function deed(){return paintedSurface(896,512,c=>{
  c.fillStyle='#c89d72';c.fillRect(0,0,896,512);
  const ink='#653b32',gold='#b08a59',red='#a83c31';
  for(let i=0;i<2;i++){
    const x=12+i*440;c.fillStyle=i?'#f3ddad':'#eed1a1';c.fillRect(x,12,430,488);
    c.strokeStyle=gold;c.lineWidth=3;c.strokeRect(x+16,28,398,456);c.lineWidth=1;c.strokeRect(x+22,34,386,444);
    for(const k of [-1,1])for(const j of [-1,1]){c.save();c.translate(x+(k<0?36:394),j<0?52:457);c.scale(k<0?1:-1,j<0?1:-1);
      c.strokeStyle=gold;c.beginPath();c.moveTo(0,45);c.lineTo(0,0);c.lineTo(45,0);c.lineTo(45,9);c.lineTo(12,9);c.lineTo(12,24);c.lineTo(27,24);c.lineTo(27,15);c.stroke();c.restore();}
  }
  function column(text:string,x:number,y:number,size:number,col:string){c.fillStyle=col;c.font=`${size}px "KaiTi", "Noto Serif CJK SC", serif`;c.textAlign='center';for(const char of text){c.fillText(char,x,y);y+=size*1.22;}}
  column('合卺婚书',770,138,67,red);column('并蒂花开',628,140,47,ink);column('同心而结',543,172,39,ink);
  column('一堂缔约',344,140,47,ink);column('岁岁相宜',246,158,43,ink);column('吉日敬书',135,180,29,ink);
  c.save();c.translate(102,379);c.rotate(-.055);c.strokeStyle=red;c.lineWidth=5;c.strokeRect(-33,-36,66,72);column('囍',0,21,52,red);c.restore();
});}
function foldedPages(){
  const pos:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<=12;i++){const u=i/12,t=2*u-1;for(const v of [0,1]){
    pos.push(-.58+t*.282,.957+.033*(1-Math.abs(t))**2+.004*Math.abs(t)**5,.14+(.5-v)*.384);
    uv.push(u,v);
  }if(i){const k=i*2;idx.push(k-2,k,k-1,k-1,k,k+1);}}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function hallKnots(){
  const shop=new Workshop(),g=shop.body;
  for(const side of [-1,1]){
    const x=side*2.9,z=WEDDING_HALL_FRONT+.183;
    // A scalloped length of shot silk between the side posts. Only the side
    // bays are dressed: the centre remains clear for a two-person portrait.
    g.grid(40,8,(u,v)=>[x+side*(.11+2.02*u),3.20-.46*Math.sin(Math.PI*u)-v*(.08+.17*Math.sin(Math.PI*u)),z+.044*Math.sin(tau*8*u+.8*v)],'#ffe3c3','calyx');
    g.sweep(arc(t=>[x+.128*Math.sin(3*t),2.90+.18*Math.cos(2*t),z+.030*Math.sin(5*t)],80),.023,'#ac3c31',7);
    for(let k=-1;k<=1;k++){
      const xx=x+k*.071,y=2.62+.045*Math.abs(k);
      g.sweep([[xx,2.79,z],[xx,y,z]],[.012,.009],'#9e382d',6);
      g.turn([xx,y-.04,z],[[.01,0],[.021,.018],[.014,.04]],'#d4a65c','solid',10);
      g.turn([xx,y-.29,z],[[.04,0],[.033,.12],[.019,.23],[.012,.25]],'#ad3f32','solid',12);
      for(let n=-1;n<=1;n++)g.sweep([[xx+n*.012,y-.08,z+.019],[xx+n*.02,y-.286,z+.032]],.0025,'#d18a52',5);
    }
    const lx=x+side*1.34,lz=z-.18;
    g.sweep([[lx,3.37,lz],[lx,2.74,lz]],.008,'#7e5635',6);
    g.turn([lx,2.23,lz],[[.08,0],[.12,.03],[.18,.11],[.202,.22],[.19,.34],[.14,.43],[.085,.47]],'#eab57b','solid',24);
    for(let i=0;i<12;i++){
      const a=i*tau/12,sx=Math.cos(a),sz=Math.sin(a);
      g.sweep([[lx+.091*sx,2.25,lz+.091*sz],[lx+.182*sx,2.34,lz+.182*sz],[lx+.204*sx,2.45,lz+.204*sz],[lx+.192*sx,2.57,lz+.192*sz],[lx+.14*sx,2.66,lz+.14*sz],[lx+.085*sx,2.70,lz+.085*sz]],.006,'#916143',6);
    }
    for(const yy of [2.22,2.69])g.turn([lx,yy,lz],[[.084,0],[.094,.013],[.09,.04],[0,.042]],'#85543a','solid',20);
    g.sweep([[lx,2.22,lz],[lx,2.11,lz]],[.009,.012],'#b28b4f',6);g.turn([lx,1.94,lz],[[.033,0],[.027,.10],[.014,.16],[.011,.17]],'#ab4331','solid',10);
  }
  return g.finish();
}
export function CeremonyDetails({cloth}:{cloth:Texture}){
  const pieces=useMemo(()=>({paper:foldedPages(),map:deed(),knots:hallKnots()}),[]),a=WEDDING_ANCHORS.altar;
  useEffect(()=>()=>{pieces.paper.dispose();pieces.map.dispose();pieces.knots.dispose();},[pieces]);
  return <><mesh name="wedding:folded-marriage-letter" geometry={pieces.paper} position={[a.x,0,a.z]} raycast={noPick} userData={{playerCollision:false}}><meshStandardMaterial map={pieces.map} side={DoubleSide} roughness={.92}/></mesh>
    <mesh name="wedding:ceremony-knots" geometry={pieces.knots} raycast={noPick} userData={{playerCollision:false}}><meshStandardMaterial map={cloth} vertexColors side={DoubleSide} roughness={.73}/></mesh></>;
}

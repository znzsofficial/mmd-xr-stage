import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {Batch,type Part} from '../SceneryBatch';
import {noPick,paintedSurface} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {CITY_ORIGINS} from './site';
import {cityFingerposts,cityLamps,guideBoard} from './streetFurniture';
import {inReturnView,venueOnStreet,type StreetRoom} from './streetGround';
import {streetPlots} from './streetPlots';

type Ink=[number,number,number,number];
type Panel={x:number;y:number;z:number;w:number;h:number;yaw:number};
type Lettering=Panel&{title:string;sub:string;ground:string;guide?:boolean};
type Display=Panel&{crop:Ink};
const forest='#385d56',sand='#e8dcc2',brass='#ba9c73',lead='#6c7b77';

function fittings(room:StreetRoom){
  const pieces:Part[]=[],plates:Lettering[]=[],windows:Display[]=[];
  const put=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,ry=0,rx=0)=>pieces.push({p:[x,y,z],s:[w,h,d],color,ry,rx});
  function plate(p:Panel,title:string,sub:string,ground:string,guide=false){plates.push({...p,title,sub,ground,guide});}
  for(const [n,plot] of streetPlots.entries()){
    const [cx,cz,yaw,w,d,h,rows,plaster,trim,title,trade]=plot;
    if(!inReturnView(room,cx,cz,1))continue;
    const c=Math.cos(yaw),s=Math.sin(yaw);
    const panel=(x:number,y:number,z:number,width:number,height:number):Panel=>({x:cx+x*c+z*s,y,z:cz-x*s+z*c,w:width,h:height,yaw});
    const wall=(x:number,y:number,z:number,width:number,height:number,depth:number,color:string,rx=0)=>{
      const p=panel(x,y,z,width,height);put(p.x,y,p.z,width,height,depth,color,yaw,rx);
    };
    function glaze(x:number,y:number,z:number,width:number,height:number,tile:number,stock=false){
      const col=tile%3,row=Math.floor(tile/3);
      const crop:Ink=[col/3+.001,1-(row*512+507)/2048,(col+1)/3-.001,1-(row*512+(stock?116:4))/2048];
      windows.push({...panel(x,y,z,width,height),crop});
    }
    const bays=n%3===0?4:3,bay=w/bays;
    // The reveal, sill and head are masonry; the glazed sash is recessed
    // between them. The print runs behind the projecting central mullion.
    wall(0,-.12,-d/2,w+.38,.33,d+.48,'#969b8e');
    wall(0,1.52,-d/2-.37,w,3.04,d-.74,plaster);
    for(let k=0;k<=bays;k++)wall(-w/2+k*bay,1.49,-.19,.23,2.98,.48,plaster);
    for(let k=0;k<bays;k++){
      const x=-w/2+(k+.5)*bay,door=(k===bays-1),width=bay-.25;
      wall(x,door?1.22:1.43,-.31,width,door?2.44:1.98,.12,forest);
      glaze(x,door?1.55:1.44,-.245,width-.09,door?1.56:1.83,door?7:n%6,!door);
      if(door){wall(x,.41,-.22,width,.78,.09,trim);wall(x+width*.34,1.12,-.16,.038,.34,.068,brass);}
      else{wall(x,.28,-.13,width,.56,.39,plaster);wall(x,.56,.016,width+.04,.075,.38,sand);
        wall(x,1.44,-.12,.055,1.83,.17,trim);wall(x,2.00,-.12,width,.043,.17,trim);}
    }
    wall(0,2.72,-.115,w,.58,.48,plaster);wall(0,2.82,.162,w*.83,.56,.12,trim);
    plate(panel(0,2.82,.225,w*.83-.04,.51),title,trade,trim);
    if(n%3!==2){
      const stripeCount=n%3===0?Math.ceil(w/.53):1;
      for(let j=0;j<stripeCount;j++){
        const width=(w-.32)/stripeCount,x=(j+.5)*width-(w-.32)/2,canvas=j%2===0?trim:'#e8d6b1';
        wall(x,2.45,.47,width,.060,1.04,canvas,.165);wall(x,2.299,.98,width,.14,.055,canvas);
      }
    }else{wall(0,2.48,.42,w+.19,.13,1.15,lead);wall(0,2.416,.75,w-.24,.025,.35,sand);}
    wall(0,(3+h)/2,-d/2,w,h-3,d,plaster);wall(0,3.08,-d/2,w+.23,.18,d+.23,'#c4bea9');
    for(let j=0;j<rows;j++){
      const y=3.12+(h-3.12)*(j+.47)/rows,wh=Math.min(1.63,(h-3.18)/rows*.68);
      for(let k=0;k<bays;k++){
        const x=-w/2+(k+.5)*bay,width=bay*.68;
        wall(x,y,.033,width+.14,wh+.13,.14,trim);glaze(x,y,.106,width,wh,6+(k+n)%3);
        wall(x,y,.14,.052,wh,.085,trim);wall(x,y-wh*.22,.14,width,.044,.085,trim);
        wall(x,y-wh/2-.085,.08,width+.30,.085,.37,sand);
      }
      if(n%4===0){
        wall(0,y-wh/2-.12,.47,w*.68,.16,1.03,plaster);wall(0,y-wh/2+.51,.93,w*.68,.066,.095,forest);
        for(let k=0;k<=12;k++)wall(w*.68*(k/12-.5),y-wh/2+.21,.93,.035,.60,.053,trim);
      }
    }
    wall(0,h+.085,-d/2,w+.33,.17,d+.39,sand);
    if(n%3===1){
      wall(0,h+.38,-d*.54,w+.15,.14,d+.25,lead,-.086);wall(0,h+.40,-d+.13,w,.61,.21,trim);
    }else{
      wall(w*.20,h+.53,-d*.66,w*.39,.92,d*.41,trim);wall(w*.20,h+1.04,-d*.66,w*.39+.19,.10,d*.41+.22,lead);
      for(let j=0;j<3;j++)wall(w*(.07+.13*j),h+.57,-d*.45,w*.096,.46,.07,'#b5c7bc');
    }
    wall(w/2-.27,(h-.25)/2,.14,.067,h-.23,.069,lead);
  }
  for(const post of cityFingerposts){
    const {x,z,yaw,front,back}=post;if(!inReturnView(room,x,z))continue;
    put(x,.12,z,.19,.24,.19,'#919c90');put(x,.95,z,.085,1.61,.085,forest);
    const {w,h,d,y}=guideBoard;put(x,y,z,w,h,d,forest,yaw);
    for(const [dir,label] of [[1,front],[-1,back]] as const){
      const shift=dir*(d/2+.0025);
      plate({x:x+Math.sin(yaw)*shift,y,z:z+Math.cos(yaw)*shift,w:w-.035,h:h-.034,yaw:dir===1?yaw:yaw+Math.PI},label[0],label[1],forest,true);
    }
  }
  for(const {x,z} of cityLamps){
    if(!inReturnView(room,x,z))continue;
    put(x,.13,z,.21,.26,.21,'#999e8d');put(x,1.70,z,.073,2.93,.076,forest);
    put(x+.16,3.245,z,.51,.13,.23,lead);put(x+.16,3.165,z,.43,.046,.165,'#f1e7c7');
  }
  // These plates stay attached to the same canopy or wall across the gate.
  // The lido's outdoor face already carries its original enamel entry plate.
  const venues=[
    ['clinic',12.19,2.96,2.8,3.12,.50,Math.PI/2,'海站诊所','GARDEN CLINIC   /   01',forest],
    ['classroom',-4.03,2.70,8.03,2.82,.40,0,'海站教室','SCHOOL WALK   /   02','#516c5f'],
    ['pool',6.15,2.46,8.258,3.11,.38,Math.PI,'海站 · 体育街','SPORTS STREET   /   STATION','#356970'],
    ['arcadeHall',4.84,1.84,13.095,4.10,.66,0,'海站电玩厅','WEST GALLERY   /   ARCADE','#784f47'],
  ] as const;
  for(const [id,lx,y,lz,w,h,yaw,title,sub,bg] of venues){
    const o=CITY_ORIGINS[id],x=o.x+lx,z=o.z+lz;
    if(!venueOnStreet(room,id)||!inReturnView(room,x,z,.3))continue;
    if(id!=='pool')put(x,y,z,w+.055,h+.06,.065,brass,yaw);
    const dz=id==='pool'?.002:.035;
    plate({x:x+dz*Math.sin(yaw),y,z:z+dz*Math.cos(yaw),w,h,yaw},title,sub,bg);
  }
  return {pieces,plates,windows};
}

function printMesh(panels:readonly Display[]){
  const pos:number[]=[],uv:number[]=[],index:number[]=[];
  for(const q of panels){
    const first=pos.length/3,c=Math.cos(q.yaw),s=Math.sin(q.yaw),[l,b,r,t]=q.crop;
    for(const [dx,dy] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){
      pos.push(q.x+dx*q.w*c,q.y+dy*q.h,q.z-dx*q.w*s);uv.push(dx<0?l:r,dy<0?b:t);
    }
    index.push(first,first+1,first+2,first,first+2,first+3);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function streetPrint(plates:Lettering[]){
  const w=512,h=128,rows=Math.max(1,Math.ceil(plates.length/2)),height=2**Math.ceil(Math.log2(h*rows));
  const crop=(i:number):Ink=>{const x=(i%2)*w,y=(i>>1)*h;return [(x+1)/1024,1-(y+h-1)/height,(x+w-1)/1024,1-(y+1)/height];};
  const texture=paintedSurface(1024,height,g=>{
    for(const [i,q] of plates.entries()){
      const x=(i%2)*w,y=(i>>1)*h;g.save();g.translate(x,y);g.fillStyle=q.ground;g.fillRect(0,0,w,h);
      g.strokeStyle='#c7bc99';g.lineWidth=2;g.strokeRect(5,5,w-10,h-10);g.textAlign='center';
      g.fillStyle='#fff5d8';g.font=`650 ${q.guide?45:58}px system-ui,sans-serif`;g.fillText(q.title,w/2,q.guide?55:70,w-46);
      g.fillStyle=q.guide?'#f3e4c5':'#e1cfac';g.font=`650 ${q.guide?43:26}px system-ui,sans-serif`;g.fillText(q.sub,w/2,q.guide?109:106,w-40);
      g.restore();
    }
  });
  return {texture,geometry:printMesh(plates.map((p,i)=>({...p,crop:crop(i)})))};
}

export function StreetShops({room,shadows}:{room:StreetRoom;shadows:boolean}){
  const inventory=useMemo(()=>fittings(room),[room]);
  const print=useMemo(()=>streetPrint(inventory.plates),[inventory]);
  const windowMesh=useMemo(()=>printMesh(inventory.windows),[inventory]);
  const atlas=useBakedSurface('/scenery/terminus/park-shops.webp');
  useEffect(()=>()=>{windowMesh.dispose();print.geometry.dispose();print.texture.dispose();},[windowMesh,print]);
  return <group name="city:shopfronts-and-signposts">
    <Batch name="city:street-masonry-and-joinery" parts={inventory.pieces} casts={shadows}/>
    {atlas&&<mesh name="city:shop-windows" geometry={windowMesh} raycast={noPick} userData={{playerCollision:false}}>
      <meshStandardMaterial map={atlas} roughness={.63}/></mesh>}
    <mesh name="city:enamel-wayfinding" geometry={print.geometry} raycast={noPick} userData={{playerCollision:false}}>
      <meshBasicMaterial map={print.texture} toneMapped={false}/></mesh>
  </group>;
}

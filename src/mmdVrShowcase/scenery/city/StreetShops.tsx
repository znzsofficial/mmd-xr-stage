import {useEffect,useMemo} from 'react';
import {Euler} from 'three';
import {Batch,type Part} from '../SceneryBatch';
import {noPick} from '../sceneryPaint';
import {useCoastalPrint} from '../terminus/coastalPrints';
import {CITY_ORIGINS} from './site';
import {cityFingerposts,cityLamps,guideBoard} from './streetFurniture';
import {inReturnView,venueOnStreet,type StreetRoom} from './streetGround';
import {shopCanopy,streetPlots,tideOffice,tideOfficeParts,watchClock,watchClockParts} from './streetPlots';
import {enamelLabel,printMesh,streetPrint,type Panel,type PrintedPanel,type Glazing} from './streetPrint';
import {clockFace,tideCounter,tideGauge,tradeWindow} from './tradeWindows';
import {appendSportsElevation} from './SportsStreetLandmark';
const forest='#385d56',sand='#e8dcc2',brass='#ba9c73',lead='#6c7b77';

function fittings(room:StreetRoom){
  const pieces:Part[]=[],plates:PrintedPanel[]=[],windows:Glazing[]=[];
  const put=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,ry=0)=>pieces.push({p:[x,y,z],s:[w,h,d],color,ry});
  function plate(p:Panel,title:string,sub:string,ground:string,guide=false){plates.push(enamelLabel(p,title,sub,ground,guide));}
  for(const [n,plot] of streetPlots.entries()){
    const [cx,cz,yaw,w,d,h,rows,plaster,trim,title,trade,stock]=plot;
    if(!inReturnView(room,cx,cz,1))continue;
    const c=Math.cos(yaw),s=Math.sin(yaw);
    const panel=(x:number,y:number,z:number,width:number,height:number):Panel=>({x:cx+x*c+z*s,y,z:cz-x*s+z*c,w:width,h:height,yaw});
    const wall=(x:number,y:number,z:number,width:number,height:number,depth:number,color:string,rx=0)=>{
      const p=panel(x,y,z,width,height);
      // Pitch in facade space. Batch consumes XYZ; setting pitch directly
      // in world X used to lift one end of the east-facing shop canopies.
      if(rx){const r=new Euler(rx,yaw,0,'YXZ').reorder('XYZ');pieces.push({p:[p.x,y,p.z],s:[width,height,depth],color,rx:r.x,ry:r.y,rz:r.z});}
      else put(p.x,y,p.z,width,height,depth,color,yaw);
    };
    function glaze(x:number,y:number,z:number,width:number,height:number,tile:number){
      const col=tile%3,row=Math.floor(tile/3);
      const crop:Glazing['crop']=[col/3+.001,1-(row*512+507)/2048,(col+1)/3-.001,1-(row*512+4)/2048];
      windows.push({...panel(x,y,z,width,height),crop});
    }
    const bays=n%3===0?4:3,bay=w/bays,display=tradeWindow(stock);
    // Full-depth backing meets each jamb at -.43. The old backing stopped
    // .31 m short of the jambs, leaving the outside corners open sideways.
    wall(0,-.12,-d/2,w+.38,.33,d+.48,'#969b8e');
    wall(0,1.5,-(d+.43)/2,w,3,d-.43,plaster);
    for(let k=0;k<=bays;k++){
      const end=k===0||k===bays,dx=k===0?.0575:k===bays?-.0575:0;
      wall(-w/2+k*bay+dx,1.215,-.19,end?.115:.23,2.43,.48,plaster);
    }
    for(let k=0;k<bays;k++){
      const x=-w/2+(k+.5)*bay,door=(k===bays-1),width=bay-.25;
      wall(x,door?1.22:1.43,-.31,width,door?2.44:1.98,.12,forest);
      if(door){
        glaze(x,1.60,-.240,width-.09,1.56,7);wall(x,.41,-.22,width,.78,.09,trim);wall(x+width*.34,1.12,-.16,.038,.34,.068,brass);
      }else{
        plates.push({...panel(x,1.44,-.240,width-.09,1.83),art:display,from:k/(bays-1),to:(k+1)/(bays-1)});
        wall(x,.28,-.13,width,.56,.39,plaster);wall(x,.56,.016,width+.04,.075,.38,sand);
        // The joints between the display cases already divide this panorama.
        wall(x,2.00,-.13,width,.051,.15,trim);
      }
    }
    const signY=stock==='pharmacy'?3.03:2.86;
    wall(0,2.715,-.1525,w,.57,.555,plaster);wall(0,signY,.162,w*.87,.51,.12,trim);
    plate(panel(0,signY,.230,w*.87-.04,.47),title,trade,trim);
    for(const roof of shopCanopy(n,w)){
      // Broad sewn panels: one drop per structural bay, not dozens of
      // touching, identically pitched boxes for a printed pinstripe.
      const count=n%3===0?bays:1,width=roof.w/count;
      for(let j=0;j<count;j++)wall((j+.5)*width-roof.w/2,roof.y,roof.z,width,roof.h,roof.d,
        j%2?'#dcc8a2':n%3===2?lead:trim,roof.pitch);
    }
    wall(0,(3+h)/2,-d/2,w,h-3,d,plaster);wall(0,3.08,-d/2,w+.23,.18,d+.23,'#c4bea9');
    for(let j=0;j<rows;j++){
      const y=3.12+(h-3.12)*(j+.47)/rows,wh=Math.min(1.63,(h-3.18)/rows*.68);
      for(let k=0;k<bays;k++){
        const x=-w/2+(k+.5)*bay,width=bay*.68;
        wall(x,y,.033,width+.14,wh+.13,.14,trim);glaze(x,y,.113,width,wh,6+(k+n)%3);
        wall(x,y,.14,.060,wh,.085,trim);
        wall(x,y-wh/2-.085,.08,width+.30,.085,.37,sand);
      }
      if(n%4===0){
        wall(0,y-wh/2-.12,.47,w*.68,.16,1.03,plaster);wall(0,y-wh/2+.51,.93,w*.68,.066,.095,forest);
        for(let k=0;k<=8;k++)wall(w*.68*(k/8-.5),y-wh/2+.21,.93,.048,.60,.053,trim);
      }
    }
    wall(0,h+.085,-d/2,w+.33,.17,d+.39,sand);
    if(n%3===1){
      // Raised daylight monitor: the glass stands on the finished roof.
      // The former pitched plate had visible sky between it and the cornice.
      wall(0,h+.47,-d*.64,w*.79,.60,d*.32,trim);wall(0,h+.825,-d*.64,w*.79+.18,.11,d*.32+.18,lead);
      for(const k of [-1,0,1])glaze(k*w*.25,h+.47,-d*.48+.012,w*.21,.36,7);
    }else{
      wall(w*.20,h+.53,-d*.66,w*.39,.92,d*.41,trim);wall(w*.20,h+1.04,-d*.66,w*.39+.19,.10,d*.41+.22,lead);
      for(let j=0;j<3;j++)wall(w*(.07+.13*j),h+.57,-d*.45,w*.096,.46,.07,'#b5c7bc');
    }
    wall(w/2-.27,(h-.25)/2,.14,.067,h-.23,.069,lead);
  }
  if(inReturnView(room,watchClock.x,watchClock.z)){
    pieces.push(...watchClockParts);
    for(const dir of [-1,1])plates.push({...watchClock,z:watchClock.z+dir*(watchClock.d/2+.008),
      w:watchClock.w-.055,h:watchClock.h-.055,yaw:dir===1?0:Math.PI,art:clockFace});
  }
  if(inReturnView(room,tideOffice.x,tideOffice.z)){
    const {x,z,w}=tideOffice;
    pieces.push(...tideOfficeParts);
    plates.push({x,y:4.70,z:z+.24,w:w-.45,h:2.60,yaw:0,art:tideGauge},
      {x,y:1.57,z:z+.145,w:w-.48,h:1.21,yaw:0,art:tideCounter});
  }
  appendSportsElevation(room,pieces,plates);
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

export function StreetShops({room,shadows}:{room:StreetRoom;shadows:boolean}){
  const inventory=useMemo(()=>fittings(room),[room]);
  const print=useMemo(()=>streetPrint(inventory.plates),[inventory]);
  const windowMesh=useMemo(()=>printMesh(inventory.windows),[inventory]);
  const atlas=useCoastalPrint('shops');
  useEffect(()=>()=>{windowMesh.dispose();print.geometry.dispose();print.texture.dispose();},[windowMesh,print]);
  return <group name="city:shopfronts-and-signposts">
    <Batch name="city:street-masonry-and-joinery" parts={inventory.pieces} casts={shadows}/>
    {atlas&&<mesh name="city:shop-windows" geometry={windowMesh} raycast={noPick} userData={{playerCollision:false}}>
      <meshStandardMaterial map={atlas} roughness={.63}/></mesh>}
    <mesh name="city:enamel-wayfinding" geometry={print.geometry} raycast={noPick} userData={{playerCollision:false}}>
      <meshStandardMaterial map={print.texture} roughness={.78}/></mesh>
  </group>;
}

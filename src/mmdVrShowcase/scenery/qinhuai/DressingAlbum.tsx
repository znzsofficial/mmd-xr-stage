import {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {Float32BufferAttribute,PlaneGeometry,type Texture} from 'three';
import {useSceneAction} from '../input/useSceneAction';
import {folio,folioUv,paperBow,spreads} from './chamberFolio';
import {DRESSER,GALLERY_Y,songhouseSightline} from './songhouseLayout';

// Hit the actual curved, opaque pages. Turning the spread changes 34 UVs;
// it neither reloads the atlas nor changes/disables the pressed mesh.
export function DressingAlbum({map}:{map:Texture}){
  const [page,setPage]=useState(0);
  const {bindings,hovered}=useSceneAction('qinhuai',songhouseSightline,()=>setPage(p=>(p+1)%spreads));
  const paper=useMemo(()=>{
    const g=new PlaneGeometry(folio.w,folio.h,16,1),pos=g.attributes.position,colors=[];
    for(let i=0;i<pos.count;i++){
      const u=pos.getX(i)*2/folio.w;
      const corner=pos.getY(i)<0&&u>.89?(u-.89)*.08:0;pos.setZ(i,paperBow(u)+corner);
      const t=.99-.13*Math.exp(-Math.abs(u)*15);colors.push(t,t,t);
    }
    g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
  },[]);
  useLayoutEffect(()=>{
    const uv=paper.attributes.uv,pos=paper.attributes.position;
    for(let i=0;i<uv.count;i++)uv.setXY(i,...folioUv(page+1,pos.getX(i)/folio.w+.5,pos.getY(i)/folio.h+.5));
    uv.needsUpdate=true;
  },[page,paper]);
  useEffect(()=>()=>paper.dispose(),[paper]);
  return <mesh name="qinhuai:dressing-album" geometry={paper} position={[DRESSER.x+folio.offsetX,GALLERY_Y+folio.height,DRESSER.z+folio.offsetZ]}
    rotation-x={folio.tilt} {...bindings}><meshStandardMaterial map={map} roughness={.91} vertexColors color={hovered?'#fffaf2':'#ffffff'}/></mesh>;
}

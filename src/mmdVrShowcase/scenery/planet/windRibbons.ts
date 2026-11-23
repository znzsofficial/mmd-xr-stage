import {BufferGeometry,Color,Float32BufferAttribute,Vector3} from 'three';
import {windPoint,type WindLane} from './windAtlas';
import {windTerminals} from './windTerminalLayout';
import {windCollarBed} from './windCollarBed';

/** Short translucent streamlines make each nozzle readable from the main dial;
 * the open middle of the journey is indicated only by moving tracer grains. */
export function windRibbons(l:WindLane){
  const pos:number[]=[],rgb:number[]=[],idx:number[]=[],a=new Vector3(),b=new Vector3(),dir=new Vector3(),u=new Vector3(),v=new Vector3(),edge=new Vector3();
  for(const site of windTerminals.filter(s=>s.lane===l)){
    const end=site.back,inverse=site.rotation.clone().invert(),height=windCollarBed(site),local=new Vector3();
    for(let j=0;j<3;j++){
      const first=pos.length/3,c=new Color(l.moon.color);let seat=0;
      for(let i=0;i<=40;i++){
        const f=i/40,t=end?1-f*.15:f*.15,angle=f*6.4+j*2*Math.PI/3,r=.66+.08*Math.sin(Math.PI*f);
        windPoint(l,t,a);dir.subVectors(windPoint(l,t+.0001,b),a).normalize();u.set(0,0,1).cross(dir).normalize();v.crossVectors(dir,u);
        for(const side of [-1,1]){const theta=angle+side*.055*Math.sin(f*Math.PI);
          edge.copy(a).addScaledVector(u,r*Math.cos(theta)).addScaledVector(v,r*Math.sin(theta));
          if(i===0){local.copy(edge).sub(site.port.foot).applyQuaternion(inverse);seat=height(local.x,local.z)+.121-local.y;}
          edge.addScaledVector(site.port.up,seat*(1-f)**2);pos.push(edge.x,edge.y,edge.z);rgb.push(c.r,c.g,c.b);}
        if(i){const k=first+2*i;idx.push(k-2,k,k-1,k-1,k,k+1);}
      }
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.setIndex(idx);g.computeBoundingSphere();return g;
}

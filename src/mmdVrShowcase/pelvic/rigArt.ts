import { Matrix4, Vector3 } from 'three';
import { ball, box, PaintedParts, ring, rod, turn } from '../play/modelParts';
import { siliconeMount, siliconeTilt } from '../play/siliconeProfile';
import { pelvicRailLimit, pelvicRailMatrix, type PelvicFrame } from './geometry';
import { pelvicRailTravel } from './path';
import { PELVIC_LIMITS } from './stateTypes';
export {createSealShell} from './vulvaMesh';

const alloy='#62727b',enamel='#c8c9bd',bronze='#b99569',rubber='#474450';
const partMount=new Matrix4().makeRotationX(siliconeTilt).setPosition(...siliconeMount);
// Flange bottom in the manufactured coordinates is y=-45.6 mm. The slider
// carries it by its rim; no part of the carriage covers the outlet or shaft.
export function makeCarriage(){const p=new PaintedParts();
  p.add(turn([[0,-.057],[.034,-.057],[.037,-.054],[.037,-.046],[.035,-.043],[.032,-.044],[.030,-.048],[0,-.048]],32),enamel);
  p.add(ring(.034,.0017,32).rotateX(Math.PI/2).translate(0,-.046,0),rubber);
  p.add(box(0,-.061,0,.091,.013,.029),alloy);
  for(const x of [-.045,.045]){
    p.add(box(x,-.062,0,.015,.022,.026),enamel);
    p.add(ball(x,-.059,.014,.003,.003,.0018,10),bronze);
  }return p.finish().applyMatrix4(partMount);
}

const railPoint=(x:number)=>new Vector3(x,-.062,0).applyMatrix4(partMount);
/** Two measured rails travel through the actual sliding shoes over the full
 * drive range. Build in the port's rigid local system; translation/rotation
 * during a dance changes the mount matrix, not the geometry allocation. */
export function makeTracks(frame:PelvicFrame){const p=new PaintedParts(),m=new Matrix4(),lo=pelvicRailTravel(frame,PELVIC_LIMITS.position[0]),hi=pelvicRailLimit(frame);
  const ends=new Vector3(),base=new Vector3();
  for(const x of [-.045,.045]){const local=railPoint(x),prev=new Vector3(),next=new Vector3();
    for(let i=0;i<=12;i++){
      pelvicRailMatrix(frame,lo+(hi-lo)*i/12,m).premultiply(frame.inverse);next.copy(local).applyMatrix4(m);
      if(i)p.add(rod(prev.toArray(),next.toArray(),.0042,.0042,10),alloy);
      if(i===0){base.addScaledVector(next,.5);p.add(ball(next.x,next.y,next.z,.008,.008,.008,12),bronze);}
      if(i===12){ends.addScaledVector(next,.5);p.add(ball(next.x,next.y,next.z,.007,.007,.007,12),bronze);}
      prev.copy(next);
    }
  }
  for(const v of [ends,base])p.add(rod([v.x-.045,v.y,v.z],[v.x+.045,v.y,v.z],.0045),alloy);
  return {geometry:p.finish(),post:base};
}

export function makeStandFoot(){const p=new PaintedParts();
  p.add(turn([[0,.004],[.034,.004],[.035,.012],[.026,.027],[.014,.033],[0,.033]],24),enamel);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=.085*Math.cos(a),z=.085*Math.sin(a);
    p.add(rod([0,.02,0],[x,.008,z],.009,.006),alloy);p.add(ball(x,.006,z,.014,.006,.014,12),rubber);}
  return p.finish();
}

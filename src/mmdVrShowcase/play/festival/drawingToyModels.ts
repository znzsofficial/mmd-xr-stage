import { BufferGeometry, Color, Float32BufferAttribute, OctahedronGeometry, TorusGeometry } from 'three';
import { ball, box, coil, PaintedParts, ring, rod, turn } from '../modelParts';

import {constellationGrip,constellationOutlet,ribbonPenGrip,ribbonPenOutlet} from './fittings';
export {constellationGrip,constellationOutlet,ribbonPenGrip,ribbonPenOutlet} from './fittings';

/** Pocket astrolabe: the open brass limb carries two skew meridians. The chart
 * and its reader are back to back, so the holder sees the star map too. */
export function makeStarProjector() {
  const p = new PaintedParts(), gold = '#c19b68', rim = '#73638d', navy = '#35425e', pearl = '#f0d5a2';
  const [,y,z] = constellationGrip.point, cy = constellationOutlet.position[1];
  p.add(turn([[0,-.052],[.013,-.052],[.019,-.046],[.017,-.036],[.015,-.018],[.015,.018],[.019,.029],[.013,.036],[0,.036]],20).translate(0,y,z),navy);
  for (const dy of [-.043,-.035,.026]) p.add(ring(.017,.0017,20).rotateX(Math.PI/2).translate(0,y+dy,z),gold);
  p.add(ring(.059,.0048,48).translate(0,cy,z),gold);
  p.add(ring(.049,.0025,36).rotateX(.48).rotateZ(.39).translate(0,cy,z),rim);
  p.add(ring(.049,.0022,36).rotateY(-.94).rotateZ(-.38).translate(0,cy,z),gold);
  // Equinoctial scale engraved on the eye side of the limb.
  for (let i=0;i<24;i++) {
    const a = i*Math.PI/12;
    p.add(box(0,.058,0,i%3?.0013:.0023,i%3?.003:.005,.0016).rotateZ(a).translate(0,cy,z+.0043),navy);
  }
  for (const side of [-1,1]) {
    p.add(rod([0,-.008,z],[side*.036,.0045,z],.007,.0035),rim);
    p.add(rod([side*.047,cy,z],[side*.022,cy,z],.0026),gold);
    p.add(ball(side*.059,cy,z,.006,.006,.007,10),pearl);
  }
  p.add(ball(0,cy,z,.03,.03,.022,20),navy);
  const chart = [[-.019,.002],[-.009,.012],[.0005,-.004],[.013,.004],[.016,-.008]];
  for (let i=0;i<chart.length;i++) {
    const [x,h]=chart[i], depth=z+.022*Math.sqrt(1-(x*x+h*h)/.0009);
    p.add(ball(x,cy+h,depth,.0021,.0021,.002,8),pearl);
    if(i){const [px,ph]=chart[i-1];p.add(rod([px,cy+ph,z+.022*Math.sqrt(1-(px*px+ph*ph)/.0009)+.001],[x,cy+h,depth+.001],.00085,.00085,5),gold);}
  }
  p.add(ring(.0188,.003,24).translate(0,cy,-.076),gold);
  p.add(new OctahedronGeometry(1).rotateZ(Math.PI/4).scale(.021,.021,.024).translate(0,cy,-.075),'#9fd8ce');
  return p.finish();
}

// The silk unwinds from the top of the roll, bends over the loom and enters
// the gold eye. Two wide dyed lanes and a slight central fold, not round wire.
const blush='#d07791', jacquard='#72bbae', gilt='#cba67b';
function threadedSilk() {
  const positions:number[]=[], colors:number[]=[], index:number[]=[];
  const dyes = [new Color(blush),new Color('#e995a5'),new Color('#a0d3bd'),new Color(jacquard)], lanes=[-1,0,0,1];
  for(let i=0;i<=12;i++) {
    const t=i/12, w=.024-.011*t, z=-.059+(.059+ribbonPenOutlet.position[2])*t;
    const y=.035+.027*(1-t)+.012*Math.sin(t*Math.PI);
    for(let j=0;j<4;j++) {
      const side=lanes[j]; positions.push(side*w,y+(side===0 ? .002 : 0)+side*.005*Math.sin(t*Math.PI),z);
      colors.push(dyes[j].r,dyes[j].g,dyes[j].b);
    }
    if(i)for(const off of [0,2]) {const k=4*i+off;index.push(k-4,k-3,k,k-3,k+1,k);}
  }
  const g=new BufferGeometry();g.setIndex(index);g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

/** A lacquered ribbon reel on a turned handle. The spool axis is across the
 * hand; open petal cheeks show the two colours wound around the bobbin. */
export function makeSilkSpool() {
  const p=new PaintedParts(), plum='#70475d',cream='#eedab7';
  const [,hy,hz]=ribbonPenGrip.point, cy=.026,cz=-.059;
  p.add(turn([[0,-.052],[.014,-.052],[.018,-.047],[.016,-.036],[.014,-.016],[.016,.02],[.021,.033],[.016,.039],[0,.039]],22).translate(0,hy,hz),plum);
  p.add(coil(.0154,.012,4,.0013,14).translate(0,hy-.002,hz),'#ca99a2');
  p.add(rod([-.03,cy,cz],[.03,cy,cz],.036,.036,32),blush);
  p.add(rod([-.001,cy,cz],[.03,cy,cz],.0362,.0362,32),jacquard);
  p.add(coil(.0363,.012,4.6,.0012,22).rotateZ(Math.PI/2).translate(0,cy,cz),cream);
  for(const s of [-1,1]) {
    const x=s*.033;
    p.add(rod([s*.011,-.014,hz],[s*.040,cy,cz],.006,.0045),gilt);
    p.add(ring(.043,.0031,32).rotateY(Math.PI/2).translate(x,cy,cz),plum);
    p.add(ring(.039,.0016,32).rotateY(Math.PI/2).translate(x,cy,cz),gilt);
    for(let i=0;i<5;i++) {const a=2*Math.PI*i/5;
      p.add(ring(.0108,.00165,16).scale(.69,1.66,1).translate(0,.022,0).rotateZ(a).rotateY(Math.PI/2).translate(x,cy,cz),gilt);
    }
    p.add(ball(s*.038,cy,cz,.008,.009,.009,12),cream);
    p.add(rod([s*.028,cy,cz-.018],[s*.019,.035,-.128],.0035,.0028,8),plum);
  }
  const [,eyeY,eyeZ]=ribbonPenOutlet.position;
  p.add(new TorusGeometry(.018,.004,8,28).scale(1,.53,1).translate(0,eyeY,eyeZ+.004),gilt);
  p.add(threadedSilk());return p.finish();
}

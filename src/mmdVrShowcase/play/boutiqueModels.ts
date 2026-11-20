import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { ball, PaintedParts, ring, rod, turn } from './modelParts';

const latitude = (radius:number, thickness:number, y:number) => ring(radius,thickness,32).rotateX(Math.PI/2).translate(0,y,0);
export const wandLights = [{radius:.0185,y:.047},{radius:.0177,y:.054}] as const;

export function makeWandHandle() {
  const p=new PaintedParts();
  p.add(turn([[0,-.065],[.009,-.064],[.014,-.059],[.015,-.051],[.015,-.035],[.017,-.01],[.019,.018],[.019,.041],[.0185,.047],[.0177,.054],[.016,.062],[.011,.068],[0,.068]],32),'#375552');
  p.add(latitude(.0145,.0014,-.054),'#b99974');
  // Two charging contacts on the flat heel; a raised thumb pad towards the head.
  for(const side of [-1,1])p.add(ball(side*.0035,-.0647,0,.0018,.0008,.0018,10),'#c9a770');
  p.add(ball(0,.027,.018,.008,.011,.0026),'#233a3a');
  p.add(ball(0,.027,.020,.0058,.0085,.0015),'#82a399');
  for(const lamp of wandLights)p.add(latitude(lamp.radius,.0016,lamp.y),'#293c3c');
  p.add(turn([[.012,.066],[.012,.071],[.01,.077],[.01,.081],[0,.081]],32),'#a6bab0');
  return p.finish();
}

// Origin is the flex joint. All head travel is above the grip, including the
// bellows and cap seam; the status windows and thumb pad must stay still.
export function makeWandHead() {
  const p=new PaintedParts();
  p.add(turn([[0,-.005],[.009,-.005],[.010,.001],[.011,.008],[.013,.017],[.016,.022],[0,.022]],32),'#859e94');
  for(let i=0;i<3;i++)p.add(latitude(.0102+i*.0011,.0015,.002+i*.0042),'#b9cabb');
  p.add(turn([[0,.016],[.013,.016],[.019,.02],[.024,.028],[.0265,.038],[.027,.05],[.026,.057],[.023,.064],[.018,.069],[.011,.072],[.004,.0735],[0,.0738]],40),'#c4d8c4');
  p.add(latitude(.024,.0012,.028),'#95afa1');
  return p.finish();
}

export function makeBrushHandle() {
  const p=new PaintedParts();
  p.add(turn([[0,-.063],[.006,-.062],[.01,-.058],[.011,-.052],[.010,-.044],[.0087,-.034],[.009,0],[.010,.044],[.009,.058],[0,.061]],28),'#63353e');
  p.add(latitude(.0104,.0014,-.052),'#d4aa75');
  // Fluted crimp ferrule under the feather bundle, separated by a dark bead.
  p.add(turn([[.009,.046],[.011,.049],[.011,.058],[.013,.067],[.012,.071],[.009,.073],[0,.073]],28),'#c99862');
  p.add(latitude(.0105,.0015,.049),'#744a3d');
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=Math.cos(a),z=Math.sin(a);
    p.add(rod([x*.0106,.054,z*.0106],[x*.0125,.067,z*.0125],.00085,.0006,5),'#ebcda3');
  }
  return p.finish();
}

/** Each plume has a bowed rachis and two unequal, cupped vanes. Make the
 * barbs as overlapping tapered strips: real splits at the edges, no alpha
 * sorting or flat billboard that disappears from the back of the wrist. */
function feather(length:number,bend:number,width:number,base:string,tip:string,seed:number) {
  const pos:number[]=[],colors:number[]=[],indices:number[]=[];
  const a=new Color(base),b=new Color(tip),color=new Color();
  function vertex(t:number,side:number,w:number,lift:number,shade:number) {
    const sweep=Math.sin(t*Math.PI*.78)*.003;
    pos.push(sweep+side*w,t*length+lift,bend*t*t+.0015*Math.sin(Math.PI*t)+w*.29);
    color.copy(a).lerp(b,Math.min(1,t*.86+shade)).toArray(colors,colors.length);
    return pos.length/3-1;
  }
  const n=28;
  for(const side of [-1,1])for(let i=0;i<n;i++){
    const t=i/n,next=(i+1)/n;
    const span=width*(.10+.90*Math.sin(Math.PI*t)**.72)*(side===1?.87:1)*(1+.06*Math.sin(i*2.3+seed));
    const sweep=Math.min(length*(1-t),.018+span*.64);
    const c=vertex(t,side,0,0,.035),d=vertex(next,side,0,0,.035);
    const m=vertex(t,side,span*.52,sweep*.63,.12),k=vertex(next,side,span*.52,sweep*.58,.085);
    const split=i%6===3?.68:1, e=vertex(t,side,span*split,sweep,.14),f=vertex(t,side,span*split*.98,sweep+length/n*.66,.16);
    const faces=[c,d,k,c,k,m,m,k,f,m,f,e];
    indices.push(...(side===1?faces.reverse():faces));
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function makePlume() {
  const p=new PaintedParts();
  const plumes=[ // azimuth, length, outward bend, half-width, base and tip
    [0,.153,.040,.022,'#844550','#f4c3ad'],[1.24,.142,.046,.020,'#9e6062','#f7cfb3'],
    [2.5,.147,.039,.022,'#6d3445','#e2a2a2'],[3.8,.135,.045,.020,'#a76a72','#f0b6a8'],
    [5.1,.149,.038,.021,'#86424f','#f5bba0'],[2.0,.169,.018,.022,'#c1847d','#f7dbbf'],
    [4.95,.179,.014,.019,'#9b6169','#f6c8b0'],
  ] as const;
  for(const [angle,h,bend,w,base,tip] of plumes){
    const g=feather(h,bend,w,base,tip,angle);
    p.add(g.translate(0,0,.0025).rotateY(angle).translate(0,.069,0));
    // Pale, narrowing shaft follows the same curvature as its vane.
    const axis=(t:number):[number,number,number]=>[Math.sin(t*Math.PI*.78)*.003,h*t,bend*t*t+.0015*Math.sin(Math.PI*t)+.0025];
    for(let j=0;j<7;j++)p.add(rod(axis(j/7),axis((j+1)/7),.0012*(1-j/8),.0012*(1-(j+1)/8),6).rotateY(angle).translate(0,.069,0),'#e3c4a5');
  }
  return p.finish();
}

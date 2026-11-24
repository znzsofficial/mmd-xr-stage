import type {V} from '../../bodyState/breast/art/geometry';
import {blend,oval,sheet,strand,type Layer,type Study} from './forms';

// Longitudinal dissection. The near strip of anterior wall is removed, not
// displaced: where both walls remain their mucosal faces share a resting seam.
const epithelium:V=[222,144,148],crest:V=[239,171,157],muscle:V=[195,123,132],fascia:V=[222,165,153];
const bell=(x:number,w:number)=>Math.exp(-x*x/(w*w));
function width(t:number){return .341+.116*Math.sin(Math.PI*t)+.09*bell(t-.86,.17)-.063*bell(t-.20,.14);}
function bed(t:number){return .39-.43*t+.065*Math.sin(Math.PI*t*1.6);}
function ridge(x:number,t:number){
  // Stagger the transverse folds about a low longitudinal column. The ends
  // dissolve into the lateral sulci rather than reaching the cut as fluting.
  const phase=6.1*t+.37*Math.sin(Math.PI*t*1.6)+.55*x*x+.22*x+.19*Math.sin(4.9*x+4*t);
  return ((1+Math.cos(phase*2*Math.PI))*.5)**2.4*(.22+.78*bell(x+.16,.70))*(.42+.58*Math.sin(Math.PI*t)**.5);
}
function lining(x:number,t:number){return bed(t)+.083*(1-x*x)+.119*ridge(x,t)+.043*bell(x+.12,.17);}
const trim=(t:number)=>.18+.115*Math.sin(5*t+.3)-.080*t+.038*Math.sin(24*t);
function makeWall(front:boolean):Layer[]{
  // x is material width, t is entrance -> vault, v runs mucosa -> serosa.
  const pt=(u:number,t:number,v:number):V=>{
    const x=front?trim(t)+(1-trim(t))*u:2*u-1,curled=(1-x*x)*Math.sin(Math.PI*t),h=front?.176:.203;
    const thickness=h+.045*curled+.029*bell(t-.81,.16),face=lining(x,t),outer=bed(t)+.086*(1-x*x)+(front?thickness+.076:-thickness);
    const z=face+v*(outer-face);
    const lateral=x*width(t)*(1+.066*Math.sin(Math.PI*v)),depth=z-.19;
    // Oblique section through a bent tract. Both anterior and side views see
    // a cut edge and part of the floor, but from opposite sides of the folds.
    return [.913*lateral-.408*depth,-.50+1.37*t-.043*x*t+.040*(1-t)*x*x-.024*(1+x)*t*t,
      .19+.408*lateral+.913*depth];
  };
  const sectionInk=(v:number,t:number):V=>{
    if(v<.18)return blend(crest,epithelium,v/.18);
    const grain=(.5+.5*Math.cos(72*t+6*v+.9*Math.sin(14*t)))**3;
    // Muscularis and the thin, pale connective coat have distinct thickness.
    return blend(muscle,fascia,.12+.20*grain+.65*v**4);
  };
  const rows=92,cols=35,sgn=front?1:-1;
  const layers:Layer[]=[sheet(rows,cols,(u,t)=>pt(u,t,0),(u,t)=>{
    const x=front?trim(t)+(1-trim(t))*u:2*u-1,r=ridge(x,t);
    return blend(blend(epithelium,[180,114,135],.23*(1-r)),crest,.74*r);
  },-sgn),sheet(rows,cols,(u,t)=>pt(u,t,1),(u,t)=>{
    const path=.49+.20*Math.sin(6*t+.3)+.085*Math.sin(15*t),fork=path+.85*(t-.52),
      vein=Math.max(bell(u-path,.033)*bell(t-.47,.34),.75*bell(u-fork,.030)*bell(t-.69,.13));
    return blend(blend(fascia,muscle,.18+.16*Math.cos(17*t+u*4)),[153,114,144],.66*vein);
  },sgn)];
  layers[0][0].material='silk';
  for(const edge of [0,1])layers.push(sheet(rows,14,(v,t)=>pt(edge,t,v),sectionInk,(edge===0?1:-1)*sgn));
  for(const end of [0,1])layers.push(sheet(14,cols,(u,v)=>pt(u,end,v),(u,v)=>sectionInk(v,end+u*.022),(end===0?1:-1)*sgn));
  return layers;
}
export function createVaginalStudy():Study{
  const layers=[...makeWall(false),...makeWall(true)];
  // Cervical portio and the two lips of its closed os sit in a curved vault.
  layers.push(oval([.042,.858,-.077],[.294,.149,.126],[213,141,150],([x,y,z])=>[x,y+.19*z,z-.28*y]),
    strand([[-.161,.856,.003,.012],[-.085,.847,.051,.034],[.03,.843,.063,.042],[.154,.848,.051,.032],[.239,.868,.008,.009]],crest),
    strand([[-.156,.870,.003,.010],[-.067,.890,.052,.024],[.058,.897,.066,.024],[.164,.890,.051,.022],[.227,.873,.009,.009]],epithelium));
  return {layers,marks:[]};
}

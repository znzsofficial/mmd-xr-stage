/** Exterior in the socket's rigid axes, in units of calibrated radius.
 * Each half is a longitudinal sheet: medial vestibule, narrow folded free
 * edge, interlabial sulcus, broad lateral pad and its tucked skin margin.
 * The only free edges at the entrance are the two sides of the measured cut.
 * Neither this model nor its projection has access to the actor's mesh. */
export const rimSamples=40, slitHalfLength=.62;
const posterior=-2.04,anterior=2.83,tailRows=14,headRows=20;
// Transverse section at the body of each fold. Pigment is fixed to the
// tissue; shape, rather than a painted line, produces the crests and groove.
const section=[
  [0,0,'#cd808a'],[.08,.034,'#db8b94'],[.16,.069,'#e3969e'],
  [.223,.153,'#e89da7'],[.274,.302,'#ed9faa'],[.33,.438,'#f0a4ae'],
  [.397,.502,'#f1aab3'],[.472,.447,'#e99fac'],[.543,.274,'#da8e9e'],
  [.617,.162,'#cf8795'],[.714,.145,'#d58a95'],[.835,.225,'#e49ca4'],
  [1.005,.414,'#eea8a8'],[1.225,.535,'#f2b3ad'],[1.45,.49,'#f3beb3'],
  [1.635,.34,'#efbaad'],[1.772,.14,'#e8b1a7'],[1.83,-.08,'#d9a09e'],
  [1.81,-.21,'#cf9597'],
] as const;
export const formColors=section.map(k=>k[2]);
export const junctionColor='#edb4b0';
export type FormPoint={x:number;y:number;z:number};
export const foldStyles=['natural','soft','defined'] as const;
export type FoldStyle=typeof foldStyles[number];
type Site=FormPoint & {cos:number;sin:number;side:number;weight:number;roll:number;pad:number;scallop:number;blend:number;gloss:number;contactShade:number};
export type CutBasis={x:number;y:number;xx:number;xy:number;yx:number;yy:number};
type Row={sites:Site[]};
const sq=(x:number)=>x*x,gauss=(x:number)=>Math.exp(-x*x);

function makeHalf(side:1|-1){
  const rows:Row[]=[];
  for(let j=-tailRows;j<=rimSamples/2+headRows;j++){
    const i=Math.max(0,Math.min(rimSamples/2,j)),a=i*2*Math.PI/rimSamples-Math.PI/2;
    const restY=slitHalfLength*Math.sin(a);
    // Rim samples bunch towards each end of the slit. Ease the first rows
    // outside it too: a sudden change of face area leaves a horizontal line
    // in area-weighted normals, especially under a glancing stage light.
    const u=j<0?-j/tailRows:j>rimSamples/2?(j-rimSamples/2)/headRows:0,ext=u*u*(2-u);
    const y=restY+(j<0?posterior-restY:anterior-restY)*ext;
    const t=(y-posterior)/(anterior-posterior),envelope=ext===1?0:Math.max(0,Math.sin(Math.PI*t))**.56;
    // The ends are different structures: a shallow transverse fourchette
    // behind, a fuller arch where the anterior branches meet under the hood.
    const hood=.63*gauss((y-1.54)/.46),fourchette=.26*gauss((y+1.19)/.31);
    const labial=Math.max(0,1-sq((y-.18)/1.65));
    const sweep=labial*(.071*Math.sin(3.8*y+side*.67)+.026*Math.sin(7*y-side));
    const sites=section.map(([width,height],k)=>{
      const inner=gauss((width-.39)/.30),medial=gauss(width/.67);
      // Inner folds run a shorter course and converge towards the arches;
      // outer pads instead broaden anteriorly and bed down into the skin.
      const w=envelope*(.83+.25*t+.125*gauss((y+.43-side*.16)/.91))*(1-.38*(1-labial)*medial);
      const x=side*(w*width+sweep*inner*Math.min(1,width/.20));
      const merge=1-(1-labial)*Math.min(1,1.32*medial);
      const rootBend=.14*gauss((y+.87)/.65)-.15*gauss((y-1.45)/.80);
      const z=((height+.041*Math.sin(4.8*y+side)*inner*labial)*merge+(hood+fourchette)*medial+rootBend*(1-medial))*envelope-.22*(1-envelope);
      // Confocal coordinates around the resting slit. An angular row is a
      // ray at the cut but bends around each end out in the tissue. Applying
      // one rim index to a whole horizontal row would crease both outer pads
      // at the superior/inferior tangencies of the measured ellipse.
      const A=slitHalfLength,cosh=width===0?Math.max(1,Math.abs(y)/A):(Math.hypot(x,y+A)+Math.hypot(x,y-A))/(2*A);
      const sin=width===0&&ext?Math.sign(y):Math.max(-1,Math.min(1,y/(A*cosh))),cos=side*Math.sqrt(Math.max(0,1-sin*sin));
      const weight=(1-.83*Math.min(1,width/1.83)**1.6)*(1-ext*ext)/(1+.55*(cosh-1));
      // The darker mucosa is local to the free lip, not a stripe all the
      // way across the anterior hood and the posterior skin bridge.
      const blend=(1-Math.exp(-(((y-.08)/1.22)**4)))*gauss(width/.92);
      const gloss=gauss((k-5.93)/.77)*(.025+.975*(.5+.5*Math.sin(4.45*y+side*.91))**3)*(1-blend);
      const contactShade=gauss((k-9.65)/1.83)*gauss((y-.06)/1.54);
      // Neither the calibrated rim nor the attachment margin follows the
      // surrounding fold's roll. The inner crest and outer pad move differently.
      const taper=(k===section.length-1?0:Math.sin(Math.PI*width/1.83))*(1-ext)**2;
      const roll=taper*inner*labial,pad=taper*gauss((width-1.18)/.42)*(.75+.25*labial);
      const scallop=roll*(Math.sin(3.6*y+.81*side)+.32*Math.sin(6.7*y-.94*side));
      return {x,y,z:width===0?(ext?(hood+fourchette)*envelope-.22*(1-envelope)*ext:0):z,cos,sin,side,weight,roll,pad,scallop,blend,gloss,contactShade};
    });rows.push({sites});
  }
  return {side,rows};
}
export const vulvaHalves=[makeHalf(-1),makeHalf(1)];

/** The plane intersection is an affine image of a unit circle, even for
 * oblique contact. Recover centre and both columns in measured world metres. */
export function readCut(rim:FormPoint[],radius:number,out:CutBasis){
  const a=rim[0],b=rim[rimSamples/2],c=rim[rimSamples/4];
  out.x=(a.x+b.x)*.5;out.y=(a.y+b.y)*.5;
  out.xx=a.x-out.x;out.xy=a.y-out.y;out.yx=c.x-out.x;out.yy=c.y-out.y-radius*slitHalfLength;
}
export function fitSite(site:Site,radius:number,cut:CutBasis,out:FormPoint,style:FoldStyle='natural'){
  const dx=cut.x+cut.xx*site.cos+cut.yx*site.sin,dy=cut.y+cut.xy*site.cos+cut.yy*site.sin;
  const load=Math.min(1.35,Math.max(0,(dx*site.side+.22*dy*site.sin)/radius));
  const roll=site.roll,pad=site.pad,ripple=site.scallop;
  const fold=style==='defined'?1.45:style==='soft'?.58:1,fullness=style==='soft'?1.42:style==='defined'?.70:1;
  out.x=radius*(site.x+site.side*(.14*fold*ripple+.19*(fullness-1)*pad+.14*load*roll))+site.weight*dx;
  out.y=radius*site.y+site.weight*dy;
  // Shallow contact raises the loaded lip; a fuller crossing rolls it outward
  // and compresses the cushion. A still pose stays still.
  out.z=radius*(site.z+.28*fold*ripple+.30*(fold-1)*roll+.34*(fullness-1)*pad+roll*load*(.54-.64*load)-pad*.21*load);
  return out;
}

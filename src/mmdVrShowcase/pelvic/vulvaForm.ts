/** Exterior in the socket's rigid axes, in units of calibrated radius.
 * Each half is a longitudinal sheet: medial vestibule, narrow folded free
 * edge, interlabial sulcus, broad lateral pad and its tucked skin margin.
 * The only free edges at the entrance are the two sides of the measured cut.
 * Neither this model nor its projection has access to the actor's mesh. */
export const rimSamples=40, slitHalfLength=.62, slitHalfWidth=.067;
export const restingCut:CutBasis={x:0,y:0,xx:0,xy:0,yx:0,yy:0};
const posterior=-2.04,anterior=2.97,tailRows=14;
// More longitudinal stations only where the hood turns back on itself and
// around the meatal groove. The lateral cushions need no extra primitives.
const anteriorY=[.627,.646,.679,.725,.78,.85,.93,1.01,1.09,1.15,1.20,1.245,1.285,1.325,1.365,1.41,1.47,1.54,1.61,1.68,1.74,1.80,1.86,1.92,1.97,2.01,2.045,2.075,2.105,2.135,2.165,2.20,2.245,2.30,2.37,2.45,2.54,2.65,2.76,2.86,2.93,anterior];
const headRows=anteriorY.length;
// Transverse section at the body of each fold. Pigment is fixed to the
// tissue; shape, rather than a painted line, produces the crests and groove.
const section=[
  [0,0,'#ba748d'],[.08,.034,'#e694aa'],[.16,.069,'#efadba'],
  [.223,.153,'#f3afbf'],[.274,.302,'#f4a5b9'],[.33,.438,'#ffadc1'],
  [.397,.502,'#ffb6c8'],[.472,.447,'#efa8bc'],[.543,.274,'#dc90a8'],
  [.617,.134,'#cb829e'],[.714,.086,'#dc95a8'],[.835,.225,'#f0adbb'],
  [1.005,.414,'#f8b6ba'],[1.225,.535,'#ffc6c0'],[1.45,.49,'#ffd1c6'],
  [1.635,.34,'#fac9bd'],[1.772,.14,'#f3bdba'],[1.83,-.08,'#e9b2b2'],
  [1.81,-.21,'#cf9597'],
] as const;
export const formColors=section.map(k=>k[2]);
export const junctionColor='#f7c3bf';
export type FormPoint={x:number;y:number;z:number};
export const foldStyles=['natural','soft','defined'] as const;
export type FoldStyle=typeof foldStyles[number];
export const foldNames={zh:{natural:'自然不对称',soft:'外侧覆盖',defined:'内缘突出'},en:{natural:'Asymmetric',soft:'Outer coverage',defined:'Prominent inner folds'}};
// Only the lower arcs beside the measured rim can retain a local change.
export type RimMode='off'|'elastic'|'remember';
export type RimState='off'|'elastic'|'left'|'right'|'center';
export function visibleRim(p?:{rimMode?:RimMode;rimMemory?:'left'|'right'|'center'}):RimState{
  return p?.rimMode==='remember'?p.rimMemory??'elastic':p?.rimMode==='elastic'?'elastic':'off';
}
export type Landmark='glans'|'hood'|'urethra';
type Site=FormPoint & {station:number;cos:number;sin:number;side:number;weight:number;roll:number;pad:number;scallop:number;blend:number;gloss:number;contactShade:number;lip:number;cushion:number;silhouette:number;margin:number;glans:number;hood:number;undercurl:number;meatus:number;well:number};
export type CutBasis={x:number;y:number;xx:number;xy:number;yx:number;yy:number};
type Row={sites:Site[]};
const sq=(x:number)=>x*x,gauss=(x:number)=>Math.exp(-x*x);
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// Sagittal section of the clitoral complex: [surface station, displayed
// superior coordinate, relief]. The fold travels down, around the glans,
// then up to its root. Cubic tangents continue through the turn; extruding
// a cone or stacking an ellipsoid leaves a point in lateral silhouette.
const sagittal=[
  [1.51,1.51,0],[1.61,1.61,.035],[1.70,1.70,.18],[1.78,1.78,.329],[1.84,1.84,.353],
  [1.92,1.92,.291],[1.976,1.976,.215],[2.015,1.991,.207],[2.05,1.968,.253],
  [2.085,1.928,.321],[2.118,1.904,.387],[2.145,1.909,.445],[2.18,1.958,.482],
  [2.225,2.037,.494],[2.30,2.169,.468],[2.39,2.318,.345],[2.50,2.476,.19],
  [2.64,2.64,.064],[2.78,2.78,0],
] as const;
function curl(v:number,axis:1|2){
  if(v<=sagittal[0][0]||v>=sagittal.at(-1)![0])return axis===1?v:0;
  const i=sagittal.findIndex(p=>p[0]>=v),a=sagittal[i-1],b=sagittal[i],l=sagittal[Math.max(0,i-2)],r=sagittal[Math.min(i+1,sagittal.length-1)];
  const d=b[0]-a[0],t=(v-a[0])/d,inv=1-t,s0=(b[axis]-l[axis])/(b[0]-l[0]),s1=(r[axis]-a[axis])/(r[0]-a[0]);
  return inv*inv*((1+2*t)*a[axis]+t*d*s0)+t*t*((3-2*t)*b[axis]-inv*d*s1);
}

function makeHalf(side:1|-1){
  const rows:Row[]=[];
  for(let j=-tailRows;j<=rimSamples/2+headRows;j++){
    const i=Math.max(0,Math.min(rimSamples/2,j)),a=i*2*Math.PI/rimSamples-Math.PI/2;
    const restY=slitHalfLength*Math.sin(a);
    // Rim samples bunch towards each end of the slit. Ease the first rows
    // outside it too: a sudden change of face area leaves a horizontal line
    // in area-weighted normals, especially under a glancing stage light.
    const u=j<0?-j/tailRows:j>rimSamples/2?(j-rimSamples/2)/headRows:0,ext=u*u*(2-u);
    const y=j>rimSamples/2?anteriorY[j-rimSamples/2-1]:restY+(j<0?posterior-restY:0)*ext;
    const t=(y-posterior)/(anterior-posterior),envelope=ext===1?0:Math.max(0,Math.sin(Math.PI*t))**.56;
    // The ends are different structures: a shallow transverse fourchette
    // behind, a fuller arch where the anterior branches meet under the hood.
    const fourchette=.26*gauss((y+1.19)/.31),bed=.135*gauss((y-2.04)/.73);
    const labial=Math.max(0,1-sq((y-.31)/1.95));
    const sweep=labial*(.071*Math.sin(3.8*y+side*.67)+.026*Math.sin(7*y-side));
    const sites=section.map(([width,height],k)=>{
      const inner=gauss((width-.39)/.30),medial=gauss(width/.67);
      // Inner folds run a shorter course and converge towards the arches;
      // outer pads instead broaden anteriorly and bed down into the skin.
      const w=envelope*(.83+.25*t+.125*gauss((y+.43-side*.16)/.91))*(1-.38*(1-labial)*medial);
      const x=side*(w*width+sweep*inner*Math.min(1,width/.20)),ax=Math.abs(x);
      const merge=1-(1-labial)*Math.min(1,1.32*medial);
      const rootBend=.14*gauss((y+.87)/.65)-.15*gauss((y-1.45)/.80);
      // Two tapering branches frame the anterior vestibule and continue
      // into the hood instead of terminating below an isolated papilla.
      const branch=.175*gauss((y-1.64)/.66)*gauss((ax-(.39-.15*smooth(1.2,2.33,y)))/.14);
      // A single sheet turns out to form the glans, in at the sulcus and
      // back over the superior pole to make the preputial free edge. The
      // lateral ends of this fold flow into the paired anterior branches.
      const front=smooth(.91,1.14,y)*(1-smooth(2.70,anterior,y));
      const v=y+.252*(1-gauss(x/.195))*smooth(1.53,1.93,y);
      const glans=front*gauss(x/.221)*gauss((y-1.82)/.149),hood=front*gauss(x/.35)*gauss((v-2.25)/.34);
      const ridge=gauss(x/(.207+.183*smooth(1.96,2.22,v)));
      const lift=curl(v,2)*ridge,rollOver=gauss((v-2.148)/.087)*ridge;
      const forward=(curl(v,1)-v)*ridge*.61;
      const meatus=front*gauss(x/.24)*gauss((y-1.32)/.214);
      const well=front*gauss((x-.009-.017*(y-1.32)/.10)/.063)*gauss((y-1.32)/.115);
      const relief=lift+.103*meatus-.127*well;
      const z=((height+.041*Math.sin(4.8*y+side)*inner*labial)*merge+(bed+fourchette)*medial+rootBend*(1-medial)+branch)*envelope-.22*(1-envelope)+relief;
      // Confocal coordinates around the resting slit. An angular row is a
      // ray at the cut but bends around each end out in the tissue. Applying
      // one rim index to a whole horizontal row would crease both outer pads
      // at the superior/inferior tangencies of the measured ellipse.
      const A=slitHalfLength,cosh=width===0?Math.max(1,Math.abs(y)/A):(Math.hypot(x,y+A)+Math.hypot(x,y-A))/(2*A);
      const sin=width===0&&ext?Math.sign(y):Math.max(-1,Math.min(1,y/(A*cosh))),cos=side*Math.sqrt(Math.max(0,1-sin*sin));
      // Stop the field before the urethral papilla. Its blind recess, the
      // anterior vestibule and the clitoral complex do not share the cut.
      const isolation=Math.max(0,Math.min(1,(1.09-y)/(1.09-slitHalfLength)));
      const weight=(1-.83*Math.min(1,width/1.83)**1.6)*(1-ext*ext)/(1+.55*(cosh-1))*isolation*isolation*(3-2*isolation);
      // The darker mucosa is local to the free lip, not a stripe all the
      // way across the anterior hood and the posterior skin bridge.
      const blend=(1-Math.exp(-(((y-.08)/1.22)**4)))*gauss(width/.92);
      const undercurl=ridge*gauss((v-2.084)/.065);
      const gloss=gauss((k-5.93)/.99)*(.09+.85*(.5+.5*Math.sin(3.18*y+side*.91))**2)*(1-blend)+.24*glans+.13*rollOver+
        .38*gauss((x+.069)/.063)*gauss((y-1.824)/.068)+.26*gauss((width-1.21)/.22)*gauss((y-.31+side*.21)/.89);
      const contactShade=gauss((k-9.65)/1.83)*gauss((y-.06)/1.54);
      // Neither the calibrated rim nor the attachment margin follows the
      // surrounding fold's roll. The inner crest and outer pad move differently.
      const taper=(k===section.length-1?0:Math.sin(Math.PI*width/1.83))*(1-ext)**2;
      const roll=taper*inner*labial,pad=taper*gauss((width-1.18)/.42)*(.75+.25*labial);
      const scallop=roll*(Math.sin(3.6*y+.81*side)+.32*Math.sin(6.7*y-.94*side));
      const lip=inner*labial*Math.min(1,width/.26)*(1-.91*smooth(1.26,1.97,y)),cushion=gauss((width-1.21)/.48)*envelope*Math.min(1,width/.58);
      const silhouette=Math.min(1,width/1.83)**2*envelope;
      // A crescent on the vestibular floor. The two short free arcs fade
      // before the anterior commissure; nothing spans the entry plane.
      const margin=(j>=0&&j<=rimSamples/2?gauss((sin+.48)/.66)*cos*cos:0)*gauss((width-.118)/.12)*Math.min(1,width/.08);
      const center=ext?(bed+fourchette)*envelope-.22*(1-envelope)*ext+relief:0;
      return {x:x+weight*slitHalfWidth*cos,y:y+forward,station:y,z:width===0?center:z,cos,sin,side,weight,roll,pad,scallop,blend,gloss,contactShade,lip,cushion,silhouette,margin,glans,hood,undercurl,meatus,well};
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
  out.xx=a.x-out.x-radius*slitHalfWidth;out.xy=a.y-out.y;out.yx=c.x-out.x;out.yy=c.y-out.y-radius*slitHalfLength;
}
export function fitSite(site:Site,radius:number,cut:CutBasis,out:FormPoint,style:FoldStyle='natural',rim:RimState='off'){
  const dx=cut.x+cut.xx*site.cos+cut.yx*site.sin,dy=cut.y+cut.xy*site.cos+cut.yy*site.sin;
  const load=Math.min(1.35,Math.max(0,(dx*site.side+.22*dy*site.sin)/radius))*Math.min(1,site.weight*2);
  const roll=site.roll,pad=site.pad,ripple=site.scallop;
  const {side,lip,cushion,silhouette}=site;
  // Covering folds are wide and turn medially; projecting folds have a
  // slender lateral pad and a longer, undulating free edge. In the third
  // cut the right minor fold is low and the left cushion sits posteriorly.
  const asym=style==='natural',covered=style==='soft';
  const fold=asym?1-side*.42:covered?.46:1.50,fullness=asym?1+side*.16:covered?1.46:.70;
  const outer=asym?side*.28*Math.sin(1.24*site.y+.7):covered?.25:-.21;
  const rimShape=rim==='off'?0:site.margin;
  const settled=rim==='center'?.66:rim===(side<0?'left':'right')?1:0;
  out.x=radius*(site.x+side*(outer*silhouette+(fold-1)*.18*lip-(fullness-1)*.54*cushion+.09*fold*ripple+.14*load*roll+.18*rimShape*settled))+site.weight*dx;
  out.y=radius*site.y+site.weight*dy;
  // Shallow contact raises the loaded lip; a fuller crossing rolls it outward
  // and compresses the cushion. A still pose stays still.
  out.z=radius*(site.z+.14*fold*ripple+.37*(fold-1)*lip+.53*(fullness-1)*cushion+roll*load*(.54-.64*load)-pad*.25*load+rimShape*(.254-.18*settled)/(1+.78*load));
  return out;
}

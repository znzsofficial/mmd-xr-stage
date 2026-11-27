import { BufferGeometry, Float32BufferAttribute } from 'three';
import { ball, PaintedParts } from '../play/modelParts';
import { centerZ, tipHeight } from '../play/siliconeProfile';
import { rodHeights, rodRadii } from './path';

// Elliptical sections share vertices around the seam. Local Y runs from the
// proximal end of a limb to its distal end; the figure faces local -Z.
type Ring = readonly [y:number, width:number, depth:number, z?:number];
function contour(rings:readonly Ring[], sides=24){
  const positions:number[]=[],indices:number[]=[];
  for(let row=0;row<rings.length;row++){
    const [y,width,depth,z=0]=rings[row];
    for(let i=0;i<sides;i++){
      const phi=2*Math.PI*i/sides;
      positions.push(width*Math.sin(phi),y,z+depth*Math.cos(phi));
      if(row){const a=(row-1)*sides+i,b=(row-1)*sides+(i+1)%sides;
        indices.push(a,b,a+sides,b,b+sides,a+sides);}
    }
  }
  for(const row of [0,rings.length-1]){
    const [y,,,z=0]=rings[row],center=positions.length/3;positions.push(0,y,z);
    for(let i=0;i<sides;i++){
      const a=row*sides+i,b=row*sides+(i+1)%sides;
      if(row)indices.push(center,a,b);else indices.push(center,b,a);
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function head(){
  const p=new PaintedParts();
  p.add(contour([[-.012,.012,.023,-.033],[0,.04,.05,-.027],[.025,.061,.068,-.014],
    [.073,.077,.087],[.117,.082,.092,.004],[.16,.078,.087,.009],[.19,.057,.066,.01],[.204,.027,.033,.01],[.207,.002,.003,.01]]));
  p.add(ball(0,.078,-.08,.015,.029,.017,12));
  for(const sign of [-1,1])p.add(ball(sign*.077,.078,.002,.012,.028,.016,12));
  return p.finish();
}

function hand(sign:number){
  const p=new PaintedParts();
  p.add(ball(0,-.002,-.038,.041,.018,.054));
  const lengths=[.045,.052,.048,.037];
  for(let i=0;i<4;i++){
    const x=sign*(i-1.5)*.017;
    p.add(ball(x,-.005,-.077-lengths[i]/2,.009,.009,lengths[i]/2+.008,12));
  }
  p.add(ball(0,0,0,.012,.012,.035,12).rotateY(sign*.56).translate(-sign*.038,-.003,-.044));
  return p.finish();
}

function contactSurface(){
  // Same sampled shaft, stop and bore as the solver. The proximal end blends
  // into the pubis, without the stand's shoe, thumb grip or rolled flange.
  const rings:Ring[]=rodHeights.map((y,i)=>[y,rodRadii[i]*.96,rodRadii[i],centerZ(y)]);
  rings.push([tipHeight,.0008,.0016,centerZ(tipHeight)],[tipHeight-.002,0,0,centerZ(tipHeight)]);
  return contour(rings,32);
}

export function partnerSurfaces(){
  const pelvis=new PaintedParts();
  pelvis.add(contour([[-.084,.049,.04],[-.065,.105,.072],[-.024,.146,.107,.003],[.034,.16,.116,.006],
    [.087,.15,.104],[.12,.127,.089],[.125,.04,.04]]));
  pelvis.add(ball(0,-.057,-.074,.036,.041,.039,16));
  return {
    pelvis:pelvis.finish(),
    torso:contour([[.054,.075,.052],[.077,.136,.094],[.13,.134,.095,-.004],
      [.19,.13,.091],[.245,.14,.098],[.31,.165,.116,-.006],[.378,.182,.122,-.009],
      [.416,.194,.106],[.441,.197,.083,.004],[.462,.176,.075,.007],[.482,.106,.061,.009],
      [.51,.054,.053,.009],[.557,.048,.05,-.002],[.562,.035,.033,-.002]]),
    head:head(), shaft:contactSurface(),
    upperArm:contour([[-.08,.014,.014],[0,.046,.045],[.18,.059,.055],[.49,.053,.055],[.72,.046,.048],[1,.032,.034],[1.04,.023,.025]],16),
    forearm:contour([[-.09,.014,.015],[0,.034,.035],[.22,.044,.047],[.54,.038,.04],[.85,.027,.025],[1,.023,.02]],16),
    thigh:contour([[-.11,.02,.02],[0,.075,.073],[.19,.09,.086],[.43,.081,.083],[.72,.065,.069],[.93,.051,.052],[1.05,.039,.041]],20),
    shin:contour([[-.10,.021,.022],[0,.049,.051],[.19,.055,.06],[.37,.059,.065],[.64,.042,.05],[.88,.032,.034],[1.04,.029,.031]],16),
    foot:contour([[-.052,.049,.097,-.043],[-.044,.052,.117,-.06],[-.022,.054,.116,-.064],
      [.003,.047,.091,-.05],[.023,.034,.053,-.017],[.031,.027,.035,-.005]],20),
    leftHand:hand(-1),rightHand:hand(1),
  };
}

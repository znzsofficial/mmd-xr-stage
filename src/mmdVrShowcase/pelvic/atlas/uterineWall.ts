import {functionalDepthAt,type EndometrialTissue} from '../../bodyState/data';
import {clamp,smooth,stride,type Mesh} from './model';

// Displacements and pigment features on the exposed corpus only. Each cut has
// its own coordinates but keeps the same material columns as it rotates. These
// buffers depend on the date, not the animation clock, viewer yaw or ledger.
const channels=4, resolution=128;
export const wallStride=channels;
type CutPair=readonly [Float32Array,Float32Array];
export function createWallStudy(){
  let owner:Mesh|undefined, cuts:CutPair|undefined, prev:EndometrialTissue|undefined;
  const remaining=new Float32Array(resolution+1);
  function sculpt(mesh:Mesh,vertices:Float32Array,out:Float32Array,t:EndometrialTissue){
    const {cols,rows}=mesh;
    for(let row=0;row<rows;row++){
      const first=row*cols,extent=Math.max(.03,Math.abs(vertices[first*stride]),Math.abs(vertices[(first+cols-1)*stride]));
      for(let col=0;col<cols;col++){
        const i=first+col,j=i*stride,k=i*channels,z=vertices[j+2];
        const margin=vertices[j+10],face=vertices[j+11]*smooth(.48,1.05,z);
        if(margin+face<.001)continue;
        const x=vertices[j],u=clamp(.5+.5*x/extent),s=u*resolution,n=Math.min(resolution-1,Math.floor(s));
        const h=remaining[n]+(remaining[n+1]-remaining[n])*(s-n);
        // The intact basal substrate remains part of the original mesh. Loss
        // recesses and roughens only the functional layer, in stable patches.
        const loss=Math.max(0,t.functionalDepth-h),frac=col/(cols-1);
        const pores=Math.sin(38*frac+z*1.7+Math.sin(z*3.2))*.5+.5;
        // Oblique profiles of glands in the cut and their mouths on the
        // mucosal face. Spacing is schematic and has no clinical units.
        const glandAxis=u*27+z*.35+t.glandCoil*1.38*Math.sin(5.4*z+2.5*u);
        const gland=(.5+.5*Math.cos(glandAxis))**8*(.3+.7*pores);
        const vesselAxis=u*21-z*.91+t.vesselCoil*1.64*Math.sin(6.1*z-1.2*u+.8);
        const vessel=(.5+.5*Math.cos(vesselAxis))**11;
        const irregular=loss*(.60+.40*Math.sin(z*8+frac*26));
        out[k]=margin*h; // thickness at the margin, never the motion of the entire uterus
        out[k+1]=face*(.17*h-.16*irregular-.036*gland*t.glandCoil)+margin*.13*h;
        out[k+2]=(margin+.58*face)*gland*h*(.32+.68*t.glandCoil);
        out[k+3]=(margin+.14*face)*vessel*h*(.22+.78*t.vesselCoil)+(margin+.88*face)*irregular;
      }
    }
  }
  return {forDate(mesh:Mesh,t:EndometrialTissue):CutPair{
    if(owner!==mesh||!cuts){owner=mesh;prev=undefined;const len=mesh.rows*mesh.cols*channels;cuts=[new Float32Array(len),new Float32Array(len)];}
    if(!prev||t.functionalDepth!==prev.functionalDepth||t.breakdown!==prev.breakdown||t.glandCoil!==prev.glandCoil||t.vesselCoil!==prev.vesselCoil){
      for(let i=0;i<=resolution;i++)remaining[i]=functionalDepthAt(t,i/resolution);
      sculpt(mesh,mesh.a,cuts[0],t);sculpt(mesh,mesh.b,cuts[1],t);prev={...t};
    }
    return cuts;
  },clear(){owner=cuts=prev=undefined;}};
}

import {vulvaHalves} from './vulvaForm';

const bell=(x:number)=>Math.exp(-x*x);

// All pigment, roughness and shallow normal variation are attached to tissue
// coordinates on the shared indexed sheet. A cut stretches them with the fold.
// The view-dependent part is a small anisotropic reflection, not a painted line.
function makeFinish(){
  return vulvaHalves.flatMap(({rows,side})=>rows.flatMap(row=>row.sites.map(({station:y,x,gloss},k)=>{
    const gathered=bell((k-7.45)/2.28)*(.80*bell((y+.26-.32*side)/.73)+.35*bell((y-1.16)/.39));
    const phase=11.2*y+1.25*Math.sin(3.3*y+.70*side)+.74*(k-6)*side;
    const by=gathered*(.17*Math.cos(phase)+.078*Math.cos(phase*.51+.36*k));
    const bx=gathered*(.073*Math.cos(phase)*side+.041*Math.sin(phase*.6));
    const inner=bell((k-4.6)/5.35)*bell((y-.16)/1.47),root=bell((k-9.45)/1.06)*bell((y-.14)/1.44)*(.77+.23*Math.sin(2.65*y+.55*side));
    const tone=1-.169*root-.1*bell((y-2.078)/.067)*bell(x/.245);
    const variation=.55*Math.sin(5.7*y+2.5*x+.48*Math.sin(2.7*x))+.27*Math.sin(3.8*y-5.4*x+.6)+.18*Math.sin(8.7*y+3.1*x-.4);
    const warm=inner*(.63+.28*variation);
    const arc=side<0?.89*bell((y-.38)/.65)+.36*bell((y+1.02)/.29):.55*bell((y-.77)/.41)+.42*bell((y+.56)/.36);
    return {bx,by,tone,r:2.2*variation+3.1*warm,g:-11*warm-1.55*variation,b:-16*warm-3*variation,
      broad:inner*(.028+.043*Math.min(1,gloss)),wet:.91*arc*bell((k-5.95)/2.15)*bell((y-.17)/1.55)};
  })));
}
let finish:ReturnType<typeof makeFinish>|undefined;
export const foldFinish=()=>finish??=makeFinish();

// The real stage uses the very same local reflection envelope, interpreted
// as dielectric roughness. No viewing vector, key light or angle in this field.
export const stageRoughness=(wet:number,broad:number)=>.86-.55*Math.min(1,wet/.74)**.8-.075*Math.min(1,broad/.06);

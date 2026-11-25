export const GRIP_RADIUS=.055;
export const trackedGrip=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&p.y>-50;

// update() may be called several times before a 72-Hz solver step. A loss or
// tracking jump during those updates still breaks continuity for that slot.
export function gripMotion(){
  const slots=Array.from({length:2},()=>({live:false,continuous:false,now:[0,0,0],solved:[0,0,0]}));
  function reset(){for(const h of slots){h.live=false;h.continuous=false;}}
  function observe(hands){for(let i=0;i<2;i++){const h=slots[i];
    const p=hands?.[i];if(!trackedGrip(p)){h.live=false;h.continuous=false;continue;}
    if(!h.live||(p.x-h.now[0])**2+(p.y-h.now[1])**2+(p.z-h.now[2])**2>.30**2)h.continuous=false;
    h.live=true;h.now[0]=p.x;h.now[1]=p.y;h.now[2]=p.z;
  }}
  // [last.xyz, sweep valid, current.xyz, physical radius], per hand.
  function write(out,step,steps,seed){for(let i=0;i<2;i++){const h=slots[i];
    const continuous=h.continuous&&!seed,valid=h.live&&(continuous||step>0),o=i*8;
    const start=continuous?h.solved:h.now,end=h.now;
    for(let j=0;j<3;j++){const d=end[j]-start[j];out[o+j]=start[j]+d*(step/steps);out[o+4+j]=start[j]+d*((step+1)/steps);}
    out[o+3]=+valid;out[o+7]=h.live?GRIP_RADIUS:0;
  }}
  function commit(){for(const h of slots){h.continuous=h.live;for(let j=0;j<3;j++)h.solved[j]=h.now[j];}}
  return {reset,observe,write,commit,get active(){return slots[0].live||slots[1].live;}};
}

import type {ConceptionEvent} from '../../bodyState/reproduction/game';

export type V=[number,number,number]; // Lens radii: right, down, towards the frontal observer.
const {sin,cos,PI}=Math;
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function ease(a:number,b:number,t:number){const k=Math.max(0,Math.min(1,(t-a)/(b-a)));return k*k*(3-2*k);}
const lerp=(a:V,b:V,u:number):V=>[mix(a[0],b[0],u),mix(a[1],b[1],u),mix(a[2],b[2],u)];
const scaled=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const norm=(a:V):V=>scaled(a,1/(Math.hypot(...a)||1));
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const SHELL=.54;
export function lensView(degrees:number){
  const a=(Number.isFinite(degrees)?degrees:38)*PI/180,c=cos(a),s=sin(a);
  return ([x,y,z]:V):V=>[x*c+z*s,y,z*c-x*s];
}

const plane=.67,B:V=[cos(plane),0,sin(plane)],N:V=[-sin(plane),0,cos(plane)];
function direction(angle:number,depth:number):V{const r=1/Math.sqrt(1+depth*depth),x=cos(angle);
  return [(x*B[0]+depth*N[0])*r,sin(angle)*r,(x*B[2]+depth*N[2])*r];}
export const site=(side:number)=>direction(-.34+side*.046,.078);
const finish:V=[.015,.018,.012],femaleStart:V=[-.135,.087,-.067];
function maleCentre(side:number,t:number){const join=ease(8.88,11.08,t),last=ease(10.83,11.87,t);
  const r=mix(.507,.235,ease(7.35,8.88,t)),p=lerp(scaled(site(side),r),[.098,.002,.099],join);return lerp(p,finish,last);}
export function nuclei(event:ConceptionEvent|undefined,t:number){
  const united=event?.success?ease(10.83,11.87,t):0,drawn=event?.success?ease(8.28,9.32,t):0;
  const motion=event?.success?ease(8.50,11.1,t):0;
  const maternal=lerp(lerp(femaleStart,[-.064,.041,-.061],motion),finish,united);
  return {maternal,paternal:event&&drawn?maleCentre(event.side,t):null,drawn,united};
}

export type Cut=ReturnType<typeof encounterCut>;
export function encounterCut(event:ConceptionEvent|undefined,t:number){
  const success=event?.success;
  const close=event?ease(0,2.4,t)*(1-ease(9.35,12,t)):0;
  const press=success?ease(6.20,6.96,t)*(1-ease(7.06,7.87,t)):0;
  const lift=success?ease(7.06,7.87,t)*(1-ease(7.87,9.27,t)):0;
  const warmth=success?ease(6.96,7.98,t)*(1-ease(8.87,11.45,t)):0;
  const title=!event?undefined:t<2.55?'approach':t<6.20?'ring':success?(t<8.54?'fusion':t<11.1?'nuclei':'zygote'):(t<9.72?'disperse':'miss');
  return {close,press,lift,warmth,title} as const;
}

// Fixed swimmers with independent arrival times, paths through fluid depth
// and tail frequencies. Changing view or rendering a second lens never spawns
// a new cast or resolves the event again. The egg is centred at the origin.
const cast=[
  [.32,.64,.10,1.02,.048],[1.38,-.47,.86,.85,-.31],[2.55,.48,.37,.95,.30],
  [3.68,-.55,1.35,.90,-.33],[4.74,.39,.68,.99,.19],[5.63,-.42,1.72,.86,-.12],
] as const;
function track(i:number,t:number,win:boolean,side:number):V{
  const [base,speed,lag,,shelf]=cast[i],approach=ease(lag,lag+2.71,t);
  const orbit=.20*Math.min(t,6.22)+.44*speed*sin(t*.93+i)+.085*sin(t*(.80+.09*i)+i),lock=win?ease(5.05,6.40,t):0;
  const escape=win?0:ease(6.44+lag*.43,10.56+lag*.55,t);
  const angle=mix(base-1.57+orbit,-.34+side*.046,lock)+escape*speed*1.84;
  const depth=mix(shelf+.125*sin(.73*t+i*1.2),.078,lock)+escape*.24*sin(i*2.65);
  let radius=mix(1.28+.076*lag,.785+.032*sin(i*2.36+t*.93),approach);
  if(win){radius=mix(radius,.679,ease(5.18,6.46,t));radius=mix(radius,.507,ease(6.75,7.55,t));
    radius=mix(radius,.235,ease(7.35,8.88,t));}
  if(win&&t>=8.88)return maleCentre(side,t);
  return scaled(direction(angle,depth),radius+escape*(.80+.13*lag));
}

export type Swimmer={index:number;head:V;axis:V;tail:V[];size:number;headInk:number;tailInk:number;entry:number};
export function encounterSwimmers(event:ConceptionEvent|undefined,t:number):Swimmer[]{
  if(!event||t>=12)return [];
  const result:Swimmer[]=[];
  for(let i=0;i<cast.length;i++){
    const [,speed,lag,size]=cast[i],win=event.success&&i===0,side=event.side,entry=win?ease(6.64,8.91,t):0;
    const retreat=win?0:ease(6.44+lag*.43,10.56+lag*.55,t);
    const headInk=win?1-ease(8.28,9.32,t):1-ease(.60,.99,retreat),tailInk=win?1-ease(9.28,10.18,t):headInk;
    if(!tailInk)continue;
    const head=track(i,t,win,side),next=track(i,t+.038,win,side),inward=scaled(norm(head),-1);
    const velocity=norm([next[0]-head[0],next[1]-head[1],next[2]-head[2]]);
    // Keep the heading on the inward half-plane during the encounter. On
    // release, each swimmer turns through its own arc rather than snapping
    // between +pi and -pi as the instantaneous velocity reverses.
    const tangent=norm(cross(N,inward)),along=velocity[0]*inward[0]+velocity[1]*inward[1]+velocity[2]*inward[2];
    const across=velocity[0]*tangent[0]+velocity[1]*tangent[1]+velocity[2]*tangent[2];
    const aim=(.28+.24*ease(2,4.3,t))*(1-retreat),lock=win?ease(5.05,6.40,t):0;
    const swim=Math.atan2(across,Math.max(.18,along))*(1-aim)*(1-lock);
    const phi=mix(swim,(speed>0?-1:1)*(PI-.29),ease(0,.42,retreat));
    const axis=norm([inward[0]*cos(phi)+tangent[0]*sin(phi),inward[1]*cos(phi)+tangent[1]*sin(phi),inward[2]*cos(phi)+tangent[2]*sin(phi)]);
    const bend=norm(cross(N,axis)),roll=norm(cross(axis,bend)),tail:V[]=[];
    const turn=mix(.55+1.45*ease(.06,.94,cos(phi)),.16,win?ease(6.22,8.15,t):0),hand=i%2?-1:1;
    const length=mix(.48,.16,win?ease(8.56,9.65,t):0),beat=t*(7.2+lag*1.3)+i*2.27+speed;
    for(let j=0;j<=20;j++){const u=j/20,b=turn*u;
      const wave=(.020+.074*u)*Math.min(1,u*4)*sin(u*8.3-beat)*(1-.66*entry);
      const back=(-.111-length*sin(b)/turn+hand*sin(b)*wave)*size;
      const arc=(hand*length*(1-cos(b))/turn+cos(b)*wave)*size,twist=.027*u*sin(beat*.54+u*5)*size;
      let p:V=[head[0]+back*axis[0]+arc*bend[0]+twist*roll[0],head[1]+back*axis[1]+arc*bend[1]+twist*roll[1],head[2]+back*axis[2]+arc*bend[2]+twist*roll[2]];
      if(!win||t<6.40){const d=Math.hypot(...p);if(d<.612)p=scaled(p,.612/d);}tail.push(p);
    }
    result.push({index:i,head,axis,tail,size,headInk,tailInk,entry});
  }
  return result;
}

// Fractured blocks left by failure of the lower bluff, outside the pool.
// Each vertical section is homothetic about its own tilted bedding axis.
// XR contact and the merged stone mesh use these same polygon vertices.
type Point=readonly [number,number];
type Bluff={x:number;z:number;rx:number;rz:number;cap:number;dipX:number;dipZ:number;plan:readonly Point[]};
export const breakwaters:readonly Bluff[]=[
  {x:3.43,z:-3.65,rx:2.42,rz:1.44,cap:.79,dipX:.095,dipZ:-.08,
    plan:[[-1,-.28],[-.62,-.76],[.35,-.96],[.88,-.51],[1,.34],[.43,.92],[-.48,.98],[-.91,.63]]},
  {x:5.12,z:-3.83,rx:1.76,rz:1.18,cap:1.57,dipX:.065,dipZ:-.14,
    plan:[[-.98,-.43],[-.51,-.95],[.51,-.85],[.94,-.31],[.86,.53],[.02,.98],[-.72,.81],[-1,.57]]},
  // The opposite bank carries a low, split bedding shelf. Its two broken
  // ends emerge from the floor beside the path, rather than tooth markers.
  {x:3.08,z:2.40,rx:1.16,rz:.47,cap:.31,dipX:.035,dipZ:.16,
    plan:[[-1,-.35],[-.52,-.91],[.39,-.94],[.92,-.43],[1,.37],[.30,.92],[-.67,.89],[-.94,.46]]},
  {x:4.74,z:2.39,rx:.84,rz:.48,cap:.39,dipX:.024,dipZ:.21,
    plan:[[-1,-.21],[-.48,-.79],[.67,-.91],[.95,-.45],[.90,.62],[.17,.97],[-.69,.83],[-.98,.45]]},
];
export const bluffBeds=[[-7,.69],[-.79,.86],[-.61,1],[-.44,.98],[-.38,.86],[-.26,.87],[-.18,.95],[-.07,.96],[0,.91]] as const;
const dip=(b:Bluff,x:number,z:number)=>(x-b.x)*b.dipX+(z-b.z)*b.dipZ;
export function bluffVertex(b:Bluff,i:number,bed:number,shrink=1){
  const [level,scale]=bluffBeds[bed],[px,pz]=b.plan[i%b.plan.length],x=b.x+px*b.rx*scale*shrink,z=b.z+pz*b.rz*scale*shrink;
  return [x,b.cap+dip(b,x,z)+level,z] as const;
}
export function breakwaterHit(x:number,y:number,z:number,head:number,r:number){
  for(const b of breakwaters){if(Math.abs(x-b.x)>b.rx+r||Math.abs(z-b.z)>b.rz+r)continue;
    const cap=b.cap+dip(b,x,z),tilt=r*(Math.abs(b.dipX)+Math.abs(b.dipZ)),low=y-cap-tilt,high=head-cap+tilt;
    if(low>0||high<bluffBeds[0][0])continue;
    let widest=0;
    for(let j=1;j<bluffBeds.length;j++){const [a,s]=bluffBeds[j-1],[e,v]=bluffBeds[j];
      const l=Math.max(a,low),h=Math.min(e,high);if(l>h)continue;
      widest=Math.max(widest,s+(v-s)*((v>s?h:l)-a)/(e-a));}
    let inside=true,nearest=Infinity;
    for(let i=0;i<b.plan.length;i++){
      const a=b.plan[i],d=b.plan[(i+1)%b.plan.length],ax=b.x+a[0]*b.rx*widest,az=b.z+a[1]*b.rz*widest;
      const dx=(d[0]-a[0])*b.rx*widest,dz=(d[1]-a[1])*b.rz*widest,px=x-ax,pz=z-az;
      if(dx*pz-dz*px<0)inside=false;
      const t=Math.max(0,Math.min(1,(px*dx+pz*dz)/(dx*dx+dz*dz)));
      nearest=Math.min(nearest,(px-dx*t)**2+(pz-dz*t)**2);
    }
    if(inside||nearest<=r*r)return true;
  }return false;
}

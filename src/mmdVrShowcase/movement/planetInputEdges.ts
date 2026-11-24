type Edges={snap:boolean;a:boolean;xDown:boolean;yDown:boolean;windSupportFrames:number};
export function interruptPlanetEdges(s:Edges){s.snap=false;s.a=s.xDown=s.yDown=true;s.windSupportFrames=0;}

/** A hidden → visible interval or a controller swap can contain no XRFrame. */
export function watchPlanetEdges(session:XRSession,s:Edges){
  const interrupt=()=>interruptPlanetEdges(s);
  const change=(e:XRInputSourcesChangeEvent)=>{
    for(const sources of [e.removed,e.added])for(const source of sources){
      if(source.hand||source.targetRayMode!=='tracked-pointer'||!source.gamepad)continue;
      if(source.handedness==='right'){s.snap=false;s.a=true;}
      if(source.handedness==='left'){s.xDown=s.yDown=true;s.windSupportFrames=0;}
    }
  };
  interrupt();
  session.addEventListener('visibilitychange',interrupt);session.addEventListener('end',interrupt);session.addEventListener('inputsourceschange',change);
  return ()=>{session.removeEventListener('visibilitychange',interrupt);session.removeEventListener('end',interrupt);session.removeEventListener('inputsourceschange',change);};
}

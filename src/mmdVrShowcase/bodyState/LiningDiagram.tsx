import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPanelTexture, roundRectPath } from '../../shared/panelTexture';
import type { EndometrialTissue } from './data';
import { drawBodySection } from './section';

export type LiningSample = { tissue: EndometrialTissue; caption: string; phase: string; change: string };
export type LiningPair = { samples: readonly [LiningSample, LiningSample] };

// Other actor settings may update while the date is frozen. Preserve both
// the saved image and the XR texture upload until an illustrated value changes.
function useIllustration({tissue:{functionalDepth,breakdown,glandCoil,vesselCoil},caption,phase,change}:LiningSample) {
  return useMemo(()=>({tissue:{functionalDepth,breakdown,glandCoil,vesselCoil},caption,phase,change}),
    [functionalDepth,breakdown,glandCoil,vesselCoil,caption,phase,change]);
}

function Section(sample: LiningSample) {
  const {tissue,caption,phase,change}=useIllustration(sample);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawBodySection(ctx,0,0,360,180,tissue);
  }, [tissue]);
  return <div><span>{caption}</span><strong>{phase}</strong><canvas ref={ref} width={360} height={180} role="img" aria-label={`${caption} · ${phase} · ${change}`} /><span>{change}</span></div>;
}

export function ScreenLiningDiagram({ samples: [a,b] }: LiningPair) {
  return <figure className="body-lining"><div className="body-lining-pair"><Section {...a}/><Section {...b}/></div></figure>;
}

function paintSample(ctx:CanvasRenderingContext2D, x:number, sample:LiningSample, ink:string) {
  ctx.fillStyle = '#e5c8cf'; ctx.font = '500 23px system-ui, sans-serif'; ctx.fillText(sample.caption,x,23,352);
  ctx.fillStyle = ink; ctx.font = '650 32px system-ui, sans-serif'; ctx.fillText(sample.phase,x,61,352);
  drawBodySection(ctx,x,86,352,108,sample.tissue);
  ctx.fillStyle = '#fff0e8'; ctx.font = '550 27px system-ui, sans-serif'; ctx.fillText(sample.change,x,224,352);
}

export function HudLiningDiagram({ samples: [a,b] }: LiningPair) {
  const [texture] = useState(()=>createPanelTexture(768,252,()=>{},'en'));
  const left=useIllustration(a), right=useIllustration(b);
  useLayoutEffect(()=>{
    const ctx=(texture.image as HTMLCanvasElement).getContext('2d'); if(!ctx)return;
    roundRectPath(ctx,0,0,768,252,12); ctx.fillStyle='#392331'; ctx.fill();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    paintSample(ctx,20,left,'#f4e5de');
    paintSample(ctx,396,right,'#f9cd9b');
    ctx.fillStyle='#795464'; ctx.fillRect(384,17,1,220);
    texture.needsUpdate=true;
  },[texture,left,right]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh name="body:lining-sections" renderOrder={30} raycast={() => null}>
    <planeGeometry args={[1.45,1.45*252/768]}/><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/>
  </mesh>;
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPanelTexture, roundRectPath } from '../../shared/panelTexture';
import { drawBodySection } from './section';

export type LiningSample = { lining: number; shedding: number; caption: string; phase: string };
export type LiningPair = { samples: readonly [LiningSample, LiningSample]; legend: string };

function Section({ lining, shedding, caption, phase }: LiningSample) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawBodySection(ctx,0,0,360,180,{ lining, shedding });
  }, [lining,shedding]);
  return <div><strong>{caption}</strong><canvas ref={ref} width={360} height={180} role="img" aria-label={`${caption} · ${phase}`} /><span>{phase}</span></div>;
}

export function ScreenLiningDiagram({ samples: [a,b], legend }: LiningPair) {
  return <figure className="body-lining"><div className="body-lining-pair"><Section {...a}/><Section {...b}/></div><figcaption>{legend}</figcaption></figure>;
}

function paintSample(ctx:CanvasRenderingContext2D, x:number, sample:LiningSample, ink:string) {
  ctx.fillStyle = ink; ctx.font = '600 27px system-ui, sans-serif'; ctx.fillText(sample.caption,x,25,352);
  drawBodySection(ctx,x,48,352,122,sample);
  ctx.fillStyle = '#f9eeea'; ctx.font = '500 25px system-ui, sans-serif'; ctx.fillText(sample.phase,x,191,352);
}

export function HudLiningDiagram({ samples: [a,b], legend }: LiningPair) {
  const [texture] = useState(()=>createPanelTexture(768,252,()=>{},'en'));
  const {lining:t0,shedding:s0,caption:c0,phase:p0}=a, {lining:t1,shedding:s1,caption:c1,phase:p1}=b;
  useLayoutEffect(()=>{
    const ctx=(texture.image as HTMLCanvasElement).getContext('2d'); if(!ctx)return;
    roundRectPath(ctx,0,0,768,252,12); ctx.fillStyle='#38272f'; ctx.fill();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    paintSample(ctx,20,{lining:t0,shedding:s0,caption:c0,phase:p0},'#f4e5de');
    paintSample(ctx,396,{lining:t1,shedding:s1,caption:c1,phase:p1},'#f3cc9d');
    ctx.fillStyle='#755a60'; ctx.fillRect(384,18,1,181); ctx.fillRect(20,211,728,1);
    ctx.font='450 24px system-ui, sans-serif'; ctx.fillStyle='#ead6d3'; ctx.fillText(legend,20,230,728);
    texture.needsUpdate=true;
  },[texture,t0,s0,c0,p0,t1,s1,c1,p1,legend]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh name="body:lining-sections" renderOrder={30} raycast={() => null}>
    <planeGeometry args={[1.45,1.45*252/768]}/><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/>
  </mesh>;
}

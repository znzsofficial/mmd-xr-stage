import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPanelTexture } from '../../shared/panelTexture';
import { HUD_COLORS } from '../hudAppearance';
import { drawBodySection } from './section';

export type LiningSample = { lining: number; shedding: number; caption: string; phase: string };
export type LiningPair = { samples: readonly [LiningSample, LiningSample]; legend: string };

function Section({ lining, shedding, caption, phase }: LiningSample) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawBodySection(ctx,0,0,300,150,{ lining, shedding });
  }, [lining,shedding]);
  return <div><strong>{caption}</strong><canvas ref={ref} width={300} height={150} role="img" aria-label={`${caption} · ${phase}`} /><span>{phase}</span></div>;
}

export function ScreenLiningDiagram({ samples: [a,b], legend }: LiningPair) {
  return <figure className="body-lining"><div className="body-lining-pair"><Section {...a}/><Section {...b}/></div><figcaption>{legend}</figcaption></figure>;
}

export function HudLiningDiagram({ samples: [a,b], legend }: LiningPair) {
  // Repaint only when a sample changes at a visible scale, not for other actor settings.
  const t0 = Math.round(a.lining*200), t1 = Math.round(b.lining*200), s0 = Math.round(a.shedding*100), s1 = Math.round(b.shedding*100);
  const texture = useMemo(() => createPanelTexture(768, 246, ({ ctx }) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [i,[t,s,caption,phase]] of ([[t0,s0,a.caption,a.phase],[t1,s1,b.caption,b.phase]] as const).entries()) {
      const x = 192+i*384;
      ctx.fillStyle = HUD_COLORS.ink; ctx.font = '600 29px system-ui, sans-serif'; ctx.fillText(caption,x,16,350);
      drawBodySection(ctx,x-153,38,306,135,{ lining: t/200, shedding: s/100 });
      ctx.font = '550 26px system-ui, sans-serif'; ctx.fillText(phase,x,193,350);
    }
    ctx.fillStyle = HUD_COLORS.muted; ctx.font = '500 28px system-ui, sans-serif'; ctx.fillText(legend,384,230,748);
  }, 'en'), [t0,t1,s0,s1,a.caption,b.caption,a.phase,b.phase,legend]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh name="body:lining-sections" renderOrder={30} raycast={() => null}>
    <planeGeometry args={[1.45,1.45*246/768]}/><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/>
  </mesh>;
}

import { useLanguageStore } from '../../languageStore';
import { HudSlider, ValueLabel } from '../hud/HudValues';
import { HudButton, HudLine } from '../hud/PorcelainControls';
import { useStageMusic } from './stageMusic';

export function MusicSettings({ onDrag }: { onDrag: (active: boolean) => void }) {
  const t = useLanguageStore(s => s.t);
  const { name, transport, error, volume, setVolume, toggle } = useStageMusic();
  if (!name) return null;
  const active = transport !== 'paused';
  return <group name="settings:music">
    <HudLine position={[0,.48,0]} width={1.85} role="title" text={name}/>
    <HudButton position={[-.48,.20,0]} size={[.88,.18]} active={active} disabled={error === 'musicFormatError'}
      label={t(active ? 'musicPause' : 'musicPlay')} onPress={() => void toggle()}/>
    <ValueLabel position={[-.55,-.10,0]} size={[.72,.14]} label={t('musicVolume')} value={`${Math.round(volume * 100)}%`}/>
    <group name="music:volume"><HudSlider position={[.45,-.10,0]} width={.82} value={volume} onChange={setVolume} onInteractionChange={onDrag}/></group>
    {error && <HudLine position={[0,-.38,0]} width={1.85} role="warning" text={t(error)}/>}
  </group>;
}

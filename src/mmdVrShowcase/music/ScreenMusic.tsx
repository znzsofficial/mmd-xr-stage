import { useLanguageStore } from '../../languageStore';
import { PrepIcon } from '../prep/PrepIcon';
import { useStageMusic } from './stageMusic';

export function ScreenMusic() {
  const t = useLanguageStore(s => s.t);
  const { name, transport, error, volume, setVolume, toggle } = useStageMusic();
  if (!name) return null;
  const active = transport !== 'paused';
  return <section className="screen-music" aria-label={t('musicTitle')}>
    <button type="button" disabled={error === 'musicFormatError'} onClick={() => void toggle()}>
      <PrepIcon name={active ? 'pause' : 'play'} size={16}/>{t(active ? 'musicPause' : 'musicPlay')}
    </button>
    <span className="screen-music-name" title={name}>{name}</span>
    <label>{t('musicVolume')}<input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={e => setVolume(e.target.valueAsNumber / 100)}/></label>
    {error && <span role="status" className="screen-music-error">{t(error)}</span>}
  </section>;
}

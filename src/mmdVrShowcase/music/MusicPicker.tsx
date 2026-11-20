import { useRef } from 'react';
import { useLanguageStore } from '../../languageStore';
import { PrepIcon } from '../prep/PrepIcon';
import { useStageMusic } from './stageMusic';

export function MusicPicker({ disabled }: { disabled: boolean }) {
  const t = useLanguageStore(s => s.t);
  const name = useStageMusic(s => s.name), error = useStageMusic(s => s.error);
  const select = useStageMusic(s => s.select);
  const input = useRef<HTMLInputElement>(null);
  return <section className="stage-section stage-music-picker" aria-labelledby="music-heading">
    <div className="stage-library-heading"><PrepIcon name="music"/><h2 id="music-heading">{t('musicOptional')}</h2></div>
    {name && <p className="stage-music-name" title={name}>{name}</p>}
    <div className="stage-drop-actions">
      <button type="button" className="stage-btn stage-btn-secondary" disabled={disabled} onClick={() => input.current?.click()}>{t(name ? 'musicReplace' : 'musicChoose')}</button>
      {name && <button type="button" className="stage-btn stage-btn-ghost" disabled={disabled} onClick={() => select(null)}>{t('musicClear')}</button>}
    </div>
    {error && <p role="status" className="stage-music-error">{t(error)}</p>}
    <input ref={input} type="file" hidden accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.webm" aria-label={t('musicChoose')} disabled={disabled}
      onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) select(file); }}/>
  </section>;
}

import { create } from 'zustand';

type MusicState = {
  name: string | null;
  transport: 'paused' | 'starting' | 'playing';
  error: 'musicFormatError' | 'musicPlayError' | null;
  volume: number;
  select: (file: File | null) => void;
  toggle: () => Promise<void>;
  stop: () => void;
  setVolume: (value: number) => void;
};

// One local source per page. Room restores and animation transport never touch it.
export const useStageMusic = create<MusicState>((set, get) => {
  let media: HTMLAudioElement | null = null;
  let url: string | null = null;
  let command = 0;

  function release() {
    ++command;
    if (media) {
      media.onerror = media.onended = media.onpause = null;
      media.pause();
      media.removeAttribute('src');
      media.load(); // Detach the decoder as well as the object URL.
      media = null;
    }
    if (url) URL.revokeObjectURL(url);
    url = null;
  }

  return {
    name: null, transport: 'paused', error: null, volume: 0.6,
    select(file) {
      release();
      set({ name: file?.name ?? null, transport: 'paused', error: null });
      if (!file) return;
      try {
        const audio = media = new Audio();
        url = URL.createObjectURL(file);
        audio.preload = 'metadata';
        audio.volume = get().volume;
        audio.onerror = () => {
          if (media !== audio || !audio.error) return;
          ++command;
          set({ transport: 'paused', error: audio.error.code >= 3 ? 'musicFormatError' : 'musicPlayError' });
        };
        audio.onpause = audio.onended = () => {
          if (media !== audio || !audio.paused || get().transport === 'paused') return;
          ++command;
          set({ transport: 'paused' });
        };
        audio.src = url;
      } catch {
        release();
        set({ error: 'musicFormatError' });
      }
    },
    async toggle() {
      const audio = media;
      if (!audio || get().error === 'musicFormatError') return;
      const token = ++command;
      if (get().transport !== 'paused') {
        audio.pause();
        set({ transport: 'paused' });
        return;
      }
      set({ transport: 'starting', error: null });
      try {
        if (audio.error) audio.load();
        await audio.play(); // Called directly in the button gesture, including XR select.
        if (token === command) set({ transport: audio.paused ? 'paused' : 'playing' });
      } catch (error) {
        if (token === command) set({ transport: 'paused', error:
          error instanceof DOMException && error.name === 'NotSupportedError' ? 'musicFormatError' : 'musicPlayError' });
      }
    },
    stop() {
      if (!media) return;
      ++command;
      media.pause();
      media.currentTime = 0;
      set({ transport: 'paused' });
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      const volume = Math.min(1, Math.max(0, value));
      if (media) media.volume = volume;
      set({ volume });
    },
  };
});

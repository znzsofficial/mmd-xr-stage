import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStageMusic } from './stageMusic';

const actions = useStageMusic.getState();
const state = () => useStageMusic.getState();
const elements: TestAudio[] = [];
class TestAudio {
  src = ''; volume = 1; currentTime = 0; paused = true;
  error: { code: number } | null = null;
  onerror: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onended: (() => void) | null = null;
  constructor() { elements.push(this); }
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn(() => { this.error = null; });
  removeAttribute(_name: string) { this.src = ''; }
}
const file = (name = 'song.wav') => new File(['fixture'], name, { type: 'audio/wav' });

beforeEach(() => {
  vi.stubGlobal('Audio', TestAudio);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${elements.length}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  actions.select(null); actions.setVolume(.6); elements.length = 0;
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('page music', () => {
  it('does no media work without a track; selection is silent, pause resumes, exit rewinds', async () => {
    await actions.toggle(); actions.stop();
    expect(elements).toHaveLength(0);
    actions.select(file());
    const audio = elements[0];
    expect(audio.play).not.toHaveBeenCalled();
    await actions.toggle(); audio.currentTime = 7;
    await actions.toggle(); expect(audio.currentTime).toBe(7);
    expect(audio.paused).toBe(true);
    await actions.toggle(); actions.setVolume(.27);
    expect(audio.volume).toBe(.27);
    actions.stop();
    expect([audio.currentTime, audio.paused, state().name]).toEqual([0, true, 'song.wav']);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('detaches replaced and cleared decoders/URLs; stale events and plays cannot change the new track', async () => {
    actions.select(file()); const first = elements[0], lateError = first.onerror!;
    let reject!: (e: Error) => void;
    first.play.mockImplementationOnce(() => new Promise<void>((_, r) => { reject = r; }));
    const pending = actions.toggle();
    // A different local file can have exactly the same name.
    actions.select(file()); const next = elements[1];
    await actions.toggle();
    first.error = { code: 4 }; lateError(); reject(new DOMException('stale', 'NotSupportedError')); await pending;
    expect(state()).toMatchObject({ transport: 'playing', name: 'song.wav', error: null });
    expect([first.src, first.paused, first.onended, first.onerror, first.onpause]).toEqual(['', true, null, null, null]);
    expect(first.load).toHaveBeenCalledOnce();
    actions.select(null); actions.select(null);
    expect(next.paused).toBe(true); expect(next.src).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(state()).toMatchObject({ transport: 'paused', name: null, error: null });
  });

  it('cancels a pending start on pause and exit without letting a late play completion restart the UI', async () => {
    actions.select(file()); const audio = elements[0];
    for (const cancel of [actions.toggle, actions.stop]) {
      let resolve!: () => void;
      audio.play.mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
      const pending = actions.toggle(); expect(state().transport).toBe('starting');
      await cancel(); resolve(); await pending;
      expect(state()).toMatchObject({ transport: 'paused', error: null });
    }
  });

  it('allows gesture retries, recovers from an unreadable track by replacing it, and handles native end', async () => {
    actions.select(file()); const audio = elements[0];
    audio.play.mockRejectedValueOnce(new DOMException('gesture needed', 'NotAllowedError'));
    await actions.toggle(); expect(state().error).toBe('musicPlayError');
    await actions.toggle(); expect(state()).toMatchObject({ transport: 'playing', error: null });
    audio.error = { code: 3 }; audio.onerror!();
    await actions.toggle(); expect(audio.play).toHaveBeenCalledTimes(2);
    expect(state()).toMatchObject({ transport: 'paused', error: 'musicFormatError' });
    actions.select(file('next.wav')); await actions.toggle();
    const next = elements[1]; next.paused = true; next.onended!();
    expect(state()).toMatchObject({ transport: 'paused', name: 'next.wav', error: null });
  });
});

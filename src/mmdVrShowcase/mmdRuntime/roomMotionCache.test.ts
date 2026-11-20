import { expect, it, vi } from 'vitest';
import type { ThreeMmdAnimation } from '@yohawing/three-mmd-loader';
import { createRoomMotionCache } from './roomMotionCache';

const MiB = 1024 * 1024;
const file = (size = 1) => new File([new Uint8Array(size)], 'same.vmd');
const parsed = (f: File) => ({ animation: { metadata: { counts: { bones: Math.floor(f.size / 111), morphs: 0 } }, boneTracks: {}, morphTracks: {} } } as ThreeMmdAnimation);
const parse = async (f: File) => parsed(f);
type Cache = ReturnType<typeof createRoomMotionCache>;
async function bind(cache: Cache, f: File, slot: 'body' | 'face' = 'body') {
  const ticket = cache.acquire(f, slot);
  const clip = await ticket.promise;
  ticket.bound(clip);
  return ticket.status;
}

it('shares only the same small File, including pending reads; evicts by byte volume and recency', async () => {
  const cache = createRoomMotionCache(parse), files = Array.from({ length: 5 }, () => file());
  const first = cache.acquire(files[0], 'body'), pending = cache.acquire(files[0], 'face');
  expect([first.status, pending.status]).toEqual(['miss', 'pending']);
  expect(first.promise).toBe(pending.promise);
  for (const f of files.slice(1, 4)) expect(await bind(cache, f)).toBe('miss');
  expect(await bind(cache, files[0])).toBe('hit');
  await bind(cache, files[4]);
  expect(await bind(cache, files[1])).toBe('miss');
  await bind(cache, file(4 * MiB));
  expect(await bind(cache, files[4])).toBe('miss');
});

it('retains only the last successful large body plus the small LRU, never just a parse or a face bind', async () => {
  const cache = createRoomMotionCache(parse), a = file(4 * MiB + 1), b = file(32 * MiB), face = file();
  expect(await bind(cache, a, 'face')).toBe('oversize');
  expect(await bind(cache, a)).toBe('miss');
  expect(await bind(cache, face, 'face')).toBe('miss');
  await cache.acquire(b, 'body').promise; // parsed but not bound
  expect(await bind(cache, a)).toBe('hit');
  expect(await bind(cache, b)).toBe('miss');
  expect(await bind(cache, face, 'face')).toBe('hit');
  expect(await bind(cache, a)).toBe('miss');
  const oversize = new File([b, 'x'], 'huge.vmd');
  expect(await bind(cache, oversize)).toBe('oversize');
  expect(await bind(cache, oversize)).toBe('oversize');
  expect(await bind(cache, a)).toBe('miss');
  await bind(cache, face);
  expect(await bind(cache, a)).toBe('miss');
});

it('does not keep a large body file dominated by unpacked sections', async () => {
  const cache = createRoomMotionCache(async () => parsed(file(1))), camera = file(5 * MiB);
  expect(await bind(cache, camera)).toBe('miss');
  expect(await bind(cache, camera)).toBe('miss');
});

it.each(['release', 'clear'] as const)('%s invalidates already acquired large tickets, without reviving them on a later success', async end => {
  const cache = createRoomMotionCache(parse), f = file(5 * MiB);
  await bind(cache, f);
  const late = cache.acquire(f, 'body');
  cache[end](f);
  await cache.acquire(f, 'body').promise; // fresh generation of the same File
  late.bound(await late.promise);
  expect(await bind(cache, f)).toBe('miss');
  expect(await bind(cache, f)).toBe('hit');
});

it('retries parse failures; an obsolete rejection cannot erase a fresh entry', async () => {
  let reject!: (e: Error) => void;
  const f = file(), fn = vi.fn(parse).mockImplementationOnce(() => new Promise((_, r) => { reject = r; })).mockRejectedValueOnce(new Error('invalid'));
  const cache = createRoomMotionCache(fn), old = cache.acquire(f, 'body');
  cache.release(f);
  await expect(bind(cache, f)).rejects.toThrow('invalid');
  expect(await bind(cache, f)).toBe('miss');
  reject(Error('obsolete'));
  await expect(old.promise).rejects.toThrow('obsolete');
  expect(await bind(cache, f)).toBe('hit');
});

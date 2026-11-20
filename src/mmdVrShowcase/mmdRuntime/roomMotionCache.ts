import { ThreeMmdLoader, type ThreeMmdAnimation } from '@yohawing/three-mmd-loader';
import type { RestoreMotionWork } from '../roomRestoreTiming';
import type { MmdMotionSlot } from './mmdRuntime';

// Limits are on source bytes, not JS heap. Keep the ordinary LRU small;
// there is exactly one extra slot, shared by ALL models and rooms in this view.
const SMALL_BUDGET = 4 * 1024 * 1024;
const LAST_BODY_LIMIT = 32 * 1024 * 1024;
type Clip = { promise: Promise<ThreeMmdAnimation>; ready: boolean };

function mostlyPackedBody(file: File, clip: ThreeMmdAnimation) {
  // In 0.8.6 bone/morph records (111/23 bytes on disk) become packed
  // typed arrays (97/8 bytes). Other sections and track names are JS objects;
  // don't grant camera-/IK-heavy files the enlarged allowance.
  const a = clip.animation;
  const { bones, morphs } = a.metadata.counts;
  return file.size - bones * 111 - morphs * 23 <= 512 * 1024
    && Object.keys(a.boneTracks).length + Object.keys(a.morphTracks).length <= 4096;
}

export function createRoomMotionCache(parse = (file: File) => new ThreeMmdLoader().loadAnimation(file)) {
  const small = new Map<File, Clip>();
  let bytes = 0;
  let lastBody: { file: File; promise: Promise<ThreeMmdAnimation> } | undefined;
  let identities = new WeakMap<File, object>();

  function dropSmall(file: File) {
    if (small.delete(file)) bytes -= file.size;
  }

  return {
    acquire(file: File, slot: MmdMotionSlot) {
      let status: NonNullable<RestoreMotionWork['cache']>;
      let promise: Promise<ThreeMmdAnimation>;
      const hit = small.get(file);
      if (hit) {
        status = hit.ready ? 'hit' : 'pending';
        small.delete(file);
        small.set(file, hit);
        promise = hit.promise;
      } else if (lastBody?.file === file) {
        status = 'hit';
        promise = lastBody.promise;
      } else if (file.size <= SMALL_BUDGET) {
        status = 'miss';
        while (small.size >= 4 || bytes + file.size > SMALL_BUDGET) dropSmall(small.keys().next().value!);
        const clip = { promise: parse(file), ready: false };
        promise = clip.promise = clip.promise.then(animation => {
          clip.ready = true;
          return animation;
        }, error => {
          if (small.get(file) === clip) dropSmall(file);
          throw error;
        });
        small.set(file, clip);
        bytes += file.size;
      } else {
        status = slot === 'body' && file.size <= LAST_BODY_LIMIT ? 'miss' : 'oversize';
        // The caller owns this candidate during parsing. Don't evict the
        // last good binding (or keep a failed/cancelled candidate) on read.
        promise = parse(file);
      }

      const identity = identities.get(file) ?? {};
      identities.set(file, identity);
      return { status, promise, bound(animation: ThreeMmdAnimation) {
        if (slot !== 'body' || identities.get(file) !== identity) return;
        lastBody = file.size > SMALL_BUDGET && file.size <= LAST_BODY_LIMIT && mostlyPackedBody(file, animation)
          ? { file, promise } : undefined;
      } };
    },
    release(file: File) {
      identities.delete(file);
      if (lastBody?.file === file) lastBody = undefined;
      dropSmall(file);
    },
    clear() {
      identities = new WeakMap();
      lastBody = undefined;
      small.clear();
      bytes = 0;
    },
  };
}
export type RoomMotionCache = ReturnType<typeof createRoomMotionCache>;

import { useBackpack } from '../backpack/store';
import { usePelvic } from './store';

/** An explicit choice on the existing asset profile, never a runtime model ID
 * or a guess based on Japanese/English shape names. */
export function getApertureMorph(assetId: string): string | null {
  return usePelvic.getState().byAsset[assetId]?.apertureMorph ?? null;
}

export function useApertureMorph(assetId: string): string | null {
  return usePelvic(s => s.byAsset[assetId]?.apertureMorph ?? null);
}

export function setApertureMorph(assetId: string, name: string | null): boolean {
  const bag = useBackpack.getState(), live = bag.live[assetId];
  const { byAsset } = usePelvic.getState(), profile = byAsset[assetId];
  if (!profile || bag.selected !== assetId || !live?.visible || bag.busy || bag.draft) return false;
  if (name !== null && !live.propMorphs?.includes(name)) return false;
  if ((profile.apertureMorph ?? null) !== name) {
    usePelvic.setState({ byAsset: { ...byAsset, [assetId]: { ...profile, apertureMorph: name } } });
  }
  return true;
}

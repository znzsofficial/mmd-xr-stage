import { create } from 'zustand';

export type KiteWind = 'left' | 'right';
export const useKiteStore = create<{ active: boolean; wind: KiteWind }>(() => ({ active: false, wind: 'right' }));
export const getKiteWind = (): KiteWind => useKiteStore.getState().wind;
/** Equip and wind selection both launch. A wrist transfer keeps the existing breeze. */
export const setKiteWind = (wind: KiteWind) => useKiteStore.setState({ active: true, wind });
export const resetKite = () => useKiteStore.setState({ active: false, wind: 'right' });

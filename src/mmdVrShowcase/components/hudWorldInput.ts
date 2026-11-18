import { create } from "zustand";

/** The public panel and its recovery screens have priority over world tools. */
export const useHudWorldInput = create(() => ({ blocked: false }));

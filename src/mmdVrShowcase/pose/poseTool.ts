import { create } from 'zustand';

/** The axis shown on the rotation dial is a tool choice, not part of a saved pose. */
export type PoseAxis = 'x' | 'y' | 'z';
export const POSE_AXES = ['x', 'y', 'z'] as const;
export const POSE_ANGLE_STEP = Math.PI / 36;
export const POSE_BEND_STEP = Math.PI / 18;
export const usePoseTool = create(() => ({ axis: 'y' as PoseAxis }));

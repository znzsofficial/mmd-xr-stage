import type { ComponentType, Ref } from 'react';
import type { Vector3 } from 'three';

/** Reused world-space scratch. Effects that retain an origin must copy it. */
export type GripFrame = { at:Vector3; dir:Vector3; usable:boolean; action:'off'|'start'|'held'; dt:number };
export type FrameEffectProps = { ref:Ref<(frame:GripFrame)=>void> };
export type PropView = {
  Piece:ComponentType;
  HeldEffect?:ComponentType<FrameEffectProps>;
  Station?:ComponentType;
};

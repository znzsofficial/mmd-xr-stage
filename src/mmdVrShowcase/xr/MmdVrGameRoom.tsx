import { useState, type RefObject } from 'react';
import type { Group } from 'three';
import { BackpackPlacement } from '../backpack/BackpackPlacement';
import { BackpackWorldTools } from '../backpack/BackpackWorldTools';
import { StagePlay } from '../play/HeldPlay';
import type { RoomActorBackend } from '../stage/createRoomRuntime';
import { MmdVrStageContent } from '../stage/MmdVrStage';
import { MmdVrPlayerRig } from './MmdVrPlayerRig';
import { ControllerContactHaptics, createControllerContactHaptics } from './contact/controllerContactHaptics';

/** The mounted game. Session binding, the first tracked draw and teardown belong to its renderer. */
export function MmdVrGameRoom({onExit,busy,backend,originRef}: {
  onExit: () => void; busy: boolean; backend?: RoomActorBackend; originRef?: RefObject<Group|null>;
}) {
  const [haptics] = useState(createControllerContactHaptics);
  return <ControllerContactHaptics.Provider value={haptics}>
    <MmdVrPlayerRig onExit={onExit} busy={busy} originRef={originRef}/>
    <MmdVrStageContent backend={backend}/>
    <BackpackPlacement/>
    <BackpackWorldTools styles={backend?.styles}/>
    <StagePlay/>
  </ControllerContactHaptics.Provider>;
}

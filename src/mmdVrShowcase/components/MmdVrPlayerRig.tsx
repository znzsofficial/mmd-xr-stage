import { useFrame } from "@react-three/fiber";
import { useXRControllerLocomotion, useXRInputSourceState, XROrigin } from "@react-three/xr";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { Vector3 } from 'three';
import {nearCampusDoor} from '../scenery/CampusLayout';
import {RoomGate} from '../scenery/connections';
import {canWalkInClinic,moveInClinic} from '../scenery/clinic/clinicLayout';
import {hintLawnPrints,walkBetweenZones} from '../scenery/campusTransit';
import {
  MMD_VR_HEIGHT_OFFSET_MAX,
  MMD_VR_HEIGHT_OFFSET_MIN,
} from "../mmdVrAdjustments";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore } from "../mmdVrStore";
import { MmdVrControlBar } from "./MmdVrHud";
import { MmdVrControllerColliders } from "./MmdVrControllerColliders";
import { MmdVrHandColliders } from "./MmdVrHandColliders";

/**
 * Smooth walk + snap turn. viewEpoch zeros origin (reset view).
 */
export function MmdVrPlayerRig({onExit,busy}:{onExit:()=>void;busy:boolean}) {
  const originRef = useRef<THREE.Group>(null);
  const viewEpoch = useMmdVrStore((s) => s.viewEpoch);
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const speed = getMmdVrRenderProfile(mmdPrefs).walkSpeed;
  const heightOffset = mmdPrefs.heightOffset;
  const [activePanelInteractions, setActivePanelInteractions] = useState(0);
  const [snapTurnReady, setSnapTurnReady] = useState(true);
  const panelDragging = activePanelInteractions > 0;
  const setPanelDragging = useCallback((active: boolean) => {
    if (active) setSnapTurnReady(false);
    setActivePanelInteractions((count) => Math.max(0, count + (active ? 1 : -1)));
  }, []);
  const rightController = useXRInputSourceState("controller", "right");
  const stickHeightRef = useRef({ value: heightOffset, elapsed: 0, active: false });
  const [eye]=useState(()=>new Vector3());
  const [gate]=useState(()=>new RoomGate());
  const clinicOrigin=useRef<{x:number;z:number}|null>(null);
  const releaseHints=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>{releaseHints.current?.();releaseHints.current=null;},[mmdPrefs.scenery]);

  useXRControllerLocomotion(
    originRef,
    { speed: panelDragging ? 0 : speed },
    panelDragging || !snapTurnReady
      ? false
      : { type: "snap", degrees: mmdPrefs.snapTurnDegrees, deadZone: 0.65 },
  );

  useEffect(() => {
    const g = originRef.current;
    if (!g) return;
    const clinic=useMmdVrStore.getState().prefs.scenery==='clinic';
    g.position.set(0, heightOffset, clinic?2.8:0);
    g.rotation.set(0, 0, 0);
    clinicOrigin.current=clinic?{x:g.position.x,z:g.position.z}:null;gate.reset();
  }, [viewEpoch]);

  useEffect(() => {
    const g = originRef.current;
    if (g && !stickHeightRef.current.active) g.position.y = heightOffset;
  }, [heightOffset]);

  useEffect(() => () => {
    if (!stickHeightRef.current.active) return;
    useMmdVrStore.getState().setPrefs({ heightOffset: stickHeightRef.current.value });
  }, []);

  useFrame(({gl}, delta) => {
    const room=mmdPrefs.scenery,origin=originRef.current;
    if(origin&&gl.xr.isPresenting&&!panelDragging&&(room==='clinic'||gate.hasExits(room))){
      gl.xr.getCamera().getWorldPosition(eye);
      if(room==='clinic'){
        // Constrain thumbstick translation only. A real step or head turn must
        // never itself move the XR origin or snap the user back to an entrance.
        const prev=clinicOrigin.current;
        if(prev){const dx=origin.position.x-prev.x,dz=origin.position.z-prev.z;
          if((dx||dz)&&canWalkInClinic(eye.x-dx,eye.z-dz)){
            const target=moveInClinic(eye.x-dx,eye.z-dz,dx,dz);
            origin.position.x+=target.x-eye.x;origin.position.z+=target.z-eye.z;origin.updateMatrixWorld(true);
          }
          prev.x=origin.position.x;prev.z=origin.position.z;
        }else clinicOrigin.current={x:origin.position.x,z:origin.position.z};
      }
      if(room==='classroom'&&!releaseHints.current&&nearCampusDoor(eye.x,eye.z))releaseHints.current=hintLawnPrints();
      const link=gate.next(room,eye.x,eye.z);
      if(link&&walkBetweenZones(link)){
        origin.position.x+=link.offset[0];origin.position.z+=link.offset[1];origin.updateMatrixWorld(true);
      }
    }else gate.reset();
    const stick = rightController?.gamepad["xr-standard-thumbstick"];
    if (!panelDragging && !snapTurnReady && Math.abs(stick?.xAxis ?? 0) < 0.65) {
      setSnapTurnReady(true);
    }
    const axis = stick?.yAxis ?? 0;
    if (panelDragging || Math.abs(axis) < 0.18) {
      if (stickHeightRef.current.active) {
        stickHeightRef.current.active = false;
        useMmdVrStore.getState().setPrefs({ heightOffset: stickHeightRef.current.value });
      } else {
        stickHeightRef.current.value = useMmdVrStore.getState().prefs.heightOffset;
      }
      stickHeightRef.current.elapsed = 0;
      return;
    }
    stickHeightRef.current.active = true;
    const shaped = (Math.abs(axis) - 0.18) / 0.82 * Math.sign(axis);
    const speed = 0.5 + Math.abs(shaped) * 4.5;
    stickHeightRef.current.value = Math.min(
      MMD_VR_HEIGHT_OFFSET_MAX,
      Math.max(MMD_VR_HEIGHT_OFFSET_MIN, stickHeightRef.current.value - shaped * delta * speed),
    );
    if (originRef.current) originRef.current.position.y = stickHeightRef.current.value;
    stickHeightRef.current.elapsed += delta;
    if (stickHeightRef.current.elapsed < 0.1) return;
    stickHeightRef.current.elapsed = 0;
    useMmdVrStore.getState().setHeightOffsetTransient(stickHeightRef.current.value);
  });

  return (
    <XROrigin ref={originRef}>
      <MmdVrControllerColliders />
      <MmdVrHandColliders />
      <MmdVrControlBar
        onDragChange={setPanelDragging}
        onExit={onExit}
        busy={busy}
      />
    </XROrigin>
  );
}

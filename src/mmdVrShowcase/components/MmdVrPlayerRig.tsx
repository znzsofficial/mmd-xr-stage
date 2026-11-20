import { useFrame } from "@react-three/fiber";
import { useXRControllerLocomotion, useXRInputSourceState, XROrigin } from "@react-three/xr";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { Vector3 } from 'three';
import {nearCampusDoor} from '../scenery/CampusLayout';
import {RoomGate} from '../scenery/connections';
import {walkSurfaces} from '../scenery/walkSurfaces';
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
  const walkingOrigin=useRef<{x:number;z:number}|null>(null);
  const lastFoot=useRef({x:0,z:0});
  const floorHeight=useRef(0);
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
    const room=useMmdVrStore.getState().prefs.scenery;
    floorHeight.current=0;
    const surface=walkSurfaces[room],entry=surface?.entry??{x:0,z:0};
    lastFoot.current={...entry};
    g.position.set(entry.x,heightOffset,entry.z);
    g.rotation.set(0, 0, 0);
    walkingOrigin.current=surface?{...entry}:null;gate.reset();
  }, [viewEpoch]);

  useEffect(() => {
    const g = originRef.current;
    if (g && !stickHeightRef.current.active) g.position.y = floorHeight.current+heightOffset;
  }, [heightOffset]);

  useEffect(() => () => {
    if (!stickHeightRef.current.active) return;
    useMmdVrStore.getState().setPrefs({ heightOffset: stickHeightRef.current.value });
  }, []);

  useFrame(({gl}, delta) => {
    const room=mmdPrefs.scenery,origin=originRef.current;
    const surface=walkSurfaces[room];
    if(origin&&gl.xr.isPresenting&&!panelDragging&&(surface||gate.hasExits(room))){
      gl.xr.getCamera().getWorldPosition(eye);
      if(surface){
        // Constrain thumbstick translation only. A real step or head turn must
        // never itself move the XR origin or snap the user back to an entrance.
        const prev=walkingOrigin.current;
        if(prev){const dx=origin.position.x-prev.x,dz=origin.position.z-prev.z;
          const startX=eye.x-dx,startZ=eye.z-dz;
          if((dx||dz)&&surface.clear(startX,startZ)&&(!surface.height||Math.abs(surface.height(startX,startZ)-floorHeight.current)<.23)){
            const target=surface.move(startX,startZ,dx,dz);
            origin.position.x+=target.x-eye.x;origin.position.z+=target.z-eye.z;origin.updateMatrixWorld(true);
            eye.x=target.x;eye.z=target.z;
            if(surface.height)floorHeight.current=surface.height(target.x,target.z);
          }else if((dx||dz)&&surface.height){
            // Leaning over a rail does not turn a head pose into a new floor.
            // While off support, allow stick travel only back toward safe feet.
            const f=lastFoot.current;
            if(Math.hypot(eye.x-f.x,eye.z-f.z)>=Math.hypot(startX-f.x,startZ-f.z)){
              origin.position.x-=dx;origin.position.z-=dz;origin.updateMatrixWorld(true);eye.x=startX;eye.z=startZ;
            }
          }
          prev.x=origin.position.x;prev.z=origin.position.z;
        }else walkingOrigin.current={x:origin.position.x,z:origin.position.z};
        if(surface.height&&surface.clear(eye.x,eye.z)){
          // Floor travel is local to this rig, never persisted as the user's
          // manual height preference. Keep their tracked head pose untouched.
          const h=surface.height(eye.x,eye.z);
          if(Math.abs(h-floorHeight.current)<.23){floorHeight.current=h;lastFoot.current.x=eye.x;lastFoot.current.z=eye.z;
            const y=h+(stickHeightRef.current.active?stickHeightRef.current.value:heightOffset);if(origin.position.y!==y){origin.position.y=y;origin.updateMatrixWorld(true);}}
        }
      }
      if(room==='classroom'&&!releaseHints.current&&nearCampusDoor(eye.x,eye.z))releaseHints.current=hintLawnPrints();
      const link=gate.next(room,eye.x,eye.z);
      if(link&&walkBetweenZones(link)){
        origin.position.x+=link.offset[0];origin.position.z+=link.offset[1];origin.updateMatrixWorld(true);
        // This coordinate change is not a thumbstick stride inside the clinic.
        walkingOrigin.current={x:origin.position.x,z:origin.position.z};
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
    if (originRef.current) originRef.current.position.y = floorHeight.current+stickHeightRef.current.value;
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

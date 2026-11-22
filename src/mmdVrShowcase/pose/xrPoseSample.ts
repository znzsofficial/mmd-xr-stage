import { Matrix4, type Object3D, Ray, Vector3 } from 'three';

/** Read the same physical spaces at acquisition, on frames, and on release.
 * Pointer intersection events are for picking; their captured surface moves
 * with the bone and their last ray can be a frame older than selectstart. */
export function xrPoseSampler() {
  const matrix = new Matrix4(), ray = new Ray(), grip = new Vector3(), value = {ray,grip,emulated:false};
  return (source: XRInputSource, session: XRSession | null, frame: XRFrame | undefined, ref: XRReferenceSpace | null, origin: Object3D | null) => {
    if (!frame || !ref || !session || frame.session !== session || session.visibilityState !== 'visible') return null;
    try {
      let present=false; for (const input of session.inputSources) if (input===source) { present=true; break; }
      if (!present) return null;
      const aim = frame.getPose(source.targetRaySpace,ref), hand = source.gripSpace ? frame.getPose(source.gripSpace,ref) : aim;
      if (!aim || !hand) return null;
      value.emulated=aim.emulatedPosition || hand.emulatedPosition;
      origin?.updateWorldMatrix(true,false);
      matrix.fromArray(aim.transform.matrix); if (origin) matrix.premultiply(origin.matrixWorld);
      ray.origin.setFromMatrixPosition(matrix); ray.direction.set(0,0,-1).transformDirection(matrix);
      const p=hand.transform.position; grip.set(p.x,p.y,p.z); if (origin) grip.applyMatrix4(origin.matrixWorld);
      return value;
    } catch { return null; } // reference space or event frame was retired
  };
}

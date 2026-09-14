import type { MmdAnimation } from "@yohawing/three-mmd-loader";

export function getMmdAnimationDurationSeconds(animation: MmdAnimation) {
  let maxFrame = 0;
  for (const track of Object.values(animation.boneTracks)) {
    if (track.frames.length) maxFrame = Math.max(maxFrame, track.frames[track.frames.length - 1] ?? 0);
  }
  for (const track of Object.values(animation.morphTracks)) {
    if (track.frames.length) maxFrame = Math.max(maxFrame, track.frames[track.frames.length - 1] ?? 0);
  }
  for (const frame of animation.cameraFrames) maxFrame = Math.max(maxFrame, frame.frame);
  for (const frame of animation.lightFrames) maxFrame = Math.max(maxFrame, frame.frame);
  return Math.max(1 / 30, maxFrame / 30);
}

/**
 * Merge motion layers.
 * - bones: body > face > camera
 * - morphs: face > body > camera
 * - camera frames: dedicated camera > body > face
 * - lights / self-shadow / property: body > face > camera
 */
export function mergeMotionAnimations(
  body: MmdAnimation | null,
  face: MmdAnimation | null,
  camera: MmdAnimation | null = null,
): MmdAnimation | null {
  const layers = [body, face, camera].filter(Boolean) as MmdAnimation[];
  if (!layers.length) return null;
  if (layers.length === 1) return layers[0]!;

  const boneTracks = {
    ...(camera?.boneTracks ?? {}),
    ...(face?.boneTracks ?? {}),
    ...(body?.boneTracks ?? {}),
  };
  const morphTracks = {
    ...(camera?.morphTracks ?? {}),
    ...(body?.morphTracks ?? {}),
    ...(face?.morphTracks ?? {}),
  };
  const cameraFrames =
    (camera?.cameraFrames.length ? camera.cameraFrames : null)
    ?? (body?.cameraFrames.length ? body.cameraFrames : null)
    ?? (face?.cameraFrames.length ? face.cameraFrames : null)
    ?? [];
  const lightFrames =
    (body?.lightFrames.length ? body.lightFrames : null)
    ?? (face?.lightFrames.length ? face.lightFrames : null)
    ?? (camera?.lightFrames.length ? camera.lightFrames : null)
    ?? [];
  const selfShadowFrames =
    (body?.selfShadowFrames.length ? body.selfShadowFrames : null)
    ?? (face?.selfShadowFrames.length ? face.selfShadowFrames : null)
    ?? (camera?.selfShadowFrames.length ? camera.selfShadowFrames : null)
    ?? [];
  const propertyFrames =
    (body?.propertyFrames.length ? body.propertyFrames : null)
    ?? (face?.propertyFrames.length ? face.propertyFrames : null)
    ?? (camera?.propertyFrames.length ? camera.propertyFrames : null)
    ?? [];
  const maxFrame = Math.max(
    body?.metadata.maxFrame ?? 0,
    face?.metadata.maxFrame ?? 0,
    camera?.metadata.maxFrame ?? 0,
    0,
  );
  const primary = body ?? face ?? camera!;
  const heaviest = layers.reduce((a, b) => (a.bytes.byteLength >= b.bytes.byteLength ? a : b));

  return {
    kind: "vmd",
    bytes: heaviest.bytes,
    metadata: {
      modelName: primary.metadata.modelName || layers.map((l) => l.metadata.modelName).find(Boolean) || "",
      counts: {
        bones: Object.keys(boneTracks).length,
        morphs: Object.keys(morphTracks).length,
        cameras: cameraFrames.length,
        lights: lightFrames.length,
        selfShadows: selfShadowFrames.length,
        properties: propertyFrames.length,
      },
      maxFrame,
    },
    boneTracks,
    morphTracks,
    cameraFrames,
    lightFrames,
    selfShadowFrames,
    propertyFrames,
  };
}

/** @deprecated use mergeMotionAnimations */
export function mergeBodyFaceAnimations(body: MmdAnimation, face: MmdAnimation): MmdAnimation {
  return mergeMotionAnimations(body, face, null)!;
}

export function buildTextureMap(files: File[]) {
  const map: Record<string, Blob> = {};
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const normalized = relative.replaceAll("\\", "/");
    map[normalized] = file;
    map[file.name] = file;
    const base = normalized.split("/").pop();
    if (base) map[base] = file;
  }
  return map;
}

export function isModelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".pmx") || name.endsWith(".pmd");
}

export function isMotionFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".vmd") || name.endsWith(".vpd");
}

export function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name);
}

export function classifyMotionSlot(file: File): "body" | "face" | "camera" {
  const name = file.name.toLowerCase();
  if (/(camera|cam|镜头|鏡頭|カメラ|cameratrack|camera_?motion)/i.test(name)) return "camera";
  if (/(face|facial|表情|顔|morph|mouth|eye)/i.test(name)) return "face";
  return "body";
}

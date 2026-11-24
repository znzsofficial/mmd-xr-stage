export type MmdVrTransformRequest = {
  scale?: number;
  rotationY?: number;
  reset?: boolean;
};

export function transformRequiresPhysicsReseed(request: MmdVrTransformRequest): boolean {
  return request.reset === true || request.rotationY != null;
}

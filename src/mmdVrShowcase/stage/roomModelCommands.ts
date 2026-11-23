import type { MmdRuntimeHandle } from "../mmdRuntime/mmdRuntime";
import { transformRequiresPhysicsReseed } from "../mmdVrPhysicsReseed";
import type { useMmdVrStore } from "../mmdVrStore";
import { setObjectHeadingDegrees } from "../objectHeading";
import type { createStageActors } from "../stageActors";

type CommandQueues = Pick<ReturnType<typeof useMmdVrStore.getState>,
  "takeModelRemovals" | "takeVisibilityToggles" | "takeModelTransformRequests">;
type MountedActors = Pick<ReturnType<typeof createStageActors>, "objects" | "putAway">;
type ModelRuntime = Pick<MmdRuntimeHandle, "listModels" | "setModelVisible" | "setModelTransform">;

/** The current room drains one queue at a time: publish its changes before taking the next queue. */
export function consumeRoomModelCommands(
  queues: CommandQueues, actors: MountedActors, runtime: ModelRuntime,
  publishRemovals: () => void, publishEdits: () => void,
): boolean {
  const removals = queues.takeModelRemovals();
  if (removals.length) {
    for (const id of removals) actors.putAway(id);
    publishRemovals();
  }

  const toggles = queues.takeVisibilityToggles();
  if (toggles.length) {
    for (const id of toggles) {
      const object = actors.objects.get(id);
      if (object) {
        object.group.visible = !object.group.visible;
      } else {
        const model = runtime.listModels().find(model => model.id === id);
        if (model) runtime.setModelVisible(id, !model.visible);
      }
    }
    publishEdits();
  }

  const transforms = queues.takeModelTransformRequests();
  if (!transforms.length) return false;
  const models = runtime.listModels();
  let physicsReseedNeeded = false;
  for (const request of transforms) {
    const object = actors.objects.get(request.id);
    if (object) {
      if (request.reset) {
        object.group.position.set(...object.defaultPosition);
        object.group.scale.setScalar(1);
        object.group.rotation.y = 0;
      }
      if (request.scale != null) object.group.scale.setScalar(request.scale);
      if (request.rotationY != null) setObjectHeadingDegrees(object.group, request.rotationY);
      continue;
    }

    if (request.reset) {
      const index = models.findIndex(model => model.id === request.id);
      runtime.setModelTransform(request.id, {
        positionX: index >= 0 ? (index - (models.length - 1) / 2) * 1.1 : 0,
        positionY: 0, positionZ: 0,
        rotationX: 0, rotationY: request.rotationY ?? 0, rotationZ: 0,
        scale: request.scale ?? 1,
      });
    } else {
      runtime.setModelTransform(request.id, {
        ...(request.scale == null ? {} : { scale: request.scale }),
        ...(request.rotationY == null ? {} : { rotationY: request.rotationY }),
      });
    }
    physicsReseedNeeded ||= transformRequiresPhysicsReseed(request);
  }
  publishEdits();
  return physicsReseedNeeded;
}

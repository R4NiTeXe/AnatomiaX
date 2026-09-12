import {
  computeCameraPosition,
  computeFocusDistance,
  type FocusVec3,
} from '@anatomiax/anatomy-core';

/**
 * Camera framing for selection focus (8.19.35). Pure math over the shared
 * anatomy-core implementation — the stage supplies plain vectors, three
 * objects never enter here.
 */
export interface FramingInput {
  center: FocusVec3;
  radius: number;
  fovDegrees: number;
  cameraPosition: FocusVec3;
  controlsTarget: FocusVec3;
  padding?: number;
}

export interface Framing {
  distance: number;
  position: FocusVec3;
}

export function frameSelection(input: FramingInput): Framing {
  const distance = computeFocusDistance(input.radius, input.fovDegrees, input.padding);
  const position = computeCameraPosition(
    input.center,
    input.cameraPosition,
    input.controlsTarget,
    distance
  );
  return { distance, position };
}

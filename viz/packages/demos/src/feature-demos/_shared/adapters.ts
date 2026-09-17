// The WebGL surface of the feature demos: the render package's adapter interfaces implemented over
// the alpha viewer-core renderer and three. Nothing else under `feature-demos` imports three.
//
// Debt, recorded in FEATURE-DEMOS-PLAN.md: Track V's `createViewer` (chunk 3) will carry its own
// adapters; when it lands, `host.ts` switches to it and this file goes.

import type { CaptureTarget, ClippingTarget, EnvironmentTarget, GroupLocation, ModelRaycastHit, Ray } from '@bim-open-toolkit/render';
import type { Color, Vec3 } from '@bim-open-toolkit/model';
import type { InstancedGroup, SceneObject, Viewer } from '@ara3d/viewer-core';
import {
  BufferGeometry,
  Color as ThreeColor,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Light,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Plane,
  Raycaster,
  Vector3,
  type Material,
} from 'three';

// A linear colour as the 0xRRGGBB integer viewer-core takes for a background.
export const packedColor = (color: Color): number =>
  (Math.round(Math.min(Math.max(color[0], 0), 1) * 255) << 16) |
  (Math.round(Math.min(Math.max(color[1], 0), 1) * 255) << 8) |
  Math.round(Math.min(Math.max(color[2], 0), 1) * 255);

// Hits from the three mirror, told which model each group belongs to; what `SceneBinding.pick` takes.
export const raycastSource = (
  objects: SceneObject,
  groups: () => ReadonlyMap<InstancedGroup, GroupLocation>,
): ((ray: Ray) => readonly ModelRaycastHit[]) => {
  const caster = new Raycaster();
  return (ray) => {
    caster.set(
      new Vector3(ray.origin[0], ray.origin[1], ray.origin[2]),
      new Vector3(ray.direction[0], ray.direction[1], ray.direction[2]),
    );
    const where = groups();
    const found: ModelRaycastHit[] = [];
    for (const hit of objects.raycast(caster)) {
      const at = where.get(hit.group);
      if (at === undefined) continue;
      found.push({
        modelId: at.modelId,
        group: at.group,
        slot: hit.instanceIndex,
        point: [hit.point.x, hit.point.y, hit.point.z],
        distance: hit.distance,
      });
    }
    return found;
  };
};

// Puts clipping planes on every material of the mirror. viewer-core has no renderer-wide plane
// list, so each material is set in turn and local clipping is switched on while any plane is held.
export const clippingTarget = (viewer: Viewer): ClippingTarget => ({
  setPlanes: (planes) => {
    const held = planes.map(
      (plane) => new Plane(new Vector3(plane.normal[0], plane.normal[1], plane.normal[2]), plane.constant),
    );
    const put = (material: Material): void => {
      material.clippingPlanes = held.length === 0 ? null : held;
      material.needsUpdate = true;
    };
    viewer.objects.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (Array.isArray(node.material)) for (const one of node.material) put(one);
      else put(node.material);
    });
    viewer.setLocalClipping(held.length > 0);
  },
});

// Draws the background, the light rig, and the grid and axis lines the render package generates.
// viewer-core's own lights are for a y-up scene, so setting an environment replaces them.
export const environmentTarget = (viewer: Viewer, up: Vec3): EnvironmentTarget => {
  let drawn: Group | undefined;
  const clear = (): void => {
    if (drawn === undefined) return;
    viewer.objects.scene.remove(drawn);
    for (const node of drawn.children) {
      if (!(node instanceof LineSegments)) continue;
      node.geometry.dispose();
      if (!Array.isArray(node.material)) node.material.dispose();
    }
    drawn = undefined;
  };
  return {
    setEnvironment: (drawing) => {
      clear();
      if (drawing === undefined) return;
      viewer.setBackground(packedColor(drawing.background));
      for (const node of [...viewer.objects.scene.children]) {
        if (node instanceof Light) viewer.objects.scene.remove(node);
      }
      const held = new Group();
      const sky = new HemisphereLight(0xffffff, 0x8d949c, drawing.rig.ambientIntensity);
      sky.position.set(up[0], up[1], up[2]);
      const warmth = Math.min(Math.max(drawing.rig.warmth, 0), 1);
      const sun = new DirectionalLight(
        new ThreeColor().setRGB(1, 1 - warmth * 0.12, 1 - warmth * 0.25),
        drawing.rig.sunIntensity,
      );
      const direction = drawing.rig.sunDirection;
      sun.position.set(direction[0], direction[1], direction[2]);
      held.add(sky, sun);
      const positions: number[] = [];
      const colors: number[] = [];
      for (const line of [...drawing.grid, ...drawing.axes]) {
        positions.push(line.from[0], line.from[1], line.from[2], line.to[0], line.to[1], line.to[2]);
        colors.push(line.color[0], line.color[1], line.color[2], line.color[0], line.color[1], line.color[2]);
      }
      if (positions.length > 0) {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
        held.add(new LineSegments(geometry, new LineBasicMaterial({ vertexColors: true })));
      }
      drawn = held;
      viewer.objects.scene.add(held);
    },
  };
};

// The drawing buffer, for `captureImage`. Sizes are device pixels, so the ratio is one.
export const captureTarget = (viewer: Viewer, canvas: HTMLCanvasElement): CaptureTarget => ({
  size: () => ({ width: canvas.width, height: canvas.height }),
  resize: (width, height) => {
    viewer.resize(width, height, 1);
  },
  renderFrame: () => {
    viewer.renderFrame();
  },
  encode: (format) =>
    new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob === null) {
          reject(new Error('The canvas produced no image'));
          return;
        }
        blob
          .arrayBuffer()
          .then((bytes) => {
            resolve(new Uint8Array(bytes));
          })
          .catch((cause: unknown) => {
            reject(cause instanceof Error ? cause : new Error(String(cause)));
          });
      }, format);
    }),
});

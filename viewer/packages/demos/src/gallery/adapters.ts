// The whole WebGL surface of the gallery: the render package's adapter interfaces implemented over
// the alpha viewer-core renderer and three. Nothing else under `src/gallery` imports three.
//
// This is the slice's `src/slice/adapters.ts` with three changes: the light rig is applied through
// one named helper so a demo can re-apply it without knowing about lights, the environment target
// puts its rig in the same group as its grid so clearing is one removal, and the capture target
// keeps the pixel ratio it was created with rather than dropping to one on restore.

import {
  noGpuTimer,
  type CaptureTarget,
  type ClippingTarget,
  type EnvironmentTarget,
  type GpuFrameTimer,
  type GroupLocation,
  type LightRig,
  type ModelRaycastHit,
  type Ray,
} from '@bim-open-toolkit/render';
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
  type Object3D,
} from 'three';

// A linear colour as the 0xRRGGBB integer viewer-core takes for a background.
const packedColor = (color: Color): number =>
  (Math.round(Math.min(Math.max(color[0], 0), 1) * 255) << 16) |
  (Math.round(Math.min(Math.max(color[1], 0), 1) * 255) << 8) |
  Math.round(Math.min(Math.max(color[2], 0), 1) * 255);

// Hits from the three mirror, told which model each group belongs to, which is what
// `SceneBinding.pick` takes.
export const raycastSource = (
  objects: SceneObject,
  groups: ReadonlyMap<InstancedGroup, GroupLocation>,
): ((ray: Ray) => readonly ModelRaycastHit[]) => {
  const caster = new Raycaster();
  return (ray) => {
    caster.set(
      new Vector3(ray.origin[0], ray.origin[1], ray.origin[2]),
      new Vector3(ray.direction[0], ray.direction[1], ray.direction[2]),
    );
    const found: ModelRaycastHit[] = [];
    for (const hit of objects.raycast(caster)) {
      const at = groups.get(hit.group);
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

// Anything in the mirror that carries a material. `Mesh` without its type arguments reaches this
// code with an `any` material, so the shape is named here and the `instanceof` proves it.
type MaterialHolder = { material: Material | Material[] };
const carriesMaterial = (node: Object3D): node is Object3D & MaterialHolder => node instanceof Mesh;

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
      if (!carriesMaterial(node)) return;
      if (Array.isArray(node.material)) for (const one of node.material) put(one);
      else put(node.material);
    });
    viewer.setLocalClipping(held.length > 0);
  },
});

// The two lights a rig comes to: a sky and a sun, pointed along the model's own up axis.
//
// viewer-core's constructor adds a rig for a y-up scene - a hemisphere light with a dark blue
// ground colour and a sun at (1, 2, 1.5). In a z-up model that puts the sun near the horizon and
// paints every wall facing -y in the ground colour, so a z-up scene has to replace it rather than
// leave it alone. This is slice finding 3, in one function.
const rigLights = (rig: LightRig, up: Vec3): readonly Light[] => {
  const sky = new HemisphereLight(0xffffff, 0x8d949c, rig.ambientIntensity);
  sky.position.set(up[0], up[1], up[2]);
  const warmth = Math.min(Math.max(rig.warmth, 0), 1);
  const sun = new DirectionalLight(
    new ThreeColor().setRGB(1, 1 - warmth * 0.12, 1 - warmth * 0.25),
    rig.sunIntensity,
  );
  sun.position.set(rig.sunDirection[0], rig.sunDirection[1], rig.sunDirection[2]);
  return [sky, sun];
};

// Draws the background, the light rig, and the grid and axis lines the render package generates.
// Everything it adds goes in one group, so setting an environment again removes exactly what the
// last one put there. The ground plane is left to the grid.
export const environmentTarget = (viewer: Viewer, up: Vec3): EnvironmentTarget => {
  let drawn:
    | { readonly held: Group; readonly geometry?: BufferGeometry; readonly material?: LineBasicMaterial }
    | undefined;
  const clear = (): void => {
    if (drawn === undefined) return;
    viewer.objects.scene.remove(drawn.held);
    drawn.geometry?.dispose();
    drawn.material?.dispose();
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
      held.add(...rigLights(drawing.rig, up));
      const positions: number[] = [];
      const colors: number[] = [];
      for (const line of [...drawing.grid, ...drawing.axes]) {
        positions.push(line.from[0], line.from[1], line.from[2], line.to[0], line.to[1], line.to[2]);
        colors.push(line.color[0], line.color[1], line.color[2], line.color[0], line.color[1], line.color[2]);
      }
      if (positions.length === 0) {
        drawn = { held };
      } else {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
        const material = new LineBasicMaterial({ vertexColors: true });
        held.add(new LineSegments(geometry, material));
        drawn = { held, geometry, material };
      }
      viewer.objects.scene.add(held);
    },
  };
};

// The drawing buffer, for `captureImage`. Sizes are device pixels, so the ratio is one while the
// capture is drawn; `captureImage` puts the size back afterwards.
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

// GPU timing, or the reason there is none. The WebGL2 timer-query extension reaches TypeScript as
// `any` through `getExtension`, and this repository allows no `any`, so its presence is reported
// and its readings are not taken.
export const gpuFrameTimer = (canvas: HTMLCanvasElement): GpuFrameTimer => {
  const context = canvas.getContext('webgl2');
  if (context === null) return noGpuTimer('the canvas has no WebGL2 context');
  const extensions = context.getSupportedExtensions() ?? [];
  return noGpuTimer(
    extensions.includes('EXT_disjoint_timer_query_webgl2')
      ? 'EXT_disjoint_timer_query_webgl2 is present, but nothing here reads it: its bindings are untyped'
      : 'EXT_disjoint_timer_query_webgl2 is not present',
  );
};

// The three adapters that put something in, or take something out of, the three scene: clipping
// planes on every material, the background and light rig, and screen-space overlay primitives.
//
// They are together because they share one problem: viewer-core owns the mirror, and none of these
// is a mirrored group, so each has to reach into the three scene beside it and take its own things
// away again on disposal.

import type { Viewer } from '@ara3d/viewer-core';
import type { Color, Vec3 } from '@bim-open-toolkit/model';
import type { ClippingTarget, EnvironmentTarget, OverlayRenderer, ProjectedOverlay } from '@bim-open-toolkit/render';
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
  Vector3,
  type Material,
  type Object3D,
} from 'three';

// A linear colour as the 0xRRGGBB integer viewer-core takes for a background.
const packedColor = (color: Color): number =>
  (Math.round(Math.min(Math.max(color[0], 0), 1) * 255) << 16) |
  (Math.round(Math.min(Math.max(color[1], 0), 1) * 255) << 8) |
  Math.round(Math.min(Math.max(color[2], 0), 1) * 255);

// Anything in the mirror that carries a material. `Mesh` without its type arguments hands `material`
// back as `any`, which this repository does not allow, so the shape is named and `instanceof`
// proves it.
type MaterialHolder = { material: Material | Material[] };
const carriesMaterial = (node: Object3D): node is Object3D & MaterialHolder => node instanceof Mesh;

// Clipping planes on every material of the mirror.
//
// viewer-core has no renderer-wide plane list, so each material is set in turn, and local clipping
// is switched on for as long as any plane is held. A group added after this runs is not clipped
// until the planes are set again, which is why the view re-applies its section when a model opens.
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

// Background, light rig, grid and axes.
//
// viewer-core's constructor adds a rig for a y-up scene: a hemisphere light with a dark blue ground
// colour and a sun at (1, 2, 1.5). In a z-up model that puts the sun near the horizon and paints
// every wall facing -y in the ground colour, so setting an environment replaces the lights that are
// there rather than adding to them. Clearing it puts nothing back: a view with no environment is
// unlit, which is visible, rather than lit by a rig nobody asked for.
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

// The SVG element an overlay draws into, sized and positioned by the host over the canvas.
const svgNamespace = 'http://www.w3.org/2000/svg';

const cssColor = (color: Color, opacity: number): string =>
  `rgba(${Math.round(Math.min(Math.max(color[0], 0), 1) * 255)}, ${Math.round(
    Math.min(Math.max(color[1], 0), 1) * 255,
  )}, ${Math.round(Math.min(Math.max(color[2], 0), 1) * 255)}, ${opacity})`;

// Overlay primitives drawn as SVG over the canvas.
//
// The render package has already projected every anchor to a screen point and decided what is
// visible, so this only draws: a point is a circle, a label is text, and everything else is a
// polyline through its anchors. A box is drawn as the rectangle its two anchors bound, because two
// screen points cannot describe an oriented box and pretending otherwise would draw a lie.
//
// Hit testing is not here: `overlayAt` in the render package answers a click from the same
// projected list, so the drawing and the answer cannot disagree.
export const overlayRenderer = (host: SVGSVGElement): OverlayRenderer => ({
  setOverlays: (items: readonly ProjectedOverlay[]) => {
    host.replaceChildren();
    for (const drawn of items) {
      if (!drawn.visible || drawn.points.length === 0) continue;
      const style = drawn.item.style;
      const stroke = cssColor(style.color, style.opacity);
      if (drawn.item.kind === 'label' && drawn.item.text !== undefined) {
        const text = host.ownerDocument.createElementNS(svgNamespace, 'text');
        text.setAttribute('x', String(drawn.points[0]?.x ?? 0));
        text.setAttribute('y', String(drawn.points[0]?.y ?? 0));
        text.setAttribute('fill', stroke);
        text.setAttribute('font-size', String(Math.max(style.size, 8)));
        text.textContent = drawn.item.text;
        host.append(text);
        continue;
      }
      if (drawn.item.kind === 'point' || drawn.points.length === 1) {
        const circle = host.ownerDocument.createElementNS(svgNamespace, 'circle');
        circle.setAttribute('cx', String(drawn.points[0]?.x ?? 0));
        circle.setAttribute('cy', String(drawn.points[0]?.y ?? 0));
        circle.setAttribute('r', String(Math.max(style.size / 2, 1)));
        circle.setAttribute('fill', stroke);
        host.append(circle);
        continue;
      }
      const line = host.ownerDocument.createElementNS(svgNamespace, 'polyline');
      line.setAttribute('points', drawn.points.map((point) => `${point.x},${point.y}`).join(' '));
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', stroke);
      line.setAttribute('stroke-width', String(Math.max(style.size / 2, 1)));
      host.append(line);
    }
  },
});

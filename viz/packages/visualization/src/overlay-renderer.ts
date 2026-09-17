import { Vector3, type Camera } from 'three';
import { validateAnnotationDocument, type Annotation } from './annotations.js';

/** SVG labels and leaders are screen overlays, not depth-occluded geometry. Host updates after camera changes. */
export class AnnotationOverlay {
  private readonly root: SVGSVGElement;
  private entries: { note: Annotation; group: SVGGElement }[] = [];
  private disposed = false;
  constructor(container: HTMLElement, private readonly camera: Camera) {
    this.root = container.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.root.setAttribute('aria-label', 'World anchored annotations');
    Object.assign(this.root.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' });
    container.append(this.root);
  }
  setAnnotations(notes: readonly Annotation[]): void {
    if (this.disposed) throw new Error('Annotation overlay is disposed');
    const result = validateAnnotationDocument({ schemaVersion: 1, annotations: notes });
    if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Invalid annotations');
    const create = <K extends keyof SVGElementTagNameMap>(tag: K) => this.root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
    this.entries = result.value.annotations.map(note => {
      const group = create('g');
      const point = create('circle'); point.setAttribute('r', '4'); point.setAttribute('fill', '#f97316');
      const leader = create('line'); leader.setAttribute('x2', '14'); leader.setAttribute('y2', '-18'); leader.setAttribute('stroke', '#f97316'); leader.setAttribute('stroke-width', '2');
      const label = create('text'); label.setAttribute('x', '17'); label.setAttribute('y', '-20'); label.setAttribute('fill', '#102030'); label.setAttribute('stroke', '#fff'); label.setAttribute('stroke-width', '3'); label.setAttribute('paint-order', 'stroke'); label.setAttribute('font-size', '14'); label.textContent = note.text;
      group.append(point, leader, label);
      return { note, group };
    });
    this.root.replaceChildren();
    for (const entry of this.entries) this.root.append(entry.group);
  }
  update(width: number, height: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Overlay viewport must be positive and finite');
    this.camera.updateMatrixWorld();
    this.root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    for (const { note, group } of this.entries) {
      const point = new Vector3(...note.position).project(this.camera);
      const visible = Number.isFinite(point.x) && Number.isFinite(point.y) && point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
      group.setAttribute('display', visible ? '' : 'none');
      if (visible) group.setAttribute('transform', `translate(${(point.x + 1) * width / 2} ${(1 - point.y) * height / 2})`);
    }
  }
  dispose(): void { if (!this.disposed) { this.disposed = true; this.entries = []; this.root.remove(); } }
}

import { describe, it, expect } from 'vitest';
import { MeshStandardMaterial } from 'three';
import {
  INSTANCE_ALPHA_ATTRIBUTE,
  INSTANCE_ALPHA_CACHE_KEY,
  patchVertexShader,
  patchFragmentShader,
  patchMaterialForInstanceAlpha,
} from '../src/instance-alpha.js';

const vertexSource = 'void main() {\n\t#include <begin_vertex>\n}';
const fragmentSource = 'void main() {\n\t#include <color_fragment>\n}';

describe('instance-alpha shader patch', () => {
  it('vertex patch declares the attribute and forwards it to a varying', () => {
    const out = patchVertexShader(vertexSource);
    expect(out).toContain(`attribute float ${INSTANCE_ALPHA_ATTRIBUTE};`);
    expect(out).toContain('varying float vInstanceAlpha;');
    expect(out).toContain(`vInstanceAlpha = ${INSTANCE_ALPHA_ATTRIBUTE};`);
    expect(out).toContain('#include <begin_vertex>');
  });

  it('fragment patch discards near-zero alpha and scales diffuse alpha', () => {
    const out = patchFragmentShader(fragmentSource);
    expect(out).toContain('varying float vInstanceAlpha;');
    expect(out).toContain('discard');
    expect(out).toContain('diffuseColor.a *= vInstanceAlpha;');
    expect(out).toContain('#include <color_fragment>');
  });

  it('patchMaterialForInstanceAlpha installs onBeforeCompile and a cache key', () => {
    const m = new MeshStandardMaterial();
    patchMaterialForInstanceAlpha(m);
    expect(m.customProgramCacheKey()).toBe(INSTANCE_ALPHA_CACHE_KEY);
    const shader = { vertexShader: vertexSource, fragmentShader: fragmentSource };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    m.onBeforeCompile(shader as any, undefined as any);
    expect(shader.vertexShader).toContain('vInstanceAlpha');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= vInstanceAlpha;');
    m.dispose();
  });
});

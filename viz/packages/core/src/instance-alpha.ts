import { MeshStandardMaterial } from 'three';

/** Name of the per-instance alpha attribute (1 float per instance). */
export const INSTANCE_ALPHA_ATTRIBUTE = 'instanceAlpha';

/** Instances with alpha below this are discarded in the fragment shader. */
export const MIN_VISIBLE_ALPHA = 1 / 255;

/** Cache key so three.js never shares the unpatched program with this material. */
export const INSTANCE_ALPHA_CACHE_KEY = 'ara3d-instance-alpha';

/**
 * Splices per-instance alpha into the standard shader source. Exported
 * separately so the transform is unit-testable without a GL context.
 */
export function patchVertexShader(source: string): string {
  return (
    `attribute float ${INSTANCE_ALPHA_ATTRIBUTE};\n` +
    'varying float vInstanceAlpha;\n' +
    source.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n\tvInstanceAlpha = ${INSTANCE_ALPHA_ATTRIBUTE};`,
    )
  );
}

export function patchFragmentShader(source: string): string {
  return (
    'varying float vInstanceAlpha;\n' +
    source.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' +
        `\tif (vInstanceAlpha < ${MIN_VISIBLE_ALPHA}) discard;\n` +
        '\tdiffuseColor.a *= vInstanceAlpha;',
    )
  );
}

/**
 * Patches a MeshStandardMaterial so it multiplies fragment alpha by the
 * `instanceAlpha` instanced attribute and discards fragments whose instance
 * alpha is below MIN_VISIBLE_ALPHA (so alpha-0 instances neither draw nor
 * write depth).
 *
 * Only apply to a material used exclusively on geometry that carries the
 * attribute — the patched program declares it, so meshes without it would
 * fail to link. Materials that are never patched are unaffected.
 */
export function patchMaterialForInstanceAlpha(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = patchVertexShader(shader.vertexShader);
    shader.fragmentShader = patchFragmentShader(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => INSTANCE_ALPHA_CACHE_KEY;
}

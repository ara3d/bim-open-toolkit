/** PBR-ish material parameters. All values are floats in [0, 1]. */
export interface MaterialConfig {
  readonly metalness: number;
  readonly roughness: number;
  /** Whole-group opacity; per-instance alpha additionally scales this. */
  readonly opacity: number;
}

export const defaultMaterial: MaterialConfig = {
  metalness: 0.1,
  roughness: 0.8,
  opacity: 1.0,
};

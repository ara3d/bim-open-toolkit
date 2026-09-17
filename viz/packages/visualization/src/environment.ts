import { Color, DirectionalLight, Group, HemisphereLight, Light, Scene } from 'three';

export type EnvironmentSettings = { readonly background: number; readonly intensity: number; readonly warmth?: number };
/** Own a simple review light rig; restore the host's lighting/background on disposal. */
export function applyEnvironment(scene: Scene, settings: EnvironmentSettings): () => void {
  if (!Number.isFinite(settings.intensity) || settings.intensity < 0 || !Number.isFinite(settings.background)
      || (settings.warmth !== undefined && (!Number.isFinite(settings.warmth) || settings.warmth < 0 || settings.warmth > 1))) throw new Error('Invalid environment settings');
  const background = scene.background;
  const lights: Array<{ light: Light; visible: boolean }> = [];
  scene.traverse(object => { if (object instanceof Light) lights.push({ light:object,visible:object.visible }); });
  for (const {light} of lights) light.visible=false;
  const rig = new Group();
  const tint = new Color(0xffffff).lerp(new Color(0xffc49b),settings.warmth??0);
  const sky = new HemisphereLight(tint,0x445566,settings.intensity);
  const sun = new DirectionalLight(tint,settings.intensity*2);sun.position.set(1,2,1.5);
  rig.add(sky,sun);scene.add(rig);scene.background=new Color(settings.background);
  let disposed=false;
  return () => {if(disposed)return;disposed=true;scene.remove(rig);scene.background=background;for(const {light,visible}of lights)light.visible=visible;};
}

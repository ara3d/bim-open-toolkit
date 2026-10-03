// @bimopenflow/pane-3d: the editor's 3D pane over the BIM Open viewer, kept
// out of the generic panes so the editor packages never depend on the viewer.
// An editor registers it with bootEditor({ panes: [...genericPanes, view3dPane] }).

export { view3dPane } from "./view3dPane";
export { createViewPane3D, inferFormat, type ViewPane3DOptions } from "./viewPane3D";
export { defaultView3DDeps, type View3DDeps, type ViewerRig } from "./viewerDeps";
export { buildLiveViewRecipe } from "./liveViewRecipe";
export { parseViewRecipe, type ViewStep } from "./viewRecipe";
export { UNIT_CUBE } from "./unitCube";

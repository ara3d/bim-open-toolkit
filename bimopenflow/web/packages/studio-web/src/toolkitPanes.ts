// What the toolkit's editor pages register: the generic panes plus the 3D
// pane, and the sample flows as start-page templates.
import { genericPanes } from "@bimopenflow/client";
import { view3dPane } from "@bimopenflow/pane-3d";

export { TEMPLATES } from "./templates.generated.js";

export const toolkitPanes = [...genericPanes, view3dPane];

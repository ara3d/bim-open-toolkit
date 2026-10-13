// Entry for classic.html: the editor in its classic look, with the 3D pane
// and the sample flow templates. index.html boots studio.ts.
import { bootEditor } from "@bimopenflow/app";
import { TEMPLATES, toolkitPanes } from "./toolkitPanes.js";

bootEditor({ panes: toolkitPanes, templates: TEMPLATES });

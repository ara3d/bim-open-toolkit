// Entry for index.html: the editor in its classic look, with the 3D pane and
// the sample flow templates.
import { bootEditor } from "@bimopenflow/app";
import { TEMPLATES, toolkitPanes } from "./toolkitPanes.js";

bootEditor({ panes: toolkitPanes, templates: TEMPLATES });

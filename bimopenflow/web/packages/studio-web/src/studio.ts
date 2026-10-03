// Entry for studio.html: the same editor in the studio look, with the 3D pane
// and the sample flow templates.
import { bootEditor, studioChrome } from "@bimopenflow/app";
import { TEMPLATES, toolkitPanes } from "./toolkitPanes.js";

bootEditor({ chrome: studioChrome({ templates: TEMPLATES }), panes: toolkitPanes, templates: TEMPLATES });

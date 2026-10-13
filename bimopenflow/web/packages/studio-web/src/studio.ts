// Entry for index.html and studio.html: the editor in the studio look (the
// default since 2026-10-12), with the 3D pane and the sample flow templates.
import { bootEditor, studioChrome } from "@bimopenflow/app";
import { TEMPLATES, toolkitPanes } from "./toolkitPanes.js";

bootEditor({ chrome: studioChrome({ templates: TEMPLATES }), panes: toolkitPanes, templates: TEMPLATES });

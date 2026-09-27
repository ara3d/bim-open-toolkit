// The notebook's look: one injected stylesheet under the "nb-" prefix, themed
// by CSS custom properties, light by default and dark under
// prefers-color-scheme (same approach as packages/app/src/styles.ts). Both
// the turn view and the notebook view (a later chunk) call
// ensureNotebookStyles; the second call is a no-op.

export const notebookCss = `
:root {
  --nb-bg: #f7f6f3;
  --nb-surface: #ffffff;
  --nb-border: #e5e3de;
  --nb-text: #1a1a18;
  --nb-dim: #8a8880;
  --nb-accent: #3b82c4;
  --nb-green: #3ba55d;
  --nb-amber: #d99a2b;
  --nb-red: #c0392b;
  --nb-request-bg: #eef3fa;
  --nb-reply-bg: #ffffff;
  --nb-font: Inter, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --nb-bg: #1a1a18;
    --nb-surface: #242422;
    --nb-border: #3a3a36;
    --nb-text: #ece9e2;
    --nb-dim: #9a988f;
    --nb-accent: #6fb3f0;
    --nb-green: #4fce7c;
    --nb-amber: #e8b64f;
    --nb-red: #e0685a;
    --nb-request-bg: #232c36;
    --nb-reply-bg: #242422;
  }
}
body { background: var(--nb-bg); color: var(--nb-text); font: 14px var(--nb-font); }
.nb-column { max-width: 760px; box-sizing: border-box; margin: 0 auto; padding: 24px 16px; }
.nb-turn { margin-bottom: 24px; border-bottom: 1px solid var(--nb-border); padding-bottom: 16px; }
.nb-request { background: var(--nb-request-bg); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
.nb-request-text { white-space: pre-wrap; }
.nb-request-edit { width: 100%; box-sizing: border-box; min-height: 60px; font: inherit; padding: 6px; border-radius: 4px; border: 1px solid var(--nb-border); }
.nb-controls { display: flex; gap: 8px; margin-top: 6px; }
.nb-controls button {
  font: inherit; padding: 3px 10px; border: 1px solid var(--nb-border); border-radius: 4px;
  background: var(--nb-surface); color: var(--nb-text); cursor: pointer;
}
.nb-controls button:disabled { color: var(--nb-dim); cursor: default; }
.nb-reply { background: var(--nb-reply-bg); border-radius: 8px; padding: 10px 14px; }
.nb-reply p { line-height: 1.5; margin: 0 0 10px; }
.nb-reply p:last-child { margin-bottom: 0; }
.nb-error { color: var(--nb-red); font-weight: 600; margin-bottom: 8px; }
.nb-tools { margin-bottom: 8px; }
.nb-tools summary { cursor: pointer; color: var(--nb-dim); }
.nb-tools ul { margin: 6px 0 0; padding-left: 18px; }
.nb-tool-mark { display: inline-block; width: 1.2em; }
.nb-tool-ok .nb-tool-mark { color: var(--nb-green); }
.nb-tool-failed .nb-tool-mark { color: var(--nb-red); }
.nb-agent-info { color: var(--nb-dim); font-size: 12px; margin-top: 8px; }
.nb-embed { border: 1px solid var(--nb-border); border-radius: 8px; margin: 12px 0; overflow: hidden; }
.nb-embed-header {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: var(--nb-surface); border-bottom: 1px solid var(--nb-border);
}
.nb-embed-caption { font-weight: 600; }
.nb-embed-kind { font-size: 11px; text-transform: uppercase; color: var(--nb-dim); }
.nb-embed-body { padding: 10px; overflow-x: auto; }
.nb-badge { margin-left: auto; font-size: 11px; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.nb-badge-snapshot { background: var(--nb-border); color: var(--nb-dim); }
.nb-badge-current { background: var(--nb-green); color: #fff; }
.nb-badge-changed { background: var(--nb-amber); color: #1a1a18; }
.nb-badge-unavailable { background: var(--nb-red); color: #fff; }
.nb-stale { margin-top: 10px; color: var(--nb-amber); }
.nb-earlier { margin-top: 10px; }
.nb-earlier-entry { color: var(--nb-dim); margin-top: 6px; }
.nb-earlier-entry summary { cursor: pointer; }
.nb-earlier-request, .nb-earlier-reply { white-space: pre-wrap; margin: 4px 0; }
`;

const STYLE_ID = "nb-styles";

/** Injects the notebook stylesheet once per document; safe to call again. */
export function ensureNotebookStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = notebookCss;
  doc.head.appendChild(style);
}

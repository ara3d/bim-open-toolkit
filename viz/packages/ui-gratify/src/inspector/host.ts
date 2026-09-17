// The sidebar property inspector (contract G1, `hostInspector`). One Gratify runtime on one canvas
// that fills its container. What it shows is a `PropertySheet` the demo derives from its session;
// the host re-derives it after every change event and drops the new one when it would draw the
// same thing, so the scroll position and the open rows survive a change elsewhere in the viewer.
import { failure, success, type Result, type Session } from '@bim-open-toolkit/model';
import type { OverlayAction } from '@bim-open-toolkit/render';
import { at, v, type AppSpec, type Element } from 'gratify';
import type { Hosted, PropertySheet } from '../contracts.js';
import { sheetCoverage } from '../contracts.js';
import { hostSurface, type RuntimeSurface } from '../host.js';
import type { FrameScheduler } from '../surface.js';
import { clampScroll, List, Pane, scrollToShow } from '../widgets/list.js';
import { lineAction, sameSheet, sheetLines, type SheetLine } from './lines.js';
import { headHeight, lineElement, lineHeight, SheetHead } from './parts.js';

// What the inspector is showing. `lines` is derived from `sheet` and `open`; it is kept in the
// document because the scroll arithmetic needs a count before anything is laid out.
export type InspectorDoc = {
  readonly sheet: PropertySheet;
  readonly lines: readonly SheetLine[];
  readonly open: ReadonlySet<string>;
  readonly width: number;
  readonly height: number;
  readonly scroll: number;
  // The line the keyboard is on, or -1.
  readonly focus: number;
  // A command a click asked for. The nonce makes two identical clicks two separate requests.
  readonly request: { readonly action: OverlayAction; readonly nonce: number } | undefined;
};

export type InspectorIntent =
  | { readonly kind: 'sheet'; readonly sheet: PropertySheet }
  | { readonly kind: 'resize'; readonly width: number; readonly height: number }
  | { readonly kind: 'scroll'; readonly to: number }
  | { readonly kind: 'move'; readonly by: number }
  | { readonly kind: 'open'; readonly key: string }
  | { readonly kind: 'act'; readonly action: OverlayAction };

const empty: PropertySheet = { title: '', groups: [] };

// How tall the scrolling part of the inspector is.
const listHeight = (doc: InspectorDoc): number => Math.max(0, doc.height - headHeight(doc.sheet.subtitle));

const withLines = (doc: InspectorDoc, sheet: PropertySheet, open: ReadonlySet<string>): InspectorDoc => {
  const lines = sheetLines(sheet, open);
  const next = { ...doc, sheet, open, lines };
  return { ...next, scroll: clampScroll(doc.scroll, lines.length, lineHeight(), listHeight(next)) };
};

export const inspectorInit = (sheet: PropertySheet, width: number, height: number): InspectorDoc =>
  withLines(
    { sheet, lines: [], open: new Set(), width, height, scroll: 0, focus: -1, request: undefined },
    sheet,
    new Set(),
  );

export const inspectorUpdate = (doc: InspectorDoc, intent: InspectorIntent): InspectorDoc => {
  switch (intent.kind) {
    case 'sheet':
      return withLines(doc, intent.sheet, doc.open);
    case 'resize':
      return withLines({ ...doc, width: intent.width, height: intent.height }, doc.sheet, doc.open);
    case 'scroll':
      return { ...doc, scroll: clampScroll(intent.to, doc.lines.length, lineHeight(), listHeight(doc)) };
    case 'move': {
      if (doc.lines.length === 0) return doc;
      const focus = Math.min(doc.lines.length - 1, Math.max(0, (doc.focus < 0 ? -1 : doc.focus) + intent.by));
      return {
        ...doc,
        focus,
        scroll: scrollToShow(focus, doc.lines.length, lineHeight(), listHeight(doc), doc.scroll),
      };
    }
    case 'open': {
      const open = new Set(doc.open);
      if (!open.delete(intent.key)) open.add(intent.key);
      return withLines(doc, doc.sheet, open);
    }
    case 'act':
      return { ...doc, request: { action: intent.action, nonce: (doc.request?.nonce ?? 0) + 1 } };
  }
};

// What clicking a line should emit: run its action, or open the story behind its value.
const pressOf = (line: SheetLine): InspectorIntent | undefined => {
  const action = lineAction(line);
  if (action !== undefined) return { kind: 'act', action };
  return line.kind === 'row' && line.tellable ? { kind: 'open', key: line.key } : undefined;
};

const headElement = (doc: InspectorDoc): Element =>
  SheetHead('head', {
    width: doc.width,
    title: doc.sheet.title,
    ...(doc.sheet.subtitle === undefined ? {} : { subtitle: doc.sheet.subtitle }),
    counts: sheetCoverage(doc.sheet),
  });

// The list first and the header second: the header is drawn last and is opaque, which is what hides
// the rows the list overscanned above its top. That is the whole of scrolling without a clip.
export const inspectorView = (doc: InspectorDoc): Element =>
  Pane('inspector', { width: doc.width, height: doc.height }, [
    at(
      List('lines', {
        width: doc.width,
        height: listHeight(doc),
        rowHeight: lineHeight(),
        count: doc.lines.length,
        scroll: doc.scroll,
        row: (index) => {
          const line = doc.lines[index];
          return line === undefined
            ? Pane(`blank:${index}`, { width: doc.width, height: lineHeight() })
            : lineElement(line, doc.width, pressOf(line), index === doc.focus);
        },
        scrollTo: (offset) => ({ kind: 'scroll', to: offset }),
      }),
      v(0, headHeight(doc.sheet.subtitle)),
    ),
    at(headElement(doc), v(0, 0)),
  ]);

export type InspectorOptions = {
  readonly frames?: FrameScheduler | undefined;
};

// Hosts the sidebar inspector. `sheet` is re-run after every change event; an equal sheet is
// dropped rather than re-rendered. A row's action is dispatched on the session as the command and
// input it names, which is the same route a click on an overlay takes.
export const hostInspector = (
  container: HTMLElement,
  sheet: () => PropertySheet,
  session: Session,
  options: InspectorOptions = {},
): Result<Hosted> => {
  const first = sheet();
  let surface: RuntimeSurface<InspectorDoc, InspectorIntent> | undefined;

  const spec: AppSpec<InspectorDoc, InspectorIntent> = {
    init: inspectorInit(first, Math.max(1, container.clientWidth), Math.max(1, container.clientHeight)),
    update: inspectorUpdate,
    view: inspectorView,
    onCommit: (doc, previous) => {
      const request = doc.request;
      if (request !== undefined && request.nonce !== previous.request?.nonce) {
        session.dispatch(request.action.command, request.action.input);
      }
    },
  };

  const scrollBy = (delta: number): boolean => {
    const current = surface?.doc();
    if (current === undefined) return false;
    const to = clampScroll(current.scroll + delta, current.lines.length, lineHeight(), listHeight(current));
    if (to === current.scroll) return false;
    surface?.dispatch({ kind: 'scroll', to });
    return true;
  };

  const onKey = (key: string): boolean => {
    const moves: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
    const by = moves[key];
    if (by === undefined) return false;
    surface?.dispatch({ kind: 'move', by });
    return true;
  };

  const hosted = hostSurface<InspectorDoc, InspectorIntent>(container, {
    id: 'inspector',
    spec,
    sizing: {
      kind: 'fill',
      onResize: (size) => surface?.dispatch({ kind: 'resize', width: size.x, height: size.y }),
    },
    onWheel: (delta) => scrollBy(delta),
    onKey,
    frames: options.frames,
  });
  if (!hosted.ok) return failure(hosted.diagnostics);
  surface = hosted.value;
  surface.canvas.style.display = 'block';
  surface.dispatch({ kind: 'resize', width: surface.size().x, height: surface.size().y });

  const subscription = session.subscribe(() => {
    const next = sheet();
    if (!sameSheet(next, surface?.doc().sheet ?? empty)) surface?.dispatch({ kind: 'sheet', sheet: next });
    surface?.wake();
  });

  const live = surface;
  return success({
    canvas: live.canvas,
    semantics: live.semantics,
    activate: live.activate,
    onChanged: live.onChanged,
    dispose: () => {
      subscription.dispose();
      live.dispose();
    },
  });
};

// The capture bar: a size choice, a HUD switch and the button that takes the picture.
//
// The panel keeps no picture of its own. Pressing Capture dispatches `capture.image`, the feature
// stores the finished image in its slice, and `sync` reads it back on the next change event, so the
// bar reports the picture that exists rather than the one it asked for.
//
// The chip is a part defined here because the ui-gratify widget kit has not been published; when
// `Segmented`, `Toggle` and `Button` land they replace it and the panel keeps its shape.

import { captureSlice, hudSlice } from '@bim-open-toolkit/features';
import { hudPanel, type AnyHudPanel, type HudPanel } from '@bim-open-toolkit/ui-gratify';
import { Label, Press, Row, Stack, part, surface, v, type AppSpec, type Element } from 'gratify';
import {
  captureRequestFor,
  captureSizeNames,
  captureSizeTitles,
  dataUrlBytes,
  lastCapture,
  openingSize,
  type CaptureSizeName,
} from './request.js';

// The picture the capture slice holds, reduced to what the bar prints.
export type PictureSummary = {
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
};

// What the bar shows: the size it will ask for, whether the HUD is shown, how many captures it has
// asked for, and the picture that came back.
export type CaptureDoc = {
  readonly size: CaptureSizeName;
  readonly hud: boolean;
  readonly asked: number;
  readonly picture?: PictureSummary | undefined;
};

export type CaptureIntent =
  | { readonly kind: 'size'; readonly size: CaptureSizeName }
  | { readonly kind: 'hud' }
  | { readonly kind: 'take' };

type ChipProps = { readonly label: string; readonly selected: boolean; readonly press: CaptureIntent };

const CaptureChip = part<ChipProps>()('capture-chip', {
  size: (props, measure) => v(measure.text(props.label, 12).x + 24, 26),
  style: (tokens, channels, props) => ({
    ...surface(tokens, channels, props.selected ? { tint: tokens.accent } : {}),
    corner: 6,
  }),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, node.rect.center, style.text, { size: 12 });
  },
  on: [Press((node): CaptureIntent => node.props.press)],
  semantics: (node) => ({ role: 'button', label: node.props.label, value: node.props.selected ? 'on' : 'off' }),
});

// What the bar says about the last picture.
export const pictureText = (picture: PictureSummary | undefined): string =>
  picture === undefined
    ? 'No picture taken yet'
    : `${picture.width}×${picture.height}, ${Math.round(picture.bytes / 1024)} kB`;

export const captureApp: AppSpec<CaptureDoc, CaptureIntent> = {
  init: { size: openingSize, hud: false, asked: 0 },
  update: (doc, intent) => {
    switch (intent.kind) {
      case 'size':
        return { ...doc, size: intent.size };
      case 'hud':
        return { ...doc, hud: !doc.hud };
      case 'take':
        return { ...doc, asked: doc.asked + 1 };
    }
  },
  view: (doc): Element =>
    Stack('capture-bar', { gap: 6, pad: 8 }, [
      Row(
        'capture-sizes',
        { gap: 6 },
        captureSizeNames.map((name) =>
          CaptureChip(name, {
            label: captureSizeTitles[name],
            selected: name === doc.size,
            press: { kind: 'size', size: name },
          }),
        ),
      ),
      Row('capture-actions', { gap: 6 }, [
        CaptureChip('take', { label: 'Capture', selected: false, press: { kind: 'take' } }),
        CaptureChip('hud', { label: 'HUD', selected: doc.hud, press: { kind: 'hud' } }),
      ]),
      Label('capture-last', { text: pictureText(doc.picture), size: 12, dim: true }),
    ]),
};

// The picture and HUD state as the session holds them now.
export const captureDocFrom = (
  doc: CaptureDoc,
  picture: PictureSummary | undefined,
  hudVisible: boolean,
): CaptureDoc => {
  const same =
    hudVisible === doc.hud &&
    picture?.width === doc.picture?.width &&
    picture?.height === doc.picture?.height &&
    picture?.bytes === doc.picture?.bytes;
  return same ? doc : { ...doc, hud: hudVisible, picture };
};

// The capture bar with its types open, so a test can drive `sync` and `onCommit` directly.
export const capturePanelSpec: HudPanel<CaptureDoc, CaptureIntent> = {
  id: 'capture-bar',
  place: { kind: 'corner', corner: 'top-left' },
  spec: captureApp,
  sync: (session, doc) => {
    const record = lastCapture(session.read(captureSlice));
    const picture =
      record === undefined
        ? undefined
        : { width: record.width, height: record.height, bytes: dataUrlBytes(record.dataUrl) };
    return captureDocFrom(doc, picture, session.read(hudSlice).visible);
  },
  onCommit: (doc, previous, session) => {
    if (doc.hud !== previous.hud) session.dispatch('hud.toggle', { visible: doc.hud });
    if (doc.asked !== previous.asked) session.dispatch('capture.image', captureRequestFor(doc.size));
  },
};

// The capture bar as the gallery hosts it.
export const capturePanel: AnyHudPanel = hudPanel(capturePanelSpec);

// Every panel this demo draws.
export const capturePanels: readonly AnyHudPanel[] = [capturePanel];

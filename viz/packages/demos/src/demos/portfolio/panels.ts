// One card per building, hanging over the top of its mass, carrying the figure the workflow could
// attribute to it and the outcome it was coloured by. Clicking a card drills into that building;
// clicking it again goes back to the whole estate.
//
// The cards are built from Gratify's own `Stack`, `Row` and `Label` because Track UG's `Card` and
// `Chip` widgets have not landed; CHECKPOINT-D4.md records the swap. The outcome colour is the
// features package's fixed analytical palette, never a theme token, so changing theme or text size
// does not change what a colour means.

import { outcomeColor, setsSlice } from '@bim-open-toolkit/features';
import { isEmptyBounds, type Color, type ObjectKey, type Session, type Vec3 } from '@bim-open-toolkit/model';
import { hudPanel, type AnyHudPanel } from '@bim-open-toolkit/ui-gratify';
import {
  Focusable,
  Label,
  Row,
  Stack,
  part,
  rgb,
  type AppSpec,
  type Color as PaintColor,
  type Element,
} from 'gratify';
import { buildingBounds, buildingKey, cardPoint, estateBounds, type PortfolioIndex } from './city.js';
import { buildingReadings, drilledBuildingId, type BuildingReading } from './readings.js';
import { documentAt, metricText, type DocumentRollup, type RecordedRollup } from './recorded.js';
import { currentSubject, drillDocument, drilledDocument } from './snowdon.js';

// An analytical colour of the features palette as a colour the painter takes. The palette states
// its channels from zero to one; the painter counts them from zero to 255.
export const paintColor = (color: Color): PaintColor => rgb(color[0] * 255, color[1] * 255, color[2] * 255);

// What one card shows. `outcome` is the workflow's own outcome name, or empty when the result
// coloured this building by nothing at all; the view is what turns it into words.
export type CardDoc = {
  readonly buildingId: string;
  readonly name: string;
  readonly siteId: string;
  readonly figure: string;
  readonly outcome: string;
  readonly surveyed: boolean;
  readonly drilled: boolean;
  // Rises once per click, so the host can tell a click from a state change the session pushed in.
  readonly requests: number;
};

// The one thing a card can be asked to do.
export type CardIntent = 'drill';

// A figure as text, with the unit the source reported it in. A building with no resolved figure
// says so; it never reads as zero.
export const figureText = (reading: BuildingReading): string => {
  const values = reading.readings.map((item) => `${Math.round(item.value)} ${item.unit}`.trim());
  return values.length === 0 ? 'No resolved figure' : values.join(', ');
};

// What the workflow's colouring says about a building, in words.
export const outcomeText = (outcome: string): string =>
  outcome === '' ? 'Not coloured by this result' : `Figure ${outcome}`;

// A card that has nothing from the session yet.
export const emptyCard = (buildingId: string): CardDoc => ({
  buildingId,
  name: buildingId,
  siteId: '',
  figure: 'No resolved figure',
  outcome: '',
  surveyed: false,
  drilled: false,
  requests: 0,
});

const readingFor = (index: PortfolioIndex, buildingId: string): BuildingReading | undefined =>
  index.result.ok
    ? buildingReadings(index, index.result.value).find((item) => item.buildingId === buildingId)
    : undefined;

// True when the session is isolated to exactly this building.
export const isDrilled = (index: PortfolioIndex, session: Session, buildingId: string): boolean =>
  drilledBuildingId(index, session.read(setsSlice).isolated) === buildingId;

// The card for one building as the session stands now.
export const cardOf = (index: PortfolioIndex, session: Session, buildingId: string): CardDoc => {
  const drilled = isDrilled(index, session, buildingId);
  const reading = readingFor(index, buildingId);
  return reading === undefined
    ? { ...emptyCard(buildingId), drilled }
    : {
        buildingId,
        name: reading.name,
        siteId: reading.siteId,
        figure: figureText(reading),
        outcome: reading.outcome ?? '',
        surveyed: reading.registration === 'geographic',
        drilled,
        requests: 0,
      };
};

const EstateCard = part('portfolio-card')
  .props<CardDoc>()
  .style((tokens, channels) => ({
    fill: tokens.mix(tokens.surface, tokens.surfaceHi, 0.3 + 0.4 * channels.hover),
    focus: channels.focus,
  }))
  .render((node, painter, style) =>
    painter.box(node.rect, 8, style.fill, paintColor(outcomeColor(node.props.outcome)), style.focus > 0.01 ? 3 : 2),
  )
  .body((props): Element[] => [
    Stack('layout', { gap: 3, pad: 10, align: 'start' }, [
      Row('head', { gap: 8 }, [
        Label('name', { text: props.name, size: 15 }),
        Label('site', { text: props.siteId, dim: true }),
      ]),
      Label('figure', { text: props.figure }),
      Label('outcome', { text: outcomeText(props.outcome), dim: true }),
      Label('registration', { text: props.surveyed ? 'Surveyed' : 'Not surveyed', dim: true }),
      Label('action', { text: props.drilled ? 'Click to show the estate' : 'Click to drill in', dim: true }),
    ]),
  ])
  .on(Focusable())
  .press((): CardIntent => 'drill')
  .semantics((node) => ({
    role: 'button',
    label: `${node.props.name}, ${node.props.siteId}`,
    value: node.props.figure,
  }));

// One card as an element tree.
export const cardView = (doc: CardDoc): Element => EstateCard('card', doc);

// One card's app: a document that only ever comes from the session, and one click that asks to
// drill. The click is counted rather than acted on here, so the command runs once per commit.
export const cardSpec = (buildingId: string): AppSpec<CardDoc, CardIntent> => ({
  init: emptyCard(buildingId),
  update: (doc: CardDoc): CardDoc => ({ ...doc, requests: doc.requests + 1 }),
  view: cardView,
});

// Drills into a building, or back out to the estate when it is already the one being shown.
// Isolating is what "drill in" means here: the other buildings leave the picture, the building is
// selected so the sheet follows it, and the camera frames its own box.
export const drill = (index: PortfolioIndex, session: Session, buildingId: string): void => {
  if (isDrilled(index, session, buildingId)) {
    session.dispatch('sets.showAll', {});
    session.dispatch('sets.select', { members: [], mode: 'replace' });
    session.dispatch('navigation.frame', { bounds: estateBounds(index) });
    return;
  }
  const target: ObjectKey = buildingKey(index, buildingId);
  const box = buildingBounds(index, buildingId);
  session.dispatch('sets.isolate', { members: [target] });
  session.dispatch('sets.select', { members: [target], mode: 'replace' });
  if (box !== undefined) session.dispatch('navigation.frame', { bounds: box });
};

// The card panel for one building, hidden while the reader has drilled into a different one.
export const buildingCardPanel = (index: PortfolioIndex, buildingId: string): AnyHudPanel =>
  hudPanel<CardDoc, CardIntent>({
    id: `portfolio/card/${buildingId}`,
    place: {
      kind: 'world',
      // A card states a figure about one building of the estate, so it hangs over the estate and
      // over nothing else: with another model open there is no building for it to be about, and
      // hanging it over that model's geometry would say the figure belongs to it.
      point: (session: Session): Vec3 | undefined => {
        if (currentSubject().kind !== 'estate') return undefined;
        const drilled = drilledBuildingId(index, session.read(setsSlice).isolated);
        return drilled !== undefined && drilled !== buildingId ? undefined : cardPoint(index, buildingId);
      },
    },
    spec: cardSpec(buildingId),
    sync: (session: Session, doc: CardDoc): CardDoc => ({
      ...cardOf(index, session, buildingId),
      requests: doc.requests,
    }),
    onCommit: (doc: CardDoc, previous: CardDoc, session: Session): void => {
      if (doc.requests !== previous.requests) drill(index, session, buildingId);
    },
  });

// One row of the source-document roll-up: what the document is called, what it adds up to, and how
// much of it that figure covers.
export type DocumentRowDoc = {
  readonly index: number;
  readonly title: string;
  readonly figure: string;
  readonly coverage: string;
  readonly outcome: string;
  readonly drilled: boolean;
};

// The roll-up panel's whole document. `visible` is false whenever the demo is not on a model it
// read from a file, and the panel then draws nothing at all rather than an empty frame.
export type RollupDoc = {
  readonly visible: boolean;
  readonly heading: string;
  readonly rows: readonly DocumentRowDoc[];
  // The model-wide total, or what stopped there being one.
  readonly total: string;
  // The objects carrying no figure at all, said as a count and never as a zero total.
  readonly without: string;
  // The metrics the file records in more than one unit, so nothing was added up for them.
  readonly notTotalled: string;
  // Rises once per press, so `onCommit` runs the drill once per click.
  readonly requests: number;
  readonly chosen: number;
};

// The only thing the roll-up panel can say.
export type RollupIntent = { readonly kind: 'drill'; readonly index: number };

// A roll-up panel with nothing in it, which is what it shows on the estate.
export const emptyRollupDoc: RollupDoc = {
  visible: false,
  heading: '',
  rows: [],
  total: '',
  without: '',
  notTotalled: '',
  requests: 0,
  chosen: -1,
};

// How much of a document the figure covers, as two counts rather than a percentage: an object that
// records no figure is one nobody measured, and rounding that into a share hides how many.
export const coverageText = (document: DocumentRollup): string =>
  `${String(document.requested.objects)} of ${String(document.objects)} objects record it`;

// One document as a row of the panel.
export const documentRowDoc = (document: DocumentRollup, drilled: number | undefined): DocumentRowDoc => ({
  index: document.index,
  title: document.title,
  figure: metricText(document.requested),
  coverage: coverageText(document),
  outcome: document.outcome,
  drilled: document.index === drilled,
});

// The panel as the roll-up and the drill state stand. Ordering is the roll-up's own: largest total
// first, and a document with no total after the ones that have one.
export const rollupDoc = (rollup: RecordedRollup, drilled: number | undefined): RollupDoc => {
  const requested = rollup.requested;
  const unit = requested.unit;
  return {
    visible: true,
    heading: `${rollup.requestedMetricName} by source document`,
    rows: rollup.documents.map((document) => documentRowDoc(document, drilled)),
    total:
      requested.total === undefined || unit === undefined
        ? `No total: ${metricText(requested)}`
        : `${requested.total.toFixed(2)} ${unit} over ${String(rollup.documents.length)} documents`,
    without: `${String(requested.without)} objects record no ${rollup.requestedMetricName}`,
    notTotalled: rollup.metrics
      .filter((metric) => metric.byUnit.length > 1)
      .map((metric) => `${metric.metricName} is recorded in ${String(metric.byUnit.length)} units and is not added up`)
      .join('; '),
    requests: 0,
    chosen: -1,
  };
};

const DocumentRow = part('portfolio-document')
  .props<DocumentRowDoc>()
  .style((tokens, channels) => ({
    fill: tokens.mix(tokens.surface, tokens.surfaceHi, 0.15 + 0.5 * channels.hover),
    focus: channels.focus,
  }))
  .render((node, painter, style) =>
    painter.box(node.rect, 6, style.fill, paintColor(outcomeColor(node.props.outcome)), style.focus > 0.01 ? 3 : 2),
  )
  .body((props): Element[] => [
    Stack('layout', { gap: 2, pad: 7, align: 'start' }, [
      Label('title', { text: props.title, size: 14 }),
      Label('figure', { text: `${props.figure} — ${props.coverage}`, dim: true }),
      ...(props.drilled ? [Label('action', { text: 'Click to show every document', dim: true })] : []),
    ]),
  ])
  .on(Focusable())
  .press((node): RollupIntent => ({ kind: 'drill', index: node.props.index }))
  .semantics((node) => ({ role: 'button', label: node.props.title, value: node.props.figure }));

// The roll-up as an element tree. Off the source fixture it is an empty stack, which sizes the
// panel's canvas to nothing.
export const rollupView = (doc: RollupDoc): Element =>
  doc.visible
    ? Stack('portfolio-rollup', { gap: 5, pad: 10, align: 'start' }, [
        Label('heading', { text: doc.heading, size: 15 }),
        Label('total', { text: doc.total }),
        Label('without', { text: doc.without, dim: true }),
        ...(doc.notTotalled === '' ? [] : [Label('not-totalled', { text: doc.notTotalled, dim: true })]),
        Label('hint', { text: 'Click a document to drill into it', dim: true }),
        ...doc.rows.map((row) => DocumentRow(`document/${String(row.index)}`, row)),
      ])
    : Stack('portfolio-rollup', { pad: 1 }, []);
// The padding on the empty view is not styling. A surface writes its canvas's CSS size only when
// the size it measures differs from the 1x1 it starts at, and a canvas with no CSS size falls back
// to the HTML default of 300 by 150 - which on the estate is an empty box over the model. One pixel
// of padding measures 2 by 2, which is written, and is nothing anybody can see.

// Drills into one source document, or back out to the whole model when it is the one being shown.
// Drilling isolates that document's objects and frames their box; nothing is selected, because a
// selection of twenty thousand objects is not a thing a property sheet can show.
export const drillIntoDocument = (session: Session, rollup: RecordedRollup, index: number): void => {
  if (drilledDocument() === index) {
    drillDocument(undefined);
    session.dispatch('sets.showAll', {});
    if (!isEmptyBounds(rollup.bounds)) session.dispatch('navigation.frame', { bounds: rollup.bounds });
    return;
  }
  const document = documentAt(rollup, index);
  if (document === undefined) return;
  drillDocument(index);
  session.dispatch('sets.isolate', { members: document.keys });
  if (!isEmptyBounds(document.bounds)) session.dispatch('navigation.frame', { bounds: document.bounds });
};

// The roll-up the demo shows for a model it read from a file, or nothing to show.
const currentRollup = (): RecordedRollup | undefined => {
  const subject = currentSubject();
  return subject.kind === 'source' ? subject.rollup : undefined;
};

// The source-document roll-up panel: one list in the corner rather than a card over each document,
// because a document is a whole discipline model spread through the building and there is no one
// place over it for a card to hang.
export const rollupPanel: AnyHudPanel = hudPanel<RollupDoc, RollupIntent>({
  id: 'portfolio/rollup',
  place: { kind: 'corner', corner: 'top-left' },
  spec: {
    // Read when the panel is hosted, which is after the fixture is open and the demo has started,
    // so the panel's first document is already the roll-up. That matters past the first frame: the
    // gallery writes its DOM mirror from the semantics the panel has at mount, so a control that
    // only appears on the first sync is a control a keyboard never reaches.
    get init(): RollupDoc {
      const rollup = currentRollup();
      return rollup === undefined ? emptyRollupDoc : rollupDoc(rollup, drilledDocument());
    },
    update: (doc: RollupDoc, intent: RollupIntent): RollupDoc => ({
      ...doc,
      chosen: intent.index,
      requests: doc.requests + 1,
    }),
    view: rollupView,
  },
  sync: (_session: Session, doc: RollupDoc): RollupDoc => {
    const rollup = currentRollup();
    return rollup === undefined
      ? { ...emptyRollupDoc, requests: doc.requests, chosen: doc.chosen }
      : { ...rollupDoc(rollup, drilledDocument()), requests: doc.requests, chosen: doc.chosen };
  },
  onCommit: (doc: RollupDoc, previous: RollupDoc, session: Session): void => {
    const rollup = currentRollup();
    if (doc.requests === previous.requests || rollup === undefined) return;
    drillIntoDocument(session, rollup, doc.chosen);
  },
});

// A card for every building of the estate, in the order the estate lists them, and the roll-up
// panel the source fixture uses. Both are always hosted and each shows nothing on the other's
// fixture: `demo.panels` is read once, before any model is open, so which fixture was chosen cannot
// be known here.
export const portfolioPanels = (index: PortfolioIndex): readonly AnyHudPanel[] => [
  ...index.input.buildings.map((building) => buildingCardPanel(index, building.buildingId)),
  rollupPanel,
];

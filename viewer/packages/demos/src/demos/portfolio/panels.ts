// One card per building, hanging over the top of its mass, carrying the figure the workflow could
// attribute to it and the outcome it was coloured by. Clicking a card drills into that building;
// clicking it again goes back to the whole estate.
//
// The cards are built from Gratify's own `Stack`, `Row` and `Label` because Track UG's `Card` and
// `Chip` widgets have not landed; CHECKPOINT-D4.md records the swap. The outcome colour is the
// features package's fixed analytical palette, never a theme token, so changing theme or text size
// does not change what a colour means.

import { outcomeColor, setsSlice } from '@bim-open-toolkit/features';
import type { Color, ObjectKey, Session, Vec3 } from '@bim-open-toolkit/model';
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
      point: (session: Session): Vec3 | undefined => {
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

// A card for every building of the estate, in the order the estate lists them.
export const portfolioPanels = (index: PortfolioIndex): readonly AnyHudPanel[] =>
  index.input.buildings.map((building) => buildingCardPanel(index, building.buildingId));

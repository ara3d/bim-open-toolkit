// What the sidebar shows: what is on the screen, how fast it is drawing, and what a bulk change
// cost.
//
// Everything here comes out of a slice. The heads-up display's own reading is the only record of
// frame timing a session holds; when nothing is sampling it, the rows say so rather than showing
// zeros. Two numbers the demo is named for — how many instance rows a bulk write touched, and what
// publishing them cost — are measured by the render hooks and then discarded, so they are reported
// as missing with that reason. The requests are in CHECKPOINT-D2.md.

import { appearanceSlice, hudSlice, layoutsSlice } from '@bim-open-toolkit/features';
import type { Session } from '@bim-open-toolkit/model';
import {
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyRow,
  type PropertySheet,
} from '@bim-open-toolkit/ui-gratify';
import { recolourRuleId } from './bulk.js';
import { openedChoice, stressCounts, stressTitles } from './scene.js';

// Why a frame-timing row is empty when it is.
const noReading = 'nothing is sampling the heads-up display in this session';

const sceneRows = (session: Session): readonly PropertyRow[] => {
  const reading = session.read(hudSlice).reading;
  const choice = openedChoice();
  const asked =
    choice === undefined
      ? propertyRow('asked', 'Instances asked for', missingValue('no fixture has been opened'))
      : propertyRow('asked', 'Instances asked for', knownNumber(stressCounts[choice], undefined, 0));
  if (reading === undefined)
    return [
      asked,
      propertyRow('drawn', 'Instances drawn', missingValue(noReading)),
      propertyRow('triangles', 'Triangles drawn', missingValue(noReading)),
    ];
  const { scene } = reading.data;
  return [
    asked,
    propertyRow('objects', 'Source objects', knownNumber(scene.sourceObjects, undefined, 0)),
    propertyRow('groups', 'Draw groups', knownNumber(scene.groups, undefined, 0)),
    propertyRow('drawn', 'Instances drawn', knownNumber(scene.renderedInstances, undefined, 0)),
    propertyRow('visible', 'Instances visible', knownNumber(scene.visibleInstances, undefined, 0)),
    propertyRow('triangles', 'Triangles drawn', knownNumber(scene.renderedTriangles, undefined, 0)),
  ];
};

const timingRows = (session: Session): readonly PropertyRow[] => {
  const reading = session.read(hudSlice).reading;
  if (reading === undefined)
    return [
      propertyRow('frames', 'Frames measured', missingValue(noReading)),
      propertyRow('median', 'Median frame', missingValue(noReading)),
      propertyRow('p95', '95th percentile', missingValue(noReading)),
      propertyRow('gpu', 'GPU time', missingValue(noReading)),
    ];
  const { frames, framesPerSecond, withinBudget, gpu } = reading.data;
  return [
    propertyRow('frames', 'Frames measured', knownNumber(frames.count, undefined, 0)),
    propertyRow('median', 'Median frame', knownNumber(frames.medianMs, 'ms', 1)),
    propertyRow('p95', '95th percentile', knownNumber(frames.p95Ms, 'ms', 1)),
    propertyRow('slowest', 'Slowest frame', knownNumber(frames.maxMs, 'ms', 1)),
    propertyRow('fps', 'Frames a second', knownNumber(framesPerSecond, undefined, 1)),
    propertyRow('budget', 'Within 30 a second', knownValue(withinBudget ? 'yes' : 'no')),
    propertyRow(
      'gpu',
      'GPU time',
      gpu.state === 'available' ? knownNumber(gpu.stats.medianMs, 'ms', 2) : missingValue(gpu.reason),
    ),
  ];
};

const bulkRows = (session: Session): readonly PropertyRow[] => {
  const rule = session.read(appearanceSlice).rules.find((each) => each.id === recolourRuleId);
  const { layout } = session.read(layoutsSlice);
  return [
    propertyRow(
      'named',
      'Objects the colouring names',
      rule === undefined
        ? missingValue('nothing has been recoloured yet')
        : knownNumber(rule.targets.length, undefined, 0),
    ),
    propertyRow(
      'rows',
      'Instance rows written',
      missingValue('the appearance and layout hooks count the rows they write and do not record it'),
    ),
    propertyRow(
      'publish',
      'Publish cost',
      missingValue('render reports what a publish touched to its caller, and no slice keeps it'),
    ),
    propertyRow('layout', 'Layout in force', knownValue(layout.kind)),
  ];
};

// The stress sheet: what is drawn, how fast, and what the last bulk change was.
export const stressSheet = (session: Session): PropertySheet => {
  const choice = openedChoice();
  return propertySheet(
    'Ten thousand',
    [
      propertyGroup('scene', 'What is drawn', sceneRows(session)),
      propertyGroup('timing', 'Frame timing', timingRows(session)),
      propertyGroup('bulk', 'The last bulk change', bulkRows(session)),
    ],
    choice === undefined ? 'No fixture opened yet.' : stressTitles[choice],
  );
};

import {
  setKeys,
  type AppearanceChange,
  type CoordinateContext,
  type ModelRef,
  type NamedSet,
  type Projection,
  type Registration,
  type SavedView,
  type StyleRule,
  type ViewState,
} from '@bim-open-toolkit/model';
import { resultRecord, type ResultRecord } from './values.js';

// A model revision as a plain record, which is what an open-model command input carries.
export const modelRecord = (model: ModelRef): ResultRecord =>
  resultRecord({ id: model.id, revision: model.revision, source: model.source });

// An appearance change as a plain record.
export const appearanceChangeRecord = (change: AppearanceChange): ResultRecord =>
  resultRecord({ color: change.color, opacity: change.opacity, visible: change.visible, extras: change.extras });

// A style rule as a plain record.
export const styleRuleRecord = (rule: StyleRule): ResultRecord => ({
  id: rule.id,
  name: rule.name,
  enabled: rule.enabled,
  priority: rule.priority,
  targets: rule.targets,
  change: appearanceChangeRecord(rule.change),
});

// A named object set as a plain record, with its members listed as object keys.
export const namedSetRecord = (set: NamedSet): ResultRecord => ({
  id: set.id,
  name: set.name,
  members: setKeys(set.members),
});

const registrationRecord = (registration: Registration): ResultRecord =>
  registration.kind === 'project'
    ? { kind: registration.kind, projectId: registration.projectId }
    : registration.kind === 'geographic'
      ? { kind: registration.kind, anchor: { ...registration.anchor } }
      : { kind: registration.kind };

// A coordinate frame as a plain record: units, up axis and how the frame is registered.
export const coordinateRecord = (context: CoordinateContext): ResultRecord => ({
  units: context.units,
  up: context.up,
  registration: registrationRecord(context.registration),
});

const projectionRecord = (projection: Projection): ResultRecord =>
  projection.kind === 'perspective'
    ? {
        kind: projection.kind,
        fieldOfViewDegrees: projection.fieldOfViewDegrees,
        near: projection.near,
        far: projection.far,
      }
    : { kind: projection.kind, height: projection.height, near: projection.near, far: projection.far };

// A view state as a plain record: camera pose, projection and the frame they are reported in.
export const viewStateRecord = (view: ViewState): ResultRecord => ({
  camera: { position: view.camera.position, target: view.camera.target, up: view.camera.up },
  projection: projectionRecord(view.projection),
  coordinates: coordinateRecord(view.coordinates),
});

// A saved view as a plain record, holding only data a document can carry.
export const savedViewRecord = (view: SavedView): ResultRecord =>
  resultRecord({
    id: view.id,
    name: view.name,
    view: viewStateRecord(view.view),
    selection: view.selection,
    rules: view.rules.map(styleRuleRecord),
    filter: view.filter,
    savedAt: view.savedAt,
  });

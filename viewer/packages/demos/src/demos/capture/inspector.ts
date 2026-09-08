// What the sidebar shows about the last picture: how big it is, how many bytes it took, and what
// the scene document does not record about it.
//
// The capture slice keeps the image, its size and its format. It does not keep how long the capture
// took, so this sheet says so rather than printing a number it did not measure. The request is in
// CHECKPOINT-D2.md.

import { captureSlice, hudSlice } from '@bim-open-toolkit/features';
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
  type PropertyValue,
} from '@bim-open-toolkit/ui-gratify';
import { captureSizeTitles, dataUrlBytes, lastCapture, sizeOfRecord } from './request.js';

const flagValue = (on: boolean): PropertyValue => ({ kind: 'flag', text: on ? 'yes' : 'no', state: 'known' });

// The rows describing a picture that was taken, or the one row saying none has been.
const pictureRows = (session: Session): readonly PropertyRow[] => {
  const record = lastCapture(session.read(captureSlice));
  if (record === undefined)
    return [propertyRow('picture', 'Last picture', missingValue('no picture has been taken in this session'))];
  const size = sizeOfRecord(record);
  return [
    propertyRow('size', 'Size', knownValue(size === undefined ? 'a size this demo does not offer' : captureSizeTitles[size])),
    propertyRow('width', 'Width', knownNumber(record.width, 'px', 0)),
    propertyRow('height', 'Height', knownNumber(record.height, 'px', 0)),
    propertyRow('bytes', 'Bytes', knownNumber(dataUrlBytes(record.dataUrl), 'B', 0)),
    propertyRow('format', 'Format', knownValue(record.format)),
    propertyRow(
      'elapsed',
      'Time to take',
      missingValue('the capture slice records the picture, not how long it took'),
    ),
  ];
};

// The capture sheet: the picture, and what was showing when it was taken.
export const captureSheet = (session: Session): PropertySheet => {
  const hud = session.read(hudSlice);
  return propertySheet(
    'Capture',
    [
      propertyGroup('picture', 'Last picture', pictureRows(session)),
      propertyGroup('shown', 'What is in the frame', [
        propertyRow('hud', 'Heads-up display', flagValue(hud.visible)),
        propertyRow(
          'panels',
          'Panels',
          missingValue('a capture is of the model only; the panels are drawn on their own canvases'),
        ),
      ]),
    ],
    'A picture of the model at a stated size, stored in the scene document.',
  );
};

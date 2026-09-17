// What became of the opening picture, kept where the pure functions can read it.
//
// `ready`, `report` and the inspector sheet are handed a `Session` and nothing else, and a capture
// that failed writes nothing to the scene document, so the reason a picture is missing has nowhere
// in the session to live. It is held beside the session instead - written once by `start`, cleared
// when the demo is disposed - so a demo that could not draw says why rather than looking as though
// nobody asked it to.

import { held } from '../_workflows/held.js';

const outcome = held<string>();

// The words for a picture that was taken, written down once so the report and the sheet agree.
export const takenNote = 'taken';

// What is said before `start` has run, and after the demo has been disposed.
export const notAskedNote = 'no picture has been asked for';

// Records what became of the opening picture: `takenNote`, or the reason there is none.
export const recordOpening = (note: string): void => {
  outcome.set(note);
};

// Forgets it, so a second run never reads the first one's reason.
export const forgetOpening = (): void => {
  outcome.clear();
};

// What became of the opening picture, in the words a report prints and the sheet shows.
export const openingNote = (): string => outcome.get() ?? notAskedNote;

// Capture: an image of the view, and thumbnails for saved views.
//
// Drawing and encoding belong to render's `CaptureTarget`, which already handles the ordering that
// makes a capture work at all: draw immediately before encoding, put the view back the size it was,
// and report a failure rather than returning an image nobody can explain. This feature adds the
// part a document needs — where a thumbnail is kept and which view it belongs to — and the command
// that lets a script, a report or an assistant ask for one.
//
// Encoding is asynchronous and a command is not, so `capture.image` returns the pending image in
// its result rather than pretending to have finished. When it is asked for a thumbnail it stores
// the finished image by dispatching itself in its `store` form, so the slice is still only ever
// written by a command.

import {
  array,
  command,
  diagnostic,
  enumeration,
  failure,
  feature,
  literal,
  map,
  number,
  object,
  optional,
  record,
  stateSlice,
  string,
  success,
  union,
  type Command,
  type Feature,
  type Migration,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';
import {
  captureImage,
  pngFormat,
  thumbnailSize,
  type CaptureFormat,
  type CaptureImage,
  type CaptureOptions,
  type CaptureTarget,
} from '@bim-open-toolkit/render';

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Bytes as base64 text. Written out rather than taken from the platform because `btoa` is a browser
// function and `Buffer` is a Node one, and a feature module should need neither.
export const toBase64 = (bytes: Uint8Array): string => {
  let text = '';
  for (let at = 0; at < bytes.length; at += 3) {
    const first = bytes[at] ?? 0;
    const second = bytes[at + 1];
    const third = bytes[at + 2];
    const triple = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    text += base64Alphabet.charAt((triple >> 18) & 63);
    text += base64Alphabet.charAt((triple >> 12) & 63);
    text += second === undefined ? '=' : base64Alphabet.charAt((triple >> 6) & 63);
    text += third === undefined ? '=' : base64Alphabet.charAt(triple & 63);
  }
  return text;
};

// An image, as a document holds it: a data URL and the size it was drawn at.
export type CaptureRecord = {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly format: CaptureFormat;
};

// A captured image as a record.
export const captureRecord = (image: CaptureImage): CaptureRecord => ({
  dataUrl: `data:${image.format};base64,${toBase64(image.bytes)}`,
  width: image.width,
  height: image.height,
  format: image.format,
});

// The thumbnails that have been taken, by the key of the view each one shows.
export type CaptureState = {
  readonly thumbnails: Readonly<Record<string, CaptureRecord>>;
};

// The only format there is, so a stored record states it rather than leaving it to be guessed.
export const captureFormatSchema: Schema<CaptureFormat> = enumeration([pngFormat] as const);

// One stored image.
export const captureRecordSchema: Schema<CaptureRecord> = object({
  dataUrl: string(),
  width: number(),
  height: number(),
  format: captureFormatSchema,
});

// The whole slice.
export const captureSchema: Schema<CaptureState> = object({ thumbnails: record(captureRecordSchema) });

// No thumbnails.
export const noCaptures: CaptureState = { thumbnails: {} };

// Version 1 has no earlier versions to read; a later version adds its step here.
export const captureMigrations: readonly Migration[] = [];

// The slice the capture feature owns.
export const captureSlice: StateSlice<CaptureState> = stateSlice(
  'capture',
  1,
  captureSchema,
  noCaptures,
  captureMigrations,
);

// The thumbnail of a saved view, or undefined when none has been taken.
export const thumbnailOf = (state: CaptureState, key: string): CaptureRecord | undefined => state.thumbnails[key];

// The keys that have a thumbnail, in a stable order.
export const thumbnailKeys = (state: CaptureState): readonly string[] => Object.keys(state.thumbnails).sort();

// Ask for an image. `maxEdge` makes a thumbnail of that longest edge instead of a full-size image;
// `viewId`, or `name` as a workflow recipe writes it, says which saved view the image is of and
// stores it as that view's thumbnail once it has been encoded.
export type CaptureRequest = {
  readonly kind?: 'render' | undefined;
  readonly viewId?: string | undefined;
  readonly name?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly maxEdge?: number | undefined;
  readonly format?: CaptureFormat | undefined;
};

// Store an image somebody else already encoded, which is also how a finished capture stores itself.
export type CaptureStoreInput = {
  readonly kind: 'store';
  readonly viewId: string;
  readonly image: CaptureRecord;
};

// What `capture.image` accepts.
export type CaptureInput = CaptureStoreInput | CaptureRequest;

const storeInputSchema: Schema<CaptureInput> = object({
  kind: literal('store'),
  viewId: string(),
  image: captureRecordSchema,
});

const requestInputSchema: Schema<CaptureInput> = object({
  kind: optional(literal('render')),
  viewId: optional(string()),
  name: optional(string()),
  width: optional(number()),
  height: optional(number()),
  maxEdge: optional(number()),
  format: optional(captureFormatSchema),
});

// A request, or a finished image to store. The store form is tried first because it is the specific
// one; a request that misspells it is refused rather than quietly treated as a render.
export const captureInputSchema: Schema<CaptureInput> = union<CaptureInput>(storeInputSchema, requestInputSchema);

// An image being drawn and encoded. `key` is the saved view it will be stored under, when it is
// going to be stored at all.
//
// The promise is in the result because encoding cannot be synchronous and a command cannot wait: a
// command that returned a finished image would have to block, and one that returned nothing would
// leave the caller with no way to know it worked.
export type PendingCapture = {
  readonly key?: string | undefined;
  readonly image: Promise<Result<CaptureImage>>;
};

// True when a value is a pending capture. A caller holding a `Result<unknown>` from the command bus
// needs this to wait for the image; it is a check, not a claim, and every property is inspected.
export const isPendingCapture = (value: unknown): value is PendingCapture =>
  typeof value === 'object' &&
  value !== null &&
  'image' in value &&
  typeof value.image === 'object' &&
  value.image !== null &&
  'then' in value.image &&
  typeof value.image.then === 'function';

// The pending image a `capture.image` result carries, or undefined when it carries something else.
export const pendingCapture = (result: Result<unknown>): PendingCapture | undefined =>
  result.ok && isPendingCapture(result.value) ? result.value : undefined;

// The name of the command that takes and stores an image. A finished capture dispatches it again
// in its `store` form, so this is written down once.
export const captureImageCommand = 'capture.image';

// The size to draw at: a thumbnail edge when one was asked for, otherwise whatever was named.
const wantedOptions = (target: CaptureTarget, input: CaptureRequest): Result<CaptureOptions> =>
  input.maxEdge === undefined
    ? success({ width: input.width, height: input.height, format: input.format })
    : map(thumbnailSize(target.size(), input.maxEdge), (size) => ({
        width: size.width,
        height: size.height,
        format: input.format,
      }));

// Draws and encodes an image, or stores one that was already encoded.
const imageCommand = (target?: CaptureTarget): Command =>
  command({
    name: captureImageCommand,
    title: 'Capture image',
    description: 'Draws the view and encodes it, optionally as the thumbnail of a saved view.',
    input: captureInputSchema,
    run: (session: Session, input) => {
      if (input.kind === 'store') {
        const state = session.read(captureSlice);
        session.write(captureSlice, {
          ...state,
          thumbnails: { ...state.thumbnails, [input.viewId]: input.image },
        });
        return success(input.image);
      }
      if (target === undefined)
        return failure([diagnostic('capture/no-target', 'There is nothing to capture: no capture target is installed.')]);
      const wanted = wantedOptions(target, input);
      if (!wanted.ok) return failure(wanted.diagnostics);
      const key = input.viewId ?? input.name;
      const image = captureImage(target, wanted.value)
        .catch((cause: unknown) =>
          failure<CaptureImage>([
            diagnostic('capture/failed', `The capture could not be taken: ${cause instanceof Error ? cause.message : 'no reason given'}.`),
          ]),
        )
        .then((taken) => {
          if (taken.ok && key !== undefined)
            session.dispatch(captureImageCommand, { kind: 'store', viewId: key, image: captureRecord(taken.value) });
          return taken;
        });
      const pending: PendingCapture = { key, image };
      return success(pending, wanted.diagnostics);
    },
  });

// Removes the thumbnails of the named views, or all of them.
const forgetCommand: Command = command({
  name: 'capture.forget',
  title: 'Forget thumbnails',
  description: 'Removes stored thumbnails by view key, or every one of them.',
  input: object({ keys: optional(array(string())) }),
  run: (session: Session, input) => {
    const state = session.read(captureSlice);
    const forgotten = input.keys;
    if (forgotten === undefined) {
      session.write(captureSlice, noCaptures);
      return success(noCaptures);
    }
    const kept = Object.entries(state.thumbnails).filter(([key]) => !forgotten.includes(key));
    const next: CaptureState = { thumbnails: Object.fromEntries(kept) };
    session.write(captureSlice, next);
    return success(next);
  },
});

// The commands the capture feature registers, in the order a registry lists them.
export const captureCommands = (target?: CaptureTarget): readonly Command[] => [imageCommand(target), forgetCommand];

// Screenshots and thumbnails through a renderer's capture target.
export const captureFeatureWith = (target: CaptureTarget): Feature<CaptureState> =>
  feature('capture', captureSlice, captureCommands(target));

// Thumbnails with no renderer attached: images somebody else encoded can still be stored, and a
// request to draw one is refused rather than answered with a blank picture.
export const captureFeature: Feature<CaptureState> = feature('capture', captureSlice, captureCommands());

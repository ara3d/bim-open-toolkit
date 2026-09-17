// The real `Session`: a slice store, a command bus over it, and change events.
//
// M1 states the contract - read a slice, write a slice, dispatch a command, subscribe - and
// `model/test/session-fixture.ts` is the forty-line version the model's own tests drive. This is
// the same contract with the parts a running viewer needs: a slice registry persistence can walk,
// commands that come and go with features, one event per commit rather than one per nested
// dispatch, and disposal that leaves no listener behind.
//
// Two decisions are worth stating.
//
// **A read validates.** A stored value is `unknown` - it may have come from a document written by
// an older version - and the only honest way back to `S` is the slice's own schema. A slice whose
// stored value does not check reads as its default and records a diagnostic, rather than handing a
// feature a shape it cannot use. This costs a schema walk per read, so a feature reading a large
// slice every frame should keep the value it was given and subscribe to changes instead.
//
// **A commit is the outermost dispatch.** A command that dispatches another is one commit: the
// event names every slice that changed across the whole run, once, with the outer command's name.
// Subscribers therefore never see a half-applied command, and a render bridge redraws once.

import {
  changeEvent,
  changedSlices,
  diagnostic,
  disposable,
  failure,
  success,
  type Command,
  type Diagnostic,
  type Disposable,
  type Listener,
  type Result,
  type Session,
  type SliceRegistry,
  type StateSlice,
} from '@bim-open-toolkit/model';
import { commandBus, type CommandBus } from './command-bus.js';

// The command name an event carries when a slice was written outside any command.
export const directWrite = 'viewer/write';

// What a session offers beyond M1's four methods: the registry persistence walks, the bus features
// add to, the diagnostics nothing else could report, and disposal.
export type ViewerSession = Session & {
  readonly commands: CommandBus;
  // Every slice this session knows about, which is exactly what a saved document holds.
  readonly sliceRegistry: () => SliceRegistry;
  // Declares slices. A second slice with an id already taken is refused and nothing is added.
  readonly register: (slices: readonly StateSlice<unknown>[]) => Result<readonly string[]>;
  // Drops slices and their stored values. Returns the ids that were actually there.
  readonly forget: (ids: readonly string[]) => readonly string[];
  // The stored values by slice id, unvalidated, for persistence and for tests.
  readonly stored: () => ReadonlyMap<string, unknown>;
  // What the session observed that no return value could carry: a write after disposal, a stored
  // value that no longer checks, a slice id claimed twice.
  readonly diagnostics: () => readonly Diagnostic[];
  readonly disposed: () => boolean;
  // Drops every listener and refuses further commands. Slices and their values are left alone, so
  // a disposed session can still be saved.
  readonly dispose: () => void;
};

// How a session starts: the slices it knows and the commands it can run.
export type SessionOptions = {
  readonly slices?: readonly StateSlice<unknown>[] | undefined;
  readonly commands?: readonly Command[] | undefined;
};

// A session over the given slices and commands, each slice starting at its default.
export const createSession = (options: SessionOptions = {}): Result<ViewerSession> => {
  const bus = commandBus(options.commands ?? []);
  if (!bus.ok) return failure(bus.diagnostics);

  const slices = new Map<string, StateSlice<unknown>>();
  const values = new Map<string, unknown>();
  const listeners = new Set<Listener>();
  const observed: Diagnostic[] = [];
  let closed = false;

  // Depth of nested dispatches, and what changed since the outermost one started.
  let depth = 0;
  let before: ReadonlyMap<string, unknown> = new Map();
  let rootCommand = '';

  // Reading and writing never register: the document is the composition of the slices something
  // declared, so a value written by a slice nobody registered is held but never saved. What a read
  // or a write can still see is a second slice object claiming an id that is already taken, which
  // no return value could report.
  const noteConflict = (slice: StateSlice<unknown>): void => {
    const held = slices.get(slice.id);
    if (held !== undefined && held !== slice)
      observed.push(
        diagnostic('viewer/repeated-slice', `Two different slices claim the id ${slice.id}`, ['slices', slice.id]),
      );
  };

  const publish = (command: string, changed: readonly string[], diagnostics: readonly Diagnostic[]): void => {
    if (changed.length === 0 && diagnostics.length === 0) return;
    const event = changeEvent(command, changed, diagnostics);
    for (const listener of [...listeners]) if (listeners.has(listener)) listener(event);
  };

  const read = <S>(slice: StateSlice<S>): S => {
    noteConflict(slice);
    if (!values.has(slice.id)) return slice.default;
    const checked = slice.schema.check(values.get(slice.id), ['slices', slice.id]);
    if (checked.ok) return checked.value;
    observed.push(...checked.diagnostics);
    return slice.default;
  };

  const write = <S>(slice: StateSlice<S>, value: S): void => {
    noteConflict(slice);
    if (closed) {
      observed.push(
        diagnostic('viewer/disposed', `Slice ${slice.id} was written after the session was disposed`, [
          'slices',
          slice.id,
        ]),
      );
      return;
    }
    const had = values.get(slice.id);
    values.set(slice.id, value);
    if (depth > 0 || had === value) return;
    publish(directWrite, [slice.id], []);
  };

  const dispatch = (name: string, input: unknown): Result<unknown> => {
    if (closed)
      return failure([
        diagnostic('viewer/disposed', `Command ${name} was dispatched after the session was disposed`, ['name']),
      ]);
    if (depth === 0) {
      before = new Map(values);
      rootCommand = name;
    }
    depth++;
    let result: Result<unknown>;
    try {
      result = bus.value.run(session, name, input);
    } finally {
      depth--;
    }
    if (depth === 0) publish(rootCommand, changedSlices(before, values), result.diagnostics);
    return result;
  };

  const subscribe = (listener: Listener): Disposable => {
    listeners.add(listener);
    return disposable(() => {
      listeners.delete(listener);
    });
  };

  const register = (added: readonly StateSlice<unknown>[]): Result<readonly string[]> => {
    const clashes = added
      .filter((slice) => {
        const held = slices.get(slice.id);
        return held !== undefined && held !== slice;
      })
      .map((slice) => diagnostic('viewer/repeated-slice', `Slice ${slice.id} is already registered`, ['id']));
    if (clashes.length > 0) return failure(clashes);
    for (const slice of added) slices.set(slice.id, slice);
    return success(added.map((slice) => slice.id));
  };

  const session: ViewerSession = {
    read,
    write,
    dispatch,
    subscribe,
    commands: bus.value,
    sliceRegistry: () => slices,
    register,
    forget: (ids) =>
      ids.filter((id) => {
        values.delete(id);
        return slices.delete(id);
      }),
    stored: () => values,
    diagnostics: () => observed,
    disposed: () => closed,
    dispose: () => {
      if (closed) return;
      closed = true;
      listeners.clear();
    },
  };

  const declared = register(options.slices ?? []);
  if (!declared.ok) return failure(declared.diagnostics);
  return success(session);
};

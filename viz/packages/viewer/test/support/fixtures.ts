// Small features, slices and commands the headless tests compose. Nothing here draws or loads.

import {
  command,
  feature,
  integer,
  object,
  stateSlice,
  string,
  success,
  type AnyFeature,
  type Command,
  type Result,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';

// A counter slice: the smallest thing a feature can own.
export const counterSlice = stateSlice('test.counter', 1, object({ count: integer() }), { count: 0 });

// A note slice, so a document has more than one thing in it.
export const noteSlice = stateSlice('test.note', 1, object({ text: string() }), { text: '' });

// Adds to the counter. Writing the same value twice is still a write, which is what proves the
// session publishes on a changed object rather than on a call.
export const addCommand: Command = command({
  name: 'test.add',
  title: 'Add',
  description: 'Adds an amount to the counter.',
  input: object({ amount: integer() }),
  run: (session, input) => {
    const held = session.read(counterSlice);
    session.write(counterSlice, { count: held.count + input.amount });
    return success(held.count + input.amount);
  },
});

// Sets the note, and adds one to the counter through a nested dispatch, so one commit covers both.
export const noteCommand: Command = command({
  name: 'test.note',
  title: 'Note',
  description: 'Records a note and bumps the counter through another command.',
  input: object({ text: string() }),
  run: (session, input) => {
    session.write(noteSlice, { text: input.text });
    return session.dispatch('test.add', { amount: 1 });
  },
});

// Reads the counter without writing anything, so a commit with no change can be observed.
export const readCommand: Command = command({
  name: 'test.read',
  title: 'Read',
  description: 'Reads the counter.',
  input: object({}),
  run: (session) => success(session.read(counterSlice).count),
});

export const counterFeature: AnyFeature = feature('test.counter', counterSlice, [addCommand, readCommand]);

// A feature that depends on the counter and records how many times its hook ran and was disposed.
export const noteFeature = (
  log: string[],
  dependsOn: readonly string[] = ['test.counter'],
): AnyFeature =>
  feature('test.note', noteSlice, [noteCommand], dependsOn, (session: Session) => {
    log.push('install test.note');
    const watching = session.subscribe(() => log.push('event test.note'));
    return {
      dispose: () => {
        watching.dispose();
        log.push('dispose test.note');
      },
    };
  });

// A feature whose install hook throws, for the all-or-nothing case. It depends on whatever should
// already have installed when it fails, so the rollback has something to undo.
export const brokenFeature = (slice: StateSlice<unknown>, dependsOn: readonly string[] = []): AnyFeature =>
  feature('test.broken', slice, [], dependsOn, () => {
    throw new Error('no');
  });

// A command that never runs, used only to claim a name.
export const namedCommand = (name: string): Command =>
  command({
    name,
    title: name,
    description: 'Does nothing.',
    input: object({}),
    run: (): Result<unknown> => success(name),
  });

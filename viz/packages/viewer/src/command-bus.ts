// The command bus: M1's immutable `CommandRegistry` with commands added and removed over time.
//
// A registry is a plain map built once by `commandRegistry`, which is what a feature host needs
// after every install. The bus keeps the current set, rebuilds the registry through the model
// package so repeated names are refused by the same code that always refused them, and exposes
// `run` and `describe` over it. Nothing here holds state a command can see.

import {
  commandRegistry,
  describeCommands,
  diagnostic,
  failure,
  runCommand,
  success,
  type Command,
  type CommandDescriptor,
  type CommandRegistry,
  type Diagnostic,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';

// A registry that changes: features add their commands when they install and take them away when
// they are disposed.
export type CommandBus = {
  // Adds commands. A name already on the bus is refused and nothing is added, so a failed install
  // leaves the bus exactly as it was.
  readonly add: (commands: readonly Command[]) => Result<readonly string[]>;
  // Removes commands by name. Returns the names that were actually there.
  readonly remove: (names: readonly string[]) => readonly string[];
  // The registry as it stands, for `runCommand` and for a generated tool list.
  readonly registry: () => CommandRegistry;
  readonly has: (name: string) => boolean;
  readonly names: () => readonly string[];
  // Every command as a descriptor: name, title, description and input schema.
  readonly describe: () => readonly CommandDescriptor[];
  readonly describeOne: (name: string) => CommandDescriptor | undefined;
  // Runs one command against a session. An unknown name is a diagnostic, never an exception.
  readonly run: (session: Session, name: string, input: unknown) => Result<unknown>;
};

const repeated = (name: string): Diagnostic =>
  diagnostic('viewer/repeated-command', `Command ${name} is already registered`, ['name']);

// A bus over the given commands. Repeated names in the initial list are reported by the model
// package's own registry check, and the bus starts empty when they are.
export const commandBus = (commands: readonly Command[] = []): Result<CommandBus> => {
  const built = commandRegistry(commands);
  if (!built.ok) return failure(built.diagnostics);
  const held = new Map<string, Command>(built.value);
  let registry: CommandRegistry = built.value;

  const rebuild = (): Result<CommandRegistry> => commandRegistry([...held.values()]);

  const add = (added: readonly Command[]): Result<readonly string[]> => {
    const clashes = added.filter((one) => held.has(one.name)).map((one) => repeated(one.name));
    if (clashes.length > 0) return failure(clashes);
    const next = commandRegistry([...held.values(), ...added]);
    if (!next.ok) return failure(next.diagnostics);
    for (const one of added) held.set(one.name, one);
    registry = next.value;
    return success(added.map((one) => one.name));
  };

  const remove = (names: readonly string[]): readonly string[] => {
    const gone = names.filter((name) => held.delete(name));
    if (gone.length === 0) return gone;
    const next = rebuild();
    if (next.ok) registry = next.value;
    return gone;
  };

  return success({
    add,
    remove,
    registry: () => registry,
    has: (name) => held.has(name),
    names: () => [...held.keys()],
    describe: () => describeCommands(registry),
    describeOne: (name) => {
      const found = registry.get(name);
      return found === undefined ? undefined : describeCommands(new Map([[name, found]]))[0];
    },
    run: (session, name, input) => runCommand(registry, session, name, input),
  });
};

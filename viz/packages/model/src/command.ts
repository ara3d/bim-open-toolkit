import { diagnostic, failure, flatMap, type Result } from './result.js';
import { parse, type JsonSchema, type Schema } from './schema.js';
import type { Session } from './session.js';

// A named change with a checked input. Commands are the only way state changes, so every caller —
// a button, a keyboard binding, a script or an assistant — goes through the same door.
// `run` takes an unchecked input and validates it, so a registry can hold commands of any input type.
export type Command = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly describeInput: () => JsonSchema;
  readonly run: (session: Session, input: unknown) => Result<unknown>;
};

// What one command is named and what it takes, as plain data an MCP tool descriptor is built from.
export type CommandDescriptor = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
};

// The commands a session knows, by name.
export type CommandRegistry = ReadonlyMap<string, Command>;

// A command whose `run` receives an input already checked against its schema.
export const command = <I>(spec: {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: Schema<I>;
  readonly run: (session: Session, input: I) => Result<unknown>;
}): Command => ({
  name: spec.name,
  title: spec.title,
  description: spec.description,
  describeInput: () => spec.input.describe(),
  run: (session, input) => flatMap(parse(spec.input, input), (checked) => spec.run(session, checked)),
});

// What the command is called and what it takes, for generated tools and documentation.
export const describeCommand = (item: Command): CommandDescriptor => ({
  name: item.name,
  title: item.title,
  description: item.description,
  inputSchema: item.describeInput(),
});

// The commands by name. Two commands of the same name is an error, not a silent replacement.
export const commandRegistry = (commands: readonly Command[]): Result<CommandRegistry> => {
  const duplicates = commands
    .map((item) => item.name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  return duplicates.length === 0
    ? { ok: true, value: new Map(commands.map((item) => [item.name, item])), diagnostics: [] }
    : failure([
        diagnostic('command/duplicate', `More than one command is named ${[...new Set(duplicates)].join(', ')}.`),
      ]);
};

// Runs the named command, or reports that there is no such command.
export const runCommand = (
  registry: CommandRegistry,
  session: Session,
  name: string,
  input: unknown,
): Result<unknown> => {
  const found = registry.get(name);
  return found === undefined
    ? failure([diagnostic('command/unknown', `There is no command named "${name}".`)])
    : found.run(session, input);
};

// What every command in the registry is called and takes, in registration order.
export const describeCommands = (registry: CommandRegistry): readonly CommandDescriptor[] =>
  [...registry.values()].map(describeCommand);

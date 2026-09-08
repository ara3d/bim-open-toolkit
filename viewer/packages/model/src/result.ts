// Severity of a diagnostic. Only `error` makes a result a failure.
export type Severity = 'error' | 'warning' | 'info';

// Address of a value inside a larger structure: property names and array indices from the root.
export type DiagnosticPath = readonly (string | number)[];

// One machine-readable problem or note about a value, addressed at a path.
export type Diagnostic = {
  readonly code: string;
  readonly message: string;
  readonly path: DiagnosticPath;
  readonly severity: Severity;
};

// A value together with the diagnostics gathered while producing it, or a failure with no value.
export type Result<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

// The path of the value a result was computed from.
export const rootPath: DiagnosticPath = [];

// Builds a diagnostic; severity defaults to `error` and the path to the root.
export const diagnostic = (
  code: string,
  message: string,
  path: DiagnosticPath = rootPath,
  severity: Severity = 'error',
): Diagnostic => ({ code, message, path, severity });

// A diagnostic that does not invalidate its result.
export const warning = (code: string, message: string, path: DiagnosticPath = rootPath): Diagnostic =>
  diagnostic(code, message, path, 'warning');

// A diagnostic that records a fact about a result without judging it.
export const note = (code: string, message: string, path: DiagnosticPath = rootPath): Diagnostic =>
  diagnostic(code, message, path, 'info');

// A successful result, optionally carrying non-fatal diagnostics.
export const success = <T>(value: T, diagnostics: readonly Diagnostic[] = []): Result<T> => ({
  ok: true,
  value,
  diagnostics,
});

// A failed result. At least one diagnostic should explain why.
export const failure = <T>(diagnostics: readonly Diagnostic[]): Result<T> => ({ ok: false, diagnostics });

// True when the diagnostic is an error.
export const isError = (item: Diagnostic): boolean => item.severity === 'error';

// True when any diagnostic in the list is an error.
export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some(isError);

// Fails when any diagnostic is an error, otherwise succeeds with the value.
export const resultOf = <T>(value: T, diagnostics: readonly Diagnostic[]): Result<T> =>
  hasErrors(diagnostics) ? failure(diagnostics) : success(value, diagnostics);

// Applies a function to a successful value, keeping the diagnostics.
export const map = <T, U>(result: Result<T>, fn: (value: T) => U): Result<U> =>
  result.ok ? success(fn(result.value), result.diagnostics) : failure(result.diagnostics);

// Chains a result-producing function, concatenating the diagnostics of both steps.
export const flatMap = <T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> => {
  if (!result.ok) return failure(result.diagnostics);
  const next = fn(result.value);
  const diagnostics = [...result.diagnostics, ...next.diagnostics];
  return next.ok ? success(next.value, diagnostics) : failure(diagnostics);
};

// Succeeds with every value only when every result succeeded; keeps all diagnostics either way.
export const all = <T>(results: readonly Result<T>[]): Result<readonly T[]> => {
  const diagnostics = results.flatMap((item) => item.diagnostics);
  const values = results.flatMap((item) => (item.ok ? [item.value] : []));
  return values.length === results.length ? success(values, diagnostics) : failure(diagnostics);
};

// Keeps the values that succeeded and gathers every diagnostic. Never fails.
export const collect = <T>(
  results: readonly Result<T>[],
): { readonly values: readonly T[]; readonly diagnostics: readonly Diagnostic[] } => ({
  values: results.flatMap((item) => (item.ok ? [item.value] : [])),
  diagnostics: results.flatMap((item) => item.diagnostics),
});

// The value of a successful result, or the fallback.
export const valueOr = <T>(result: Result<T>, fallback: T): T => (result.ok ? result.value : fallback);

// Adds diagnostics to a result, failing it when any of them is an error.
export const withDiagnostics = <T>(result: Result<T>, extra: readonly Diagnostic[]): Result<T> => {
  const diagnostics = [...result.diagnostics, ...extra];
  return result.ok ? resultOf(result.value, diagnostics) : failure(diagnostics);
};

// Prefixes every diagnostic path with a segment, for reporting a nested value in its parent.
export const underPath = (diagnostics: readonly Diagnostic[], segment: string | number): readonly Diagnostic[] =>
  diagnostics.map((item) => ({ ...item, path: [segment, ...item.path] }));

// Renders a path as a readable address such as `objects[3].name`.
export const formatPath = (path: DiagnosticPath): string =>
  path.reduce<string>(
    (text, segment) => (typeof segment === 'number' ? `${text}[${segment}]` : text === '' ? segment : `${text}.${segment}`),
    '',
  );

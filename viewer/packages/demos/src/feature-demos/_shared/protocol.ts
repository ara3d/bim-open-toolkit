// What a feature demo page publishes for a browser test, and nothing else: the test reads
// `window.demo`, waits for `ready` or `error`, and evaluates `report()`. Plain values only, so a
// report survives `JSON.stringify` on its way out of the page.

// What a page says about itself: counts, states and readings a test asserts on.
export type DemoReport = Readonly<Record<string, string | number | boolean>>;

// The object a page puts on `window.demo`.
export type DemoWindow = {
  // True once the model is drawn and the controls are wired.
  readonly ready: boolean;
  // Set instead of `ready` when mounting failed, so a test never waits for a page that died.
  readonly error: string | undefined;
  readonly report: () => DemoReport;
  // Runs a page command by name, the way a control would, and returns whether it was accepted.
  readonly act: (name: string, input?: unknown) => boolean;
  // The current frame as PNG bytes; the number is how many bytes, zero when it could not encode.
  readonly capture: () => Promise<number>;
};

declare global {
  interface Window {
    demo?: DemoWindow;
  }
}

// The expression a browser test waits on before reading the page.
export const demoReadyExpression =
  'window.demo !== undefined && (window.demo.ready === true || typeof window.demo.error === "string")';

// The expression a browser test evaluates to read the page back: the error, if any, and the report.
export const demoReportExpression = '({ error: window.demo.error ?? null, report: window.demo.report() })';

// A page that has not mounted yet, or failed to.
export const demoFailed = (error: string): DemoWindow => ({
  ready: false,
  error,
  report: () => ({}),
  act: () => false,
  capture: () => Promise.resolve(0),
});

// The message of a thrown value, for `demoFailed`.
export const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

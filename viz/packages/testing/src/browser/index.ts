// A browser run on playwright-core: one process per call, always closed.

// Whether a browser can be launched here, and which channels are tried.
export {
  browserAvailability,
  defaultChannels,
  type BrowserAvailability,
  type BrowserChannel,
} from './runner.js';

// Running a page: options, what comes back, and the software WebGL flags a headless run needs.
export {
  defaultRunOptions,
  runInBrowser,
  softwareWebGLArgs,
  type BrowserRunOptions,
  type BrowserRunResult,
  type GraphicsInfo,
} from './runner.js';

// A page carried in its own URL, so a test needs no server.
export { dataUrlPage } from './runner.js';

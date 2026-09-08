// The benchmark protocol of the product brief's performance section, as reusable code.

// A camera path as stamped camera states: recorded from a session, or a repeatable generated orbit.
export {
  cameraPath,
  defaultOrbitPathOptions,
  keyAtMs,
  orbitCameraPath,
  pathDurationMs,
  recordCameraPath,
  type CameraKey,
  type CameraPath,
  type CameraPathRecorder,
  type OrbitPathOptions,
} from './camera-path.js';

// Frame times as they happen, and what a viewer saw versus what the measured work cost.
export {
  cpuTimesOf,
  frameReport,
  frameTimeCollector,
  framesPerSecond,
  intervalsOf,
  type FrameReport,
  type FrameTimeCollector,
  type FrameTimeSample,
} from './timings.js';

// Percentiles, the statistics a report states, and the two budgets the brief sets.
export {
  bulkUpdateBudgetMs,
  percentile,
  targetFrameBudgetMs,
  timingStats,
  type TimingStats,
} from './timings.js';

// Load timed phase by phase, memory read honestly, and bulk operations against their budget.
export {
  emptyLoadTiming,
  loadPhases,
  loadTimer,
  megabytes,
  nodeHeapReading,
  operationReport,
  totalLoadMs,
  unavailableReading,
  type LoadPhase,
  type LoadTimer,
  type LoadTiming,
  type MemoryReading,
  type OperationMeasurement,
  type OperationReport,
} from './measurements.js';

// The report: device, browser and method beside the numbers, as markdown and as JSON.
export {
  defaultMethod,
  formatReport,
  nodeDevice,
  sceneInfoOf,
  writeReport,
  type BenchmarkReport,
  type BrowserInfo,
  type DeviceInfo,
  type MethodInfo,
  type SceneInfo,
  type WrittenReport,
} from './report.js';

// The page-side collector, as scripts the browser runner injects.
export {
  defaultFrameProbeOptions,
  frameTimeProbeScript,
  graphicsProbeScript,
  type FrameProbeOptions,
  type FrameProbeResult,
} from './page-script.js';

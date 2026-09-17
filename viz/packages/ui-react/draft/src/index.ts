// Public API of @bim-open-toolkit/ui-react: React bindings for a V2 viewer, and the components the
// door schedule review application is built from.
//
//   const canvas = useRef<HTMLCanvasElement>(null);
//   const { viewer } = useViewer(canvas);
//   return <ViewerProvider viewer={viewer}><ViewerCanvas canvasRef={canvas} /><ObjectTable … /></ViewerProvider>;
//
// Nothing here holds viewer state of its own. Every value a component shows is read from a session
// slice, and every change it makes is a command, so a React control and a script are the same
// caller as far as the viewer is concerned.
export * from './hooks/index.js';
export * from './components/index.js';

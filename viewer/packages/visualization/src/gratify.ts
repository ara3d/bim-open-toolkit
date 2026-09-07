import { CanvasPainter, Focusable, Label, Runtime, Stack, part, v, type AppSpec } from 'gratify';

export type ReviewCommand = 'fit' | 'clearSelection' | 'toggleGhost';
export type ReviewCommands = Readonly<Record<ReviewCommand, () => void>>;
export type ReviewControlState = { readonly revision: number; readonly last: ReviewCommand | null; readonly ghost: boolean };

const ReviewButton = part('review-command')
  .props<{ label: string; command: ReviewCommand }>()
  .size(() => v(256, 36))
  .style((tokens, channels) => ({ fill: tokens.mix(tokens.surface, tokens.accent, 0.2 + 0.3 * channels.hover + 0.3 * channels.press), text: tokens.text, accent: tokens.accent, focus: channels.focus }))
  .render((node, painter, style) => { painter.box(node.rect, 7, style.fill, style.focus > 0.01 ? style.accent : undefined, 2); painter.label(node.props.label, node.rect.center, style.text); })
  .on(Focusable())
  .press(node => node.props.command);

/** Pure MVU state; host commands run only after an actual dispatched commit. */
export function createReviewControlsApp(commands: ReviewCommands): AppSpec<ReviewControlState, ReviewCommand> {
  return {
    init: { revision: 0, last: null, ghost: false },
    update: (state, command) => ({ revision: state.revision + 1, last: command, ghost: command === 'toggleGhost' ? !state.ghost : state.ghost }),
    onCommit: state => { if (state.last) commands[state.last](); },
    view: state => Stack('review-controls', { gap: 10, pad: 16 }, [
      Label('title', { text: 'Review controls', size: 16 }),
      ReviewButton('fit', { label: 'Fit model', command: 'fit' }),
      ReviewButton('clear', { label: 'Clear selection', command: 'clearSelection' }),
      ReviewButton('ghost', { label: state.ghost ? 'Restore opacity' : 'Ghost model', command: 'toggleGhost' }),
    ]),
  };
}

export type ReviewControls = { dispatch(command: ReviewCommand): void; dispose(): void };

/** Genuine Gratify renderer with host-owned input/RAF teardown; fixed 288×196 logical surface. */
export function mountReviewControls(canvas: HTMLCanvasElement, commands: ReviewCommands): ReviewControls {
  if (!canvas.getContext('2d')) throw new Error('Gratify controls require a 2D canvas');
  const original = { width: canvas.width, height: canvas.height, tabIndex: canvas.tabIndex, touchAction: canvas.style.touchAction };
  canvas.width = 288; canvas.height = 196; canvas.tabIndex = 0; canvas.style.touchAction = 'none';
  const runtime = new Runtime(null, createReviewControlsApp(commands), { headless: true, width: canvas.width, height: canvas.height });
  runtime.painter = new CanvasPainter(canvas);
  let frame: number | undefined, disposed = false, activePointer: number | undefined, last = performance.now();
  const tick = (now: number) => {
    frame = undefined; if (disposed) return;
    runtime.step(1, Math.min(0.05, Math.max(0.001, (now - last) / 1000))); last = now;
    if (runtime.animating) wake();
  };
  const wake = () => { if (!disposed && frame === undefined) { last = performance.now(); frame = requestAnimationFrame(tick); } };
  const position = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    return v((event.clientX - bounds.left) * canvas.width / Math.max(1, bounds.width), (event.clientY - bounds.top) * canvas.height / Math.max(1, bounds.height));
  };
  const release = () => {
    const pointer = activePointer; activePointer = undefined;
    if (pointer !== undefined && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || activePointer !== undefined) return;
    activePointer = event.pointerId; canvas.focus(); canvas.setPointerCapture(event.pointerId);
    runtime.pointerDown(position(event), { shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey || event.metaKey }); wake();
  };
  const move = (event: PointerEvent) => {
    if (!event.isPrimary || activePointer !== undefined && activePointer !== event.pointerId) return;
    runtime.pointerMove(position(event)); wake();
  };
  const up = (event: PointerEvent) => {
    if (activePointer !== event.pointerId) return;
    runtime.pointerUp(position(event)); release(); wake();
  };
  const cancel = () => {
    runtime.pointerMove(v(-10000, -10000)); runtime.pointerUp(v(-10000, -10000)); release(); wake();
  };
  const leave = () => { if (activePointer === undefined) { runtime.pointerMove(v(-10000, -10000)); wake(); } };
  const key = (event: KeyboardEvent) => {
    // Tab stays native so focus can always leave the canvas for the HTML equivalents.
    if (event.key === 'Tab') return;
    const arrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (runtime.key(arrow ? 'Tab' : event.key, { shift: arrow ? event.key === 'ArrowUp' : event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey || event.metaKey })) { event.preventDefault(); wake(); }
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('lostpointercapture', cancel); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('keydown', key);
  wake();
  return {
    dispatch(command) { if (!disposed) { runtime.dispatch(command); wake(); } },
    dispose() {
      if (disposed) return; disposed = true;
      if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined;
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('lostpointercapture', cancel); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('keydown', key);
      release(); runtime.stop();
      canvas.width = original.width; canvas.height = original.height; canvas.tabIndex = original.tabIndex; canvas.style.touchAction = original.touchAction;
    },
  };
}

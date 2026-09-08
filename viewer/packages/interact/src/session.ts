import type { ViewState } from '@bim-open-toolkit/model';
import {
  advanceFlight,
  defaultFlightMs,
  flightView,
  flyTo,
  interrupts,
  isFlightDone,
  type CameraFlight,
  type EaseName,
} from './animation.js';
import type { InputFrame } from './input.js';
import { finite } from './numbers.js';
import { constrainToMode, stepNavigation, type NavState } from './navigation.js';

// Navigation and an optional camera flight together: the whole interactive state of one view.
// The flight, while there is one, is what decides the view; user input hands control back.
export type NavSession = {
  readonly nav: NavState;
  readonly flight: CameraFlight | undefined;
};

// A session that is navigating and not flying.
export const navSession = (nav: NavState): NavSession => ({ nav, flight: undefined });

// True while a flight is deciding the view.
export const isFlying = (session: NavSession): boolean => session.flight !== undefined;

// The session flying to a view from wherever it is now, replacing any flight already running.
export const startFlight = (
  session: NavSession,
  to: ViewState,
  durationMs: number = defaultFlightMs,
  ease: EaseName = 'easeInOut',
): NavSession => ({ ...session, flight: flyTo(session.nav.view, to, durationMs, ease) });

// The session with any flight dropped, keeping the view it had reached.
export const cancelFlight = (session: NavSession): NavSession =>
  session.flight === undefined ? session : { ...session, flight: undefined };

// One step of the whole view: `dtMs` is how long the step lasted in milliseconds.
// A flight advances until it finishes or until the user does something, and either way the view it
// had reached is kept, so navigation carries on from there rather than jumping back.
// The mode's constraints still apply during a flight, so flying while overhead stays overhead;
// switch mode first to fly somewhere a top-down view cannot go.
export const stepSession = (session: NavSession, input: InputFrame, dtMs: number): NavSession => {
  const seconds = Math.max(finite(dtMs), 0) / 1000;
  const flight = session.flight;
  if (flight === undefined) return { ...session, nav: stepNavigation(session.nav, input, seconds) };
  if (interrupts(input)) {
    const handedBack: NavState = { ...session.nav, view: flightView(flight) };
    return { nav: stepNavigation(handedBack, input, seconds), flight: undefined };
  }
  const advanced = advanceFlight(flight, dtMs);
  const nav = constrainToMode({ ...session.nav, view: flightView(advanced) });
  return { nav, flight: isFlightDone(advanced) ? undefined : advanced };
};

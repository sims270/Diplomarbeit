import { ReduceMotion, WithSpringConfig } from "react-native-reanimated";

// Apple's fluid-interface model uses two designer-friendly parameters
// instead of raw physics (mass/stiffness/damping):
//   - damping ratio: 1.0 = critically damped (settles smoothly, no
//     overshoot); <1.0 = overshoots and oscillates, lower = bouncier.
//   - response: how quickly it reaches the target, in seconds. Not a
//     fixed "duration" — the spring's actual settle time emerges from
//     the physics, this just tunes how eager it is.
//
// Reanimated's `duration` + `dampingRatio` spring config maps directly
// onto that model, so these presets are lifted straight from Apple's
// own values (see WWDC18 "Designing Fluid Interfaces"). `reduceMotion:
// System` makes every spring using these presets automatically collapse
// to an instant jump when the OS's reduce-motion setting is on — no need
// to thread that check through every call site by hand.
function spring(dampingRatio: number, responseSeconds: number): WithSpringConfig {
  return {
    duration: responseSeconds * 1000,
    dampingRatio,
    reduceMotion: ReduceMotion.System,
  };
}

export const springs = {
  // Default for anything the user didn't just throw/flick — button
  // presses, fades, most UI. No overshoot; graceful, not distracting.
  default: spring(1.0, 0.4),

  // Reposition an element (e.g. drag settling into place).
  move: spring(1.0, 0.4),

  // Only for gesture-driven, momentum-carrying motion (a flick, a throw,
  // a drag release) — overshoot reads as "physical" there, but wrong
  // everywhere else.
  momentum: spring(0.8, 0.4),
  rotation: spring(0.8, 0.4),
  sheet: spring(0.8, 0.3),
} as const;

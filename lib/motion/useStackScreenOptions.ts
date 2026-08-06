import { useReducedMotion } from "./reducedMotion";

/**
 * Shared native-stack screenOptions that respect the OS reduce-motion
 * setting — screens still navigate instantly when it's on, just without
 * the slide/gesture animation. Use across every Stack in the app so the
 * behavior is consistent everywhere, not just in the root layout.
 */
export function useStackScreenOptions() {
  const reducedMotion = useReducedMotion();
  return {
    animation: reducedMotion ? ("none" as const) : ("slide_from_right" as const),
    gestureEnabled: !reducedMotion,
  };
}

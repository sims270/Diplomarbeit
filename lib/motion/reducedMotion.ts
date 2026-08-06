import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// Mirrors the web's `prefers-reduced-motion` — the OS-level equivalent on
// iOS/Android. Every spring/gesture animation in the app should check this
// and fall back to an instant or simple cross-fade change instead.
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Web (react-native-web) doesn't implement isReduceMotionEnabled —
    // read the actual CSS media query there instead.
    if (Platform.OS === "web") {
      const query = "(prefers-reduced-motion: reduce)";
      const mql = typeof window !== "undefined" ? window.matchMedia(query) : null;
      if (!mql) return;
      setReducedMotion(mql.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

// Mirrors the web's `prefers-reduced-transparency` — translucent/blurred
// materials should fall back to a near-solid surface for people who rely
// on this setting, since blur can hurt legibility.
export function useReducedTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      const query = "(prefers-reduced-transparency: reduce)";
      const mql = typeof window !== "undefined" ? window.matchMedia(query) : null;
      if (!mql) return;
      setReduceTransparency(mql.matches);
      const listener = (e: MediaQueryListEvent) => setReduceTransparency(e.matches);
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }

    // iOS exposes this via AccessibilityInfo; Android has no equivalent
    // API, so it stays false there (BlurSurface already treats Android
    // conservatively regardless — see components/fluid/BlurSurface.tsx).
    if (Platform.OS !== "ios") return;

    let mounted = true;
    const infoWithTransparency = AccessibilityInfo as typeof AccessibilityInfo & {
      isReduceTransparencyEnabled?: () => Promise<boolean>;
    };
    infoWithTransparency.isReduceTransparencyEnabled?.().then((enabled) => {
      if (mounted) setReduceTransparency(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceTransparency;
}

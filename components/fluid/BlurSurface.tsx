import { useReducedTransparency } from "@/lib/motion/reducedMotion";
import { BlurView, type BlurViewProps } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

export interface BlurSurfaceProps extends Omit<BlurViewProps, "intensity"> {
  /** 0-100, forwarded to BlurView. Defaults to 40 (a light material). */
  intensity?: number;
  /** Solid fallback color used when reduce-transparency is on, or on
   * platforms/situations where blur isn't available. */
  fallbackColor?: string;
}

/**
 * A translucent "material" surface (see Apple's materials & depth
 * guidance) — a floating layer that separates content without fully
 * hiding what's behind it. Falls back to a solid surface when the user
 * has reduce-transparency enabled, since a blurred surface can hurt
 * legibility for people who rely on that setting.
 */
export function BlurSurface({
  intensity = 40,
  tint = "default",
  fallbackColor = "rgba(255,255,255,0.92)",
  style,
  children,
  ...rest
}: BlurSurfaceProps) {
  const reduceTransparency = useReducedTransparency();

  if (reduceTransparency || Platform.OS === "android") {
    // expo-blur's Android blur has historically been inconsistent across
    // OS versions — a solid near-opaque surface is the safer default
    // there, matching Apple's own reduce-transparency fallback (frostier
    // background, no blur) rather than an unreliable effect.
    return (
      <View style={[style, { backgroundColor: fallbackColor }]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={style} {...rest}>
      {children}
    </BlurView>
  );
}

export const blurSurfaceStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

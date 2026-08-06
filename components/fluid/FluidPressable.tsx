import { useReducedMotion } from "@/lib/motion/reducedMotion";
import { springs } from "@/lib/motion/springs";
import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface FluidPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Scale the element shrinks to while pressed. Defaults to 0.97. */
  scaleTo?: number;
}

/**
 * Drop-in replacement for React Native's `Pressable` that responds the
 * instant a finger touches down (not on release) and settles with a
 * critically-damped spring — no lag, no overshoot. See the "Response" and
 * "Direct manipulation" sections of Apple's Designing Fluid Interfaces.
 *
 * Respects the OS reduce-motion setting automatically (via the spring
 * preset's `reduceMotion: System`), so no extra work is needed at call
 * sites for accessibility.
 */
export function FluidPressable({
  scaleTo = 0.97,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: FluidPressableProps) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        // Feedback fires on touch-down, not on release — waiting for the
        // tap to complete before responding is what makes an interface
        // feel laggy.
        if (!reducedMotion) {
          scale.value = withSpring(scaleTo, springs.default);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) {
          scale.value = withSpring(1, springs.default);
        }
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}

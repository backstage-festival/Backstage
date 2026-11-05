import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

import { motion } from "@/theme/theme";

/**
 * System „reduce motion” (Android: remove animations). Components use it to
 * jump to the end state instead of animating (H03, column „Ograniczony ruch”).
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * Press feedback: scale 1 → `to` with motion.press (120 ms). Kept under reduced
 * motion – it is a direct response to touch (H03).
 */
export function usePressScale(to: number = motion.press.scale) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.timing(scale, {
        toValue,
        duration: motion.press.duration,
        easing: Easing.bezier(...motion.press.easing),
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  const onPressIn = useCallback(() => animateTo(to), [animateTo, to]);
  const onPressOut = useCallback(() => animateTo(1), [animateTo]);

  return { scale, onPressIn, onPressOut };
}

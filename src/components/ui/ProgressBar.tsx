import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from "react-native-reanimated";

interface Props {
  pct:    number;   // 0–100
  color:  string;
  track:  string;
  delay?: number;
  height?: number;
}

// Curva ease-out fuerte (Emil): la barra arranca rápido y desacelera
const EASE = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Barra de progreso que se llena desde 0 al montar.
 * Un relleno animado se siente más vivo que un ancho estático.
 */
export function ProgressBar({ pct, color, track, delay = 0, height = 6 }: Props) {
  const target = Math.max(0, Math.min(100, pct));
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = withDelay(delay, withTiming(target, { duration: 650, easing: EASE }));
  }, [target]);

  const aStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View style={{ height, borderRadius: height / 2, width: "100%", backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, aStyle]} />
    </View>
  );
}

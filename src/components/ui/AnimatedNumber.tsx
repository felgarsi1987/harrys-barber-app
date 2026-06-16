import React, { useEffect } from "react";
import { TextInput, TextStyle, StyleProp } from "react-native";
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from "react-native-reanimated";

Animated.addWhitelistedNativeProps({ text: true });
const AInput = Animated.createAnimatedComponent(TextInput);

// Formateo seguro en el worklet (sin toLocaleString, que no existe en el hilo UI)
function formatear(n: number, prefix: string): string {
  "worklet";
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString();
  let out = "";
  let cnt = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    out = s[i] + out;
    cnt++;
    if (cnt % 3 === 0 && i > 0) out = "." + out;
  }
  return (neg ? "-" : "") + prefix + out;
}

interface Props {
  value:     number;
  prefix?:   string;     // ej. "$"
  duration?: number;
  style?:    StyleProp<TextStyle>;
}

/**
 * Número que "cuenta" hasta su valor al montar/cambiar.
 * Da una sensación premium (fintech) en KPIs, balance y saldos.
 */
export function AnimatedNumber({ value, prefix = "", duration = 750, style }: Props) {
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withTiming(value, { duration, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [value]);

  const animatedProps = useAnimatedProps(() => {
    return { text: formatear(sv.value, prefix), defaultValue: formatear(sv.value, prefix) } as any;
  });

  return (
    <AInput
      editable={false}
      underlineColorAndroid="transparent"
      value={formatear(value, prefix)}
      animatedProps={animatedProps}
      style={style}
      pointerEvents="none"
    />
  );
}

import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  count?:        number;
  height?:       number;
  borderRadius?: number;
  style?:        ViewStyle;
}

export function SkeletonLoader({ count = 1, height = 80, borderRadius = 12, style }: Props) {
  const c    = useThemeColors();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            { height, borderRadius, backgroundColor: c.border, opacity: anim, marginBottom: 10 },
            style,
          ]}
        />
      ))}
    </>
  );
}

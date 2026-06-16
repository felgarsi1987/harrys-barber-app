import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Curva ease-out fuerte (Emil): respuesta inmediata al presionar
const EASE = Easing.bezier(0.23, 1, 0.32, 1);

interface Props {
  children:  React.ReactNode;
  onPress?:  () => void;
  style?:    StyleProp<ViewStyle>;
  scaleTo?:  number;
  disabled?: boolean;
  hitSlop?:  number;
}

/**
 * Pressable con feedback de escala (scale 0.96 al presionar).
 * Da la sensación de que la UI "escucha" el toque, sin keyframes ni librerías extra.
 */
export function PressableScale({
  children, onPress, style, scaleTo = 0.96, disabled, hitSlop,
}: Props) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={()  => { scale.value = withTiming(scaleTo, { duration: 120, easing: EASE }); }}
      onPressOut={() => { scale.value = withTiming(1,       { duration: 160, easing: EASE }); }}
      style={[style, aStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

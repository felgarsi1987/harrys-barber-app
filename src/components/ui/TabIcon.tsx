import React, { useEffect } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from "react-native-reanimated";

interface Props {
  name:    keyof typeof MaterialIcons.glyphMap;
  color:   string;
  focused: boolean;
  size?:   number;
}

/**
 * Ícono de tab con micro-escala al activarse (spring). Sensación premium en la barra.
 */
export function TabIcon({ name, color, focused, size = 22 }: Props) {
  const scale = useSharedValue(focused ? 1.12 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.14 : 1, { damping: 13, stiffness: 230 });
  }, [focused]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={aStyle}>
      <MaterialIcons name={name} size={size} color={color} />
    </Animated.View>
  );
}

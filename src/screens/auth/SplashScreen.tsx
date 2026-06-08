import React, { useEffect, useRef } from "react";
import { View, Image, Animated, StyleSheet, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeStore } from "../../store/themeStore";

const { width } = Dimensions.get("window");

export function SplashScreen() {
  const navigation  = useNavigation<any>();
  const { loadTheme } = useThemeStore();
  const progress    = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTheme();

    Animated.timing(logoOpacity, {
      toValue: 1, duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1, duration: 1800,
      useNativeDriver: false,
    }).start(() => {
      navigation.replace("Entrada");
    });
  }, []);

  const barWidth = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: logoOpacity }}>
        <View style={styles.logoPlaceholder}>
          <Animated.Text style={{ fontSize: 48 }}>✂️</Animated.Text>
        </View>
      </Animated.View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#0D0D0D",
    justifyContent:  "center",
    alignItems:      "center",
    gap:             48,
  },
  logoPlaceholder: {
    width:           120,
    height:          120,
    borderRadius:    60,
    backgroundColor: "#191C21",
    justifyContent:  "center",
    alignItems:      "center",
  },
  barTrack: {
    width:           width * 0.5,
    height:          3,
    backgroundColor: "#2A2D35",
    borderRadius:    9999,
    overflow:        "hidden",
  },
  barFill: {
    height:          3,
    backgroundColor: "#0511F2",
    borderRadius:    9999,
  },
});
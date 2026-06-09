import React, { useEffect, useRef } from "react";
import {
  View, Image, Animated, StyleSheet, Dimensions, Text,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeStore } from "../../store/themeStore";

const { width } = Dimensions.get("window");

export function SplashScreen() {
  const navigation    = useNavigation<any>();
  const { loadTheme } = useThemeStore();
  const progress      = useRef(new Animated.Value(0)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTheme();

    Animated.timing(logoOpacity, {
      toValue: 1, duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.timing(textOpacity, {
      toValue: 1, duration: 600, delay: 400,
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1, duration: 2000,
      useNativeDriver: false,
    }).start(() => {
      navigation.replace("Entrada");
    });
  }, []);

  const barWidth = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0%", "100%"],
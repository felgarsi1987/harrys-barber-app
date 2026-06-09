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

    // Fade in logo
    Animated.timing(logoOpacity, {
      toValue: 1, duration: 800,
      useNativeDriver: true,
    }).start();

    // Fade in texto con delay
    Animated.timing(textOpacity, {
      toValue: 1, duration: 600, delay: 400,
      useNativeDriver: true,
    }).start();

    // Barra de progreso
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
  });

  return (
    <View style={styles.container}>

      {/* Logo Harrys */}
      <Animated.View style={[styles.logoWrapper, { opacity: logoOpacity }]}>
        <Image
          source={require("../../assets/images/harrys_logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Nombre marca */}
      <Animated.View style={[styles.brandBlock, { opacity: textOpacity }]}>
        <Text style={styles.brand}>HARRYS</Text>
        <Text style={styles.brandSub}>BARBER SHOP</Text>
      </Animated.View>

      {/* Barra de progreso */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      {/* Footer AIXON */}
      <Animated.View style={[styles.aixonFooter, { opacity: textOpacity }]}>
        <Image
          source={require("../../assets/images/aixon_logo.png")}
          style={styles.aixonLogo}
          resizeMode="contain"
        />
        <Text style={styles.aixonText}>Administrado por AIXON</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#0D0D0D",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             24,
  },
  logoWrapper: {
    alignItems: "center",
  },
  logo: {
    width:        140,
    height:       140,
    borderRadius: 70,
  },
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
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, { opacity: logoOpacity }]}>
        <Image
          source={require("../../assets/images/harrys_logo_clean.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.brandBlock, { opacity: textOpacity }]}>
        <Text style={styles.brand}>HARRYS</Text>
        <Text style={styles.brandSub}>BARBER SHOP</Text>
      </Animated.View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

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
  brandBlock: {
    alignItems: "center",
    gap:        4,
  },
  brand: {
    fontSize:      28,
    fontFamily:    "Syne_800ExtraBold",
    color:         "#F4F2EE",
    letterSpacing: 8,
  },
  brandSub: {
    fontSize:      10,
    fontFamily:    "SpaceGrotesk_500Medium",
    color:         "#F2B90C",
    letterSpacing: 4,
  },
  barTrack: {
    width:           width * 0.5,
    height:          2,
    backgroundColor: "#2A2D35",
    borderRadius:    9999,
    overflow:        "hidden",
    marginTop:       8,
  },
  barFill: {
    height:          2,
    backgroundColor: "#0511F2",
    borderRadius:    9999,
  },
  aixonFooter: {
    position:      "absolute",
    bottom:        32,
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  aixonLogo: {
    width:   18,
    height:  18,
    opacity: 0.7,
  },
  aixonText: {
    fontSize:   11,
    fontFamily: "SpaceGrotesk_400Regular",
    color:      "#8A8580",
  },
});

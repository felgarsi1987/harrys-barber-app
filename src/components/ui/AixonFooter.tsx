import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";

export function AixonFooter() {
  const c = useThemeColors();
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/AIXON_isotipo_128x128.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.text, { color: c.sub }]}>
        Administrado por AIXON
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 16,
    gap:             8,
  },
  logo: {
    width:   20,
    height:  20,
  },
  text: {
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize:   11,
  },
});
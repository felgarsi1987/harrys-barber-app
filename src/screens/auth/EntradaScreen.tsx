import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { AixonFooter }   from "../../components/ui/AixonFooter";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

export function EntradaScreen() {
  const navigation = useNavigation<any>();
  const c = useThemeColors();

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Image
          source={require("../../assets/images/harrys_logo_clean.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />
        <View style={styles.titleBlock}>
          <Text style={[styles.brand, { color: c.text }]}>HARRYS</Text>
          <Text style={[styles.sub, { color: c.amber }]}>BARBER SHOP</Text>
        </View>

        {/* Botón principal: Ingresar */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Login", { role: "cliente" })}
          style={[styles.mainBtn, { backgroundColor: c.amber }]}
          activeOpacity={0.8}
        >
          <MaterialIcons name="login" size={20} color="#000" />
          <Text style={styles.mainBtnText}>Ingresar</Text>
        </TouchableOpacity>

        {/* Registrarse */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Registro")}
          style={[styles.secondBtn, { borderColor: c.border, backgroundColor: c.surface }]}
          activeOpacity={0.8}
        >
          <MaterialIcons name="person-add" size={20} color={c.text} />
          <Text style={[styles.secondBtnText, { color: c.text }]}>Registrarse</Text>
        </TouchableOpacity>

        {/* Acceso invitado */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Invitado")}
          style={styles.guestBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="visibility" size={16} color={c.sub} />
          <Text style={[styles.guestBtnText, { color: c.sub }]}>
            Entrar como invitado
          </Text>
        </TouchableOpacity>
      </View>
      <AixonFooter />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 28, gap: 14,
  },
  logoImg:    { width: 120, height: 120, borderRadius: 60, marginBottom: 4 },
  titleBlock: { alignItems: "center", gap: 2, marginBottom: 12 },
  brand:      { fontSize: 32, fontFamily: "Syne_800ExtraBold", letterSpacing: 6 },
  sub:        { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 4 },
  mainBtn: {
    width: "100%", height: 54, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  mainBtnText:   { fontSize: 16, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  secondBtn: {
    width: "100%", height: 54, borderRadius: 14, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  secondBtnText: { fontSize: 16, fontFamily: "SpaceGrotesk_600SemiBold" },
  guestBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  guestBtnText:  { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
});

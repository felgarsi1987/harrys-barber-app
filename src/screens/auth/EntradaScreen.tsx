import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { AixonFooter } from "../../components/ui/AixonFooter";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

type RoleOption = {
  key: "admin" | "empleado" | "cliente";
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  desc: string;
};

const ROLES: RoleOption[] = [
  {
    key: "admin",
    label: "Administrador",
    icon: "dashboard",
    desc: "Gestión completa",
  },
  {
    key: "empleado",
    label: "Empleado",
    icon: "content-cut",
    desc: "Agenda y pedidos",
  },
  {
    key: "cliente",
    label: "Cliente",
    icon: "person-outline",
    desc: "Reservas y tienda",
  },
];

export function EntradaScreen() {
  const navigation = useNavigation<any>();
  const c = useThemeColors();

  return (
    <ScreenWrapper>
      <View style={styles.container}>

        {/* Logo oficial circular */}
        <Image
          source={require("../../assets/images/harrys_logo_clean.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />

        {/* Título */}
        <View style={styles.titleBlock}>
          <Text style={[styles.brand, { color: c.text }]}>HARRYS</Text>
          <Text style={[styles.sub, { color: c.amber }]}>BARBER SHOP</Text>
        </View>

        <Text style={[styles.hint, { color: c.sub }]}>
          ¿Cómo deseas ingresar?
        </Text>

        {/* Tarjetas de rol */}
        <View style={styles.rolesContainer}>
          {ROLES.map((role, index) => (
            <TouchableOpacity
              key={role.key}
              onPress={() => navigation.navigate("Login", { role: role.key })}
              style={[
                styles.roleCard,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.roleIndex, { color: c.amber }]}>
                0{index + 1}
              </Text>

              <View style={[styles.iconBox, { borderColor: c.border }]}>
                <MaterialIcons
                  name={role.icon}
                  size={22}
                  color={c.text}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.roleLabel, { color: c.text }]}>
                  {role.label}
                </Text>
                <Text style={[styles.roleDesc, { color: c.sub }]}>
                  {role.desc}
                </Text>
              </View>

              <MaterialIcons
                name="arrow-forward"
                size={18}
                color={c.sub}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Registro */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Registro")}
          style={[styles.registerBtn, { borderColor: c.border }]}
        >
          <Text style={[styles.registerText, { color: c.sub }]}>
            ¿Nuevo cliente?{" "}
            <Text style={{ color: c.amber }}>Regístrate aquí</Text>
          </Text>
        </TouchableOpacity>

      </View>
      <AixonFooter />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  logoImg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 4,
  },
  titleBlock: {
    alignItems: "center",
    gap: 2,
  },
  brand: {
    fontSize: 32,
    fontFamily: "Syne_800ExtraBold",
    letterSpacing: 6,
  },
  sub: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_500Medium",
    letterSpacing: 4,
  },
  hint: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    marginBottom: 4,
  },
  rolesContainer: {
    width: "100%",
    gap: 10,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  roleIndex: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_600SemiBold",
    letterSpacing: 1,
    minWidth: 20,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  roleLabel: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  roleDesc: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    marginTop: 1,
  },
  registerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  registerText: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
  },
});
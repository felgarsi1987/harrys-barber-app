import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

export function ClientePerfilScreen() {
  const c              = useThemeColors();
  const navigation     = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const { toggle, mode } = useThemeColors();

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: logout },
    ]);
  };

  const isBirthday = () => {
    if (!user?.birthdate) return false;
    const hoy = new Date();
    const bd  = new Date(user.birthdate);
    return bd.getMonth() === hoy.getMonth() && bd.getDate() === hoy.getDate();
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Mi perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: c.amber + "22" }]}>
            <Text style={[styles.avatarText, { color: c.amber }]}>
              {user?.nombre?.[0]}{user?.apellido?.[0]}
            </Text>
          </View>
          <Text style={[styles.name,  { color: c.text }]}>
            {user?.nombre} {user?.apellido}
          </Text>
          <Text style={[styles.email, { color: c.sub }]}>{user?.email}</Text>
          {isBirthday() && <TagChip label="🎂 Cumpleaños hoy" variant="warning" />}
        </View>

        <ThemedCard style={styles.infoCard}>
          {[
            { icon: "phone",  label: "Teléfono",   value: user?.telefono  ?? "—" },
            { icon: "cake",   label: "Cumpleaños", value: user?.birthdate ?? "—" },
            { icon: "email",  label: "Correo",     value: user?.email     ?? "—" },
          ].map((item, i) => (
            <View
              key={i}
              style={[
                styles.infoRow,
                i < 2 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
            >
              <MaterialIcons name={item.icon as any} size={18} color={c.sub} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: c.sub }]}>{item.label}</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>{item.value}</Text>
              </View>
            </View>
          ))}
        </ThemedCard>

        <ThemedCard style={styles.menuCard}>
          <TouchableOpacity
            onPress={() => navigation.navigate("ClienteHistorial")}
            style={styles.menuRow}
          >
            <MaterialIcons name="history" size={20} color={c.sub} />
            <Text style={[styles.menuLabel, { color: c.text }]}>Mis citas</Text>
            <MaterialIcons name="chevron-right" size={18} color={c.sub} />
          </TouchableOpacity>
        </ThemedCard>

        <ThemedCard style={styles.themeCard}>
          <MaterialIcons
            name={mode === "dark" ? "dark-mode" : "light-mode"}
            size={20} color={c.amber}
          />
          <Text style={[styles.themeLabel, { color: c.text }]}>
            Tema {mode === "dark" ? "oscuro" : "claro"}
          </Text>
          <TouchableOpacity
            onPress={toggle}
            style={[styles.themeBtn, { backgroundColor: c.amber + "22", borderColor: c.amber + "44" }]}
          >
            <Text style={[styles.themeBtnText, { color: c.amber }]}>Cambiar</Text>
          </TouchableOpacity>
        </ThemedCard>

        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: c.red }]}
        >
          <MaterialIcons name="logout" size={18} color={c.red} />
          <Text style={[styles.logoutText, { color: c.red }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
      {showPedidos && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <PedidosScreen mode="cliente" showBackHeader={false} />
          <TouchableOpacity
            onPress={() => setShowPedidos(false)}
            style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll: { padding: 20, gap: 16 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 28, fontFamily: "Syne_700Bold" },
  name:       { fontSize: 20, fontFamily: "Syne_700Bold" },
  email:      { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  infoCard:   { gap: 0, padding: 0, overflow: "hidden" },
  infoRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  infoLabel:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  infoValue:  { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  themeCard:  { flexDirection: "row", alignItems: "center", gap: 12 },
  themeLabel: { flex: 1, fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },
  themeBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  themeBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 50, borderRadius: 12, borderWidth: 1, gap: 8,
  },
  logoutText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  menuCard:  { gap: 0, padding: 0, overflow: "hidden" },
  menuRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },
});
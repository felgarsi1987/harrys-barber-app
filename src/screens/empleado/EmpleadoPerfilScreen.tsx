import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ProfilePhoto }   from "../../components/ui/ProfilePhoto";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

export function EmpleadoPerfilScreen() {
  const c                = useThemeColors();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScreenWrapper scrollable>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Mi perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <ProfilePhoto
            uid={user?.uid ?? ""}
            photoURL={user?.photoURL}
            nombre={user ? `${user.nombre} ${user.apellido}` : "?"}
            size={90}
            editable={true}
            onUpdated={(url) => {}}
          />
          <Text style={[styles.name, { color: c.text }]}>
            {user?.nombre} {user?.apellido}
          </Text>
          <Text style={[styles.email, { color: c.sub }]}>{user?.email}</Text>
        </View>

        {/* Tema */}
        <ThemedCard style={styles.themeCard}>
          <MaterialIcons
            name={c.mode === "dark" ? "dark-mode" : "light-mode"}
            size={20} color={c.amber}
          />
          <Text style={[styles.themeLabel, { color: c.text }]}>
            Tema {c.mode === "dark" ? "oscuro" : "claro"}
          </Text>
          <TouchableOpacity
            onPress={c.toggle}
            style={[styles.themeBtn, { backgroundColor: c.amber + "22", borderColor: c.amber + "44" }]}
          >
            <Text style={[styles.themeBtnText, { color: c.amber }]}>Cambiar</Text>
          </TouchableOpacity>
        </ThemedCard>

        {/* Nota contraseña */}
        <View style={[styles.notaCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <MaterialIcons name="info-outline" size={16} color={c.sub} />
          <Text style={[styles.notaText, { color: c.sub }]}>
            Para cambiar tu contraseña contacta al administrador.
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: c.red }]}
        >
          <MaterialIcons name="logout" size={18} color={c.red} />
          <Text style={[styles.logoutText, { color: c.red }]}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
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
  roleBadge: {
    paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20,
  },
  roleText:   { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
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
  notaCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  notaText:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", flex: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 50, borderRadius: 12, borderWidth: 1, gap: 8,
  },
  logoutText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});
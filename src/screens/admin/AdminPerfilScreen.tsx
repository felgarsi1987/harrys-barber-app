import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ProfilePhoto }   from "../../components/ui/ProfilePhoto";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { PressableScale } from "../../components/ui/PressableScale";
import { AixonFooter }    from "../../components/ui/AixonFooter";

export function AdminPerfilScreen() {
  const { toggle, mode, ...colorProps } = useThemeColors();
  const c = { toggle, mode, ...colorProps };
  const navigation = useNavigation<any>();
  const { user, logout, } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: logout },
    ]);
  };

  const menuItems = [
    { icon: "schedule",        label: "Horario y servicios",  action: () => navigation.navigate("AdminHorario") },
    { icon: "content-cut",     label: "Servicios y precios",  action: () => navigation.navigate("AdminServicios") },
    { icon: "campaign",        label: "Eventos y publicidad", action: () => navigation.navigate("AdminEventos") },
    { icon: "inventory",       label: "Inventario",           action: () => navigation.navigate("AdminInventario") },
    { icon: "event",           label: "Mi agenda",             action: () => navigation.navigate("AdminAgenda") },
    { icon: "add-circle-outline",label: "Nueva cita",            action: () => navigation.navigate("AdminNuevaReserva") },
    { icon: "bar-chart",       label: "Balances mensuales",   action: () => navigation.navigate("AdminBalances") },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Perfil</Text>
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
          <View style={[styles.roleBadge, { backgroundColor: c.blue + "22" }]}>
            <Text style={[styles.roleText, { color: c.blue }]}>Administrador</Text>
          </View>
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

        {/* Menú */}
        <ThemedCard style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={item.action}
              style={[
                styles.menuRow,
                i < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
            >
              <MaterialIcons name={item.icon as any} size={20} color={c.sub} />
              <Text style={[styles.menuLabel, { color: c.text }]}>{item.label}</Text>
              <MaterialIcons name="chevron-right" size={18} color={c.sub} />
            </TouchableOpacity>
          ))}
        </ThemedCard>

        {/* Logout */}
        <PressableScale
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: c.red }]}
        >
          <MaterialIcons name="logout" size={18} color={c.red} />
          <Text style={[styles.logoutText, { color: c.red }]}>Cerrar sesión</Text>
        </PressableScale>

        {/* Footer Aixon */}
        <AixonFooter />
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
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 20, marginTop: 4,
  },
  roleText:   { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  themeCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  themeLabel: { flex: 1, fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },
  themeBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  themeBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  menuCard:  { gap: 0, padding: 0, overflow: "hidden" },
  menuRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 50, borderRadius: 12, borderWidth: 1, gap: 8,
  },
  logoutText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});
import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { ProfilePhoto }   from "../../components/ui/ProfilePhoto";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { AixonFooter }    from "../../components/ui/AixonFooter";

function ScalePress({ onPress, style, children }: { onPress: () => void; style: any; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <TouchableOpacity onPress={onPress} style={style} activeOpacity={1}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 16, stiffness: 280 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 16, stiffness: 280 }); }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function SectionLabel({ label, c }: { label: string; c: any }) {
  return (
    <View style={styles.secRow}>
      <Text style={[styles.secLabel, { color: c.sub }]}>{label}</Text>
      <View style={[styles.secLine, { backgroundColor: c.border }]} />
    </View>
  );
}

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
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.blue + "08" }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>Mi perfil</Text>
        <Text style={[styles.headerSub, { color: c.blue }]}>Empleado</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(200)} style={styles.avatarSection}>
          <View style={[styles.avatarGlow, { backgroundColor: c.blue + "14" }]} />
          <ProfilePhoto
            uid={user?.uid ?? ""}
            photoURL={user?.photoURL}
            nombre={user ? `${user.nombre} ${user.apellido}` : "?"}
            size={88}
            editable={true}
            onUpdated={() => {}}
          />
          <Text style={[styles.name, { color: c.text }]}>
            {user?.nombre} {user?.apellido}
          </Text>
          <Text style={[styles.email, { color: c.sub }]}>{user?.email}</Text>
          <View style={[styles.rolePill, { backgroundColor: c.blue + "18", borderColor: c.blue + "44" }]}>
            <MaterialIcons name="content-cut" size={12} color={c.blue} />
            <Text style={[styles.roleText, { color: c.blue }]}>Peluquero</Text>
          </View>
        </Animated.View>

        {/* Preferencias */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(200)}>
          <SectionLabel label="PREFERENCIAS" c={c} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify().damping(18).stiffness(200)}
          style={[styles.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: c.amber + "18" }]}>
              <MaterialIcons name={c.mode === "dark" ? "dark-mode" : "light-mode"} size={16} color={c.amber} />
            </View>
            <Text style={[styles.menuLabel, { color: c.text }]}>
              Tema {c.mode === "dark" ? "oscuro" : "claro"}
            </Text>
            <TouchableOpacity
              onPress={c.toggle}
              style={[styles.themeBtn, { backgroundColor: c.amber + "22", borderColor: c.amber + "44" }]}
            >
              <Text style={[styles.themeBtnText, { color: c.amber }]}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Info */}
        <Animated.View entering={FadeInDown.delay(200).springify().damping(18).stiffness(200)}>
          <SectionLabel label="INFORMACIÓN" c={c} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).springify().damping(18).stiffness(200)}
          style={[styles.notaCard, { backgroundColor: c.blue + "08", borderColor: c.blue + "30" }]}>
          <View style={[styles.menuIcon, { backgroundColor: c.blue + "18" }]}>
            <MaterialIcons name="info-outline" size={16} color={c.blue} />
          </View>
          <Text style={[styles.notaText, { color: c.sub }]}>
            Para cambiar tu contraseña o datos de cuenta, contacta al administrador.
          </Text>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(280).springify().damping(18).stiffness(200)}>
          <ScalePress
            onPress={handleLogout}
            style={[styles.logoutBtn, { borderColor: c.negative + "50", backgroundColor: c.negative + "0A" }]}
          >
            <MaterialIcons name="logout" size={18} color={c.negative} />
            <Text style={[styles.logoutText, { color: c.negative }]}>Cerrar sesión</Text>
          </ScalePress>
        </Animated.View>

        {/* Footer Aixon */}
        <AixonFooter />

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontFamily: "Syne_700Bold" },
  headerSub:   { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", marginTop: 2 },

  scroll: { padding: 20, gap: 16 },

  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 12 },
  avatarGlow: { position: "absolute", width: 140, height: 140, borderRadius: 70, top: 0 },
  name:  { fontSize: 22, fontFamily: "Syne_700Bold", marginTop: 4 },
  email: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  roleText: { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },

  secRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  secLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  secLine:  { flex: 1, height: 1 },

  menuCard:  { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  menuRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  menuIcon:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },

  themeBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  themeBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },

  notaCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  notaText: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", flex: 1 },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 50, borderRadius: 12, borderWidth: 1, gap: 8,
  },
  logoutText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});

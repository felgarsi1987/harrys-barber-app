import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons }  from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useGuestStore }  from "../../store/guestStore";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

export function InvitadoScreen() {
  const c          = useThemeColors();
  const navigation = useNavigation<any>();
  const { setGuest } = useGuestStore();

  const [nombre,   setNombre]   = useState("");
  const [apellido, setApellido] = useState("");
  const [loading,  setLoading]  = useState(false);

  const entrar = () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert("Faltan datos", "Ingresa tu nombre y apellido para continuar.");
      return;
    }
    setLoading(true);
    setGuest({ nombre: nombre.trim(), apellido: apellido.trim() });
    // RootNavigator detectará el guest y mostrará ClienteNavigator
    setLoading(false);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <MaterialIcons name="arrow-back" size={22} color={c.sub} />
        </TouchableOpacity>

        <View style={styles.logoBox}>
          <Image
            source={require("../../assets/images/harrys_logo_clean.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: c.text }]}>Acceso invitado</Text>
        <Text style={[styles.desc, { color: c.sub }]}>
          Puedes explorar la app libremente.{"\n"}
          Para agendar o hacer pedidos necesitas tu nombre.
        </Text>

        <View style={styles.fields}>
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: c.sub }]}>NOMBRE</Text>
            <TextInput
              style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Tu nombre"
              placeholderTextColor={c.sub}
              autoCapitalize="words"
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: c.sub }]}>APELLIDO</Text>
            <TextInput
              style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
              value={apellido}
              onChangeText={setApellido}
              placeholder="Tu apellido"
              placeholderTextColor={c.sub}
              autoCapitalize="words"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: nombre && apellido ? c.amber : c.surface, borderColor: c.border }]}
          onPress={entrar}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={[styles.btnText, { color: nombre && apellido ? "#000" : c.sub }]}>
                Entrar como invitado
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Login", { role: "cliente" })}>
          <Text style={[styles.loginLink, { color: c.amber }]}>
            ¿Ya tienes cuenta? Inicia sesión
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: "center", gap: 16 },
  back:      { position: "absolute", top: 20, left: 20 },
  logoBox: { alignItems: "center", marginBottom: 4 },
  logo:    { width: 100, height: 100, borderRadius: 50 },
  title:     { fontSize: 24, fontFamily: "Syne_700Bold", textAlign: "center" },
  desc:      { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center", lineHeight: 20 },
  fields:    { gap: 14 },
  label:     { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  input: {
    height: 50, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular",
  },
  btn: {
    height: 52, borderRadius: 12, borderWidth: 1,
    justifyContent: "center", alignItems: "center", marginTop: 8,
  },
  btnText:   { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  loginLink: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", textAlign: "center" },
});

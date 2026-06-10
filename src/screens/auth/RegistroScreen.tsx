import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors }  from "../../hooks/useThemeColors";
import { useAuthStore }    from "../../store/authStore";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { Typography }      from "../../theme/typography";
import { Spacing, Radius } from "../../theme/spacing";

export function RegistroScreen() {
  const navigation = useNavigation<any>();
  const c = useThemeColors();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    nombre: "", apellido: "", email: "",
    telefono: "", birthdate: "", password: "", confirm: "",
  });

  const update = (field: string, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handleRegister = async () => {
    if (form.password !== form.confirm) {
      alert("Las contraseñas no coinciden.");
      return;
    }
    clearError();
    await register({
      nombre:    form.nombre.trim(),
      apellido:  form.apellido.trim(),
      email:     form.email.trim().toLowerCase(),
      telefono:  form.telefono.trim(),
      birthdate: form.birthdate.trim(),
      password:  form.password,
    });
  };

  const fields = [
    { key: "nombre",    label: "Nombre",              placeholder: "Ej. Carlos",             keyboard: "default" },
    { key: "apellido",  label: "Apellido",             placeholder: "Ej. Mina",               keyboard: "default" },
    { key: "email",     label: "Correo",               placeholder: "correo@ejemplo.com",     keyboard: "email-address" },
    { key: "telefono",  label: "Teléfono",             placeholder: "300 000 0000",           keyboard: "phone-pad" },
    { key: "birthdate", label: "Fecha de nacimiento",  placeholder: "YYYY-MM-DD",             keyboard: "default" },
    { key: "password",  label: "Contraseña",           placeholder: "Mínimo 6 caracteres",    keyboard: "default", secure: true },
    { key: "confirm",   label: "Confirmar contraseña", placeholder: "Repite la contraseña",   keyboard: "default", secure: true },
  ] as const;

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={[styles.scroll, { gap: Spacing.md }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[Typography.body, { color: c.blue }]}>← Volver</Text>
        </TouchableOpacity>

        <Text style={[Typography.h2, { color: c.text }]}>Crear cuenta</Text>
        <Text style={[Typography.body, { color: c.sub }]}>
          Ingresa tus datos para registrarte como cliente.
        </Text>

        {fields.map(f => (
          <View key={f.key} style={{ gap: 6 }}>
            <Text style={[Typography.label, { color: c.sub }]}>{f.label}</Text>
            <TextInput
              style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
              value={form[f.key]}
              onChangeText={val => update(f.key, val)}
              placeholder={f.placeholder}
              placeholderTextColor={c.sub}
              secureTextEntry={"secure" in f ? f.secure : false}
              keyboardType={f.keyboard as any}
              autoCapitalize={f.keyboard === "email-address" ? "none" : "words"}
            />
          </View>
        ))}

        {error ? (
          <Text style={[Typography.bodySmall, { color: c.negative }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.blue, opacity: isLoading ? 0.7 : 1 }]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={[Typography.bodyLarge, { color: "#fff" }]}>Registrarme</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, flexGrow: 1 },
  input: {
    height: 50, borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: 15,
  },
  btn: {
    height: 52, borderRadius: Radius.md,
    justifyContent: "center", alignItems: "center", marginTop: Spacing.md,
  },
});
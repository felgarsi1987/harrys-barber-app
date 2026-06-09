import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackHeader }    from "../../components/ui/BackHeader";
import {
  collection, getDocs, query, where,
  doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Empleado {
  uid:      string;
  nombre:   string;
  apellido: string;
  email:    string;
  canApproveOrders?: boolean;
}

export function AdminEmpleadosScreen() {
  const c = useThemeColors();
  const [empleados,  setEmpleados]  = useState<Empleado[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [form, setForm] = useState({
    nombre: "", apellido: "", email: "", password: "",
  });

  const loadEmpleados = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "empleado"))
      );
      setEmpleados(snap.docs.map(d => d.data() as Empleado));
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEmpleados(); }, []);

  const crearEmpleado = async () => {
    if (!form.nombre || !form.email || !form.password) {
      Alert.alert("Error", "Completa todos los campos.");
      return;
    }
    setSaving(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth, form.email.trim(), form.password
      );
      const newEmp: Empleado = {
        uid:      credential.user.uid,
        nombre:   form.nombre.trim(),
        apellido: form.apellido.trim(),
        email:    form.email.trim(),
        canApproveOrders: false,
      };
      await setDoc(doc(db, "users", credential.user.uid), {
        ...newEmp,
        role:      "empleado",
        createdAt: serverTimestamp(),
      });
      setEmpleados(prev => [...prev, newEmp]);
      setForm({ nombre: "", apellido: "", email: "", password: "" });
      setShowForm(false);
      Alert.alert("✅ Empleado creado", `${newEmp.nombre} puede iniciar sesión.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSaving(false); }
  };

  return (
    <ScreenWrapper>
      <BackHeader title="Empleados" />
      <View style={[styles.subHeader, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={[styles.addBtn, { backgroundColor: c.blue }]}
        >
          <MaterialIcons name={showForm ? "close" : "add"} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Formulario crear empleado */}
        {showForm && (
          <ThemedCard style={styles.formCard} elevated>
            <Text style={[styles.formTitle, { color: c.text }]}>Nuevo empleado</Text>
            {[
              { key: "nombre",   label: "Nombre",      placeholder: "Ej. Juan" },
              { key: "apellido", label: "Apellido",     placeholder: "Ej. Pérez" },
              { key: "email",    label: "Correo",       placeholder: "juan@harrys.com" },
              { key: "password", label: "Contraseña",   placeholder: "Mínimo 6 caracteres", secure: true },
            ].map(f => (
              <View key={f.key} style={{ gap: 4 }}>
                <Text style={[styles.fieldLabel, { color: c.sub }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                  value={form[f.key as keyof typeof form]}
                  onChangeText={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={c.sub}
                  secureTextEntry={f.secure}
                  autoCapitalize={f.key === "email" ? "none" : "words"}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: c.blue, opacity: saving ? 0.7 : 1 }]}
              onPress={crearEmpleado}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Crear empleado</Text>
              }
            </TouchableOpacity>
          </ThemedCard>
        )}

        {/* Lista de empleados */}
        {loading ? (
          <ActivityIndicator color={c.blue} style={{ marginTop: 40 }} />
        ) : empleados.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="people-outline" size={48} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>
              No hay empleados registrados
            </Text>
          </View>
        ) : (
          empleados.map((emp, i) => (
            <ThemedCard key={i} style={styles.empCard}>
              <View style={[styles.avatar, { backgroundColor: c.blue + "22" }]}>
                <Text style={[styles.avatarText, { color: c.blue }]}>
                  {emp.nombre[0]}{emp.apellido?.[0] ?? ""}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.empName, { color: c.text }]}>
                  {emp.nombre} {emp.apellido}
                </Text>
                <Text style={[styles.empEmail, { color: c.sub }]}>{emp.email}</Text>
                {emp.canApproveOrders && (
                  <TagChip label="Rol temporal" variant="warning" />
                )}
              </View>
              <MaterialIcons name="chevron-right" size={20} color={c.sub} />
            </ThemedCard>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  subHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 16, borderBottomWidth: 1,
  },
  title:     { fontSize: 22, fontFamily: "Syne_700Bold" },
  addBtn:    { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  scroll:    { padding: 20, gap: 12 },
  formCard:  { gap: 12 },
  formTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_600SemiBold", marginBottom: 4 },
  fieldLabel:{ fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  input: {
    height: 46, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 14,
  },
  saveBtn: {
    height: 48, borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  empty:     { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  empCard:   { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 16, fontFamily: "Syne_700Bold" },
  empName:    { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  empEmail:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
});
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackHeader }    from "../../components/ui/BackHeader";
import {
  collection, getDocs, query, where,
  doc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db }        from "../../services/firebase";
import { useThemeColors }  from "../../hooks/useThemeColors";
import { ThemedCard }      from "../../components/ui/ThemedCard";
import { TagChip }         from "../../components/ui/TagChip";
import { ScreenWrapper }   from "../../components/ui/ScreenWrapper";

interface Empleado {
  uid:                string;
  nombre:             string;
  apellido:           string;
  email:              string;
  canApproveOrders?:  boolean;
  canApproveReservas?:boolean;
  disponibleAgenda?:  boolean;
}

const EMPTY_FORM = { nombre: "", apellido: "", email: "", password: "" };

export function AdminEmpleadosScreen() {
  const c = useThemeColors();
  const [empleados,    setEmpleados]    = useState<Empleado[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [creando,      setCreando]      = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [showForm,     setShowForm]     = useState(false);
  // Edit modal
  const [editEmp,      setEditEmp]      = useState<Empleado | null>(null);
  const [editNombre,   setEditNombre]   = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editGuardando,setEditGuardando]= useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "empleado")))
      .then(snap => setEmpleados(snap.docs.map(d => d.data() as Empleado)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const crearEmpleado = async () => {
    const { nombre, apellido, email, password } = form;
    if (!nombre || !apellido || !email || !password) {
      Alert.alert("Faltan datos", "Completa todos los campos.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Contraseña corta", "Mínimo 6 caracteres.");
      return;
    }
    setCreando(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newEmp: Empleado = {
        uid:                credential.user.uid,
        nombre:             nombre.trim(),
        apellido:           apellido.trim(),
        email:              email.trim(),
        canApproveOrders:   false,
        canApproveReservas: false,
        disponibleAgenda:   false,
      };
      await setDoc(doc(db, "users", credential.user.uid), {
        ...newEmp,
        role:      "empleado",
        createdAt: serverTimestamp(),
        saldo:     0,
      });
      setEmpleados(prev => [...prev, newEmp]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      Alert.alert("✅ Empleado creado", `${newEmp.nombre} puede iniciar sesión.`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "No se pudo crear el empleado.");
    } finally { setCreando(false); }
  };

  const toggle = async (emp: Empleado, field: keyof Empleado) => {
    const nuevoValor = !emp[field];
    try {
      await updateDoc(doc(db, "users", emp.uid), { [field]: nuevoValor });
      setEmpleados(prev =>
        prev.map(e => e.uid === emp.uid ? { ...e, [field]: nuevoValor } : e)
      );
    } catch { Alert.alert("Error", "No se pudo actualizar."); }
  };

  const abrirEdicion = (emp: Empleado) => {
    setEditEmp(emp);
    setEditNombre(emp.nombre);
    setEditApellido(emp.apellido);
  };

  const guardarEdicion = async () => {
    if (!editEmp || !editNombre.trim() || !editApellido.trim()) return;
    setEditGuardando(true);
    try {
      await updateDoc(doc(db, "users", editEmp.uid), {
        nombre: editNombre.trim(), apellido: editApellido.trim(),
      });
      setEmpleados(prev => prev.map(e =>
        e.uid === editEmp.uid
          ? { ...e, nombre: editNombre.trim(), apellido: editApellido.trim() }
          : e
      ));
      setEditEmp(null);
    } catch { Alert.alert("Error", "No se pudo guardar."); }
    finally { setEditGuardando(false); }
  };

  return (
    <ScreenWrapper keyboard={false}>
      <BackHeader title="Empleados" />

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Botón nuevo empleado */}
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={[styles.addBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name={showForm ? "close" : "person-add"} size={18} color="#000" />
          <Text style={styles.addBtnText}>{showForm ? "Cancelar" : "Nuevo empleado"}</Text>
        </TouchableOpacity>

        {/* Formulario crear */}
        {showForm && (
          <ThemedCard style={styles.formCard}>
            <Text style={[styles.formTitle, { color: c.text }]}>Crear empleado</Text>
            {[
              { key: "nombre",   label: "Nombre",     placeholder: "Juan" },
              { key: "apellido", label: "Apellido",    placeholder: "Pérez" },
              { key: "email",    label: "Correo",      placeholder: "juan@harrys.com" },
              { key: "password", label: "Contraseña",  placeholder: "Mínimo 6 caracteres", secure: true },
            ].map(f => (
              <View key={f.key} style={{ gap: 4 }}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>{f.label.toUpperCase()}</Text>
                <TextInput
                  style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                  value={form[f.key as keyof typeof form]}
                  onChangeText={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={c.sub}
                  secureTextEntry={!!f.secure}
                  autoCapitalize={f.key === "email" ? "none" : "words"}
                  keyboardType={f.key === "email" ? "email-address" : "default"}
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={crearEmpleado}
              disabled={creando}
              style={[styles.crearBtn, { backgroundColor: c.positive }]}
            >
              {creando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.crearBtnText}>Crear empleado</Text>
              }
            </TouchableOpacity>
          </ThemedCard>
        )}

        {/* Lista empleados */}
        {loading ? (
          <ActivityIndicator color={c.blue} style={{ marginTop: 40 }} />
        ) : empleados.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="group" size={48} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>Sin empleados registrados</Text>
          </View>
        ) : (
          empleados.map((emp, i) => (
            <ThemedCard key={i} style={styles.empCard}>
              {/* Header */}
              <View style={styles.empHeader}>
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
                </View>
                <TouchableOpacity onPress={() => abrirEdicion(emp)} style={styles.editBtn}>
                  <MaterialIcons name="edit" size={17} color={c.sub} />
                </TouchableOpacity>
              </View>

              {/* Toggles */}
              <View style={[styles.divider, { borderTopColor: c.border }]} />

              {[
                { field: "disponibleAgenda",   label: "Disponible en agenda",    icon: "event-available",  color: c.amber },
                { field: "canApproveOrders",    label: "Puede aprobar pedidos",    icon: "shopping-bag",     color: c.positive },
                { field: "canApproveReservas",  label: "Puede aprobar reservas",   icon: "event-note",       color: c.blue },
              ].map(t => (
                <View key={t.field} style={styles.toggleRow}>
                  <MaterialIcons name={t.icon as any} size={16} color={emp[t.field as keyof Empleado] ? t.color : c.sub} />
                  <Text style={[styles.toggleLabel, { color: emp[t.field as keyof Empleado] ? c.text : c.sub, flex: 1 }]}>
                    {t.label}
                  </Text>
                  <Switch
                    value={!!emp[t.field as keyof Empleado]}
                    onValueChange={() => toggle(emp, t.field as keyof Empleado)}
                    trackColor={{ false: c.border, true: t.color + "66" }}
                    thumbColor={emp[t.field as keyof Empleado] ? t.color : c.sub}
                  />
                </View>
              ))}
            </ThemedCard>
          ))
        )}
      </ScrollView>

      {/* Modal editar */}
      <Modal visible={!!editEmp} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Editar empleado</Text>
            {[
              { label: "Nombre",   value: editNombre,   set: setEditNombre },
              { label: "Apellido", value: editApellido, set: setEditApellido },
            ].map((f, i) => (
              <View key={i} style={{ gap: 6 }}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>{f.label.toUpperCase()}</Text>
                <TextInput
                  style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                  value={f.value}
                  onChangeText={f.set}
                  autoCapitalize="words"
                  placeholderTextColor={c.sub}
                />
              </View>
            ))}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setEditEmp(null)}
                style={[styles.modalBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.modalBtnText, { color: c.sub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={guardarEdicion}
                disabled={editGuardando}
                style={[styles.modalBtn, { backgroundColor: c.amber }]}
              >
                {editGuardando
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[styles.modalBtnText, { color: "#000" }]}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20, gap: 14 },
  addBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 12 },
  addBtnText:   { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  formCard:     { gap: 12 },
  formTitle:    { fontSize: 17, fontFamily: "Syne_700Bold" },
  inputLabel:   { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  input:        { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular" },
  crearBtn:     { height: 48, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  crearBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#fff" },
  empty:        { alignItems: "center", marginTop: 40, gap: 12 },
  emptyText:    { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  empCard:      { gap: 10 },
  empHeader:    { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText:   { fontSize: 16, fontFamily: "Syne_700Bold" },
  empName:      { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  empEmail:     { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  editBtn:      { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  divider:      { borderTopWidth: 1, marginVertical: 4 },
  toggleRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleLabel:  { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 },
  modalTitle:   { fontSize: 20, fontFamily: "Syne_700Bold" },
  modalBtns:    { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn:     { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});

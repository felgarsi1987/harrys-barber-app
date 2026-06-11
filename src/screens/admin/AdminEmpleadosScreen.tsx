import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, Modal,
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
import { auth, db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Empleado {
  uid:               string;
  nombre:            string;
  apellido:          string;
  email:             string;
  canApproveOrders?: boolean;
  disponibleAgenda?: boolean;
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
    } catch(e) { /* */ }
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
        uid:               credential.user.uid,
        nombre:            form.nombre.trim(),
        apellido:          form.apellido.trim(),
        email:             form.email.trim(),
        canApproveOrders:  false,
        disponibleAgenda:  false,
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
        e.uid === editEmp.uid ? { ...e, nombre: editNombre.trim(), apellido: editApellido.trim() } : e
      ));
      setEditEmp(null);
    } catch { Alert.alert("Error", "No se pudo guardar."); }
    finally { setEditGuardando(false); }
  };

  const toggleDisponibilidad = async (emp: Empleado) => {
    const nuevo = !emp.disponibleAgenda;
    try {
      await updateDoc(doc(db, "users", emp.uid), { disponibleAgenda: nuevo });
      setEmpleados(prev =>
        prev.map(e => e.uid === emp.uid ? { ...e, disponibleAgenda: nuevo } : e)
      );
    } catch {
      Alert.alert("Error", "No se pudo actualizar la disponibilidad.");
    }
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
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.empName,  { color: c.text }]}>
                  {emp.nombre} {emp.apellido}
                </Text>
                <Text style={[styles.empEmail, { color: c.sub }]}>{emp.email}</Text>
                <View style={styles.disponRow}>
                  <MaterialIcons
                    name={emp.disponibleAgenda ? "event-available" : "event-busy"}
                    size={13}
                    color={emp.disponibleAgenda ? c.positive : c.sub}
                  />
                  <Text style={[styles.disponLabel, {
                    color: emp.disponibleAgenda ? c.positive : c.sub
                  }]}>
                    {emp.disponibleAgenda ? "Disponible en agenda" : "No disponible"}
                  </Text>
                </View>
                {emp.canApproveOrders && (
                  <TagChip label="Rol temporal" variant="warning" />
                )}
              </View>
              <TouchableOpacity onPress={() => abrirEdicion(emp)} style={{ padding: 4 }}>
                <MaterialIcons name="edit" size={18} color={c.sub} />
              </TouchableOpacity>
              <Switch
                value={emp.disponibleAgenda ?? false}
                onValueChange={() => toggleDisponibilidad(emp)}
                trackColor={{ false: c.border, true: c.amber + "66" }}
                thumbColor={emp.disponibleAgenda ? c.amber : c.sub}
              />
            </ThemedCard>
          ))
        )}
      </ScrollView>
      {/* Modal editar nombre */}
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
                  placeholder={f.label}
                  placeholderTextColor={c.sub}
                />
              </View>
            ))}
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setEditEmp(null)} style={[styles.modalBtn, { borderColor: c.border }]}>
                <Text style={[styles.modalBtnText, { color: c.sub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={guardarEdicion} disabled={editGuardando} style={[styles.modalBtn, { backgroundColor: c.amber }]}>
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
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular",
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
  disponRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"flex-end" },
  modalCard:    { borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, gap:14 },
  modalTitle:   { fontSize:20, fontFamily:"Syne_700Bold" },
  inputLabel:   { fontSize:10, fontFamily:"SpaceGrotesk_600SemiBold", letterSpacing:2 },
  modalBtns:    { flexDirection:"row", gap:10, marginTop:4 },
  modalBtn:     { flex:1, height:48, borderRadius:10, borderWidth:1, justifyContent:"center", alignItems:"center" },
  modalBtnText: { fontSize:15, fontFamily:"SpaceGrotesk_600SemiBold" },
  disponLabel:{ fontSize: 11, fontFamily: "SpaceGrotesk_500Medium" },
});
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, Image, TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, query, where,
  orderBy, limit,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { TagChip }        from "../../components/ui/TagChip";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { AixonFooter }   from "../../components/ui/AixonFooter";

interface Reserva {
  id:       string;
  servicio: string;
  hora:     string;
  estado:   string;
  fecha:    any;
}

interface Evento {
  id:          string;
  titulo:      string;
  descripcion: string;
}

export function ClienteHomeScreen() {
  const c = useThemeColors();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [proximaCita, setProximaCita] = useState<Reserva | null>(null);
  const [evento,      setEvento]      = useState<Evento | null>(null);

  const isBirthday = () => {
    if (!user?.birthdate) return false;
    const hoy = new Date();
    const bd  = new Date(user.birthdate);
    return bd.getMonth() === hoy.getMonth() && bd.getDate() === hoy.getDate();
  };

  useEffect(() => {
    if (user?.uid) {
      getDocs(query(
        collection(db, "reservas"),
        where("clienteUid", "==", user.uid),
        where("estado", "in", ["pendiente", "confirmada"]),
        orderBy("fecha", "asc"),
        limit(1)
      )).then(snap => {
        if (!snap.empty) {
          setProximaCita({ id: snap.docs[0].id, ...snap.docs[0].data() } as Reserva);
        }
      }).catch(console.log);
    }

    getDocs(query(
      collection(db, "eventos"),
      where("activo", "==", true),
      limit(1)
    )).then(snap => {
      if (!snap.empty) {
        setEvento({ id: snap.docs[0].id, ...snap.docs[0].data() } as Evento);
      }
    }).catch(console.log);
  }, [user?.uid]);

  const ESTADO_CHIP: Record<string, any> = {
    pendiente:  "warning",
    confirmada: "success",
    aplazada:   "info",
    negada:     "danger",
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Image
          source={require("../../assets/images/harrys_logo_clean.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerCenter}>
          <Text style={[styles.brand,    { color: c.text  }]}>HARRYS</Text>
          <Text style={[styles.brandSub, { color: c.amber }]}>BARBER SHOP</Text>
        </View>
        <TouchableOpacity style={[styles.notifBtn, { borderColor: c.border }]}>
          <MaterialIcons name="notifications-none" size={20} color={c.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Saludo */}
        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: c.sub }]}>
            {isBirthday() ? "🎂 ¡Feliz cumpleaños!" : "Bienvenido,"}
          </Text>
          <Text style={[styles.greetingName, { color: c.text }]}>
            {user?.nombre} {user?.apellido}
          </Text>
          {isBirthday() && (
            <Text style={[styles.birthdayMsg, { color: c.amber }]}>
              Tu corte de hoy es gratis 🎉
            </Text>
          )}
        </View>

        {/* Banner evento activo */}
        {evento && (
          <ThemedCard style={styles.eventoBanner} elevated>
            <View style={styles.eventoTop}>
              <MaterialIcons name="campaign" size={18} color={c.amber} />
              <Text style={[styles.eventoTag, { color: c.amber }]}>EVENTO ACTIVO</Text>
            </View>
            <Text style={[styles.eventoTitulo, { color: c.text }]}>{evento.titulo}</Text>
            <Text style={[styles.eventoDesc,   { color: c.sub  }]}>{evento.descripcion}</Text>
          </ThemedCard>
        )}

        {/* Próxima cita */}
        <Text style={[styles.sectionTitle, { color: c.sub }]}>TU PRÓXIMA CITA</Text>
        {proximaCita ? (
          <ThemedCard style={styles.citaCard}>
            <View style={styles.citaTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.citaServicio, { color: c.text }]}>
                  {proximaCita.servicio}
                </Text>
                <Text style={[styles.citaHora, { color: c.sub }]}>
                  {proximaCita.hora}
                </Text>
              </View>
              <TagChip
                label={proximaCita.estado}
                variant={ESTADO_CHIP[proximaCita.estado] ?? "default"}
              />
            </View>
          </ThemedCard>
        ) : (
          <ThemedCard style={styles.noCitaCard}>
            <MaterialIcons name="event-available" size={32} color={c.sub} />
            <Text style={[styles.noCitaText, { color: c.sub }]}>
              No tienes citas próximas
            </Text>
            <TouchableOpacity
              style={[styles.agendarBtn, { backgroundColor: c.amber }]}
              onPress={() => navigation.navigate("Agendar")}
            >
              <Text style={styles.agendarBtnText}>Agendar ahora</Text>
            </TouchableOpacity>
          </ThemedCard>
        )}

        {/* Servicios */}
        <Text style={[styles.sectionTitle, { color: c.sub }]}>SERVICIOS</Text>
        <View style={styles.serviciosGrid}>
          {SERVICIOS.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.servicioCard, { borderColor: c.border }]}
              activeOpacity={0.7}
            >
              <MaterialIcons name={s.icon as any} size={20} color={c.text} />
              <Text style={[styles.servicioLabel,  { color: c.text  }]}>{s.label}</Text>
              <Text style={[styles.servicioPrecio, { color: c.amber }]}>{s.precio}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      <AixonFooter />
    </SafeAreaView>
  );
}

const SERVICIOS = [
  { icon: "content-cut",  label: "Corte",        precio: "Desde $15.000" },
  { icon: "face",         label: "Barba",         precio: "Desde $10.000" },
  { icon: "auto-awesome", label: "Corte + Barba", precio: "Desde $22.000" },
];

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, gap: 12,
  },
  logo:         { width: 40, height: 40, borderRadius: 20 },
  headerCenter: { flex: 1, gap: 1 },
  brand:        { fontSize: 14, fontFamily: "Syne_800ExtraBold", letterSpacing: 3 },
  brandSub:     { fontSize: 8,  fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 2 },
  notifBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  scroll:        { padding: 20, gap: 20 },
  greetingBlock: { gap: 4 },
  greeting:      { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  greetingName:  { fontSize: 24, fontFamily: "Syne_800ExtraBold" },
  birthdayMsg:   { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  eventoBanner:  { gap: 8 },
  eventoTop:     { flexDirection: "row", alignItems: "center", gap: 6 },
  eventoTag:     { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  eventoTitulo:  { fontSize: 16, fontFamily: "Syne_700Bold" },
  eventoDesc:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  sectionTitle:  { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  citaCard:      { gap: 8 },
  citaTop:       { flexDirection: "row", alignItems: "center", gap: 12 },
  citaServicio:  { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  citaHora:      { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  noCitaCard:    { alignItems: "center", gap: 12, paddingVertical: 24 },
  noCitaText:    { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  agendarBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, marginTop: 4,
  },
  agendarBtnText: { color: "#000", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13 },
  serviciosGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servicioCard: {
    width: "47.5%", borderWidth: 1, borderRadius: 12, padding: 14, gap: 6,
  },
  servicioLabel:  { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicioPrecio: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
});
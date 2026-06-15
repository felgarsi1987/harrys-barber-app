import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Linking,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getNoticias, NoticiaFutbol } from "../../services/futbolNoticiasService";

export function FutbolWidget() {
  const c = useThemeColors();
  const [noticias, setNoticias] = useState<NoticiaFutbol[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    getNoticias(8)
      .then(data => { setNoticias(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const abrirNoticia = (url: string) => {
    if (url) Linking.openURL(url);
  };

  return (
    <Animated.View entering={FadeIn.delay(200).duration(500)}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>⚽</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>
            Mientras esperas tu turno
          </Text>
          <Text style={[styles.headerSub, { color: c.sub }]}>
            Noticias del fútbol mundial
          </Text>
        </View>
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={c.amber} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <MaterialIcons name="wifi-off" size={28} color={c.sub} />
          <Text style={[styles.errorText, { color: c.sub }]}>
            Sin conexión a noticias
          </Text>
        </View>
      ) : noticias.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorText, { color: c.sub }]}>Sin noticias disponibles</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {noticias.map((n, i) => (
            <Animated.View
              key={n.id}
              entering={FadeInDown.delay(i * 60).duration(320)}
            >
              <NoticiaCard noticia={n} c={c} onPress={() => abrirNoticia(n.url)} />
            </Animated.View>
          ))}
        </ScrollView>
      )}

    </Animated.View>
  );
}

function NoticiaCard({ noticia: n, c, onPress }: {
  noticia: NoticiaFutbol;
  c: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      {/* Imagen */}
      {n.imagen ? (
        <Image
          source={{ uri: n.imagen }}
          style={styles.cardImg}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cardImgPlaceholder, { backgroundColor: c.border }]}>
          <Text style={styles.cardImgEmoji}>⚽</Text>
        </View>
      )}

      {/* Cuerpo */}
      <View style={styles.cardBody}>
        <Text style={[styles.cardFuente, { color: c.amber }]} numberOfLines={1}>
          {n.fuente}  ·  {n.fecha}
        </Text>
        <Text style={[styles.cardTitulo, { color: c.text }]} numberOfLines={3}>
          {n.titulo}
        </Text>
        {n.resumen ? (
          <Text style={[styles.cardResumen, { color: c.sub }]} numberOfLines={2}>
            {n.resumen}
          </Text>
        ) : null}
      </View>

      {/* Leer más */}
      <View style={[styles.cardFooter, { borderTopColor: c.border }]}>
        <Text style={[styles.leerMas, { color: c.amber }]}>Leer más</Text>
        <MaterialIcons name="arrow-forward" size={12} color={c.amber} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  headerEmoji: { fontSize: 24 },
  headerTitle: { fontSize: 15, fontFamily: "Syne_700Bold" },
  headerSub:   { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 1 },

  centerBox:   { height: 80, justifyContent: "center", alignItems: "center", gap: 8 },
  errorText:   { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },

  scrollRow:   { gap: 12, paddingBottom: 4 },

  card: {
    width: 220, borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  cardImg: {
    width: "100%", height: 120,
  },
  cardImgPlaceholder: {
    width: "100%", height: 120, justifyContent: "center", alignItems: "center",
  },
  cardImgEmoji: { fontSize: 36 },

  cardBody: { padding: 12, gap: 6 },
  cardFuente: {
    fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 0.5,
  },
  cardTitulo: {
    fontSize: 13, fontFamily: "Syne_700Bold", lineHeight: 18,
  },
  cardResumen: {
    fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", lineHeight: 15,
  },

  cardFooter: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1,
  },
  leerMas: { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
});

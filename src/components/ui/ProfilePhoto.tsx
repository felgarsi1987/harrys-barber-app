import React, { useState } from "react";
import { View, Image, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  uid:        string;
  photoURL?:  string;
  nombre:     string;
  size?:      number;
  editable?:  boolean;
  onUpdated?: (url: string) => void;
}

export function ProfilePhoto({ uid, photoURL, nombre, size = 80, editable = false, onUpdated }: Props) {
  const c = useThemeColors();
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(photoURL);

  const pickImage = async () => {
    Alert.alert("Foto de perfil", "¿De dónde quieres elegir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "📷 Cámara",  onPress: () => openPicker("camera") },
      { text: "🖼️ Galería", onPress: () => openPicker("library") },
    ]);
  };

  const openPicker = async (source: "camera" | "library") => {
    const perm = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (perm.status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso para cambiar tu foto.");
      return;
    }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, aspect: [1,1], quality: 0.7,
        });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const uri      = result.assets[0].uri;
      const response = await fetch(uri);
      const blob     = await response.blob();
      const imgRef   = ref(storage, `profiles/${uid}.jpg`);
      await uploadBytes(imgRef, blob);
      const url = await getDownloadURL(imgRef);
      await updateDoc(doc(db, "users", uid), { photoURL: url });
      setCurrentUrl(url);
      onUpdated?.(url);
      Alert.alert("✅ Foto actualizada");
    } catch {
      Alert.alert("Error", "No se pudo subir la foto.");
    } finally { setUploading(false); }
  };

  const initials = nombre.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();

  return (
    <TouchableOpacity
      onPress={editable ? pickImage : undefined}
      disabled={!editable || uploading}
      style={[styles.container, { width: size, height: size, borderRadius: size/2 }]}
    >
      {currentUrl ? (
        <Image source={{ uri: currentUrl }} style={{ width: size, height: size, borderRadius: size/2 }} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size/2, backgroundColor: c.amber + "22" }]}>
          <MaterialIcons name="person" size={size * 0.45} color={c.amber} />
        </View>
      )}
      {uploading && (
        <View style={[styles.overlay, { borderRadius: size/2 }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      {editable && !uploading && (
        <View style={[styles.editBadge, { backgroundColor: c.amber }]}>
          <MaterialIcons name="camera-alt" size={12} color="#000" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { position: "relative" },
  placeholder: { justifyContent: "center", alignItems: "center" },
  overlay:     { position: "absolute", top:0, left:0, right:0, bottom:0, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center", alignItems:"center" },
  editBadge:   { position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:12, justifyContent:"center", alignItems:"center" },
});

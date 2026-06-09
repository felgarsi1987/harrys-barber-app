import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  await updateDoc(doc(db, "users", userId), { pushToken: token });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name:             "Harrys Barber",
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       "#0511F2",
    });
  }

  return token;
}

export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

// ── Enviar push al cliente cuando cambia su reserva ──────────────────────────
export async function notificarCambioEstado(
  clienteUid: string | null | undefined,
  clienteNombre: string,
  servicio: string,
  nuevoEstado: string,
  hora?: string,
) {
  if (!clienteUid) return; // cliente sin registro no tiene token

  try {
    const { getDoc, doc } = await import("firebase/firestore");
    const { db } = await import("./firebase");

    const snap = await getDoc(doc(db, "users", clienteUid));
    if (!snap.exists()) return;

    const pushToken: string | undefined = snap.data().pushToken;
    if (!pushToken) return;

    const mensajes: Record<string, { title: string; body: string }> = {
      confirmada: {
        title: "✅ Cita confirmada",
        body:  `Tu cita de ${servicio} a las ${hora ?? ""} está confirmada. ¡Te esperamos!`,
      },
      aplazada: {
        title: "📅 Cita aplazada",
        body:  `Tu cita de ${servicio} fue aplazada. El equipo te contactará para reagendar.`,
      },
      negada: {
        title: "❌ Cita no disponible",
        body:  `Lo sentimos, tu cita de ${servicio} no pudo ser agendada.`,
      },
      completada: {
        title: "🎉 Servicio completado",
        body:  `Gracias por visitarnos, ${clienteNombre.split(" ")[0]}. ¡Hasta la próxima!`,
      },
      fallida: {
        title: "⚠️ Cita no realizada",
        body:  `Tu cita de ${servicio} fue marcada como no realizada.`,
      },
    };

    const msg = mensajes[nuevoEstado];
    if (!msg) return;

    // Expo Push Notifications API
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to:    pushToken,
        title: msg.title,
        body:  msg.body,
        sound: "default",
        data:  { estado: nuevoEstado },
      }),
    });
  } catch (e) {
    console.log("Push notification error:", e);
  }
}

// ── Programar recordatorio local 1h antes de la cita ─────────────────────────
export async function programarRecordatorio(
  reservaId: string,
  servicio: string,
  fechaCita: Date,
  peluqueroNombre?: string,
) {
  try {
    // Cancelar cualquier recordatorio previo con mismo identifier
    await Notifications.cancelScheduledNotificationAsync(reservaId).catch(() => {});

    const unHoraAntes = new Date(fechaCita.getTime() - 60 * 60 * 1000);
    if (unHoraAntes <= new Date()) return; // ya pasó

    await Notifications.scheduleNotificationAsync({
      identifier: reservaId,
      content: {
        title: "⏰ Tu cita es en 1 hora",
        body:  `${servicio}${peluqueroNombre ? ` con ${peluqueroNombre}` : ""} — ¡No olvides venir!`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: unHoraAntes },
    });
  } catch (e) {
    console.log("Schedule reminder error:", e);
  }
}

// ── Cancelar recordatorio al negar/aplazar una cita ──────────────────────────
export async function cancelarRecordatorio(reservaId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(reservaId);
  } catch {}
}

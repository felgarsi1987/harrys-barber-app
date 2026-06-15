import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// ── Configuración global de notificaciones ───────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ── Registrar dispositivo para push notifications ────────────────────────────
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: "e1e52c92-60ac-4c73-85e4-007716a48dad",
    })).data;
    await updateDoc(doc(db, "users", userId), { pushToken: token });

    if (Platform.OS === "android") {
      // Canal principal — reservas y estados
      await Notifications.setNotificationChannelAsync("reservas", {
        name:             "Reservas",
        description:      "Confirmaciones, cambios y recordatorios de citas",
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor:       "#F2B90C",
        sound:            "default",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd:        false,
      });

      // Canal pedidos
      await Notifications.setNotificationChannelAsync("pedidos", {
        name:             "Pedidos",
        description:      "Estados de pedidos y aprobaciones",
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor:       "#22C55E",
        sound:            "default",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // Canal pagos
      await Notifications.setNotificationChannelAsync("pagos", {
        name:             "Pagos y créditos",
        description:      "Recordatorios de saldo y abonos",
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor:       "#F43F5E",
        sound:            "default",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    return token;
  } catch { return null; }
}

// ── Enviar push mediante Expo Push API ───────────────────────────────────────
async function enviarPush(
  pushToken:   string,
  title:       string,
  body:        string,
  data?:       Record<string, any>,
  channelId?:  string,
  subtitle?:   string,
) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify({
        to:         pushToken,
        title,
        body,
        subtitle:   subtitle ?? undefined,
        sound:      "default",
        data:       data ?? {},
        channelId:  channelId ?? "reservas",
        priority:   "high",
        badge:      1,
      }),
    });
  } catch {}
}

// ── Obtener pushToken de un usuario ──────────────────────────────────────────
async function getPushToken(uid: string): Promise<string | null> {
  try {
    const { getDoc, doc: fsDoc } = await import("firebase/firestore");
    const snap = await getDoc(fsDoc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data().pushToken ?? null;
  } catch { return null; }
}

// ── Notificar cambio de estado de reserva ───────────────────────────────────
export async function notificarCambioEstado(
  clienteUid:    string | null | undefined,
  clienteNombre: string,
  servicio:      string,
  nuevoEstado:   string,
  hora?:         string,
) {
  if (!clienteUid) return;

  const pushToken = await getPushToken(clienteUid);
  if (!pushToken) return;

  const nombre = clienteNombre.split(" ")[0];
  const horaTxt = hora ? ` a las ${hora}` : "";

  const mensajes: Record<string, { title: string; body: string; subtitle?: string }> = {
    confirmada: {
      title:    "✅ ¡Cita confirmada!",
      subtitle: `${servicio}${horaTxt}`,
      body:     `Hola ${nombre}, tu reserva está lista. Te esperamos ${horaTxt} 💈`,
    },
    aplazada: {
      title:    "📅 Cita aplazada",
      subtitle: servicio,
      body:     `Hola ${nombre}, tu cita de ${servicio} fue aplazada. El equipo te contactará pronto para reagendar.`,
    },
    negada: {
      title:    "❌ Cita no disponible",
      subtitle: servicio,
      body:     `Lo sentimos ${nombre}, no podemos atender tu cita de ${servicio}. Intenta agendar en otro horario.`,
    },
    completada: {
      title:    "🎉 ¡Gracias por visitarnos!",
      subtitle: "Harry's Barber Shop",
      body:     `${nombre}, fue un placer atenderte. ¡Vuelve pronto! 💈⭐`,
    },
    fallida: {
      title:    "⚠️ Cita no realizada",
      subtitle: servicio,
      body:     `Tu cita de ${servicio} fue marcada como no realizada${horaTxt}. Contáctanos si necesitas ayuda.`,
    },
  };

  const msg = mensajes[nuevoEstado];
  if (!msg) return;

  await enviarPush(pushToken, msg.title, msg.body, { estado: nuevoEstado, servicio }, "reservas", msg.subtitle);
}

// ── Notificar al empleado cuando se le asigna una reserva ───────────────────
export async function notificarEmpleadoAsignado(
  empleadoUid:   string,
  clienteNombre: string,
  servicio:      string,
  fecha:         string,
  hora:          string,
) {
  const pushToken = await getPushToken(empleadoUid);
  if (!pushToken) return;

  await enviarPush(
    pushToken,
    "📋 Nueva cita asignada",
    `${clienteNombre} — ${servicio}\n${fecha} a las ${hora}`,
    { tipo: "asignacion" },
    "reservas",
    `${fecha} · ${hora}`,
  );
}

// ── Notificar estado de pedido al cliente ────────────────────────────────────
export async function notificarEstadoPedido(
  clienteUid: string,
  estado:     "aprobado" | "rechazado" | "entregado",
  total:      number,
) {
  const pushToken = await getPushToken(clienteUid);
  if (!pushToken) return;

  const msgs = {
    aprobado: {
      title: "✅ Pedido aprobado",
      body:  `Tu pedido por $${total.toLocaleString("es-CO")} fue aprobado. Pasa a recogerlo 🛍️`,
    },
    rechazado: {
      title: "❌ Pedido rechazado",
      body:  `Tu pedido por $${total.toLocaleString("es-CO")} no pudo ser procesado. Contáctanos.`,
    },
    entregado: {
      title: "📦 Pedido entregado",
      body:  `Tu pedido fue entregado. ¡Gracias por tu compra! 🎉`,
    },
  };

  const msg = msgs[estado];
  await enviarPush(pushToken, msg.title, msg.body, { tipo: "pedido", estado }, "pedidos");
}

// ── Notificar abono registrado ───────────────────────────────────────────────
export async function notificarAbono(
  clienteUid:   string,
  clienteNombre: string,
  monto:         number,
  saldoRestante: number,
) {
  const pushToken = await getPushToken(clienteUid);
  if (!pushToken) return;

  const nombre = clienteNombre.split(" ")[0];
  const body = saldoRestante > 0
    ? `Hola ${nombre}, se registró un abono de $${monto.toLocaleString("es-CO")}. Saldo restante: $${saldoRestante.toLocaleString("es-CO")}`
    : `Hola ${nombre}, registramos tu pago de $${monto.toLocaleString("es-CO")}. ¡Ya estás al día! 🎉`;

  await enviarPush(
    pushToken,
    saldoRestante > 0 ? "💳 Abono registrado" : "✅ ¡Saldo al día!",
    body,
    { tipo: "abono" },
    "pagos",
  );
}

// ── Recordatorio de saldo pendiente ─────────────────────────────────────────
export async function notificarSaldoPendiente(
  clienteUid:    string,
  clienteNombre: string,
  saldo:         number,
) {
  const pushToken = await getPushToken(clienteUid);
  if (!pushToken) return;

  const nombre = clienteNombre.split(" ")[0];
  await enviarPush(
    pushToken,
    "💳 Tienes un saldo pendiente",
    `Hola ${nombre}, recuerda que tienes un saldo pendiente de $${saldo.toLocaleString("es-CO")}. Pasa por la barbería para ponerte al día.`,
    { tipo: "saldo" },
    "pagos",
  );
}

// ── Programar recordatorio 1h antes de la cita ──────────────────────────────
export async function programarRecordatorio(
  reservaId:       string,
  servicio:        string,
  fechaCita:       Date,
  peluqueroNombre?: string,
) {
  try {
    await Notifications.cancelScheduledNotificationAsync(reservaId).catch(() => {});

    const unHoraAntes = new Date(fechaCita.getTime() - 60 * 60 * 1000);
    if (unHoraAntes <= new Date()) return;

    const hora = fechaCita.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

    await Notifications.scheduleNotificationAsync({
      identifier: reservaId,
      content: {
        title:    "⏰ Tu cita es en 1 hora",
        body:     `${servicio}${peluqueroNombre ? ` con ${peluqueroNombre}` : ""} a las ${hora} — ¡Prepárate! 💈`,
        sound:    true,
        data:     { tipo: "recordatorio", reservaId },
        ...(Platform.OS === "android" && { channelId: "reservas" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: unHoraAntes,
      },
    });
  } catch {}
}

// ── Notificar cancelación de reserva ────────────────────────────────────────
export async function notificarCancelacion(
  uid:          string | null | undefined,
  nombre:       string,
  servicio:     string,
  hora?:        string,
  canceladoPor: "cliente" | "admin" | "empleado" = "admin",
) {
  if (!uid) return;
  const pushToken = await getPushToken(uid);
  if (!pushToken) return;

  const primerNombre = nombre.split(" ")[0];
  await enviarPush(
    pushToken,
    "❌ Cita cancelada",
    `Hola ${primerNombre}, tu cita de ${servicio}${hora ? ` a las ${hora}` : ""} ha sido cancelada.`,
    { tipo: "cancelacion", servicio },
    "reservas",
    servicio,
  );
}

// ── Programar resumen diario para el admin ──────────────────────────────────
export async function programarResumenDiario(
  adminUid:    string,
  totalCitas:  number,
  hora:        string = "07:00",
) {
  try {
    await Notifications.cancelScheduledNotificationAsync("resumen_diario").catch(() => {});

    const [hh, mm] = hora.split(":").map(Number);
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(hh, mm, 0, 0);

    await Notifications.scheduleNotificationAsync({
      identifier: "resumen_diario",
      content: {
        title:    "📋 Resumen del día",
        body:     totalCitas > 0
          ? `Hoy tienes ${totalCitas} cita${totalCitas !== 1 ? "s" : ""} programada${totalCitas !== 1 ? "s" : ""}. ¡Buen día! 💈`
          : "No hay citas programadas para hoy. Buen momento para revisar el inventario.",
        sound:    true,
        data:     { tipo: "resumen_diario" },
        ...(Platform.OS === "android" && { channelId: "reservas" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: manana,
      },
    });
  } catch {}
}

// ── Cancelar recordatorio ────────────────────────────────────────────────────
export async function cancelarRecordatorio(reservaId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(reservaId);
  } catch {}
}

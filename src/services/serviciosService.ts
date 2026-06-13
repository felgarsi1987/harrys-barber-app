/**
 * serviciosService.ts
 * Fuente única de verdad para los servicios de la barbería.
 * Lee de la colección "servicios" en Firestore.
 * Si está vacía, inserta los servicios por defecto.
 */
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Servicio {
  id:       string;
  label:    string;
  precio:   number;
  duracion: number; // minutos
  activo:   boolean;
  orden:    number;
}

const DEFAULTS: Omit<Servicio, "id">[] = [
  { label: "Corte clásico", precio: 15000, duracion: 30, activo: true, orden: 0 },
  { label: "Corte + Barba", precio: 22000, duracion: 45, activo: true, orden: 1 },
  { label: "Barba",         precio: 10000, duracion: 20, activo: true, orden: 2 },
];

export async function getServicios(): Promise<Servicio[]> {
  try {
    const snap = await getDocs(collection(db, "servicios"));

    if (snap.empty) {
      // Primera vez: insertar defaults
      for (const s of DEFAULTS) {
        await addDoc(collection(db, "servicios"), {
          ...s, createdAt: Timestamp.now(),
        });
      }
      return DEFAULTS.map((s, i) => ({ ...s, id: `default_${i}` }));
    }

    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Servicio))
      .filter(s => s.activo);
  } catch (e) {
    return DEFAULTS.map((s, i) => ({ ...s, id: `default_${i}` }));
  }
}

export async function getAllServicios(): Promise<Servicio[]> {
  const snap = await getDocs(collection(db, "servicios"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Servicio));
}

export async function crearServicio(data: Omit<Servicio, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "servicios"), {
    ...data, createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function actualizarServicio(id: string, data: Partial<Omit<Servicio, "id">>) {
  await updateDoc(doc(db, "servicios", id), { ...data, updatedAt: Timestamp.now() });
}

export async function eliminarServicio(id: string) {
  await deleteDoc(doc(db, "servicios", id));
}

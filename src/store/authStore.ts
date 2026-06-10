import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export type UserRole = "admin" | "empleado" | "cliente";

export interface AppUser {
  uid:               string;
  email:             string;
  role:              UserRole;
  nombre:            string;
  apellido:          string;
  telefono?:         string;
  birthdate?:        string;
  pushToken?:        string;
  photoURL?:         string;
  canApproveOrders?: boolean;
  saldo?:            number;
  categoria?:        "plata" | "oro" | "diamante";
}

interface RegisterData {
  nombre:    string;
  apellido:  string;
  email:     string;
  telefono:  string;
  birthdate: string;
  password:  string;
}

interface AuthState {
  user:         AppUser | null;
  firebaseUser: User | null;
  isLoading:    boolean;
  error:        string | null;
  login:        (email: string, password: string) => Promise<void>;
  logout:       () => Promise<void>;
  register:     (data: RegisterData) => Promise<void>;
  initialize:   () => () => void;
  clearError:   () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user:         null,
  firebaseUser: null,
  isLoading:    false,
  error:        null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      if (!snap.exists()) throw new Error("Perfil no encontrado.");
      set({
        user: snap.data() as AppUser,
        firebaseUser: credential.user,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: mapFirebaseError(e.code), isLoading: false });
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, firebaseUser: null });
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const credential = await createUserWithEmailAndPassword(
        auth, data.email, data.password
      );
      const newUser: AppUser = {
        uid:       credential.user.uid,
        email:     data.email,
        role:      "cliente",
        nombre:    data.nombre,
        apellido:  data.apellido,
        telefono:  data.telefono,
        birthdate: data.birthdate,
      };
      await setDoc(doc(db, "users", credential.user.uid), {
        ...newUser,
        createdAt: serverTimestamp(),
        saldo: 0,
      });
      set({
        user: newUser,
        firebaseUser: credential.user,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: mapFirebaseError(e.code), isLoading: false });
    }
  },

  initialize: () => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Si hay un login en curso, ignorar el evento de auth state
      if (get().isLoading) return;
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            set({
              user: snap.data() as AppUser,
              firebaseUser,
              isLoading: false,
            });
          } else {
            set({ user: null, firebaseUser: null, isLoading: false });
          }
        } catch {
          set({ user: null, firebaseUser: null, isLoading: false });
        }
      } else {
        set({ user: null, firebaseUser: null, isLoading: false });
      }
    });
    return unsub;
  },

  clearError: () => set({ error: null }),
}));

function mapFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/user-not-found":         "No existe una cuenta con ese correo.",
    "auth/wrong-password":         "Contraseña incorrecta.",
    "auth/invalid-credential":     "Correo o contraseña incorrectos.",
    "auth/email-already-in-use":   "Este correo ya está registrado.",
    "auth/invalid-email":          "Correo electrónico inválido.",
    "auth/too-many-requests":      "Demasiados intentos. Intenta más tarde.",
    "auth/network-request-failed": "Error de red. Verifica tu conexión.",
  };
  return map[code] ?? "Ocurrió un error inesperado.";
}
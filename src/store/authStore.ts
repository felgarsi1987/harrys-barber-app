import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export type UserRole = "admin" | "empleado" | "cliente";

export interface AppUser {
  uid:                string;
  email:              string;
  role:               UserRole;
  nombre:             string;
  apellido:           string;
  telefono?:          string;
  birthdate?:         string;
  pushToken?:         string;
  photoURL?:          string;
  canApproveOrders?:  boolean;
  canApproveReservas?:boolean;
  disponibleAgenda?:  boolean;
  saldo?:             number;
  categoria?:         "plata" | "oro" | "diamante";
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
  isLoading:    true,
  error:        null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // Sign out anonymous session first if active
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth);
      }
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      if (!snap.exists()) throw new Error("Perfil no encontrado.");
      const userData = { ...snap.data() as AppUser, uid: credential.user.uid };
      set({ user: userData, firebaseUser: credential.user, isLoading: false, error: null });
    } catch (e: any) {
      // Error: stay on login screen, show error message
      set({ user: null, isLoading: false, error: mapFirebaseError(e?.code) });
    }
  },

  logout: async () => {
    try { await signOut(auth); } catch {}
    set({ user: null, firebaseUser: null, isLoading: false, error: null });
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Prevent duplicate registration
      const methods = await fetchSignInMethodsForEmail(auth, data.email.trim());
      if (methods.length > 0) {
        set({ error: "Este correo ya está registrado.", isLoading: false });
        return;
      }
      const credential = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      const newUser: AppUser = {
        uid:       credential.user.uid,
        email:     data.email.trim(),
        role:      "cliente",
        nombre:    data.nombre.trim(),
        apellido:  data.apellido.trim(),
        telefono:  data.telefono,
        birthdate: data.birthdate,
      };
      await setDoc(doc(db, "users", credential.user.uid), {
        ...newUser, createdAt: serverTimestamp(), saldo: 0,
      });
      set({ user: newUser, firebaseUser: credential.user, isLoading: false, error: null });
    } catch (e: any) {
      set({ error: mapFirebaseError(e?.code), isLoading: false });
    }
  },

  initialize: () => {
    // Safety timeout - if Firebase doesn't respond in 8s, show auth screen
    const timeout = setTimeout(() => {
      if (get().isLoading) {
        set({ user: null, firebaseUser: null, isLoading: false });
      }
    }, 8000);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Don't cancel timeout here - only cancel after we've processed the event

      // Skip anonymous users - they belong to guest mode, not regular auth
      if (firebaseUser?.isAnonymous) {
        clearTimeout(timeout);
        set({ user: null, firebaseUser: null, isLoading: false });
        return;
      }

      // If a login() call is actively running, let it handle the state
      if (get().isLoading && get().user !== null) {
        clearTimeout(timeout);
        return;
      }

      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          clearTimeout(timeout);
          if (snap.exists()) {
            const userData = { ...snap.data() as AppUser, uid: firebaseUser.uid };
            set({ user: userData, firebaseUser, isLoading: false, error: null });
          } else {
            set({ user: null, firebaseUser: null, isLoading: false });
          }
        } catch {
          clearTimeout(timeout);
          set({ user: null, firebaseUser: null, isLoading: false });
        }
      } else {
        clearTimeout(timeout);
        set({ user: null, firebaseUser: null, isLoading: false });
      }
    });

    return () => { clearTimeout(timeout); unsub(); };
  },

  clearError: () => set({ error: null }),
}));

function mapFirebaseError(code?: string): string {
  if (!code) return "Ocurrió un error inesperado.";
  const map: Record<string, string> = {
    "auth/user-not-found":         "No existe una cuenta con ese correo.",
    "auth/wrong-password":         "Contraseña incorrecta.",
    "auth/invalid-credential":     "Correo o contraseña incorrectos.",
    "auth/email-already-in-use":   "Este correo ya está registrado.",
    "auth/invalid-email":          "Correo electrónico inválido.",
    "auth/too-many-requests":      "Demasiados intentos. Intenta más tarde.",
    "auth/network-request-failed": "Error de red. Verifica tu conexión.",
  };
  return map[code] ?? "Correo o contraseña incorrectos.";
}

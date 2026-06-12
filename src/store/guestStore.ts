import { create } from "zustand";
import { signInAnonymously, signOut } from "firebase/auth";
import { auth } from "../services/firebase";

interface GuestUser {
  nombre:   string;
  apellido: string;
}

interface GuestState {
  guest:     GuestUser | null;
  setGuest:  (g: GuestUser) => Promise<void>;
  clearGuest:() => Promise<void>;
}

export const useGuestStore = create<GuestState>()((set) => ({
  guest: null,

  setGuest: async (g) => {
    try {
      // Sign in anonymously so Firestore rules allow reads
      await signInAnonymously(auth);
      // Small delay to let auth state propagate
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      // If anonymous auth fails, still allow guest mode
      // (user can browse but Firestore queries may fail)
    }
    set({ guest: g });
  },

  clearGuest: async () => {
    set({ guest: null });
    try {
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth);
      }
    } catch {}
  },
}));

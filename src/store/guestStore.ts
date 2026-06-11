import { create } from "zustand";
import { signInAnonymously, signOut, onAuthStateChanged } from "firebase/auth";
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
      // Sign in anonymously and WAIT for auth state to confirm
      await signInAnonymously(auth);
      // Wait for onAuthStateChanged to fire with the anonymous user
      await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsub();
            resolve();
          }
        });
        // Timeout after 3s to avoid hanging
        setTimeout(() => { unsub(); resolve(); }, 3000);
      });
    } catch(e) {
    }
    // Set guest AFTER auth is confirmed - screens will load data correctly
    set({ guest: g });
  },

  clearGuest: async () => {
    set({ guest: null });
    try {
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth);
      }
    } catch(e) {
    }
  },
}));

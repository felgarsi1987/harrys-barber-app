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
    } catch(e) {
      console.log("Anonymous sign in failed:", e);
    }
    set({ guest: g });
  },

  clearGuest: async () => {
    try {
      // Sign out the anonymous session
      await signOut(auth);
    } catch(e) {
      console.log("Sign out failed:", e);
    }
    set({ guest: null });
  },
}));

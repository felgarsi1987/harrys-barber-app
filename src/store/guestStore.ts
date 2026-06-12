import { create } from "zustand";
import { signInAnonymously, signOut } from "firebase/auth";
import { auth } from "../services/firebase";

interface GuestUser {
  nombre:   string;
  apellido: string;
}

interface GuestState {
  guest:     GuestUser | null;
  setGuest:  (g: GuestUser) => void;
  clearGuest:() => void;
}

export const useGuestStore = create<GuestState>()((set) => ({
  guest: null,

  setGuest: (g) => {
    // Navigate immediately - don't block on anonymous auth
    set({ guest: g });
    // Sign in anonymously in the background for Firestore access
    signInAnonymously(auth).catch(() => {});
  },

  clearGuest: () => {
    set({ guest: null });
    if (auth.currentUser?.isAnonymous) {
      signOut(auth).catch(() => {});
    }
  },
}));

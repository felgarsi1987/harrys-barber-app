import { create } from "zustand";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";

interface GuestUser {
  nombre:   string;
  apellido: string;
  fecha?:   string;
}

interface GuestState {
  guest:     GuestUser | null;
  setGuest:  (g: GuestUser) => void;
  clearGuest:() => void;
}

export const useGuestStore = create<GuestState>()((set) => ({
  guest: null,

  setGuest: (g) => {
    set({ guest: g });
  },

  clearGuest: () => {
    set({ guest: null });
    if (auth.currentUser?.isAnonymous) {
      signOut(auth).catch(() => {});
    }
  },
}));

import { create } from "zustand";

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
  guest:      null,
  setGuest:   (g) => set({ guest: g }),
  clearGuest: ()  => set({ guest: null }),
}));

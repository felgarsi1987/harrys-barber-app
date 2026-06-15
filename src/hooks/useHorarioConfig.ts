import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export interface HorarioConfig {
  dias:          Record<string, boolean>;
  horaInicio:    string;
  horaFin:       string;
  duracionTurno: number;
  autoConfirmar?: boolean;
}

const DEFAULT: HorarioConfig = {
  dias: {
    Lunes: true, Martes: true, Miércoles: true,
    Jueves: true, Viernes: true, Sábado: true, Domingo: false,
  },
  horaInicio:    "08:00",
  horaFin:       "18:00",
  duracionTurno: 30,
};

function generarHoras(horaInicio: string, horaFin: string, duracion: number): string[] {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  let mins = hi * 60 + mi;
  const finMins = hf * 60 + mf;
  const horas: string[] = [];
  while (mins < finMins) {
    horas.push(
      `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`
    );
    mins += duracion;
  }
  return horas;
}

export function useHorarioConfig() {
  const [config,  setConfig]  = useState<HorarioConfig>(DEFAULT);
  const [horas,   setHoras]   = useState<string[]>(() =>
    generarHoras(DEFAULT.horaInicio, DEFAULT.horaFin, DEFAULT.duracionTurno)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "config", "horario"))
      .then(snap => {
        const data = snap.exists() ? (snap.data() as HorarioConfig) : DEFAULT;
        setConfig(data);
        setHoras(generarHoras(data.horaInicio, data.horaFin, data.duracionTurno));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { config, horas, loading };
}

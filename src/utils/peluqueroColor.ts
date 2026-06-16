// Paleta fija para identificar a cada peluquero con un color estable.
// Mismo UID → siempre el mismo color, para evitar confusiones en la agenda/reservas.
const PALETA = [
  "#3B82F6", // azul
  "#10B981", // verde
  "#F59E0B", // ámbar
  "#A855F7", // morado
  "#EC4899", // rosa
  "#06B6D4", // cian
  "#EF4444", // rojo
  "#F97316", // naranja
  "#14B8A6", // teal
  "#8B5CF6", // violeta
];

export function colorPeluquero(uid?: string | null): string {
  if (!uid) return "#9CA3AF"; // gris para "sin asignar"
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return PALETA[hash % PALETA.length];
}

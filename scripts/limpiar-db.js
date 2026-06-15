/**
 * Limpia colecciones de Firestore para demo limpia.
 * BORRA: reservas, pedidos, servicios_realizados, movimientos
 * CONSERVA: users, inventario, servicios, config, eventos
 *
 * Uso: node scripts/limpiar-db.js
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore }        = require("firebase-admin/firestore");
const path = require("path");

// ── Ajusta esta ruta si tu service account key tiene otro nombre ─────────────
const SERVICE_ACCOUNT = path.join(__dirname, "..", "service-account.json");

let app;
try {
  app = initializeApp({ credential: cert(require(SERVICE_ACCOUNT)) });
} catch (e) {
  console.error("\n❌  No se encontró service-account.json");
  console.error("    Descárgalo desde Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada");
  console.error("    Guárdalo como: harrys-barber-app/service-account.json\n");
  process.exit(1);
}

const db = getFirestore(app);

const COLECCIONES_A_BORRAR = [
  "reservas",
  "pedidos",
  "servicios_realizados",
  "movimientos",
];

async function borrarColeccion(nombre) {
  const snap = await db.collection(nombre).get();
  if (snap.empty) {
    console.log(`  ⚪  ${nombre} — vacía, nada que borrar`);
    return 0;
  }

  // Borrar en lotes de 400
  let total = 0;
  const docs = snap.docs;
  const BATCH_SIZE = 400;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
    total += Math.min(BATCH_SIZE, docs.length - i);
  }

  console.log(`  🗑️   ${nombre} — ${total} documentos borrados`);
  return total;
}

async function main() {
  console.log("\n🧹  Limpiando Firestore — proyecto: harrys-barber-app");
  console.log("    Conservando: users, inventario, servicios, config, eventos\n");

  let totalBorrado = 0;
  for (const col of COLECCIONES_A_BORRAR) {
    totalBorrado += await borrarColeccion(col);
  }

  console.log(`\n✅  Listo — ${totalBorrado} documentos eliminados en total.`);
  console.log("    La base de datos quedó limpia para demo.\n");
  process.exit(0);
}

main().catch(e => {
  console.error("❌  Error:", e.message);
  process.exit(1);
});

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Ligas de las que jalamos noticias en paralelo
const LIGAS_NOTICIAS = [
  "eng.1",           // Premier League
  "esp.1",           // La Liga
  "uefa.champions",  // Champions League
  "col.1",           // BetPlay Colombia
  "ger.1",           // Bundesliga
  "ita.1",           // Serie A
];

export interface NoticiaFutbol {
  id:       string;
  titulo:   string;
  resumen:  string;
  imagen?:  string;
  fecha:    string;
  url:      string;
  liga:     string;
}

async function fetchNoticiasLiga(ligaId: string): Promise<NoticiaFutbol[]> {
  try {
    const res = await fetch(`${ESPN}/${ligaId}/news?limit=5&lang=es&region=co`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const articulos: any[] = json.articles ?? [];

    return articulos.map((a: any) => ({
      id:      a.dataSourceIdentifier ?? String(a.id ?? Math.random()),
      titulo:  a.headline ?? "",
      resumen: a.description ?? "",
      imagen:  a.images?.[0]?.url ?? undefined,
      fecha:   formatFecha(a.published ?? a.lastModified ?? ""),
      url:     a.links?.web?.href ?? a.links?.mobile?.href ?? "",
      liga:    ligaId,
    }));
  } catch {
    return [];
  }
}

export async function getNoticias(limite = 12): Promise<NoticiaFutbol[]> {
  const resultados = await Promise.allSettled(
    LIGAS_NOTICIAS.map(fetchNoticiasLiga)
  );

  // Mezclar noticias intercalando ligas (round-robin) para variedad
  const porLiga = resultados
    .filter((r): r is PromiseFulfilledResult<NoticiaFutbol[]> => r.status === "fulfilled")
    .map(r => r.value.filter(n => n.titulo));

  const mezcladas: NoticiaFutbol[] = [];
  const vistas = new Set<string>();
  let i = 0;
  while (mezcladas.length < limite) {
    let added = false;
    for (const liga of porLiga) {
      if (liga[i]) {
        const n = liga[i];
        if (!vistas.has(n.id)) {
          vistas.add(n.id);
          mezcladas.push(n);
          added = true;
          if (mezcladas.length >= limite) break;
        }
      }
    }
    i++;
    if (!added) break;
  }

  return mezcladas;
}

function formatFecha(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

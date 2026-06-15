const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export interface EquipoMarcador {
  nombre: string;
  abrev:  string;
  logo:   string;
  score:  string;
}

export interface PartidoMarcador {
  id:         string;
  ligaId:     string;
  ligaNombre: string;
  ligaEmoji:  string;
  estado:     "pre" | "in" | "post";
  reloj:      string;
  minuto:     number;
  local:      EquipoMarcador;
  visitante:  EquipoMarcador;
  fecha:      Date;
}

const LIGAS = [
  // ── Selecciones / Copas mundiales (máxima prioridad) ──
  { id: "fifa.world",              nombre: "Mundial",       emoji: "🌍" },
  { id: "fifa.worldq.conmebol",   nombre: "Eliminatorias", emoji: "🌎" },
  { id: "fifa.worldq.uefa",       nombre: "Clasif. UEFA",  emoji: "🌍" },
  { id: "fifa.worldq",            nombre: "Eliminatorias", emoji: "🌐" },
  { id: "uefa.euro",              nombre: "Eurocopa",      emoji: "🏆" },
  { id: "uefa.nations",           nombre: "Nations Lge",   emoji: "🇪🇺" },
  { id: "concacaf.nations.league",nombre: "CONCACAF NL",   emoji: "🌎" },

  // ── Copas de clubes internacionales ──
  { id: "uefa.champions",         nombre: "Champions",     emoji: "⭐" },
  { id: "conmebol.libertadores",  nombre: "Libertadores",  emoji: "🏆" },
  { id: "conmebol.sudamericana",  nombre: "Sudamericana",  emoji: "🥈" },
  { id: "concacaf.champions",     nombre: "CONCACAF CC",   emoji: "🏅" },

  // ── Ligas europeas principales ──
  { id: "eng.1",  nombre: "Premier",    emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "esp.1",  nombre: "La Liga",    emoji: "🇪🇸" },
  { id: "ger.1",  nombre: "Bundesliga", emoji: "🇩🇪" },
  { id: "ita.1",  nombre: "Serie A",    emoji: "🇮🇹" },
  { id: "fra.1",  nombre: "Ligue 1",    emoji: "🇫🇷" },
  { id: "por.1",  nombre: "Portugal",   emoji: "🇵🇹" },
  { id: "ned.1",  nombre: "Eredivisie", emoji: "🇳🇱" },

  // ── Ligas de América ──
  { id: "col.1",  nombre: "BetPlay",    emoji: "🇨🇴" },
  { id: "bra.1",  nombre: "Brasileirao",emoji: "🇧🇷" },
  { id: "arg.1",  nombre: "Argentina",  emoji: "🇦🇷" },
  { id: "mex.1",  nombre: "Liga MX",    emoji: "🇲🇽" },
  { id: "usa.1",  nombre: "MLS",        emoji: "🇺🇸" },
];

async function fetchLiga(liga: typeof LIGAS[0]): Promise<PartidoMarcador[]> {
  try {
    const res  = await fetch(`${ESPN}/${liga.id}/scoreboard?lang=es&region=co`, {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.events ?? [];

    return events.map(ev => {
      const comp  = ev.competitions?.[0];
      const home  = comp?.competitors?.find((c: any) => c.homeAway === "home");
      const away  = comp?.competitors?.find((c: any) => c.homeAway === "away");
      const state = (ev.status?.type?.state ?? "pre") as "pre" | "in" | "post";
      const clockRaw: string = ev.status?.displayClock ?? "";
      const minuto = parseInt(clockRaw) || 0;

      let reloj = "";
      if (state === "in")        reloj = clockRaw ? `${clockRaw}'` : "EN VIVO";
      else if (state === "post") reloj = "FT";
      else {
        const d = new Date(ev.date);
        reloj = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
      }

      return {
        id:         ev.id,
        ligaId:     liga.id,
        ligaNombre: liga.nombre,
        ligaEmoji:  liga.emoji,
        estado:     state,
        reloj,
        minuto,
        fecha:      new Date(ev.date),
        local: {
          nombre: home?.team?.shortDisplayName ?? "Local",
          abrev:  home?.team?.abbreviation ?? "LOC",
          logo:   home?.team?.logo ?? "",
          score:  home?.score ?? "-",
        },
        visitante: {
          nombre: away?.team?.shortDisplayName ?? "Visitante",
          abrev:  away?.team?.abbreviation ?? "VIS",
          logo:   away?.team?.logo ?? "",
          score:  away?.score ?? "-",
        },
      };
    });
  } catch {
    return [];
  }
}

export async function getMarcadores(): Promise<PartidoMarcador[]> {
  const resultados = await Promise.allSettled(LIGAS.map(fetchLiga));

  const todos: PartidoMarcador[] = resultados
    .filter((r): r is PromiseFulfilledResult<PartidoMarcador[]> => r.status === "fulfilled")
    .flatMap(r => r.value);

  // Prioridad de competición: selecciones > copas internacionales > ligas
  const PRIORIDAD_LIGA: Record<string, number> = {
    "fifa.world": 0, "fifa.worldq.conmebol": 0, "fifa.worldq.uefa": 0,
    "fifa.worldq": 0, "uefa.euro": 0, "uefa.nations": 1,
    "concacaf.nations.league": 1,
    "uefa.champions": 2, "conmebol.libertadores": 2,
    "conmebol.sudamericana": 3, "concacaf.champions": 3,
  };
  const prioLiga = (id: string) => PRIORIDAD_LIGA[id] ?? 4;

  // Orden: EN VIVO primero (por minuto desc), luego terminados, luego próximos
  // Dentro de cada estado, selecciones/copas antes que ligas locales
  return todos.sort((a, b) => {
    const estadoP = (p: PartidoMarcador) =>
      p.estado === "in" ? 0 : p.estado === "post" ? 1 : 2;
    const ea = estadoP(a), eb = estadoP(b);
    if (ea !== eb) return ea - eb;
    const la = prioLiga(a.ligaId), lb = prioLiga(b.ligaId);
    if (la !== lb) return la - lb;
    if (a.estado === "in") return b.minuto - a.minuto;
    return a.fecha.getTime() - b.fecha.getTime();
  });
}

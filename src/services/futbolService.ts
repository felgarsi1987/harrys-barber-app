const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export interface Equipo {
  nombre:  string;
  abrev:   string;
  logo:    string;
  score:   string;
}

export interface Partido {
  id:       string;
  liga:     string;
  estado:   "pre" | "in" | "post";
  reloj:    string;     // "45'" en vivo, "20:00" si no empezó, "FT" si terminó
  local:    Equipo;
  visitante: Equipo;
  fecha:    Date;
}

export const LIGAS = [
  { id: "col.1",           nombre: "BetPlay",    emoji: "🇨🇴" },
  { id: "uefa.champions",  nombre: "UCL",         emoji: "🏆" },
  { id: "esp.1",           nombre: "La Liga",     emoji: "🇪🇸" },
  { id: "eng.1",           nombre: "Premier",     emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "ger.1",           nombre: "Bundesliga",  emoji: "🇩🇪" },
  { id: "ita.1",           nombre: "Serie A",     emoji: "🇮🇹" },
];

export async function getPartidos(ligaId: string): Promise<Partido[]> {
  const res  = await fetch(`${ESPN}/${ligaId}/scoreboard`, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  const events: any[] = data.events ?? [];

  return events.map(ev => {
    const comp  = ev.competitions?.[0];
    const home  = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away  = comp?.competitors?.find((c: any) => c.homeAway === "away");
    const state = ev.status?.type?.state as "pre" | "in" | "post";

    let reloj = "";
    if (state === "in")   reloj = ev.status?.displayClock ? `${ev.status.displayClock}'` : "EN VIVO";
    else if (state === "post") reloj = "FT";
    else {
      const d = new Date(ev.date);
      reloj = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    }

    return {
      id:        ev.id,
      liga:      ligaId,
      estado:    state,
      reloj,
      fecha:     new Date(ev.date),
      local: {
        nombre: home?.team?.shortDisplayName ?? home?.team?.displayName ?? "Local",
        abrev:  home?.team?.abbreviation ?? "LOC",
        logo:   home?.team?.logo ?? "",
        score:  home?.score ?? "-",
      },
      visitante: {
        nombre: away?.team?.shortDisplayName ?? away?.team?.displayName ?? "Visitante",
        abrev:  away?.team?.abbreviation ?? "VIS",
        logo:   away?.team?.logo ?? "",
        score:  away?.score ?? "-",
      },
    };
  }).slice(0, 10);
}

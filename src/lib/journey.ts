import { ViagemItem, ViagemStore } from "@/types/travel";

export type EtapaJornada = "Sonho" | "Planejamento" | "Roteiro" | "Preparação" | "Viagem";
export type EstadoDestino = "Sonho" | "Em avaliação" | "Planejamento" | "Jornada Atual" | "Concluída";

type ChecklistSalvo = { recomendados?: Array<{ concluido?: boolean }>; pessoais?: Array<{ subitens?: Array<{ concluido?: boolean }> }> };
type AtividadeSalva = { concluida?: boolean; data?: string };

export type ProgressoJornada = {
  etapa: EtapaJornada;
  indiceEtapa: number;
  percentual: number;
  eventos: Record<string, boolean>;
  proximoPasso: { titulo: string; href: string };
  motivos: string[];
  score: number;
};

function lerJson<T>(chave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(chave) || "") as T; } catch { return fallback; }
}

export function hojeIso(): string {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function progressoJornada(viagem: ViagemItem, temAlerta = false): ProgressoJornada {
  const roteiros = lerJson<Record<string, AtividadeSalva[]>>("viagem-roteiros", {});
  const checklists = lerJson<Record<string, ChecklistSalvo>>("viagem-checklists", {});
  const buscas = lerJson<Array<{ destination?: string }>>("viagem:buscas-recentes", []);
  const atividades = roteiros[viagem.id] ?? [];
  const checklist = checklists[viagem.id];
  const itensChecklist = [...(checklist?.recomendados ?? []), ...(checklist?.pessoais ?? []).flatMap((item) => item.subitens ?? [])];
  const custo = viagem.dados.valorPassagem + viagem.dados.valorHospedagem + viagem.dados.valorAlimentacao + viagem.dados.valorPasseios;
  const hoje = hojeIso();
  const viajando = Boolean(viagem.dados.dataIda && viagem.dados.dataIda <= hoje && (!viagem.dados.dataVolta || viagem.dados.dataVolta >= hoje));
  const eventos = {
    destination_selected: Boolean(viagem.dados.destino),
    dates_defined: Boolean(viagem.dados.dataIda),
    budget_created: custo > 0,
    flight_searched: buscas.some((busca) => busca.destination?.toLowerCase() === viagem.dados.destino.toLowerCase()),
    flight_alert_created: temAlerta,
    reservations_added: viagem.movimentacoes.some((item) => item.tipo === "saida"),
    itinerary_started: atividades.length > 0,
    itinerary_completed: atividades.length > 0 && atividades.every((item) => item.concluida),
    checklist_completed: itensChecklist.length > 0 && itensChecklist.every((item) => item.concluido),
    trip_started: viajando || viagem.concluida,
    trip_completed: viagem.concluida,
  };
  const pesos: Record<keyof typeof eventos, number> = { destination_selected: 8, dates_defined: 10, budget_created: 12, flight_searched: 8, flight_alert_created: 8, reservations_added: 10, itinerary_started: 10, itinerary_completed: 10, checklist_completed: 10, trip_started: 7, trip_completed: 7 };
  const percentual = Math.min(100, Object.entries(eventos).reduce((total, [evento, feito]) => total + (feito ? pesos[evento as keyof typeof eventos] : 0), 0));
  let etapa: EtapaJornada = "Sonho"; let indiceEtapa = 1;
  if (viajando) { etapa = "Viagem"; indiceEtapa = 5; }
  else if (eventos.itinerary_completed || eventos.checklist_completed) { etapa = "Preparação"; indiceEtapa = 4; }
  else if (eventos.itinerary_started) { etapa = "Roteiro"; indiceEtapa = 3; }
  else if (eventos.dates_defined || eventos.budget_created || eventos.flight_searched || temAlerta) { etapa = "Planejamento"; indiceEtapa = 2; }
  const proximoPasso = viajando ? { titulo: "Ver roteiro de hoje", href: "/roteiro" }
    : !eventos.dates_defined ? { titulo: "Definir datas da viagem", href: "/minha-viagem" }
    : !eventos.budget_created ? { titulo: "Criar orçamento", href: "/minha-viagem" }
    : !eventos.flight_searched ? { titulo: "Pesquisar passagens", href: "/buscar-passagens" }
    : !eventos.itinerary_started ? { titulo: "Começar roteiro", href: "/roteiro" }
    : !eventos.itinerary_completed ? { titulo: "Continuar roteiro", href: "/roteiro" }
    : { titulo: "Revisar preparação", href: "/minha-viagem" };
  const motivos = [eventos.dates_defined && "datas definidas", eventos.budget_created && "orçamento criado", temAlerta && "alerta ativo", eventos.itinerary_started && "roteiro iniciado", eventos.flight_searched && "passagem pesquisada"].filter(Boolean) as string[];
  const score = (eventos.dates_defined ? 30 : 0) + (eventos.budget_created ? 25 : 0) + (temAlerta ? 20 : 0) + (eventos.itinerary_started ? 15 : 0) + (eventos.flight_searched ? 10 : 0);
  return { etapa, indiceEtapa, percentual, eventos, proximoPasso, motivos, score };
}

export function estadoDestino(viagem: ViagemItem, store: ViagemStore, progresso: ProgressoJornada): EstadoDestino {
  if (viagem.concluida) return "Concluída";
  if (viagem.id === store.viagemAtivaId) return progresso.etapa === "Viagem" ? "Jornada Atual" : "Jornada Atual";
  if (progresso.etapa === "Sonho") return "Sonho";
  if (progresso.percentual < 35) return "Em avaliação";
  return "Planejamento";
}

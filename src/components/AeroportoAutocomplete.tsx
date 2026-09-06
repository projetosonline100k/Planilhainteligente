"use client";

import { useId, useMemo, useState } from "react";
import { Aeroporto, aeroportos } from "@/data/airports";

function normalizar(texto: string) { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

export default function AeroportoAutocomplete({ titulo, value, onChange, excluir }: { titulo: string; value: string; onChange: (codigo: string) => void; excluir?: string }) {
  const id = useId(); const [texto, setTexto] = useState(() => { const aeroporto = aeroportos.find((item) => item.codigo === value); return aeroporto ? `${aeroporto.cidade} (${aeroporto.codigo})` : value; }); const [aberto, setAberto] = useState(false);
  const sugestoes = useMemo(() => { const termo = normalizar(texto.trim()); if (termo.length < 2) return []; return aeroportos.filter((item) => item.codigo !== excluir && normalizar(`${item.codigo} ${item.cidade} ${item.nome} ${item.pais}`).includes(termo)).slice(0, 7); }, [texto, excluir]);
  function selecionar(item: Aeroporto) { setTexto(`${item.cidade} (${item.codigo})`); onChange(item.codigo); setAberto(false); }
  return <div className="relative rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2">
    <label htmlFor={id} className="block text-[10px] text-white/45">{titulo}</label>
    <input id={id} value={texto} onChange={(event) => { setTexto(event.target.value); onChange(""); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)} autoComplete="off" placeholder="Cidade ou aeroporto" required className="mt-1 w-full bg-transparent text-base font-bold text-white outline-none placeholder:text-white/25" role="combobox" aria-expanded={aberto && sugestoes.length > 0} aria-controls={`${id}-lista`} />
    {aberto && sugestoes.length > 0 && <ul id={`${id}-lista`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-white/15 bg-slate-900 p-1 shadow-2xl">
      {sugestoes.map((item) => <li key={item.codigo}><button type="button" onMouseDown={() => selecionar(item)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10"><span><span className="block text-sm font-bold text-white">{item.cidade}</span><span className="block text-[11px] text-white/50">{item.nome} · {item.pais}</span></span><span className="rounded bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-200">{item.codigo}</span></button></li>)}
    </ul>}
  </div>;
}

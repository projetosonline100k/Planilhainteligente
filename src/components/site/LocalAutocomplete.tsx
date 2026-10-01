"use client";

import { useId, useMemo, useState } from "react";
import { Aeroporto, aeroportos } from "@/data/airports";

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function LocalAutocomplete({
  titulo,
  placeholder,
  value,
  onChange,
}: {
  titulo: string;
  placeholder: string;
  value: string;
  onChange: (cidade: string) => void;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);

  const sugestoes = useMemo(() => {
    const termo = normalizar(value.trim());
    if (termo.length < 2) return [];
    return aeroportos.filter((item) => normalizar(`${item.codigo} ${item.cidade} ${item.pais}`).includes(termo)).slice(0, 6);
  }, [value]);

  function selecionar(item: Aeroporto) {
    onChange(item.cidade);
    setAberto(false);
  }

  return (
    <label className="relative flex-1 px-2" htmlFor={id}>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{titulo}</span>
      <input
        id={id}
        value={value}
        onChange={(event) => { onChange(event.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={aberto && sugestoes.length > 0}
        aria-controls={`${id}-lista`}
        className="mt-1 w-full bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300"
      />
      {aberto && sugestoes.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {sugestoes.map((item) => (
            <li key={item.codigo}>
              <button
                type="button"
                onMouseDown={() => selecionar(item)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-bold text-slate-900">{item.cidade}</span>
                <span className="text-xs font-semibold text-slate-400">{item.pais}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

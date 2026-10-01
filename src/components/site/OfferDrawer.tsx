"use client";

import Image from "next/image";
import OfferMembershipStatus from "@/components/OfferMembershipStatus";
import { sanitizeImageUrl, type OfferSummary } from "@/lib/offers";
import { formatarDataCurta, formatarPreco } from "@/lib/offersFormat";

export default function OfferDrawer({ offer, onClose }: { offer: OfferSummary | null; onClose: () => void }) {
  if (!offer) return null;

  const imagem = sanitizeImageUrl(offer.image_url);
  const ida = formatarDataCurta(offer.outbound_date);
  const volta = formatarDataCurta(offer.return_date);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="relative aspect-[16/10] shrink-0 bg-gradient-to-br from-blue-100 to-slate-100">
          {imagem ? (
            <Image src={imagem} alt={`Destino: ${offer.destination_name}`} fill unoptimized sizes="448px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl" role="img" aria-label="Destino de viagem">✈️</div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-black text-slate-700 shadow"
          >
            ✕
          </button>
          {offer.savings_percentage != null && (
            <span className="absolute bottom-4 left-4 rounded-full bg-emerald-400 px-3 py-1.5 text-sm font-black text-slate-950 shadow-lg">
              -{offer.savings_percentage}%
            </span>
          )}
        </div>

        <div className="flex-1 p-6">
          <h2 className="text-2xl font-black text-slate-900">{offer.destination_name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Saindo de {offer.origin_name}</p>

          <p className="mt-4 text-3xl font-black text-slate-900">{formatarPreco(offer.price)}</p>
          <p className="text-sm text-slate-500">ida e volta</p>
          {offer.typical_price != null && (
            <p className="mt-2 text-sm text-slate-500">
              Preço normal: <span className="line-through">{formatarPreco(offer.typical_price)}</span>
            </p>
          )}
          {offer.savings_amount != null && (
            <p className="text-sm font-bold text-emerald-600">Economize {formatarPreco(offer.savings_amount)}</p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
            <div>
              <dt className="text-xs text-slate-400">Origem</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900">{offer.origin_name} ({offer.origin_code})</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Destino</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900">{offer.destination_name} ({offer.destination_code})</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Ida</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900">{ida ?? "Não informada"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Volta</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900">{volta ?? "Não informada"}</dd>
            </div>
          </dl>

          <OfferMembershipStatus offerId={offer.id} />
        </div>
      </aside>
    </div>
  );
}

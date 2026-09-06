import type { Metadata } from "next";
import BuscaPassagens from "@/components/BuscaPassagens";

export const metadata: Metadata = {
  title: "Buscar passagens | Planejador Financeiro de Viagens",
};

export default function PaginaBuscaPassagens() {
  return <BuscaPassagens />;
}

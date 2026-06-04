import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Planejador Financeiro de Viagens
        </h1>
        <p className="mt-4 text-base text-gray-500">
          Descubra quanto precisa guardar por mês para realizar sua próxima viagem.
        </p>
        <Link
          href="/diagnostico"
          className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Planejar minha viagem
        </Link>
      </div>
    </main>
  );
}

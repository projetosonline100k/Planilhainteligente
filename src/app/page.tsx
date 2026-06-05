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
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100"
          >
            Entrar
          </Link>
          <Link
            href="/diagnostico"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Começar diagnóstico
          </Link>
          <Link
            href="/minha-viagem"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100"
          >
            Minha viagem
          </Link>
        </div>
      </div>
    </main>
  );
}

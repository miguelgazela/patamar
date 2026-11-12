"use client";

import Link from "next/link";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main role="alert" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="font-display text-2xl font-semibold text-brand">Algo correu mal</h1>
      <p className="text-muted">Não foi possível carregar esta página. Os seus dados não foram alterados. Tente de novo; se continuar, volte ao início.</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={reset} className="min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover">Tentar de novo</button>
        <Link href="/" className="flex min-h-11 items-center rounded-md border border-brand px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Voltar ao início</Link>
      </div>
    </main>
  );
}

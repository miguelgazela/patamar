import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="font-display text-2xl font-semibold text-brand">Página não encontrada</h1>
      <p className="text-muted">O endereço não existe ou já não está disponível.</p>
      <Link href="/" className="flex min-h-11 w-fit items-center rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover">Voltar ao início</Link>
    </main>
  );
}

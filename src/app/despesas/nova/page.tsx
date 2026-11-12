import Link from "next/link";
import { Formulario } from "./formulario";

export const metadata = { title: "Nova despesa · Patamar" };

export default function NovaDespesa() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Nova despesa</h1>
      </header>
      <Formulario />
    </main>
  );
}

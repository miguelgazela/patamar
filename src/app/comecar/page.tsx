import Link from "next/link";
import { Formulario } from "../entrar/formulario";

export const metadata = { title: "Criar condomínio · Patamar" };

export default function Comecar() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand">Patamar</h1>
        <p className="mt-1 text-muted">
          Gerir o condomínio em 15 minutos por mês. Indique o seu email e enviamos-lhe um código para começar. Sem palavra-passe.
        </p>
      </div>
      <Formulario criar />
      <p className="text-sm text-muted">
        Já tem conta? <Link href="/entrar" className="text-brand underline">Entrar</Link>
      </p>
    </main>
  );
}

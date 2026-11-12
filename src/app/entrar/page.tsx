import Link from "next/link";
import { Formulario } from "./formulario";

export const metadata = { title: "Entrar · Patamar" };

export default function Entrar() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand">Patamar</h1>
        <p className="mt-1 text-muted">Entre com o seu email. Enviamos-lhe um código, sem palavra-passe.</p>
      </div>
      <Formulario />
      <p className="text-sm text-muted">
        Administra um prédio e ainda não tem conta? <Link href="/comecar" className="text-brand underline">Criar o meu condomínio</Link>
      </p>
    </main>
  );
}

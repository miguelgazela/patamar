"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pedirCodigo, validarCodigo, type EstadoEntrar } from "./actions";

const inicial: EstadoEntrar = { passo: "email", email: "" };

export function Formulario({ criar = false }: { criar?: boolean }) {
  const [estado, pedir, aPedir] = useActionState(pedirCodigo, inicial);
  const [validacao, validar, aValidar] = useActionState(validarCodigo, inicial);

  // Depois de pedir o código, a validação assume o estado do passo 2.
  const emCodigo = estado.passo === "codigo";
  const email = estado.email;
  const erro = emCodigo ? validacao.erro : estado.erro;

  return emCodigo ? (
    <form action={validar} className="flex flex-col gap-4">
      <p className="text-muted">
        Enviámos um código de 6 dígitos para <strong className="text-ink">{email}</strong>. Se o email estiver registado,
        chega em poucos segundos.
      </p>
      <input type="hidden" name="email" value={email} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Código
        <input
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          className="rounded-md border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.5em]"
        />
      </label>
      {erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{erro}</p>}
      <button disabled={aValidar} className="min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {aValidar ? "A validar…" : "Entrar"}
      </button>
      <a href={criar ? "/comecar" : "/entrar"} className="text-center text-sm text-brand underline">Usar outro email ou pedir novo código</a>
    </form>
  ) : (
    <form action={pedir} className="flex flex-col gap-4">
      {criar && <input type="hidden" name="criar" value="1" />}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={estado.email}
          className="rounded-md border border-line bg-surface px-4 py-3 text-base"
        />
      </label>
      {criar && (
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input name="aceito" type="checkbox" required className="mt-0.5 size-5 shrink-0" />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="text-brand underline">Termos de utilização</Link> e a{" "}
            <Link href="/privacidade" target="_blank" className="text-brand underline">Política de privacidade</Link>.
          </span>
        </label>
      )}
      {erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{erro}</p>}
      <button disabled={aPedir} className="min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {aPedir ? "A enviar…" : "Receber código"}
      </button>
    </form>
  );
}

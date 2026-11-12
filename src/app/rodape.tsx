import Link from "next/link";

export function Rodape() {
  return (
    <footer className="mx-auto flex w-full max-w-[var(--content-max)] flex-wrap items-center justify-center gap-x-4 px-4 py-4 text-xs text-muted">
      <Link href="/privacidade" className="inline-flex min-h-11 items-center underline">Privacidade</Link>
      <Link href="/termos" className="inline-flex min-h-11 items-center underline">Termos de utilização</Link>
    </footer>
  );
}

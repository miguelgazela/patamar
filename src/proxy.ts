import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Renova a sessão Supabase e envia quem não está autenticado para /entrar. */
export async function proxy(request: NextRequest) {
  // Os endpoints de cron autenticam-se com CRON_SECRET, não com sessão.
  if (request.nextUrl.pathname.startsWith("/api/cron/") || request.nextUrl.pathname === "/api/saude") return NextResponse.next();
  // Textos legais: públicos, com ou sem sessão.
  if (request.nextUrl.pathname === "/privacidade" || request.nextUrl.pathname === "/termos") return NextResponse.next();

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(lista) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const autenticado = !!data?.claims;
  const emEntrar = request.nextUrl.pathname.startsWith("/entrar") || request.nextUrl.pathname.startsWith("/comecar");

  if (!autenticado && !emEntrar) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  if (autenticado && emEntrar) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|icon.png|apple-icon.png|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

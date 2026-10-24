import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/** Protege as telas do aplicativo quando o login está configurado. As rotas /api validam a sessão por conta própria. */
export default function proxy(req: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.next();
  return auth.middleware({ loginUrl: "/entrar" })(req);
}

export const config = {
  matcher: [
    "/pesquisar/:path*",
    "/empresa/:path*",
    "/empresas/:path*",
    "/descobrir/:path*",
    "/mercado/:path*",
    "/parecidas/:path*",
    "/base/:path*",
    "/listas/:path*",
    "/importar/:path*",
    "/creditos/:path*",
    "/equipe/:path*",
    "/configuracoes/:path*",
    "/admin/:path*",
  ],
};

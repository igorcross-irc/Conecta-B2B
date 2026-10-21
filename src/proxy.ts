import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/** Protege as páginas quando o login está configurado. As rotas /api validam a sessão por conta própria. */
export default function proxy(req: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.next();
  return auth.middleware({ loginUrl: "/entrar" })(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|entrar|optout).*)"],
};

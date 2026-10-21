import { getAuth } from "@/lib/auth/server";

type Ctx = { params: Promise<{ path: string[] }> };

function semAuth() {
  return Response.json({ erro: "Login não configurado neste ambiente." }, { status: 404 });
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = getAuth();
  return auth ? auth.handler().GET(req, ctx as never) : semAuth();
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = getAuth();
  return auth ? auth.handler().POST(req, ctx as never) : semAuth();
}

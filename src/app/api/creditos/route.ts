import { connection } from "next/server";
import { servicos } from "@/lib/app";

/** GET /api/creditos -> saldo, custos e extrato */
export async function GET(req: Request) {
  await connection(); // sem isto o Next pré-renderiza e o saldo ficaria congelado
  const s = await servicos(req.headers);
  return Response.json({ saldo: await s.saldo(), custos: await s.custos(), extrato: await s.extrato() });
}

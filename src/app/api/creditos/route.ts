import { connection } from "next/server";
import { servicos } from "@/lib/app";

/** GET /api/creditos -> saldo, custos e extrato */
export async function GET() {
  await connection(); // sem isto o Next pré-renderiza e o saldo ficaria congelado
  const s = servicos();
  return Response.json({ saldo: s.saldo(), custos: s.custos(), extrato: s.extrato() });
}

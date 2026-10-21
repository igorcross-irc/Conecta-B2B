import { connection } from "next/server";
import { responderErro, servicos } from "@/lib/app";

/** GET /api/creditos -> saldo, custos e extrato */
export async function GET() {
  try {
    await connection(); // sem isto o Next pré-renderiza e o saldo ficaria congelado
    const s = await servicos();
    return Response.json({ saldo: await s.saldo(), custos: await s.custos(), extrato: await s.extrato() });
  } catch (e) {
    return responderErro(e);
  }
}

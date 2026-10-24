/**
 * Teste de cobertura com uma lista de CNPJs.
 *   npx tsx scripts/testar-provedores.ts entrada.csv [saida.csv]
 * Entrada: CSV com coluna cnpj (e, opcional, segmento). Veja docs/modelo-cnpjs.csv.
 * Com CONECTA_MODO_DEMO=1 usa dados fictícios (sem internet). Sem isso, consulta a API aberta da
 * CNPJá, limitada a 5 consultas por minuto por IP, por isso o script espera entre as empresas.
 * Provedores de contato reais entram em src/lib/providers conforme as chaves existirem (variáveis de ambiente).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { lerCsv, normalizarCabecalho } from "../src/lib/csv";
import { BrasilApi, EmpresaEmCascata } from "../src/lib/providers/brasilapi";
import { CnpjaAberta } from "../src/lib/providers/cnpja";
import { EmpresaDemo, ProvedorDemo } from "../src/lib/providers/mock";
import { celulaCsv } from "../src/lib/contatos";
import { COLUNAS, executarTeste } from "../src/lib/teste";

async function main() {
  const [entrada, saida = "resultado-teste.csv"] = process.argv.slice(2);
  if (!entrada) {
    console.error("Uso: npx tsx scripts/testar-provedores.ts entrada.csv [saida.csv]");
    process.exit(1);
  }
  const linhas = lerCsv(readFileSync(entrada, "utf8"));
  const cab = linhas[0].map(normalizarCabecalho);
  const iCnpj = cab.indexOf("cnpj");
  const iSeg = cab.indexOf("segmento");
  if (iCnpj < 0) {
    console.error("O arquivo precisa da coluna cnpj.");
    process.exit(1);
  }
  const entradas = linhas.slice(1).map((l) => ({ cnpj: l[iCnpj] ?? "", segmento: iSeg >= 0 ? l[iSeg] : "" }));
  const demo = process.env.CONECTA_MODO_DEMO === "1";

  const { linhas: resultado, resumo } = await executarTeste(entradas, {
    empresa: demo ? new EmpresaDemo() : new EmpresaEmCascata([new BrasilApi(), new CnpjaAberta()]),
    contatos: [new ProvedorDemo()],
    cargos: ["comercial", "marketing"],
    pausaMs: demo ? 0 : 13_000,
    aoProgredir: (f, t, l) => console.log(`${f}/${t} ${l.cnpj} ${l.empresa} ${l.razaoSocial}`),
  });

  writeFileSync(
    saida,
    [COLUNAS.join(","), ...resultado.map((l) => COLUNAS.map((c) => celulaCsv(String(l[c]))).join(","))].join("\n"),
  );
  console.log("\nResumo:", resumo);
  console.log(`Resultado salvo em ${saida}`);
  if (demo) console.log("ATENÇÃO: modo demonstração, os números não são reais.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

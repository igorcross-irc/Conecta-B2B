/**
 * Importa para o Postgres (rf_estabelecimento / rf_cnae) os estabelecimentos da base aberta de CNPJ da Receita Federal,
 * lendo o espelho público em Parquet do "CNPJ Aberto" no Hugging Face (mesmo conteúdo dos arquivos da Receita).
 *
 * Uso:  DATABASE_URL=postgres://... npx tsx scripts/importar-receita.ts --ufs=RJ,SP [--mes=2026-10] [--filiais] [--fonte=<pasta ou URL>]
 *
 * Só carrega as UFs pedidas, apenas ativas e, por padrão, só matrizes. Reexecutar é seguro (upsert).
 * Se o mês pedido não existir no espelho, tenta o mês anterior.
 */
import { Client } from "pg";
import { abrir, lerCnaes, linhas, preparar } from "../src/lib/receita/parquet";
import { normalizarBusca } from "../src/lib/cnpj";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const ufs = (arg("ufs") ?? "RJ").toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
const filiais = process.argv.includes("--filiais");

function mesesCandidatos(): string[] {
  if (arg("mes")) return [arg("mes")!];
  const d = new Date();
  const fmt = (x: Date) => x.toISOString().slice(0, 7);
  return [fmt(d), fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL.");
  const db = new Client({ connectionString: url });
  await db.connect();
  const log = (m: string) => console.log(m);

  const fontes = arg("fonte") ? [arg("fonte")!] : mesesCandidatos().map((m) => `hf://datasets/cnpjaberto/cnpj-dados-receita-brasil-${m}`);
  const c = await abrir(fontes[0]);
  let fonte = "";
  let total = 0;
  let ultimoErro: unknown;
  for (const f of fontes) {
    try {
      console.log(`Fonte: ${f} · UFs: ${ufs.join(",")} · ${filiais ? "matrizes e filiais" : "só matrizes"}`);
      total = await preparar(c, { fonte: f, ufs, filiais, log });
      fonte = f;
      break;
    } catch (e) {
      ultimoErro = e;
      console.log(`Não consegui usar ${f}: ${(e as Error).message}`);
    }
  }
  if (!fonte) throw ultimoErro;

  for (const x of await lerCnaes(c, fonte)) {
    await db.query(
      "insert into rf_cnae (codigo, descricao, busca) values ($1,$2,$3) on conflict (codigo) do update set descricao = excluded.descricao, busca = excluded.busca",
      [x.codigo, x.descricao, normalizarBusca(x.descricao)],
    );
  }

  let feitos = 0;
  for await (const lote of linhas(c, 2000)) {
    const p: unknown[] = [];
    const vals = lote.map((l) => {
      const v = [l.cnpj, l.razaoSocial, l.nomeFantasia, l.matriz, "ATIVA", l.cnae, l.uf, l.municipio, l.bairro, l.cep, l.porte, l.email, l.telefone, l.abertaEm, l.busca];
      p.push(...v);
      const b = p.length - v.length;
      return `(${v.map((_, k) => `$${b + k + 1}`).join(",")})`;
    });
    await db.query(
      `insert into rf_estabelecimento (cnpj, razao_social, nome_fantasia, matriz, situacao, cnae, uf, municipio, bairro, cep, porte, email, telefone, aberta_em, busca)
       values ${vals.join(",")}
       on conflict (cnpj) do update set razao_social = excluded.razao_social, nome_fantasia = excluded.nome_fantasia, matriz = excluded.matriz,
         situacao = excluded.situacao, cnae = excluded.cnae, uf = excluded.uf, municipio = excluded.municipio, bairro = excluded.bairro,
         cep = excluded.cep, porte = excluded.porte, email = excluded.email, telefone = excluded.telefone, aberta_em = excluded.aberta_em, busca = excluded.busca`,
      p,
    );
    feitos += lote.length;
    if (feitos % 20000 < 2000) log(`Gravados ${feitos}/${total}`);
  }
  log(`Concluído: ${feitos} estabelecimentos.`);
  // Atualiza a lista de municípios usada nas sugestões da pesquisa (precisa da migração 0012).
  try {
    const m = await db.query("select atualizar_municipios() as n");
    log(`Municípios atualizados: ${m.rows[0].n}.`);
  } catch (e) {
    log(`Não atualizei os municípios (aplique db/neon/0012_municipios.sql): ${(e as Error).message}`);
  }
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

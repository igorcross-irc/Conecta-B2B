/**
 * Importa para o Postgres (rf_estabelecimento / rf_cnae) os estabelecimentos da base aberta de CNPJ da Receita Federal.
 *
 * Uso:  DATABASE_URL=postgres://... npx tsx scripts/importar-receita.ts --ufs=RJ,SP [--mes=2026-09] [--filiais] [--dir=./rfb]
 *
 * Baixa Cnaes, Municipios, Empresas0-9 e Estabelecimentos0-9 de https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/<mes>/
 * (ou usa os .zip já presentes em --dir) e carrega só as UFs pedidas, apenas ativas e, por padrão, só matrizes.
 * Funciona em Windows, Mac e Linux (só precisa de Node 22). O servidor da Receita só responde a conexões do Brasil: rode no seu computador.
 * Reexecutar é seguro (upsert) e os .zip já baixados em --dir são reaproveitados.
 * Layout dos arquivos: ';' como separador, ISO-8859-1, sem cabeçalho (documentado pela Receita).
 */
import { createInterface } from "node:readline";
import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import https from "node:https";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import unzipper from "unzipper";
import { Client } from "pg";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const ufs = new Set((arg("ufs") ?? "RJ").toUpperCase().split(",").map((s) => s.trim()).filter(Boolean));
const mes = arg("mes") ?? new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 7);
const dir = arg("dir") ?? "./rfb";
const filiais = process.argv.includes("--filiais");
const BASE = process.env.RFB_BASE ?? "https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const PORTE: Record<string, string> = { "00": "Não informado", "01": "Micro empresa", "03": "Empresa de pequeno porte", "05": "Demais" };

/** Download por https sem checar a cadeia de certificados (o servidor da Receita costuma servir a cadeia incompleta). Só para dados públicos. */
function baixarSemVerificar(url: string, destino: string, saltos = 5): Promise<void> {
  return new Promise((ok, falha) => {
    https
      .get(url, { rejectUnauthorized: false }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && saltos > 0) {
          res.resume();
          return baixarSemVerificar(new URL(res.headers.location, url).toString(), destino, saltos - 1).then(ok, falha);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return falha(new Error(`HTTP ${res.statusCode}`));
        }
        pipeline(res, createWriteStream(destino + ".parcial")).then(() => { renameSync(destino + ".parcial", destino); ok(); }, falha);
      })
      .on("error", falha);
  });
}

const motivo = (e: unknown) => {
  const x = e as { message?: string; cause?: { code?: string; message?: string } };
  return `${x.message ?? e}${x.cause ? ` [${x.cause.code ?? ""} ${x.cause.message ?? ""}]` : ""}`;
};

async function baixar(url: string, destino: string): Promise<void> {
  let semVerificar = false;
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    try {
      if (semVerificar) return await baixarSemVerificar(url, destino);
      const r = await fetch(url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino + ".parcial"));
      renameSync(destino + ".parcial", destino);
      return;
    } catch (e) {
      const m = motivo(e);
      console.log(`Falha ao baixar ${url} (tentativa ${tentativa}/6): ${m}`);
      if (/CERT|SIGNATURE|SELF.SIGNED|issuer/i.test(m) && !semVerificar) {
        console.log("Problema de certificado do servidor da Receita: repetindo sem verificar a cadeia (dados públicos).");
        semVerificar = true;
      }
      if (tentativa === 6) throw e;
      await new Promise((r) => setTimeout(r, 3000 * tentativa));
    }
  }
}

async function garantir(nome: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const f = `${dir}/${nome}.zip`;
  if (!existsSync(f)) {
    console.log(`Baixando ${nome}…`);
    await baixar(`${BASE}/${mes}/${nome}.zip`, f);
  }
  return f;
}

/** Lê as linhas de um .zip (CSV em latin1) em fluxo, sem gravar o CSV em disco. */
async function* linhas(zip: string): AsyncGenerator<string[]> {
  const d = await unzipper.Open.file(zip);
  const entrada = d.files.find((x) => x.type === "File");
  if (!entrada) return;
  const rl = createInterface({ input: entrada.stream().setEncoding("latin1"), crlfDelay: Infinity });
  for await (const l of rl) yield l.split(";").map((c) => c.replace(/^"|"$/g, ""));
}

const dataIso = (v: string) => (/^\d{8}$/.test(v) && v !== "00000000" ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL.");
  const db = new Client({ connectionString: url });
  await db.connect();

  console.log(`UFs: ${[...ufs].join(",")} · mês ${mes} · ${filiais ? "matrizes e filiais" : "só matrizes"}`);

  // CNAEs e municípios
  const cnaes = new Map<number, string>();
  for await (const c of linhas(await garantir("Cnaes"))) if (c[0]) cnaes.set(Number(c[0]), c[1]);
  const municipios = new Map<string, string>();
  for await (const c of linhas(await garantir("Municipios"))) if (c[0]) municipios.set(c[0], c[1]);
  for (const [codigo, descricao] of cnaes) {
    await db.query(
      "insert into rf_cnae (codigo, descricao, busca) values ($1,$2,$3) on conflict (codigo) do update set descricao = excluded.descricao, busca = excluded.busca",
      [codigo, descricao, norm(descricao)],
    );
  }

  // Passo 1: estabelecimentos das UFs pedidas (ativos)
  const est = new Map<string, string[]>();
  for (let i = 0; i < 10; i++) {
    let n = 0;
    for await (const c of linhas(await garantir(`Estabelecimentos${i}`))) {
      if (c.length < 28 || c[5] !== "02" || !ufs.has(c[19])) continue;
      if (!filiais && c[3] !== "1") continue;
      est.set(c[0] + c[1] + c[2], c);
      n++;
    }
    console.log(`Estabelecimentos${i}: +${n} (total ${est.size})`);
  }
  const basicos = new Set([...est.keys()].map((k) => k.slice(0, 8)));

  // Passo 2: razão social e porte das empresas
  const emp = new Map<string, [string, string]>();
  for (let i = 0; i < 10; i++) {
    for await (const c of linhas(await garantir(`Empresas${i}`))) if (basicos.has(c[0])) emp.set(c[0], [c[1], PORTE[c[5]] ?? ""]);
    console.log(`Empresas${i}: ${emp.size}/${basicos.size}`);
  }

  // Passo 3: gravação em lotes
  const todos = [...est.entries()];
  const LOTE = 1000;
  for (let i = 0; i < todos.length; i += LOTE) {
    const lote = todos.slice(i, i + LOTE);
    const p: unknown[] = [];
    const vals = lote.map(([cnpj, c]) => {
      const [razao, porte] = emp.get(cnpj.slice(0, 8)) ?? [c[4] || cnpj, ""];
      const tel = c[22] ? `${c[21]}${c[22]}` : null;
      const cnae = Number(c[11]) || null;
      const municipio = municipios.get(c[20]) ?? null;
      const l = [cnpj, razao, c[4] || null, c[3] === "1", "ATIVA", cnae, c[19], municipio, c[17] || null, c[18] || null, porte || null,
        c[27] ? c[27].toLowerCase() : null, tel, dataIso(c[10]), norm(`${razao} ${c[4]}`)];
      p.push(...l);
      const b = p.length - l.length;
      return `(${l.map((_, k) => `$${b + k + 1}`).join(",")})`;
    });
    await db.query(
      `insert into rf_estabelecimento (cnpj, razao_social, nome_fantasia, matriz, situacao, cnae, uf, municipio, bairro, cep, porte, email, telefone, aberta_em, busca)
       values ${vals.join(",")}
       on conflict (cnpj) do update set razao_social = excluded.razao_social, nome_fantasia = excluded.nome_fantasia, matriz = excluded.matriz,
         situacao = excluded.situacao, cnae = excluded.cnae, uf = excluded.uf, municipio = excluded.municipio, bairro = excluded.bairro,
         cep = excluded.cep, porte = excluded.porte, email = excluded.email, telefone = excluded.telefone, aberta_em = excluded.aberta_em, busca = excluded.busca`,
      p,
    );
    if ((i / LOTE) % 50 === 0) console.log(`Gravados ${Math.min(i + LOTE, todos.length)}/${todos.length}`);
  }
  console.log(`Concluído: ${todos.length} estabelecimentos.`);
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

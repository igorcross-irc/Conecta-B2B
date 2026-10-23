/**
 * Leitura da base aberta de CNPJ da Receita Federal em Parquet (espelho público "CNPJ Aberto" no Hugging Face,
 * mesmo conteúdo dos arquivos da Receita). Usa DuckDB para filtrar por UF/situação direto na fonte,
 * sem baixar os ~8 GB de CSV. Só roda em scripts (Node), nunca no app.
 */
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { normalizarBusca } from "../cnpj";

export interface LinhaReceita {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  matriz: boolean;
  cnae: number | null;
  uf: string;
  municipio: string | null;
  bairro: string | null;
  cep: string | null;
  porte: string | null;
  email: string | null;
  telefone: string | null;
  abertaEm: string | null;
  busca: string;
}

export interface OpcoesLeitura {
  /** Pasta/URL com as subpastas estabelecimentos/, empresas/, cnaes/, municipios/ (cada uma com *.parquet). */
  fonte: string;
  ufs: string[];
  filiais?: boolean;
  log?: (m: string) => void;
}

const PORTE: Record<string, string> = { "00": "Não informado", "01": "Micro empresa", "03": "Empresa de pequeno porte", "05": "Demais" };
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const parquet = (fonte: string, tabela: string) => `read_parquet(${q(`${fonte.replace(/\/$/, "")}/${tabela}/*.parquet`)})`;

async function colunas(c: DuckDBConnection, tabela: string): Promise<string[]> {
  const r = await c.runAndReadAll(`select column_name from (describe select * from ${tabela})`);
  return r.getRowObjectsJson().map((x) => String(x.column_name));
}

export async function abrir(fonte: string): Promise<DuckDBConnection> {
  const inst = await DuckDBInstance.create(":memory:");
  const c = await inst.connect();
  if (/^(hf|https?):/.test(fonte)) await c.run("install httpfs; load httpfs;");
  return c;
}

export async function listarModelosDeFonte(c: DuckDBConnection, fonte: string) {
  return colunas(c, parquet(fonte, "estabelecimentos"));
}

/** Prepara as tabelas temporárias e devolve quantas linhas serão importadas. */
export async function preparar(c: DuckDBConnection, o: OpcoesLeitura): Promise<number> {
  const log = o.log ?? (() => {});
  const ufs = o.ufs.map((u) => q(u.toUpperCase())).join(",");
  log("Filtrando estabelecimentos (UF, ativos)…");
  await c.run(`
    create temp table est as
    select cnpj_basico || cnpj_ordem || cnpj_dv as cnpj, cnpj_basico, nome_fantasia,
           identificador_matriz_filial = '1' as matriz, try_cast(cnae_fiscal_principal as integer) as cnae,
           uf, municipio as cod_municipio, bairro, cep, correio_eletronico as email,
           nullif(coalesce(ddd1, '') || coalesce(telefone1, ''), '') as telefone, data_inicio_atividade
      from ${parquet(o.fonte, "estabelecimentos")}
     where situacao_cadastral = '02' and uf in (${ufs}) ${o.filiais ? "" : "and identificador_matriz_filial = '1'"}`);
  const n = Number((await c.runAndReadAll("select count(*) as n from est")).getRowObjectsJson()[0].n);
  log(`${n} estabelecimentos encontrados. Buscando razão social e porte…`);

  const colEmp = await colunas(c, parquet(o.fonte, "empresas"));
  const razao = colEmp.find((x) => /razao/.test(x)) ?? colEmp[1];
  const porte = colEmp.find((x) => /porte/.test(x));
  await c.run(`
    create temp table emp as
    select cnpj_basico, ${razao} as razao_social, ${porte ? `${porte} as porte` : "null as porte"}
      from ${parquet(o.fonte, "empresas")}
     where cnpj_basico in (select distinct cnpj_basico from est)`);

  const colMun = await colunas(c, parquet(o.fonte, "municipios"));
  await c.run(`create temp table mun as select ${colMun[0]} as codigo, ${colMun[1]} as nome from ${parquet(o.fonte, "municipios")}`);
  return n;
}

/** Lê o resultado em páginas, já no formato da tabela rf_estabelecimento. */
export async function* linhas(c: DuckDBConnection, tamanho = 5000): AsyncGenerator<LinhaReceita[]> {
  for (let off = 0; ; off += tamanho) {
    const r = await c.runAndReadAll(`
      select e.cnpj, coalesce(p.razao_social, nullif(e.nome_fantasia, ''), e.cnpj) as razao, nullif(e.nome_fantasia, '') as fantasia, e.matriz,
             e.cnae, e.uf, m.nome as municipio, nullif(e.bairro, '') as bairro, nullif(e.cep, '') as cep, p.porte,
             nullif(lower(e.email), '') as email, e.telefone, e.data_inicio_atividade as aberta
        from est e left join emp p using (cnpj_basico) left join mun m on m.codigo = e.cod_municipio
       order by e.cnpj limit ${tamanho} offset ${off}`);
    const rs = r.getRowObjectsJson() as Record<string, string | boolean | null>[];
    if (rs.length === 0) return;
    yield rs.map((x) => {
      const aberta = typeof x.aberta === "string" && /^\d{8}$/.test(x.aberta) && x.aberta !== "00000000"
        ? `${x.aberta.slice(0, 4)}-${x.aberta.slice(4, 6)}-${x.aberta.slice(6, 8)}` : null;
      const razao = String(x.razao);
      return {
        cnpj: String(x.cnpj), razaoSocial: razao, nomeFantasia: (x.fantasia as string) ?? null, matriz: x.matriz === true || x.matriz === "true",
        cnae: x.cnae == null ? null : Number(x.cnae), uf: String(x.uf), municipio: (x.municipio as string) ?? null,
        bairro: (x.bairro as string) ?? null, cep: (x.cep as string) ?? null,
        porte: x.porte == null ? null : (PORTE[String(x.porte)] ?? null), email: (x.email as string) ?? null,
        telefone: (x.telefone as string) ?? null, abertaEm: aberta, busca: normalizarBusca(`${razao} ${x.fantasia ?? ""}`),
      };
    });
  }
}

export async function lerCnaes(c: DuckDBConnection, fonte: string): Promise<{ codigo: number; descricao: string }[]> {
  const col = await colunas(c, parquet(fonte, "cnaes"));
  const r = await c.runAndReadAll(`select ${col[0]} as codigo, ${col[1]} as descricao from ${parquet(fonte, "cnaes")}`);
  return (r.getRowObjectsJson() as { codigo: string; descricao: string }[])
    .map((x) => ({ codigo: Number(x.codigo), descricao: String(x.descricao) }))
    .filter((x) => Number.isFinite(x.codigo));
}

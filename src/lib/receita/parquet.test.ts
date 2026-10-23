import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { abrir, lerCnaes, linhas, preparar } from "./parquet";

async function fixture(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "rfb-"));
  for (const t of ["estabelecimentos", "empresas", "cnaes", "municipios"]) mkdirSync(join(dir, t));
  const c = await (await DuckDBInstance.create(":memory:")).connect();
  await c.run(`copy (select * from (values
    ('33000167','0001','01','1','Atacadão','02','2010-01-01','','','','20100101','4639701','','R','Rio','10','','Barra da Tijuca','22640000','RJ','6001','21','99999999','','','','','Vendas@Atacadao.com.br','',''),
    ('33000167','0002','82','2','Atacadão Filial','02','','','','','20100101','4639701','','R','Rio','10','','Centro','20000000','RJ','6001','','','','','','','','',''),
    ('11222333','0001','81','1','','08','','','','','20000101','4721102','','R','X','1','','Mooca','03000000','SP','7107','','','','','','','','',''),
    ('00000000','0001','91','1','Pão Quente','02','','','','','00000000','4721102','','R','Y','1','','Icaraí','24000000','RJ','5501','21','12345678','','','','','','','')
  ) t(cnpj_basico,cnpj_ordem,cnpj_dv,identificador_matriz_filial,nome_fantasia,situacao_cadastral,data_situacao_cadastral,motivo_situacao_cadastral,nome_cidade_exterior,pais,data_inicio_atividade,cnae_fiscal_principal,cnae_fiscal_secundaria,tipo_logradouro,logradouro,numero,complemento,bairro,cep,uf,municipio,ddd1,telefone1,ddd2,telefone2,ddd_fax,fax,correio_eletronico,situacao_especial,data_situacao_especial)) to '${dir}/estabelecimentos/0.parquet' (format parquet)`);
  await c.run(`copy (select * from (values ('33000167','ATACADAO S.A.','2062','49','1000,00','05',''),('00000000','PADARIA DO ZE LTDA','2062','49','10,00','01','')) t(cnpj_basico,razao_social,natureza_juridica,qualificacao_responsavel,capital_social,porte_empresa,ente_federativo)) to '${dir}/empresas/0.parquet' (format parquet)`);
  await c.run(`copy (select * from (values ('4639701','Comércio atacadista de produtos alimentícios'),('4721102','Padaria')) t(codigo,descricao)) to '${dir}/cnaes/0.parquet' (format parquet)`);
  await c.run(`copy (select * from (values ('6001','RIO DE JANEIRO'),('5501','NITEROI'),('7107','SAO PAULO')) t(codigo,descricao)) to '${dir}/municipios/0.parquet' (format parquet)`);
  return dir;
}

describe("leitura da base da Receita em Parquet", () => {
  it("filtra por UF/ativos/matriz e junta razão social, município e porte", async () => {
    const fonte = await fixture();
    const c = await abrir(fonte);
    expect(await preparar(c, { fonte, ufs: ["RJ"] })).toBe(2);
    const todas = [];
    for await (const l of linhas(c, 1)) todas.push(...l);
    expect(todas.map((x) => x.cnpj)).toEqual(["00000000000191", "33000167000101"]);
    expect(todas[1]).toMatchObject({
      razaoSocial: "ATACADAO S.A.", nomeFantasia: "Atacadão", municipio: "RIO DE JANEIRO", uf: "RJ", cnae: 4639701,
      porte: "Demais", email: "vendas@atacadao.com.br", telefone: "2199999999", abertaEm: "2010-01-01", matriz: true,
    });
    expect(todas[1].busca).toBe("atacadao s a atacadao");
    expect(todas[0].abertaEm).toBeNull();
    expect((await lerCnaes(c, fonte))[0]).toEqual({ codigo: 4639701, descricao: "Comércio atacadista de produtos alimentícios" });
  });

  it("com filiais e várias UFs", async () => {
    const fonte = await fixture();
    const c = await abrir(fonte);
    expect(await preparar(c, { fonte, ufs: ["RJ", "SP"], filiais: true })).toBe(3);
  });
});

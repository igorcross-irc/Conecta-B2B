import { rmSync } from "node:fs";
import { abrirBancoLocal } from "../src/db/local";

/** Completa os 12 primeiros dígitos com os dois verificadores (os testes precisam de CNPJs válidos). */
function cnpj(base12: string): string {
  const dv = (d: string) => {
    const pesos = d.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = d.split("").reduce((s, x, i) => s + Number(x) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base12);
  return `${base12}${d1}${dv(base12 + d1)}`;
}

/** Cria um banco local novo com algumas empresas da Receita (RJ e SP), para os testes de pesquisa. */
async function main() {
  rmSync(".dados-e2e", { recursive: true, force: true });
  const db = await abrirBancoLocal(".dados-e2e", 20);
  await db.exec(`insert into rf_cnae (codigo, descricao, busca) values
    (1091102, 'Fabricação de produtos de padaria e confeitaria', 'fabricacao de produtos de padaria e confeitaria'),
    (4721102, 'Padaria e confeitaria com predominância de revenda', 'padaria e confeitaria com predominancia de revenda')`);
  const linhas = [
    [cnpj("100000000001"), "PADARIA ESTRELA LTDA", "Padaria Estrela", 4721102, "RJ", "NITEROI", "ICARAI", "Micro empresa", "contato@estrela.com.br"],
    [cnpj("100000000002"), "PAO QUENTE LTDA", "Pão Quente", 4721102, "RJ", "RIO DE JANEIRO", "CENTRO", "Empresa de pequeno porte", null],
    [cnpj("100000000003"), "FORNO DE MINAS LTDA", "Forno de Minas", 1091102, "RJ", "NILOPOLIS", "CENTRO", "Demais", "vendas@forno.com.br"],
    [cnpj("100000000004"), "PADARIA PAULISTA LTDA", "Padaria Paulista", 4721102, "SP", "SAO PAULO", "MOOCA", "Micro empresa", null],
  ];
  const valores = linhas
    .map((l) => `('${l[0]}','${l[1]}','${l[2]}',true,'ATIVA',${l[3]},'${l[4]}','${l[5]}','${l[6]}','${l[7]}',${l[8] ? `'${l[8]}'` : "null"},'2133334444', current_date - 400, '${String(l[1]).toLowerCase()} ${String(l[2]).toLowerCase()}')`)
    .join(",");
  await db.exec(`insert into rf_estabelecimento (cnpj, razao_social, nome_fantasia, matriz, situacao, cnae, uf, municipio, bairro, porte, email, telefone, aberta_em, busca) values ${valores}`);
  await db.exec("select atualizar_municipios()");
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { buscarEmCascata } from "./cascade";
import { cnpjValido, somenteDigitos } from "./cnpj";
import type { ProvedorContatos, ProvedorEmpresa } from "./providers/types";

export interface LinhaTeste {
  cnpj: string;
  segmento: string;
  empresa: "ok" | "nao_encontrada" | "erro" | "cnpj_invalido";
  razaoSocial: string;
  situacao: string;
  dominio: string;
  telefonesCadastrais: number;
  emailsCadastrais: number;
  socios: number;
  decisores: number;
  comEmail: number;
  emailsVerificados: number;
  comTelefone: number;
  comLinkedin: number;
  erro: string;
  segundos: number;
}

export interface Resumo {
  total: number;
  empresasEncontradas: number;
  comDominio: number;
  comDecisores: number;
  comEmailVerificado: number;
  decisoresTotal: number;
  emailsVerificadosTotal: number;
}

export const COLUNAS: (keyof LinhaTeste)[] = [
  "cnpj", "segmento", "empresa", "razaoSocial", "situacao", "dominio", "telefonesCadastrais",
  "emailsCadastrais", "socios", "decisores", "comEmail", "emailsVerificados", "comTelefone",
  "comLinkedin", "erro", "segundos",
];

interface Opcoes {
  empresa: ProvedorEmpresa;
  contatos: ProvedorContatos[];
  cargos?: string[];
  /** Pausa entre empresas (ms), para respeitar limites de taxa como os 5 por minuto da CNPJá aberta. */
  pausaMs?: number;
  dormir?: (ms: number) => Promise<void>;
  aoProgredir?: (feito: number, total: number, linha: LinhaTeste) => void;
}

export async function executarTeste(
  entradas: { cnpj: string; segmento?: string }[],
  { empresa, contatos, cargos = [], pausaMs = 0, dormir = (ms) => new Promise((r) => setTimeout(r, ms)), aoProgredir }: Opcoes,
): Promise<{ linhas: LinhaTeste[]; resumo: Resumo }> {
  const linhas: LinhaTeste[] = [];
  for (const [i, e] of entradas.entries()) {
    const t0 = Date.now();
    const base: LinhaTeste = {
      cnpj: somenteDigitos(e.cnpj), segmento: e.segmento ?? "", empresa: "ok", razaoSocial: "", situacao: "",
      dominio: "", telefonesCadastrais: 0, emailsCadastrais: 0, socios: 0, decisores: 0, comEmail: 0,
      emailsVerificados: 0, comTelefone: 0, comLinkedin: 0, erro: "", segundos: 0,
    };
    if (!cnpjValido(e.cnpj)) {
      base.empresa = "cnpj_invalido";
    } else {
      try {
        if (i > 0 && pausaMs > 0) await dormir(pausaMs);
        const emp = await empresa.buscarPorCnpj(base.cnpj);
        if (!emp) base.empresa = "nao_encontrada";
        else {
          Object.assign(base, {
            razaoSocial: emp.razaoSocial, situacao: emp.situacao, dominio: emp.dominio ?? "",
            telefonesCadastrais: emp.telefones.length, emailsCadastrais: emp.emailsCadastrais.length,
            socios: emp.socios.length,
          });
          const r = await buscarEmCascata(contatos, { empresa: emp, cargos }, {});
          base.decisores = r.contatos.length;
          base.comEmail = r.contatos.filter((c) => c.email).length;
          base.emailsVerificados = r.contatos.filter((c) => c.emailStatus === "verificado").length;
          base.comTelefone = r.contatos.filter((c) => c.telefone).length;
          base.comLinkedin = r.contatos.filter((c) => c.linkedinUrl).length;
          const falhas = r.tentativas.filter((t) => t.erro).map((t) => `${t.provedor}: ${t.erro}`);
          if (falhas.length) base.erro = falhas.join(" | ");
        }
      } catch (err) {
        base.empresa = "erro";
        base.erro = err instanceof Error ? err.message : String(err);
      }
    }
    base.segundos = Math.round((Date.now() - t0) / 100) / 10;
    linhas.push(base);
    aoProgredir?.(i + 1, entradas.length, base);
  }
  const resumo: Resumo = {
    total: linhas.length,
    empresasEncontradas: linhas.filter((l) => l.empresa === "ok").length,
    comDominio: linhas.filter((l) => l.dominio).length,
    comDecisores: linhas.filter((l) => l.decisores > 0).length,
    comEmailVerificado: linhas.filter((l) => l.emailsVerificados > 0).length,
    decisoresTotal: linhas.reduce((a, l) => a + l.decisores, 0),
    emailsVerificadosTotal: linhas.reduce((a, l) => a + l.emailsVerificados, 0),
  };
  return { linhas, resumo };
}

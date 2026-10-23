/** Classifica o texto de um cargo em departamento e senioridade (português do Brasil). Heurística simples e previsível. */

export const SENIORIDADES = ["C-Level", "Sócio / Fundador", "Diretoria", "Gerência", "Coordenação", "Outros"] as const;
export const DEPARTAMENTOS = ["Vendas", "Marketing", "Financeiro", "Operações", "TI", "RH", "Jurídico", "Compras", "Geral"] as const;
export type Senioridade = (typeof SENIORIDADES)[number];
export type Departamento = (typeof DEPARTAMENTOS)[number];

const sem = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function classificarSenioridade(cargo: string): Senioridade {
  const c = sem(cargo);
  if (/\b(ceo|cfo|cmo|coo|cto|cro|cio|chief)\b|presidente|diretor(a)?[- ]?(geral|executivo)/.test(c)) return "C-Level";
  if (/socio|socia|fundador|proprietari|\bdono\b|\bowner\b|titular|administrador/.test(c)) return "Sócio / Fundador";
  if (/diretor|diretora|\bvp\b|vice[- ]?presidente|superintendente/.test(c)) return "Diretoria";
  if (/gerente|\bhead\b|\bgm\b/.test(c)) return "Gerência";
  if (/coordenador|coordenadora|supervisor|lider|\blead\b/.test(c)) return "Coordenação";
  return "Outros";
}

export function classificarDepartamento(cargo: string): Departamento {
  const c = sem(cargo);
  if (/vendas|comercial|\bsales\b|negocios|business development|\bsdr\b|\bbdr\b|\bcro\b|relacionamento com clientes/.test(c)) return "Vendas";
  if (/marketing|midia|publicidade|comunicacao|branding|growth|conteudo|\bcmo\b|\bmkt\b/.test(c)) return "Marketing";
  if (/financ|controller|contabil|tesour|fiscal|\bcfo\b|controladoria/.test(c)) return "Financeiro";
  if (/compras|procurement|suprimentos|aquisic/.test(c)) return "Compras";
  if (/operac|logistic|producao|supply|manutencao|qualidade|\bcoo\b|fabrica|planta/.test(c)) return "Operações";
  if (/\bti\b|tecnologia|sistemas|software|dados|\bcto\b|\bcio\b|seguranca da informacao|infraestrutura|desenvolvimento/.test(c)) return "TI";
  if (/\brh\b|recursos humanos|pessoas|\bgente\b|people|talent|recrut|departamento pessoal/.test(c)) return "RH";
  if (/juridic|\blegal\b|compliance|advogad/.test(c)) return "Jurídico";
  return "Geral";
}

export function classificarCargo(cargo: string) {
  return { senioridade: classificarSenioridade(cargo), departamento: classificarDepartamento(cargo) };
}

/** Quanto o cargo pesa numa decisão de compra, de 0 a 1 (para ordenar). */
export function pesoDoCargo(cargo: string): number {
  switch (classificarSenioridade(cargo)) {
    case "C-Level": return 1;
    case "Sócio / Fundador": return 0.95;
    case "Diretoria": return 0.85;
    case "Gerência": return 0.65;
    case "Coordenação": return 0.4;
    default: return 0.2;
  }
}

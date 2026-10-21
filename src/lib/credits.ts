/**
 * Razão de créditos: cobrança, estorno e saldo.
 * Regras (vindas do ConnectLeads e do comparativo de mercado):
 * - cada operação cobrada gera um lançamento negativo;
 * - falha ou ausência de resultado gera estorno (lançamento positivo ligado ao original);
 * - uma mesma chave de idempotência nunca cobra duas vezes;
 * - o estorno também é idempotente.
 */

export type Operacao =
  | "busca_decisores"
  | "revelar_email"
  | "revelar_telefone"
  | "recarga"
  | "estorno";

export interface Lancamento {
  id: string;
  operacao: Operacao;
  /** Negativo para cobrança, positivo para recarga e estorno. */
  valor: number;
  saldoApos: number;
  descricao: string;
  /** Chave de idempotência da operação, quando houver. */
  chave?: string;
  /** Para estornos: id do lançamento estornado. */
  estornaId?: string;
  criadoEm: string;
}

/** Tabela de custos em créditos. Configurável por organização (tenant). */
export type TabelaCustos = Record<
  Exclude<Operacao, "recarga" | "estorno">,
  number
>;

/** Valores iniciais. O custo do telefone é uma hipótese: o vídeo do ConnectLeads não o mostra. */
export const TABELA_CUSTOS_PADRAO: TabelaCustos = {
  busca_decisores: 1,
  revelar_email: 1,
  revelar_telefone: 5,
};

export class SaldoInsuficienteError extends Error {
  constructor(
    public readonly saldo: number,
    public readonly necessario: number,
  ) {
    super(`Saldo insuficiente: ${saldo} créditos, necessário ${necessario}.`);
    this.name = "SaldoInsuficienteError";
  }
}

export class Razao {
  private lancamentos: Lancamento[] = [];
  private saldo: number;
  private seq = 0;

  constructor(saldoInicial = 0, private agora: () => Date = () => new Date()) {
    this.saldo = saldoInicial;
  }

  get saldoAtual(): number {
    return this.saldo;
  }

  extrato(): Lancamento[] {
    return [...this.lancamentos].reverse();
  }

  private registrar(
    dados: Omit<Lancamento, "id" | "saldoApos" | "criadoEm">,
  ): Lancamento {
    this.saldo += dados.valor;
    const lanc: Lancamento = {
      ...dados,
      id: `l_${++this.seq}`,
      saldoApos: this.saldo,
      criadoEm: this.agora().toISOString(),
    };
    this.lancamentos.push(lanc);
    return lanc;
  }

  recarregar(creditos: number, descricao = "Recarga"): Lancamento {
    if (!Number.isInteger(creditos) || creditos <= 0) {
      throw new RangeError("A recarga deve ser um inteiro positivo.");
    }
    return this.registrar({ operacao: "recarga", valor: creditos, descricao });
  }

  /** Cobra uma operação. Repetir a mesma chave devolve o lançamento original sem cobrar de novo. */
  cobrar(
    operacao: Exclude<Operacao, "recarga" | "estorno">,
    custo: number,
    descricao: string,
    chave?: string,
  ): Lancamento {
    if (chave) {
      const existente = this.lancamentos.find(
        (l) => l.chave === chave && l.operacao === operacao,
      );
      if (existente) return existente;
    }
    if (custo <= 0) {
      throw new RangeError("O custo de uma cobrança deve ser positivo.");
    }
    if (this.saldo < custo) throw new SaldoInsuficienteError(this.saldo, custo);
    return this.registrar({ operacao, valor: -custo, descricao, chave });
  }

  /** Estorna uma cobrança. Só estorna uma vez por lançamento. */
  estornar(lancamentoId: string, motivo: string): Lancamento {
    const original = this.lancamentos.find((l) => l.id === lancamentoId);
    if (!original || original.valor >= 0) {
      throw new Error("Só é possível estornar uma cobrança existente.");
    }
    const jaEstornado = this.lancamentos.find(
      (l) => l.operacao === "estorno" && l.estornaId === lancamentoId,
    );
    if (jaEstornado) return jaEstornado;
    return this.registrar({
      operacao: "estorno",
      valor: -original.valor,
      descricao: `Estorno: ${motivo}`,
      estornaId: lancamentoId,
    });
  }
}

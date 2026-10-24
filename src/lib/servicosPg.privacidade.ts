import { randomBytes } from "node:crypto";
import { alvoValido, chaveAlvo } from "./cnpj";
import { ErroDeNegocio } from "./servicos";
import { Linha, hashToken } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "privacidade". */
export function criarPrivacidade(c: Ctx) {
  const { db, org, um, servicos } = c;
  return {
    /**
     * Opt-out global: o e-mail não volta em buscas futuras e os dados já guardados são apagados
     * (e-mail e telefone do contato em todas as organizações).
     */
    async registrarOptOut(email: string): Promise<{ contatosAfetados: number }> {
      const e = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ErroDeNegocio("E-mail inválido.");
      const r = await um<{ n: number }>("select aplicar_opt_out($1) as n", [e]);
      return { contatosAfetados: r?.n ?? 0 };
    },
    /**
     * Cria um pedido de opt-out a ser confirmado pelo link enviado ao e-mail. Devolve o token (só vai para o
     * e-mail, o banco guarda o hash) ou null quando já há pedidos demais para esse e-mail na última hora.
     */
    async pedirOptOut(email: string): Promise<string | null> {
      const e = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ErroDeNegocio("E-mail inválido.");
      const recentes = await um<{ n: number }>(
        "select count(*)::int as n from optout_pedido where email = $1 and criado_em > now() - interval '1 hour'",
        [e],
      );
      if ((recentes?.n ?? 0) >= 3) return null;
      const token = randomBytes(32).toString("hex");
      await db.query("insert into optout_pedido (token_hash, email) values ($1, $2)", [hashToken(token), e]);
      return token;
    },
    /** Confirma um pedido de opt-out pelo token do e-mail e aplica o apagamento. Cada token vale uma vez. */
    async confirmarOptOut(token: string): Promise<{ contatosAfetados: number }> {
      if (!/^[0-9a-f]{64}$/.test(token)) throw new ErroDeNegocio("Link inválido ou expirado.", 400);
      const p = await um<{ email: string }>(
        `update optout_pedido set usado_em = now()
          where token_hash = $1 and usado_em is null and expira_em > now() returning email`,
        [hashToken(token)],
      );
      if (!p) throw new ErroDeNegocio("Link inválido ou expirado.", 400);
      return servicos.registrarOptOut(p.email);
    },
    /**
     * Limite de pedidos por chave (ex.: IP), contado no banco para valer em todos os servidores.
     * Devolve true se o pedido pode seguir (e já o conta).
     */
    async permitirPedido(chave: string, maximo: number, janelaSegundos: number): Promise<boolean> {
      const r = await um<{ n: number }>(
        "select count(*)::int as n from limite_pedido where chave = $1 and criado_em > now() - make_interval(secs => $2)",
        [chave, janelaSegundos],
      );
      if ((r?.n ?? 0) >= maximo) return false;
      await db.query("insert into limite_pedido (chave) values ($1)", [chave]);
      // Limpeza ocasional, para a tabela não crescer.
      if (Math.random() < 0.02) await db.query("delete from limite_pedido where criado_em < now() - interval '1 day'");
      return true;
    },
    /** Sinal de compra genérico (rádio, notícia, expansão etc.), sempre com fonte e data. */
    async registrarSinal(p: { cnpj: string; tipo: string; fonte: string; ocorridoEm: string; conteudo?: unknown }) {
      if (!alvoValido(p.cnpj)) throw new ErroDeNegocio("CNPJ inválido.");
      if (!p.tipo.trim() || !p.fonte.trim()) throw new ErroDeNegocio("Informe o tipo e a fonte do sinal.");
      const quando = new Date(p.ocorridoEm);
      if (Number.isNaN(quando.getTime())) throw new ErroDeNegocio("Data do sinal inválida.");
      const r = await um<{ id: string }>(
        `insert into sinal (organizacao_id, tipo, fonte, cnpj, ocorrido_em, conteudo)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [org, p.tipo.trim(), p.fonte.trim(), chaveAlvo(p.cnpj), quando.toISOString(), JSON.stringify(p.conteudo ?? {})],
      );
      return { id: r!.id };
    },
    async sinaisDoCnpj(cnpj: string) {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ inválido.");
      const r = await db.query<Linha>(
        `select id, tipo, fonte, ocorrido_em, conteudo from sinal
          where cnpj = $1 and (organizacao_id is null or organizacao_id = $2)
          order by ocorrido_em desc limit 100`,
        [chaveAlvo(cnpj), org],
      );
      return r.rows.map((x) => ({
        id: x.id as string,
        tipo: x.tipo as string,
        fonte: x.fonte as string,
        ocorridoEm: new Date(x.ocorrido_em as string).toISOString(),
        conteudo: x.conteudo,
      }));
    },
  };
}

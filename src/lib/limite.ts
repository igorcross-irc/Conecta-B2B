/**
 * Limite de pedidos por chave (ex.: IP) em janela deslizante, na memória do processo.
 * Protege rotas públicas de abuso simples. Em vários servidores cada um conta separado;
 * se isso virar problema, trocar por contagem no banco.
 */
export function criarLimite(maximo: number, janelaMs: number, agora: () => number = Date.now) {
  const pedidos = new Map<string, number[]>();
  return {
    /** Retorna true se o pedido pode seguir e já o conta. */
    permitir(chave: string): boolean {
      const t = agora();
      const recentes = (pedidos.get(chave) ?? []).filter((x) => t - x < janelaMs);
      if (recentes.length >= maximo) {
        pedidos.set(chave, recentes);
        return false;
      }
      recentes.push(t);
      pedidos.set(chave, recentes);
      if (pedidos.size > 10_000) for (const [k, v] of pedidos) if (!v.some((x) => t - x < janelaMs)) pedidos.delete(k);
      return true;
    },
  };
}

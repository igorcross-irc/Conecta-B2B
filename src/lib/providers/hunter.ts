import { classificarCargo } from "../cargos";
import type { Contato, EntradaBuscaContatos, ProvedorContatos } from "./types";

/**
 * Hunter.io: busca de e-mails por domínio (GET /v2/domain-search). Chave em HUNTER_API_KEY.
 * Plano gratuito com poucas buscas por mês (confira no site). Traz nome, cargo, departamento, senioridade,
 * LinkedIn e uma nota de confiança por e-mail, tudo de fontes públicas segundo o próprio Hunter.
 * Formato da resposta conforme a documentação pública; não foi conferido com chamada real.
 */
interface RespostaHunter {
  data?: {
    pattern?: string | null;
    emails?: {
      value?: string;
      type?: string;
      confidence?: number;
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
      seniority?: string | null;
      department?: string | null;
      linkedin?: string | null;
      phone_number?: string | null;
      verification?: { status?: string | null } | null;
    }[];
  };
}

export class Hunter implements ProvedorContatos {
  nome = "Hunter.io (e-mails por domínio)";
  constructor(private chave: string, private http: typeof fetch = fetch) {}

  async buscar({ empresa }: EntradaBuscaContatos): Promise<Contato[]> {
    const dominio = empresa.dominio?.replace(/^www\./, "");
    if (!dominio) return [];
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(dominio)}&limit=25`;
    const r = await this.http(url, { headers: { "X-API-KEY": this.chave }, signal: AbortSignal.timeout(20000) });
    if (r.status === 429 || r.status === 402) throw new Error("Hunter: limite do plano atingido.");
    if (r.status === 401) throw new Error("Hunter: chave inválida.");
    if (!r.ok) throw new Error(`Hunter: HTTP ${r.status}`);
    const j = (await r.json()) as RespostaHunter;
    const agora = new Date().toISOString();
    return (j.data?.emails ?? []).flatMap((e): Contato[] => {
      if (!e.value) return [];
      const nome = [e.first_name, e.last_name].filter(Boolean).join(" ");
      const generico = e.type === "generic" || !nome;
      const cargo = e.position || (generico ? "Caixa genérica da empresa" : "Pessoa ligada à empresa");
      const c = e.position ? classificarCargo(e.position) : undefined;
      const verificado = e.verification?.status === "valid";
      return [{
        nome: nome || `Caixa ${e.value.split("@")[0]} (${dominio})`,
        cargo,
        senioridade: c?.senioridade,
        departamento: e.department || c?.departamento,
        email: e.value.toLowerCase(),
        emailStatus: verificado ? "verificado" : "nao_verificado",
        telefone: e.phone_number || undefined,
        linkedinUrl: e.linkedin ? (e.linkedin.startsWith("http") ? e.linkedin : `https://${e.linkedin}`) : undefined,
        origem: `Hunter.io (${dominio})`,
        obtidoEm: agora,
        confianca: Math.min(0.9, Math.max(0.3, (e.confidence ?? 50) / 100)),
      }];
    });
  }
}

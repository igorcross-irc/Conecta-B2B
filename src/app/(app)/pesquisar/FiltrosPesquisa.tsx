"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Fechar, Filtro } from "@/components/Icones";
import { ABERTURAS, PORTES, SETORES } from "@/lib/setores";
import { UFS } from "@/lib/ufs";

export interface ValoresFiltro {
  nome: string; termos: string; segmento: string; uf: string; cidade: string; bairro: string;
  setores: string[]; porte: string[]; abertura: string; email: boolean; telefone: boolean; filiais: boolean; ordem: string;
}

interface Sugestao { valor: string; detalhe?: string }

/** Sugestões ao digitar (cidades e atividades), com pequena espera para não consultar a cada tecla. */
function useSugestoes(campo: "cidade" | "segmento", texto: string, uf: string): Sugestao[] {
  const [lista, setLista] = useState<Sugestao[]>([]);
  useEffect(() => {
    const t = texto.trim();
    if (t.length < 2) return;
    const ctl = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pesquisar/sugestoes?campo=${campo}&q=${encodeURIComponent(t)}&uf=${uf}`, { signal: ctl.signal });
        if (r.ok) setLista(await r.json());
      } catch {
        /* sem sugestões: o campo continua funcionando como texto livre */
      }
    }, 250);
    return () => {
      clearTimeout(espera);
      ctl.abort();
    };
  }, [campo, texto, uf]);
  return texto.trim().length < 2 ? [] : lista;
}

function Grupo({ titulo, children, aberto = true }: { titulo: string; children: React.ReactNode; aberto?: boolean }) {
  return (
    <details open={aberto} className="group border-b border-slate-100 py-3 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800 marker:hidden">
        {titulo}
        <span className="text-slate-400 transition group-open:rotate-180" aria-hidden>⌄</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/**
 * Painel de filtros. Computador largo: coluna fixa à esquerda. Tablet e celular: folha que sobe de baixo (botão "Filtros").
 * Os filtros se aplicam sozinhos ao escolher uma opção; campos de texto aplicam ao sair do campo ou com Enter.
 */
export function FiltrosPesquisa({ valores, ativos }: { valores: ValoresFiltro; ativos: number }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [cidade, setCidade] = useState(valores.cidade);
  const [uf, setUf] = useState(valores.uf);
  const [segmento, setSegmento] = useState(valores.segmento);
  const sugCidades = useSugestoes("cidade", cidade, uf);
  const sugAtividades = useSugestoes("segmento", segmento, "");

  function aplicar() {
    const f = form.current;
    if (!f) return;
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(f).entries()) if (typeof v === "string" && v.trim()) q.append(k, v.trim());
    iniciar(() => router.push(`/pesquisar${q.toString() ? `?${q}` : ""}`));
    setAberto(false);
  }
  // Várias escolhas seguidas (ex.: dois setores) viram uma só pesquisa.
  const agendar = () => {
    clearTimeout(espera.current);
    espera.current = setTimeout(aplicar, 450);
  };
  useEffect(() => () => clearTimeout(espera.current), []);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-sec w-full xl:hidden" aria-expanded={aberto}>
        <Filtro width={18} height={18} /> Filtros{ativos > 0 && <span className="selo">{ativos}</span>}
      </button>
      {aberto && <div className="fixed inset-0 z-40 bg-black/50 xl:hidden" onClick={() => setAberto(false)} aria-hidden />}

      <form
        ref={form}
        method="get"
        action="/pesquisar"
        aria-busy={pendente}
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
        onChange={agendar}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform md:inset-x-auto md:left-1/2 md:w-[34rem] md:-translate-x-1/2 xl:sticky xl:top-6 xl:z-auto xl:max-h-[calc(100vh-3rem)] xl:w-auto xl:translate-x-0 xl:rounded-2xl xl:border xl:border-slate-200/80 xl:shadow-[var(--shadow-cartao)] ${
          aberto ? "translate-y-0" : "translate-y-full xl:translate-y-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold"><Filtro width={18} height={18} /> Filtros{pendente && <span className="text-xs font-normal text-slate-500">aplicando…</span>}</h2>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar filtros" className="rounded-lg p-1.5 hover:bg-slate-100 xl:hidden"><Fechar /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {valores.termos && <input type="hidden" name="termos" value={valores.termos} />}

          <Grupo titulo="Empresa">
            <label className="block text-sm">
              <span className="rotulo">Nome ou palavra-chave</span>
              <input name="nome" defaultValue={valores.nome} placeholder="Ex.: Atacadão, padaria" className="input mt-1" autoComplete="off" />
            </label>
            <label className="block text-sm">
              <span className="rotulo">Atividade (CNAE)</span>
              <input name="segmento" value={segmento} onChange={(e) => setSegmento(e.target.value)} list="sug-atividades" placeholder="Ex.: comércio atacadista" className="input mt-1" autoComplete="off" />
              <datalist id="sug-atividades">{sugAtividades.map((s) => <option key={s.valor} value={s.valor}>{s.detalhe}</option>)}</datalist>
            </label>
          </Grupo>

          <Grupo titulo="Localização">
            <label className="block text-sm">
              <span className="rotulo">Estado</span>
              <select name="uf" value={uf} onChange={(e) => setUf(e.target.value)} className="input mt-1">
                <option value="">Todos os estados</option>
                {UFS.map(([sigla, nome]) => <option key={sigla} value={sigla}>{sigla} · {nome}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="rotulo">Cidade</span>
              <input name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} list="sug-cidades" placeholder="Comece a digitar" className="input mt-1" autoComplete="off" />
              <datalist id="sug-cidades">{sugCidades.map((s) => <option key={s.valor + s.detalhe} value={s.valor}>{s.detalhe}</option>)}</datalist>
            </label>
            <label className="block text-sm">
              <span className="rotulo">Bairro</span>
              <input name="bairro" defaultValue={valores.bairro} placeholder="Ex.: Barra da Tijuca" className="input mt-1" autoComplete="off" />
            </label>
          </Grupo>

          <Grupo titulo={`Setor${valores.setores.length ? ` (${valores.setores.length})` : ""}`} aberto={valores.setores.length > 0}>
            <div className="flex flex-wrap gap-1.5">
              {SETORES.map((t) => (
                <label key={t.id} className="opcao">
                  <input type="checkbox" name="setor" value={t.id} defaultChecked={valores.setores.includes(t.id)} />
                  {t.nome}
                </label>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Porte e idade da empresa">
            <div className="flex flex-wrap gap-1.5">
              {PORTES.map((p) => (
                <label key={p} className="opcao">
                  <input type="checkbox" name="porte" value={p} defaultChecked={valores.porte.includes(p)} />
                  {p}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tempo de abertura">
              <label className="opcao"><input type="radio" name="abertura" value="" defaultChecked={!valores.abertura} />Qualquer idade</label>
              {ABERTURAS.map((a) => (
                <label key={a.id} className="opcao"><input type="radio" name="abertura" value={a.id} defaultChecked={valores.abertura === a.id} />{a.nome}</label>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Contato cadastral" aberto={valores.email || valores.telefone}>
            <div className="flex flex-wrap gap-1.5">
              <label className="opcao"><input type="checkbox" name="email" value="1" defaultChecked={valores.email} />Com e-mail</label>
              <label className="opcao"><input type="checkbox" name="telefone" value="1" defaultChecked={valores.telefone} />Com telefone</label>
            </div>
            <p className="text-xs text-slate-500">Dados cadastrais da Receita. Costumam ser da contabilidade; para o decisor, use “Descobrir”.</p>
          </Grupo>

          <Grupo titulo="Opções" aberto={valores.filiais || valores.ordem !== "nome"}>
            <label className="opcao"><input type="checkbox" name="filiais" value="1" defaultChecked={valores.filiais} />Incluir filiais</label>
            <label className="block text-sm">
              <span className="rotulo">Ordenar por</span>
              <select name="ordem" defaultValue={valores.ordem} className="input mt-1">
                <option value="nome">Nome (A–Z)</option>
                <option value="recentes">Mais recentes primeiro</option>
                <option value="aderencia">Maior aderência ao perfil ideal</option>
              </select>
            </label>
          </Grupo>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 bg-white px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Link href="/pesquisar" className="text-sm text-slate-600 underline">Limpar tudo</Link>
          <button className="btn-primario ml-auto">Aplicar filtros</button>
        </div>
      </form>
    </>
  );
}

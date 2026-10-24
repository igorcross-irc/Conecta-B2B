import Link from "next/link";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { chaveGemini } from "@/lib/ia/gemini";
import { BuscaNatural } from "./BuscaNatural";
import { paraParametros, resumoFiltros } from "@/lib/filtrosUrl";
import { removerPesquisaAcao, salvarPesquisaAcao } from "../acoes";
import { emailConfigurado } from "@/lib/email";
import { ABERTURAS, PORTES, SETORES } from "@/lib/setores";

export const metadata = { title: "Pesquisar" };

const CAMPOS = ["nome", "termos", "uf", "cidade", "bairro", "segmento"] as const;

export const maxDuration = 60;

export default async function Pesquisar({ searchParams }: PageProps<"/pesquisar">) {
  await connection();
  const sp = await searchParams;
  const v = Object.fromEntries(CAMPOS.map((c) => [c, typeof sp[c] === "string" ? (sp[c] as string) : ""])) as Record<(typeof CAMPOS)[number], string>;
  const lista = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : typeof sp[k] === "string" ? [sp[k] as string] : []);
  const setores = lista("setor").filter((x) => SETORES.some((t) => t.id === x));
  const portes = lista("porte").filter((x) => (PORTES as readonly string[]).includes(x));
  const abertura = typeof sp.abertura === "string" && ABERTURAS.some((x) => x.id === sp.abertura) ? (sp.abertura as string) : "";
  const comEmail = sp.email === "1";
  const comTelefone = sp.telefone === "1";
  const ordem: "nome" | "recentes" = sp.ordem === "recentes" ? "recentes" : "nome";
  const pagina = Math.max(0, Number(typeof sp.pagina === "string" ? sp.pagina : 0) || 0);
  const filiais = sp.filiais === "1";
  const { servicos } = await contexto();
  const salvas = await servicos.pesquisasSalvas();
  const erro = typeof sp.erro === "string" ? sp.erro : "";
  const salva = sp.salva === "1";
  const r = await servicos.pesquisar({ ...v, setores, porte: portes, abertura: abertura || undefined, comEmail, comTelefone, ordem, incluirFiliais: filiais, pagina });
  const buscou = CAMPOS.some((c) => v[c]) || setores.length > 0 || portes.length > 0 || Boolean(abertura) || comEmail || comTelefone;
  const qs = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const c of CAMPOS) if (v[c]) q.set(c, v[c]);
    for (const x of setores) q.append("setor", x);
    for (const x of portes) q.append("porte", x);
    if (abertura) q.set("abertura", abertura);
    if (comEmail) q.set("email", "1");
    if (comTelefone) q.set("telefone", "1");
    if (ordem === "recentes") q.set("ordem", "recentes");
    if (filiais) q.set("filiais", "1");
    for (const [k, val] of Object.entries(extra)) q.set(k, val);
    return "?" + q.toString();
  };
  const filtrosAtuais = { ...Object.fromEntries(CAMPOS.filter((c) => v[c]).map((c) => [c, v[c]])), setores, porte: portes, abertura: abertura || undefined, comEmail, comTelefone, ordem, incluirFiliais: filiais };
  const paramsAtuais = paraParametros(filtrosAtuais);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Pesquisar empresas</h1>
        <p className="sub-pagina">Procure por nome (ex.: Atacadão), localização e segmento. O resultado lista CNPJs e sites que combinam.</p>
      </header>
      {chaveGemini() && <BuscaNatural />}
      <form className="cartao grid gap-3 md:grid-cols-3" method="get">
        <label className="text-sm">Nome ou termo<input name="nome" defaultValue={v.nome} placeholder="Atacadão" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Outros termos<input name="termos" defaultValue={v.termos} placeholder="supermercado atacado" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Segmento (atividade ou CNAE)<input name="segmento" defaultValue={v.segmento} placeholder="comércio atacadista" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Estado (UF)<input name="uf" defaultValue={v.uf} maxLength={2} placeholder="RJ" className="campo mt-1 w-full uppercase" /></label>
        <label className="text-sm">Cidade<input name="cidade" defaultValue={v.cidade} placeholder="Rio de Janeiro" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Bairro<input name="bairro" defaultValue={v.bairro} placeholder="Barra da Tijuca" className="campo mt-1 w-full" /></label>
        <label className="text-sm md:col-span-3">Setor
          <select name="setor" multiple defaultValue={setores} size={6} className="campo mt-1 w-full">
            {SETORES.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <span className="text-xs text-slate-500">Segure Ctrl (ou Cmd) para escolher mais de um.</span>
        </label>
        <fieldset className="text-sm">
          <legend>Porte</legend>
          {PORTES.map((x) => (
            <label key={x} className="mt-1 flex items-center gap-2"><input type="checkbox" name="porte" value={x} defaultChecked={portes.includes(x)} /> {x}</label>
          ))}
        </fieldset>
        <label className="text-sm">Tempo de abertura
          <select name="abertura" defaultValue={abertura} className="campo mt-1 w-full">
            <option value="">Qualquer</option>
            {ABERTURAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">Ordenar por
          <select name="ordem" defaultValue={ordem} className="campo mt-1 w-full">
            <option value="nome">Nome</option>
            <option value="recentes">Mais recentes primeiro</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email" value="1" defaultChecked={comEmail} /> Com e-mail cadastral</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="telefone" value="1" defaultChecked={comTelefone} /> Com telefone cadastral</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="filiais" value="1" defaultChecked={filiais} /> Incluir filiais (padrão: só matrizes)</label>
        <button className="btn-primario md:col-span-3 md:justify-self-end">Pesquisar</button>
      </form>

      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
      {salva && <p className="aviso-ok">Pesquisa salva.</p>}

      {buscou && (
        <form action={salvarPesquisaAcao} className="cartao flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
          <input type="hidden" name="filtros" value={JSON.stringify(filtrosAtuais)} />
          <input type="hidden" name="volta" value={paramsAtuais} />
          <input name="nome" required maxLength={80} placeholder="Nome para salvar esta pesquisa" className="campo flex-1" aria-label="Nome da pesquisa" />
          <label className="flex items-center gap-2"><input type="checkbox" name="avisar" value="1" defaultChecked /> Avisar por e-mail quando houver empresas novas</label>
          <button className="btn-primario">Salvar pesquisa</button>
        </form>
      )}

      {salvas.length > 0 && (
        <section className="cartao space-y-2">
          <h2 className="font-medium">Pesquisas salvas</h2>
          {!emailConfigurado() && <p className="text-xs text-slate-500">O envio de e-mail ainda não está configurado: os avisos só começam depois que o operador configurar o Resend.</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {salvas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Link className="font-medium text-marca-700 hover:underline" href={`/pesquisar?${paraParametros(p.filtros)}`}>{p.nome}</Link>
                  <span className="block text-xs text-slate-500">{resumoFiltros(p.filtros)} · {p.avisar ? `aviso ligado (último ${p.ultimoAviso})` : "sem aviso"}</span>
                </span>
                <form action={removerPesquisaAcao}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="volta" value={paramsAtuais} />
                  <button className="text-xs text-slate-500 underline">Remover</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {buscou && !r.baseReceita && (
        <p className="cartao border-amber-300 bg-amber-50 text-sm">
          A base de estabelecimentos da Receita ainda não foi carregada, então só aparecem empresas e sites já pesquisados pela equipe. A carga é feita pelo workflow &quot;Importar Receita&quot; (veja o ESTADO.md).
        </p>
      )}

      {buscou && r.sites.length > 0 && (
        <section className="cartao space-y-2">
          <h2 className="font-medium">Sites conhecidos</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {r.sites.map((s) => (
              <li key={s}><Link className="rounded-full border border-marca-200 px-3 py-1 text-marca-700 hover:bg-marca-50" href={`/descobrir?alvo=${encodeURIComponent("site:" + s)}`}>{s}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {buscou && (
        <section className="cartao">
          <h2 className="mb-2 font-medium">{r.total} empresa(s)</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {r.itens.map((i) => (
              <li key={i.cnpj} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <Link href={`/descobrir?alvo=${i.cnpj}`} className="font-medium text-marca-700 hover:underline">{i.nomeFantasia || i.razaoSocial}</Link>
                  <p className="text-xs text-slate-500">{i.razaoSocial} · {i.cnpj}</p>
                  <p className="text-xs text-slate-500">{[i.bairro, i.municipio, i.uf].filter(Boolean).join(" · ")}{i.atividade ? ` · ${i.atividade}` : ""}</p>
                  <p className="text-xs text-slate-500">{[i.porte, i.abertaEm ? `aberta em ${i.abertaEm.slice(0, 4)}` : "", i.temEmail ? "e-mail cadastral" : "", i.temTelefone ? "telefone cadastral" : ""].filter(Boolean).join(" · ")}</p>
                </div>
                {i.dominio && <Link href={`/descobrir?alvo=${encodeURIComponent("site:" + i.dominio)}`} className="text-xs text-slate-600 underline">{i.dominio}</Link>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3 text-sm">
            {pagina > 0 && <Link className="text-marca-700" href={qs({ pagina: String(pagina - 1) })}>← Anterior</Link>}
            {(pagina + 1) * 25 < r.total && <Link className="text-marca-700" href={qs({ pagina: String(pagina + 1) })}>Próxima →</Link>}
          </div>
        </section>
      )}
    </div>
  );
}

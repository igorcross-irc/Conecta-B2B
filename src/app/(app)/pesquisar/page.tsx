import Link from "next/link";
import { connection } from "next/server";
import { contexto } from "@/lib/app";

export const metadata = { title: "Pesquisar" };

const CAMPOS = ["nome", "termos", "uf", "cidade", "bairro", "segmento"] as const;

export default async function Pesquisar({ searchParams }: PageProps<"/pesquisar">) {
  await connection();
  const sp = await searchParams;
  const v = Object.fromEntries(CAMPOS.map((c) => [c, typeof sp[c] === "string" ? (sp[c] as string) : ""])) as Record<(typeof CAMPOS)[number], string>;
  const pagina = Math.max(0, Number(typeof sp.pagina === "string" ? sp.pagina : 0) || 0);
  const filiais = sp.filiais === "1";
  const { servicos } = await contexto();
  const r = await servicos.pesquisar({ ...v, incluirFiliais: filiais, pagina });
  const buscou = CAMPOS.some((c) => v[c]);
  const qs = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ ...Object.fromEntries(CAMPOS.filter((c) => v[c]).map((c) => [c, v[c]])), ...(filiais ? { filiais: "1" } : {}), ...extra }).toString();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Pesquisar empresas</h1>
        <p className="sub-pagina">Procure por nome (ex.: Atacadão), localização e segmento. O resultado lista CNPJs e sites que combinam.</p>
      </header>
      <form className="cartao grid gap-3 md:grid-cols-3" method="get">
        <label className="text-sm">Nome ou termo<input name="nome" defaultValue={v.nome} placeholder="Atacadão" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Outros termos<input name="termos" defaultValue={v.termos} placeholder="supermercado atacado" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Segmento (atividade ou CNAE)<input name="segmento" defaultValue={v.segmento} placeholder="comércio atacadista" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Estado (UF)<input name="uf" defaultValue={v.uf} maxLength={2} placeholder="RJ" className="campo mt-1 w-full uppercase" /></label>
        <label className="text-sm">Cidade<input name="cidade" defaultValue={v.cidade} placeholder="Rio de Janeiro" className="campo mt-1 w-full" /></label>
        <label className="text-sm">Bairro<input name="bairro" defaultValue={v.bairro} placeholder="Barra da Tijuca" className="campo mt-1 w-full" /></label>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="filiais" value="1" defaultChecked={filiais} /> Incluir filiais (padrão: só matrizes)</label>
        <button className="btn md:justify-self-end">Pesquisar</button>
      </form>

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

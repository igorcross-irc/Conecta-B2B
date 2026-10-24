import type { Dependencias } from "./servicosPg.tipos";
import { criarAuxiliares } from "./servicosPg.contexto";
import { criarCreditos } from "./servicosPg.creditos";
import { criarEmpresa } from "./servicosPg.empresa";
import { criarBuscas } from "./servicosPg.buscas";
import { criarEquipe } from "./servicosPg.equipe";
import { criarPesquisa } from "./servicosPg.pesquisa";
import { criarBaseComum } from "./servicosPg.baseComum";
import { criarListas } from "./servicosPg.listas";
import { criarPrivacidade } from "./servicosPg.privacidade";
import { criarApi } from "./servicosPg.api";
import { criarAdmin } from "./servicosPg.admin";

export * from "./servicosPg.tipos";

export type ServicosPg = ReturnType<typeof criarCreditos> &
  ReturnType<typeof criarEmpresa> &
  ReturnType<typeof criarBuscas> &
  ReturnType<typeof criarEquipe> &
  ReturnType<typeof criarPesquisa> &
  ReturnType<typeof criarBaseComum> &
  ReturnType<typeof criarListas> &
  ReturnType<typeof criarPrivacidade> &
  ReturnType<typeof criarApi> &
  ReturnType<typeof criarAdmin>;

/** Mesma interface do serviço em memória, mas persistida em Postgres (todas as chamadas são assíncronas). */
export function criarServicosPg(deps: Dependencias): ServicosPg {
  const servicos = {} as ServicosPg;
  const c = criarAuxiliares(deps, servicos);
  Object.assign(servicos, criarCreditos(c),
    criarEmpresa(c),
    criarBuscas(c),
    criarEquipe(c),
    criarPesquisa(c),
    criarBaseComum(c),
    criarListas(c),
    criarPrivacidade(c),
    criarApi(c),
    criarAdmin(c));
  return servicos;
}

"use server";

import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";

export interface EstadoForm {
  erro?: string;
}

export async function entrar(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const auth = getAuth();
  if (!auth) return { erro: "Login não configurado neste ambiente." };
  const { error } = await auth.signIn.email({
    email: String(dados.get("email") ?? ""),
    password: String(dados.get("senha") ?? ""),
  });
  if (error) return { erro: error.message ?? "Não foi possível entrar." };
  redirect("/descobrir");
}

export async function criarConta(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const auth = getAuth();
  if (!auth) return { erro: "Login não configurado neste ambiente." };
  const senha = String(dados.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha precisa de pelo menos 8 caracteres." };
  const { error } = await auth.signUp.email({
    name: String(dados.get("nome") ?? ""),
    email: String(dados.get("email") ?? ""),
    password: senha,
  });
  if (error) return { erro: error.message ?? "Não foi possível criar a conta." };
  redirect("/descobrir");
}

export async function sair() {
  const auth = getAuth();
  if (auth) await auth.signOut();
  redirect("/entrar");
}

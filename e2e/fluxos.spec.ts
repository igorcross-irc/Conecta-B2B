import { expect, test } from "@playwright/test";

test.describe("site público", () => {
  test("página inicial, privacidade e opt-out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("quem decide");
    await expect(page.getByRole("link", { name: /Criar conta/ }).first()).toBeVisible();
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/optout");
    await page.getByPlaceholder("voce@empresa.com.br").fill("pessoa@empresa.com.br");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText(/Pedido registrado|link de confirmação/)).toBeVisible();
  });
});

test.describe("pesquisar empresas", () => {
  test("filtra por estado, mostra chips, remove filtro e avisa quando o estado está fora da base", async ({ page }) => {
    await page.goto("/pesquisar?uf=RJ");
    await expect(page.locator("p", { hasText: /^3\s+empresas/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Estado: RJ/ })).toBeVisible();

    // Soma um filtro de nome: sobra uma.
    await page.getByPlaceholder("Ex.: Atacadão, padaria").fill("estrela");
    await page.getByPlaceholder("Ex.: Atacadão, padaria").press("Enter");
    await expect(page.locator("p", { hasText: /^1\s+empresa/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Padaria Estrela" }).first()).toBeVisible();

    // Remover o chip do estado amplia a busca (a Padaria Estrela continua; só há uma com esse nome).
    await page.getByRole("link", { name: /Estado: RJ/ }).click();
    await expect(page).not.toHaveURL(/uf=RJ/);

    // Estado que a base não cobre: aviso claro em vez de um "0" mudo.
    await page.goto("/pesquisar?uf=MG&nome=padaria");
    await expect(page.getByText("A base carregada ainda não tem MG")).toBeVisible();
  });

  test("CNPJ digitado oferece abrir a ficha direto", async ({ page }) => {
    await page.goto("/pesquisar?nome=33.000.167%2F0001-01");
    await expect(page.getByText("Isso parece um CNPJ")).toBeVisible();
    await page.getByRole("link", { name: /Abrir 33\.000\.167/ }).click();
    await expect(page).toHaveURL(/\/descobrir\?alvo=33000167000101/);
  });

  test("sugere cidades ao digitar", async ({ page }) => {
    await page.goto("/pesquisar");
    await page.getByPlaceholder("Comece a digitar").fill("nit");
    await expect(page.locator("#sug-cidades option")).toHaveCount(1);
  });
});

test.describe("descobrir, revelar, listas e exportação", () => {
  test("da pesquisa até o CSV", async ({ page }) => {
    await page.goto("/pesquisar?nome=estrela");
    await page.getByRole("link", { name: "Ver decisores" }).first().click();
    await expect(page).toHaveURL(/\/descobrir\?alvo=10000000000145/);

    // A ficha carrega sozinha ao vir de um link.
    await expect(page.getByRole("tab", { name: /Resumo/ })).toBeVisible();
    await page.getByRole("button", { name: /Buscar pessoas/ }).click();
    await expect(page.getByText("Pessoa Exemplo A")).toBeVisible({ timeout: 30_000 });

    // Revela um telefone e vê o saldo cair.
    const antes = await page.getByText(/Saldo: \d+ créditos/).first().innerText();
    await page.getByRole("button", { name: /revelar/ }).first().click();
    await expect(page.getByText(/Saldo: \d+ créditos/).first()).not.toHaveText(antes);

    // Salva em lista e exporta.
    await page.getByPlaceholder("Nome da lista").fill("Teste e2e");
    await page.getByRole("button", { name: "Salvar todos em nova lista" }).click();
    await expect(page.getByText(/salvos na lista/)).toBeVisible();
    await page.goto("/listas");
    await expect(page.getByText("Teste e2e")).toBeVisible();
    const href = await page.getByRole("link", { name: "Exportar CSV" }).first().getAttribute("href");
    const r = await page.request.get(href!);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("text/csv");
    expect(await r.text()).toContain("Nome,Cargo,E-mail,Telefone");
  });
});

test.describe("áreas internas", () => {
  for (const [caminho, titulo] of [
    ["/base", "Base comum"], ["/equipe", "Equipe"], ["/creditos", "Créditos"], ["/configuracoes", "Configurações"],
    ["/admin", "Plataforma"], ["/admin/provedores", "Plataforma"], ["/admin/saude", "Plataforma"],
  ]) {
    test(`${caminho} abre sem erro`, async ({ page }) => {
      const resposta = await page.goto(caminho);
      expect(resposta?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(titulo);
    });
  }

  test("verificação de saúde responde", async ({ request }) => {
    const r = await request.get("/api/saude");
    expect(r.status()).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });
});

test.describe("celular @celular", () => {
  test("barra de atalhos, gaveta e folha de filtros, sem rolagem lateral", async ({ page }) => {
    await page.goto("/pesquisar?uf=RJ");
    await expect(page.getByRole("navigation", { name: "Atalhos" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    await expect(page.getByRole("button", { name: "Aplicar filtros" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar filtros" }).click();
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  });
});

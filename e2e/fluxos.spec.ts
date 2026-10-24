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
    await page.getByLabel("Nome da empresa, CNPJ ou site").fill("estrela");
    await page.getByLabel("Nome da empresa, CNPJ ou site").press("Enter");
    await expect(page.locator("p", { hasText: /^1\s+empresa/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Padaria Estrela" }).first()).toBeVisible();

    // Remover o chip do estado amplia a busca (a Padaria Estrela continua; só há uma com esse nome).
    await page.getByRole("link", { name: /Estado: RJ/ }).click();
    await expect(page).not.toHaveURL(/uf=RJ/);

    // Estado que a base não cobre: aviso claro em vez de um "0" mudo.
    await page.goto("/pesquisar?uf=MG&nome=padaria");
    await expect(page.getByText("A base carregada ainda não tem MG")).toBeVisible();
  });

  test("CNPJ ou site digitados na caixa única abrem a empresa direto", async ({ page }) => {
    await page.goto("/pesquisar?nome=33.000.167%2F0001-01");
    await expect(page).toHaveURL(/\/empresa\/33000167000101/);
    await expect(page.getByRole("heading", { level: 2, name: "Empresa Demonstração" })).toBeVisible();
    await page.goto("/pesquisar");
    await page.getByLabel("Nome da empresa, CNPJ ou site").fill("https://www.Exemplo.com.br/contato");
    await page.getByLabel("Nome da empresa, CNPJ ou site").press("Enter");
    await expect(page).toHaveURL(/\/empresa\/site%3Aexemplo\.com\.br/);
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
    await page.getByRole("link", { name: "Abrir empresa" }).first().click();
    await expect(page).toHaveURL(/\/empresa\/10000000000145/);

    // A ficha carrega sozinha ao vir de um link.
    await expect(page.getByRole("tab", { name: /Resumo/ })).toBeVisible();
    await page.getByRole("button", { name: /Buscar pessoas/ }).click();
    await expect(page.getByText("Pessoa Exemplo A")).toBeVisible({ timeout: 30_000 });

    // Revela um telefone e vê o saldo cair.
    const antes = await page.getByText(/Saldo: \d+ créditos/).first().innerText();
    await page.getByRole("button", { name: /Revelar/ }).first().click();
    await expect(page.getByText(/Saldo: \d+ créditos/).first()).not.toHaveText(antes);

    // Salva em lista e exporta.
    await page.getByPlaceholder("Nome da nova lista").fill("Teste e2e");
    await page.getByRole("button", { name: /Salvar as \d+ pessoas em nova lista/ }).click();
    await expect(page.getByText(/salvas na lista/)).toBeVisible();
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
    ["/empresas", "Minhas empresas"], ["/admin", "Plataforma"], ["/admin/provedores", "Plataforma"], ["/admin/saude", "Plataforma"],
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

test.describe("mercado", () => {
  test("pede um recorte, mostra tamanho e distribuição e leva à pesquisa", async ({ page }) => {
    await page.goto("/mercado");
    await expect(page.getByText("Escolha um recorte para começar")).toBeVisible();
    await page.goto("/mercado?uf=RJ");
    await expect(page.getByText("empresas ativas (matrizes)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por setor" })).toBeVisible();
    await page.getByRole("link", { name: /Ver estas empresas na Pesquisa/ }).click();
    await expect(page).toHaveURL(/\/pesquisar\?uf=RJ/);
  });
});

test.describe("empresas parecidas", () => {
  test("lista as parecidas de uma empresa da base e avisa quando não a encontra", async ({ page }) => {
    await page.goto("/pesquisar?uf=RJ");
    await page.getByRole("link", { name: "Empresas parecidas" }).first().click();
    await expect(page).toHaveURL(/\/parecidas\?cnpj=/);
    await expect(page.getByText("Empresa de referência")).toBeVisible();
    // da lista de parecidas abre-se a empresa na página única, e o voltar leva de volta à lista
    await page.getByText("Empresa de referência").locator("xpath=following-sibling::a").click();
    await expect(page).toHaveURL(/\/empresa\/\d{14}\?de=%2Fparecidas/);
    await page.getByRole("link", { name: /← Voltar/ }).click();
    await expect(page).toHaveURL(/\/parecidas\?cnpj=/);
    await page.goto("/parecidas?cnpj=99999999999999");
    await expect(page.getByText("Não encontrei essa empresa")).toBeVisible();
  });
});

test.describe("descobrir decisores: clareza de quem é cada pessoa e dado", () => {
  test("ficha mostra o CNPJ inteiro, pessoas dizem de qual empresa e de onde vêm, e custos aparecem", async ({ page }) => {
    await page.goto("/empresa/33000167000101");
    await expect(page.getByRole("heading", { level: 2, name: "Empresa Demonstração" })).toBeVisible();
    await expect(page.getByText("33.000.167/0001-01", { exact: true })).toBeVisible();
    // Se já houve busca recente, a ficha abre em "Pessoas"; o resumo está a um toque.
    await page.getByRole("tab", { name: "Resumo" }).click();
    await expect(page.getByText("Endereço e contato cadastrados na Receita")).toBeVisible();
    await expect(page.getByText("costumam ser da contabilidade")).toBeVisible();

    await page.getByRole("button", { name: /Buscar pessoas \(1 crédito\)/ }).click();
    await expect(page.getByText(/Pessoas ligadas a/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Empresa Demonstração").first()).toBeVisible();
    // cada pessoa traz fonte em palavras, nível de confiança e custo de revelar
    await expect(page.getByText("Dado fictício (demonstração)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Confiança (alta|média|baixa)/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Revelar e-mail · 1 crédito/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Salvar as 3 pessoas em nova lista/ })).toBeVisible();
    // e-mail adivinhado fica destacado
    await expect(page.getByText("palpite, pode não existir").first()).toBeVisible();

    // filtro que não encontra ninguém explica e permite limpar; o botão de salvar acompanha o filtro
    await page.getByText("Filtrar pessoas").click();
    await page.getByLabel("Filtrar por nome ou cargo").fill("zzzz");
    await expect(page.getByText("Nenhuma pessoa com esses filtros")).toBeVisible();
    await expect(page.getByRole("button", { name: /Salvar as 0 pessoas filtradas/ })).toBeDisabled();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByText("3 de 3 pessoas")).toBeVisible();
  });

  test("o que foi colhido fica na empresa: reabrir mostra as pessoas sem nova busca, e outra empresa não herda nada", async ({ page }) => {
    await page.goto("/empresa/33000167000101");
    await page.getByRole("button", { name: /Buscar pessoas/ }).click();
    await expect(page.getByText(/Pessoas ligadas a/)).toBeVisible({ timeout: 20000 });
    await page.goto("/empresa/11222333000181");
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.getByText(/Pessoas ligadas a/)).toHaveCount(0);
    await page.goto("/empresa/33000167000101");
    await expect(page.getByText(/Pessoas ligadas a/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("3 de 3 pessoas")).toBeVisible();
  });

  test("abas funcionam pelo teclado", async ({ page }) => {
    await page.goto("/empresa/33000167000101");
    await page.getByRole("tab", { name: "Resumo" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Pessoas/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("descobrir no celular @celular", () => {
  test("CNPJ não é cortado, abas cabem e o resultado aparece na tela após buscar", async ({ page }) => {
    await page.goto("/empresa/33000167000101");
    const cnpj = page.getByText("33.000.167/0001-01", { exact: true });
    await expect(cnpj).toBeVisible();
    const caixa = await cnpj.boundingBox();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    for (const nome of ["Resumo", "Pessoas", "Extras", "Sócios"]) {
      const b = await page.getByRole("tab", { name: new RegExp(nome) }).boundingBox();
      expect(b!.x + b!.width, `aba ${nome} dentro da tela`).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
    await page.getByRole("button", { name: /Buscar pessoas/ }).click();
    await expect(page.getByText(/Pessoas ligadas a/)).toBeInViewport({ timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("pesquisa e empresa unificadas", () => {
  test("o resultado abre a empresa na mesma área e o voltar devolve a mesma lista filtrada", async ({ page }) => {
    await page.goto("/pesquisar?uf=RJ");
    await expect(page.locator("p", { hasText: /^3\s+empresas/ })).toBeVisible();
    await page.getByRole("link", { name: "Abrir empresa" }).first().click();
    await expect(page).toHaveURL(/\/empresa\/\d{14}\?de=/);
    await expect(page.getByRole("tab", { name: "Resumo" })).toBeVisible();
    await page.getByRole("link", { name: /Voltar para os resultados/ }).click();
    await expect(page).toHaveURL(/\/pesquisar\?uf=RJ/);
    await expect(page.locator("p", { hasText: /^3\s+empresas/ })).toBeVisible();
  });

  test("links antigos de /descobrir continuam funcionando e o menu não tem mais Descobrir", async ({ page }) => {
    await page.goto("/descobrir?alvo=33000167000101");
    await expect(page).toHaveURL(/\/empresa\/33000167000101/);
    await page.goto("/descobrir");
    await expect(page).toHaveURL(/\/pesquisar/);
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Descobrir" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Minhas empresas" })).toBeVisible();
  });

  test("endereço de empresa inválido dá página não encontrada, e voltar nunca sai do aplicativo", async ({ page }) => {
    await page.goto("/empresa/lixo");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await page.goto("/empresa/33000167000101?de=https%3A%2F%2Fmalicioso.example%2F");
    await expect(page.getByRole("link", { name: /Voltar para a pesquisa/ })).toHaveAttribute("href", "/pesquisar");
  });

  test("minhas empresas junta o que foi colhido por empresa e leva à página dela", async ({ page }) => {
    await page.goto("/empresa/33000167000101");
    await page.getByRole("button", { name: /Buscar pessoas/ }).click();
    await expect(page.getByText(/Pessoas ligadas a/)).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: /Revelar e-mail/ }).first().click();
    await expect(page.getByText(/@exemplo\.com\.br/).first()).toBeVisible();

    await page.goto("/empresas");
    const cartao = page.locator('a[href*="/empresa/33000167000101"]');
    await expect(cartao).toBeVisible();
    await expect(cartao.getByText("3 pessoas")).toBeVisible();
    await expect(cartao.getByText(/1 e-mail revelado/)).toBeVisible();
    await page.getByLabel("Filtrar minhas empresas").fill("zzz");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText(/Nenhuma empresa combina/)).toBeVisible();
    await page.getByRole("link", { name: "Limpar" }).click();
    await page.locator('a[href*="/empresa/33000167000101"]').click();
    await expect(page).toHaveURL(/\/empresa\/33000167000101\?de=%2Fempresas/);
    await expect(page.getByText(/Pessoas ligadas a/)).toBeVisible({ timeout: 20000 });
    await page.getByRole("link", { name: /Voltar para Minhas empresas/ }).click();
    await expect(page).toHaveURL(/\/empresas/);
  });
});

test.describe("unificado no celular @celular", () => {
  test("atalhos trazem Pesquisar e Minhas empresas, e a caixa única cabe na tela", async ({ page }) => {
    await page.goto("/pesquisar");
    const atalhos = page.getByRole("navigation", { name: "Atalhos" });
    await expect(atalhos.getByRole("link", { name: "Pesquisar" })).toBeVisible();
    await expect(atalhos.getByRole("link", { name: "Empresas" })).toBeVisible();
    await expect(page.getByLabel("Nome da empresa, CNPJ ou site")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await atalhos.getByRole("link", { name: "Empresas" }).click();
    await expect(page).toHaveURL(/\/empresas/);
  });
});

test.describe("segurança e desempenho", () => {
  test("respostas trazem os cabeçalhos de segurança, nas telas e na API", async ({ request }) => {
    for (const caminho of ["/pesquisar", "/empresas", "/api/saude"]) {
      const r = await request.get(caminho);
      const h = r.headers();
      expect(h["x-frame-options"], caminho).toBe("DENY");
      expect(h["x-content-type-options"], caminho).toBe("nosniff");
      expect(h["content-security-policy"], caminho).toContain("frame-ancestors 'none'");
      expect(h["referrer-policy"], caminho).toBe("strict-origin-when-cross-origin");
      expect(h["strict-transport-security"], caminho).toContain("max-age=");
      expect(h["permissions-policy"], caminho).toContain("camera=()");
    }
  });

  test("a pesquisa por palavras aceita início de palavra e ignora símbolos estranhos sem erro", async ({ page }) => {
    await page.goto("/pesquisar?nome=padar&uf=RJ");
    await expect(page.getByRole("link", { name: "Padaria Estrela" }).first()).toBeVisible();
    for (const t of ["estrela:*", "a & b | !c", "'; drop table contato; --"]) {
      const r = await page.goto(`/pesquisar?uf=RJ&nome=${encodeURIComponent(t)}`);
      expect(r!.status(), t).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: "Pesquisar empresas" })).toBeVisible();
    }
  });
});

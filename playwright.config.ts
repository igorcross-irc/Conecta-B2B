import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta no navegador, em modo demonstração (sem internet e sem conta) e com um banco local semeado
 * por e2e/preparar.ts. Rodar: npm run build && npm run test:e2e
 */
const PORTA = 3100;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORTA}`, trace: "retain-on-failure" },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@celular/ },
    { name: "celular", use: { ...devices["Pixel 7"] }, grep: /@celular/ },
  ],
  webServer: {
    command: `npx next start -p ${PORTA}`,
    port: PORTA,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: { CONECTA_MODO_DEMO: "1", CONECTA_DADOS: ".dados-e2e" },
  },
});

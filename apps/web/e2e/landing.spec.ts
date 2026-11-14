import { expect, test, type Page } from '@playwright/test';
import { emailNovo, entrar } from './apoio';

/** Os scripts que a página baixou até agora, com o conteúdo (pra saber se o editor já veio). */
function scripts(page: Page) {
  const corpos: Promise<string>[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'script') corpos.push(r.text().catch(() => ''));
  });
  return async () => (await Promise.all(corpos)).join('\n');
}

const exemplos = (page: Page) => page.locator('#exemplos');

test('sem sessão, a raiz é a landing: o título, criar conta e nada do editor no primeiro carregamento', async ({ page }) => {
  const baixados = scripts(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Desenha o fluxo e dá play.' })).toBeVisible();
  // Nos testes locais o Google fica desligado: a chamada vira "Criar conta" (com o Google, "Continuar com o Google").
  await expect(page.locator('.l-abertura').getByRole('link', { name: 'Criar conta', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Fluxo de suporte no WhatsApp/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const js = await baixados();
  // O diagnóstico do @journey/fluxo e o quadro do editor ainda não vieram: chegam com a seção dos exemplos.
  expect(js).not.toContain('beco_sem_saida');
  expect(js).not.toContain('Quadro do fluxo');
  await expect(page.getByTestId('quadro')).toHaveCount(0);
});

test('com sessão, a raiz vai pra empresa como antes', async ({ page, request }) => {
  await entrar(page, request, emailNovo('landing'));
  await expect(page).toHaveURL(/\/empresa\/nova$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/empresa\/nova$/);
});

test('exemplos: rolar carrega o visualizador; na URA, o cano sem saída no diagnóstico e o play da opção 9 até Transferindo…', async ({ page }) => {
  test.setTimeout(90_000);
  const baixados = scripts(page);
  await page.goto('/');
  await exemplos(page).getByRole('tablist', { name: 'Exemplos' }).scrollIntoViewIfNeeded();
  await expect(page.getByTestId('quadro')).toBeVisible({ timeout: 30_000 });
  expect(await baixados()).toContain('beco_sem_saida');
  // Com o visualizador, o painel tem botões: ele sai do Tab.
  await expect(page.getByRole('tabpanel')).not.toHaveAttribute('tabindex');

  // Começa na URA; vai pra outra aba e volta (o visualizador monta de novo).
  await exemplos(page)
    .getByRole('tab', { name: /Suporte no WhatsApp/ })
    .click();
  await expect(page.getByRole('region', { name: 'Diagnóstico' })).toContainText('Ciclo sem espera');
  await exemplos(page)
    .getByRole('tab', { name: /URA telefônica/ })
    .click();
  await expect(exemplos(page).getByRole('tab', { name: /URA telefônica/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/#exemplo-ura$/);

  const gaveta = page.getByRole('region', { name: 'Diagnóstico' });
  await expect(gaveta.getByRole('listitem').filter({ hasText: 'Transferindo… não tem saída' })).toContainText('Grave');
  // O play começa parado: só com o clique.
  await expect(page.getByRole('region', { name: 'Simulação' })).toHaveCount(0);
  await exemplos(page).getByRole('button', { name: 'Dar play' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  // A hora do play é um dia útil às 10h: o relógio manda pro menu, a qualquer hora que o teste rode.
  await expect(sim.locator('.pergunta')).toHaveText('Menu principal', { timeout: 20_000 });
  await sim.getByRole('button', { name: /Falar com atendente/ }).click();
  await expect(page.getByTestId('fim')).toContainText('Parou em (sem saída): Transferindo…', { timeout: 20_000 });
});

test('o endereço abre a aba: #exemplo-credito é a esteira; as setas trocam de aba e o endereço acompanha', async ({ page }) => {
  await page.goto('/#exemplo-credito');
  const aba = exemplos(page).getByRole('tab', { name: /Esteira de crédito/ });
  await expect(aba).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'aba-credito-nome');
  // O endereço com o hash rola até a seção dos exemplos.
  await expect(page.getByRole('heading', { name: 'Um fluxo pra cada operação' })).toBeInViewport();
  await aba.focus();
  await page.keyboard.press('ArrowRight');
  await expect(exemplos(page).getByRole('tab', { name: /URA telefônica/ })).toBeFocused();
  await expect(exemplos(page).getByRole('tab', { name: /URA telefônica/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/#exemplo-ura$/);
  await page.keyboard.press('End');
  await expect(page).toHaveURL(/#exemplo-credito$/);
});

test('no celular, sem rolar pro lado, com o visualizador carregado', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Abaixo de 480 px, a barra fica só com "Criar conta".
  await expect(page.locator('.l-barra').getByRole('link', { name: 'Entrar' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await exemplos(page).getByRole('tablist').scrollIntoViewIfNeeded();
  await page.getByRole('tabpanel').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('quadro')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // Estreito, a gaveta do diagnóstico começa fechada (cobriria o fluxo inteiro); o botão dos achados abre.
  const achados = page.getByTestId('botao-diagnostico');
  await expect(achados).toHaveText('2 achados');
  await expect(achados).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Diagnóstico' })).toHaveCount(0);
  await achados.click();
  await expect(page.getByRole('region', { name: 'Diagnóstico' })).toContainText('Transferindo… não tem saída');
  await ctx.close();
});

test('com o e-mail ligado (o modo dos testes locais): Entrar vai pra /entrar e Criar conta pra aba de criar', async ({ page }) => {
  await page.goto('/');
  await page.locator('.l-barra').getByRole('link', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true');
  await page.goto('/');
  await page.locator('.l-barra').getByRole('link', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/entrar\?modo=criar$/);
  await expect(page.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute('aria-selected', 'true');
});

test('movimento reduzido: a abertura fica parada', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('img', { name: /Fluxo de suporte no WhatsApp/ })).toBeVisible();
  // Só a abertura: o resto da página (o visualizador, se viesse) não entra na conta.
  expect(await page.locator('.abertura-fluxo').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await ctx.close();
});

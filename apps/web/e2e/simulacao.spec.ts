import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { empresaComImport, entrar, emailNovo } from './apoio';

const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');
/** A mesma central sem a opção 1 do menu (Vendas): o cenário que passava por ela muda. */
const SEM_VENDAS = join(import.meta.dirname, 'fixtures', 'pequena-sem-vendas.json');

test.beforeEach(async ({ page, request }) => {
  await entrar(page, request, emailNovo('simula'));
  await empresaComImport(page, [PEQUENA]);
});

const decisaoDe = (page: Page) => page.getByRole('region', { name: 'Decisão' });

/** Segunda às 10h: tecla 1, ninguém da fila atende, o r1 atende. */
async function ateAtendido(page: Page) {
  await page.getByLabel('Dia e hora').fill('2026-11-23T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = decisaoDe(page);
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await page.keyboard.press('1');
  await expect(decisao).toContainText('Alguém da fila vendas (Vendas) atende?');
  await decisao.getByRole('button', { name: /Ninguém atende em 30 s/ }).click();
  await expect(decisao).toContainText('O ramal r1 (Atendente Um) atende?');
  await decisao.getByRole('button', { name: /^.\s*Atende/ }).click();
  await expect(page.getByTestId('fim')).toContainText('Atendido');
}

async function salvar(page: Page, nome: string) {
  const fim = page.getByTestId('fim');
  await fim.getByLabel('Nome do cenário').fill(nome);
  await fim.getByRole('button', { name: 'Salvar como cenário' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${nome}`) })).toBeVisible();
}

test('simula até o fim, salva o cenário, volta uma decisão e reabre pelo link', async ({ page }) => {
  test.setTimeout(90_000);
  await ateAtendido(page);
  await expect(page.getByTestId('linha-do-tempo')).toContainText('Opção 1 (escolha de quem simula)');
  await salvar(page, 'E se ninguém da fila atender?');

  await page.getByRole('button', { name: 'Voltar uma decisão' }).click();
  await expect(decisaoDe(page)).toContainText('O ramal r1 (Atendente Um) atende?');

  await page.getByRole('button', { name: /^E se ninguém da fila atender\?/ }).click();
  await expect(page).toHaveURL(/\?cenario=/);
  await page.reload();
  await expect(page.getByTestId('fim')).toContainText('Igual ao resultado aprovado', { timeout: 30_000 });
});

test('cenário aberto: outra escolha solta o cenário, salvar cria outro e o primeiro continua igual a si mesmo', async ({ page }) => {
  test.setTimeout(120_000);
  await ateAtendido(page);
  await salvar(page, 'Pela fila');
  const pelaFila = page.getByRole('button', { name: /^Pela fila/ });
  await pelaFila.click();
  await expect(page).toHaveURL(/\?cenario=/);
  const link = page.url();
  await expect(page.getByTestId('comparacao')).toContainText('Igual ao resultado aprovado', { timeout: 30_000 });
  await expect(pelaFila).toHaveAttribute('aria-pressed', 'true');

  // Voltar ainda é o caminho do cenário (só que no meio): ele continua aberto, sem comparação.
  await page.getByRole('button', { name: 'Voltar uma decisão' }).click();
  const decisao = decisaoDe(page);
  await expect(decisao).toContainText('O ramal r1 (Atendente Um) atende?');
  await expect(pelaFila).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('comparacao')).toHaveCount(0);

  // Outra opção: já não é o cenário. Sem comparação nem "aprovar"; o fim oferece salvar de novo.
  await decisao.getByRole('button', { name: /Não atende em 20 s/ }).click();
  await expect(pelaFila).toHaveAttribute('aria-pressed', 'false');
  await expect(page).not.toHaveURL(/cenario=/);
  await expect(decisao).toContainText('O ramal r2 (Atendente Dois) atende?');
  await decisao.getByRole('button', { name: /^.\s*Atende/ }).click();
  await expect(page.getByTestId('fim')).toContainText('Atendido');
  await expect(page.getByTestId('comparacao')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aprovar este resultado' })).toHaveCount(0);
  await salvar(page, 'Pelo r2');

  // O primeiro não foi tocado: pelo link, refaz o caminho dele e bate com o aprovado.
  await page.goto(link);
  await expect(page.getByTestId('comparacao')).toContainText('Igual ao resultado aprovado de “Pela fila”', { timeout: 30_000 });
  await page.getByRole('button', { name: /^Pelo r2/ }).click();
  await expect(page.getByTestId('comparacao')).toContainText('Igual ao resultado aprovado de “Pelo r2”', { timeout: 30_000 });
});

test('depois de um import que tira a opção, a decisão mostra a diferença; aprovar grava e o aviso some', async ({ page }) => {
  test.setTimeout(150_000);
  await ateAtendido(page);
  await salvar(page, 'Vendas');

  await page.getByRole('link', { name: 'Importar' }).first().click();
  await page.getByLabel('Arquivos').setInputFiles([SEM_VENDAS]);
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByText('pode confirmar')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Confirmar import' }).click();
  await expect(page.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /^Vendas/ }).click();
  const decisao = decisaoDe(page);
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await expect(decisao.getByTestId('comparacao')).toContainText('O resultado mudou desde a versão 1');
  await decisao.getByRole('button', { name: 'Aprovar este resultado' }).click();
  await expect(decisao.getByTestId('comparacao')).toContainText('Igual ao resultado aprovado de “Vendas”');
  await expect(page.getByRole('button', { name: /^Vendas/ })).toContainText('versão 2');

  await page.reload();
  await expect(decisaoDe(page).getByTestId('comparacao')).toContainText('Igual ao resultado aprovado', { timeout: 30_000 });
});

test('escolhe clicando no chip do cano', async ({ page }) => {
  await page.getByLabel('Dia e hora').fill('2026-11-23T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = decisaoDe(page);
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await page.getByTestId('mapa').getByRole('button', { name: 'Escolher 1' }).click();
  await expect(decisao).toContainText('Alguém da fila vendas (Vendas) atende?');
  await expect(page.getByTestId('linha-do-tempo')).toContainText('Opção 1');
});

test('no modo livre, S responde o relógio', async ({ page }) => {
  await page.getByLabel('Dia e hora').fill('2026-11-22T10:00');
  await page.getByLabel('Quem decide').selectOption('livre');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = decisaoDe(page);
  await expect(decisao.locator('.tecla', { hasText: 'S' })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('s');
  await expect(decisao).toContainText('O que a pessoa digita?');
});

test('com "reduzir movimento", a ligação chega ao fim', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ateAtendido(page);
});

test('no celular, a decisão aparece embaixo do mapa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Dia e hora').fill('2026-11-23T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = decisaoDe(page);
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await decisao.scrollIntoViewIfNeeded();
  await expect(decisao).toBeVisible();
  const cartao = (await decisao.boundingBox())!;
  const mapa = (await page.getByTestId('mapa').boundingBox())!;
  expect(cartao.y).toBeGreaterThanOrEqual(mapa.y + mapa.height - 1);
  expect(cartao.x + cartao.width).toBeLessThanOrEqual(390);
  await decisao.getByRole('button', { name: /Vendas/ }).click();
  await expect(decisao).toContainText('Alguém da fila vendas (Vendas) atende?');
});

test('fora do horário, o relógio decide sozinho', async ({ page }) => {
  await page.getByLabel('Dia e hora').fill('2026-11-22T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  await expect(page.getByTestId('fim')).toContainText('A ligação terminou', { timeout: 30_000 });
  await expect(page.getByTestId('linha-do-tempo')).toContainText('Chegou em Aviso de fechado');
});

test('ramais diretos: ninguém atende e o transbordo vira ciclo', async ({ page }) => {
  await page.getByRole('tab', { name: 'Ramais' }).click();
  await page.getByTestId('ramais').getByRole('button', { name: /r1 Atendente Um/ }).click();
  await expect(page.getByTestId('fim')).toContainText('Ciclo sem fim', { timeout: 30_000 });
});

test('diagnóstico: simular leva a água até o achado; intencional sai da contagem', async ({ page }) => {
  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  const ciclo = page.locator('[data-chave="ciclo_transbordo:r1+r2"]');
  await expect(ciclo).toBeVisible();
  await ciclo.getByRole('button', { name: 'Simular' }).click();
  await expect(page.getByTestId('fim')).toContainText('Ciclo sem fim', { timeout: 30_000 });
  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  await ciclo.getByRole('button', { name: 'Marcar como intencional' }).click();
  await ciclo.getByLabel('Nota').fill('é assim de propósito');
  await ciclo.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(page.locator('[data-chave="ciclo_transbordo:r1+r2"]')).toHaveCount(0);
  await page.getByText('Intencionais (1)').click();
  const marcado = page.locator('[data-intencional="ciclo_transbordo:r1+r2"]');
  await expect(marcado).toContainText('é assim de propósito');
  await expect(marcado).toContainText(/por simula-.+@exemplo\.com/);
});

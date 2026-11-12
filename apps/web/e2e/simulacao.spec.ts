import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { empresaComImport, entrar, emailNovo } from './apoio';

const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');

test.beforeEach(async ({ page, request }) => {
  await entrar(page, request, emailNovo('simula'));
  await empresaComImport(page, [PEQUENA]);
});

test('simula até o fim, salva o cenário, volta uma decisão e reabre pelo link', async ({ page }) => {
  test.setTimeout(90_000);
  await page.getByLabel('Dia e hora').fill('2026-11-23T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();

  const decisao = page.getByRole('dialog', { name: 'Decisão' });
  await expect(decisao).toContainText('O que a pessoa digita?');
  await page.keyboard.press('1');
  await expect(decisao).toContainText('Alguém da fila vendas (Vendas) atende?');
  await decisao.getByRole('button', { name: /Ninguém atende em 30 s/ }).click();
  await expect(decisao).toContainText('O ramal r1 (Atendente Um) atende?');
  await decisao.getByRole('button', { name: /^.\s*Atende/ }).click();

  const fim = page.getByTestId('fim');
  await expect(fim).toContainText('Atendido');
  await expect(page.getByTestId('linha-do-tempo')).toContainText('Opção 1 (escolha de quem simula)');

  await fim.getByLabel('Nome do cenário').fill('E se ninguém da fila atender?');
  await fim.getByRole('button', { name: 'Salvar como cenário' }).click();
  await expect(page.getByRole('button', { name: /^E se ninguém da fila atender\?/ })).toBeVisible();

  await page.getByRole('button', { name: 'Voltar uma decisão' }).click();
  await expect(decisao).toContainText('O ramal r1 (Atendente Um) atende?');

  await page.getByRole('button', { name: /^E se ninguém da fila atender\?/ }).click();
  await expect(page).toHaveURL(/\?cenario=/);
  await page.reload();
  await expect(page.getByTestId('fim')).toContainText('Igual ao resultado aprovado', { timeout: 30_000 });
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
  await expect(page.getByText('Intencionais (1)')).toBeVisible();
});

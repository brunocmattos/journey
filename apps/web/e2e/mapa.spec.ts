import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { empresaComImport, entrar, emailNovo } from './apoio';

/** Uma entrada de WhatsApp, um atalho de volta pro menu e uma mensagem sem saída. */
const WHATSAPP = join(import.meta.dirname, 'fixtures', 'whatsapp.json');

test.beforeEach(async ({ page, request }) => {
  await entrar(page, request, emailNovo('mapa'));
  await empresaComImport(page, [WHATSAPP]);
});

test('"ver no mapa" a partir do mapa de um ramal volta pro fluxo das entradas e acende o achado', async ({ page }) => {
  const mapa = page.getByTestId('mapa');
  await page.getByRole('tab', { name: 'Ramais' }).click();
  await page.getByTestId('ramais').getByRole('button', { name: /r1 Atendente Um/ }).click();
  await expect(page.getByTestId('fim')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('a partir de')).toBeVisible();
  await expect(mapa.locator('[data-no="peca:perdido"]')).toHaveCount(0);

  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  await page.locator('[data-chave="beco_sem_saida:peca:perdido"]').getByRole('button', { name: 'Ver no mapa' }).click();
  await expect(page.getByText('a partir de')).toHaveCount(0);
  await expect(mapa.locator('[data-no="peca:perdido"]')).toHaveClass(/\bfoco\b/);
  expect(await mapa.locator('[data-no].foco').count()).toBeGreaterThan(0);
});

test('entrada de WhatsApp: a água corre no canal dela e o atalho volta pro menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = page.getByRole('region', { name: 'Decisão' });
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await expect(page.locator('.hud')).toContainText('whatsapp');
  await page.keyboard.press('2');
  await expect(page.getByTestId('linha-do-tempo')).toContainText('Aviso de horário', { timeout: 30_000 });
  await expect(decisao).toContainText('O que a pessoa digita?');
});

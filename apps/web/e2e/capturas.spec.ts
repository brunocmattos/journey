import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { entrar, emailNovo, irPara } from './apoio';

const CENTRAL = join(import.meta.dirname, '..', '..', '..', 'packages', 'nucleo', 'test', 'fixtures', 'central');
const PASTA = process.env.CAPTURAS ?? '';

test.skip(!PASTA, 'só com CAPTURAS=<pasta>');

test('capturas da tela', async ({ page, request, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, request, emailNovo('captura'));
  await page.getByLabel('Nome da empresa').fill('Central de teste');
  await page.getByRole('button', { name: 'Criar' }).click();
  await irPara(page, 'importar');
  await page.getByLabel('Arquivos').setInputFiles(readdirSync(CENTRAL).filter((n) => n.endsWith('.csv')).map((n) => join(CENTRAL, n)));
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar import' })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: join(PASTA, '1-revisao.png'), fullPage: true });
  await page.getByRole('button', { name: 'Confirmar import' }).click();
  await expect(page.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(PASTA, '2-mapa.png') });
  await page.getByLabel('Dia e hora').fill('2026-11-24T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Decisão' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(PASTA, '3-decisao.png') });
  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  await page.screenshot({ path: join(PASTA, '4-diagnostico.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(PASTA, '5-celular.png'), fullPage: false });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('tab', { name: 'Simular' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(PASTA, '6-escuro.png') });

  // Etapa 3: o "Compartilhar" e o link público, aberto sem conta (no computador e no celular).
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  await dialogo.getByRole('button', { name: 'Criar link' }).click();
  const endereco = await dialogo.getByLabel('Endereço do link').inputValue();
  await page.screenshot({ path: join(PASTA, '7-compartilhar.png') });
  const fora = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const visita = await fora.newPage();
  await visita.goto(endereco);
  await expect(visita.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });
  await visita.waitForTimeout(800);
  await visita.screenshot({ path: join(PASTA, '8-link-publico.png') });
  await visita.setViewportSize({ width: 390, height: 844 });
  await visita.waitForTimeout(500);
  await visita.screenshot({ path: join(PASTA, '9-link-celular.png'), fullPage: true });
  await fora.close();
});

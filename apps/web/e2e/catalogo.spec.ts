import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { empresaComImport, entrar, emailNovo } from './apoio';

const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');

test('catálogo diz onde cada coisa é usada', async ({ page, request }) => {
  await entrar(page, request, emailNovo('catalogo'));
  await empresaComImport(page, [PEQUENA]);
  await page.getByRole('link', { name: 'Catálogo' }).click();
  await page.getByRole('link', { name: /^ramais/ }).click();
  await page.getByTestId('tabela-catalogo').getByRole('link', { name: 'r1' }).click();
  const onde = page.getByTestId('onde-usado');
  await expect(onde).toContainText('filas · Vendas');
  await expect(onde).toContainText('Jornada Telefonia');
});

test('import parcial muda só a aba que veio', async ({ page, request }) => {
  await entrar(page, request, emailNovo('parcial'));
  await empresaComImport(page, [PEQUENA], 'Empresa parcial');
  await page.getByRole('link', { name: 'Importar' }).first().click();
  await page.getByLabel('Arquivos').setInputFiles({
    name: 'filas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id;nome;estrategia;espera_maxima_s\nvendas;Vendas;ringall;90\n'),
  });
  await page.getByLabel(/Import parcial/).check();
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByText('pode confirmar')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('parcial ·', { exact: false })).toBeVisible();
  await expect(page.getByTestId('contagem')).toContainText('2ramais');
  await page.getByRole('button', { name: 'Confirmar import' }).click();
  await expect(page.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Versão 2.')).toBeVisible();
});
